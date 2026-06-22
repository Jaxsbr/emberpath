import type { Plugin } from 'vite';
import { promises as fs } from 'fs';
import path from 'path';

// Dev-only middleware (Editor P3 / #187 U3): receives the Triggers editor tab's
// POST and writes the area's authored triggers to
// `src/data/areas/triggers/<areaId>.json` — the COMMITTED sidecar the registry
// spreads onto the area (Decision A-a). Unlike the object-shape plugin this
// replaces the WHOLE array for the area (the tab always sends the area's full
// authored set), but it only ever touches THAT area's file, never another's.
//
// The endpoint exists ONLY in `vite dev` (apply:'serve'); a prod build has no
// save route. areaId is sanitised to a kebab slug so a crafted value can't escape
// the triggers directory, and every trigger is validated server-side before any
// write — a malformed payload writes nothing.

const ENDPOINT = '/__trigger/save';
const DIR = 'src/data/areas/triggers';

const TRIGGER_TYPES = ['dialogue', 'story', 'thought', 'exit'];

export interface TriggerSavePayload {
  areaId: string;
  triggers: unknown[];
}

export function sanitizeAreaId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return id;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isValidTrigger(t: unknown): boolean {
  if (typeof t !== 'object' || t === null) return false;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(o.id)) return false;
  if (!isFiniteNum(o.col) || !isFiniteNum(o.row) || !isFiniteNum(o.width) || !isFiniteNum(o.height)) return false;
  if (o.width < 1 || o.height < 1) return false;
  if (typeof o.type !== 'string' || !TRIGGER_TYPES.includes(o.type)) return false;
  if (typeof o.actionRef !== 'string') return false;
  if (typeof o.repeatable !== 'boolean') return false;
  if (o.condition !== undefined && typeof o.condition !== 'string') return false;
  if (o.setFlags !== undefined && (typeof o.setFlags !== 'object' || o.setFlags === null || Array.isArray(o.setFlags)))
    return false;
  if (o.incrementFlags !== undefined && (!Array.isArray(o.incrementFlags) || !o.incrementFlags.every((s) => typeof s === 'string')))
    return false;
  return true;
}

export function validateTriggerSave(body: unknown): { ok: true; payload: TriggerSavePayload } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  const areaId = sanitizeAreaId(b.areaId);
  if (!areaId) return { ok: false, error: 'invalid areaId' };
  if (!Array.isArray(b.triggers)) return { ok: false, error: 'triggers must be an array' };
  const seen = new Set<string>();
  for (const t of b.triggers) {
    if (!isValidTrigger(t)) return { ok: false, error: 'invalid trigger in payload' };
    const id = (t as { id: string }).id;
    if (seen.has(id)) return { ok: false, error: `duplicate trigger id "${id}"` };
    seen.add(id);
  }
  return { ok: true, payload: { areaId, triggers: b.triggers } };
}

export function triggerSavePlugin(rootDir?: string): Plugin {
  return {
    name: 'emberpath-trigger-save',
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
            const result = validateTriggerSave(body);
            if (!result.ok) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: result.error }));
              return;
            }
            const { areaId, triggers } = result.payload;
            const file = path.resolve(root, DIR, `${areaId}.json`);
            try {
              if (triggers.length === 0) {
                // No authored triggers left → remove the sidecar so the area is
                // byte-identical to its inline-only state (zero-regression).
                await fs.rm(file, { force: true });
              } else {
                await fs.mkdir(path.dirname(file), { recursive: true });
                await fs.writeFile(file, JSON.stringify(triggers, null, 2) + '\n', 'utf8');
              }
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({ ok: true, path: path.relative(root, file), areaId, count: triggers.length }),
            );
          })();
        });
      });
    },
  };
}
