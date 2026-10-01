'use strict';
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const main=fs.readFileSync(require('node:path').join(__dirname,'../src/main.js'),'utf8');
const requests=[], sources=[];
let deferDecode=null;
const gain=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){}});
class Context {
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  createGain(){return {gain:gain(),connect(){},disconnect(){}};}
  createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;}
  decodeAudioData(){return deferDecode ? new Promise(r=>{deferDecode.resolve=r;}) : Promise.resolve({duration:90});}
}
const sandbox={KT:{},AudioContext:Context,performance:{now:()=>30000},setTimeout:()=>1,clearTimeout(){},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>['hero-akira-ult'],arrayBuffer:async()=>new ArrayBuffer(8)};}};
vm.runInNewContext(main.slice(0,main.indexOf('  // Caixa de diálogo'))+'globalThis.Sound=SoundEngine;})();',sandbox);
const tick=()=>new Promise(setImmediate);
(async()=>{
  const sound=new sandbox.Sound(); sound.chord=()=>{};
  await sound.enable(true);await tick();
  assert.ok(requests.includes('assets/audio/music/city.mp3'));
  assert.equal(sound.musicSources.size,1);
  sound.setScene('boss');await tick();
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
  await sound.blade({sprite:'akira'});assert.equal(sound.fxSources.size,1);
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
  console.log('AUDIO_OK: trilhas por cena, vozes apenas de combate, silêncio e carregamento tardio');
})().catch(e=>{console.error(e);process.exitCode=1;});
