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
const weapons={Executor:'knifeSlice',Vanguarda:'impactPunch_medium',Arcanista:'impactSoft_medium',Suporte:'impactBell_heavy',Atirador:'impactMetal_medium'};
const weaponOverrides={erik:'impactMining',alden:'impactMetal_heavy',sienna:'impactPlate_heavy',thorn:'impactMetal_heavy',warden:'impactMetal_heavy',rook:'impactMetal_heavy',zara:'impactTin_medium',nadia:'impactWood_light',bjorn:'impactWood_light',virel:'impactWood_light',selene:'impactWood_light',ren:'knifeSlice',sael:'knifeSlice',rina:'impactPunch_heavy',aurelia:'impactBell_heavy'};
const used=new Map(),manifest={license:'CC0-1.0',sources:[{url:'https://kenney.nl/assets/impact-sounds',sha256:expected.impact},{url:'https://kenney.nl/assets/rpg-audio',sha256:expected.rpg}],heroes:{},files:[]};
function clip(family,n){const name=family.startsWith('impact')?family+'_'+String(n%5).padStart(3,'0')+'.ogg':family==='knifeSlice'?'knifeSlice'+(n%2?'2':'')+'.ogg':family==='metalClick'?'metalClick.ogg':family+(n%3+1)+'.ogg';const file=files.get(name);if(!file)throw new Error('Áudio ausente: '+name);used.set(path.relative(input,file).replaceAll('\\','/'),hash(file));return file;}
for(const [i,h]of KT.Data.roster.entries()){
  const weapon=weaponOverrides[h.base]||weapons[h.cls],element=elements[h.element];if(!weapon||!element)throw new Error('Herói sem identidade de áudio: '+h.id);
  const recipes={};
  for(const [j,event]of ['attack','skill','ult'].entries()){
    const kit=j===2?h.ult:j===1?h.skill:null,eff=kit?.eff||[],hits=Math.min(3,Math.max(1,...eff.filter(e=>e.k==='dmg').map(e=>e.hits||1)));
    const thematic=/Brasa|Chama|Solar|Inferno|Flamejante|Incandescente/.test(kit?.name||'')?elements.Fogo:/Gelo|Gélid/.test(kit?.name||'')?elements.Gelo:/Trovej|Raio|Relâmpago/.test(kit?.name||'')?elements.Raio:element;
    const physical=clip(weapon,i+j),texture=clip(thematic,Math.floor(i/5)+j),movement=clip(j===2&&weapon==='knifeSlice'?'drawKnife':'cloth',i+j);
    const layers=[{p:physical,g:j===0?.82:.68,at:0,rate:.92+(i%7)*.025},{p:texture,g:j===0?.12:j===1?.42:.6,at:j===0?.025:.07,rate:.78+(i%11)*.032},{p:movement,g:j===0?.16:.24,at:0,rate:1.1+(i%3)*.1}];
    if(j&&hits>1)for(let n=1;n<hits;n++)layers.push({p:physical,g:.45,at:n*(.085+(i%4)*.018),rate:1+n*.07});
    if(j===2)layers.push({p:clip(eff.some(e=>['dmg','chain','execute'].includes(e.k))?'impactPunch_heavy':'impactBell_heavy',i),g:.3,at:.10+(i%4)*.025,rate:.72});
    const duration=j===0?.48:j===1?.85:1.35,args=['-hide_banner','-loglevel','error','-y'];for(const l of layers)args.push('-i',l.p);
    const filters=layers.map((l,n)=>`[${n}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,asetrate=44100*${l.rate},aresample=44100,highpass=f=65,lowpass=f=10000,volume=${l.g},adelay=${Math.round(l.at*1000)}:all=1[a${n}]`);
    filters.push(layers.map((_,n)=>`[a${n}]`).join('')+`amix=inputs=${layers.length}:normalize=0,apad,atrim=duration=${duration},afade=t=in:d=0.004,afade=t=out:st=${duration-.09}:d=0.09,alimiter=limit=0.85:level=0[mix]`);
    const name=h.id+'-'+event+'.mp3',dest=path.join(out,name);
    args.push('-filter_complex',filters.join(';'),'-map','[mix]','-ar','44100','-ac','1','-b:a','112k',dest);
    const run=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true});if(run.status!==0)throw new Error(run.stderr);
    recipes[event]=name;manifest.files.push({name,sha256:hash(dest),kit:kit?.name||'Ataque básico',layers:layers.map(l=>({source:path.relative(input,l.p).replaceAll('\\','/'),gain:l.g,offset:l.at,rate:l.rate}))});
  }
  manifest.heroes[h.id]={name:h.name,element:h.element,weapon,...recipes};
}
manifest.sourceFiles=[...used].map(([name,sha256])=>({name,sha256}));
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('COMBAT_ASSETS_OK: '+Object.keys(manifest.heroes).length+' heróis, '+manifest.files.length+' efeitos CC0.');
