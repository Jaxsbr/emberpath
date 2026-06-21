import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Pages-boundary guard (#182, Jaco's HARD CONSTRAINT: the editor must NEVER be
// published to GitHub Pages). The published game is the root `npm run build`
// output (deploy-pages.yml uploads root `dist/`). The standalone authoring editor
// lives in `tools/editor/` as its own Vite app and reuses game code one-directionally
// through the `@game/*` alias (tools/editor → src). The boundary holds only as long
// as that arrow never reverses: nothing under the game's `src/` may import anything
// from `tools/editor/`. If it did, the editor app would be pulled into the game's
// bundle and shipped to Pages. This test fails loudly if that ever happens.

const SRC = path.resolve(__dirname, '../src');

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectTsFiles(full)));
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

describe('Pages boundary (#182)', () => {
  it('no file under src/ imports from tools/editor', async () => {
    const files = await collectTsFiles(SRC);
    const offenders: string[] = [];
    // Matches both forms an editor import could take from inside src/:
    //   import ... from '.../tools/editor/...'
    //   import ... from '@editor/...' (should a future alias be added)
    const editorImport = /from\s+['"][^'"]*tools\/editor[^'"]*['"]/;
    for (const f of files) {
      const text = await fs.readFile(f, 'utf8');
      if (editorImport.test(text)) offenders.push(path.relative(SRC, f));
    }
    expect(offenders, `game src must not import the editor app: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
