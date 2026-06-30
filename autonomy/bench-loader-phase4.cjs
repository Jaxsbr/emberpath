// #214 P4 — perceived-wait benchmark. Under an IDENTICAL throttle + identical
// destination (heart-bridge), measure how long the transition loader is on screen:
//   - in-range approach (briar-to-bridge-transition, boots col 40, inside prefetch
//     range)  → idle prefetch warms heart-bridge, transition should show NO loader.
//   - out-of-range approach (loader-perceived-wait, boots col 34)  → prefetch fires
//     too late under throttle, loader shows for its full fetch.
// The delta is the prefetch win: the warm path's loader-visible time should be ~0.
const { chromium } = require('playwright');
const PORT = Number(process.env.CAP_PORT || 4173);
const THROTTLE_KBPS = Number(process.env.THROTTLE_KBPS || 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(scenario) {
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--proxy-bypass-list=*', '--no-proxy-server'],
  });
  const ctx = await b.newContext({ viewport: { width: 800, height: 600 } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PORT}/?scenario=${scenario}`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForSelector('canvas', { timeout: 20000 });
  await sleep(600);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, downloadThroughput: THROTTLE_KBPS * 1024, uploadThroughput: THROTTLE_KBPS * 1024, latency: 80,
  });
  let firstSeen = null, lastSeen = null;
  const t0 = Date.now();
  const poll = setInterval(async () => {
    try {
      const present = await p.evaluate(() => !!document.getElementById('transition-loader'));
      if (present) { const now = Date.now(); if (firstSeen === null) firstSeen = now; lastSeen = now; }
    } catch { /* nav */ }
  }, 60);
  await p.locator('canvas').click({ position: { x: 400, y: 300 } });
  await p.keyboard.down('d');
  await sleep(14000);
  await p.keyboard.up('d');
  clearInterval(poll);
  await ctx.close(); await b.close();
  const visibleMs = firstSeen === null ? 0 : (lastSeen - firstSeen + 60);
  return visibleMs;
}

(async () => {
  const warm = await measure('briar-to-bridge-transition'); // in prefetch range at spawn
  const cold = await measure('loader-perceived-wait');       // out of range at spawn
  console.log(JSON.stringify({ throttleKBps: THROTTLE_KBPS, warmApproachLoaderMs: warm, coldApproachLoaderMs: cold }));
})().catch((e) => { console.error(e); process.exit(1); });
