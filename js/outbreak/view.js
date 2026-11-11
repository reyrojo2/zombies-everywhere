import { MESSAGES, getLanguage } from './locales.js';

export class OutbreakView {
  constructor({ onStart, onSkip, onPause, onLanguage, onSound, onQuality, onAnswer }) {
    try { this.language = getLanguage(window.localStorage); } catch { this.language = 'es'; }
    this.root = document.createElement('section'); this.root.id = 'outbreak'; this.root.hidden = true;
    // Static markup only; all narrative text is assigned through textContent.
    this.root.innerHTML = `
      <div class="ze-top"><a class="ze-brand" href="./">ZOMBIES<span>EVERYWHERE</span></a>
      <div class="ze-settings"><label><span data-text="language"></span> <select aria-label="Idioma / Language"><option value="es">Español</option><option value="en">English</option></select></label>
      <label><span data-text="quality"></span><select class="ze-quality" aria-label="Calidad / Quality"><option value="low" data-text="qualityLow"></option><option value="balanced" data-text="qualityBalanced"></option><option value="cinematic" data-text="qualityHigh"></option></select></label><button class="ze-sound" type="button"></button><button class="ze-pause" type="button" data-text="pause"></button></div></div>
      <button class="ze-phone-answer" type="button" data-text="answer"></button><div class="ze-hud"><div class="ze-clock"></div><div class="ze-infection"></div><div class="ze-interaction"></div><div class="ze-objective"></div><div class="ze-distance"></div><div class="ze-threat"></div><progress class="ze-progress" max="1" aria-label="Interaction" hidden></progress>
      <div class="ze-route-hint"></div><div class="ze-vitals"><label><span data-text="health"></span><progress class="ze-health" max="100" value="100"></progress></label>
      <label><span data-text="stamina"></span><progress class="ze-stamina" max="100" value="100"></progress></label></div></div>
      <canvas class="ze-map" width="240" height="190" aria-label="Mapa / Map"></canvas>
      <aside class="ze-feed" role="status" aria-live="polite"><div class="ze-feed-label"></div><p class="ze-feed-text"></p></aside>
      <p class="ze-controls" data-text="controls"></p>
      <div class="ze-screen"><div class="ze-card"><p class="ze-eyebrow" data-text="chapter"></p>
      <h1></h1><p class="ze-description"></p><p class="ze-fiction" data-text="fiction"></p>
      <div class="ze-cities"><span>● Manhattan</span><span data-text="lima"></span></div>
      <button class="ze-primary" type="button"></button><p class="ze-rotate-hint" data-text="rotateHint"></p><p class="ze-hint" data-text="hint"></p>
      <small class="ze-credits" data-text="credits"></small><small class="ze-credits"><a href="https://opengameart.org/content/epic-news-theme-beyond-the-clouds-v2" target="_blank" rel="noopener noreferrer">Music: Matthew Pablo — Beyond The Clouds · CC BY 3.0 (excerpt)</a></small></div></div>
      <div class="ze-broadcast"><p class="ze-bulletin" role="status" aria-live="polite"></p>
      <div class="ze-timeline"><i></i></div><button class="ze-skip" type="button" data-text="skip"></button></div>`;
    document.body.append(this.root);
    this.$ = (s) => this.root.querySelector(s);
    this.$('select').value = this.language;
    this.$('select').addEventListener('change', (e) => {
      this.language = e.target.value;
      try { localStorage.setItem('ze-language', this.language); } catch { /* Optional preference storage. */ }
      this.translate(); onLanguage();
    });
    this.$('.ze-phone-answer').addEventListener('click',onAnswer);
    this.$('.ze-primary').addEventListener('click', () => this.last?.paused ? onPause() : onStart());
    this.$('.ze-skip').addEventListener('click', onSkip);
    this.$('.ze-pause').addEventListener('click', onPause);
    this.$('.ze-sound').addEventListener('click', onSound);
    this.$('.ze-quality').value = new URLSearchParams(location.search).get('quality') || 'balanced';
    this.$('.ze-quality').addEventListener('change', (e) => onQuality(e.target.value));
    this.translate();
  }
  bindTouch(root, { onActivate, onHold, onNoise }) {
    const button = root.querySelector('.ze-touch-context');
    this.touchButton = button;
    this.noiseButton = root.querySelector('.ze-touch-noise');
    let pointer = null;
    let heldAction = null;
    let clickAction = null;
    const stop = () => {
      if (pointer === null) return;
      const id = pointer;
      pointer = null;
      onHold(heldAction, false);
      heldAction = null;
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
      button.classList.remove('is-pressed');
    };
    this.stopTouchHold = stop;
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || button.hidden || pointer !== null) return;
      clickAction = ['answer', 'vehicle'].includes(this.touchContext) ? this.touchContext : null;
      if (clickAction) return;
      pointer = event.pointerId;
      heldAction = this.touchContext;
      button.setPointerCapture(pointer);
      button.classList.add('is-pressed');
      onHold(heldAction, true);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(event, e => { if (e.pointerId === pointer) stop(); });
    }
    button.addEventListener('click', event => {
      if (!button.hidden && (event.detail === 0 || clickAction === this.touchContext) &&
          ['answer', 'vehicle'].includes(this.touchContext)) onActivate(this.touchContext);
      clickAction = null;
    });
    this.noiseButton.addEventListener('click', onNoise);
    window.addEventListener('resize', stop);
    this.touchRoot = root;
  }
  updateTouch({ available, context, noise, driving }) {
    this.touchAvailable = available;
    const action = available && !this.touchRoot.hidden ? context : null;
    if (this.touchContext !== action) this.stopTouchHold();
    this.touchContext = action;
    this.touchButton.hidden = !action;
    if (action) {
      const key = action === 'vehicle' ? (driving ? 'touchExit' : 'touchEnter') : `touch_${action}`;
      this.touchButton.textContent = this.t(key);
    }
    this.noiseButton.hidden = driving;
    this.noiseButton.disabled = !noise;
    this.noiseButton.textContent = this.t('touchNoise');
    for (const key of ['boost', 'up']) {
      const label = this.t(key === 'up' ? 'touchJump' : driving ? 'touchBoost' : 'touchRun');
      this.touchRoot.querySelector(`[data-touch-label="${key}"]`).textContent = label;
      this.touchRoot.querySelector(`[data-touch-action="${key}"]`).setAttribute('aria-label', label);
    }
  }
  t(key) { return MESSAGES[this.language][key] ?? key; }
  translate() {
    document.documentElement.lang = this.language;
    this.$('.ze-quality').title = this.t('quality');
    this.$('.ze-quality').setAttribute('aria-label', this.t('quality'));
    for (const node of this.root.querySelectorAll('[data-text]')) node.textContent = this.t(node.dataset.text);
    this.$('.ze-health').setAttribute('aria-label', this.t('health'));
    this.$('.ze-stamina').setAttribute('aria-label', this.t('stamina'));
  }
  render(mission, { worldAction = null, distance = 0, feed = '', boundary = false, sound = true, infections = 0, threat = 999 } = {}) {
    this.last = mission;
    const phase = mission.phase, terminal = phase === 'won' || phase === 'lost';
    const screen = phase === 'menu' || terminal || mission.paused;
    this.root.dataset.phase = phase;
    this.$('.ze-screen').hidden = !screen;
    this.$('.ze-broadcast').hidden = phase !== 'intro' || mission.paused;
    this.$('.ze-hud').hidden = !mission.playing;
    this.$('.ze-map').hidden = !mission.playing;
    this.$('.ze-feed').hidden = !mission.playing && phase!=='phone';
    this.$('.ze-phone-answer').hidden = phase!=='phone' || mission.phoneAnswered || mission.paused || this.touchAvailable;
    this.$('.ze-controls').hidden = screen || phase === 'intro' || this.touchAvailable;
    this.$('.ze-pause').hidden = phase === 'menu' || terminal;
    this.$('.ze-pause').textContent = this.t(mission.paused ? 'resume' : 'pause');
    this.$('.ze-sound').textContent = `${this.t('sound')}: ${this.t(sound ? 'on' : 'off')}`;
    this.$('h1').textContent = this.t(mission.paused ? 'paused' : terminal ? phase : 'title');
    this.$('.ze-description').textContent = this.t(mission.paused ? (this.touchAvailable ? 'touchControls' : 'controls') : terminal ? `${phase}Body` : 'tagline');
    this.$('.ze-primary').textContent = this.t(mission.paused ? 'resume' : terminal ? 'restart' : 'start');
    this.$('.ze-cities').hidden = phase !== 'menu';
    this.$('.ze-hint').hidden = terminal;
    this.$('.ze-objective').textContent = this.t(`objective_${mission.objective}`);
    const next = this.route?.[Math.min(8, this.route.length - 1)];
    if (next && this.player) {
      const angle = Math.atan2(next.x - this.player.position.x, next.z - this.player.position.z) - this.player.heading;
      const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
      this.$('.ze-route-hint').textContent = distance < 8 ? this.t('routeArrive') :
        `${this.t(Math.abs(turn) < .5 ? 'routeAhead' : turn > 0 ? 'routeRight' : 'routeLeft')} · ${Math.ceil(Math.hypot(next.x - this.player.position.x, next.z - this.player.position.z))} m`;
    } else this.$('.ze-route-hint').textContent = '';
    this.$('.ze-distance').textContent = `${Math.ceil(distance)} m · ${this.t(mission.objective)} · ${this.t('infections')}: ${infections}`;
    this.$('.ze-threat').textContent = threat < 25 ? `${this.t('threat')}: ${Math.ceil(threat)} m` : '';
    this.$('.ze-progress').hidden = !worldAction;
    this.$('.ze-progress').value = worldAction ? mission.actionProgress / mission.holdSeconds(worldAction) : 0;
    this.root.classList.toggle('ze-danger',threat<14 && mission.playing);
    const second=Math.floor(mission.storyDate.getTime()/1000);
    if(this.clockSecond!==second || this.clockLanguage!==this.language) {
      this.clockSecond=second;this.clockLanguage=this.language;
      this.$('.ze-clock').textContent = new Intl.DateTimeFormat(this.language==='en'?'en-GB':'es-PE', {
        timeZone:'UTC',weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
      }).format(second*1000);
    }
    const remaining=Math.ceil(mission.infectionRemaining ?? 0);
    this.$('.ze-infection').textContent = mission.infectionRemaining===null?'':`${this.t('infectedPlayer')} ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    if(mission.lossReason==='infection')this.$('.ze-description').textContent=this.t('infectionLost');
    this.$('.ze-interaction').textContent=this.touchAvailable ? '' : worldAction ? this.t('holdInteract') : this.driving ? this.t('exitCar') : this.vehicleNearby ? this.t('enterCar') : '';
    this.$('.ze-health').value = mission.health;
    this.$('.ze-stamina').value = mission.stamina;
    const text = this.t(boundary ? 'boundary' : feed);
    // Do not repeatedly notify screen readers on every animation frame.
    if (this.$('.ze-feed-text').textContent !== text) this.$('.ze-feed-text').textContent = text;
    this.$('.ze-feed-label').textContent = this.t(feed === 'dispatchMessage' ? 'dispatch' : feed === 'relayMessage' ? 'note' : feed.startsWith('call') || feed === 'phoneIncoming' || feed === 'cut' ? 'call' : 'street');
    const bulletin = Math.min(2, Math.floor(mission.time / (mission.config.introSeconds / 3)));
    this.$('.ze-bulletin').textContent = this.t(mission.time>=42?'leaving':`bulletin${bulletin}`);
    this.$('.ze-timeline i').style.width = `${Math.min(100, mission.time / mission.config.introSeconds * 100)}%`;
  }
  drawMap(nav, player, actors, target) {
    const canvas = this.$('.ze-map'), ctx = canvas.getContext('2d'), b = nav.bounds;
    const x = (v) => (v - b.minX) / (b.maxX - b.minX) * canvas.width;
    const z = (v) => (v - b.minZ) / (b.maxZ - b.minZ) * canvas.height;
    if (!this.mapBase) {
      this.mapBase = document.createElement('canvas'); this.mapBase.width = canvas.width; this.mapBase.height = canvas.height;
      const base = this.mapBase.getContext('2d'); base.fillStyle = '#0a1118'; base.fillRect(0, 0, canvas.width, canvas.height);
      base.fillStyle = '#344149';
      for (let i = 0; i < nav.blocked.length; i++) if (nav.blocked[i]) {
        const p = nav.point(i); base.fillRect(x(p.x - nav.cell / 2), z(p.z - nav.cell / 2), nav.cell / (b.maxX - b.minX) * canvas.width + 0.2, nav.cell / (b.maxZ - b.minZ) * canvas.height + 0.2);
      }
    }
    ctx.drawImage(this.mapBase, 0, 0);
    if(this.route?.length) {
      ctx.strokeStyle='#e5b45a';ctx.lineWidth=3;ctx.beginPath();
      this.route.forEach((p,i)=>i?ctx.lineTo(x(p.x),z(p.z)):ctx.moveTo(x(p.x),z(p.z)));ctx.stroke();
    }
    const dot = (p, color, radius) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(p.x), z(p.z), radius, 0, Math.PI * 2); ctx.fill(); };
    for (const a of actors) if (!a.sheltered) dot(a, ['bitten','turning'].includes(a.state) ? '#e5b45a' : a.civilian ? '#58c9ff' : '#ff554e', 2.5);
    if(this.last?.relayRead)for(const p of this.last.config.shelters || [])dot(p,'#73e0ad',5);
    if(this.vehiclePosition && !this.driving)dot(this.vehiclePosition,'#c0d7ff',4);
    dot(target, '#e5b45a', 5); dot(player.position, '#fff', 4);
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x(player.position.x), z(player.position.z));
    ctx.lineTo(x(player.position.x) + Math.sin(player.heading) * 10, z(player.position.z) + Math.cos(player.heading) * 10); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText('N ↑', 8, 15);
  }
}
