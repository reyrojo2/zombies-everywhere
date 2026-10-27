import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLOCKS, STREETS } from '../city-config.js';

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
export function buildMissionGround(scene, missionBounds) {
  const blocks=selectMissionBlocks(BLOCKS,missionBounds);
  const bounds={minX:Math.min(...blocks.map(b=>b.minX))-40,maxX:Math.max(...blocks.map(b=>b.maxX))+40,
    minZ:Math.min(...blocks.map(b=>b.minZ))-40,maxZ:Math.max(...blocks.map(b=>b.maxZ))+40};
  const group=new THREE.Group();group.name='ManhattanCityGrid';scene.add(group);
  const asphalt=new THREE.MeshStandardMaterial({color:0x33383c,roughness:.95});
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
    for(let i=0;i<normals.count;i++){const shade=Math.abs(normals.getZ(i))>.5?1:.76;colors.set([shade,shade,shade],i*3);}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.rotateX(-Math.PI/2);
    const key=Math.floor((b.minX+b.maxX)/400)+','+Math.floor((b.minZ+b.maxZ)/400);
    if(!slabs.has(key))slabs.set(key,[]);slabs.get(key).push(geometry);
  }
  for(const geometries of slabs.values()){const mesh=new THREE.Mesh(mergeGeometries(geometries,false),top);mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
  const paint=new THREE.MeshBasicMaterial({color:0xd2caa9});
  for(const s of STREETS) if(s.z>missionBounds.minZ-150 && s.z<missionBounds.maxZ+150) {
    for(const x of [-8,-5,-2,1,4,7]) for(const sign of [-1,1]) {
      const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.3,3.2),paint);stripe.rotation.x=-Math.PI/2;stripe.position.set(x,.025,s.z+sign*(s.width/2+2));group.add(stripe);
    }
  }
  return {bounds,blockIds:new Set(blocks.map(b=>b.id)),group,sidewalks,footprints:[],colliders:[],highwayLanes:[]};
}
