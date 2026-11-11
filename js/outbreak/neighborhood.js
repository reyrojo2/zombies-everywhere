import { distance } from './mission.js';

export function parkedCollider(point) {
  const cs = Math.cos(point.heading), sn = Math.sin(point.heading);
  const halfX = Math.abs(cs) * 1.17 + Math.abs(sn) * 3.2;
  const halfZ = Math.abs(sn) * 1.17 + Math.abs(cs) * 3.2;
  return { minX: point.x - halfX, maxX: point.x + halfX, minZ: point.z - halfZ, maxZ: point.z + halfZ,
    minY: 0, maxY: 2.8,
    obb: { cx: point.x, cz: point.z, hx: 1.17, hz: 3.2, cs, sn } };
}

export function roadsidePoint(network, seed, nav, canUse = () => true) {
  const sites = [];
  for (const edge of network?.edges || []) {
    if (edge.len < 26) continue;
    const along = Math.max(10, Math.min(edge.len - 10, (seed.x - edge.sx) * edge.dx + (seed.z - edge.sz) * edge.dz));
    const offset = Math.min(edge.half - 1.25, Math.max(...edge.lanes) + .4);
    const point = { x: edge.sx + edge.dx * along + edge.rx * offset, z: edge.sz + edge.dz * along + edge.rz * offset,
      heading: Math.atan2(edge.dx, edge.dz) };
    if (nav.clear(point, { x: point.x + edge.dx * 4, z: point.z + edge.dz * 4 })) sites.push(point);
  }
  return sites.sort((a, b) => distance(a, seed) - distance(b, seed)).find(canUse) || null;
}

// Stable residents and reusable sidewalk positions. Scene events use these same actors.
export class Neighborhood {
  constructor(config, nav, surfaceAt, route) {
    this.config = config;
    this.points = [];
    for (let i = 0; i < nav.blocked.length; i += 2) {
      if (!nav.open(i) || nav.cost[i] < 0) continue;
      const p = nav.point(i);
      if (surfaceAt(p.x, p.z)) this.points.push(p);
    }
    this.route = route;
    const sample = route[Math.min(route.length - 1, 18)] || config.spawn;
    this.caseSite = this.closest(sample);
    this.stop = this.closest(route[Math.floor(route.length * .33)] || config.pharmacy);
    this.delivery = this.closest(route[Math.floor(route.length * .65)] || config.pharmacy);
  }
  closest(point, exclude = () => false) {
    let best = null, nearest = Infinity;
    for (const p of this.points) {
      const d = distance(p, point);
      if (d < nearest && !exclude(p)) { best = p; nearest = d; }
    }
    return best || point;
  }
  populate(population, nav) {
    const used = new Set();
    const add = (point, role = 'walker') => {
      const p = this.closest(point, p => used.has(nav.index(p)));
      used.add(nav.index(p));
      const a = population.add(p);
      a.home = { ...p };
      a.role = role;
      a.heading = (a.id * 2.39996) % (Math.PI * 2);
      a.routeChoice = a.id;
      a.destination = this.closest({ x: p.x + Math.sin(a.heading) * 18, z: p.z + Math.cos(a.heading) * 18 });
      return a;
    };
    const patient = add(this.caseSite, 'patient');
    const helper = add({ x: patient.x + 2, z: patient.z }, 'helper');
    helper.helping = patient;
    add(this.delivery, 'delivery');
    for (let i = 0; i < 5; i++) add({ x: this.stop.x + i * 2, z: this.stop.z }, 'waiting');
    const near = this.points.filter(p => distance(p, this.config.spawn) < 75)
      .sort((a, b) => distance(a, this.config.spawn) - distance(b, this.config.spawn));
    const front = near.filter(p => {
      const dx = p.x - this.config.spawn.x, dz = p.z - this.config.spawn.z;
      const d = distance(p, this.config.spawn);
      return d > 7 && d < 50 && nav.clear(this.config.spawn, p) &&
        Math.sin(this.config.spawn.heading || 0) * dx + Math.cos(this.config.spawn.heading || 0) * dz > d * .3;
    });
    const corridor = this.points.filter(p => this.route.some((q, i) => i % 12 === 0 && distance(p, q) < 36));
    for (let i = population.actors.length; i < this.config.civilianCount; i++) {
      const pool = i < 24 && front.length ? front : i < 38 && near.length ? near :
        i < this.config.civilianCount * .7 && corridor.length ? corridor : this.points;
      const point = pool[(i * 37) % pool.length] || this.config.spawn;
      add(point, i % 9 === 0 ? 'neighbor' : 'walker');
    }
    patient.wounded = true;
    return { patient, helper };
  }
  recycle(actor, player, visible, nav, time) {
    if (actor.role !== 'walker' || actor.state !== 'normal' || actor.wounded || distance(actor, player) < 155 || visible(actor)) return false;
    const candidates = [];
    for (let i = 0; i < Math.min(80, this.points.length); i++) {
      const p = this.points[(actor.id * 37 + Math.floor(time) * 13 + i * 71) % this.points.length];
      const d = distance(p, player);
      if (d > 80 && d < 135 && !visible(p)) candidates.push(p);
    }
    if (!candidates.length) return false;
    const p = candidates[(actor.id * 37 + Math.floor(time / 12)) % candidates.length];
    actor.x = p.x; actor.z = p.z; actor.home = { ...p };
    actor.destination = this.closest({ x: p.x + 12, z: p.z - 12 });
    actor.path = null;
    if (actor.rig) actor.rig.placed = false;
    return true;
  }
}
