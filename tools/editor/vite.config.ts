import { defineConfig } from 'vite';
import path from 'path';
import { collisionSavePlugin } from '../../vite-plugins/collision-save';
import { objectShapeSavePlugin } from '../../vite-plugins/object-shape-save';
import { characterShapeSavePlugin } from '../../vite-plugins/character-shape-save';

// The standalone editor app (#182) is the single home for ALL authoring tools.
// It is run LOCALLY ONLY and must NEVER be published — it has its own dist/ and
// is excluded from the Pages deploy (deploy-pages.yml builds the game root only).
//
// The dev save endpoints (apply:'serve', so they vanish from any build) are the
// game's own plugins, reused here with `gameRoot` so they write back into the
// game repo's src/data — not under tools/editor.
const gameRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  base: './',
  publicDir: path.resolve(gameRoot, 'assets'),
  plugins: [
    collisionSavePlugin(gameRoot),
    objectShapeSavePlugin(gameRoot),
    characterShapeSavePlugin(gameRoot),
  ],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@game': path.resolve(gameRoot, 'src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
