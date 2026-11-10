const MOBILE = {
  low: { initial: .50, min: .42, max: .70, far: 260 },
  balanced: { initial: .64, min: .44, max: .88, far: 350 },
  cinematic: { initial: .76, min: .48, max: 1, far: 440 }
};
const DESKTOP = {
  low: { initial: .60, min: .46, max: .75, far: 350 },
  balanced: { initial: .80, min: .52, max: 1, far: 520 },
  cinematic: { initial: 1, min: .60, max: 1.18, far: 690 }
};

export class RenderQuality {
  constructor(mobile, profile) {
    this.mobile = mobile;
    this.select(profile);
  }
  select(profile) {
    const profiles = this.mobile ? MOBILE : DESKTOP;
    this.profile = Object.hasOwn(profiles, profile) ? profile : 'balanced';
    this.limits = profiles[this.profile];
    this.scale = this.limits.initial;
    this.resetSamples();
  }
  resetSamples() {
    this.time = 0;
    this.frames = 0;
    this.slow = 0;
    this.fast = 0;
  }
  resolution(width, height) {
    // Cap the drawing buffer on high-density phones and large desktop windows.
    const pixelBudget = this.mobile ? 1_050_000 : 2_600_000;
    return Math.min(this.scale, Math.sqrt(pixelBudget / Math.max(1, width * height)));
  }
  get distance() {
    const fraction = Math.min(1, this.scale / this.limits.initial);
    return Math.round(this.limits.far * (.45 + .55 * fraction));
  }
  sample(seconds, playing) {
    if (!playing) {
      this.resetSamples();
      return false;
    }
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > .7) return false;
    this.time += seconds;
    this.frames++;
    if (this.time < 1.25 || this.frames < 4) return false;
    const average = this.time / this.frames;
    this.time = 0;
    this.frames = 0;
    this.slow = average > .037 ? this.slow + 1 : 0;
    this.fast = average < .024 ? this.fast + 1 : 0;
    if (this.slow < 2 && this.fast < 4) return false;
    const delta = this.slow >= 2 ? -.09 : .06;
    this.slow = 0;
    this.fast = 0;
    const next = Math.max(this.limits.min, Math.min(this.limits.max, this.scale + delta));
    if (next === this.scale) return false;
    this.scale = next;
    return true;
  }
}
