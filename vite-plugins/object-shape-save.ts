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

interface ShadowPayload {
  shape: 'ellipse' | 'rect';
  w: number;
  h: number;
  dx: number;
  dy: number;
  alpha: number;
}

interface SavePayload {
  kind: string;
  // At least one of these is present. `collision` comes from the sub-cell paint
  // editor; `shadow` from the shadow shape editor (#FB-23). A save may carry only
  // one (the shadow editor never touches collision and vice-versa). `null` for a
  // field means "clear it".
  collision?: [number, number][];
  shadow?: ShadowPayload | null;
}

function sanitizeKind(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  // ObjectKindId is a kebab-case slug union (src/maps/objects.ts).
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return id;
}

function isValidShadow(s: unknown): s is ShadowPayload {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  if (o.shape !== 'ellipse' && o.shape !== 'rect') return false;
  return ['w', 'h', 'dx', 'dy', 'alpha'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function isValidPayload(body: unknown): body is SavePayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!sanitizeKind(b.kind)) return false;
  const hasCollision = b.collision !== undefined;
  const hasShadow = b.shadow !== undefined;
  if (!hasCollision && !hasShadow) return false;
  if (hasCollision) {
    if (!Array.isArray(b.collision)) return false;
    if (
      !b.collision.every(
        (c) => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'number',
      )
    )
      return false;
  }
  if (hasShadow && b.shadow !== null && !isValidShadow(b.shadow)) return false;
  return true;
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
              // collision and shadow are edited independently — only touch the
              // field this save carries, so saving a shadow never wipes collision.
              if (body.collision !== undefined) {
                if (body.collision.length > 0) {
                  existing.collision = body.collision;
                } else {
                  // Empty paint = "no authored collision" → drop the key so the
                  // kind falls back to its legacy footprint instead of blocking nothing.
                  delete existing.collision;
                }
              }
              if (body.shadow !== undefined) {
                if (body.shadow === null) {
                  delete existing.shadow;
                } else {
                  existing.shadow = body.shadow;
                }
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
            res.end(
              JSON.stringify({
                ok: true,
                path: rel,
                kind,
                cells: body.collision?.length,
                shadow: body.shadow === undefined ? undefined : body.shadow !== null,
              }),
            );
          })();
        });
      });
    },
  };
}
