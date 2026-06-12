const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'node_modules', 'stockfish', 'bin');
const destDir = path.join(root, 'public', 'vendor', 'stockfish');

const files = [
    ['stockfish-18-lite-single.js', 'stockfish.js'],
    ['stockfish-18-lite-single.wasm', 'stockfish.wasm']
];

if (!fs.existsSync(srcDir)) {
    console.warn('stockfish package not found, skip copy');
    process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

for (const [from, to] of files) {
    fs.copyFileSync(path.join(srcDir, from), path.join(destDir, to));
}

console.log('Stockfish copied to public/vendor/stockfish/');
