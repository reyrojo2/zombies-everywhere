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
    this.sites=[{x:7,z:streetZ(45),start:3},{x:17,z:streetZ(46),start:8},{x:-34,z:streetZ(47),start:13},
      {x:25,z:streetZ(44),start:18},{x:-50,z:streetZ(46),start:23},{x:12,z:streetZ(48),start:28}];
    this.pileups=this.sites.slice(1,4).map((site,i)=>({site,a:this.car([0x476f86,0x767a54,0xa49a7c][i]),b:this.car([0x985847,0x626d76,0x76586b][i])}));
    this.fireLights=[new THREE.PointLight(0xff6e24,0,22),new THREE.PointLight(0xffa23d,0,22)];this.fireLights.forEach(l=>this.group.add(l));
    for(const site of this.sites) {
      for(let i=0;i<7;i++) {const mesh=new THREE.Mesh(new THREE.ConeGeometry(.9,4.5,6),fireMat);this.group.add(mesh);this.flames.push({mesh,site,i});}
      for(let i=0;i<6;i++) {const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,0),smokeMat);this.group.add(mesh);this.smoke.push({mesh,site,i});}
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
    this.active=['errand','phone','escape'].includes(mission.phase);this.group.visible=this.active;
    if(!this.active || mission.paused)return;
    if(mission.phase!=='escape') {
      const t=mission.phase==='phone'?5:mission.time;
      this.carA.visible=this.carB.visible=true;this.carA.position.set(5,0,this.config.spawn.z+36-Math.min(t,30)*7);this.carA.rotation.y=Math.PI;
      this.carB.position.set(8,0,this.config.hospital.z+65);this.carB.rotation.y=.25;
      this.police.visible=t>=3;this.police.position.set(-4,0,this.config.hospital.z-100+Math.min(t,20)*9);this.police.rotation.y=0;
      this.police.userData.lights.forEach((m,i)=>m.visible=Math.floor(t*8)%2===i);
      this.pileups.forEach(p=>{p.a.visible=p.b.visible=false;});this.officers.forEach(o=>o.visible=false);
      this.flames.forEach(f=>f.mesh.visible=false);this.smoke.forEach(s=>s.mesh.visible=false);this.fireLights.forEach(l=>l.intensity=0);return;
    }
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
    for(const {site,a,b} of this.pileups){
      const elapsed=t-site.start,gap=Math.max(0,-elapsed*12);a.visible=b.visible=elapsed>=-3;
      a.position.set(site.x,0,site.z+gap);b.position.set(site.x+gap+2,0,site.z-2);
      a.rotation.y=elapsed>=0?.7:Math.PI;b.rotation.y=elapsed>=0?-1.2:-Math.PI/2;
    }
    const burning=this.sites.filter(s=>t>=s.start).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
    this.fireLights.forEach((light,i)=>{const s=burning[i];light.intensity=s?45+Math.sin(t*9+i)*12:0;if(s)light.position.set(s.x,2.5,s.z);});
    this.officers.forEach((officer,i)=>{
      officer.visible=t>=17;
      const exit=Math.min(1,Math.max(0,t-17)/3);
      officer.position.set(-4-exit*(6+i*3),0,impactZ+17+exit*(4+i*3));
      officer.rotation.y=Math.PI;
    });
    this.police.userData.lights.forEach((m,i)=>m.visible=Math.floor(t*8)%2===i);
    for(const {mesh,site,i} of this.flames) {
      mesh.visible=t>=site.start;const phase=t*7+i*2;
      mesh.position.set(site.x+Math.sin(i*3)*1.2,2.1+Math.sin(phase)*.5,site.z+Math.cos(i*3)*1.1);
      mesh.scale.set(1+.2*Math.sin(phase),.7+.5*Math.abs(Math.sin(phase)),1);
    }
    for(const {mesh,site,i} of this.smoke) {
      mesh.visible=t>=site.start;const age=(t*.45+i/6)%1;
      mesh.position.set(site.x+age*5,4+age*20,site.z+age*2);mesh.scale.setScalar(.9+age*2.7);
    }
    // Wrecks and flames are dangerous to touch, rather than decorative safe spots.
    if(this.crashed && this.sites.some(s=>t>=s.start && Math.hypot(s.x-player.x,s.z-player.z)<3))mission.hurt();
  }
}
