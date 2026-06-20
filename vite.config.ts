import { defineConfig } from 'vite';
import { collisionSavePlugin } from './vite-plugins/collision-save';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  // Collision paint editor save endpoint (#119, U2) — dev-only middleware that
  // writes staged/collision/<areaId>.json. No-op in `vite build` (apply:'serve').
  plugins: [collisionSavePlugin()],
  build: {
    outDir: 'dist',
  },
});
