import { defineConfig } from 'vite';
import { collisionSavePlugin } from './vite-plugins/collision-save';
import { objectShapeSavePlugin } from './vite-plugins/object-shape-save';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  // Dev-only save endpoints (no-op in `vite build`, apply:'serve'):
  // - collisionSavePlugin (#119, U2): writes staged/collision/<areaId>.json.
  // - objectShapeSavePlugin (FB-23, U3): merges per-kind collision into the
  //   committed src/data/object-shapes.json.
  plugins: [collisionSavePlugin(), objectShapeSavePlugin()],
  build: {
    outDir: 'dist',
  },
});
