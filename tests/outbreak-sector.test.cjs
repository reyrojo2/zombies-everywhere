const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadModule}=require('./helpers/module.cjs');
const sector=loadModule(fs.readFileSync(require('node:path').join(__dirname,'../js/outbreak/sector.js'),'utf8'),{
  imports:{'three/webgpu':{},'three/addons/utils/BufferGeometryUtils.js':{},'../city-config.js':{BLOCKS:[],STREETS:[]}}
});
test('sector includes intersecting blocks and excludes distant boroughs',()=>{
 const bounds={minX:-460,maxX:280,minZ:-700,maxZ:240};
 assert.equal(sector.intersectsSector({minX:-60,maxX:60,minZ:-40,maxZ:40},bounds),true);
 assert.equal(sector.intersectsSector({minX:1500,maxX:1700,minZ:0,maxZ:40},bounds),false);
 assert.equal(sector.intersectsSector({minX:-30,maxX:30,minZ:-5000,maxZ:-4500},bounds),false);
});

test('street incidents start gradually before hospital arrival and respect pause',async()=>{
 const {MANHATTAN}=await import('../js/outbreak/mission.js');
 class Vector{set(x,y,z){this.x=x;this.y=y;this.z=z;}setScalar(s){this.set(s,s,s);}}
 class Group{constructor(){this.position=new Vector();this.rotation={};this.scale=new Vector();this.userData={};this.children=[];}add(m){this.children.push(m);}}
 class Mesh extends Group{}
 const THREE={Group,Mesh,PointLight:class extends Group{},MeshStandardMaterial:class{},MeshBasicMaterial:class{},BoxGeometry:class{},CylinderGeometry:class{},ConeGeometry:class{},IcosahedronGeometry:class{}};
 const {OutbreakIncidents}=loadModule(fs.readFileSync(require('node:path').join(__dirname,'../js/outbreak/incidents.js'),'utf8'),{imports:{'three/webgpu':THREE,'../city-config.js':{streetZ:n=>(42-n)*80}}});
 const incidents=new OutbreakIncidents(new Group(),MANHATTAN),mission={phase:'errand',time:2,streetTime:2,paused:false,hurt(){}};
 incidents.update(.1,mission,{x:-100,z:0});assert.equal(incidents.crashed,false);
 mission.time=30;mission.streetTime=30;incidents.update(.1,mission,{x:-100,z:0});assert.equal(incidents.crashed,true);assert.equal(incidents.police.visible,true);
 assert.equal(incidents.flames.filter(f=>f.mesh.visible).length,14);
 const before=incidents.carA.position.z;mission.paused=true;mission.time=0;incidents.update(.1,mission,{});assert.equal(incidents.carA.position.z,before);
 incidents.reset();assert.equal(incidents.group.visible,false);assert.equal(incidents.crashed,false);
});

test('reinforcements arrive in four bounded waves and restart resets the director',async()=>{
 const {Population}=await import('../js/outbreak/population.js');
 const {MANHATTAN,distance}=await import('../js/outbreak/mission.js');
 class Crowd{constructor(){this.meshes=[];}begin(){}end(){}add(){}}
 class Rig{update(){}}
 class Models{reset(){}draw(){}}
 const {OutbreakActors}=loadModule(fs.readFileSync(require('node:path').join(__dirname,'../js/outbreak/actors.js'),'utf8'),{imports:{
  '../pedestrians.js':{PersonCrowd:Crowd,PersonRig:Rig},'./mission.js':{distance},'./population.js':{Population},
  '../city-config.js':{streetZ:n=>(42-n)*80},'./zombie-model.js':{ZombieModels:Models}
 }});
 const nav={nearest:p=>p,clear:()=>true,flood(){},step:p=>p,index:()=>0,cost:[0]};
 const actors=new OutbreakActors({add(){}},nav,{getGroundHeight:()=>0},MANHATTAN);
 actors.prepare();actors.spawn();assert.equal(actors.actors.length,116);
 const mission={phase:'escape',time:7,hurt(){}};
 for(const time of [7,16,25,34,100]) {mission.time=time;actors.update(.01,{position:{x:0,z:100}},mission,nav);}
 assert.equal(actors.actors.length,132);assert.equal(actors.wave,4);
 actors.prepare();assert.equal(actors.actors.length,104);assert.equal(actors.wave,0);
});

test('500 nearest blocks are selected deterministically without mutating geography',()=>{
 const blocks=Array.from({length:600},(_,id)=>({id,minX:id*10,maxX:id*10+5,minZ:0,maxZ:5}));
 const selected=sector.selectMissionBlocks(blocks,{minX:0,maxX:20,minZ:0,maxZ:20});
 assert.equal(selected.length,500);assert.equal(new Set(selected.map(b=>b.id)).size,500);
 assert.ok(selected.some(b=>b.id===0));assert.ok(!selected.some(b=>b.id===599));assert.equal(blocks.length,600);
});

test('civilian routes produce different escape directions instead of one shared queue',async()=>{
 const {Population}=await import('../js/outbreak/population.js');const {MANHATTAN,distance}=await import('../js/outbreak/mission.js');
 class Crowd{constructor(){this.meshes=[];}begin(){}end(){}add(){}}class Rig{update(){}}class Models{reset(){}draw(){}}
 const {OutbreakActors}=loadModule(fs.readFileSync(require('node:path').join(__dirname,'../js/outbreak/actors.js'),'utf8'),{imports:{
 '../pedestrians.js':{PersonCrowd:Crowd,PersonRig:Rig},'./mission.js':{distance},'./population.js':{Population},'../city-config.js':{streetZ:n=>(42-n)*80},'./zombie-model.js':{ZombieModels:Models}}});
 const nav={nearest:p=>p,clear:()=>true,flood(){},index:()=>0,cost:[0],step(p,t,s){const d=Math.hypot(t.x-p.x,t.z-p.z)||1;return {x:p.x+(t.x-p.x)/d*s,z:p.z+(t.z-p.z)/d*s};}};
 const actors=new OutbreakActors({add(){}},nav,{getGroundHeight:()=>0},MANHATTAN);actors.prepare();actors.spawn();
 const before=actors.actors.slice(0,4).map(a=>({...a}));
 const routes=[{nav,goal:{x:10000,z:-100}},{nav,goal:{x:-10000,z:-185}},{nav,goal:{x:25,z:-10000}},{nav,goal:{x:-90,z:10000}}];
 actors.update(.1,{position:{x:1000,z:1000}},{time:1,hurt(){}},nav,routes);
 assert.ok(actors.actors[0].x>before[0].x);assert.ok(actors.actors[1].x<before[1].x);
 assert.ok(actors.actors[2].z<before[2].z);assert.ok(actors.actors[3].z>before[3].z);
});


test('irregular residential curbs keep real streets open to traffic',async()=>{
 const {BLOCKS}=await import('../js/city-config.js');
 const {MANHATTAN}=await import('../js/outbreak/mission.js');
 const {buildRoadNetwork}=await import('../js/road-network.js');
 const selected=sector.selectMissionBlocks(BLOCKS,MANHATTAN.bounds);
 const network=buildRoadNetwork(sector.missionSidewalkFootprints(selected),[]);
 const nearby=network.edges.filter(e=>Math.hypot(e.sx+e.dx*e.len/2-MANHATTAN.spawn.x,e.sz+e.dz*e.len/2-MANHATTAN.spawn.z)<400);
 assert.ok(nearby.length>20,'the mission must keep a connected local road population, not close diagonal streets with block bounding boxes');
});
