import * as THREE from 'three/webgpu';
import { Mission, MANHATTAN, distance } from './mission.js';
import { NavigationGrid } from './navigation.js';
import { OutbreakActors } from './actors.js';
import { OutbreakView } from './view.js';

export class OutbreakGame {
  constructor({ scene, controller, camera, colliders, audio }) {
    this.controller = controller; this.camera = camera; this.audio = audio;
    this.nav = new NavigationGrid(MANHATTAN.bounds, colliders);
    // Resolve authored waypoints against actual buildings, rather than assuming empty sidewalks.
    this.config = { ...MANHATTAN };
    for (const key of ['spawn', 'hospital', 'shelter']) {
      const p = this.nav.nearest(MANHATTAN[key], 35);
      if (!p) throw new Error(`No walkable mission waypoint: ${key}`);
      this.config[key] = { ...MANHATTAN[key], ...p };
    }
    this.civilianNav = new NavigationGrid(MANHATTAN.bounds, colliders);
    this.civilianNav.flood(this.config.shelter);
    for (const key of ['spawn', 'hospital']) {
      if (this.civilianNav.cost[this.civilianNav.index(this.config[key])] < 0) throw new Error(`Disconnected mission waypoint: ${key}`);
    }
    this.mission = new Mission(this.config);
    this.actors = new OutbreakActors(scene, this.nav, controller, this.config);
    this.markers = new THREE.Group(); scene.add(this.markers);
    this.hospital = this.createMarker(this.config.hospital, 0xe5b45a);
    this.shelter = this.createMarker(this.config.shelter, 0x73e0ad);
    this.view = new OutbreakView({ onStart: () => this.start(), onSkip: () => this.mission.skipIntro(),
      onPause: () => this.pause(), onLanguage: () => this.updateSigns(), onSound: () => audio.setEnabled(!audio.enabled) });
    this.updateSigns();
    controller.setMode('person'); controller.teleportActiveTo(this.config.spawn.x, this.config.spawn.z, this.config.spawn.heading);
    camera.resetForTeleport();
    this.lastSafe = { ...controller.entities.person.position }; this.uiClock = 0;
    document.body.classList.add('outbreak-mode');
    // Capture prevents explorer shortcuts (teleports, vehicles, free camera) during a mission.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.pause(); return; }
      if (e.target.closest?.('select,button,input')) return;
      if (/^(Digit\d|KeyM|KeyV|KeyH|KeyB|KeyN)$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    }, true);
    window.addEventListener('blur', () => this.pause(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.render();
  }
  createMarker(point, color) {
    const group = new THREE.Group(); group.position.set(point.x, 0, point.z);
    const ringGeo = new THREE.RingGeometry(2.5, 3, 40); ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    ring.position.y = this.controller.getGroundHeight(point.x, point.z, 'person') + 0.08; group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }));
    beam.position.y = 6; group.add(beam);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true })); sign.position.set(0, 5, 0); sign.scale.set(12, 2.5, 1); group.add(sign);
    group.userData.sign = sign; this.markers.add(group); return group;
  }
  updateSigns() {
    for (const [marker, key] of [[this.hospital, 'hospital'], [this.shelter, 'shelter']]) {
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101b22'; ctx.fillRect(0, 0, 768, 160);
      ctx.strokeStyle = key === 'hospital' ? '#e5b45a' : '#73e0ad'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 760, 152);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.view.t(key), 384, 92);
      const material = marker.userData.sign.material; material.map?.dispose(); material.map = new THREE.CanvasTexture(canvas); material.needsUpdate = true;
    }
    this.render();
  }
  start() {
    this.actors.reset(); this.mission.start(); this.controller.setMode('person');
    this.controller.teleportActiveTo(this.config.spawn.x, this.config.spawn.z, this.config.spawn.heading);
    this.camera.resetForTeleport(); this.lastSafe = { ...this.controller.entities.person.position };
    this.controller.poseCharacters(0.016); this.render();
  }
  pause(force = false) {
    if (['menu', 'won', 'lost'].includes(this.mission.phase)) return;
    this.mission.paused = force || !this.mission.paused; this.controller.resetInput(); this.render();
  }
  beforeUpdate(dt) {
    if (!this.mission.playing) { this.controller.resetInput(); return false; }
    if (this.mission.exhausted) this.controller.keys.boost = false;
    return true;
  }
  update(dt) {
    if (document.hidden) return;
    const player = this.controller.entities.person, m = this.mission;
    this.boundary = false;
    if (m.playing) {
      // Keep the first episode in its navigable sector, without changing the explorer's map.
      const b = this.config.bounds;
      if (player.position.x < b.minX + 2 || player.position.x > b.maxX - 2 || player.position.z < b.minZ + 2 || player.position.z > b.maxZ - 2) {
        player.position.set(this.lastSafe.x, this.lastSafe.y, this.lastSafe.z); player.speed = 0; this.boundary = true;
      } else this.lastSafe = { ...player.position };
    }
    const previous = m.phase;
    m.tick(dt, player.position, this.controller.keys.boost && Math.abs(player.speed) > 1);
    if (previous !== 'escape' && m.phase === 'escape') this.actors.spawn();
    if (m.phase === 'escape' && !m.paused) this.actors.update(dt, player, m, this.civilianNav);
    if (previous !== m.phase) { this.controller.resetInput(); this.render(); }
    this.hospital.visible = ['menu', 'intro', 'errand'].includes(m.phase);
    this.shelter.visible = ['escape', 'won'].includes(m.phase);
    this.view.root.classList.toggle('ze-hit', m.hurtCooldown > this.config.attackCooldown - 0.18);
    this.uiClock += dt;
    if (this.uiClock > 0.1) { this.uiClock = 0; this.render(); }
    // Reblend digital input after stamina temporarily suppresses sprint.
    if (m.playing) this.controller._blendInput('boost');
  }
  render() {
    if (!this.view) return;
    const m = this.mission, target = m.phase === 'escape' ? this.config.shelter : this.config.hospital;
    let feed = m.time < 12 ? 'call0' : m.time < 24 ? 'call1' : 'ready';
    if (m.phase === 'errand' && distance(this.controller.entities.person.position, this.config.hospital) < 20 && m.time < 24) feed = 'waiting';
    if (m.phase === 'escape') feed = m.time < 9 ? 'call2' : m.time < 23 ? 'cut' : 'emergency';
    this.view.render(m, { distance: distance(this.controller.entities.person.position, target), feed, boundary: this.boundary, sound: this.audio.enabled });
    this.view.drawMap(this.nav, this.controller.entities.person, this.actors.actors, target);
  }
}
