import { distance } from './mission.js';

// A bounded event buffer: noises reveal their origin, never the player's live position.
export class NoiseField {
  constructor() { this.events = []; }
  emit(position, radius, duration = 2) {
    this.events.push({ x: position.x, z: position.z, radius, remaining: duration });
    if (this.events.length > 24) this.events.shift();
  }
  tick(dt) { this.events = this.events.filter(e => (e.remaining -= dt) > 0); }
  hear(actor, clear) {
    let best = null, score = 0;
    for (const e of this.events) {
      const d = distance(actor,e);
      if(d>=e.radius) continue;
      const radius = e.radius * (clear(actor, e) ? 1 : .3);
      const strength = 1 - d / radius;
      if (strength > score) { score = strength; best = e; }
    }
    return best;
  }
}

export function sees(actor, target, clear) {
  const d = distance(actor, target), deterioration = Math.min(1, (actor.infectedAge || 0) / 150);
  if (d > 32 - deterioration * 22 || !clear(actor, target)) return false;
  if (d < 3) return true;
  const facing = (Math.sin(actor.heading) * (target.x - actor.x) + Math.cos(actor.heading) * (target.z - actor.z)) / d;
  return facing > .25 + deterioration * .25;
}

export class SpatialGrid {
  constructor(actors, cell = 4) {
    this.cell = cell; this.cells = new Map();
    for (const a of actors) {
      const key = this.key(a.x, a.z);
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(a);
    }
  }
  key(x,z) { return `${Math.floor(x/this.cell)},${Math.floor(z/this.cell)}`; }
  nearby(a) {
    const result = [], x = Math.floor(a.x/this.cell), z = Math.floor(a.z/this.cell);
    for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) result.push(...(this.cells.get(`${x+dx},${z+dz}`) || []));
    return result;
  }
}
