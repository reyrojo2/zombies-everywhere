import * as THREE from 'three/webgpu';

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
  box(group, [4.35, 2.45, .12], [0, 1.225, -1.41], 0x475357);
  for (let i = 0; i < 14; i++) box(group, [4.33, .045, .06], [0, .15 + i * .165, -1.325], 0x7a8180);
  box(group, [.25, 2.65, .16], [-2.22, 1.32, -1.35], 0x242a29);
  box(group, [.25, 2.65, .16], [2.22, 1.32, -1.35], 0x242a29);
  const writeSign = sign(group, 5.16, .56, [0, 2.85, -1.41], '#19372f', 'FARMACIA', '#a3d396');
  const bag = new THREE.Group();
  bag.position.set(0, 0, -.5);
  box(bag, [.63, .39, .32], [0, .2, 0], 0xa9432d);
  box(bag, [.51, .05, .025], [0, .27, .17], 0xdbb76f);
  box(bag, [.21, .035, .1], [0, .43, 0], 0x292b27);
  group.add(bag);
  return { group: place(group, point, groundHeight), bag, writeSign };
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
  const writeSign = sign(group, 3.1, .44, [0, 2.82, .12], '#204136', 'REFUGIO', '#8de1b0');
  return {
    group: place(group, point, groundHeight),
    writeSign,
    setOpening(progress) {
      doors[0].position.x = -.60 - progress * 1.24;
      doors[1].position.x = .60 + progress * 1.24;
    }
  };
}
