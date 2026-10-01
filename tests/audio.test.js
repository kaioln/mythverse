'use strict';
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const main=fs.readFileSync(require('node:path').join(__dirname,'../src/main.js'),'utf8');
const requests=[], sources=[];
const combatManifest=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../assets/audio/combat/index.json'),'utf8'));
let deferDecode=null;
const gain=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){}});
class Context {
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  createGain(){return {gain:gain(),connect(){},disconnect(){}};}
  createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}};}
  createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;}
  decodeAudioData(){return deferDecode ? new Promise(r=>{deferDecode.resolve=r;}) : Promise.resolve({duration:90});}
}
const sandbox={KT:{},AudioContext:Context,performance:{now:()=>30000},setTimeout:()=>1,clearTimeout(){},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('/combat/')?combatManifest:['hero-akira-ult'],arrayBuffer:async()=>new ArrayBuffer(8)};}};
vm.runInNewContext(main.slice(0,main.indexOf('  // Caixa de diálogo'))+'globalThis.Sound=SoundEngine;})();',sandbox);
const tick=()=>new Promise(setImmediate);
(async()=>{
  const sound=new sandbox.Sound(); sound.chord=()=>{};
  await sound.enable(true);await tick();
  assert.ok(requests.includes('assets/audio/music/city.mp3'));
  assert.equal(sound.musicSources.size,1);
  assert.equal(sound.music.gain.value,.24,'cidade com volume um pouco maior');
  assert.equal(sound.limiter.threshold.value,-12,'limitar picos de efeitos sobrepostos');
  sound.setScene('boss');await tick();
  assert.equal(sound.music.gain.value,.16,'batalha mantém volume anterior');
  assert.ok(requests.includes('assets/audio/music/boss.mp3'));
  assert.ok(sources[0].stopped);
  sound.setScene('hunt');await tick();
  assert.ok(requests.includes('assets/audio/music/battle.mp3'));
  for (const [theme,track] of Object.entries({forest:'forest',sakura:'forest',coast:'coast',archive:'coast',abyss:'coast',crypt:'crypt',ghost:'crypt',rift:'crypt',frost:'frost',forge:'forge',desert:'desert',desertBoss:'desert',clock:'clock',sky:'forest',skyBoss:'boss'})) {
    sound.setScene({kind:'hunt',theme}); await tick(); assert.equal(sound.scene,track);
    assert.ok(requests.includes(`assets/audio/music/${track}.mp3`));
    assert.ok([...sound.buffers.keys()].filter(k=>k.includes('/music/')).length<=2,'limitar memória das trilhas');
  }
  sound.setScene({kind:'village',theme:'forest'}); await tick(); assert.equal(sound.scene,'city');
  const citySources=[...sound.musicSources]; sound.setScene({kind:'hunt',theme:'forest'});await tick();
  assert.ok(citySources.every(s=>s.stopped),'cidade não toca fora da cidade');
  const before=requests.length;await sound.voice('npc-renji-0');assert.equal(requests.length,before,'não requisitar fala de morador');
  await sound.voice('hero-akira-ult');assert.ok(sound.speaker?.started);
  const voices=[],playVoice=sound.voice;sound.voice=id=>voices.push(id);
  sound.fx({type:'cast'},{sprite:'akira',side:'hero',uid:'skill-without-voice'});
  sound.fx({type:'cast',ult:true},{sprite:'erik',side:'hero',uid:'ult-without-voice'});
  await tick();assert.equal(voices.length,0,'skills e ultimates mantêm efeitos sem vozes');sound.voice=playVoice;sound.stopFx();
  await sound.combat({type:'attack'},{sprite:'mob',side:'enemy'});assert.equal(sound.fxSources.size,1);
  sound.stopFx();
  await sound.prepare([{sprite:'erik'},{sprite:'akira'},{sprite:'aurelia'},{sprite:'warden'}]);
  assert.equal([...sound.buffers.keys()].filter(k=>k.includes('/combat/')&&!k.includes('/event-')).length,12);
  sound.tone=sound.noise=sound.chord=()=>{throw new Error('Combate não pode usar bipes sintéticos');};
  for(const [fx,event]of [[{type:'attack'},'enemyAttack'],[{type:'cast',enemy:true},'enemyCast'],[{type:'damage',side:'hero'},'damage'],[{type:'damage',side:'enemy',crit:true},'crit'],...['burst','heal','death','bossWindup','bossBurst','levelUp','reward'].map(type=>[{type},type])]){
    sound.fx(fx,{sprite:'mob',side:'enemy',uid:event});await tick();
    assert.ok(requests.includes(`assets/audio/combat/${combatManifest.events[event]}`));sound.stopFx();
  }
  sound.fx({type:'burst'},{sprite:'erik',side:'hero',uid:'duplicate'});await tick();assert.equal(sound.fxSources.size,0,'skill já contém impacto, não sobrepor explosão genérica');
  sound.warn();await tick();assert.equal(sound.fxSources.size,0,'não repetir alerta de boss no mesmo instante');
  for(const [sprite,event]of [['erik','attack'],['akira','skill'],['aurelia','ult'],['goku_ui','ult']]){
    await sound.combat({type:event==='attack'?'attack':'cast',ult:event==='ult'},{sprite,uid:sprite,slot:0});
    assert.ok(requests.includes(`assets/audio/combat/${sprite}-${event}.mp3`));
  }
  sound.stopFx();
  for(let i=0;i<8;i++)await sound.combat({type:'attack'},{sprite:'erik',uid:'u'+i});
  assert.equal(sound.fxSources.size,8);
  await sound.combat({type:'attack'},{sprite:'akira',uid:'overflow'});assert.equal(sound.fxSources.size,8);
  const beforeUlt=[...sound.fxSources];await sound.combat({type:'cast',ult:true},{sprite:'akira',uid:'priority'});
  assert.equal(sound.fxSources.size,8);assert.ok(beforeUlt.some(s=>s.stopped),'ultimate tem prioridade sobre ataques');
  sound.setScene({kind:'village'});await tick();assert.equal(sound.fxSources.size,0);
  await sound.combat({type:'attack'},{sprite:'erik',uid:'city'});assert.equal(sound.fxSources.size,0,'nenhum efeito de combate na cidade');
  await sound.enable(false);assert.equal(sound.master.gain.value,0);assert.equal(sound.musicSources.size,0);assert.equal(sound.speaker,null);
  assert.equal(sound.fxSources.size,0);
  // Um carregamento atrasado nunca volta a tocar depois de silenciar.
  sound.buffers.clear();deferDecode={};
  await sound.enable(true);await tick();const pending=deferDecode;
  await sound.enable(false);pending.resolve({duration:90});await tick();
  assert.equal(sound.musicSources.size,0);assert.equal(sound.master.gain.value,0);
  const ids=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../assets/audio/voices/index.json'),'utf8'));
  assert.ok(ids.every(id=>/^(hero|boss)-/.test(id)));
  for(const id of ids)assert.ok(fs.statSync(require('node:path').join(__dirname,'../assets/audio/voices',id+'.mp3')).size>1000);
  const manifest=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../assets/audio/index.json'),'utf8'));
  for(const type of ['music','sfx'])for(const id of manifest[type])assert.ok(fs.statSync(require('node:path').join(__dirname,'../assets/audio',type,id+'.mp3')).size>1000);
  const crypto=require('node:crypto');const hashes=new Set();
  const roster={KT:{}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/data.js'),'utf8'),roster);vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/roster.js'),'utf8'),roster);
  for(const h of roster.KT.Data.roster)for(const event of ['attack','skill','ult']){
    assert.ok(combatManifest.heroes[h.id]?.[event],`${h.id} sem ${event}`);
    const file=fs.readFileSync(require('node:path').join(__dirname,'../assets/audio/combat',combatManifest.heroes[h.id][event]));
    const hash=crypto.createHash('sha256').update(file).digest('hex');
    assert.ok(file.length>3000);assert.ok(!hashes.has(hash),'efeito não pode ser cópia idêntica de outro herói');hashes.add(hash);
    assert.equal(combatManifest.files.find(f=>f.name===combatManifest.heroes[h.id][event]).sha256,hash);
  }
  assert.equal(hashes.size,216);assert.equal(combatManifest.license,'CC0-1.0');
  assert.equal(combatManifest.mix,'foley-stereo-v2');
  for(const file of combatManifest.files){
    assert.equal(file.channels,2,'efeitos em estéreo');
    const bytes=fs.readFileSync(require('node:path').join(__dirname,'../assets/audio/combat',file.name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  }
  console.log('AUDIO_OK: trilhas por cena, vozes apenas de combate, silêncio e carregamento tardio');
})().catch(e=>{console.error(e);process.exitCode=1;});
