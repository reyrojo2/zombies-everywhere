// Short procedural cues share the city's audio context, limiter and master volume.
export class OutbreakSound {
  constructor(audio) { this.audio=audio; this.voices=new Set();this.lastCue=null;this.growlTime=0;this.ambienceTime=0;this.crashPlayed=false;this.buffers=[];this.samples={};this.loading=null;this.musicVoice=null;this.screamTime=0;this.ringTime=0; }
  loadSamples() {
    const context=this.audio.context;
    if(this.loading || !context?.decodeAudioData)return;
    const names=['growl-1','growl-2','growl-3','news-theme','panic-scream'];
    this.loading=Promise.allSettled(names.map(async name=>{
      const response=await fetch(new URL(`../../assets/audio/${name}.mp3`,import.meta.url));
      if(!response.ok)throw new Error('Audio unavailable: '+name);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());this.samples[name]=buffer;
    })).then(()=>{this.buffers=[1,2,3].map(n=>this.samples['growl-'+n]).filter(Boolean);});
  }
  playSample(name,volume=.3,position=null,loop=false,offset=0) {
    const {context,mix,enabled}=this.audio,buffer=this.samples[name];
    if(!buffer || !enabled || context?.state!=='running' || this.voices.size>=6)return null;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=loop;gain.gain.value=volume;
    let pan=null;source.connect(gain);
    if(position){pan=context.createPanner();pan.panningModel='equalpower';pan.refDistance=12;pan.rolloffFactor=.7;pan.positionX.value=position.x;pan.positionY.value=1.6;pan.positionZ.value=position.z;gain.connect(pan).connect(mix);}else gain.connect(mix);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);if(this.musicVoice===source)this.musicVoice=null;source.disconnect();gain.disconnect();pan?.disconnect();};
    source.start(0,offset%buffer.duration);return source;
  }

  growl(position,index=0) {
    const {context,mix,enabled}=this.audio;
    if(!enabled || context?.state!=='running' || this.voices.size>=6)return;
    if(!this.buffers.length) {this.tone(180,.8,.16,position,true);return;}
    const source=context.createBufferSource(),gain=context.createGain(),pan=context.createPanner();
    source.buffer=this.buffers[index%this.buffers.length];source.playbackRate.value=.92+(index%4)*.04;gain.gain.value=.65;
    pan.panningModel='equalpower';pan.distanceModel='inverse';pan.refDistance=10;pan.rolloffFactor=.7;pan.maxDistance=100;
    pan.positionX.value=position.x;pan.positionY.value=1.4;pan.positionZ.value=position.z;
    source.connect(gain).connect(pan).connect(mix);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};source.start();
  }
  stop() { for(const voice of this.voices) { try{voice.stop();}catch{} } this.voices.clear();this.musicVoice=null; }
  tone(frequency,duration,volume=.06,position=null,rasp=false,endFrequency=null) {
    const {context,mix,enabled}=this.audio;
    if(!enabled || !context || context.state!=='running' || this.voices.size>=6) return;
    if(rasp)frequency=Math.max(150,frequency);
    const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type=rasp?'sawtooth':'sine';osc.frequency.setValueAtTime(frequency,now);
    osc.frequency.exponentialRampToValueAtTime(endFrequency ?? frequency*(rasp ? .65 : .98),now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.03);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=rasp?1500:2200;
    let tail=gain,pan=null;
    if(position) { pan=context.createPanner();pan.panningModel='equalpower';pan.distanceModel='inverse';pan.refDistance=12;pan.maxDistance=130;pan.rolloffFactor=.85;
      pan.positionX.value=position.x;pan.positionY.value=1.4;pan.positionZ.value=position.z;gain.connect(pan);tail=pan; }
    if(!rasp || !context.createBuffer)osc.connect(filter);
    filter.connect(gain);tail.connect(mix);
    let noise=null;
    if(rasp && context.createBuffer) {
      const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(.25+.15*Math.sin(i/context.sampleRate*27));
      noise=context.createBufferSource();noise.buffer=buffer;noise.connect(filter);noise.start();
    }
    this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);try{noise?.stop();}catch{}noise?.disconnect();osc.disconnect();filter.disconnect();gain.disconnect();pan?.disconnect();};
    osc.start();osc.stop(now+duration+.02);
  }
  update(dt,mission,actors,player,incidents=null) {
    if(mission.paused || ['menu','won','lost'].includes(mission.phase) || !this.audio.enabled) {this.stop();return;}
    if(!this.audio.context || this.audio.context.state!=='running')return;
    this.loadSamples();
    const cue=mission.phase==='intro'?`news${Math.min(2,Math.floor(mission.time/14))}`:
      mission.phase==='phone'?(mission.phoneAnswered?'call':'phone'):mission.time<9?'alarm':mission.time<23?'disconnect':'escape';
    if(cue!==this.lastCue) {
      this.lastCue=cue;
      if(cue==='disconnect') this.tone(440,.5,.07);
      else if(cue==='alarm') {this.tone(740,1.6,.07,mission.config.hospital);this.tone(960,1.6,.035,mission.config.hospital);}

    }
    if(mission.phase==='intro') {
      if(!this.musicVoice)this.musicVoice=this.playSample('news-theme',.22,null,true,mission.time);
    }else if(this.musicVoice){try{this.musicVoice.stop();}catch{}this.musicVoice=null;}
    if(mission.phase==='phone' && !mission.phoneAnswered){this.ringTime-=dt;if(this.ringTime<=0){this.tone(660,.6,.08);this.tone(880,.6,.04);this.ringTime=2.5;}}
    if(mission.phase==='errand' && mission.callComplete && mission.time%10<dt)this.tone(650,1,.035,mission.config.hospital,false,1050);
    if(mission.phase==='escape') {
      this.screamTime-=dt;
      if(this.screamTime<=0){const civilians=actors.filter(a=>a.state==='fleeing' && !a.sheltered && Math.hypot(a.x-player.x,a.z-player.z)<90);if(civilians.length)this.playSample('panic-scream',.35,civilians[Math.floor(Math.random()*civilians.length)]);this.screamTime=4+Math.random()*4;}

      this.ambienceTime-=dt;
      if(this.ambienceTime<=0) {
        // Repeating two-tone emergency sweep and a distant, non-spatial panic bed.
        this.tone(620,1.3,.10,incidents?.police.position ?? null,false,1050);
        this.tone(320,.9,.045,null,true);
        this.ambienceTime=2.4;
      }
      if(incidents?.crashed && !this.crashPlayed) { this.tone(180,.7,.24,null,true);this.crashPlayed=true; }
    }
    this.growlTime-=dt;
    if(mission.phase==='escape' && this.growlTime<=0) {
      const nearby=actors.filter(a=>a.state==='zombie' && Math.hypot(a.x-player.x,a.z-player.z)<65).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
      if(nearby.length) { const a=nearby[0];this.growl(a,Math.floor(mission.time)); }
      this.growlTime=.8+Math.random()*1.2;
    }
  }
  reset() { this.stop();this.lastCue=null;this.growlTime=0;this.ambienceTime=0;this.crashPlayed=false;this.screamTime=0;this.ringTime=0; }
}
