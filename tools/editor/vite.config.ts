import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  publicDir: path.resolve(__dirname, '../../assets'),
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@game': path.resolve(__dirname, '../../src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
