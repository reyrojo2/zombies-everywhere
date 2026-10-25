import { PersonCrowd, PersonRig } from '../pedestrians.js';
import { distance } from './mission.js';
import { Population } from './population.js';
import { ZombieModels } from './zombie-model.js';

export class OutbreakActors {
  constructor(scene, nav, controller, config) {
    this.nav=nav; this.controller=controller; this.config=config;
    this.population=new Population(config);
    this.crowd=new PersonCrowd(config.civilianCount, { castShadow:false });
    this.crowd.meshes.forEach(m=>scene.add(m));
    this.models=new ZombieModels(scene,config.zombieCount+config.civilianCount);
    this.ground=(_owner,x,z)=>controller.getGroundHeight(x,z,'person');
    this.reset();
  }
  get actors() { return this.population.actors; }
  reset() {
    this.population.reset(); this.timer=0; this.time=0;
    this.crowd.begin(); this.crowd.end(); this.models.reset();
  }
  prepare() {
    this.reset();
    const {hospital,civilianCount}=this.config;
    for(let i=0;i<civilianCount;i++) {
      const p=this.nav.nearest({x:hospital.x+(i%4-1.5)*4,z:hospital.z+70-Math.floor(i/4)*17});
      if(!p) continue;
      const a=this.population.add(p);
      a.rig=new PersonRig({seed:2.8+i*.71,armSwing:1,stride:1,girth:.95});
    }
  }
  spawn() {
    const {hospital,zombieCount}=this.config;
    for(let i=0;i<zombieCount;i++) {
      let p=this.nav.nearest({x:hospital.x+(i%3-1)*5,z:hospital.z+(i<6?12+Math.floor(i/3)*7:-110-Math.floor(i/3)*12)});
      if(i===0) {
        const witness=this.actors.find(a=>a.civilian && distance(a,hospital)<25);
        const beside=witness && {x:witness.x+.9,z:witness.z};
        if(beside && this.nav.clear(witness,beside)) p=beside;
      }
      if(p) this.population.add(p,true);
    }
    this.population.activate();
  }
  update(dt,player,mission,civilianNav) {
    this.time+=dt; this.timer-=dt;
    const pos=player.position;
    if(this.population.active && this.timer<=0) { this.nav.flood(pos);this.timer=1; }
    this.population.update(dt,pos,(a,b)=>this.nav.clear(a,b),()=>{
      const y=this.ground(null,pos.x,pos.z); if(Math.abs(pos.y-y)<1.9) mission.hurt();
    });
    this.crowd.begin();
    for(const a of this.actors) {
      if(a.sheltered) continue;
      let target=null,speed=0,nav=this.nav;
      if(a.state==='zombie') { target=a.target;speed=this.config.zombieSpeed+(a.id%3)*.08; }
      else if(a.state==='fleeing') {
        target=this.config.shelter;speed=4.8;nav=civilianNav;
        if(a.threat && distance(a,a.threat)<6) {
          const d=Math.max(.01,distance(a,a.threat));
          const retreat={x:a.x+(a.x-a.threat.x)/d*5,z:a.z+(a.z-a.threat.z)/d*5};
          if(nav.clear(a,retreat)) target=retreat;
        }
      } else if(a.state==='normal') {
        target={x:a.x,z:a.z+Math.cos(this.time*.16+a.id)*2};speed=1.1;
      }
      if(target) {
        // Only direct, visible civilians are selected. Occluded pursuit uses the shared player field.
        const next=nav.step(a,target,speed*dt);
        if(distance(a,next)>.001) a.heading=Math.atan2(next.x-a.x,next.z-a.z);
        a.x=next.x;a.z=next.z;
      }
      if(a.civilian && a.state!=='turning') {
        a.rig.update(dt,a.x,a.z,a.heading,this.ground);this.crowd.add(a.rig,distance(a,pos));
      }
    }
    this.crowd.end();this.models.draw(this.actors,this.ground,this.time);
  }
}
