import type { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';

// Dev-only middleware (#119, U2): receives the collision paint editor's POST and
// writes it to a STAGED file under `staged/collision/<areaId>.json` — never into
// game code. The staged file is the hand-off point: Jaco paints + saves here,
// then `autonomy/apply-staged-collision.cjs` (U3) ports the proven values into
// the area definition and the staged file is dropped. `staged/` is gitignored,
// so nothing the editor writes can accidentally ship.
//
// The endpoint exists ONLY in `vite dev` (this is a configureServer middleware);
// a production build has no save route, which is correct — the editor is a dev
// tool. Path traversal is blocked: areaId is sanitised to [a-z0-9-] before use.

const ENDPOINT = '/__collision/save';
const STAGED_DIR = 'staged/collision';

interface SavePayload {
  areaId: string;
  cols: number;
  rows: number;
  blocked: [number, number][];
}

function sanitizeAreaId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  // Area ids are kebab-case slugs (see data/areas/registry.ts). Reject anything
  // else so a crafted areaId can't escape the staged dir.
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return id;
}

function isValidPayload(body: unknown): body is SavePayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!sanitizeAreaId(b.areaId)) return false;
  if (typeof b.cols !== 'number' || typeof b.rows !== 'number') return false;
  if (!Array.isArray(b.blocked)) return false;
  return b.blocked.every(
    (c) => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number',
  );
}

// `rootDir` overrides where STAGED_DIR is resolved (see objectShapeSavePlugin) —
// the standalone editor app (#182) passes the game-repo root.
export function collisionSavePlugin(rootDir?: string): Plugin {
  return {
    name: 'emberpath-collision-save',
    apply: 'serve',
    configureServer(server) {
      const root = rootDir ?? server.config.root;
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
          // Guard against an unbounded body (1 MB is far more than any map).
          if (raw.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          void (async () => {
            let body: unknown;
            try {
              body = JSON.parse(raw);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'invalid JSON' }));
              return;
            }
            if (!isValidPayload(body)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'invalid payload' }));
              return;
            }
            const areaId = sanitizeAreaId(body.areaId)!;
            const dir = path.resolve(root, STAGED_DIR);
            const file = path.join(dir, `${areaId}.json`);
            const record = {
              areaId,
              cols: body.cols,
              rows: body.rows,
              blocked: body.blocked,
              savedAt: new Date().toISOString(),
            };
            try {
              await fs.mkdir(dir, { recursive: true });
              await fs.writeFile(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
              return;
            }
            const rel = path.relative(root, file);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel, cells: body.blocked.length }));
          })();
        });
      });
    },
  };
}
