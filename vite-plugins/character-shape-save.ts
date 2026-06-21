import type { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';

// Dev-only middleware (#FB-23 shadows): receives the character shadow editor's
// POST and MERGES the authored per-character shadow into
// `src/data/character-shapes.json` — committed game data read by GameScene via
// getCharacterShadow() for Pip + every NPC sprite kind. Collision for characters
// is intentionally NOT authored here (it stays the invisible AABB body box); this
// endpoint writes shadows only. Other kinds' entries and the `_doc` note are
// preserved; only this kind's `shadow` is replaced (or dropped when null).
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

interface SavePayload {
  kind: string;
  shadow: ShadowPayload | null;
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

function isValidPayload(body: unknown): body is SavePayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!sanitizeKind(b.kind)) return false;
  if (b.shadow === undefined) return false;
  if (b.shadow !== null && !isValidShadow(b.shadow)) return false;
  return true;
}

export function characterShapeSavePlugin(): Plugin {
  return {
    name: 'emberpath-character-shape-save',
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
              if (body.shadow === null) {
                delete existing.shadow;
              } else {
                existing.shadow = body.shadow;
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
            const rel = path.relative(server.config.root, file);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel, kind, shadow: body.shadow !== null }));
          })();
        });
      });
    },
  };
}
