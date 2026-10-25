// Short procedural cues share the city's audio context, limiter and master volume.
export class OutbreakSound {
  constructor(audio) { this.audio=audio; this.voices=new Set();this.lastCue=null;this.growlTime=0; }
  stop() { for(const voice of this.voices) { try{voice.stop();}catch{} } this.voices.clear(); }
  tone(frequency,duration,volume=.06,position=null,rasp=false) {
    const {context,mix,enabled}=this.audio;
    if(!enabled || !context || context.state!=='running' || this.voices.size>=6) return;
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type=rasp?'sawtooth':'sine';osc.frequency.setValueAtTime(frequency,now);
    osc.frequency.exponentialRampToValueAtTime(frequency*(rasp ? .55 : .98),now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.03);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=rasp?550:1800;
    let tail=gain,pan=null;
    if(position) { pan=context.createPanner();pan.panningModel='equalpower';pan.distanceModel='inverse';pan.refDistance=3;pan.maxDistance=45;pan.rolloffFactor=1.5;
      pan.positionX.value=position.x;pan.positionY.value=1.4;pan.positionZ.value=position.z;gain.connect(pan);tail=pan; }
    osc.connect(filter).connect(gain);tail.connect(mix);
    this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();filter.disconnect();gain.disconnect();pan?.disconnect();};
    osc.start();osc.stop(now+duration+.02);
  }
  update(dt,mission,actors,player) {
    if(mission.paused || ['menu','won','lost'].includes(mission.phase) || !this.audio.enabled) {this.stop();return;}
    const cue=mission.phase==='intro'?`news${Math.min(2,Math.floor(mission.time/14))}`:
      mission.phase==='errand'?(mission.time<2?'phone':'call'):mission.time<9?'alarm':mission.time<23?'disconnect':'escape';
    if(cue!==this.lastCue) {
      this.lastCue=cue;
      if(cue==='phone') {this.tone(660,.7,.09);this.tone(880,.7,.045);}
      else if(cue==='disconnect') this.tone(440,.5,.07);
      else if(cue==='alarm') {this.tone(740,1.6,.07,mission.config.hospital);this.tone(960,1.6,.035,mission.config.hospital);}
      else if(cue.startsWith('news')) this.tone(520,.2,.035);
    }
    this.growlTime-=dt;
    if(mission.phase==='escape' && this.growlTime<=0) {
      const nearby=actors.filter(a=>a.state==='zombie' && Math.hypot(a.x-player.x,a.z-player.z)<35);
      if(nearby.length) { const a=nearby[Math.floor(Math.random()*nearby.length)];this.tone(65+Math.random()*45,.7+Math.random()*.7,.1,a,true); }
      this.growlTime=1.2+Math.random()*1.5;
    }
  }
  reset() { this.stop();this.lastCue=null;this.growlTime=0; }
}
