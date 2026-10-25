import { distance } from './mission.js';

// Pure outbreak rules. Actors change allegiance in place; contagion never adds entities.
export class Population {
  constructor(config) { this.config = config; this.reset(); }
  reset() { this.actors = []; this.infections = 0; this.active = false; this.decisionTime = 0; }
  add(point, zombie = false) {
    const a = { ...point, id: this.actors.length, state: zombie ? 'zombie' : 'normal', civilian: !zombie,
      hunter: zombie && this.actors.length%3!==0, heading: Math.PI, timer: 0, attackTimer: 0, target: null, sheltered: false };
    this.actors.push(a); return a;
  }
  activate() { this.active = true; }
  infect(a) {
    if (!['normal', 'fleeing'].includes(a.state) || a.sheltered) return false;
    a.state = 'bitten'; a.timer = this.config.incubationSeconds; this.infections++; return true;
  }
  update(dt, player, clear, hurt) {
    if (!this.active) return;
    this.decisionTime -= dt;
    const decide = this.decisionTime <= 0;
    if (decide) this.decisionTime = 0.2;
    const zombies = this.actors.filter(a => a.state === 'zombie');
    for (const a of this.actors) {
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
        if (a.state === 'fleeing' && distance(a, this.config.shelter) < 7) a.sheltered = true;
        continue;
      }
      let target = player, best = distance(a, player);
      const prefersPlayer=a.hunter || best<28;
      for (const civilian of this.actors) {
        if (!['normal', 'fleeing'].includes(civilian.state) || civilian.sheltered) continue;
        const d = distance(a, civilian);
        if ((!prefersPlayer || d<1.4) && d < best && clear(a, civilian)) { target = civilian; best = d; }
      }
      a.target = best < (a.hunter ? 120 : 85) ? target : null;
      if (best < 1.4 && clear(a, target) && a.attackTimer === 0) {
        if (target === player) hurt(); else this.infect(target);
        a.attackTimer = this.config.attackCooldown;
      }
    }
  }
}
