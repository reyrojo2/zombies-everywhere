import { PersonCrowd, PersonRig } from '../pedestrians.js';
import { distance } from './mission.js';
import { Population } from './population.js';
import { streetZ } from '../city-config.js';
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
    this.population.reset(); this.timer=0; this.time=0; this.wave=0;
    this.crowd.begin(); this.crowd.end(); this.models.reset();
  }
  prepare() {
    this.reset();
    const {hospital,civilianCount}=this.config;
    for(let i=0;i<civilianCount;i++) {
      const clusters=[[-18,-100],[-18,-185],[25,-165],[-90,-165],[65,-245],[-170,-245]];
      const [x,z]=clusters[i%clusters.length];
      const p=this.nav.nearest({x:x+(Math.floor(i/6)%3-1)*3,z:z+(Math.floor(i/18)-1)*3});
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
    for(const a of this.actors) if(a.civilian) a.state='fleeing';
  }
  update(dt,player,mission,civilianNav,routes=[{nav:civilianNav,goal:this.config.shelter}]) {
    this.time+=dt; this.timer-=dt;
    const pos=player.position;
    if(this.population.active && this.wave<4 && mission.time >= 7+this.wave*9) {
      const wave=this.wave++;
      const source={x:wave%2 ? 45 : -45,z:streetZ(44+wave)};
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
        if(distance(a,target)<5){a.sheltered=true;continue;}
        if(a.threat && distance(a,a.threat)<6) {
          const d=Math.max(.01,distance(a,a.threat));
          const retreat={x:a.x+(a.x-a.threat.x)/d*5,z:a.z+(a.z-a.threat.z)/d*5};
          if(nav.clear(a,retreat)) target=retreat;
        }
      } else if(a.state==='normal') {
        target=a.id%2 ? {x:a.x+Math.cos(this.time*.18+a.id)*2,z:a.z} : {x:a.x,z:a.z+Math.cos(this.time*.16+a.id)*2};speed=1.0+(a.id%4)*.12;
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
      if(a.civilian && a.state!=='turning') {
        a.rig.update(dt,a.x,a.z,a.heading,this.ground);this.crowd.add(a.rig,distance(a,pos));
      }
    }
    this.crowd.end();this.models.draw(this.actors,this.ground,this.time);
  }
}
