import * as THREE from 'three/webgpu';
import { streetZ } from '../city-config.js';

export class OutbreakIncidents {
  constructor(scene,config) {
    this.config=config;this.group=new THREE.Group();scene.add(this.group);
    this.carA=this.car(0x89362e);this.carB=this.car(0xb7b1a5);this.police=this.car(0x17232d,true);
    this.officers=[this.officer(),this.officer()];
    this.flames=[];this.smoke=[];
    const fireMat=new THREE.MeshBasicMaterial({color:0xff671e,transparent:true,opacity:.85});
    const smokeMat=new THREE.MeshBasicMaterial({color:0x272a2c,transparent:true,opacity:.32,depthWrite:false});
    this.sites=[{x:7,z:streetZ(45)},{x:17,z:streetZ(46)},{x:-34,z:streetZ(47)}];
    for(const site of this.sites) {
      for(let i=0;i<7;i++) {const mesh=new THREE.Mesh(new THREE.ConeGeometry(.6,2.6,5),fireMat);this.group.add(mesh);this.flames.push({mesh,site,i});}
      for(let i=0;i<6;i++) {const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,0),smokeMat);this.group.add(mesh);this.smoke.push({mesh,site,i});}
    }
    this.reset();
  }
  car(color,police=false) {
    const group=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color,roughness:.7});
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,.7,4.2),mat);body.position.y=.65;group.add(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.55,.65,1.9),new THREE.MeshStandardMaterial({color:0x354956}));cabin.position.set(0,1.25,-.15);group.add(cabin);
    for(const x of [-.95,.95]) for(const z of [-1.4,1.4]) {const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.25,8),new THREE.MeshStandardMaterial({color:0x141617}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.36,z);group.add(wheel);}
    if(police) {
      group.userData.lights=[];
      for(const [x,color] of [[-.45,0xff2828],[.45,0x277bff]]) {
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(.65,.2,.4),new THREE.MeshBasicMaterial({color}));lamp.position.set(x,1.7,0);group.add(lamp);group.userData.lights.push(lamp);
      }
    }
    this.group.add(group);return group;
  }
  officer() {
    const group=new THREE.Group();
    const uniform=new THREE.MeshStandardMaterial({color:0x20354d,roughness:1});
    const skin=new THREE.MeshStandardMaterial({color:0xb78b70,roughness:1});
    for(const [size,y,mat] of [[[.42,.65,.25],1.05,uniform],[[.24,.27,.23],1.53,skin],[[.38,.64,.20],.43,uniform]]) {
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.y=y;group.add(mesh);
    }
    this.group.add(group);return group;
  }
  reset() {this.time=0;this.crashed=false;this.active=false;this.group.visible=false;}
  update(dt,mission,player) {
    this.active=mission.phase==='escape';this.group.visible=this.active;
    if(!this.active || mission.paused)return;
    this.time=mission.time;
    const t=this.time,impactZ=this.sites[0].z;
    // Bounded directed collision: two cars approach and remain wrecked after impact.
    this.crashed=t>=3;
    this.carA.position.set(4,0,impactZ+Math.max(0,42-t*14));
    this.carB.position.set(6,0,impactZ-Math.max(0,42-t*14)-3);
    this.carA.rotation.y=this.crashed ? .65 : Math.PI;
    this.carB.rotation.y=this.crashed?-1.1:0;
    this.police.visible=t>=7;
    this.police.position.set(-4,0,impactZ+Math.max(17,140-Math.max(0,t-7)*13));
    this.police.rotation.y=Math.PI;
    this.officers.forEach((officer,i)=>{
      officer.visible=t>=17;
      const exit=Math.min(1,Math.max(0,t-17)/3);
      officer.position.set(-4-exit*(6+i*3),0,impactZ+17+exit*(4+i*3));
      officer.rotation.y=Math.PI;
    });
    this.police.userData.lights.forEach((m,i)=>m.visible=Math.floor(t*8)%2===i);
    for(const {mesh,site,i} of this.flames) {
      mesh.visible=this.crashed;const phase=t*7+i*2;
      mesh.position.set(site.x+Math.sin(i*3)*1.2,1.3+Math.sin(phase)*.25,site.z+Math.cos(i*3)*1.1);
      mesh.scale.set(1+.2*Math.sin(phase),.7+.5*Math.abs(Math.sin(phase)),1);
    }
    for(const {mesh,site,i} of this.smoke) {
      mesh.visible=this.crashed;const age=(t*.45+i/6)%1;
      mesh.position.set(site.x+age*5,3+age*14,site.z+age*2);mesh.scale.setScalar(.7+age*2);
    }
    // Wrecks and flames are dangerous to touch, rather than decorative safe spots.
    if(this.crashed && this.sites.some(s=>Math.hypot(s.x-player.x,s.z-player.z)<2.5))mission.hurt();
  }
}
