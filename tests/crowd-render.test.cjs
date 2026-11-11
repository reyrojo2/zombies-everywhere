const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../js/pedestrians.js'), 'utf8');
const crowdSource = source.match(/class PersonCrowd \{[^]*?\n\}/)[0];

for (const webgl of [true, false]) {
  test(`moving a crowd member updates the poses consumed by ${webgl ? 'WebGL texture sampling' : 'WebGPU storage'}`, () => {
    const STRIDE = 32;
    const attributes = [];
    const attributeArray = count => {
      const attr = {
        array: new Float32Array(count * 4),
        clearUpdateRanges() {}, addUpdateRange() {},
        set needsUpdate(value) { if (value) this.storage = this.array.slice(); }
      };
      if (webgl) attr.pbo = { set needsUpdate(value) { if (value) attr.sampled = attr.array.slice(); } };
      attributes.push(attr);
      return { value: attr, toReadOnly() { return this; }, setPBO() { return this; } };
    };
    const Crowd = vm.runInNewContext(`(${crowdSource})`, {
      STRIDE, attributeArray, buildPersonGeometry: () => ({}), createPersonMaterial: () => ({}),
      THREE: { Mesh: class {} }
    });
    const crowd = new Crowd(4), rig = { pose: new Float32Array(STRIDE * 4) };
    const sampledPosition = () => (webgl ? attributes[0].sampled : attributes[0].storage)[4];
    rig.pose[4] = 10;
    crowd.begin(); crowd.add(rig, 5); crowd.end();
    assert.equal(sampledPosition(), 10);
    rig.pose[4] = 25;
    crowd.begin(); crowd.add(rig, 5); crowd.end();
    assert.equal(sampledPosition(), 25, 'a pose change after the first draw must reach the renderer');
    crowd.begin(); crowd.end();
    assert.equal(crowd.meshes[0].count, 0);
  });
}
