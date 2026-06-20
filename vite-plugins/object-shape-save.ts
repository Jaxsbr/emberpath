import type { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';

// Dev-only middleware (FB-23 U3): receives the object-shape editor's POST and
// MERGES the authored per-kind collision into `src/data/object-shapes.json` —
// the COMMITTED single source of truth (unlike the per-area collision editor,
// which writes a gitignored `staged/` file). object-shapes.json IS real game
// data: GameScene.buildObjectCollisionMap reads `collisionCells` from it wherever
// the kind is placed, so authoring writes straight into it. Existing entries for
// OTHER kinds, the `_doc` note, and this kind's `shadow` block (U5) are preserved
// — only this kind's `collision` array is replaced.
//
// The endpoint exists ONLY in `vite dev` (configureServer middleware); a prod
// build has no save route. The kind id is sanitised to a kebab slug before use so
// a crafted key can't escape into the file.

const ENDPOINT = '/__object-shape/save';
const TARGET = 'src/data/object-shapes.json';

interface SavePayload {
  kind: string;
  collision: [number, number][];
}

function sanitizeKind(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  // ObjectKindId is a kebab-case slug union (src/maps/objects.ts).
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return id;
}

function isValidPayload(body: unknown): body is SavePayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!sanitizeKind(b.kind)) return false;
  if (!Array.isArray(b.collision)) return false;
  return b.collision.every(
    (c) => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number',
  );
}

export function objectShapeSavePlugin(): Plugin {
  return {
    name: 'emberpath-object-shape-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
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
            const kind = sanitizeKind(body.kind)!;
            const file = path.resolve(server.config.root, TARGET);
            try {
              // Read-merge-write so other kinds + the _doc note + this kind's
              // shadow block survive. Missing file → start from an empty object.
              let current: Record<string, unknown> = {};
              try {
                current = JSON.parse(await fs.readFile(file, 'utf8'));
              } catch {
                current = {};
              }
              const existing =
                typeof current[kind] === 'object' && current[kind] !== null
                  ? (current[kind] as Record<string, unknown>)
                  : {};
              if (body.collision.length > 0) {
                existing.collision = body.collision;
              } else {
                // Empty paint = "no authored collision" → drop the key so the
                // kind falls back to its legacy footprint instead of blocking nothing.
                delete existing.collision;
              }
              // If the entry is now empty (no collision, no shadow), drop it.
              if (Object.keys(existing).length === 0) {
                delete current[kind];
              } else {
                current[kind] = existing;
              }
              await fs.writeFile(file, JSON.stringify(current, null, 2) + '\n', 'utf8');
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
              return;
            }
            const rel = path.relative(server.config.root, file);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel, kind, cells: body.collision.length }));
          })();
        });
      });
    },
  };
}
