import * as THREE from 'three/webgpu';

export class PhoneSequence {
  constructor(scene,cameraSystem) {
    this.cameraSystem=cameraSystem;this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;
    const material=color=>new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,toneMapped:false});
    const box=(size,pos,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.renderOrder=10010;this.group.add(m);return m;};
    box([.265,.51,.025],[0,0,0],material(0x11161c));
    box([.08,.28,.06],[.13,-.21,-.01],material(0xbb947d));
    box([.065,.34,.055],[.08,-.40,-.02],material(0x394852));
    this.canvas=document.createElement('canvas');this.canvas.width=512;this.canvas.height=1024;this.ctx=this.canvas.getContext('2d');
    this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(.239,.465),new THREE.MeshBasicMaterial({map:this.texture,depthTest:false,depthWrite:false,toneMapped:false}));screen.position.z=.014;screen.renderOrder=10011;this.group.add(screen);
    this.open=false;this.last=-1;
  }
  update(mission,t) {
    const visible=mission.phase==='phone' && (!mission.phoneAnswered || mission.callTime<1.5);this.group.visible=visible;
    if(visible!==this.open){this.open=visible;}
    if(!visible)return;
    const camera=this.cameraSystem.camera;camera.updateMatrixWorld();
    const raise=mission.phoneAnswered?Math.max(0,1-mission.callTime/1.5):1;
    this.group.position.set(.28,-.18-(1-raise)*.6,-.82).applyMatrix4(camera.matrixWorld);this.group.quaternion.copy(camera.quaternion);
    if(Math.abs(mission.time-this.last)<.08 && this.label===t('wife'))return;this.last=mission.time;this.label=t('wife');
    const c=this.ctx;c.fillStyle='#142a38';c.fillRect(0,0,512,1024);
    c.fillStyle='#d4e2e8';c.font='24px sans-serif';c.fillText('09:41',30,45);c.fillText('LTE  ▰',390,45);
    c.fillStyle='#944237';c.fillRect(20,80,472,115);c.fillStyle='#fff';c.font='22px sans-serif';
    c.fillText(t('phoneAlert'),38,120);c.font='19px sans-serif';c.fillText(t('phoneAlertDetail'),38,159);
    c.fillStyle='#527c8c';c.beginPath();c.arc(256,310,75,0,Math.PI*2);c.fill();
    c.fillStyle='#e9e8df';c.font='bold 40px sans-serif';c.textAlign='center';c.fillText(t('wife'),256,455);
    c.font='24px sans-serif';c.fillText(t(mission.phoneAnswered?'phoneConnected':'phoneIncoming'),256,515);
    if(mission.phoneAnswered){c.font='26px monospace';c.fillText('00:'+String(Math.floor(mission.callTime)).padStart(2,'0'),256,563);
      c.strokeStyle='#7fd1bb';c.lineWidth=4;c.beginPath();for(let x=60;x<452;x+=3){const y=650+Math.sin(x*.08+mission.time*8)*Math.sin(x*.027)*25;x===60?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
    }
    c.fillStyle=mission.phoneAnswered?'#ad4944':'#39ad7a';c.beginPath();c.arc(256,817,55+(mission.phoneAnswered?0:Math.sin(mission.time*5)*4),0,Math.PI*2);c.fill();
    c.fillStyle='#fff';c.font='bold 26px sans-serif';c.fillText(mission.phoneAnswered?'●':t('answer'),256,915);c.textAlign='left';this.texture.needsUpdate=true;
  }
}
