import * as THREE from 'three/webgpu';
import { Mission, MANHATTAN, distance } from './mission.js';
import { blockAt } from '../city-config.js';
import { NavigationGrid, shelterSite, sitePoint } from './navigation.js';
import { OutbreakActors } from './actors.js';
import { OutbreakView } from './view.js';
import { OutbreakSound } from './sound.js';
import { OutbreakIncidents } from './incidents.js';
import { TVIntroduction } from './tv-introduction.js';
import { PhoneSequence } from './phone-sequence.js';
import { createPharmacy, createNoticeBoard, createShelterGate } from './locations.js';

function siteHeading(nav, point, from, width, depth) {
  nav.flood(point);
  const route = nav.trace(from);
  const approach = route[Math.max(0, route.length - 5)] || from;
  const preferred = Math.atan2(approach.x - point.x, approach.z - point.z);
  const checks = [-width, 0, width];
  for (const turn of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const h = preferred + turn;
    const at = (x, z) => sitePoint({ ...point, heading: h }, x, z);
    if (checks.every(x => nav.clear(at(x, 0), at(x, -depth))) && nav.clear(point, at(0, 4.5))) return h;
  }
  return preferred;
}

export class OutbreakGame {
  constructor({ scene, controller, camera, colliders, roadNetwork, audio, touchControls, mobile = false, onQuality = () => {} }) {
    this.touchControls = touchControls;
    this.roadNetwork=roadNetwork; this.controller = controller; this.camera = camera; this.audio = audio;
    this.sound = new OutbreakSound(audio);
    this.intro = new TVIntroduction();
    this.phone = new PhoneSequence(scene,camera);
    this.nav = new NavigationGrid(MANHATTAN.bounds, colliders);
    // Resolve authored waypoints against actual buildings, rather than assuming empty sidewalks.
    this.config = { ...MANHATTAN, ...(mobile ? { civilianCount: 112, actorDrawDistance: 125 } : {}) };
    this.civilianNav = new NavigationGrid(MANHATTAN.bounds, colliders);
    this.civilianNav.flood(MANHATTAN.spawn);
    const reachable = i => this.civilianNav.cost[i] >= 0;
    for (const key of ['spawn', 'hospital', 'radio', 'pharmacy', 'relay']) {
      const p = this.nav.nearest(MANHATTAN[key], 35, reachable);
      if (!p) throw new Error(`No walkable mission waypoint: ${key}`);
      this.config[key] = { ...MANHATTAN[key], ...p };
    }
    const pedestrianBlock = (x, z) => {
      const block = blockAt(x, z);
      return block && !block.median ? block : null;
    };
    this.config.shelters = MANHATTAN.shelters.map(seed =>
      shelterSite(this.civilianNav, seed, pedestrianBlock) || shelterSite(this.civilianNav, seed, pedestrianBlock, 250)
    ).filter(Boolean);
    if (this.config.shelters.length !== MANHATTAN.shelters.length) throw new Error('No pedestrian site for a shelter');
    this.config.shelter = this.config.shelters[0];
    this.civilianNav.flood(this.config.shelter);
    this.routeNav = new NavigationGrid(MANHATTAN.bounds, colliders);
    this.escapeRoutes=[{nav:this.civilianNav,goal:this.config.shelter}];
    for(const {x,z} of MANHATTAN.exits) {
      const nav=new NavigationGrid(MANHATTAN.bounds,colliders),goal=nav.nearest({x,z},30);
      if(goal){nav.flood(goal);this.escapeRoutes.push({nav,goal});}
    }
    this.config.pharmacy.heading = siteHeading(this.routeNav, this.config.pharmacy, this.config.spawn, 2.9, 2);
    this.config.relay.heading = siteHeading(this.routeNav, this.config.relay, this.config.radio, .8, 1);
    // Put the first collision on a visible approach to the shuttered pharmacy.
    const pharmacy = this.config.pharmacy;
    const collision = [9, -9, 6, -6].map(x => sitePoint(pharmacy, x, 8))
      .find(p => this.nav.clear(pharmacy, p));
    if (collision) {
      const [first, ...later] = this.config.fireSites;
      this.config.fireSites = [{ ...first, ...collision, heading: pharmacy.heading }, ...later];
    }
    this.mission = new Mission(this.config);
    this.incidents = new OutbreakIncidents(scene,this.config);
    this.actors = new OutbreakActors(scene, this.nav, controller, this.config);
    this.markers = new THREE.Group(); scene.add(this.markers);
    const ground = p => controller.getGroundHeight(p.x, p.z, 'person');
    this.pharmacy = createPharmacy(this.config.pharmacy, ground(this.config.pharmacy));
    this.relay = createNoticeBoard(this.config.relay, ground(this.config.relay));
    this.shelterGates = this.config.shelters.map(point => ({ point, ...createShelterGate(point, ground(point)) }));
    this.markers.add(this.pharmacy.group, this.relay.group, ...this.shelterGates.map(gate => gate.group));
    this.radio = this.createMarker(this.config.radio, 0x68b8ea);
    this.view = new OutbreakView({ onAnswer: () => this.mission.answerPhone(), onQuality, onStart: () => this.start(), onSkip: () => this.mission.skipIntro(),
      onPause: () => this.pause(), onLanguage: () => this.updateSigns(), onSound: () => audio.setEnabled(!audio.enabled) });
    this.view.bindTouch(touchControls.root, {
      onActivate: action => {
        if (!this.mission.playing) return;
        if (action === 'answer') this.mission.answerPhone();
        else if (action === 'vehicle') this.toggleVehicle();
      },
      onHold: (action, held) => { this.touchInteraction = held ? action : null; },
      onNoise: () => { if (this.mission.playing) this.distract(); }
    });
    controller.setMode('person'); controller.teleportActiveTo(this.config.spawn.x, this.config.spawn.z, this.config.spawn.heading);
    camera.resetForTeleport();
    this.lastSafe = { ...controller.entities.person.position }; this.uiClock = 0;
    document.body.classList.add('outbreak-mode');
    // Capture prevents explorer shortcuts (teleports, vehicles, free camera) during a mission.
    window.addEventListener('keydown', (e) => {
      if(e.code==='KeyE' && this.mission.playing && !e.repeat && !e.target.closest?.('select,input,button')){this.toggleVehicle();e.preventDefault();return;}
      if(e.code==='KeyQ' && this.mission.playing && !e.repeat && !e.target.closest?.('select,input,button')){this.distract();e.preventDefault();return;}
      if(e.code==='KeyF' && !e.repeat && this.mission.playing && this.mission.phase==='phone' && !this.mission.phoneAnswered){this.mission.answerPhone();e.preventDefault();return;}
      if(e.code==='KeyF' && !e.repeat && this.mission.playing && !e.target.closest?.('select,input,button')) {this.interacting=true;e.preventDefault();return;}
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.pause(); return; }
      if (e.target.closest?.('select,button,input')) return;
      if (/^(Digit\d|KeyM|KeyV|KeyH|KeyB|KeyN)$/.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    }, true);
    window.addEventListener('keyup', e=>{if(e.code==='KeyF')this.interacting=false;});
    window.addEventListener('blur', () => this.pause(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.updateSigns();
  }
  createMarker(point, color) {
    const group = new THREE.Group(); group.position.set(point.x, 0, point.z);
    const ringGeo = new THREE.RingGeometry(1.35, 1.5, 28); ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .52 }));
    ring.position.y = this.controller.getGroundHeight(point.x, point.z, 'person') + .035;
    group.add(ring); this.markers.add(group); return group;
  }
  updateSigns() {
    this.pharmacy.writeSign(this.view.t('pharmacySign'));
    this.relay.writeSign(this.view.t('relaySign'));
    for (const gate of this.shelterGates) gate.writeSign(this.view.t('shelterSign'));
    this.render();
  }
  toggleVehicle() {
    const c=this.controller, car=c.entities.car, person=c.entities.person;
    if(c.activeMode==='car') {
      if(Math.abs(car.speed)>1)return;
      const candidates=[-1,1].map(side=>({x:car.position.x+Math.cos(car.heading)*side*3,z:car.position.z-Math.sin(car.heading)*side*3}));
      const exit=candidates.find(p=>this.nav.open(this.nav.index(p)));
      if(!exit)return;
      c.setMode('person');c.missionDriving=false;c.teleportActiveTo(exit.x,exit.z,car.heading);
    } else if(distance(person.position,car.position)<5) {
      c.setMode('car');c.missionDriving=true;c.resetInput();
    } else return;
    this.lastSafe={...c.getActiveEntity().position};this.camera.resetForTeleport();this.render();
  }
  distract() {
    if(this.mission.elapsed<(this.nextDistraction || 0))return;
    const p=this.controller.getActiveEntity();
    const target={x:p.position.x+Math.sin(p.heading)*12,z:p.position.z+Math.cos(p.heading)*12};
    if(!this.nav.clear(p.position,target))return;
    this.actors.population.noise.emit(target,35,3);this.nextDistraction=this.mission.elapsed+8;
    this.sound.tone(180,.25,.12,target,true);
    if(!this.distractionMarker)this.distractionMarker=this.createMarker(target,0xb7d8ec);
    this.distractionMarker.position.set(target.x,0,target.z);this.distractionMarker.visible=true;
    this.distractionUntil=this.mission.elapsed+2;
  }
  parkEscapeCar() {
    const controller=this.controller, spawn=this.config.spawn;
    const candidates=[];
    for(const edge of this.roadNetwork?.edges || []) {
      if(edge.len<20)continue;
      const along=Math.max(9,Math.min(edge.len-9,(spawn.x-edge.sx)*edge.dx+(spawn.z-edge.sz)*edge.dz));
      const side=edge.lanes.at(-1) || 0;
      const x=edge.sx+edge.dx*along+edge.rx*side, z=edge.sz+edge.dz*along+edge.rz*side;
      const d=distance(spawn,{x,z});
      if(d>=10 && d<=80)candidates.push({x,z,d,heading:Math.atan2(edge.dx,edge.dz)});
    }
    candidates.sort((a,b)=>a.d-b.d);
    controller.setMode('car');
    for(const point of candidates) {
      if(!controller.findTeleportPosition(point.x,point.z,point.heading,0))continue;
      controller.teleportActiveTo(point.x,point.z,point.heading);
      if(distance(point,controller.entities.car.position)<5)break;
    }
    controller.setMode('person');
  }
  start() {
    this.touchInteraction=null; this.controller.missionDriving=false;this.nextDistraction=0;this.interacting=false; this.actors.prepare(); this.incidents.reset(); this.sound.reset(); this.mission.start(); this.controller.setMode('person');
    this.controller.teleportActiveTo(this.config.spawn.x, this.config.spawn.z, this.config.spawn.heading);
    this.camera.resetForTeleport(); this.lastSafe = { ...this.controller.entities.person.position };
    this.parkEscapeCar();
    this.controller.poseCharacters(0.016); this.render();
  }
  pause(force = false) {
    if (['menu', 'won', 'lost'].includes(this.mission.phase)) return;
    this.interacting=false;this.touchInteraction=null;this.mission.paused = force || !this.mission.paused; this.sound.stop(); this.controller.resetInput(); this.render();
  }
  beforeUpdate(dt) {
    if (!this.mission.playing) { this.controller.resetInput(); return false; }
    if (this.mission.exhausted) this.controller.keys.boost = false;
    return true;
  }
  update(dt) {
    if (document.hidden) return;
    const player = this.controller.getActiveEntity(), m = this.mission;
    player.driving=this.controller.activeMode==='car';
    if(this.distractionMarker)this.distractionMarker.visible=m.playing && m.elapsed<this.distractionUntil;
    this.boundary = false;
    if (m.playing) {
      // Keep the first episode in its navigable sector, without changing the explorer's map.
      const b = this.config.bounds;
      if (player.position.x < b.minX + 2 || player.position.x > b.maxX - 2 || player.position.z < b.minZ + 2 || player.position.z > b.maxZ - 2) {
        player.position.set(this.lastSafe.x, this.lastSafe.y, this.lastSafe.z); player.speed = 0; this.boundary = true;
      } else if (m.blocksGate(this.lastSafe, player.position, player.driving)) {
        player.position.copy(this.lastSafe);
        player.speed = 0;
      } else this.lastSafe = { ...player.position };
    }
    const previous = m.phase;
    const objective = m.objective;
    const touchHeld = this.touchInteraction === m.interactionAt(player.position) && this.touchInteraction != null;
    m.tick(dt, player.position, !player.driving && this.controller.keys.boost && Math.abs(player.speed) > 1,
      this.interacting || touchHeld, player.driving);
    if (objective !== m.objective) {
      this.interacting = false;
      this.touchInteraction = null;
      this.sound.tone(480, .25, .08);
    }
    if (previous !== 'escape' && m.phase === 'escape') this.actors.spawn();
    if (m.playing && !this.incidents.crashed && m.streetTime >= this.config.fireSites[0].start) {
      this.actors.population.noise.emit(this.config.fireSites[0], 60, 5);
    }
    if (m.playing) this.actors.update(dt, player, m, this.civilianNav, this.escapeRoutes);
    this.incidents.update(dt,m,player.position);
    this.sound.update(dt, m, this.actors.actors, player.position, this.incidents);
    for (const gate of this.shelterGates) gate.setOpening(m.openShelter === gate.point ? m.doorOpening : 0);
    if (previous !== m.phase || objective !== m.objective) this.render();
    this.view.root.classList.toggle('ze-hit', m.hurtCooldown > this.config.attackCooldown - 0.18);
    this.uiClock += dt;
    if (this.uiClock > 0.1) { this.uiClock = 0; this.render(); }
    // Reblend digital input after stamina temporarily suppresses sprint.
    if (m.playing) this.controller._blendInput('boost');
  }
  render() {
    if (!this.view) return;
    const m = this.mission, pos=this.controller.getActiveEntity().position;
    const refuge=this.config.shelters.reduce((a,b)=>distance(a,pos)<distance(b,pos)?a:b);
    const objective = m.objective;
    const target = objective === 'shelter' ? (m.openShelter || refuge.approach) : this.config[objective];
    const sitesVisible = !['menu', 'intro'].includes(m.phase);
    this.pharmacy.group.visible = sitesVisible;
    this.pharmacy.bag.visible = !m.hasSupplies;
    this.relay.group.visible = sitesVisible;
    this.radio.visible = sitesVisible && objective === 'radio';
    for (const gate of this.shelterGates) gate.group.visible = sitesVisible;
    let feed = m.streetTime < 10 ? 'street0' : m.streetTime < 24 ? 'street1' : 'street2';
    if (m.phase === 'errand' && m.hasSupplies) feed = 'suppliesMessage';
    if (m.phase === 'phone') feed = !m.phoneAnswered ? 'phoneIncoming' : m.callTime < 9 ? 'call0' : 'call1';
    if (m.phase === 'escape') {
      if (objective === 'shelter') feed = m.openShelter ? 'doorOpen' : 'relayMessage';
      else if (objective === 'relay') feed = 'dispatchMessage';
      else if (objective === 'radio') feed = 'suppliesMessage';
      else feed = m.callInterrupted ? 'cut' : 'pharmacyAlert';
    }
    const nearest=Math.min(999,...this.actors.actors.filter(a=>a.state==='zombie').map(a=>distance(a,pos)));
    if (m.playing && this.routeTarget !== target) {
      this.routeNav.flood(target);
      this.routeTarget = target;
    }
    this.route = m.playing ? this.routeNav.trace(pos) : [];
    this.view.route=this.route || [];
    this.view.vehiclePosition=this.controller.entities.car.position;
    this.view.vehicleNearby=distance(pos,this.controller.entities.car.position)<5;
    this.view.driving=this.controller.activeMode==='car';
    const touch = this.touchControls;
    if (touch.mode !== this.controller.activeMode) touch.setMode(this.controller.activeMode);
    if (touch.enabled !== m.playing) touch.setEnabled(m.playing);
    const onFoot = !this.view.driving;
    const worldAction = onFoot ? m.interactionAt(pos) : null;
    const phone = m.phase === 'phone' && !m.phoneAnswered;
    const vehicle = this.view.driving ? Math.abs(this.controller.getActiveEntity().speed) <= 1 : this.view.vehicleNearby;
    const context = phone ? 'answer' : worldAction || (vehicle ? 'vehicle' : null);
    this.view.updateTouch({ available: touch.available, context, driving: this.view.driving, noise: onFoot && m.elapsed >= (this.nextDistraction || 0) });
    this.view.render(m, { worldAction, threat: m.playing ? nearest : 999, infections: this.actors.population.infections, distance: this.route?.length>1?(this.route.length-1)*this.nav.cell:distance(pos,target), feed, boundary: this.boundary, sound: this.audio.enabled });
    if (m.playing) this.view.drawMap(this.nav, this.controller.getActiveEntity(), this.actors.actors, target);
  }
}
