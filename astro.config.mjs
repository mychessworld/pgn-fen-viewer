import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://www.chessberry.ru',
    outDir: './dist',
    publicDir: './public',
    build: {
        format: 'file'
    }
});
