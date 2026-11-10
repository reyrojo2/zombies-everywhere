import test from 'node:test';
import assert from 'node:assert/strict';
import { Mission, MANHATTAN } from '../js/outbreak/mission.js';
import { NavigationGrid, shelterSite, sitePoint } from '../js/outbreak/navigation.js';
import { MESSAGES, getLanguage } from '../js/outbreak/locales.js';

test('outbreak advances away from hospital and either refuge can finish the mission', () => {
  const m=new Mission(MANHATTAN);m.start();m.tick(48,MANHATTAN.spawn);assert.equal(m.phase,'errand');
  m.tick(5,MANHATTAN.spawn);assert.equal(m.phase,'phone');assert.equal(m.playing,true);
  m.answerPhone();m.tick(20,MANHATTAN.spawn);assert.equal(m.callComplete,true);assert.equal(m.phase,'errand');
  m.tick(17,MANHATTAN.spawn);assert.equal(m.phase,'escape');
  m.tick(1,MANHATTAN.pharmacy,false,true);assert.equal(m.hasSupplies,true);
  m.tick(20,MANHATTAN.radio,false,true);assert.equal(m.radioReady,true);
  const gate = MANHATTAN.shelters[1], approach = { x: gate.x, z: gate.z + 2 }, inside = { x: gate.x, z: gate.z - 1 };
  m.tick(.1,approach);assert.equal(m.phase,'escape');
  m.tick(1,MANHATTAN.relay,false,true);assert.equal(m.relayRead,true);
  assert.equal(m.blocksGate(approach, inside, false), true);
  m.tick(1,approach,false,true,true);assert.equal(m.openShelter,null);
  m.tick(.55,approach,false,true);
  m.tick(.7,approach);
  assert.equal(m.openShelter,gate);
  assert.equal(m.blocksGate(approach,inside,true),true);
  assert.equal(m.blocksGate(approach,inside,false),false);
  m.tick(.1,inside);
  assert.equal(m.phase,'secured');
  m.tick(1.2,inside);assert.equal(m.phase,'won');
});

test('pause freezes timers and damage; damage has shared invulnerability; restart clears state', () => {
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro(); m.callComplete=true; m.tick(25, MANHATTAN.hospital);
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
  const m = new Mission(MANHATTAN); m.start(); m.skipIntro(); m.callComplete=true;
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
  for(let i=0;i<4;i++)p.update(.25, player, () => true, () => assert.fail('player is distant'));
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
  for(let i=0;i<4;i++)p.update(.25, player, () => true, () => {}); p.update(6, player, () => true, () => {}); p.update(2, player, () => true, () => {});
  const next = p.add({ x: -.5, z: 0 });
  for(let i=0;i<4;i++)p.update(.25, player, () => true, () => {}); assert.equal(next.state, 'bitten');
  assert.equal(p.infections, 2); assert.equal(p.actors.length, 3);
});

test('nearby civilians flee; sheltered people are safe; inactive population cannot infect', () => {
  const p = new Population(MANHATTAN), person = p.add({ x: 0, z: 0 });
  p.add({ x: 5, z: 0 }, true);
  p.update(1, { x: 50, z: 0 }, () => true, () => {}); assert.equal(person.state, 'normal');
  p.activate();p.update(.25, { x: 50, z: 0 }, () => true, () => {});assert.equal(person.state, 'fleeing');
  person.sheltered=true;p.update(.25, { x: 50, z: 0 }, () => true, () => {});
  assert.equal(person.sheltered, true);assert.equal(p.infect(person), false);
  p.reset();assert.equal(p.infections, 0);assert.equal(p.actors.length, 0);
});

import { OutbreakSound } from '../js/outbreak/sound.js';
test('phone and disconnect cues fire on state transitions, with silence during pause/mute', () => {
  const audio = { enabled: true, context: {state:'running'} }, sound = new OutbreakSound(audio), cues = [];
  sound.tone = (...args) => cues.push(args);
  const mission = { phase:'phone', phoneAnswered:false, time:0, paused:false, config:MANHATTAN };
  sound.update(.1,mission,[],{x:0,z:0}); sound.update(.1,mission,[],{x:0,z:0});
  assert.equal(cues.length,2); // two frequencies, once
  mission.phase='escape';mission.callInterrupted=true;mission.time=10;sound.update(.1,mission,[],{x:0,z:0});
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

test('chapter interactions require proximity and continuous input, and restart resets objectives', () => {
  const m = new Mission(MANHATTAN);
  m.start(); m.skipIntro(); m.tick(42, MANHATTAN.spawn);
  m.tick(30, MANHATTAN.radio, false, true);
  assert.equal(m.radioReady, false, 'collect supplies before trying the radio');
  m.tick(.75, MANHATTAN.pharmacy, false, true);
  m.tick(.1, MANHATTAN.pharmacy);
  m.tick(.5, MANHATTAN.pharmacy, false, true);
  assert.equal(m.hasSupplies, false, 'letting go resets progress');
  m.tick(.5, MANHATTAN.pharmacy, false, true);
  assert.equal(m.objective, 'radio');
  m.tick(3, MANHATTAN.radio, false, true, true);
  assert.equal(m.radioReady, false, 'cannot use patrol radio from inside the vehicle');
  m.tick(1.5, MANHATTAN.radio, false, true);
  m.tick(.1, MANHATTAN.spawn, false, true);
  m.tick(2, MANHATTAN.radio, false, true);
  assert.equal(m.radioReady, false, 'leaving the radius resets progress');
  m.tick(1, MANHATTAN.radio, false, true);
  assert.equal(m.objective, 'relay');
  m.start();
  assert.equal(m.objective, 'pharmacy');
  assert.equal(m.actionProgress, 0);
});

test('infected remember a position, lose a hidden player and telegraph bites',()=>{
 const p=new Population(MANHATTAN),z=p.add({x:0,z:0},true);z.heading=Math.PI/2;p.activate();
 const player={x:20,z:0};p.update(.2,player,()=>true,()=>{});
 assert.deepEqual(z.target,{x:20,z:0});assert.notEqual(z.target,player);
 player.x=35;p.update(.2,player,()=>false,()=>{});assert.equal(z.target.x,20);
 p.update(8,player,()=>false,()=>{});assert.equal(z.target,null);
 player.x=1;let bites=0;p.update(.2,player,()=>true,()=>bites++);assert.equal(bites,0);
 player.x=40;p.update(.2,player,()=>true,()=>bites++);assert.equal(z.windup,0);
 player.x=1;for(let i=0;i<4;i++)p.update(.2,player,()=>true,()=>bites++);
 assert.equal(bites,1);
});

test('phone runs in the background without resetting the street clock or blocking movement',()=>{
 const m=new Mission(MANHATTAN);m.start();m.skipIntro();
 m.tick(5,MANHATTAN.spawn);assert.equal(m.phase,'phone');assert.equal(m.playing,true);
 m.answerPhone();assert.equal(m.time,5);assert.equal(m.phoneAnswered,true);
 m.tick(3,MANHATTAN.spawn,true);assert.ok(m.stamina<100);assert.equal(m.callTime,3);
 m.paused=true;m.tick(20,MANHATTAN.hospital);assert.equal(m.callTime,3);assert.equal(m.streetTime,8);
 m.paused=false;m.tick(17,MANHATTAN.spawn);assert.equal(m.phase,'errand');assert.equal(m.callComplete,true);
 m.start();assert.equal(m.callComplete,false);assert.equal(m.streetTime,0);
});

test('ignoring a call never prevents the neighborhood outbreak',()=>{
 const m=new Mission(MANHATTAN);m.start();m.skipIntro();m.tick(43,MANHATTAN.spawn);
 assert.equal(m.phase,'escape');assert.equal(m.phoneAnswered,false);assert.equal(m.playing,true);
});

test('news and calls never invoke browser speech synthesis',()=>{
 const old=globalThis.speechSynthesis;globalThis.speechSynthesis={speak(){assert.fail('synthetic speech');}};
 try {
 const sound=new OutbreakSound({enabled:true,context:{state:'running'}});sound.tone=()=>{};
 const m=new Mission(MANHATTAN);m.start();sound.update(.1,m,[],{},null,k=>k,'es');
 m.skipIntro();m.phase='phone';m.answerPhone();sound.update(.1,m,[],{},null,k=>k,'es');
 } finally {globalThis.speechSynthesis=old;}
});

test('mission starts in the existing West Village residential profile',async()=>{
 const {districtAt}=await import('../js/city-config.js');
 assert.equal(districtAt(MANHATTAN.spawn.x,MANHATTAN.spawn.z),'west_village');
 assert.ok(MANHATTAN.shelters.length>1);assert.ok(MANHATTAN.hospital.x!==MANHATTAN.spawn.x);
});

test('story clock is continuous, pauses, rolls dates and resets with infection',()=>{
 const m=new Mission({...MANHATTAN,storyStart:'2020-02-03T23:59:59Z'});m.start();
 m.tick(2,MANHATTAN.spawn);assert.equal(m.storyDate.toISOString(),'2020-02-04T00:00:01.000Z');
 m.paused=true;m.tick(100,MANHATTAN.spawn);assert.equal(m.elapsed,2);
 m.paused=false;m.skipIntro();m.tick(15,MANHATTAN.spawn);assert.equal(m.bite(),true);
 const remaining=m.infectionRemaining;m.paused=true;m.tick(60,MANHATTAN.spawn);assert.equal(m.infectionRemaining,remaining);
 m.paused=false;m.tick(remaining,MANHATTAN.spawn);assert.equal(m.phase,'lost');assert.equal(m.lossReason,'infection');
 const elapsed=m.elapsed;m.tick(100,MANHATTAN.spawn);assert.equal(m.elapsed,elapsed);
 m.start();assert.equal(m.elapsed,0);assert.equal(m.infectionRemaining,null);
});

import {NoiseField,sees,SpatialGrid} from '../js/outbreak/perception.js';
test('noise attenuates behind walls, expires, and aging reduces sight',()=>{
 const field=new NoiseField(),a={x:0,z:0,heading:Math.PI/2};
 field.emit({x:20,z:0},30);assert.ok(field.hear(a,()=>true));assert.equal(field.hear(a,()=>false),null);
 field.tick(3);assert.equal(field.events.length,0);
 assert.equal(sees(a,{x:20,z:0},()=>true),true);a.infectedAge=150;assert.equal(sees(a,{x:20,z:0},()=>true),false);
 assert.equal(sees(a,{x:1,z:0},()=>false),false);
});
test('route guidance avoids blocked cells, spatial separation uses local neighbors',()=>{
 const nav=new NavigationGrid({minX:0,minZ:0,maxX:50,maxZ:50},[{minX:20,maxX:22,minZ:0,maxZ:30}]);
 const start={x:9,z:9}, goal={x:29,z:9};
 const path=nav.path(start,goal);assert.ok(path.length>10);
 nav.flood(goal);
 const traced=nav.trace(start);
 assert.equal(traced.length,path.length);
 assert.deepEqual(traced.at(-1),goal);
 for(let i=1;i<traced.length;i++)assert.equal(nav.clear(traced[i-1],traced[i]),true);
 const a={x:0,z:0},b={x:1,z:1},far={x:50,z:50};const grid=new SpatialGrid([a,b,far]);
 assert.ok(grid.nearby(a).includes(b));assert.ok(!grid.nearby(a).includes(far));
});


test('only a call active at the outbreak can be interrupted', () => {
  const complete = new Mission(MANHATTAN);
  complete.start(); complete.skipIntro(); complete.tick(5, MANHATTAN.spawn); complete.answerPhone();
  complete.tick(21, MANHATTAN.spawn); complete.tick(17, MANHATTAN.spawn);
  assert.equal(complete.phase, 'escape');
  assert.equal(complete.callInterruptedAt, null);

  const active = new Mission(MANHATTAN);
  active.start(); active.skipIntro(); active.tick(5, MANHATTAN.spawn); active.answerPhone();
  active.tick(17, MANHATTAN.hospital);
  assert.equal(active.phase, 'escape');
  assert.equal(active.callInterruptedAt, 22);
});


test('shelter placement rejects the roadway and keeps its full footprint and approach on the same curb island', () => {
  const nav = new NavigationGrid({ minX: 0, maxX: 50, minZ: 0, maxZ: 50 }, [
    { minX: 12, maxX: 28, minZ: 12, maxZ: 32 }
  ]);
  nav.flood({ x: 7, z: 5 });
  const sidewalk = (x, z) => x >= 10 && x <= 40 && z >= 8 && z <= 42 ? 'block' : null;
  const gate = shelterSite(nav, { x: 7, z: 15 }, sidewalk, 36);
  assert.ok(gate);
  for (const x of [-2.55, 0, 2.55]) {
    const start = sitePoint(gate, x, -4.45), end = sitePoint(gate, x, .3);
    assert.equal(sidewalk(start.x, start.z), 'block');
    assert.equal(sidewalk(end.x, end.z), 'block');
    assert.equal(nav.clear(start, end), true);
  }
  assert.equal(sidewalk(gate.approach.x, gate.approach.z), 'block');
  assert.equal(shelterSite(nav, { x: 7, z: 15 }, () => null, 36), null);
});
