import * as THREE from 'three/webgpu';
import { BLOCKS, STREETS } from '../city-config.js';

export function intersectsSector(box, bounds) {
  return box.maxX >= bounds.minX && box.minX <= bounds.maxX && box.maxZ >= bounds.minZ && box.minZ <= bounds.maxZ;
}

// The mission builds only these real Manhattan blocks, plus a 100 m visual margin.
export function buildMissionGround(scene, missionBounds) {
  const bounds={minX:missionBounds.minX-100,maxX:missionBounds.maxX+100,minZ:missionBounds.minZ-100,maxZ:missionBounds.maxZ+100};
  const group=new THREE.Group();group.name='ManhattanCityGrid';scene.add(group);
  const asphalt=new THREE.MeshStandardMaterial({color:0x292e33,roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ),asphalt);
  ground.rotation.x=-Math.PI/2;ground.position.set((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);group.add(ground);
  const sidewalkMat=new THREE.MeshStandardMaterial({color:0x92928c,roughness:1});
  const grass=new THREE.MeshStandardMaterial({color:0x414e38,roughness:1});
  const sidewalks=[];
  for(const b of BLOCKS) {
    if(!intersectsSector(b,bounds))continue;
    const shape=new THREE.Shape(); b.poly.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),b.park>.6?grass:sidewalkMat);mesh.rotation.x=-Math.PI/2;mesh.position.y=.22;group.add(mesh);
    sidewalks.push({minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ});
  }
  const paint=new THREE.MeshBasicMaterial({color:0xd2caa9});
  for(const s of STREETS) if(s.z>bounds.minZ && s.z<bounds.maxZ) {
    // Zebra crossings on the episode's Fifth Avenue corridor.
    for(const x of [-8,-5,-2,1,4,7]) for(const sign of [-1,1]) {
      const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.3,3.2),paint);stripe.rotation.x=-Math.PI/2;stripe.position.set(x,.025,s.z+sign*(s.width/2+2));group.add(stripe);
    }
  }
  return {bounds,group,sidewalks,footprints:[],colliders:[],highwayLanes:[]};
}
