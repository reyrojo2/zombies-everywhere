import { distance } from './mission.js';
import { NoiseField, sees } from './perception.js';

// Pure outbreak rules. Actors change allegiance in place; contagion never adds entities.
export class Population {
  constructor(config) { this.config = config; this.reset(); }
  reset() { this.actors = []; this.infections = 0; this.active = false; this.decisionTime = 0; this.noise = new NoiseField(); }
  add(point, zombie = false) {
    const a = { ...point, id: this.actors.length, state: zombie ? 'zombie' : 'normal', civilian: !zombie,
      hunter: zombie && this.actors.length%3!==0, heading: Math.PI, timer: 0, infectedAge: 0, memoryTime: 0, windup: 0, attackTimer: 0, target: null, sheltered: false };
    this.actors.push(a); return a;
  }
  activate() { this.active = true; }
  infect(a) {
    if (!['normal', 'fleeing'].includes(a.state) || a.sheltered) return false;
    a.wounded = true; a.state = 'bitten'; a.timer = this.config.incubationSeconds; this.infections++; return true;
  }
  update(dt, player, clear, hurt) {
    this.noise.tick(dt);
    if (!this.active) return;
    this.decisionTime -= dt;
    const decide = this.decisionTime <= 0;
    if (decide) this.decisionTime = 0.2;
    const zombies = this.actors.filter(a => a.state === 'zombie');
    for (const a of this.actors) {
      a.memoryTime = Math.max(0, a.memoryTime - dt);
      if(a.state === 'zombie') a.infectedAge += dt;
      a.attackTimer = Math.max(0, a.attackTimer - dt);
      if (a.state === 'bitten' || a.state === 'turning') {
        a.timer -= dt;
        if (a.timer <= 0) {
          if (a.state === 'bitten') { a.state = 'turning'; a.timer = this.config.turningSeconds; }
          else { a.state = 'zombie'; a.civilian = false; a.hunter = true; a.target = null; }
        }
        continue;
      }
      if (a.sheltered || !decide) continue;
      if (a.civilian) {
        a.threat = zombies.find(z => distance(a, z) < 26 && clear(a, z));
        if (a.threat) a.state = 'fleeing';
        // Exit/re-entry is managed by the crowd director, not a single shared destination.
        continue;
      }
      let target = sees(a, player, clear) ? player : null;
      let best = target ? distance(a, target) : Infinity;
      for (const civilian of this.actors) {
        if (!['normal', 'fleeing'].includes(civilian.state) || civilian.sheltered) continue;
        const d = distance(a, civilian);
        if (d < best && sees(a, civilian, clear)) { target = civilian; best = d; }
      }
      if (target) {
        a.lastKnown = { x: target.x, z: target.z }; a.memoryTime = 7;
      } else {
        const heard = this.noise.hear(a, clear);
        if(heard) { a.lastKnown = {x:heard.x,z:heard.z}; a.memoryTime=7; }
      }
      a.target = a.memoryTime > 0 ? a.lastKnown : null;
      // Telegraph a bite; leaving reach or breaking sight cancels it.
      if (target && best < 1.4 && a.attackTimer === 0) {
        if(a.biteTarget !== target) { a.biteTarget=target; a.windup=0; }
        a.windup += .2;
        if(a.windup >= .8) {
          if (target === player) hurt(); else this.infect(target);
          a.attackTimer = this.config.attackCooldown; a.windup=0;
        }
      } else { a.windup=0; a.biteTarget=null; }

    }
  }
}
