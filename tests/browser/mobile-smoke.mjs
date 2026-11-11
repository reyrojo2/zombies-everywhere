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
  const preparePage = async (page) => {
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
        body: source.replace(anchor, `${anchor}\nwindow.__outbreakSmoke = { outbreak, renderer, scene, lightingSystem };`)
      });
    });
  };
  await preparePage(page);

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
  const teleport = (key, distance = 0) => page.evaluate(({ key, distance }) => {
    const game = window.__outbreakSmoke.outbreak;
    const p = key === 'shelter' ? game.config.shelters[0] : game.config[key];
    const heading = p.heading ?? 0;
    game.controller.teleportActiveTo(
      p.x + distance * Math.sin(heading),
      p.z + distance * Math.cos(heading),
      heading + Math.PI
    );
    const position = game.controller.getActiveEntity().position;
    game.lastSafe = { x: position.x, y: position.y, z: position.z };
    game.mission.previousPosition = { x: position.x, z: position.z };
    game.camera.resetForTeleport();
    if (key === 'shelter') return { x: position.x, z: position.z };
  }, { key, distance });

  // Enabled only in a review run. Normal CI does not emit image data.
  const capture = async (name) => {
    
    const bytes = await page.screenshot({ type: 'jpeg', quality: 84, scale: 'css', timeout: 30_000 });
    const data = bytes.toString('base64');
    for (let offset = 0; offset < data.length; offset += 3500) {
      console.log(`ZE_FRAME ${name} ${offset} ${data.slice(offset, offset + 3500)}`);
    }
  };

  const url = `http://127.0.0.1:${server.address().port}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#outbreak').waitFor({ state: 'visible', timeout: 120_000 });
  assert.deepEqual(await page.evaluate(() => ({
    webgl: window.__outbreakSmoke.renderer.backend.isWebGLBackend,
    coarse: matchMedia('(any-pointer: coarse)').matches,
    quality: document.querySelector('.ze-quality').value
  })), { webgl: true, coarse: true, quality: 'low' });
  assert.equal(await page.locator('.ze-rotate-hint').isVisible(), true);
  const portrait = page.viewportSize();
  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await page.locator('.ze-rotate-hint').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => matchMedia('(orientation: landscape)').matches), true);
  const sites = await page.evaluate(async () => {
    const { blockAt } = await import('/js/city-config.js');
    const { sitePoint } = await import('/js/outbreak/navigation.js');
    const { config } = window.__outbreakSmoke.outbreak;
    return config.shelters.map(gate => {
      const block = blockAt(gate.x, gate.z);
      const inside = p => !!block && !block.median && blockAt(p.x, p.z) === block;
      const footprint = [-2.55, 0, 2.55].flatMap(x => [-4.45, -2, .3].map(z => sitePoint(gate, x, z)));
      return { x: gate.x, z: gate.z, block: block?.id, pedestrian: footprint.every(inside) && inside(gate.approach) };
    });
  });
  assert.equal(sites.length, 2);
  assert.ok(sites.every(site => site.pedestrian), JSON.stringify(sites));
  console.log('Landscape viewport ready; shelter footprints and approaches are off the roadway', sites);

  await page.locator('.ze-primary').tap();
  await phase('intro');
  await page.locator('.ze-skip').tap();
  await phase('errand');
  const neighborhood = await page.evaluate(async () => {
    const game = window.__outbreakSmoke.outbreak;
    const { blockAt } = await import('/js/city-config.js');
    const { sitePoint } = await import('/js/outbreak/navigation.js');
    const residents = game.actors.actors;
    const pharmacy = game.config.pharmacy;
    const block = blockAt(pharmacy.x, pharmacy.z);
    return {
      count: residents.length,
      nearby: residents.filter(a => Math.hypot(a.x - game.config.spawn.x, a.z - game.config.spawn.z) < 75).length,
      budget: game.config.activeActorCount,
      streetVisible: residents.filter(a => {
        const p = game.config.spawn, dx = a.x - p.x, dz = a.z - p.z;
        return Math.hypot(dx, dz) < 75 && game.nav.clear(p, a) && Math.sin(p.heading) * dx + Math.cos(p.heading) * dz > 0;
      }).length,
      sidewalk: residents.every(a => !!blockAt(a.home.x, a.home.z)),
      props: !!window.__outbreakSmoke.scene.getObjectByName('NeighborhoodStreetProps'),
      schoolVan: !!game.config.schoolVan,
      deliveryVan: !!game.config.deliveryVan,
      pharmacy: blockAt(pharmacy.approach.x, pharmacy.approach.z) === block && [-3, 0, 3].every(x => [-1.85, .3].every(z => {
        const p = sitePoint(pharmacy, x, z);
        return blockAt(p.x, p.z) === block;
      })),
      reachable: game.escapeRoutes.every(route => route.nav.cost[route.nav.index(game.config.spawn)] >= 0)
    };
  });
  assert.equal(neighborhood.count, 160);
  assert.ok(neighborhood.nearby >= 35, JSON.stringify(neighborhood));
  assert.equal(neighborhood.budget, 40);
  assert.ok(neighborhood.streetVisible >= 8, JSON.stringify(neighborhood));
  assert.ok(neighborhood.sidewalk && neighborhood.props && neighborhood.pharmacy && neighborhood.reachable && neighborhood.schoolVan && neighborhood.deliveryVan, JSON.stringify(neighborhood));
  console.log('Populated sidewalks, school van, deliveries, reachable exits and a sidewalk pharmacy verified', neighborhood);
  await wait(() => window.__outbreakSmoke.scene.getObjectByName('OutbreakContactShadows')?.count > 0);
  const draw = await page.evaluate(() => {
    const { scene } = window.__outbreakSmoke;
    return {
      roadPaint: scene.getObjectByName('RoadMarkings')?.geometry.index.count,
      streetShadows: scene.getObjectByName('OutbreakContactShadows')?.count
    };
  });
  assert.ok(draw.roadPaint > 0 && draw.streetShadows > 0, JSON.stringify(draw));
  const settings = page.locator('.ze-quality');
  const budget = () => page.evaluate(() => window.__outbreakSmoke.renderer.getPixelRatio());
  const initialRatio = await budget();
  await settings.selectOption('cinematic');
  assert.ok(await budget() > initialRatio);
  await phase('errand');
  await settings.selectOption('low');
  await page.locator('#touch-controls').waitFor({ state: 'visible' });
  const overlap = await page.evaluate(() => {
    const get = selector => document.querySelector(selector).getBoundingClientRect();
    const feed = get('.ze-feed'), stick = get('#touch-stick'), actions = get('.touch-actions');
    return feed.left < stick.right || feed.right > actions.left;
  });
  assert.equal(overlap, false, 'landscape subtitles leave both control clusters clear');
  await hold('#touch-stick', () => wait(() => window.__outbreakSmoke.outbreak.controller.keys.forward > 0));
  await wait(() => !window.__outbreakSmoke.outbreak.controller.keys.forward);
  console.log('Road paint and contact shadows render; quality changes without restarting the chapter');
  console.log('Touch joystick sends and releases movement');
  await capture('calle');

  await page.evaluate(() => { window.__outbreakSmoke.outbreak.mission.streetTime = 5; });
  await phase('phone');
  await page.getByRole('button', { name: 'Contestar', exact: true }).waitFor();
  await capture('llamada');
  await page.getByRole('button', { name: 'Contestar', exact: true }).tap();
  await wait(() => window.__outbreakSmoke.outbreak.mission.phoneAnswered);
  console.log('Touch answers the call');
  if (true) {
    await teleport('schoolVan', 12);
    await capture('escolar');
  }

  await page.evaluate(() => { window.__outbreakSmoke.outbreak.mission.streetTime = window.__outbreakSmoke.outbreak.config.outbreakSeconds; });
  await phase('escape');
  assert.ok(await page.evaluate(() => window.__outbreakSmoke.lightingSystem.uFogDensity.value > .00115));
  await teleport('pharmacy', 5.5);
  await page.getByRole('button', { name: 'Recoger', exact: true }).waitFor();
  await capture('farmacia');
  await hold('.ze-touch-context', () => objective('radio'));
  await teleport('radio');
  await page.evaluate(() => {
    const { mission } = window.__outbreakSmoke.outbreak;
    mission.time = mission.config.radioArrivalSeconds;
  });
  await hold('.ze-touch-context', () => objective('relay'));
  await teleport('relay', 3.2);
  await page.getByRole('button', { name: 'Leer', exact: true }).waitFor();
  await capture('avisos');
  await hold('.ze-touch-context', () => objective('shelter'));
  const approach = await teleport('shelter', 3.4);
  const canOpen = await page.evaluate(() => {
    const { mission, controller } = window.__outbreakSmoke.outbreak;
    return mission.interactionAt(controller.getActiveEntity().position) === 'shelter';
  });
  assert.ok(canOpen, `Expected an available gate at ${JSON.stringify(approach)}`);
  await page.getByRole('button', { name: 'Abrir', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__outbreakSmoke.outbreak.mission.phase), 'escape');
  await hold('.ze-touch-context', () => wait(() => window.__outbreakSmoke.outbreak.mission.doorOpening >= .95));
  await capture('refugio');
  await hold('#touch-stick', () => phase('secured'));
  await phase('won');
  await page.getByRole('button', { name: 'Volver a intentarlo' }).waitFor();
  console.log('Touch collects supplies, uses the radio and reads the notice; opening and crossing the shelter gate completes the chapter');
  await context.close();
  const desktopContext = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'es-PE' });
  const desktop = await desktopContext.newPage();
  await preparePage(desktop);
  await desktop.goto(url, { waitUntil: 'domcontentloaded' });
  await desktop.locator('#outbreak').waitFor({ state: 'visible', timeout: 120_000 });
  assert.equal(await desktop.locator('.ze-quality').inputValue(), 'balanced');
  await desktop.locator('.ze-primary').click();
  await desktop.locator('.ze-skip').click();
  await desktop.waitForFunction(() => window.__outbreakSmoke.outbreak.mission.playing);
  await desktop.keyboard.down('KeyW');
  try {
    await desktop.waitForFunction(() => window.__outbreakSmoke.outbreak.controller.keys.forward > 0);
  } finally {
    await desktop.keyboard.up('KeyW');
  }
  console.log('Desktop WebGL2 starts at balanced quality and responds to keyboard input');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(renderingErrors, []);
} finally {
  await browser?.close();
  server.close();
}
