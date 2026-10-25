import test from 'node:test';
import assert from 'node:assert/strict';
import { Mission, MANHATTAN } from '../js/outbreak/mission.js';
import { NavigationGrid } from '../js/outbreak/navigation.js';
import { MESSAGES, getLanguage } from '../js/outbreak/locales.js';

test('intro, hospital proximity AND finished call gate the outbreak; shelter ends it', () => {
  const m = new Mission(MANHATTAN); m.start();
  m.tick(42, MANHATTAN.hospital); assert.equal(m.phase, 'errand');
  m.tick(10, MANHATTAN.hospital); assert.equal(m.phase, 'errand');
  m.tick(15, MANHATTAN.spawn); assert.equal(m.phase, 'errand');
  m.tick(0.1, MANHATTAN.hospital); assert.equal(m.phase, 'escape');
  m.tick(1, MANHATTAN.shelter); assert.equal(m.phase, 'won');
  m.hurt(); assert.equal(m.health, 100);
});

test('pause freezes timers and damage; damage has shared invulnerability; restart clears state', () => {
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro(); m.tick(25, MANHATTAN.hospital);
  assert.equal(m.hurt(), true); assert.equal(m.hurt(), false); assert.equal(m.health, 86);
  m.paused = true; m.tick(60, MANHATTAN.shelter, true); m.hurt();
  assert.equal(m.phase, 'escape'); assert.equal(m.time, 0); assert.equal(m.health, 86);
  m.paused = false;
  for (let i = 0; i < 8; i++) { m.tick(1.3, MANHATTAN.hospital); m.hurt(); }
  assert.equal(m.phase, 'lost'); assert.equal(m.health, 0);
  m.tick(2, MANHATTAN.shelter); assert.equal(m.phase, 'lost');
  m.start(); assert.equal(m.health, 100); assert.equal(m.paused, false); assert.equal(m.stamina, 100);
});

test('sprint exhausts and requires recovery, rather than oscillating every frame', () => {
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro();
  m.tick(6, MANHATTAN.spawn, true); assert.equal(m.stamina, 0); assert.equal(m.exhausted, true);
  m.tick(1, MANHATTAN.spawn, true); assert.equal(m.stamina, 11); assert.equal(m.exhausted, true);
  m.tick(2, MANHATTAN.spawn, false); m.tick(0, MANHATTAN.spawn);
  assert.equal(m.exhausted, false);
});

test('flow field routes around a wall and movement never enters its cells', () => {
  const nav = new NavigationGrid({ minX: 0, maxX: 40, minZ: 0, maxZ: 40 }, [{ minX: 18, maxX: 20, minZ: 0, maxZ: 25, maxY: 5 }]);
  let p = { x: 9, z: 9 }; const goal = { x: 29, z: 9 };
  assert.equal(nav.clear(p, goal), false); nav.flood(goal);
  assert.ok(nav.cost[nav.index(p)] > 0);
  for (let i = 0; i < 1000; i++) {
    const q = nav.step(p, goal, 0.3); assert.ok(nav.clear(p, q)); p = q;
  }
  assert.ok(Math.hypot(p.x - goal.x, p.z - goal.z) < 0.1);
});

test('sealed targets, boundaries, and tall overhead objects are handled safely', () => {
  const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };
  const nav = new NavigationGrid(bounds, [{ minX: 8, maxX: 10, minZ: -5, maxZ: 25, maxY: 5 }]);
  nav.flood({ x: 17, z: 9 });
  assert.equal(nav.cost[nav.index({ x: 3, z: 9 })], -1);
  assert.deepEqual(nav.step({ x: 3, z: 9 }, { x: 17, z: 9 }, 1), { x: 3, z: 9 });
  assert.equal(nav.index({ x: 20, z: 9 }), -1);
  assert.equal(nav.clear({ x: 1, z: 1 }, { x: -1, z: 1 }), false);
  const bridge = new NavigationGrid(bounds, [{ minX: 0, maxX: 20, minZ: 0, maxZ: 20, minY: 8, maxY: 10 }]);
  assert.equal(bridge.blocked.some(Boolean), false);
});

test('all narrative/UI keys exist in both languages and unavailable storage defaults to Spanish', () => {
  assert.deepEqual(Object.keys(MESSAGES.es).sort(), Object.keys(MESSAGES.en).sort());
  assert.ok(Object.values(MESSAGES.es).every((s) => typeof s === 'string' && s.length));
  assert.equal(getLanguage({ getItem: () => { throw new Error('disabled'); } }), 'es');
  assert.equal(getLanguage({ getItem: () => 'en' }), 'en');
  assert.equal(getLanguage({ getItem: () => 'other' }), 'es');
});
