// U3 verification harness: boot the REAL vite dev server + the U2 collision
// editor headless, click Save with ZERO edits, and let the dev plugin write the
// true seeded blocked set to staged/collision/<areaId>.json. Running the porter
// against that file must report an EMPTY diff — proof its "current" computation
// matches the live game's editor seed exactly (no off-by-one). Arg: areaId.
//
// Needs playwright (not a game-repo dep) — run with the agent's modules on path:
//   NODE_PATH=/workspace/agent/node_modules node autonomy/capture-collision-baseline.cjs <id>
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const REPO = '/workspace/extra/emberpath';
const areaId = process.argv[2] || 'ashen-isle';
const PORT = 5179;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
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
  await p.goto(`http://localhost:${PORT}/?editor=collision&area=${areaId}`, { waitUntil: 'networkidle', timeout: 30000 });
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
