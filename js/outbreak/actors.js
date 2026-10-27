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
    this.models=new ZombieModels(scene,config.zombieCount+config.civilianCount+config.reinforcementCount);
    this.ground=(_owner,x,z)=>controller.getGroundHeight(x,z,'person');
    this.reset();
  }
  get actors() { return this.population.actors; }
  reset() {
    this.population.reset(); this.timer=0; this.time=0; this.wave=0;this.seeded=0;this.spawned=false;
    this.crowd.begin(); this.crowd.end(); this.models.reset();
  }
  prepare() {
    this.reset();
    const {hospital,civilianCount}=this.config;
    for(let i=0;i<civilianCount;i++) {
      const anchors=this.config.crowdAnchors || [hospital];
      const anchor=anchors[i%anchors.length];
      const angle=i*2.39996,radius=4+Math.floor(i/anchors.length)*2;
      const p=this.nav.nearest({x:anchor.x+Math.cos(angle)*radius,z:anchor.z+Math.sin(angle)*radius},25);
      if(!p) continue;
      const a=this.population.add(p);
      a.home={...p};a.panicAt=2+(i%17)*2.3;a.stayUntil=28+(i%9)*4;
      a.rig=new PersonRig({seed:2.8+i*.71,armSwing:1,stride:1,girth:.95});
    }
  }
  seed(count,nearPlayer=null) {
    const anchors=this.config.crowdAnchors || [this.config.hospital];
    for(let i=0;i<count && this.seeded<this.config.zombieCount;i++) {
      const n=this.seeded++,source=anchors[(n*3+2)%anchors.length];
      const p=this.nav.nearest({x:source.x+(n%3-1)*4,z:source.z+6},25);
      if(p && (!nearPlayer || distance(p,nearPlayer)>10)) this.population.add(p,true);
    }
    this.population.activate();
  }
  spawn() {
    if(this.spawned)return;
    this.spawned=true;this.seed(this.config.zombieCount-this.seeded);
  }
  update(dt,player,mission,civilianNav,routes=[{nav:civilianNav,goal:this.config.shelter}]) {
    this.time+=dt; this.timer-=dt;
    const pos=player.position,streetTime=mission.streetTime ?? mission.time;
    // A few frightened residents immediately; individual reactions spread before the full outbreak.
    const required=streetTime>=30?6:streetTime>=18?3:streetTime>=9?1:0;
    if(this.seeded<required)this.seed(required-this.seeded,pos);
    for(const a of this.actors)if(a.state==='normal' && streetTime>=a.panicAt)a.state='fleeing';
    if(mission.phase==='escape' && this.wave<4 && mission.time >= 7+this.wave*9) {
      const wave=this.wave++;
      const source=(this.config.crowdAnchors || [this.config.hospital])[(wave*2+3)%(this.config.crowdAnchors?.length || 1)];
      for(let i=0;i<4;i++) {
        const p=this.nav.nearest({x:source.x+i*3,z:source.z});
        if(p && distance(p,pos)>22 && civilianNav.cost[civilianNav.index(p)]>=0) this.population.add(p,true);
      }
    }
    if(this.population.active && this.timer<=0) { this.nav.flood(pos);this.timer=1; }
    this.population.update(dt,pos,(a,b)=>this.nav.clear(a,b),()=>{
      const y=this.ground(null,pos.x,pos.z); if(Math.abs(pos.y-y)<1.9) mission.hurt();
    });
    const snapshot=this.actors.filter(a=>!a.sheltered).map(a=>({id:a.id,x:a.x,z:a.z}));
    this.crowd.begin();
    for(const a of this.actors) {
      if(a.sheltered) continue;
      let target=null,speed=0,nav=this.nav;
      if(a.state==='zombie') { target=a.target;speed=this.config.zombieSpeed+(a.id%3)*.08; }
      else if(a.state==='fleeing') {
        const route=routes[a.id%routes.length];
        nav=route.nav;target=route.goal;speed=4.3+(a.id%6)*.28;
        if(nav.cost[nav.index(a)]<0){nav=civilianNav;target=this.config.shelter;}
        if(distance(a,target)<5){
          if(streetTime<a.stayUntil){a.state='normal';a.panicAt=streetTime+4;continue;}
          // Re-enter through another street so the neighborhood does not empty at once.
          const entry=this.config.crowdAnchors?.[(a.id+Math.floor(streetTime/12))%this.config.crowdAnchors.length];
          const p=entry && distance(a,pos)>65 && distance(entry,pos)>65 && this.nav.nearest(entry,20);
          if(p){a.x=p.x;a.z=p.z;a.stayUntil=streetTime+25;}else {a.state='normal';a.panicAt=streetTime+3;}
          continue;
        }
        if(a.threat && distance(a,a.threat)<6) {
          const d=Math.max(.01,distance(a,a.threat));
          const retreat={x:a.x+(a.x-a.threat.x)/d*5,z:a.z+(a.z-a.threat.z)/d*5};
          if(nav.clear(a,retreat)) target=retreat;
        }
      } else if(a.state==='normal') {
        target={x:a.home.x+Math.cos(this.time*.08+a.id)*5,z:a.home.z+Math.sin(this.time*.08+a.id)*5};speed=1.0+(a.id%4)*.12;
      }
      if(target) {
        // Only direct, visible civilians are selected. Occluded pursuit uses the shared player field.
        let next=nav.step(a,target,speed*dt);
        if(a.civilian) {
          let dx=0,dz=0;
          for(const other of snapshot)if(other.id!==a.id){const d=distance(a,other);if(d>.02 && d<1.4){dx+=(a.x-other.x)/d*(1.4-d);dz+=(a.z-other.z)/d*(1.4-d);}}
          const separated={x:next.x+dx*dt*2,z:next.z+dz*dt*2};
          if(nav.clear(a,separated))next=separated;
        }
        if(distance(a,next)>.001) a.heading=Math.atan2(next.x-a.x,next.z-a.z);
        a.x=next.x;a.z=next.z;
      }
      if(a.civilian && a.state!=='turning' && distance(a,pos)<220) {
        a.rig.update(dt,a.x,a.z,a.heading,this.ground);this.crowd.add(a.rig,distance(a,pos));
      }
    }
    this.crowd.end();this.models.draw(this.actors,this.ground,this.time);
  }
}
