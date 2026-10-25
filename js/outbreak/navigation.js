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
    const padding = 0.65 + cell / 2;
    for (const c of colliders) {
      if ((c.minY ?? 0) > 1.9 || (c.maxY ?? 10) < 0.4) continue;
      const x0 = Math.max(0, Math.floor((c.minX - padding - bounds.minX) / cell));
      const x1 = Math.min(this.width - 1, Math.floor((c.maxX + padding - bounds.minX) / cell));
      const z0 = Math.max(0, Math.floor((c.minZ - padding - bounds.minZ) / cell));
      const z1 = Math.min(this.height - 1, Math.floor((c.maxZ + padding - bounds.minZ) / cell));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.width + x] = 1;
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
  nearest(p, radius = 12) {
    const i = this.index(p);
    if (this.open(i)) return this.point(i);
    let best = null, dist = Infinity;
    for (let z = -radius; z <= radius; z += this.cell) for (let x = -radius; x <= radius; x += this.cell) {
      const j = this.index({ x: p.x + x, z: p.z + z });
      if (!this.open(j)) continue;
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
  clear(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (this.cell * 0.35)));
    for (let s = 0; s <= n; s++) {
      if (!this.open(this.index({ x: a.x + (b.x - a.x) * s / n, z: a.z + (b.z - a.z) * s / n }))) return false;
    }
    return true;
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
