// #184 proof capture. Two artifacts:
//   1) MP4 of the editor app's NEW Map collision tab: load → seeded red grid →
//      a paint stroke (the ported area-collision tool working).
//   2) Screenshot proving the GAME booted with `?editor=collision&area=ashen-isle`
//      lands on the normal Title with NO editor HUD (the in-game dispatch is gone).
//
// Run: NODE_PATH=/workspace/agent/node_modules node autonomy/capture-184-proof.cjs
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = '/workspace/extra/emberpath';
const EDITOR = path.join(REPO, 'tools/editor');
const OUT = path.join(REPO, 'autonomy', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startVite(cwd, port) {
  const dev = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let done = false;
    dev.stdout.on('data', (d) => { if (!done && /Local:.*localhost/.test(d.toString())) { done = true; resolve(); } });
    dev.stderr.on('data', (d) => process.stderr.write(`[vite:${port}] ` + d));
    setTimeout(() => { if (!done) reject(new Error(`vite ${port} not ready`)); }, 30000);
  });
  return { dev, ready };
}

const launchArgs = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--proxy-bypass-list=*', '--no-proxy-server'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ---- 1) Editor Map collision tab (record video) -------------------------
  const ed = startVite(EDITOR, 5191);
  await ed.ready; await sleep(1000);
  const b1 = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: launchArgs });
  const ctx1 = await b1.newContext({
    viewport: { width: 1000, height: 700 },
    recordVideo: { dir: OUT, size: { width: 1000, height: 700 } },
  });
  const p1 = await ctx1.newPage();
  p1.on('pageerror', (e) => console.log('[editor pageerror]', e.message));
  await p1.goto('http://localhost:5191/', { waitUntil: 'networkidle', timeout: 30000 });
  await p1.locator('.tab[data-view="mapcollision"]').click();
  await p1.waitForSelector('#collision-save', { timeout: 20000 });
  await sleep(1500);
  const seeded = await p1.locator('#collision-count').textContent();
  await p1.screenshot({ path: path.join(OUT, 'mapcollision-seeded.png') });
  // Paint a short stroke across the grid centre to show toggling works.
  // For Phaser tabs the side panels are hidden and the scene canvas is full-bleed
  // in the view container, so fixed viewport coords near centre land on the grid.
  const cx = 520, cy = 380;
  await p1.mouse.move(cx - 80, cy); await p1.mouse.down();
  for (let i = -80; i <= 80; i += 8) { await p1.mouse.move(cx + i, cy); await sleep(30); }
  await p1.mouse.up(); await sleep(400);
  const after = await p1.locator('#collision-count').textContent();
  await p1.screenshot({ path: path.join(OUT, 'mapcollision-painted.png') });
  await sleep(600);
  const vid = await p1.video().path();
  await ctx1.close(); await b1.close(); ed.dev.kill('SIGKILL');
  // Transcode webm → mp4 (inline-playable on Telegram).
  const mp4 = path.join(OUT, 'mapcollision-tab.mp4');
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-y', '-i', vid, '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', mp4], { stdio: 'ignore' });
    ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
  console.log(`map-collision tab: seeded=${seeded} afterPaint=${after} mp4=${mp4}`);

  // ---- 2) Game booted with ?editor=collision → Title, no editor HUD --------
  const gm = startVite(REPO, 5192);
  await gm.ready; await sleep(1000);
  const b2 = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: launchArgs });
  const ctx2 = await b2.newContext({ viewport: { width: 960, height: 720 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => console.log('[game pageerror]', e.message));
  await p2.goto('http://localhost:5192/?editor=collision&area=ashen-isle', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2500);
  const hasEditorHud = await p2.evaluate(() =>
    !!(document.querySelector('#map-collision-hud') || document.querySelector('#collision-save')));
  await p2.screenshot({ path: path.join(OUT, 'game-editor-param-lands-on-title.png') });
  await ctx2.close(); await b2.close(); gm.dev.kill('SIGKILL');
  console.log(`game ?editor=collision → editor HUD present: ${hasEditorHud} (expect false)`);

  console.log('PROOF_CAPTURED');
  process.exit(hasEditorHud ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
