'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const main=source('main.js'),part=main.slice(main.indexOf('  // Decide de onde'),main.indexOf('  async function boot()'));
const tick=()=>new Promise(setImmediate);
(async()=>{
  for(const provider of ['server','neon']) {
    let finish,reads=0,prompts=0,navigation='navigate',current={id:'u',username:'Teste'};
    const tabStorage=new Map();
    const saved={player:{name:'Teste'},inventory:['preservado']};
    const KT={CONFIG:{},State:{SAVE_KEY:'save',setSaveKey(){},mergeState:s=>s},
      Net:{detect:async()=>provider==='server',me:async()=>current,getState:async()=>{reads++;return {ok:true,state:saved};}},
      Neon:{enabled:true,currentUser:async()=>current,syncClock:async()=>true,loadSave:async()=>{reads++;return saved;}}};
    const sandbox={KT,URL,URLSearchParams,performance:{getEntriesByType:()=>[{type:navigation}]},sessionStorage:{getItem:k=>tabStorage.get(k),setItem:(k,v)=>tabStorage.set(k,v),removeItem:k=>tabStorage.delete(k)},location:{hostname:'example.test',protocol:'https:',search:'',origin:'https://example.test'}};
    vm.runInNewContext(source('auth.js'),sandbox);
    KT.Auth.show=(mode,p)=>{assert.equal(mode,'login');assert.equal(p,provider);prompts++;return new Promise(r=>{finish=r;});};
    vm.runInNewContext('const KT=globalThis.KT;'+part+'globalThis.resolveState=resolveState;',sandbox);
    for(let opening=0;opening<2;opening++) {
      const pending=sandbox.resolveState();await tick();assert.equal(reads,opening,'não carregar save antes do login');
      finish({id:'u',username:'Teste'});const result=await pending;
      assert.equal(result.state,saved);assert.deepEqual(result.state.inventory,['preservado']);
    }
    assert.equal(prompts,2,'cada abertura exige login mesmo com cookies existentes');
    navigation='reload';
    assert.equal((await sandbox.resolveState()).state,saved,'reload preserva progresso');
    assert.equal(prompts,2,'atualização da mesma aba não exige login repetido');
    current={id:'outra-conta'};
    let pending=sandbox.resolveState();await tick();assert.equal(prompts,3,'não retomar outra conta');finish({id:'u'});await pending;
    current=null;
    pending=sandbox.resolveState();await tick();assert.equal(prompts,4,'sessão realmente encerrada exige login');finish({id:'u'});await pending;
    KT.Auth.forgetSession();assert.equal(tabStorage.size,0,'sair remove autorização de retomada');
    current={id:'u'};
    pending=sandbox.resolveState();await tick();assert.equal(prompts,5,'reload depois de sair exige login');finish(current);await pending;
    navigation='back_forward';
    pending=sandbox.resolveState();await tick();assert.equal(prompts,6,'reabrir aba pelo histórico exige login');finish(current);await pending;
  }
  const neon={KT:{}};vm.runInNewContext(source('neon.js'),neon);
  let body;neon.KT.Neon.auth=async(p,o)=>{body=o.body;return {ok:true};};neon.KT.Neon.currentUser=async()=>({id:'u'});
  await neon.KT.Neon.signIn({login:'test@example.test',password:'test-only'});
  assert.equal(body.rememberMe,false,'cookie sem persistência de login');
  const requests=[],responses=[];
  const tokens={KT:{CONFIG:{neon:'https://ep-test.us-east-2.aws.neon.tech/neondb'}},URL,Blob,AbortController,setTimeout,clearTimeout,atob,
    fetch:async(url,options)=>{requests.push({url,options});await tick();const response=responses.shift();if(response instanceof Error)throw response;assert.ok(response,'resposta de teste esperada');return response;}};
  vm.runInNewContext(source('neon.js'),tokens);const N=tokens.KT.Neon;
  const jwt=label=>`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600,label})).toString('base64url')}.test`;
  const response=(status,data={},token=null)=>({ok:status>=200&&status<300,status,headers:{get:()=>token},json:async()=>data});
  const fresh=jwt('fresh');responses.push(response(200,{token:fresh}));
  assert.deepEqual(await Promise.all(Array.from({length:5},()=>N.token())),Array(5).fill(fresh));
  assert.equal(requests.length,1,'renovações simultâneas compartilham uma requisição');
  assert.equal(requests[0].options.cache,'no-store','não reutilizar JWT expirado do cache HTTP');
  N.jwtExp=Date.now()-1;responses.push(new Error('offline'));
  assert.equal((await N.api('GET','/mv_saves')).status,0,'queda de rede não é expiração da sessão');
  N.jwtExp=Date.now()+30_000;responses.push(response(503));
  assert.equal(await N.token(),fresh,'token ainda válido continua durante falha temporária');
  N.jwtExp=Date.now()-1;const headerToken=jwt('header');responses.push(response(200),response(200,{user:{id:'u'}},headerToken));
  assert.equal(await N.token(),headerToken,'renovação pelo cabeçalho de sessão');
  const renewed=jwt('renewed'),start=requests.length;responses.push(response(401),response(200,{token:renewed}),response(200,{saved:true}));
  assert.equal((await N.api('POST','/rpc/test',{id:'same-request'})).ok,true,'401 renova autenticação e repete uma vez');
  assert.equal(requests.length-start,3);assert.equal(requests.at(-1).options.body,requests[start].options.body);
  assert.equal(requests.at(-1).options.headers.Authorization,`Bearer ${renewed}`);
  responses.push(response(401),response(200,{token:renewed}),response(401));
  assert.equal((await N.api('GET','/mv_saves')).status,401,'não criar loop de renovação');
  N.jwtExp=Date.now()-1;responses.push(response(401),response(200,null));
  assert.equal((await N.api('GET','/mv_saves')).status,401,'ausência real de sessão continua bloqueada');
  assert.equal(responses.length,0);
  let plays=0;
  const audio={KT:{Neon:{signIn:async()=>({ok:true,user:{id:'u'}})}},FormData:class{entries(){return [['login','test@example.test'],['password','test-only']];}},Audio:class{constructor(url){assert.equal(url,'assets/audio/sfx/login.mp3');}pause(){this.paused=true;}play(){plays++;return Promise.resolve();}}};
  vm.runInNewContext(source('auth.js'),audio);const auth=audio.KT.Auth;auth.provider='neon';auth.hide=()=>{};
  const form={dataset:{authForm:'login'},querySelector:()=>({textContent:'Entrar'})};
  await auth.submit(form);assert.equal(plays,1);assert.equal(auth.loginSound.volume,.35);
  auth.soundEnabled=false;await auth.submit(form);assert.equal(plays,1,'respeitar botão de silêncio');
  auth.soundEnabled=true;form.querySelector=()=>({disabled:true});await auth.submit(form);assert.equal(plays,1,'bloquear clique duplicado durante login');
  auth.el={innerHTML:''};auth.bind=()=>{};auth.mode='login';auth.render();
  assert.ok(auth.el.innerHTML.indexOf('data-login-sound') < auth.el.innerHTML.indexOf('<section class="auth-card"'),'ícone fora do cartão de login');
  assert.ok(!auth.el.innerHTML.includes('Som de entrada:'),'remover opção textual do formulário');
  const retryButton={textContent:'Entrar',disabled:false};form.querySelector=()=>retryButton;
  let attempts=0;audio.KT.Neon.signIn=async()=>++attempts===1?{ok:false,error:'Senha incorreta'}:{ok:true,user:{id:'u'}};
  auth.error=()=>{};
  await auth.submit(form);const failedSound=auth.loginSound;assert.equal(retryButton.disabled,false);
  await auth.submit(form);assert.equal(plays,3,'senha errada e tentativa seguinte tocam uma vez cada');
  assert.notEqual(auth.loginSound,failedSound,'cada tentativa começa com áudio novo');assert.equal(failedSound.paused,true,'não sobrepor som da tentativa anterior');
  console.log('AUTH_OK: reload sem deslogar, nova abertura exige login, renovação de token e falhas de rede preservadas');
})().catch(e=>{console.error(e);process.exitCode=1;});
