import * as THREE from 'three/webgpu';
import { PersonCrowd, PersonRig } from '../pedestrians.js';
import { distance } from './mission.js';

export class OutbreakActors {
  constructor(scene, nav, controller, config) {
    this.nav = nav; this.controller = controller; this.config = config;
    this.crowd = new PersonCrowd(config.zombieCount + 6);
    this.crowd.meshes.forEach((m) => scene.add(m));
    this.ringGeometry = new THREE.RingGeometry(0.42, 0.55, 16); this.ringGeometry.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({ color: 0xee5544, transparent: true, opacity: 0.8 });
    this.group = new THREE.Group(); scene.add(this.group);
    this.actors = []; this.timer = 0;
    this.ground = (_owner, x, z) => controller.getGroundHeight(x, z, 'person');
    this.crowd.begin(); this.crowd.end();
  }
  reset() {
    this.actors = []; this.group.clear(); this.timer = 0;
    this.crowd.begin(); this.crowd.end();
  }
  spawn() {
    this.reset();
    const { hospital, zombieCount } = this.config;
    for (let i = 0; i < zombieCount + 6; i++) {
      const civilian = i >= zombieCount;
      const p = this.nav.nearest({ x: hospital.x + (i % 3 - 1) * 5, z: hospital.z + (!civilian && i >= 6 ? -65 - Math.floor(i / 3) * 22 : 16 + Math.floor(i / 3) * 7) });
      if (!p) continue;
      const rig = new PersonRig({ seed: 2.8 + i * 0.71, armSwing: civilian ? 1.2 : 0.25, stride: civilian ? 1 : 0.72, girth: 0.95 });
      const ring = new THREE.Mesh(this.ringGeometry, this.material);
      ring.visible = !civilian; this.group.add(ring);
      this.actors.push({ ...p, civilian, rig, ring, heading: Math.PI, alerted: civilian, speed: civilian ? 6.2 : this.config.zombieSpeed + (i % 3) * 0.15 });
    }
  }
  update(dt, player, mission, civilianNav) {
    this.timer -= dt;
    if (this.timer <= 0) { this.nav.flood(player.position); this.timer = 0.7; }
    this.crowd.begin();
    for (const a of this.actors) {
      const nav = a.civilian ? civilianNav : this.nav;
      if (distance(a, player.position) < 85) a.alerted = true;
      const target = a.civilian ? this.config.shelter : player.position;
      if (a.alerted) {
        const next = nav.step(a, target, a.speed * dt);
        if (distance(a, next) > 0.001) a.heading = Math.atan2(next.x - a.x, next.z - a.z);
        a.x = next.x; a.z = next.z;
      }
      const y = this.ground(null, a.x, a.z);
      if (!a.civilian && distance(a, player.position) < 1.65 && Math.abs(player.position.y - y) < 1.9 && nav.clear(a, player.position)) mission.hurt();
      a.rig.update(dt, a.x, a.z, a.heading, this.ground);
      // Civilians disappear only after reaching the refuge; infected remain visible.
      if (!a.civilian || distance(a, this.config.shelter) > 7) this.crowd.add(a.rig, distance(a, player.position));
      a.ring.position.set(a.x, y + 0.035, a.z);
    }
    this.crowd.end();
  }
}
