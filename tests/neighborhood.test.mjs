import test from 'node:test';
import assert from 'node:assert/strict';
import { Neighborhood } from '../js/outbreak/neighborhood.js';
import { MANHATTAN, Mission, distance } from '../js/outbreak/mission.js';
import { NavigationGrid, pedestrianSite, sitePoint } from '../js/outbreak/navigation.js';
import { Population } from '../js/outbreak/population.js';

const bounds = { minX: 0, maxX: 300, minZ: 0, maxZ: 200 };
function neighborhood() {
  const nav = new NavigationGrid(bounds, []);
  const config = { ...MANHATTAN, bounds, spawn: { x: 25, z: 25 }, pharmacy: { x: 145, z: 25 }, civilianCount: 160 };
  nav.flood(config.spawn);
  const surfaceAt = (x, z) => z < 45 || z > 65 ? 'sidewalk' : null;
  const route = Array.from({ length: 60 }, (_, i) => ({ x: 25 + i * 2, z: 25 }));
  return { nav, config, surfaceAt, district: new Neighborhood(config, nav, surfaceAt, route) };
}

test('a populated opening uses distinct reachable sidewalk positions and keeps resident identities through infection', () => {
  const { nav, config, surfaceAt, district } = neighborhood();
  const population = new Population(config), { patient, helper } = district.populate(population, nav);
  assert.equal(population.actors.length, 160);
  assert.equal(new Set(population.actors.map(a => nav.index(a))).size, 160);
  assert.ok(population.actors.every(a => nav.open(nav.index(a)) && surfaceAt(a.x, a.z)));
  assert.ok(population.actors.filter(a => distance(a, config.spawn) < 75).length >= 35);
  assert.equal(helper.helping, patient);
  const id = patient.id;
  patient.rig = { appearance: 'same resident' };
  population.infect(patient); population.activate();
  population.update(6, { x: 500, z: 500 }, () => true, () => {}, []);
  population.update(2, { x: 500, z: 500 }, () => true, () => {}, []);
  assert.equal(patient.state, 'zombie');
  assert.equal(patient.id, id);
  assert.equal(patient.rig.appearance, 'same resident');
  assert.equal(population.actors.length, 160);
});

test('recycling healthy background walkers never moves visible people or a wounded resident', () => {
  const { nav, config, district } = neighborhood();
  const population = new Population(config); district.populate(population, nav);
  const actor = population.actors.find(a => a.role === 'walker');
  actor.x = 285; actor.z = 185;
  const player = { x: 25, z: 25 }, original = { x: actor.x, z: actor.z };
  assert.equal(district.recycle(actor, player, () => true, nav, 50), false);
  assert.deepEqual({ x: actor.x, z: actor.z }, original);
  actor.wounded = true;
  assert.equal(district.recycle(actor, player, () => false, nav, 50), false);
  actor.wounded = false;
  assert.equal(district.recycle(actor, player, () => false, nav, 50), true);
  assert.ok(distance(actor, player) > 80 && distance(actor, player) < 135);
  assert.equal(population.actors.length, 160);
});

test('alarms frighten nearby residents while ordinary footsteps do not; walls attenuate both', () => {
  const population = new Population(MANHATTAN);
  const near = population.add({ x: 5, z: 0 }), far = population.add({ x: 60, z: 0 });
  population.activate();
  population.noise.emit({ x: 0, z: 0 }, 35);
  population.update(.2, { x: 100, z: 100 }, () => true, () => {});
  assert.equal(near.state, 'normal');
  population.noise.emit({ x: 0, z: 0 }, 35, 3, true);
  population.update(.2, { x: 100, z: 100 }, () => true, () => {});
  assert.equal(near.state, 'fleeing');
  assert.equal(far.state, 'normal');
  population.noise.events.length = 0;
  near.state = 'normal'; near.x = 20;
  population.noise.emit({ x: 0, z: 0 }, 35, 3, true);
  population.update(.2, { x: 100, z: 100 }, () => false, () => {});
  assert.equal(near.state, 'normal');
});

test('the first witnessed outbreak can advance the mission before the citywide fallback', () => {
  const mission = new Mission(MANHATTAN); mission.start(); mission.skipIntro();
  mission.tick(31, MANHATTAN.spawn);
  assert.notEqual(mission.phase, 'escape');
  mission.witnessedOutbreak = true; mission.tick(1, MANHATTAN.spawn);
  assert.equal(mission.phase, 'escape');
  mission.start(); mission.skipIntro();
  assert.equal(mission.witnessedOutbreak, false);
  mission.tick(MANHATTAN.outbreakSeconds, MANHATTAN.spawn);
  assert.equal(mission.phase, 'escape');
});

test('a pharmacy entrance fits on the sidewalk, faces its approach and backs onto a building', () => {
  const nav = new NavigationGrid({ minX: 0, maxX: 60, minZ: 0, maxZ: 60 }, [{ minX: 20, maxX: 45, minZ: 20, maxZ: 45 }]);
  nav.flood({ x: 15, z: 15 });
  const surface = (x, z) => x > 7 && x < 52 && z > 7 && z < 52 ? 'block' : null;
  const site = pedestrianSite(nav, { x: 20, z: 20 }, surface, { halfWidth: 3, depth: 1.85, approach: 3.3, facade: true });
  assert.ok(site);
  assert.ok(surface(site.approach.x, site.approach.z));
  assert.ok(nav.clear(site, site.approach));
  assert.ok([-1.5, 0, 1.5].some(x => !nav.open(nav.index(sitePoint(site, x, -3.85)))));
});

test('parked vans block their rotated body while leaving empty bounding-box corners walkable', async () => {
  const { parkedCollider } = await import('../js/outbreak/neighborhood.js');
  const nav = new NavigationGrid({ minX: 0, maxX: 60, minZ: 0, maxZ: 60 }, []);
  nav.addObstacles([parkedCollider({ x: 30, z: 30, heading: Math.PI / 4 })]);
  assert.equal(nav.open(nav.index({ x: 30, z: 30 })), false);
  assert.equal(nav.open(nav.index({ x: 33, z: 27 })), true);
});
