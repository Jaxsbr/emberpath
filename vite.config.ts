import { defineConfig } from 'vite';
import { collisionSavePlugin } from './vite-plugins/collision-save';
import { objectShapeSavePlugin } from './vite-plugins/object-shape-save';
import { characterShapeSavePlugin } from './vite-plugins/character-shape-save';

export default defineConfig({
  base: './',
  publicDir: 'assets',
  // Dev-only save endpoints (no-op in `vite build`, apply:'serve'):
  // - collisionSavePlugin (#119, U2): writes staged/collision/<areaId>.json.
  // - objectShapeSavePlugin (FB-23): merges per-kind collision + shadow into the
  //   committed src/data/object-shapes.json.
  // - characterShapeSavePlugin (FB-23 shadows): merges per-character shadow into
  //   the committed src/data/character-shapes.json.
  plugins: [collisionSavePlugin(), objectShapeSavePlugin(), characterShapeSavePlugin()],
  build: {
    outDir: 'dist',
  },
});
