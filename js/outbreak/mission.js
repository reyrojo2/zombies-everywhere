// Geography and balancing are data; the mission rules do not import Manhattan.
export const MANHATTAN = {
  id: 'manhattan',
  bounds: { minX: -360, maxX: 180, minZ: -600, maxZ: 140 },
  spawn: { x: -18, z: 80, heading: Math.PI },
  hospital: { x: -18, z: -160 },
  shelter: { x: -18, z: -470 },
  radio: { x: -4, z: -227 },
  radioArrivalSeconds: 17,
  radioHoldSeconds: 3,
  triggerRadius: 20,
  safeRadius: 9,
  introSeconds: 42,
  callSeconds: 24,
  maxHealth: 100,
  maxStamina: 100,
  attackDamage: 14,
  attackCooldown: 1.2,
  zombieSpeed: 2.15,
  zombieCount: 12,
  reinforcementCount: 16,
  civilianCount: 40,
  incubationSeconds: 6,
  turningSeconds: 2
};

export class Mission {
  constructor(config) { this.config = config; this.reset(); }
  reset() {
    this.phase = 'menu'; this.time = 0; this.health = this.config.maxHealth;
    this.stamina = this.config.maxStamina; this.hurtCooldown = 0;
    this.radioReady = false; this.radioProgress = 0;
    this.paused = false; this.exhausted = false;
  }
  start() { this.reset(); this.phase = 'intro'; }
  get playing() { return ['errand', 'escape'].includes(this.phase) && !this.paused; }
  skipIntro() { if (this.phase === 'intro') { this.phase = 'errand'; this.time = 0; } }
  tick(dt, position, wantsSprint = false, interacting = false) {
    if (this.paused || ['menu', 'won', 'lost'].includes(this.phase)) return;
    this.time += dt;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.phase === 'intro') {
      if (this.time >= this.config.introSeconds) this.skipIntro();
      return;
    }
    if (this.exhausted && this.stamina >= 25) this.exhausted = false;
    const sprinting = wantsSprint && !this.exhausted && this.stamina > 0;
    this.stamina = Math.max(0, Math.min(this.config.maxStamina, this.stamina + dt * (sprinting ? -19 : 11)));
    if (this.stamina === 0) this.exhausted = true;
    if (this.phase === 'errand' && this.time >= this.config.callSeconds && distance(position, this.config.hospital) <= this.config.triggerRadius) {
      this.phase = 'escape'; this.time = 0;
    } else if (this.phase === 'escape') {
      if(!this.radioReady) {
        const atRadio=this.time>=this.config.radioArrivalSeconds && distance(position,this.config.radio)<7;
        this.radioProgress=atRadio && interacting ? Math.min(this.config.radioHoldSeconds,this.radioProgress+dt) : 0;
        if(this.radioProgress>=this.config.radioHoldSeconds)this.radioReady=true;
      }
      if(this.radioReady && distance(position, this.config.shelter) <= this.config.safeRadius) {
      this.phase = 'won';
      }
    }
  }
  hurt() {
    if (this.phase !== 'escape' || this.paused || this.hurtCooldown > 0) return false;
    this.health = Math.max(0, this.health - this.config.attackDamage);
    this.hurtCooldown = this.config.attackCooldown;
    if (this.health === 0) this.phase = 'lost';
    return true;
  }
}
export function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
