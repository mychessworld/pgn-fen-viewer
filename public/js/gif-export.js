import { Chess, DEFAULT_POSITION } from '/vendor/chess.js/chess.mjs';
import { GIFEncoder, quantize, applyPalette } from '/vendor/gifenc/gifenc.esm.js';

const BOARD_PX = 400;
const SQUARE_PX = BOARD_PX / 8;
const LIGHT_SQ = '#ebecd0';
const DARK_SQ = '#739552';
const FRAME_DELAY = 700;
const MAX_FRAMES = 200;
const PIECE_URL = '/pieces/wikipedia/{piece}.png';

const PIECE_KEYS = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const pieceCache = new Map();

function stripBom(text) {
    return text.replace(/^\uFEFF/, '');
}

function looksLikePgnHeaders(text) {
    return /^\[([A-Za-z][A-Za-z0-9_]*)\s+"/m.test(text);
}

function looksLikeFenOnly(text) {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim() || '';
    if (looksLikePgnHeaders(text) || /^fen:\s*/i.test(firstLine) || /^\d+\./.test(firstLine)) {
        return false;
    }
    const parts = firstLine.split(/\s+/);
    return parts.length >= 4 && /^[rnbqkpRNBQKP1-8/]+$/.test(parts[0]);
}

function detectInputMode(text) {
    if (looksLikePgnHeaders(text) || /^fen:\s*/im.test(text) || /^\d+\./m.test(text.trim())) {
        return 'pgn';
    }
    if (looksLikeFenOnly(text)) {
        return 'fen';
    }
    return 'pgn';
}

function parseObsidianChessBlock(rawInput) {
    const text = rawInput.trim();
    const match = text.match(/^```(pgn|fen)\s*[\r\n]+([\s\S]*?)\s*```$/i);
    if (!match) {
        return {
            mode: detectInputMode(text),
            content: text
        };
    }
    return {
        mode: match[1].toLowerCase(),
        content: match[2].trim()
    };
}

function normalizePgnContent(content) {
    let text = stripBom(content).replace(/\r\n/g, '\n').trim();

    if (/^fen:\s*/i.test(text)) {
        const lines = text.split('\n');
        const fenLine = lines[0];
        const afterPrefix = fenLine.replace(/^fen:\s*/i, '').trim();
        const parts = afterPrefix.split(/\s+/);
        let fen = '';
        let remainingFromFirstLine = '';

        if (parts.length >= 6) {
            fen = parts.slice(0, 6).join(' ');
            remainingFromFirstLine = parts.slice(6).join(' ');
        } else {
            fen = afterPrefix;
        }

        let remainingPgn = lines.slice(1).join('\n').trim();
        if (remainingFromFirstLine) {
            remainingPgn = remainingFromFirstLine + (remainingPgn ? ` ${remainingPgn}` : '');
        }

        const separator = remainingPgn.startsWith('[') ? '\n' : '\n\n';
        text = `[SetUp "1"]
[FEN "${fen}"]${separator}${remainingPgn}`.trim();
    } else if (looksLikePgnHeaders(text)) {
        text = text.replace(/^((?:\[[^\]]+\]\s*\n)+)(?!\n)(\S)/m, '$1\n$2');
    }

    return text;
}

function buildPayload(rawInput) {
    const parsed = parseObsidianChessBlock(rawInput);
    if (!parsed.content) {
        throw new Error('Поле ввода пустое');
    }
    if (parsed.mode === 'fen') {
        return {
            mode: 'fen',
            pgn: `[SetUp "1"]
[FEN "${parsed.content}"]

*`,
            fen: parsed.content.trim()
        };
    }
    return {
        mode: 'pgn',
        pgn: normalizePgnContent(parsed.content)
    };
}

function charToPieceKey(ch) {
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const type = ch.toUpperCase();
    const map = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K' };
    return `${color}${map[type]}`;
}

async function loadPieceImages() {
    const pending = PIECE_KEYS.filter((key) => !pieceCache.has(key)).map(async (key) => {
        const img = new Image();
        img.src = PIECE_URL.replace('{piece}', key);
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error(`Не удалось загрузить фигуру: ${key}`));
        });
        pieceCache.set(key, img);
    });
    await Promise.all(pending);
}

function collectFens(payload) {
    if (payload.mode === 'fen') {
        return [payload.fen];
    }

    const parser = new Chess();
    try {
        parser.loadPgn(payload.pgn);
    } catch {
        throw new Error('Не удалось разобрать PGN для GIF');
    }

    const moves = parser.history();
    if (moves.length === 0) {
        throw new Error('В PGN нет ходов для анимации');
    }

    const startFen = parser.getHeaders().FEN || DEFAULT_POSITION;
    const replay = new Chess(startFen);
    const fens = [replay.fen()];

    for (const move of moves) {
        const result = replay.move(move);
        if (!result) {
            throw new Error(`Некорректный ход в PGN: ${move}`);
        }
        fens.push(replay.fen());
    }

    if (fens.length > MAX_FRAMES) {
        throw new Error(`Слишком много позиций (${fens.length}). Максимум: ${MAX_FRAMES}`);
    }

    return fens;
}

function drawBoardFrame(ctx, fen) {
    const placement = fen.split(' ')[0];
    const ranks = placement.split('/');

    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const isLight = (rank + file) % 2 === 0;
            ctx.fillStyle = isLight ? LIGHT_SQ : DARK_SQ;
            ctx.fillRect(file * SQUARE_PX, rank * SQUARE_PX, SQUARE_PX, SQUARE_PX);
        }
    }

    for (let rank = 0; rank < 8; rank++) {
        let file = 0;
        for (const ch of ranks[rank]) {
            if (ch >= '1' && ch <= '8') {
                file += Number(ch);
                continue;
            }
            const pieceKey = charToPieceKey(ch);
            const img = pieceCache.get(pieceKey);
            if (img) {
                const padding = SQUARE_PX * 0.08;
                ctx.drawImage(
                    img,
                    file * SQUARE_PX + padding,
                    rank * SQUARE_PX + padding,
                    SQUARE_PX - padding * 2,
                    SQUARE_PX - padding * 2
                );
            }
            file += 1;
        }
    }
}

function frameToRgba(fen) {
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_PX;
    canvas.height = BOARD_PX;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    drawBoardFrame(ctx, fen);
    return ctx.getImageData(0, 0, BOARD_PX, BOARD_PX);
}

function encodeGif(fens) {
    const gif = GIFEncoder();

    fens.forEach((fen, index) => {
        const { data } = frameToRgba(fen);
        const palette = quantize(data, 256);
        const indexBitmap = applyPalette(data, palette);

        gif.writeFrame(indexBitmap, BOARD_PX, BOARD_PX, {
            palette,
            delay: FRAME_DELAY,
            repeat: index === 0 ? 0 : undefined
        });
    });

    gif.finish();
    return gif.bytes();
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '').trim() || 'chess-game';
}

function buildFilename(payload) {
    if (payload.mode !== 'pgn') {
        return 'chess-position.gif';
    }
    const parser = new Chess();
    try {
        parser.loadPgn(payload.pgn);
    } catch {
        return 'chess-game.gif';
    }
    const event = parser.getHeaders().Event;
    if (event) {
        return `${sanitizeFilename(event)}.gif`;
    }
    return 'chess-game.gif';
}

function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export async function exportPgnToGif(rawInput) {
    const payload = buildPayload(rawInput);
    await loadPieceImages();
    const fens = collectFens(payload);
    const bytes = encodeGif(fens);
    downloadBytes(bytes, buildFilename(payload));
    return {
        frames: fens.length,
        filename: buildFilename(payload)
    };
}
