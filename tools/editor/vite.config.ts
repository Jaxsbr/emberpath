import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
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
