// Geography and balancing are data; the mission rules do not import Manhattan.
export const MANHATTAN = {
  id: 'manhattan',
  bounds: { minX: -1100, maxX: -200, minZ: 2500, maxZ: 3330 },
  spawn: { x: -837, z: 2708, heading: .73 },
  hospital: { x: -700, z: 2860 },
  shelter: { x: -950, z: 3170 },
  shelters: [{ x: -950, z: 3170 }, { x: -340, z: 2652 }],
  exits: [{x:-1030,z:3245},{x:-340,z:2652},{x:-920,z:2625},{x:-350,z:3130}],
  crowdAnchors: [{x:-837,z:2708},{x:-895,z:2640},{x:-700,z:2860},{x:-645,z:2910},{x:-750,z:3000},{x:-550,z:2825},{x:-442,z:2740},{x:-855,z:3095}],
  fireSites: [{x:-790,z:2770,heading:.73,start:10},{x:-695,z:2865,heading:.73,start:23},{x:-755,z:3000,heading:2.28,start:38},{x:-540,z:2830,heading:2.28,start:52},{x:-850,z:3090,heading:2.28,start:68},{x:-445,z:2740,heading:2.28,start:85}],
  radio: { x: -550, z: 2825 },
  radioArrivalSeconds: 17,
  radioHoldSeconds: 3,
  triggerRadius: 20,
  safeRadius: 9,
  introSeconds: 48,
  callSeconds: 24,
  maxHealth: 100,
  maxStamina: 100,
  attackDamage: 14,
  attackCooldown: 1.2,
  zombieSpeed: 2.55,
  zombieCount: 12,
  reinforcementCount: 16,
  civilianCount: 104,
  incubationSeconds: 6,
  turningSeconds: 2
};

export class Mission {
  constructor(config) { this.config = config; this.reset(); }
  reset() {
    this.phase = 'menu'; this.time = 0; this.health = this.config.maxHealth;
    this.stamina = this.config.maxStamina; this.hurtCooldown = 0;
    this.phoneAnswered=false;this.callComplete=false;this.callTime=0;this.streetTime=0;
    this.radioReady = false; this.radioProgress = 0;
    this.paused = false; this.exhausted = false;
  }
  start() { this.reset(); this.phase = 'intro'; }
  get playing() { return ['errand', 'phone', 'escape'].includes(this.phase) && !this.paused; }
  skipIntro() { if (this.phase === 'intro') { this.phase = 'errand'; this.time = 0; } }
  answerPhone() { if(this.phase==='phone' && !this.phoneAnswered){this.phoneAnswered=true;this.callTime=0;} }
  tick(dt, position, wantsSprint = false, interacting = false) {
    if (this.paused || ['menu', 'won', 'lost'].includes(this.phase)) return;
    this.time += dt;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.phase === 'intro') {
      if (this.time >= this.config.introSeconds) this.skipIntro();
      return;
    }
    this.streetTime += dt;
    if (this.phoneAnswered && !this.callComplete) {
      this.callTime += dt;
      if (this.callTime >= 20) { this.callComplete = true; if(this.phase==='phone') this.phase='errand'; }
    }
    if(this.phase==='errand' && !this.callComplete && !this.phoneAnswered && this.streetTime>=5) this.phase='phone';
    if (this.exhausted && this.stamina >= 25) this.exhausted = false;
    const sprinting = wantsSprint && !this.exhausted && this.stamina > 0;
    this.stamina = Math.max(0, Math.min(this.config.maxStamina, this.stamina + dt * (sprinting ? -19 : 11)));
    if (this.stamina === 0) this.exhausted = true;
    if (['errand','phone'].includes(this.phase) && (this.streetTime >= 42 || (this.streetTime >= 22 && distance(position, this.config.hospital) <= this.config.triggerRadius))) {
      this.phase = 'escape'; this.time = 0;
    } else if (this.phase === 'escape') {
      if(!this.radioReady) {
        const atRadio=this.time>=this.config.radioArrivalSeconds && distance(position,this.config.radio)<7;
        this.radioProgress=atRadio && interacting ? Math.min(this.config.radioHoldSeconds,this.radioProgress+dt) : 0;
        if(this.radioProgress>=this.config.radioHoldSeconds)this.radioReady=true;
      }
      if(this.radioReady && (this.config.shelters || [this.config.shelter]).some(p=>distance(position,p)<=this.config.safeRadius)) {
      this.phase = 'won';
      }
    }
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
