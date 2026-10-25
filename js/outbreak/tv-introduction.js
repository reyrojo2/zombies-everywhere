import * as THREE from 'three/webgpu';

// An actual room and television rendered in the same canvas, not a DOM news dialog.
export class TVIntroduction {
  constructor() {
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x10151c);
    this.camera=new THREE.PerspectiveCamera(48,1,.05,30);
    this.scene.add(new THREE.HemisphereLight(0xadc6e0,0x33271d,2));
    const lamp=new THREE.PointLight(0xffcf9c,20,12);lamp.position.set(-2,3,1);this.scene.add(lamp);
    const box=(size,pos,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(...pos);this.scene.add(m);return m;};
    box([9,5,.2],[0,2,-3.2],0x424745);box([9,.15,10],[0,-.1,0],0x3e332b);
    box([.2,5,10],[-4.5,2,0],0x353b3c);box([3.8,.65,.8],[0,.38,-2.65],0x33261e);
    box([3.25,1.95,.18],[0,1.85,-2.95],0x0b0d10);
    box([1.8,.6,1.6],[-2,.35,1.6],0x293b43);box([.4,1,1.7],[-2.8,.85,1.6],0x293b43);
    box([1.8,.13,1],[.8,.55,1],0x352920);box([.08,.55,.08],[.1,.2,.7],0x352920);
    box([.23,.25,.23],[1,.75,1],0xd5cdb8);
    const window=box([1.6,2,.05],[3,2,-3.05],0x7090a2);
    for(let i=0;i<5;i++)box([.17,.4+i*.12,.04],[2.4+i*.28,1.5,-2.99],0x283c4d);
    box([.05,2,.08],[3,2,-2.95],0x242c2e);box([1.6,.05,.08],[3,2,-2.95],0x242c2e);
    this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=576;
    this.ctx=this.canvas.getContext('2d');this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.screen=new THREE.Mesh(new THREE.PlaneGeometry(3.05,1.72),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));
    this.screen.position.set(0,1.85,-2.845);this.scene.add(this.screen);
    this.light=new THREE.PointLight(0x98c9ff,3,5);this.light.position.set(0,1.85,-2.5);this.scene.add(this.light);
    this.last=-Infinity;this.lastText='';
  }
  draw(time,text,label) {
    const es=label.includes('CANAL');
    const c=this.ctx,w=1024,h=576,index=Math.min(2,Math.floor(time/14));
    c.fillStyle='#112a42';c.fillRect(0,0,w,h);
    c.fillStyle='#1b4564';for(let i=0;i<7;i++)c.fillRect(i*180-(time*12%180),40,100,340);
    // Newsroom, desk and animated anchor: blinks, speech mouth and hand motion.
    c.fillStyle='#294b62';c.fillRect(45,60,390,320);
    c.fillStyle='#15202e';c.beginPath();c.ellipse(238,282,100,113,0,0,Math.PI*2);c.fill();
    c.fillStyle='#be9177';c.beginPath();c.ellipse(238,165,52,65,0,0,Math.PI*2);c.fill();
    c.fillStyle='#22252b';c.beginPath();c.ellipse(235,119,54,30,0,Math.PI,Math.PI*2);c.fill();
    c.fillStyle='#23252a';const blink=time%4.1>.16?5:1;c.fillRect(213,159,13,blink);c.fillRect(251,159,13,blink);
    c.fillStyle='#6b3834';c.beginPath();c.ellipse(238,197,14,3+Math.abs(Math.sin(time*12))*8,0,0,Math.PI*2);c.fill();
    c.fillStyle='#b78b73';c.fillRect(150,316+Math.sin(time*2)*4,42,15);c.fillRect(285,316,42,15);
    c.fillStyle='#78939f';c.fillRect(34,346,405,42);
    // Alternating studio/field shots, with different footage for each bulletin.
    const wide=Math.floor(time/5)%2===1;
    if(wide){c.fillStyle='#102131';c.fillRect(20,55,984,335);}
    c.save();c.translate(wide?30:468,65);c.scale(wide?1.85:1,1);
    c.fillStyle='#17212b';c.fillRect(0,0,510,320);
    if(index===0) {
      c.fillStyle='#71818a';c.fillRect(82,46,345,190);c.fillStyle='#c2d6dd';c.fillRect(212,86,70,12);c.fillRect(242,61,12,62);
      for(let x=102;x<422;x+=55)for(let y=146;y<225;y+=35){c.fillStyle='#223d50';c.fillRect(x,y,25,19);}
      const x=35+(time*18%300);c.fillStyle='#dddcd2';c.fillRect(x,251,110,38);
      c.fillStyle=Math.floor(time*7)%2?'#df514c':'#489bff';c.fillRect(x+30,242,35,10);
    } else if(index===1) {
      c.fillStyle='#374655';
      for(let i=0;i<8;i++)c.fillRect(i*70,70+(i%3)*30,55,190);
      for(let i=0;i<4;i++){
        c.fillStyle='#df7d3b';c.beginPath();c.moveTo(65+i*110,280);c.lineTo(80+i*110+Math.sin(time*6+i)*8,210);c.lineTo(102+i*110,280);c.fill();
        c.fillStyle='#6a6e75';c.beginPath();c.ellipse(80+i*110+(time*6)%50,180-(time*17+i*35)%90,24,40,0,0,Math.PI*2);c.fill();
      }
      c.fillStyle='#e0b45d';c.font='16px sans-serif';c.fillText(es?'IMÁGENES SIN VERIFICAR':'UNVERIFIED FOOTAGE',30,305);
    } else {
      c.fillStyle='#314e5e';
      for(const [x,y,w,h] of [[25,75,120,95],[110,180,55,100],[230,80,200,90],[250,170,65,110],[400,230,70,50]])c.fillRect(x,y,w,h);
      for(const [x,y] of [[85,120],[310,120],[265,180],[425,255]]){c.strokeStyle='#e75a4f';c.lineWidth=3;c.beginPath();c.arc(x,y,5+(time*5)%22,0,Math.PI*2);c.stroke();}
      c.strokeStyle='#b58b61';c.setLineDash([7,5]);c.beginPath();c.moveTo(85,120);c.lineTo(310,120);c.lineTo(425,255);c.stroke();c.setLineDash([]);
    }
    c.fillStyle='#fff';c.font='bold 22px sans-serif';c.fillText((es?['CHINA / ARCHIVO','REPORTES SIN VERIFICAR','ALERTA INTERNACIONAL']:['CHINA / ARCHIVE','UNVERIFIED REPORTS','INTERNATIONAL ALERT'])[index],18,32);
    c.restore();
    c.fillStyle='#ad302f';c.fillRect(0,0,1024,40);c.font='bold 21px sans-serif';c.fillStyle='#fff';c.fillText(label,24,28);
    c.fillStyle='#ddd';c.font='18px monospace';c.fillText((es?['12 ENE 2020','26 ENE 2020','03 FEB 2020']:['12 JAN 2020','26 JAN 2020','03 FEB 2020'])[index],806,28);
    c.fillStyle='#a72829';c.fillRect(0,398,w,44);c.fillStyle='#fff';c.font='bold 24px sans-serif';c.fillText(es?'ZE / INFORMATIVO':'ZE / WORLD NEWS',24,429);
    c.fillStyle='#0a131d';c.fillRect(0,442,w,134);c.fillStyle='#fff';c.font='24px sans-serif';
    let line='',y=474;
    for(const word of text.split(' ')){if(c.measureText(line+word).width>950){c.fillText(line,24,y);line='';y+=30;}line+=word+' ';}c.fillText(line,24,y);
    c.fillStyle='#ffffff09';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
    const transition=time%14;if(transition<.25 && time>1){c.fillStyle='#b5bec966';for(let i=0;i<30;i++)c.fillRect(0,(i*37+time*800)%576,1024,3);}
    this.texture.needsUpdate=true;
  }
  render(renderer,mission,t) {
    if(mission.time-this.last>.065 || mission.time<this.last || this.lastText!==t('bulletin'+Math.min(2,Math.floor(mission.time/14)))) {
      const text=t('bulletin'+Math.min(2,Math.floor(mission.time/14)));this.draw(mission.time,text,t('news'));this.last=mission.time;this.lastText=text;
    }
    const size=renderer.getSize(new THREE.Vector2());this.camera.aspect=size.x/size.y;this.camera.updateProjectionMatrix();
    const approach=Math.min(1,mission.time/6);
    this.camera.position.set(.8*(1-approach),1.9,2.2-approach*1.7);this.camera.lookAt(0,1.75,-2.9);
    renderer.render(this.scene,this.camera);
  }
}
