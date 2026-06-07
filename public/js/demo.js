document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'pgn';

    const pgnInput = document.getElementById('pgn-input');
    const inputLabel = document.querySelector('label[for="pgn-input"]');
    const loadBtn = document.getElementById('load-btn');
    const gifBtn = document.getElementById('gif-btn');
    const resetBtn = document.getElementById('reset-btn');
    const viewerContainer = document.getElementById('chess-viewer');
    const viewerStatus = document.getElementById('viewer-status');
    const modeBtns = document.querySelectorAll('.mode-btn');

    const BOARD_SIZE_MAX = 600;
    const BOARD_SIZE_MIN = 260;
    let currentBoardSize = 0;
    let resizeTimer;
    let isFixingVariationOrder = false;
    let variationOrderObserver = null;

    function getBoardSizePx() {
        const container = document.querySelector('.container');
        const available = (container?.clientWidth || window.innerWidth) - 64;
        const size = Math.min(BOARD_SIZE_MAX, Math.max(BOARD_SIZE_MIN, available));
        return Math.floor(size / 8) * 8;
    }

    function applyBoardSize(size) {
        viewerContainer.style.setProperty('--chess-board-size', `${size}px`);
        currentBoardSize = size;
    }

    function setStatus(text, isError = false) {
        viewerStatus.textContent = text;
        viewerStatus.classList.toggle('error', isError);
        viewerStatus.classList.toggle('success', !isError);
    }

    function clearViewer() {
        if (variationOrderObserver) {
            variationOrderObserver.disconnect();
            variationOrderObserver = null;
        }
        viewerContainer.innerHTML = '';
    }

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
        if (looksLikePgnHeaders(text) || /^fen:\s*/im.test(text) || /^\d+\./.m.test(text.trim())) {
            return 'pgn';
        }
        if (looksLikeFenOnly(text)) {
            return 'fen';
        }
        return currentMode;
    }

    function findBlackMoveAnchor(children, moveNumber) {
        for (let j = 0; j < children.length; j++) {
            const node = children[j];
            if (node.tagName !== 'MOVE-NUMBER') {
                continue;
            }
            const nodeText = (node.textContent || '').trim();
            if (nodeText.endsWith('...')) {
                continue;
            }
            if (nodeText.replace(/\.+$/, '') !== moveNumber) {
                continue;
            }

            let sawWhiteMove = false;
            for (let k = j + 1; k < children.length; k++) {
                const sibling = children[k];
                if (sibling.tagName === 'DIV' && sibling.classList.contains('variation')) {
                    continue;
                }
                if (sibling.tagName === 'MOVE-NUMBER') {
                    break;
                }
                if (sibling.tagName === 'MOVE') {
                    if (!sawWhiteMove) {
                        sawWhiteMove = true;
                        continue;
                    }
                    return sibling;
                }
            }
        }
        return null;
    }

    function fixVariationOrderInDOM(container) {
        if (isFixingVariationOrder) {
            return;
        }

        const movesContainer = container.querySelector('.moves');
        if (!movesContainer) {
            return;
        }

        isFixingVariationOrder = true;
        try {
            const children = Array.from(movesContainer.children);

            for (let i = 0; i < children.length; i++) {
                const current = children[i];
                if (current.tagName !== 'DIV' || !current.classList.contains('variation')) {
                    continue;
                }

                const varMatch = (current.textContent || '').match(/(\d+)(\.\.\.|\.)/);
                if (!varMatch) {
                    continue;
                }

                const varNum = varMatch[1];
                const isVarForBlack = varMatch[2] === '...';
                let insertAfter = null;

                for (let j = 0; j < children.length; j++) {
                    const targetNode = children[j];
                    if (targetNode.tagName !== 'MOVE-NUMBER') {
                        continue;
                    }

                    const nodeText = (targetNode.textContent || '').trim();
                    const isNodeForBlack = nodeText.endsWith('...');
                    const nodeNum = nodeText.replace(/\.+$/, '');

                    if (nodeNum !== varNum || isVarForBlack !== isNodeForBlack) {
                        continue;
                    }

                    insertAfter = targetNode;
                    for (let k = j + 1; k < Math.min(j + 8, children.length); k++) {
                        const sibling = children[k];
                        if (sibling.tagName === 'MOVE' || sibling.tagName === 'SPAN' || sibling.classList.contains('filler')) {
                            insertAfter = sibling;
                        } else {
                            break;
                        }
                    }
                    break;
                }

                if (isVarForBlack && !insertAfter) {
                    insertAfter = findBlackMoveAnchor(children, varNum);
                }

                if (
                    insertAfter
                    && insertAfter !== current
                    && insertAfter.nextSibling !== current
                    && (current.compareDocumentPosition(insertAfter) & Node.DOCUMENT_POSITION_FOLLOWING)
                ) {
                    insertAfter.after(current);
                }
            }
        } catch (error) {
            console.error('Variation order fix failed:', error);
        } finally {
            isFixingVariationOrder = false;
        }
    }

    function scheduleVariationOrderFix(container) {
        if (variationOrderObserver) {
            variationOrderObserver.disconnect();
        }

        variationOrderObserver = new MutationObserver(() => {
            fixVariationOrderInDOM(container);
        });
        variationOrderObserver.observe(container, { childList: true, subtree: true });

        fixVariationOrderInDOM(container);
        [200, 500, 1000].forEach((delay) => {
            setTimeout(() => fixVariationOrderInDOM(container), delay);
        });
    }

    function withoutScrollJump(action) {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        action();
        window.scrollTo(scrollX, scrollY);
    }

    function preservePageScroll() {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        requestAnimationFrame(() => {
            window.scrollTo(scrollX, scrollY);
            requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
        });
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

*`
            };
        }
        return {
            mode: 'pgn',
            pgn: normalizePgnContent(parsed.content)
        };
    }

    function initViewer(rawInput) {
        clearViewer();
        try {
            if (!window.PGNV || typeof window.PGNV.pgnView !== 'function') {
                throw new Error('Библиотека @mliebelt/pgn-viewer не загрузилась');
            }

            const payload = buildPayload(rawInput);
            const boardSize = getBoardSizePx();
            applyBoardSize(boardSize);

            window.PGNV.pgnView('chess-viewer', {
                pgn: payload.pgn,
                layout: 'top',
                notation: 'short',
                showCoords: true,
                showNotation: true,
                coordsInner: false,
                coordsFontSize: '12',
                boardSize: `${boardSize}px`,
                resizable: false,
                theme: 'green',
                pieceStyle: 'wikipedia'
            });

            if (payload.mode === 'pgn') {
                scheduleVariationOrderFix(viewerContainer);
            }

            if (payload.mode === 'fen') {
                setStatus('FEN-позиция успешно загружена в песочницу.');
            } else {
                setStatus('PGN-партия успешно загружена в песочницу.');
            }
            return true;
        } catch (e) {
            setStatus(`Ошибка загрузки: ${e.message}`, true);
            return false;
        }
    }

    function setMode(mode) {
        currentMode = mode;
        modeBtns.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        if (mode === 'fen') {
            inputLabel.textContent = 'Вставьте FEN:';
            pgnInput.placeholder = 'Например: r1bqkbnr/pppp1ppp/2n5/...';
        } else {
            inputLabel.textContent = 'Вставьте PGN:';
            pgnInput.placeholder = '```pgn\n1. e4 e5 2. Nf3...\n```';
        }
    }

    loadBtn.addEventListener('click', () => {
        withoutScrollJump(() => initViewer(pgnInput.value));
    });

    gifBtn.addEventListener('click', async () => {
        withoutScrollJump(async () => {
            gifBtn.disabled = true;
            setStatus('Создание GIF…');
            try {
                const { exportPgnToGif } = await import('/js/gif-export.js');
                const { frames, filename } = await exportPgnToGif(pgnInput.value);
                setStatus(`GIF сохранён (${frames} кадр${frames === 1 ? '' : frames < 5 ? 'а' : 'ов'}): ${filename}`);
            } catch (error) {
                setStatus(`Ошибка GIF: ${error.message}`, true);
            } finally {
                gifBtn.disabled = false;
            }
        });
    });

    resetBtn.addEventListener('click', () => {
        withoutScrollJump(() => {
            pgnInput.value = '';
            clearViewer();
            setStatus('Поле очищено. Вставьте PGN/FEN и нажмите "Загрузить в вьювер".');
        });
    });

    modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
        });
    });

    viewerContainer.addEventListener('click', (event) => {
        if (!event.target.closest('.pgnvjs')) {
            return;
        }
        preservePageScroll();
    }, true);

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const nextSize = getBoardSizePx();
            if (Math.abs(nextSize - currentBoardSize) < 8) {
                return;
            }
            if (pgnInput.value.trim()) {
                initViewer(pgnInput.value);
            } else {
                applyBoardSize(nextSize);
            }
        }, 200);
    });

    setMode('pgn');
});
