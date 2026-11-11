// Geography and balancing are data; the mission rules do not import Manhattan.
export const MANHATTAN = {
  id: 'manhattan',
  storyStart: '2020-02-03T17:30:00Z', // Fictional New York wall time, not a UTC conversion.
  playerIncubationSeconds: 360,
  bounds: { minX: -1100, maxX: -200, minZ: 2500, maxZ: 3330 },
  spawn: { x: -837, z: 2708, heading: .73 },
  hospital: { x: -700, z: 2860 },
  pharmacy: { x: -731, z: 2825 },
  relay: { x: -770, z: 3075 },
  shelter: { x: -950, z: 3170 },
  shelters: [{ x: -950, z: 3170 }, { x: -340, z: 2652 }],
  exits: [{x:-1030,z:3245},{x:-340,z:2652},{x:-920,z:2625},{x:-350,z:3130}],
  crowdAnchors: [{x:-837,z:2708},{x:-895,z:2640},{x:-700,z:2860},{x:-645,z:2910},{x:-750,z:3000},{x:-550,z:2825},{x:-442,z:2740},{x:-855,z:3095}],
  fireSites: [{x:-790,z:2770,heading:.73,start:48},{x:-695,z:2865,heading:.73,start:66},{x:-755,z:3000,heading:2.28,start:86},{x:-540,z:2830,heading:2.28,start:108},{x:-850,z:3090,heading:2.28,start:132},{x:-445,z:2740,heading:2.28,start:158}],
  radio: { x: -550, z: 2825 },
  radioArrivalSeconds: 17,
  radioHoldSeconds: 3,
  triggerRadius: 20,
  introSeconds: 48,
  callSeconds: 20,
  outbreakSeconds: 90,
  localTriggerSeconds: 32,
  maxHealth: 100,
  maxStamina: 100,
  attackDamage: 14,
  attackCooldown: 1.2,
  zombieSpeed: 2.55,
  zombieCount: 12,
  reinforcementCount: 16,
  civilianCount: 224,
  activeActorCount: 72,
  incubationSeconds: 6,
  turningSeconds: 2
};

export class Mission {
  constructor(config) { this.config = config; this.reset(); }
  reset() {
    this.phase = 'menu'; this.time = 0; this.elapsed = 0; this.infectionRemaining = null; this.lossReason = null; this.health = this.config.maxHealth;
    this.stamina = this.config.maxStamina; this.hurtCooldown = 0;
    this.phoneAnswered = false; this.callComplete = false; this.callTime = 0; this.streetTime = 0;
    this.callInterruptedAt = null;
    this.witnessedOutbreak = false;
    this.openShelter = null; this.doorOpening = 0; this.previousPosition = null;
    this.hasSupplies = false; this.radioReady = false; this.relayRead = false;
    this.actionProgress = 0; this.heldAction = null; this.radioProgress = 0;
    this.paused = false; this.exhausted = false;
  }
  start() { this.reset(); this.phase = 'intro'; }
  get playing() { return ['errand', 'phone', 'escape'].includes(this.phase) && !this.paused; }
  skipIntro() { if (this.phase === 'intro') { this.phase = 'errand'; this.time = 0; } }
  answerPhone() { if(this.phase==='phone' && !this.phoneAnswered){this.phoneAnswered=true;this.callTime=0;} }
  get objective() {
    if (!this.hasSupplies) return 'pharmacy';
    if (!this.radioReady) return 'radio';
    return this.relayRead ? 'shelter' : 'relay';
  }
  get callInterrupted() { return this.callInterruptedAt !== null && this.streetTime - this.callInterruptedAt < 6; }
  get shelters() { return this.config.shelters || [this.config.shelter]; }
  shelterEntranceAt(position) {
    return this.shelters.find(shelter => {
      const p = gateLocal(position, shelter);
      return Math.abs(p.x) < 2.35 && p.z > .1 && p.z < 4.2;
    });
  }
  interactionAt(position) {
    if (!this.playing) return null;
    const key = this.objective;
    if (key === 'shelter') {
      const entrance = this.shelterEntranceAt(position);
      return entrance && entrance !== this.openShelter ? 'shelter' : null;
    }
    if (key === 'radio' && (this.phase !== 'escape' || this.time < this.config.radioArrivalSeconds)) return null;
    return distance(position, this.config[key]) < (key === 'relay' ? 3.8 : 7) ? key : null;
  }
  holdSeconds(action) {
    return action === 'radio' ? this.config.radioHoldSeconds : action === 'shelter' ? .55 : 1;
  }
  blocksGate(from, to, driving) {
    if (!from) return false;
    return this.shelters.some(shelter => {
      const a = gateLocal(from, shelter), b = gateLocal(to, shelter);
      if ((a.z > 0) === (b.z > 0)) return false;
      const x = a.x + (b.x - a.x) * (a.z / (a.z - b.z));
      return Math.abs(x) < 2.43 &&
        (driving || shelter !== this.openShelter || this.doorOpening < .95 || Math.abs(x) > .95);
    });
  }
  tick(dt, position, wantsSprint = false, interacting = false, driving = false) {
    if (this.paused || ['menu', 'won', 'lost'].includes(this.phase)) return;
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.elapsed += dt;
    this.time += dt;
    if (this.phase === 'secured') {
      this.doorOpening = Math.max(0, 1 - this.time / .85);
      if (this.time >= 1.12) this.phase = 'won';
      return;
    }
    if (this.infectionRemaining !== null) {
      this.infectionRemaining = Math.max(0, this.infectionRemaining - dt);
      if (this.infectionRemaining === 0) { this.phase = 'lost'; this.lossReason = 'infection'; return; }
    }
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.phase === 'intro') {
      if (this.time >= this.config.introSeconds) this.skipIntro();
      return;
    }
    this.streetTime += dt;
    if (this.phoneAnswered && !this.callComplete) {
      this.callTime += dt;
      if (this.callTime >= this.config.callSeconds) { this.callComplete = true; if(this.phase==='phone') this.phase='errand'; }
    }
    if(this.phase==='errand' && !this.callComplete && !this.phoneAnswered && this.streetTime>=5) this.phase='phone';
    if (this.exhausted && this.stamina >= 25) this.exhausted = false;
    const sprinting = wantsSprint && !this.exhausted && this.stamina > 0;
    this.stamina = Math.max(0, Math.min(this.config.maxStamina, this.stamina + dt * (sprinting ? -19 : 11)));
    if (this.stamina === 0) this.exhausted = true;
    if (['errand','phone'].includes(this.phase) && (this.streetTime >= (this.config.outbreakSeconds ?? 90) ||
        (this.streetTime >= (this.config.localTriggerSeconds ?? 32) &&
          (this.witnessedOutbreak || distance(position, this.config.hospital) <= this.config.triggerRadius)))) {
      if (this.phase === 'phone' && this.phoneAnswered && !this.callComplete) this.callInterruptedAt = this.streetTime;
      this.callComplete = true;
      this.phase = 'escape'; this.time = 0;
    }
    const action = !driving && interacting ? this.interactionAt(position) : null;
    if (action !== this.heldAction || !action) this.actionProgress = 0;
    this.heldAction = action;
    if (action) {
      const heldFor = action === 'radio' ? Math.min(dt, this.time - this.config.radioArrivalSeconds) : dt;
      this.actionProgress = Math.min(this.holdSeconds(action), this.actionProgress + heldFor);
      if (this.actionProgress >= this.holdSeconds(action)) {
        if (action === 'pharmacy') {
          this.hasSupplies = true;
          this.health = Math.min(this.config.maxHealth, this.health + 18);
        } else if (action === 'radio') this.radioReady = true;
        else if (action === 'relay') this.relayRead = true;
        else if (action === 'shelter') {
          this.openShelter = this.shelterEntranceAt(position);
          this.doorOpening = 0;
        }
        this.actionProgress = 0;
      }
    }
    this.radioProgress = action === 'radio' ? this.actionProgress : 0;
    if (this.openShelter) {
      this.doorOpening = Math.min(1, this.doorOpening + dt / .7);
      if (this.phase === 'escape' && !driving && this.doorOpening >= .95 && this.previousPosition) {
        const a = gateLocal(this.previousPosition, this.openShelter);
        const b = gateLocal(position, this.openShelter);
        if (a.z > 0 && b.z <= 0 && b.z > -2 && Math.abs(b.x) <= .95) {
          this.phase = 'secured';
          this.time = 0;
        }
      }
    }
    this.previousPosition = { x: position.x, z: position.z };
  }
  get storyDate() { return new Date(Date.parse(this.config.storyStart || '2020-02-03T17:30:00Z') + this.elapsed * 1000); }
  bite() {
    if (!this.hurt()) return false;
    if (this.infectionRemaining === null) this.infectionRemaining = this.config.playerIncubationSeconds ?? 240;
    return true;
  }
  hurt() {
    if (!this.playing || this.streetTime < 12 || this.hurtCooldown > 0) return false;
    this.health = Math.max(0, this.health - this.config.attackDamage);
    this.hurtCooldown = this.config.attackCooldown;
    if (this.health === 0) this.phase = 'lost';
    return true;
  }
}
export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function gateLocal(position, gate) {
  const x = position.x - gate.x, z = position.z - gate.z;
  const sin = Math.sin(gate.heading ?? 0), cos = Math.cos(gate.heading ?? 0);
  return { x: x * cos - z * sin, z: x * sin + z * cos };
}
