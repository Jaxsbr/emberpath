// #214 P4 — GATE-2 capture for the perceived-wait loader.
// Boots the Briar→Heart-Bridge transition scenario, THROTTLES the network so the
// destination (heart-bridge) assets stream slowly, then walks Pip east through the
// exit. The transition loader shows with the kindling PROGRESS fill climbing + the
// rotating world-WHISPERS — the visual GATE-2 must approve. Records webm; the caller
// transcodes to mp4.
//
//   NODE_PATH=/workspace/agent/node_modules REUSE_SERVER=1 node autonomy/capture-loader-phase4.cjs
const { chromium } = require('playwright');
const REPO = '/workspace/extra/emberpath-loading';
const OUT_DIR = REPO + '/autonomy/captures';
const PORT = Number(process.env.CAP_PORT || 4173);
const THROTTLE_KBPS = Number(process.env.THROTTLE_KBPS || 40);
const SETTLE_MS = Number(process.env.SETTLE_MS || 600);
const WALK_MS = Number(process.env.WALK_MS || 8000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
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
  await p.goto(`http://127.0.0.1:${PORT}/?scenario=loader-perceived-wait`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await sleep(SETTLE_MS);

  // Throttle the destination fetch so the loader lingers long enough to review.
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (THROTTLE_KBPS * 1024) / 8 * 8, // bytes/s
    uploadThroughput: (THROTTLE_KBPS * 1024) / 8,
    latency: 80,
  });
  console.log(`throttled to ~${THROTTLE_KBPS} KB/s`);

  // Did the transition loader actually appear during the walk?
  let sawLoader = false;
  const poll = setInterval(async () => {
    try {
      const present = await p.evaluate(() => !!document.getElementById('transition-loader'));
      if (present) sawLoader = true;
    } catch { /* mid-navigation */ }
  }, 120);

  await p.locator('canvas').click({ position: { x: 400, y: 300 } }); // focus
  await p.keyboard.down('d'); // hold east, straight through the exit
  await sleep(WALK_MS);
  await p.keyboard.up('d');

  clearInterval(poll);
  await ctx.close(); // finalizes the webm
  const videoPath = await p.video().path().catch(() => null);
  await b.close();
  console.log('VIDEO_WEBM=' + (videoPath || '(none)'));
  console.log('SAW_LOADER=' + sawLoader);
  process.exit(sawLoader ? 0 : 3);
})().catch((e) => { console.error(e); process.exit(1); });
