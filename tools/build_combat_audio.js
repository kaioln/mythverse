'use strict';
// Composição local dos pacotes CC0 autorizados: nenhum serviço pago ou credencial.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),input=path.resolve(process.argv[2]||''),out=path.join(root,'assets/audio/combat');
if(!process.argv[2])throw new Error('Informe a pasta dos dois pacotes Kenney.');
global.KT={};require('../src/data.js');require('../src/roster.js');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected={impact:'029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8',rpg:'6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b'};
for(const [pack,digest]of Object.entries(expected))if(hash(path.join(input,pack+'.zip'))!==digest)throw new Error('Pacote diferente do verificado: '+pack);
const files=new Map();
function scan(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())scan(p);else if(f.name.endsWith('.ogg'))files.set(f.name,p);}}
scan(path.join(input,'impact'));scan(path.join(input,'rpg'));fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'LICENSE.txt'),['impact','rpg'].map(pack=>fs.readFileSync(path.join(input,pack,'License.txt'),'utf8').replace(/\r/g,'').split('\n').map(line=>line.trimEnd()).join('\n')).join('\n'));
const elements={Luz:'impactBell_heavy',Gelo:'impactGlass_light',Raio:'impactTin_medium',Terra:'impactMining',Natureza:'impactWood_light',Fogo:'impactWood_heavy',Vento:'impactSoft_medium',Água:'impactGlass_medium',Sombra:'impactPlate_heavy'};
const weapons={Executor:'knifeSlice',Vanguarda:'impactPunch_heavy',Arcanista:'impactSoft_heavy',Suporte:'impactGlass_medium',Atirador:'impactMetal_heavy'};
const weaponOverrides={erik:'impactMining',alden:'impactMetal_heavy',sienna:'impactPlate_heavy',thorn:'impactMetal_heavy',warden:'impactMetal_heavy',rook:'impactMetal_heavy',zara:'impactTin_medium',nadia:'impactWood_light',bjorn:'impactWood_light',virel:'impactWood_light',selene:'impactWood_light',ren:'knifeSlice',sael:'knifeSlice',rina:'impactPunch_heavy',aurelia:'impactBell_heavy'};
const used=new Map(),manifest={license:'CC0-1.0',mix:'foley-stereo-v2',sources:[{url:'https://kenney.nl/assets/impact-sounds',sha256:expected.impact},{url:'https://kenney.nl/assets/rpg-audio',sha256:expected.rpg}],heroes:{},events:{},files:[]};
function clip(family,n){const name=family.startsWith('impact')?family+'_'+String(n%5).padStart(3,'0')+'.ogg':family==='knifeSlice'?'knifeSlice'+(n%2?'2':'')+'.ogg':family==='metalClick'?'metalClick.ogg':family+(n%3+1)+'.ogg';const file=files.get(name);if(!file)throw new Error('Áudio ausente: '+name);used.set(path.relative(input,file).replaceAll('\\','/'),hash(file));return file;}
function render(name,layers,duration,kit){
  const args=['-hide_banner','-loglevel','error','-y'];for(const l of layers)args.push('-i',l.p);
  const filters=layers.map((l,n)=>`[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,${l.reverse?'areverse,':''}asetrate=44100*${l.rate},aresample=44100,highpass=f=${l.high||55},lowpass=f=${l.low||9000},volume=${l.g},adelay=${Math.round(l.at*1000)}:all=1[a${n}]`);
  filters.push(layers.map((_,n)=>`[a${n}]`).join('')+`amix=inputs=${layers.length}:normalize=0,apad,atrim=duration=${duration},afade=t=in:d=0.003,afade=t=out:st=${duration-.16}:d=0.16,asplit=3[d][l][r]`);
  filters.push('[d]pan=stereo|c0=c0|c1=c0[dry]','[l]lowpass=f=4000,adelay=31:all=1,volume=0.12,aformat=channel_layouts=mono[left]','[r]lowpass=f=3500,adelay=53:all=1,volume=0.10,aformat=channel_layouts=mono[right]','[left][right]amerge=inputs=2[room]','[dry][room]amix=inputs=2:normalize=0,alimiter=limit=0.85:level=0[mix]');
  const dest=path.join(out,name),temp=dest+'.render.mp3';args.push('-filter_complex',filters.join(';'),'-map','[mix]','-t',String(duration),'-ar','44100','-ac','2','-b:a','160k',temp);
  const run=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,timeout:15000});if(run.status!==0)throw new Error(run.stderr||String(run.error));
  if(fs.statSync(temp).size>100000)throw new Error('Efeito excede o limite de tamanho: '+name);
  fs.renameSync(temp,dest);
  manifest.files.push({name,sha256:hash(dest),kit,duration,channels:2,layers:layers.map(l=>({source:path.relative(input,l.p).replaceAll('\\','/'),gain:l.g,offset:l.at,rate:l.rate,reverse:!!l.reverse,lowpass:l.low||9000,highpass:l.high||55}))});
}
for(const [i,h]of KT.Data.roster.entries()){
  const weapon=weaponOverrides[h.base]||weapons[h.cls],element=elements[h.element];if(!weapon||!element)throw new Error('Herói sem identidade de áudio: '+h.id);
  const recipes={};
  for(const [j,event]of ['attack','skill','ult'].entries()){
    const kit=j===2?h.ult:j===1?h.skill:null,eff=kit?.eff||[],hits=Math.min(3,Math.max(1,...eff.filter(e=>e.k==='dmg').map(e=>e.hits||1)));
    const thematic=/Brasa|Chama|Solar|Inferno|Flamejante|Incandescente/.test(kit?.name||'')?elements.Fogo:/Gelo|Gélid/.test(kit?.name||'')?elements.Gelo:/Trovej|Raio|Relâmpago/.test(kit?.name||'')?elements.Raio:element;
    const physical=clip(weapon,i+j),texture=clip(thematic,Math.floor(i/5)+j),movement=clip(j===2&&weapon==='knifeSlice'?'drawKnife':'cloth',i+j);
    const layers=[{p:physical,g:j===0?.88:.72,at:.035,rate:.90+(i%7)*.025},{p:texture,g:j===0?.08:j===1?.32:.44,at:.08,rate:.70+(i%11)*.025,low:6500},{p:movement,g:j===0?.28:.36,at:0,rate:.85+(i%3)*.08}];
    if(j&&hits>1)for(let n=1;n<hits;n++)layers.push({p:physical,g:.45,at:n*(.085+(i%4)*.018),rate:1+n*.07});
    if(j)layers.push({p:clip('impactSoft_heavy',i+j),g:j===2?.48:.23,at:.04,rate:j===2?.58:.76,low:450});
    if(j===2)layers.push({p:clip(eff.some(e=>['dmg','chain','execute'].includes(e.k))?'impactPunch_heavy':'impactGlass_medium',i),g:.38,at:.10+(i%4)*.025,rate:.68});
    const name=h.id+'-'+event+'.mp3';render(name,layers,j===0?.65:j===1?1.15:1.9,kit?.name||'Ataque básico');recipes[event]=name;
  }
  manifest.heroes[h.id]={name:h.name,element:h.element,weapon,...recipes};
}
const events={enemyAttack:['impactPunch_medium','cloth',.55],enemyCast:['impactSoft_heavy','knifeSlice',.95],damage:['impactPunch_heavy','impactPlate_light',.5],crit:['impactMetal_heavy','impactGlass_light',.65],burst:['impactPunch_heavy','impactWood_heavy',1.1],heal:['impactGlass_medium','impactBell_heavy',1.5],death:['impactSoft_heavy','cloth',.75],bossWindup:['impactMetal_heavy','impactSoft_heavy',1.5],bossBurst:['impactPunch_heavy','impactMining',1.8],levelUp:['impactBell_heavy','impactGlass_light',1.8],reward:['metalClick','cloth',.4],loot:['metalClick','impactGlass_light',.6],victory:['impactBell_heavy','impactGlass_medium',2]};
for(const [event,[body,detail,duration]]of Object.entries(events)){
  const magical=['heal','levelUp','victory'].includes(event),windup=event==='bossWindup';
  const layers=[{p:clip(body,2),g:magical?.5:.75,at:0,rate:windup?.62:magical?.85:.92,reverse:windup,low:magical?7000:8500},{p:clip(detail,1),g:magical?.16:.3,at:.06,rate:.82,low:6000}];
  if(!magical&&!['reward','loot'].includes(event))layers.push({p:clip('impactSoft_heavy',4),g:event.startsWith('boss')?.6:.3,at:.035,rate:.6,low:400});
  const name='event-'+event+'.mp3';render(name,layers,duration,event);manifest.events[event]=name;
}
manifest.sourceFiles=[...used].map(([name,sha256])=>({name,sha256}));
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('COMBAT_ASSETS_OK: '+Object.keys(manifest.heroes).length+' heróis, '+manifest.files.length+' efeitos CC0.');
