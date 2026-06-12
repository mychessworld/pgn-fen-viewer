import { Chess } from '/vendor/chess.js/chess.mjs';

const WORKER_URL = '/vendor/stockfish/stockfish.js';
const INIT_TIMEOUT_MS = 20000;
const ANALYSIS_DEPTH = 16;

export function fenFromAnalysisBase(base) {
    if (!base?.getPgn) {
        return new Chess().fen();
    }

    const pgn = base.getPgn().writePgn();
    if (!pgn?.trim() || pgn.trim() === '*') {
        return new Chess().fen();
    }

    const chess = new Chess();
    try {
        chess.loadPgn(pgn);
    } catch {
        return new Chess().fen();
    }
    return chess.fen();
}

function uciPvToSan(fen, pv) {
    const chess = new Chess(fen);
    const moves = pv.trim().split(/\s+/).filter(Boolean);
    const sans = [];

    for (const uci of moves.slice(0, 10)) {
        if (uci.length < 4) {
            break;
        }
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = chess.move({ from, to, promotion });
        if (!move) {
            break;
        }
        sans.push(move.san);
    }

    return sans.join(' ');
}

export function fenSideToMove(fen) {
    const stm = fen?.trim().split(/\s+/)[1];
    return stm === 'b' ? 'b' : 'w';
}

/** UCI scores are from side-to-move; convert to white's perspective. */
export function adjustScoreToWhite({ scoreCp, scoreMate }, fen) {
    if (fenSideToMove(fen) === 'w') {
        return { scoreCp, scoreMate };
    }
    return {
        scoreCp: scoreCp !== null && scoreCp !== undefined ? -scoreCp : scoreCp,
        scoreMate: scoreMate !== null && scoreMate !== undefined ? -scoreMate : scoreMate
    };
}

export function formatEngineScore({ scoreCp, scoreMate }) {
    if (scoreMate !== null && scoreMate !== undefined) {
        return scoreMate > 0 ? `M${scoreMate}` : `-M${Math.abs(scoreMate)}`;
    }
    if (scoreCp !== null && scoreCp !== undefined) {
        const pawns = scoreCp / 100;
        return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
    }
    return '—';
}

export class StockfishEngine {
    constructor(workerUrl = WORKER_URL) {
        this.worker = new Worker(workerUrl);
        this.ready = false;
        this.busy = false;
        this.analysisFen = null;
        this.onUpdate = null;
        this._initResolve = null;
        this._initReject = null;
        this._initTimer = null;

        this.worker.onmessage = (event) => this._handleMessage(event.data);
        this.worker.onerror = (error) => {
            if (this._initReject) {
                this._initReject(error);
                this._clearInitWait();
            }
        };
    }

    _clearInitWait() {
        clearTimeout(this._initTimer);
        this._initResolve = null;
        this._initReject = null;
        this._initTimer = null;
    }

    _handleMessage(line) {
        if (typeof line !== 'string') {
            return;
        }

        if (line === 'uciok' && !this.ready) {
            this.worker.postMessage('isready');
            return;
        }

        if (line === 'readyok' && !this.ready) {
            this.ready = true;
            this._initResolve?.();
            this._clearInitWait();
            return;
        }

        if (line.startsWith('info ') && line.includes(' pv ')) {
            this._parseInfo(line);
            return;
        }

        if (line.startsWith('bestmove ')) {
            this.busy = false;
            if (this.onAnalysisComplete) {
                this.onAnalysisComplete();
            }
        }
    }

    _parseInfo(line) {
        const depthMatch = line.match(/\bdepth (\d+)/);
        const scoreCpMatch = line.match(/\bscore cp (-?\d+)/);
        const scoreMateMatch = line.match(/\bscore mate (-?\d+)/);
        const pvMatch = line.match(/\bpv (.+)$/);

        if (!pvMatch || !this.analysisFen) {
            return;
        }

        const pv = pvMatch[1].trim();
        const { scoreCp, scoreMate } = adjustScoreToWhite({
            scoreCp: scoreCpMatch ? Number(scoreCpMatch[1]) : null,
            scoreMate: scoreMateMatch ? Number(scoreMateMatch[1]) : null
        }, this.analysisFen);
        const result = {
            depth: depthMatch ? Number(depthMatch[1]) : 0,
            scoreCp,
            scoreMate,
            pv,
            sanLine: uciPvToSan(this.analysisFen, pv)
        };

        if (this.onUpdate) {
            this.onUpdate(result);
        }
    }

    init() {
        if (this.ready) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this._initResolve = resolve;
            this._initReject = reject;
            this._initTimer = setTimeout(() => {
                reject(new Error('Таймаут загрузки Stockfish'));
                this._clearInitWait();
            }, INIT_TIMEOUT_MS);
            this.worker.postMessage('uci');
        });
    }

    analyze(fen, { depth = ANALYSIS_DEPTH } = {}) {
        if (!this.ready || !fen) {
            return;
        }

        if (this.busy) {
            this.worker.postMessage('stop');
        }

        this.analysisFen = fen;
        this.busy = true;
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
    }

    stop() {
        if (!this.ready) {
            return;
        }
        if (this.busy) {
            this.worker.postMessage('stop');
            this.busy = false;
        }
    }

    terminate() {
        this.stop();
        this.worker.terminate();
        this.ready = false;
        this.busy = false;
    }
}
