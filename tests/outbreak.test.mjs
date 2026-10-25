import test from 'node:test';
import assert from 'node:assert/strict';
import { Mission, MANHATTAN } from '../js/outbreak/mission.js';
import { NavigationGrid } from '../js/outbreak/navigation.js';
import { MESSAGES, getLanguage } from '../js/outbreak/locales.js';

test('intro, hospital proximity AND finished call gate the outbreak; shelter ends it', () => {
  const m = new Mission(MANHATTAN); m.start();
  m.tick(42, MANHATTAN.hospital); assert.equal(m.phase, 'errand');
  m.tick(10, MANHATTAN.hospital); assert.equal(m.phase, 'errand');
  m.tick(15, MANHATTAN.spawn); assert.equal(m.phase, 'errand');
  m.tick(0.1, MANHATTAN.hospital); assert.equal(m.phase, 'escape');
  m.tick(1, MANHATTAN.shelter); assert.equal(m.phase, 'escape');
  m.tick(17, MANHATTAN.radio, false, true); assert.equal(m.radioReady,true);
  m.tick(1, MANHATTAN.shelter); assert.equal(m.phase, 'won');
  m.hurt(); assert.equal(m.health, 100);
});

test('pause freezes timers and damage; damage has shared invulnerability; restart clears state', () => {
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro(); m.tick(25, MANHATTAN.hospital);
  assert.equal(m.hurt(), true); assert.equal(m.hurt(), false); assert.equal(m.health, 86);
  m.paused = true; m.tick(60, MANHATTAN.shelter, true); m.hurt();
  assert.equal(m.phase, 'escape'); assert.equal(m.time, 0); assert.equal(m.health, 86);
  m.paused = false;
  for (let i = 0; i < 8; i++) { m.tick(1.3, MANHATTAN.hospital); m.hurt(); }
  assert.equal(m.phase, 'lost'); assert.equal(m.health, 0);
  m.tick(2, MANHATTAN.shelter); assert.equal(m.phase, 'lost');
  m.start(); assert.equal(m.health, 100); assert.equal(m.paused, false); assert.equal(m.stamina, 100);
});

test('sprint exhausts and requires recovery, rather than oscillating every frame', () => {
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro();
  m.tick(6, MANHATTAN.spawn, true); assert.equal(m.stamina, 0); assert.equal(m.exhausted, true);
  m.tick(1, MANHATTAN.spawn, true); assert.equal(m.stamina, 11); assert.equal(m.exhausted, true);
  m.tick(2, MANHATTAN.spawn, false); m.tick(0, MANHATTAN.spawn);
  assert.equal(m.exhausted, false);
});

test('flow field routes around a wall and movement never enters its cells', () => {
  const nav = new NavigationGrid({ minX: 0, maxX: 40, minZ: 0, maxZ: 40 }, [{ minX: 18, maxX: 20, minZ: 0, maxZ: 25, maxY: 5 }]);
  let p = { x: 9, z: 9 }; const goal = { x: 29, z: 9 };
  assert.equal(nav.clear(p, goal), false); nav.flood(goal);
  assert.ok(nav.cost[nav.index(p)] > 0);
  for (let i = 0; i < 1000; i++) {
    const q = nav.step(p, goal, 0.3); assert.ok(nav.clear(p, q)); p = q;
  }
  assert.ok(Math.hypot(p.x - goal.x, p.z - goal.z) < 0.1);
});

test('sealed targets, boundaries, and tall overhead objects are handled safely', () => {
  const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };
  const nav = new NavigationGrid(bounds, [{ minX: 8, maxX: 10, minZ: -5, maxZ: 25, maxY: 5 }]);
  nav.flood({ x: 17, z: 9 });
  assert.equal(nav.cost[nav.index({ x: 3, z: 9 })], -1);
  assert.deepEqual(nav.step({ x: 3, z: 9 }, { x: 17, z: 9 }, 1), { x: 3, z: 9 });
  assert.equal(nav.index({ x: 20, z: 9 }), -1);
  assert.equal(nav.clear({ x: 1, z: 1 }, { x: -1, z: 1 }), false);
  const bridge = new NavigationGrid(bounds, [{ minX: 0, maxX: 20, minZ: 0, maxZ: 20, minY: 8, maxY: 10 }]);
  assert.equal(bridge.blocked.some(Boolean), false);
});

test('all narrative/UI keys exist in both languages and unavailable storage defaults to Spanish', () => {
  assert.deepEqual(Object.keys(MESSAGES.es).sort(), Object.keys(MESSAGES.en).sort());
  assert.ok(Object.values(MESSAGES.es).every((s) => typeof s === 'string' && s.length));
  assert.equal(getLanguage({ getItem: () => { throw new Error('disabled'); } }), 'es');
  assert.equal(getLanguage({ getItem: () => 'en' }), 'en');
  assert.equal(getLanguage({ getItem: () => 'other' }), 'es');
});

import { Population } from '../js/outbreak/population.js';

test('contact infects a civilian, incubates, then converts the same actor to a slow zombie', () => {
  const p = new Population(MANHATTAN), person = p.add({ x: 0, z: 0 });
  p.add({ x: 1, z: 0 }, true); p.activate();
  const player = { x: 50, z: 0 };
  p.update(.25, player, () => true, () => assert.fail('player is distant'));
  assert.equal(person.state, 'bitten'); assert.equal(p.infections, 1);
  assert.equal(p.infect(person), false);
  p.update(6, player, () => true, () => {}); assert.equal(person.state, 'turning');
  p.update(2, player, () => true, () => {}); assert.equal(person.state, 'zombie');
  assert.equal(person.civilian, false); assert.equal(p.actors.length, 2);
  assert.ok(MANHATTAN.zombieSpeed >= 2 && MANHATTAN.zombieSpeed + .16 < 3);
});

test('conversion can propagate to another civilian, but walls block detection and contagion', () => {
  const p = new Population(MANHATTAN), first = p.add({ x: 0, z: 0 });
  p.add({ x: 1, z: 0 }, true); p.activate();
  const player = { x: 50, z: 0 };
  p.update(.25, player, () => false, () => {}); assert.equal(first.state, 'normal');
  p.update(.25, player, () => true, () => {}); p.update(6, player, () => true, () => {}); p.update(2, player, () => true, () => {});
  const next = p.add({ x: -.5, z: 0 });
  p.update(.25, player, () => true, () => {}); assert.equal(next.state, 'bitten');
  assert.equal(p.infections, 2); assert.equal(p.actors.length, 3);
});

test('nearby civilians flee; sheltered people are safe; inactive population cannot infect', () => {
  const p = new Population(MANHATTAN), person = p.add({ x: 0, z: 0 });
  p.add({ x: 5, z: 0 }, true);
  p.update(1, { x: 50, z: 0 }, () => true, () => {}); assert.equal(person.state, 'normal');
  p.activate();p.update(.25, { x: 50, z: 0 }, () => true, () => {});assert.equal(person.state, 'fleeing');
  Object.assign(person, MANHATTAN.shelter);p.update(.25, { x: 50, z: 0 }, () => true, () => {});
  assert.equal(person.sheltered, true);assert.equal(p.infect(person), false);
  p.reset();assert.equal(p.infections, 0);assert.equal(p.actors.length, 0);
});

import { OutbreakSound } from '../js/outbreak/sound.js';
test('phone and disconnect cues fire on state transitions, with silence during pause/mute', () => {
  const audio = { enabled: true, context: {state:'running'} }, sound = new OutbreakSound(audio), cues = [];
  sound.tone = (...args) => cues.push(args);
  const mission = { phase:'errand', time:0, paused:false, config:MANHATTAN };
  sound.update(.1,mission,[],{x:0,z:0}); sound.update(.1,mission,[],{x:0,z:0});
  assert.equal(cues.length,2); // two frequencies, once
  mission.phase='escape';mission.time=10;sound.update(.1,mission,[],{x:0,z:0});
  assert.ok(cues.length>=3);
  const beforePause=cues.length;
  mission.paused=true;mission.time=0;sound.update(.1,mission,[],{x:0,z:0});assert.equal(cues.length,beforePause);
  mission.paused=false;audio.enabled=false;sound.update(.1,mission,[],{x:0,z:0});assert.equal(cues.length,beforePause);
  sound.reset();assert.equal(sound.lastCue,null);
});

test('procedural audio limits voices and releases nodes when stopped', () => {
  const param = () => ({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node = () => ({connect(){return this;},disconnect(){}});
  const context = { state:'running',currentTime:0,
    createOscillator(){return {...node(),frequency:param(),start(){},stop(){this.onended?.();}};},
    createGain(){return {...node(),gain:param()};},createBiquadFilter(){return {...node(),frequency:param()};}
  };
  const sound = new OutbreakSound({enabled:true,context,mix:node()});
  // Scheduled stop normally fires asynchronously; hold it until an explicit reset.
  context.createOscillator=()=>({...node(),frequency:param(),start(){},stop(){}});
  for(let i=0;i<20;i++)sound.tone(440,.5);
  assert.equal(sound.voices.size,6);sound.stop();assert.equal(sound.voices.size,0);
});

test('radio requires arrival and uninterrupted nearby interaction; evacuation stays locked until then',()=>{
 const m=new Mission(MANHATTAN);m.start();m.skipIntro();m.tick(25,MANHATTAN.hospital);
 m.tick(10,MANHATTAN.radio,false,true);assert.equal(m.radioReady,false);
 m.tick(8,MANHATTAN.radio,false,true); // arrival has occurred
 assert.equal(m.radioReady,true);
 m.start();m.skipIntro();m.tick(25,MANHATTAN.hospital);m.tick(17,MANHATTAN.hospital);
 m.tick(1.5,MANHATTAN.radio,false,true);assert.equal(m.radioReady,false);
 m.tick(.1,MANHATTAN.spawn,false,true);assert.equal(m.radioProgress,0);
 m.tick(2,MANHATTAN.radio,false,true);assert.equal(m.radioReady,false);
 m.tick(1,MANHATTAN.radio,false,true);assert.equal(m.radioReady,true);
});

test('hunters pursue the player instead of distant civilians, but can still bite a touching victim',()=>{
 const p=new Population(MANHATTAN),civilian=p.add({x:0,z:0});const hunter=p.add({x:2,z:0},true);p.activate();
 const player={x:30,z:0};p.update(.25,player,()=>true,()=>{});assert.equal(hunter.target,player);
 hunter.x=1;p.update(.25,player,()=>true,()=>{});assert.equal(civilian.state,'bitten');
});
