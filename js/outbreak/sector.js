import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLOCKS } from '../city-config.js';

export function intersectsSector(box, bounds) {
  return box.maxX >= bounds.minX && box.minX <= bounds.maxX && box.maxZ >= bounds.minZ && box.minZ <= bounds.maxZ;
}
export function selectMissionBlocks(blocks, missionBounds, count=500) {
  const cx=(missionBounds.minX+missionBounds.maxX)/2,cz=(missionBounds.minZ+missionBounds.maxZ)/2;
  return [...blocks].sort((a,b)=>{
    const score=q=>Math.hypot((q.minX+q.maxX)/2-cx,(q.minZ+q.maxZ)/2-cz);
    return score(a)-score(b)||a.id-b.id;
  }).slice(0,count);
}
// Match the original city grid's curb cover: an irregular block's bounding box can cover entire streets.
export function missionSidewalkFootprints(blocks) {
  return blocks.flatMap(b=>b.median?[]:b.rect?[{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ}]:
    b.rects.map(([x0,x1,z0,z1])=>({minX:x0-4.4,maxX:x1+4.4,minZ:z0-4.4,maxZ:z1+4.4})));
}
function concreteTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#9b9a94';ctx.fillRect(0,0,256,256);
  let seed=19;
  for(let i=0;i<5000;i++) {seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;ctx.fillStyle=i%2?'#85868055':'#c0beb655';ctx.fillRect(x,seed%256,1,1);}
  ctx.strokeStyle='#777a76';ctx.lineWidth=1;ctx.strokeRect(.5,.5,255,255);
  const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.repeat.set(.5,.5);map.anisotropy=4;return map;
}
function asphaltTexture() {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  let seed = 709;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const wear = 7 * Math.sin(2 * u + 3 * v) + 5 * Math.sin(3 * u - v) + 3 * Math.cos(u + 5 * v);
    const grit = (seed >>> 24) / 255 * 34 - 17;
    const gray = 126 + wear + grit;
    const i = (y * size + x) * 4;
    image.data.set([gray - 2, gray, gray + 2, 255], i);
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

export function createStreetShadows(scene, controller) {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    pixels[(y * size + x) * 4 + 3] = Math.round(Math.max(0, 1 - radius * radius) ** 2 * 125);
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false });
  const limit = 40;
  const mesh = new THREE.InstancedMesh(geometry, material, limit);
  mesh.name = 'OutbreakContactShadows';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const transform = new THREE.Object3D();
  return (player, actors, driving) => {
    let count = 0;
    const add = (x, z, heading, vehicle = false) => {
      transform.position.set(x, controller.getGroundHeight(x, z, vehicle ? 'car' : 'person') + .021, z);
      transform.rotation.y = heading;
      transform.scale.set(vehicle ? 1.22 : .50, 1, vehicle ? 2.55 : .64);
      transform.updateMatrix();
      mesh.setMatrixAt(count++, transform.matrix);
    };
    add(player.position.x, player.position.z, player.heading, driving);
    for (const actor of actors) {
      if (count >= limit) break;
      if (!actor.sheltered && Math.hypot(actor.x - player.position.x, actor.z - player.position.z) < 45) {
        add(actor.x, actor.z, actor.heading);
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
  };
}

export function buildMissionGround(scene, missionBounds, margin = null) {
  const blocks = margin === null ? selectMissionBlocks(BLOCKS, missionBounds) : BLOCKS.filter(block =>
    intersectsSector(block, { minX: missionBounds.minX - margin, maxX: missionBounds.maxX + margin,
      minZ: missionBounds.minZ - margin, maxZ: missionBounds.maxZ + margin }));
  const bounds={minX:Math.min(...blocks.map(b=>b.minX))-40,maxX:Math.max(...blocks.map(b=>b.maxX))+40,
    minZ:Math.min(...blocks.map(b=>b.minZ))-40,maxZ:Math.max(...blocks.map(b=>b.maxZ))+40};
  const group=new THREE.Group();group.name='ManhattanCityGrid';scene.add(group);
  const asphaltMap = asphaltTexture();
  asphaltMap.repeat.set((bounds.maxX - bounds.minX) / 10, (bounds.maxZ - bounds.minZ) / 10);
  const asphalt=new THREE.MeshStandardMaterial({color:0x818388, map:asphaltMap, roughness:.96});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ),asphalt);
  ground.rotation.x=-Math.PI/2;ground.position.set((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);ground.receiveShadow=true;group.add(ground);
  const top=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,map:concreteTexture(),vertexColors:true});
  const slabs=new Map();
  const sidewalks=missionSidewalkFootprints(blocks);
  for(const b of blocks) {
    const shape=new THREE.Shape();b.poly.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();
    // A raised solid slab with visible vertical curb faces; park landscaping comes from landmarks.
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false});
    const normals=geometry.getAttribute('normal'),colors=new Float32Array(normals.count*3);
    const tone = .77 + (Math.sin(b.id * 3.57) + 1) * .085;
    for(let i=0;i<normals.count;i++){
      const shade = tone * (Math.abs(normals.getZ(i)) > .5 ? 1 : .68);
      colors.set([shade, shade * .98, shade * .93], i * 3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.rotateX(-Math.PI/2);
    const key=Math.floor((b.minX+b.maxX)/400)+','+Math.floor((b.minZ+b.maxZ)/400);
    if(!slabs.has(key))slabs.set(key,[]);slabs.get(key).push(geometry);
  }
  for(const geometries of slabs.values()){const mesh=new THREE.Mesh(mergeGeometries(geometries,false),top);mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
  return {bounds,blockIds:new Set(blocks.map(b=>b.id)),group,sidewalks,footprints:[],colliders:[],highwayLanes:[]};
}
