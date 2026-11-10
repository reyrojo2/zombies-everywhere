import assert from 'node:assert/strict';
import test from 'node:test';
import { RenderQuality } from '../js/outbreak/render-quality.js';

const frames = (quality, count, seconds, playing = true) => {
  let changes = 0;
  for (let i = 0; i < count; i++) changes += Number(quality.sample(seconds, playing));
  return changes;
};

test('adaptive quality reacts to sustained load, ignores single hitches and recovers gradually', () => {
  const quality = new RenderQuality(true, 'balanced');
  const initial = quality.scale, far = quality.distance;
  assert.equal(quality.sample(.85, true), false);
  assert.equal(frames(quality, 25, .055), 0);
  assert.equal(frames(quality, 25, .055), 1);
  assert.ok(quality.scale < initial && quality.distance < far);
  const reduced = quality.scale;
  assert.equal(frames(quality, 180, 1 / 60), 0);
  assert.equal(quality.scale, reduced);
  assert.ok(frames(quality, 180, 1 / 60) > 0);
  assert.ok(quality.scale > reduced);
  assert.equal(frames(quality, 400, .06, false), 0);
});

test('profiles cap resolution by device and remain within their limits', () => {
  const mobile = new RenderQuality(true, 'cinematic');
  const desktop = new RenderQuality(false, 'cinematic');
  frames(mobile, 600, .05);
  frames(desktop, 600, .05);
  assert.equal(mobile.scale, .48);
  assert.equal(desktop.scale, .60);
  mobile.select('low');
  frames(mobile, 1800, 1 / 60);
  assert.equal(mobile.scale, .70);
  assert.ok(mobile.resolution(2500, 2000) ** 2 * 5_000_000 <= 1_050_001);
  desktop.select('balanced');
  assert.equal(desktop.scale, .80);
  assert.ok(desktop.resolution(3840, 2160) ** 2 * 3840 * 2160 <= 2_600_001);
});
