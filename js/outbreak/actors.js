import { PersonCrowd, PersonRig } from '../pedestrians.js';
import { distance } from './mission.js';
import { Population } from './population.js';
import { SpatialGrid } from './perception.js';

export class OutbreakActors {
  constructor(scene, nav, controller, config, neighborhood) {
    this.nav = nav; this.controller = controller; this.config = config;
    this.neighborhood = neighborhood;
    this.population = new Population(config);
    this.crowd = new PersonCrowd(config.civilianCount + config.zombieCount + config.reinforcementCount, { castShadow: false });
    this.crowd.meshes.forEach(mesh => scene.add(mesh));
    this.ground = (_owner, x, z) => controller.getGroundHeight(x, z, 'person');
    this.reset();
  }
  get actors() { return this.population.actors; }
  reset() {
    this.population.reset(); this.time = 0; this.wave = 0; this.seeded = 0;
    this.spawned = false; this.caseStarted = false; this.noiseTimer = 0; this.recycleAt = 0; this.recycleCursor = 0;
    this.activeAt = 0; this.activeActors = []; this.activeIds = new Set(); this.event = null;
    this.crowd.begin(); this.crowd.end();
  }
  prepare() {
    this.reset();
    this.witnesses = this.neighborhood.populate(this.population, this.nav);
  }
  ensureRig(a) {
    if (!a.rig) a.rig = new PersonRig({ seed: 2.8 + a.id * .71, scale: .92 + (a.id % 7) * .025,
      female: a.id % 2 === 0, girth: .9 + (a.id % 6) * .045, hair: (a.id % 8) / 7,
      armSwing: .8 + (a.id % 4) * .1, stride: .9 + (a.id % 3) * .08 });
    return a.rig;
  }
  seed(count, player = null) {
    const anchors = this.config.crowdAnchors;
    for (let i = 0; i < count && this.seeded < this.config.zombieCount; i++) {
      const n = this.seeded++, source = anchors[(n * 3 + 2) % anchors.length];
      const p = this.nav.nearest({ x: source.x + (n % 3 - 1) * 4, z: source.z + 6 }, 25);
      if (p && (!player || (distance(p, player) > 60 && !this.visibleFrom(player, p)))) this.population.add(p, true);
    }
    this.population.activate();
  }
  spawn() {
    if (this.spawned) return;
    this.spawned = true;
    // Later arrivals enter away from the player instead of materializing at the phase transition.
    this.population.activate();
  }
  visibleFrom(player, point) {
    // Treat every unobstructed street as visible, even when the camera is looking behind the avatar.
    return this.nav.clear(player, point);
  }
  updateWitnesses(streetTime, player, mission) {
    const { patient, helper } = this.witnesses;
    if (streetTime >= 12 && !this.caseStarted) {
      this.population.infect(patient); patient.timer = 18;
      this.population.activate(); this.caseStarted = true;
    }
    const visible = distance(patient, player) < 35 && this.nav.clear(patient, player);
    if (visible) {
      if (['bitten', 'normal'].includes(patient.state)) this.event = 'witnessSick';
      if (patient.state === 'turning') this.event = 'witnessTurning';
      if (patient.state === 'zombie') { this.event = helper.wounded ? 'witnessBite' : 'witnessAttack'; mission.witnessedOutbreak = true; }
    } else this.event = null;
  }
  routeFor(a, routes) {
    if (a.routeGoal) return routes.find(route => route.goal === a.routeGoal) || routes[0];
    const choices = routes.filter(route => route.nav.cost[route.nav.index(a)] >= 0).sort((one, two) => {
      const score = route => distance(a, route.goal) - (a.danger ? Math.min(150, distance(a.danger, route.goal)) * .5 : 0);
      return score(one) - score(two);
    });
    const route = choices[a.routeChoice % Math.min(3, choices.length)] || routes[0];
    a.routeGoal = route.goal;
    return route;
  }
  localTarget(a, target) {
    if (this.nav.clear(a, target)) { a.path = null; return target; }
    if ((!a.path?.length || !a.pathGoal || distance(a.pathGoal, target) > 3) && this.time >= (a.repathAt || 0) && this.pathBudget > 0) {
      this.pathBudget--;
      a.path = this.nav.path(a, target, 2400); a.pathGoal = { ...target }; a.repathAt = this.time + 1.5;
    }
    while (a.path?.length && distance(a, a.path[0]) < .45) a.path.shift();
    return a.path?.[0] || null;
  }
  update(dt, player, mission, civilianNav, routes = [{ nav: civilianNav, goal: this.config.shelter }]) {
    this.time += dt; this.pathBudget = 3;
    const pos = player.position, streetTime = mission.streetTime;
    this.updateWitnesses(streetTime, pos, mission);
    const required = streetTime >= 100 ? 12 : streetTime >= 75 ? 6 : streetTime >= 52 ? 3 : 0;
    if (this.seeded < required) this.seed(required - this.seeded, pos);
    if (mission.phase === 'escape' && this.wave < 4 && mission.time >= 12 + this.wave * 15) {
      const source = this.config.crowdAnchors[(this.wave++ * 2 + 3) % this.config.crowdAnchors.length];
      for (let i = 0; i < 4; i++) {
        const p = this.nav.nearest({ x: source.x + i * 3, z: source.z });
        if (p && distance(p, pos) > 60 && !this.visibleFrom(pos, p) && civilianNav.cost[civilianNav.index(p)] >= 0) this.population.add(p, true);
      }
    }
    if (this.time >= this.activeAt) {
      this.activeActors = this.actors.filter(a => !a.sheltered && distance(a, pos) < 100)
        .sort((a, b) => distance(a, pos) - distance(b, pos)).slice(0, this.config.activeActorCount);
      this.activeIds = new Set(this.activeActors.map(a => a.id));
      this.activeAt = this.time + .35;
    }
    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0 && Math.abs(player.speed) > .4) {
      this.population.noise.emit(pos, player.driving ? 65 : Math.abs(player.speed) > 3 ? 26 : 8);
      this.noiseTimer = .6;
    }
    this.population.update(dt, pos, (a, b) => this.nav.clear(a, b), () => {
      const y = this.ground(null, pos.x, pos.z);
      if (!player.driving && Math.abs(pos.y - y) < 1.9) mission.bite();
    }, this.activeActors);
    if (this.time >= this.recycleAt && this.actors.length) {
      const actor = this.actors[this.recycleCursor++ % this.actors.length];
      this.neighborhood.recycle(actor, pos, p => this.visibleFrom(pos, p), this.nav, streetTime);
      this.recycleAt = this.time + .08;
    }
    const neighbors = new SpatialGrid(this.activeActors);
    this.crowd.begin();
    for (const a of this.actors) {
      if (a.sheltered) continue;
      const detailed = this.activeIds.has(a.id);
      // Distant residents retain their state and animate less often. No full perception/path search.
      a.moveTime = (a.moveTime || 0) + dt;
      if (detailed || a.moveTime >= .25) {
        this.move(a, Math.min(.3, a.moveTime), detailed, neighbors, routes);
        a.moveTime = 0;
      }
      const d = distance(a, pos);
      if (d >= (this.config.actorDrawDistance ?? 240)) continue;
      const rig = this.ensureRig(a);
      let progress = 0;
      if (a.state === 'bitten') progress = .15 + .3 * Math.max(0, 1 - a.timer / this.config.incubationSeconds);
      else if (a.state === 'turning') progress = .45 + .55 * (1 - a.timer / this.config.turningSeconds);
      else if (a.state === 'zombie') progress = 1;
      rig.crouch = a.role === 'patient' && a.state !== 'zombie' ? .45 : a.role === 'helper' && a.state === 'normal' ? .18 : 0;
      rig.setInfection(progress, !!a.wounded || !a.civilian, a.windup / .8);
      a.poseTime = (a.poseTime || 0) + dt;
      if ((detailed && d < 40) || a.poseTime > .2 || !rig.placed) {
        rig.update(a.poseTime, a.x, a.z, a.heading, this.ground); a.poseTime = 0;
      }
      this.crowd.add(rig, d);
    }
    this.crowd.end();
  }
  move(a, dt, detailed, neighbors, routes) {
    let target = null, speed = 0, nav = this.nav;
    if (a.state === 'zombie') {
      target = a.target;
      speed = (this.config.zombieSpeed + (a.id % 3) * .08) * (1 - .24 * Math.min(1, a.infectedAge / 150));
      if (a.windup > 0 || !detailed) speed = 0;
    } else if (a.state === 'fleeing') {
      const route = this.routeFor(a, routes);
      nav = route.nav; target = route.goal; speed = 4.3 + (a.id % 6) * .28;
      if (distance(a, target) < 5) { a.state = 'normal'; a.role = 'neighbor'; a.home = { x: a.x, z: a.z }; a.routeGoal = null; return; }
      if (a.threat && distance(a, a.threat) < 7) {
        const d = Math.max(.01, distance(a, a.threat));
        const retreat = { x: a.x + (a.x - a.threat.x) / d * 6, z: a.z + (a.z - a.threat.z) / d * 6 };
        if (nav.clear(a, retreat)) target = retreat;
      }
    } else if (a.state === 'normal' && a.role === 'helper' && a.helping.state !== 'bitten') {
      const d = distance(a, a.helping);
      if (d > 1.15) { target = a.helping; speed = 1.3; }
      else a.heading = Math.atan2(a.helping.x - a.x, a.helping.z - a.z);
    } else if (a.state === 'normal' && a.role === 'walker') {
      target = a.destination; speed = 1.05 + (a.id % 5) * .13;
      if (distance(a, target) < 1) {
        a.destination = this.neighborhood.closest({ x: a.home.x + Math.cos(this.time * .07 + a.id) * 22, z: a.home.z + Math.sin(this.time * .07 + a.id) * 22 });
      }
    }
    if (!target || speed === 0) return;
    if (nav === this.nav) {
      if (!detailed && !nav.clear(a, target)) return;
      target = this.localTarget(a, target);
      if (!target) return;
    }
    let next = nav.step(a, target, speed * dt);
    if (a.civilian && detailed) {
      let dx = 0, dz = 0;
      for (const other of neighbors.nearby(a)) {
        const d = distance(a, other);
        if (other.id !== a.id && d > .02 && d < 1.25) { dx += (a.x - other.x) / d * (1.25 - d); dz += (a.z - other.z) / d * (1.25 - d); }
      }
      const separated = { x: next.x + dx * dt * 2, z: next.z + dz * dt * 2 };
      if (nav.clear(a, separated)) next = separated;
    }
    if (distance(a, next) > .001) a.heading = Math.atan2(next.x - a.x, next.z - a.z);
    a.x = next.x; a.z = next.z;
  }
}
