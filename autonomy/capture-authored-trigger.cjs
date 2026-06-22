// Editor P3 / #187 U7 — end-to-end proof capture for the Triggers authoring tool.
// Boots the REAL game at `?scenario=authored-trigger-demo`, walks Pip east (D)
// one tile into the EDITOR-AUTHORED trigger zone (sidecar
// src/data/areas/triggers/ashen-isle.json, merged onto Ashen Isle by the registry),
// and records the authored `thought` firing — form → sidecar → registry → runtime
// with no hand-edited TypeScript. Adaptive: pulses D and watches localStorage for
// the runtime's `_trigger_fired_ashen-isle-authored-demo` bookkeeping flag, so it
// stops the instant the authored trigger fires (before reaching the inline
// start-thought one tile further east).
//
//   NODE_PATH=/workspace/agent/node_modules node autonomy/capture-authored-trigger.cjs
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const REPO = '/workspace/extra/emberpath';
const OUT_DIR = REPO + '/autonomy/captures';
const PORT = Number(process.env.CAP_PORT || 5183);
const FIRED_KEY = '_trigger_fired_ashen-isle-authored-demo';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REUSE = process.env.REUSE_SERVER === '1';

(async () => {
  let dev = null;
  if (!REUSE) {
    dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      cwd: REPO, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    dev.stdout.on('data', (d) => { if (/Local:.*localhost/.test(d.toString())) ready = true; });
    dev.stderr.on('data', (d) => process.stderr.write('[vite] ' + d));
    for (let i = 0; i < 60 && !ready; i++) await sleep(500);
    if (!ready) { dev.kill('SIGKILL'); throw new Error('vite dev did not become ready'); }
    await sleep(1000);
  }
  const killDev = () => { if (dev) dev.kill('SIGKILL'); };

  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--proxy-bypass-list=*', '--no-proxy-server'],
  });
  const ctx = await b.newContext({
    viewport: { width: 800, height: 600 },
    recordVideo: { dir: OUT_DIR, size: { width: 800, height: 600 } },
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:${PORT}/?scenario=authored-trigger-demo`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await sleep(2500); // let the scene settle + Pip spawn

  const firedNow = () => p.evaluate((k) => {
    for (let i = 0; i < localStorage.length; i++) {
      const raw = localStorage.getItem(localStorage.key(i));
      if (raw && raw.includes(k)) {
        try { if (JSON.parse(raw)[k]) return true; } catch { /* not our blob */ }
      }
    }
    return false;
  }, FIRED_KEY);

  console.log('fired (baseline):', await firedNow());

  // Walk east in short pulses; stop the instant the authored trigger fires.
  await p.locator('canvas').click({ position: { x: 400, y: 300 } }); // focus the canvas
  let fired = false;
  for (let step = 0; step < 16 && !fired; step++) {
    await p.keyboard.down('d');
    await sleep(90);
    await p.keyboard.up('d');
    await sleep(60);
    fired = await firedNow();
  }
  console.log('fired (after walk):', fired);

  // Hold the frame so the 4s thought bubble is fully visible in the clip.
  await sleep(4200);

  await ctx.close(); // finalizes the .webm
  const videoPath = await p.video().path().catch(() => null);
  await b.close(); killDev();
  console.log('VIDEO_WEBM=' + (videoPath || '(none)'));
  console.log(fired ? 'TRIGGER_FIRED_OK' : 'TRIGGER_DID_NOT_FIRE');
  process.exit(fired ? 0 : 2);
})().catch((e) => { console.error(e); process.exit(1); });
