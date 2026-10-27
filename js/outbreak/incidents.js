import * as THREE from 'three/webgpu';

export class OutbreakIncidents {
  constructor(scene,config) {
    this.config=config;this.group=new THREE.Group();scene.add(this.group);
    this.carA=this.car(0x89362e);this.carB=this.car(0xb7b1a5);this.police=this.car(0x17232d,true);
    this.officers=[this.officer(),this.officer()];
    this.flames=[];this.smoke=[];
    const fireMat=new THREE.MeshBasicMaterial({color:0xff671e,transparent:true,opacity:.85});
    const smokeMat=new THREE.MeshBasicMaterial({color:0x272a2c,transparent:true,opacity:.32,depthWrite:false});
    this.sites=config.fireSites;
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
    this.time=mission.streetTime ?? mission.time;
    const t=this.time,site=this.sites[0],heading=site.heading??0,dx=Math.sin(heading),dz=Math.cos(heading),gap=Math.max(0,(site.start-t)*9);
    // Bounded directed collision: two cars approach and remain wrecked after impact.
    this.crashed=t>=this.sites[0].start;
    this.carA.visible=this.carB.visible=true;
    this.carA.position.set(site.x+dx*gap,0,site.z+dz*gap);
    this.carB.position.set(site.x-dx*(gap+3)+dz*2,0,site.z-dz*(gap+3)-dx*2);
    this.carA.rotation.y=heading+(this.crashed?.65:Math.PI);
    this.carB.rotation.y=heading+(this.crashed?-1.1:0);
    this.police.visible=t>=7;
    const radio=this.config.radio;
    this.police.position.set(radio.x,0,radio.z+Math.max(0,100-Math.max(0,t-7)*10));
    this.police.rotation.y=Math.PI;
    for(const {site,a,b} of this.pileups){
      const elapsed=t-site.start,gap=Math.max(0,-elapsed*12),h=site.heading??0,dx=Math.sin(h),dz=Math.cos(h);a.visible=b.visible=elapsed>=-3;
      a.position.set(site.x+dx*gap,0,site.z+dz*gap);b.position.set(site.x-dx*(gap+2)+dz*2,0,site.z-dz*(gap+2)-dx*2);
      a.rotation.y=h+(elapsed>=0?.7:Math.PI);b.rotation.y=h+(elapsed>=0?-1.2:0);
    }
    const burning=this.sites.filter(s=>t>=s.start).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
    this.fireLights.forEach((light,i)=>{const s=burning[i];light.intensity=s?45+Math.sin(t*9+i)*12:0;if(s)light.position.set(s.x,2.5,s.z);});
    this.officers.forEach((officer,i)=>{
      officer.visible=t>=17;
      const exit=Math.min(1,Math.max(0,t-17)/3);
      officer.position.set(radio.x-exit*(3+i*2),0,radio.z+exit*(4+i*2));
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
