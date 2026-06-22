import type { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';

// Dev-only middleware (#FB-23 shadows, extended #185): receives the character
// shadow / collision editor's POST and MERGES the authored per-character shape
// into `src/data/character-shapes.json` — committed game data read by GameScene
// via getCharacterShadow() / getCharacterCollision() for Pip + every NPC sprite
// kind. As of #185 characters CAN author a collision body here (a centre-
// referenced rect, the moving-AABB analogue of the object sub-cell paint);
// `shadow` and `collision` are edited independently, mirroring object-shape-save.
// A save carries only the field its editor touches, so saving a shadow never
// wipes collision and vice-versa. Other kinds' entries and the `_doc` note are
// preserved; `null` for a field clears it.
//
// The route exists ONLY in `vite dev`. The kind id is sanitised to a kebab slug.

const ENDPOINT = '/__character-shape/save';
const TARGET = 'src/data/character-shapes.json';

interface ShadowPayload {
  shape: 'ellipse' | 'rect';
  w: number;
  h: number;
  dx: number;
  dy: number;
  alpha: number;
}

// Character collision body (#185): a centre-referenced rect in world px.
interface CollisionPayload {
  w: number;
  h: number;
  dx: number;
  dy: number;
}

interface SavePayload {
  kind: string;
  // At least one of these is present. A save carries only the field its editor
  // touches (the shadow editor never sends collision and vice-versa). `null`
  // means "clear this field".
  shadow?: ShadowPayload | null;
  collision?: CollisionPayload | null;
}

function sanitizeKind(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  // Character kinds are 'pip' or kebab NPC sprite ids (src/maps/characters.ts).
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return id;
}

function isValidShadow(s: unknown): s is ShadowPayload {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  if (o.shape !== 'ellipse' && o.shape !== 'rect') return false;
  return ['w', 'h', 'dx', 'dy', 'alpha'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function isValidCollision(c: unknown): c is CollisionPayload {
  if (typeof c !== 'object' || c === null) return false;
  const o = c as Record<string, unknown>;
  return ['w', 'h', 'dx', 'dy'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function isValidPayload(body: unknown): body is SavePayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!sanitizeKind(b.kind)) return false;
  const hasShadow = b.shadow !== undefined;
  const hasCollision = b.collision !== undefined;
  if (!hasShadow && !hasCollision) return false;
  if (hasShadow && b.shadow !== null && !isValidShadow(b.shadow)) return false;
  if (hasCollision && b.collision !== null && !isValidCollision(b.collision)) return false;
  return true;
}

// `rootDir` overrides where TARGET is resolved (see objectShapeSavePlugin) — the
// standalone editor app (#182) passes the game-repo root.
export function characterShapeSavePlugin(rootDir?: string): Plugin {
  return {
    name: 'emberpath-character-shape-save',
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
            const file = path.resolve(root, TARGET);
            try {
              // Read-merge-write so other kinds + the _doc note survive.
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
              // Merge only the field this save carries (shadow OR collision),
              // mirroring object-shape-save: editing a shadow never wipes an
              // authored collision and vice-versa. `null` clears that one field.
              if (body.shadow !== undefined) {
                if (body.shadow === null) {
                  delete existing.shadow;
                } else {
                  existing.shadow = body.shadow;
                }
              }
              if (body.collision !== undefined) {
                if (body.collision === null) {
                  delete existing.collision;
                } else {
                  existing.collision = body.collision;
                }
              }
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
            const rel = path.relative(root, file);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                path: rel,
                kind,
                shadow: body.shadow !== undefined ? body.shadow !== null : undefined,
                collision: body.collision !== undefined ? body.collision !== null : undefined,
              }),
            );
          })();
        });
      });
    },
  };
}
