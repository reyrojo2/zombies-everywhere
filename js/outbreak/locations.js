import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distance } from './mission.js';
import { sitePoint } from './navigation.js';

const materials = new Map();

function solid(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .86 }));
  return materials.get(color);
}

function box(parent, size, position, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), solid(color));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function sign(parent, width, height, position, background, text, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  panel.position.set(...position);
  parent.add(panel);
  const context = canvas.getContext('2d');
  const write = (value) => {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = accent;
    context.fillRect(0, 0, 8, canvas.height);
    context.fillStyle = '#fff5dd';
    context.font = 'bold 46px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(value, 256, 48, 480);
    map.needsUpdate = true;
  };
  write(text);
  return write;
}

function place(group, point, groundHeight) {
  group.position.set(point.x, groundHeight, point.z);
  group.rotation.y = point.heading;
  return group;
}

export function createPharmacy(point, groundHeight) {
  const group = new THREE.Group();
  box(group, [5.8, 3.3, .30], [0, 1.65, -1.6], 0x78514a);
  box(group, [5.8, .18, 1.28], [0, 3.25, -1.22], 0x293d38);
  box(group, [4.35, 2.45, .12], [0, 1.225, -1.55], 0x1d3032);
  const shutter = new THREE.Group(); group.add(shutter);
  box(shutter, [4.35, 2.45, .12], [0, 1.225, -1.41], 0x475357);
  for (let i = 0; i < 14; i++) box(shutter, [4.33, .045, .06], [0, .15 + i * .165, -1.325], 0x7a8180);
  box(group, [.25, 2.65, .16], [-2.22, 1.32, -1.35], 0x242a29);
  box(group, [.25, 2.65, .16], [2.22, 1.32, -1.35], 0x242a29);
  const writeSign = sign(group, 5.16, .56, [0, 2.85, -1.41], '#19372f', 'FARMACIA', '#a3d396');
  const bag = new THREE.Group();
  bag.position.set(0, .42, -.82);
  box(group, [1.02, .12, .55], [0, .36, -.82], 0x50463c);
  for (const side of [-1, 1]) box(group, [.09, .33, .35], [side * .39, .165, -.82], 0x423930);
  box(bag, [.63, .39, .32], [0, .2, 0], 0xa9432d);
  box(bag, [.51, .05, .025], [0, .27, .17], 0xdbb76f);
  box(bag, [.21, .035, .1], [0, .43, 0], 0x292b27);
  group.add(bag);
  return { group: place(group, point, groundHeight), bag, writeSign,
    setClosed(progress) { shutter.scale.y = .42 + progress * .58; shutter.position.y = 2.45 * (1 - shutter.scale.y); }
  };
}

// Colored boxes are baked into one mesh. Only signs and hazard lamps need separate draws.
export function createNeighborhoodScenery(config, neighborhood, ground) {
  const group = new THREE.Group(); group.name = 'NeighborhoodScenery';
  const pieces = [], lamps = [], colliders = [];
  const addBox = (point, size, local, color) => {
    const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
    const c = new THREE.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.translate(...local); geometry.rotateY(point.heading || 0);
    geometry.translate(point.x, ground(point), point.z); pieces.push(geometry);
  };
  const vehicle = (point, school) => {
    if (!point) return;
    const paint = school ? 0xe8af30 : 0xc8c9c0;
    addBox(point, [2.24, 1.05, 6.2], [0, 1.1, 0], paint);
    addBox(point, [2.12, 1.15, 4.3], [0, 2.12, -.65], paint);
    addBox(point, [1.95, .67, .08], [0, 2.08, 1.53], 0x263d4a);
    addBox(point, [2.25, .16, 6.25], [0, .64, 0], 0x22272b);
    for (const side of [-1, 1]) {
      for (const z of [-2.13, 2.05]) addBox(point, [.25, .78, .78], [side * 1.09, .4, z], 0x1b2022);
      for (let i = 0; i < (school ? 4 : 1); i++) addBox(point, [.05, .67, .75], [side * 1.075, 2.12, 1.04 - i * .95], 0x2e4650);
      addBox(point, [.05, .055, 4.3], [side * 1.13, 1.48, -.4], 0x37332a);
      addBox(point, [.32, .15, .07], [side * .76, 1.3, 3.15], 0xe6d6ac);
      addBox(point, [.22, .24, .07], [side * .88, 1.1, -3.15], 0xa63329);
    }
    const panel = new THREE.Group(); place(panel, point, ground(point)); group.add(panel);
    sign(panel, 1.8, .23, [0, 2.63, 1.55], school ? '#c58c20' : '#465e63', school ? 'SCHOOL BUS' : 'DELIVERY', '#e9dcbc');
    const halfX = Math.abs(Math.cos(point.heading)) * 1.17 + Math.abs(Math.sin(point.heading)) * 3.2;
    const halfZ = Math.abs(Math.sin(point.heading)) * 1.17 + Math.abs(Math.cos(point.heading)) * 3.2;
    colliders.push({ minX: point.x - halfX, maxX: point.x + halfX, minZ: point.z - halfZ, maxZ: point.z + halfZ, minY: 0, maxY: 2.8 });
    if (school) for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.21, .14, .09), solid(0xe9a331));
      const p = sitePoint(point, side * .73, 1.6);
      lamp.position.set(p.x, ground(point) + 2.6, p.z); lamp.rotation.y = point.heading;
      group.add(lamp); lamps.push(lamp);
    }
  };
  vehicle(config.schoolVan, true); vehicle(config.deliveryVan, false);
  const stop = { ...neighborhood.stop, heading: config.pharmacy.heading };
  addBox(stop, [.09, 3.2, .09], [0, 1.6, 0], 0x4c5655);
  addBox(stop, [2.1, .12, .62], [1.8, .52, -.3], 0x544b3b);
  addBox(stop, [2.1, .44, .1], [1.8, .84, -.57], 0x544b3b);
  for (const x of [1.1, 2.5]) addBox(stop, [.10, .48, .48], [x, .24, -.3], 0x3d4443);
  const stopSign = new THREE.Group(); place(stopSign, stop, ground(stop)); group.add(stopSign);
  const writeStop = sign(stopSign, .9, .65, [0, 2.55, .06], '#253f55', 'BUS', '#d8c270');
  const delivery = { ...neighborhood.delivery, heading: config.pharmacy.heading };
  for (let i = 0; i < 5; i++) addBox(delivery, [.52, .44, .43], [(i % 2) * .58, .22 + Math.floor(i / 2) * .44, -.5], 0x98754e);
  for (const p of [config.spawn, config.pharmacy.approach, neighborhood.delivery]) {
    const point = { ...p, heading: config.pharmacy.heading };
    addBox(point, [.55, .82, .55], [2.4, .41, 0], 0x3c564b);
    addBox(point, [.59, .08, .59], [2.4, .86, 0], 0x242d2a);
  }
  const mesh = new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }));
  mesh.name = 'NeighborhoodStreetProps'; group.add(mesh); pieces.forEach(geometry => geometry.dispose());
  return {
    group, colliders, cues: [], alarmUntil: 0, hornPlayed: false, alarmPulse: -1,
    writeStop,
    reset() { this.alarmUntil = 0; this.hornPlayed = false; this.alarmPulse = -1; this.cues.length = 0; },
    update(mission, actors, player, noise) {
      if (!mission.playing) return;
      const van = config.schoolVan, time = mission.streetTime;
      const threatened = van && actors.some(a => a.state === 'zombie' && distance(a, van) < 30);
      if (van && !this.hornPlayed && (threatened || (time > 28 && mission.witnessedOutbreak))) {
        this.hornPlayed = true; this.alarmUntil = time + 4;
        this.cues.push({ kind: 'horn', position: van }); noise.emit(van, 65, 4, true);
      }
      const pulse = Math.floor(time * 2);
      lamps.forEach((lamp, i) => { lamp.visible = time < this.alarmUntil && pulse % 2 === i; });
      if (van && time < this.alarmUntil && pulse !== this.alarmPulse) {
        this.alarmPulse = pulse; this.cues.push({ kind: 'alarm', position: van });
        noise.emit(van, 70, .7, true);
      }
      if (this.cues.length > 6) this.cues.shift();
    }
  };
}

export function createNoticeBoard(point, groundHeight) {
  const group = new THREE.Group();
  box(group, [.11, 1.78, .16], [-.69, .89, -.48], 0x51483a);
  box(group, [.11, 1.78, .16], [.69, .89, -.48], 0x51483a);
  box(group, [1.61, .94, .13], [0, 1.37, -.46], 0x44372d);
  for (const [x, y, color] of [[-.43, 1.38, 0xc6a56b], [-.09, 1.27, 0xdfd6b7], [.34, 1.44, 0xe9ddba]]) {
    box(group, [.29, .32, .02], [x, y, -.383], color);
    for (let line = 0; line < 4; line++) box(group, [.20, .013, .008], [x, y + .09 - line * .052, -.369], 0x746452);
  }
  const writeSign = sign(group, 1.53, .19, [0, 1.72, -.38], '#282f31', 'AVISOS', '#d5b376');
  return { group: place(group, point, groundHeight), writeSign };
}

export function createShelterGate(point, groundHeight) {
  const group = new THREE.Group();
  const wall = 0x313c38;
  box(group, [4.9, .13, 4.5], [0, .04, -2.15], 0x74766a);
  box(group, [.18, 2.7, 4.4], [-2.36, 1.35, -2.1], wall);
  box(group, [.18, 2.7, 4.4], [2.36, 1.35, -2.1], wall);
  box(group, [4.9, 2.7, .18], [0, 1.35, -4.27], wall);
  box(group, [4.9, .18, 4.5], [0, 2.72, -2.1], wall);
  for (const side of [-1, 1]) {
    box(group, [1.12, 2.52, .17], [side * 1.78, 1.26, 0], 0x59635a);
    box(group, [.12, 2.55, .21], [side * 1.20, 1.27, .015], 0x252b29);
    box(group, [.13, .60, .05], [side * 1.32, 1.62, .105], 0xd8a94b);
  }
  const doors = [-1, 1].map(side => box(group, [1.2, 2.38, .13], [side * .60, 1.19, -.12], 0x53635c));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.86, .10, .12), new THREE.MeshBasicMaterial({ color: 0xe4c784 }));
  lamp.position.set(0, 2.39, -.46);
  group.add(lamp);
  const writeSign = sign(group, 3.1, .44, [0, 2.95, .205], '#204136', 'REFUGIO', '#8de1b0');
  return {
    group: place(group, point, groundHeight),
    writeSign,
    setOpening(progress) {
      doors[0].position.x = -.60 - progress * 1.24;
      doors[1].position.x = .60 + progress * 1.24;
    }
  };
}
