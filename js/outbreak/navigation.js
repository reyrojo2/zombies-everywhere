// Bounded ground navigation. One reverse BFS is shared by the entire horde.
// Expanded obstacle boxes conservatively cover oriented colliders as well.
export class NavigationGrid {
  constructor(bounds, colliders, cell = 2) {
    this.bounds = bounds; this.cell = cell;
    this.width = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.height = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.width * this.height);
    this.cost = new Int32Array(this.blocked.length).fill(-1);
    this.queue = new Int32Array(this.blocked.length);
    this.addObstacles(colliders);
  }
  addObstacles(colliders) {
    const { cell, bounds } = this;
    const padding = 0.65 + cell / 2;
    for (const c of colliders) {
      if ((c.minY ?? 0) > 1.9 || (c.maxY ?? 10) < 0.4) continue;
      const x0 = Math.max(0, Math.floor((c.minX - padding - bounds.minX) / cell));
      const x1 = Math.min(this.width - 1, Math.floor((c.maxX + padding - bounds.minX) / cell));
      const z0 = Math.max(0, Math.floor((c.minZ - padding - bounds.minZ) / cell));
      const z1 = Math.min(this.height - 1, Math.floor((c.maxZ + padding - bounds.minZ) / cell));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const index = z * this.width + x;
        if (c.navigationObb) {
          const point = this.point(index), o = c.obb, dx = point.x - o.cx, dz = point.z - o.cz;
          if (Math.abs(dx * o.cs - dz * o.sn) > o.hx + padding || Math.abs(dx * o.sn + dz * o.cs) > o.hz + padding) continue;
        }
        this.blocked[index] = 1;
      }
    }
  }
  index(p) {
    const x = Math.floor((p.x - this.bounds.minX) / this.cell), z = Math.floor((p.z - this.bounds.minZ) / this.cell);
    return x < 0 || z < 0 || x >= this.width || z >= this.height ? -1 : z * this.width + x;
  }
  point(i) {
    return { x: this.bounds.minX + (i % this.width + 0.5) * this.cell,
      z: this.bounds.minZ + (Math.floor(i / this.width) + 0.5) * this.cell };
  }
  open(i) { return i >= 0 && i < this.blocked.length && !this.blocked[i]; }
  neighbors(i) {
    const x = i % this.width, result = [];
    if (x > 0) result.push(i - 1);
    if (x < this.width - 1) result.push(i + 1);
    if (i >= this.width) result.push(i - this.width);
    if (i + this.width < this.blocked.length) result.push(i + this.width);
    return result;
  }
  nearest(p, radius = 12, canUse = () => true) {
    const i = this.index(p);
    if (this.open(i) && canUse(i)) return this.point(i);
    let best = null, dist = Infinity;
    for (let z = -radius; z <= radius; z += this.cell) for (let x = -radius; x <= radius; x += this.cell) {
      const j = this.index({ x: p.x + x, z: p.z + z });
      if (!this.open(j) || !canUse(j)) continue;
      const q = this.point(j), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < dist) { best = q; dist = d; }
    }
    return best;
  }
  flood(target) {
    this.cost.fill(-1);
    const p = this.nearest(target);
    if (!p) return;
    const start = this.index(p);
    let head = 0, tail = 0;
    this.queue[tail++] = start; this.cost[start] = 0;
    while (head < tail) {
      const i = this.queue[head++];
      for (const j of this.neighbors(i)) if (this.open(j) && this.cost[j] < 0) {
        this.cost[j] = this.cost[i] + 1; this.queue[tail++] = j;
      }
    }
  }
  trace(position) {
    const start = this.nearest(position, 12, i => this.cost[i] >= 0);
    if (!start) return [];
    const points = [start];
    let i = this.index(start);
    while (this.cost[i] > 0) {
      i = this.neighbors(i).find(j => this.cost[j] === this.cost[i] - 1);
      points.push(this.point(i));
    }
    return points;
  }
  avoidShelter(site) {
    const sin = Math.sin(site.heading), cos = Math.cos(site.heading);
    for (let dz = -6; dz <= 6; dz += this.cell) for (let dx = -6; dx <= 6; dx += this.cell) {
      const index = this.index({ x: site.x + dx, z: site.z + dz });
      if (index < 0) continue;
      const p = this.point(index), x = p.x - site.x, z = p.z - site.z;
      const side = x * cos - z * sin, depth = x * sin + z * cos;
      if (Math.abs(side) <= 2.8 && depth >= -4.7 && depth <= .45) this.blocked[index] = 1;
    }
  }
  clear(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell * 0.35)));
    for (let s = 0; s <= n; s++) {
      if (!this.open(this.index({ x: a.x + (b.x - a.x) * s / n, z: a.z + (b.z - a.z) * s / n }))) return false;
    }
    return true;
  }
  path(position, target, limit = 12000) {
    const startPoint=this.nearest(position), endPoint=this.nearest(target);
    if(!startPoint || !endPoint)return [];
    const start=this.index(startPoint), end=this.index(endPoint);
    const parents=new Map([[start,-1]]), queue=[start]; let head=0;
    while(head<queue.length && head<limit && !parents.has(end)) {
      const i=queue[head++];
      for(const j of this.neighbors(i))if(this.open(j) && !parents.has(j)){parents.set(j,i);queue.push(j);}
    }
    if(!parents.has(end))return [];
    const result=[];for(let i=end;i!==-1;i=parents.get(i))result.push(this.point(i));
    return result.reverse();
  }
  step(position, target, amount) {
    const i = this.index(position);
    if (!this.open(i)) return position;
    let goal = target;
    if (!this.clear(position, target)) {
      let best = i;
      for (const j of this.neighbors(i)) if (this.cost[j] >= 0 && (this.cost[best] < 0 || this.cost[j] < this.cost[best])) best = j;
      if (best === i) return position;
      // Reach the cell centre before turning so corners cannot be cut.
      const centre = this.point(i), next = this.point(best);
      goal = this.clear(position, next) ? next : centre;
    }
    const d = Math.hypot(goal.x - position.x, goal.z - position.z);
    if (!d) return position;
    const f = Math.min(1, amount / d), p = { x: position.x + (goal.x - position.x) * f, z: position.z + (goal.z - position.z) * f };
    return this.clear(position, p) ? p : position;
  }
}


export function sitePoint(point, x, z) {
  const sin = Math.sin(point.heading), cos = Math.cos(point.heading);
  return { x: point.x + x * cos + z * sin, z: point.z - x * sin + z * cos };
}

// The shelter and its approach must share a curb island with no building collision.
export function shelterSite(nav, seed, surfaceAt, radius = 120) {
  return pedestrianSite(nav, seed, surfaceAt, { radius });
}

export function pedestrianSite(nav, seed, surfaceAt, {
  radius = 120, halfWidth = 2.55, depth = 4.45, approach = 4.1, facade = false
} = {}) {
  const candidates = [];
  const minX = Math.max(nav.bounds.minX + 6, seed.x - radius);
  const maxX = Math.min(nav.bounds.maxX - 6, seed.x + radius);
  const minZ = Math.max(nav.bounds.minZ + 6, seed.z - radius);
  const maxZ = Math.min(nav.bounds.maxZ - 6, seed.z + radius);
  for (let z = minZ; z <= maxZ; z += 2) for (let x = minX; x <= maxX; x += 2) {
    const i = nav.index({ x, z });
    if (!nav.open(i) || nav.cost[i] < 0) continue;
    const surface = surfaceAt(x, z);
    if (!surface) continue;
    const distance = Math.hypot(x - seed.x, z - seed.z);
    if (distance <= radius) candidates.push({ x, z, distance, surface });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  for (const { x, z, surface } of candidates) {
    for (let i = 0; i < 16; i++) {
      const gate = { x, z, heading: i * Math.PI / 8 };
      const at = (x, z) => sitePoint(gate, x, z);
      const inside = point => surfaceAt(point.x, point.z) === surface;
      const approaches = [-.9, 0, .9].every(x => {
        const front = at(x, approach);
        return [at(x, 0), at(x, 2), front].every(inside) && nav.clear(at(x, 0), front);
      });
      if (!approaches) continue;
      const fits = [-halfWidth, -halfWidth / 2, 0, halfWidth / 2, halfWidth].every(x => {
        const back = at(x, -depth), front = at(x, .3);
        return [back, at(x, -depth * .66), at(x, -depth * .33), front].every(inside) && nav.clear(back, front);
      });
      const backed = !facade || [-1.5, 0, 1.5].filter(x => !nav.open(nav.index(at(x, -depth - 2)))).length >= 2;
      if (fits && backed) return { ...gate, approach: at(0, approach - .7) };
    }
  }
  return null;
}
