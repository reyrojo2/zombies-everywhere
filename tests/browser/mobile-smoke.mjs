import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const project = new URL('../../', import.meta.url);
const mimeTypes = {
  html: 'text/html', js: 'text/javascript', css: 'text/css', mp3: 'audio/mpeg'
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = new URL(pathname.slice(1) || 'index.html', project);
    if (!file.href.startsWith(project.href)) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(fileURLToPath(file));
    const mime = mimeTypes[pathname.split('.').at(-1)] || (pathname === '/' ? 'text/html' : 'application/octet-stream');
    response.writeHead(200, { 'Content-Type': mime }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

let browser;
const pageErrors = [];
const renderingErrors = [];
try {
  browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-PE' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().startsWith('[init]')) {
      console.log('[browser]', msg.text().slice(0, 1200));
    }
    if (msg.type() === 'error' && /THREE\.|WebGL|GL_INVALID|shader/i.test(msg.text())) {
      renderingErrors.push(msg.text());
    }
  });

  // Exercise the WebGL2 fallback and expose checkpoints only in the test response.
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.route('**/js/main.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const anchor = "markInit('ui');";
    assert.ok(source.includes(anchor));
    await route.fulfill({
      response,
      body: source.replace(anchor, `${anchor}\nwindow.__outbreakSmoke = { outbreak, renderer };`)
    });
  });

  const wait = (fn, arg, timeout = 45_000) => page.waitForFunction(fn, arg, { timeout });
  const objective = key => wait(key => window.__outbreakSmoke.outbreak.mission.objective === key, key);
  const phase = key => wait(key => window.__outbreakSmoke.outbreak.mission.phase === key, key);
  const touch = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const hold = async (selector, until) => {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible' });
    const box = await element.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + (selector === '#touch-stick' ? 6 : box.height / 2);
    await touch('touchStart', [{ x, y }]);
    try { await until(); } finally { await touch('touchEnd'); }
  };
  const teleport = key => page.evaluate(key => {
    const game = window.__outbreakSmoke.outbreak;
    const p = key === 'shelter' ? game.config.shelters[0] : game.config[key];
    game.controller.teleportActiveTo(p.x, p.z);
  }, key);

  const capture = async (name) => {
    const shot = await page.screenshot({ type: 'jpeg', quality: 52, scale: 'css', timeout: 20000 });
    const data = shot.toString('base64');
    for (let start = 0; start < data.length; start += 3500) {
      console.log(`ZE_FRAME ${name} ${start} ${data.slice(start, start + 3500)}`);
    }
  };

  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#outbreak').waitFor({ state: 'visible', timeout: 120_000 });
  assert.deepEqual(await page.evaluate(() => ({
    webgl: window.__outbreakSmoke.renderer.backend.isWebGLBackend,
    coarse: matchMedia('(any-pointer: coarse)').matches,
    quality: document.querySelector('.ze-quality').value
  })), { webgl: true, coarse: true, quality: 'low' });
  console.log('Mobile WebGL2 menu ready at low quality');

  await page.locator('.ze-primary').tap();
  await phase('intro');
  await page.waitForTimeout(600);
  await capture('intro');
  await page.locator('.ze-skip').tap();
  await phase('errand');
  await hold('#touch-stick', () => wait(() => window.__outbreakSmoke.outbreak.controller.keys.forward > 0));
  await wait(() => !window.__outbreakSmoke.outbreak.controller.keys.forward);
  console.log('Touch joystick sends and releases movement');

  await page.evaluate(() => { window.__outbreakSmoke.outbreak.mission.streetTime = 5; });
  await phase('phone');
  await page.waitForTimeout(600);
  await capture('phone');
  await page.getByRole('button', { name: 'Contestar', exact: true }).tap();
  await wait(() => window.__outbreakSmoke.outbreak.mission.phoneAnswered);
  console.log('Touch answers the call');

  await page.evaluate(() => { window.__outbreakSmoke.outbreak.mission.streetTime = 42; });
  await phase('escape');
  await teleport('pharmacy');
  await page.waitForTimeout(600);
  await capture('pharmacy');
  await hold('.ze-touch-context', () => objective('radio'));
  await teleport('radio');
  await page.evaluate(() => {
    const { mission } = window.__outbreakSmoke.outbreak;
    mission.time = mission.config.radioArrivalSeconds;
  });
  await hold('.ze-touch-context', () => objective('relay'));
  await teleport('relay');
  await page.waitForTimeout(600);
  await capture('relay');
  await hold('.ze-touch-context', () => objective('shelter'));
  await teleport('shelter');
  await phase('won');
  await page.waitForTimeout(600);
  await capture('ending');
  await page.getByRole('button', { name: 'Volver a intentarlo' }).waitFor();
  console.log('Touch collects supplies, uses the radio and reads the notice; shelter completes the chapter');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(renderingErrors, []);
} finally {
  await browser?.close();
  server.close();
}
