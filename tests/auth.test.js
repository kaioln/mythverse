'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const main=source('main.js'),part=main.slice(main.indexOf('  // Decide de onde'),main.indexOf('  async function boot()'));
const tick=()=>new Promise(setImmediate);
(async()=>{
  for(const provider of ['server','neon']) {
    let finish,reads=0,prompts=0;
    const saved={player:{name:'Teste'},inventory:['preservado']};
    const KT={CONFIG:{},State:{SAVE_KEY:'save',setSaveKey(){},mergeState:s=>s},
      Auth:{show:(mode,p)=>{assert.equal(mode,'login');assert.equal(p,provider==='neon'?'neon':undefined);prompts++;return new Promise(r=>{finish=r;});}},
      Net:{detect:async()=>provider==='server',me:()=>{throw new Error('não reutilizar sessão antiga');},getState:async()=>{reads++;return {ok:true,state:saved};}},
      Neon:{enabled:true,currentUser:()=>{throw new Error('não reutilizar sessão antiga');},syncClock:async()=>true,loadSave:async()=>{reads++;return saved;}}};
    const sandbox={KT,URL,URLSearchParams,location:{hostname:'example.test',protocol:'https:',search:'',origin:'https://example.test'}};
    vm.runInNewContext('const KT=globalThis.KT;'+part+'globalThis.resolveState=resolveState;',sandbox);
    for(let opening=0;opening<2;opening++) {
      const pending=sandbox.resolveState();await tick();assert.equal(reads,opening,'não carregar save antes do login');
      finish({id:'u',username:'Teste'});const result=await pending;
      assert.equal(result.state,saved);assert.deepEqual(result.state.inventory,['preservado']);
    }
    assert.equal(prompts,2,'cada abertura exige login mesmo com cookies existentes');
  }
  const neon={KT:{}};vm.runInNewContext(source('neon.js'),neon);
  let body;neon.KT.Neon.auth=async(p,o)=>{body=o.body;return {ok:true};};neon.KT.Neon.currentUser=async()=>({id:'u'});
  await neon.KT.Neon.signIn({login:'test@example.test',password:'test-only'});
  assert.equal(body.rememberMe,false,'cookie sem persistência de login');
  let plays=0;
  const audio={KT:{Neon:{signIn:async()=>({ok:true,user:{id:'u'}})}},FormData:class{entries(){return [['login','test@example.test'],['password','test-only']];}},Audio:class{constructor(url){assert.equal(url,'assets/audio/sfx/login.mp3');}play(){plays++;return Promise.resolve();}}};
  vm.runInNewContext(source('auth.js'),audio);const auth=audio.KT.Auth;auth.provider='neon';auth.hide=()=>{};
  const form={dataset:{authForm:'login'},querySelector:()=>({textContent:'Entrar'})};
  await auth.submit(form);assert.equal(plays,1);assert.equal(auth.loginSound.volume,.35);
  auth.soundEnabled=false;await auth.submit(form);assert.equal(plays,1,'respeitar botão de silêncio');
  console.log('AUTH_OK: login obrigatório por abertura, saves preservados, cookie não persistente e som no clique');
})().catch(e=>{console.error(e);process.exitCode=1;});
