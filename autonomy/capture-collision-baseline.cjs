// Verification harness: boot the standalone EDITOR app headless, open the Map
// collision tab, select the area, and click Save with ZERO edits so the dev
// plugin writes the true seeded blocked set to staged/collision/<areaId>.json.
// Running the porter against that file must report an EMPTY diff — proof its
// "current" computation matches the live editor seed exactly (no off-by-one).
// Arg: areaId. (#184 ported the paint tool out of the in-game `?editor=collision`
// boot into the editor app's Map collision tab — this harness follows it.)
//
// Needs playwright (not a game-repo dep) — run with the agent's modules on path:
//   NODE_PATH=/workspace/agent/node_modules node autonomy/capture-collision-baseline.cjs <id>
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const EDITOR = '/workspace/extra/emberpath/tools/editor';
const areaId = process.argv[2] || 'ashen-isle';
const PORT = 5179;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: EDITOR, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  dev.stdout.on('data', (d) => { if (/Local:.*localhost/.test(d.toString())) ready = true; });
  dev.stderr.on('data', (d) => process.stderr.write('[vite] ' + d));
  for (let i = 0; i < 60 && !ready; i++) await sleep(500);
  if (!ready) { dev.kill('SIGKILL'); throw new Error('vite dev did not become ready'); }
  await sleep(1000);

  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--proxy-bypass-list=*', '--no-proxy-server'],
  });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 30000 });
  // Open the Map collision tab, then pick the area from its embedded HUD select.
  await p.locator('.tab[data-view="mapcollision"]').click();
  await p.waitForSelector('#map-collision-hud select', { timeout: 20000 });
  await p.selectOption('#map-collision-hud select', areaId);
  // Selecting an area remounts the tab — wait for the fresh Save button + seed.
  await p.waitForSelector('#collision-save', { timeout: 20000 });
  await sleep(1500);
  const count = await p.locator('#collision-count').textContent();
  await p.locator('#collision-save').click();
  await p.waitForFunction(() => {
    const s = document.querySelector('#collision-status');
    return s && /Saved|failed|error/i.test(s.textContent || '');
  }, { timeout: 15000 });
  const status = await p.locator('#collision-status').textContent();
  console.log(`editor seed: ${count} | save: ${status}`);
  await ctx.close(); await b.close(); dev.kill('SIGKILL');
  console.log('BASELINE_CAPTURED');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
