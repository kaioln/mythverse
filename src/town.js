// Cidade viva de Tsukimori. Movimento exclusivamente por linhas centrais de ruas, escadas e pontes visíveis.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const N = {
    plaza:[560,430], plazaN:[560,408], plazaS:[560,454], plazaW:[515,438], plazaE:[610,438],
    marketE:[420,462], marketM:[300,470], marketW:[150,470], marketGuide:[410,430], stallRenji:[350,435], stallYori:[382,432], stallAya:[250,435], stallMio:[300,438], stallGoro:[190,435],
    westJ:[430,410], dojoLow:[360,410], dojoStairFoot:[305,385], dojoStairMid:[280,350], dojoStairTop:[255,320], dojo:[180,304], guildLow:[300,280], guildMid:[330,225], guild:[250,170], gardenFoot:[505,400], gardenStep:[485,365], garden:[450,335],
    templeLow:[580,390], templeMid:[615,315], templeHigh:[600,230], temple:[560,165], templeL:[530,166], templeR:[600,166],
    forgeJ:[655,420], forgeLow:[715,395], forge:[800,370], forgePost:[830,370],
    eastJ:[690,448], bridgeApproach:[765,488], bridgeW:[815,516], bridgeM:[865,529], eastLand:[925,530], shrineMid:[990,485], shrine:[1080,432], shrineStory:[1040,410], shrineLantern:[1110,455],
    dockTop:[940,558], dock:[965,612], dockMid:[1050,632], expedition:[1160,640],
    bankTop:[300,480], bankStep:[330,535], bankLanding:[380,590], bankCourt:[440,615], bank:[185,650],
    workshopBridge:[520,625], workshopGate:[575,650], workshop:[700,670],
    dance:[500,405], drum:[615,460], playA:[540,390], playB:[620,425], playC:[585,458], playD:[500,440]
  };
  const EDGES = [
    ['plaza','plazaN'],['plaza','plazaS'],['plaza','plazaW'],['plaza','plazaE'],
    ['plazaW','marketE'],['marketE','marketM'],['marketM','marketW'],['marketE','marketGuide'],['marketE','stallRenji'],['marketE','stallYori'],['marketM','stallAya'],['marketM','stallMio'],['marketW','stallGoro'],
    ['plazaW','westJ'],['westJ','dojoLow'],['dojoLow','dojoStairFoot'],['dojoStairFoot','dojoStairMid'],['dojoStairMid','dojoStairTop'],['dojoStairTop','dojo'],['dojoStairTop','guildLow'],['guildLow','guildMid'],['guildMid','guild'],['plazaN','gardenFoot'],['gardenFoot','gardenStep'],['gardenStep','garden'],
    ['plazaN','templeLow'],['templeLow','templeMid'],['templeMid','templeHigh'],['templeHigh','temple'],['temple','templeL'],['temple','templeR'],
    ['plazaE','forgeJ'],['forgeJ','forgeLow'],['forgeLow','forge'],['forge','forgePost'],
    ['plazaE','eastJ'],['eastJ','bridgeApproach'],['bridgeApproach','bridgeW'],['bridgeW','bridgeM'],['bridgeM','eastLand'],['eastLand','shrineMid'],['shrineMid','shrine'],['shrine','shrineStory'],['shrine','shrineLantern'],
    ['eastLand','dockTop'],['dockTop','dock'],['dock','dockMid'],['dockMid','expedition'],
    ['marketM','bankTop'],['bankTop','bankStep'],['bankStep','bankLanding'],['bankLanding','bankCourt'],['bankCourt','bank'],['bankCourt','workshopBridge'],['workshopBridge','workshopGate'],['workshopGate','workshop'],
    ['plaza','dance'],['plaza','drum'],['plaza','playA']
  ];
  const adj = {}; EDGES.forEach(([a,b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
  const SPOTS = [
    {node:'forge',verb:'Olhando as lâminas',face:1,w:2},{node:'dojo',verb:'Treinando',face:-1,w:2},{node:'marketE',verb:'Pechinchando',face:-1,w:1},{node:'marketM',verb:'Provando chá',face:1,w:1},{node:'marketW',verb:'Vendo tecidos',face:1,w:1},
    {node:'guild',verb:'Lendo contratos',face:-1,w:1},{node:'temple',verb:'Olhando o portal',face:1,w:1},{node:'workshop',verb:'Vendo poções',face:1,w:1},
    {node:'bank',verb:'No banco',face:-1,w:1},{node:'garden',verb:'Descansando',face:1,w:1},{node:'plazaS',verb:'Conversando',face:1,w:1}
  ];
  const DIALOGUES = [
    {people:['Renji','Yori'],lines:[['Renji','O caldo descansa até a primeira lanterna.'],['Yori','E o dango desaparece antes da última. Estamos no horário.'],['Renji','Então abrimos juntos quando os tambores começarem.']]},
    {people:['Aya','Mio'],lines:[['Mio','Pintei luas nas máscaras das crianças. Ficou exagerado?'],['Aya','No Festival das Cerejeiras, exagero é tradição. Falta só uma pétala.'],['Mio','Guarde a primeira xícara de chá; ela combina com a máscara.']]},
    {people:['Koharu','Riku'],lines:[['Riku','Depois do terceiro toque, a praça entra na dança.'],['Koharu','Segure o ritmo quando os viajantes chegarem pela ponte.'],['Riku','Combinado. Hoje ninguém dança sozinho.']]},
    {people:['Fumi','Hotaru'],lines:[['Fumi','Cada lanterna leva o nome de quem procura o caminho de casa.'],['Hotaru','Por isso acendo primeiro as que ficam diante do Templo.'],['Fumi','E eu conto a história até todas encontrarem o céu.']]}
  ];
  const FOLK = [
    {f:0,name:'Renji',post:'stallRenji',face:1,verb:'Vendendo lámen'},{f:1,name:'Maki',post:'forgePost',face:-1,verb:'Martelando'},{f:2,name:'Suzu',route:['templeL','temple','templeR','temple'],speed:12,verb:'Varrendo'},
    {f:3,name:'Hotaru',route:['shrine','shrineLantern','shrine'],speed:13,verb:'Acendendo lanternas'},
    {f:4,name:'Goro',post:'stallGoro',face:1,verb:'Vendendo peixe'},{f:5,name:'Aya',post:'stallAya',face:1,verb:'Servindo chá'},{f:6,name:'Tomo',post:'playA',face:1,verb:'Brincando'},
    {f:7,name:'Jinbei',route:['plazaW','plaza','plazaE','plaza','plazaW'],speed:19,verb:'De ronda'},{f:8,name:'Natsu',post:'marketGuide',face:-1,verb:'Mercadora'},
    {f:9,name:'Daigo',route:['expedition','dockMid','dock','dockTop','dock','dockMid'],speed:15,verb:'Carregando caixas'},{f:3,name:'Koharu',post:'dance',face:1,verb:'Dançando'},{f:6,name:'Riku',post:'drum',face:-1,verb:'Tocando tambor'},
    {f:2,name:'Emi',post:'plazaS',face:-1,verb:'Entregando talismãs'},{f:5,name:'Yori',post:'stallYori',face:-1,verb:'Fazendo doces'},{f:0,name:'Fumi',post:'shrineStory',face:-1,verb:'Contando histórias'},
    {f:4,name:'Kai',route:['dock','dockMid','expedition','dockMid'],speed:12,verb:'Guiando visitantes'},{f:8,name:'Mio',post:'stallMio',face:1,verb:'Pintando máscaras'},
    {f:9,name:'Bento',route:['bank','bankCourt','workshopBridge','workshopGate','workshop','workshopGate','workshopBridge','bankCourt'],speed:13,verb:'Levando oferendas'}
  ];
  function nodePath(from,to){if(from===to)return[];const prev={[from]:null},q=[from];while(q.length){const n=q.shift();if(n===to)break;for(const m of adj[n]||[])if(!(m in prev)){prev[m]=n;q.push(m);}}if(!(to in prev))return null;const out=[];for(let n=to;n!==from;n=prev[n])out.unshift(n);return out;}
  const edgeKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
  const distSeg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
  function closestNode(x,y){let best=null,d=Infinity;for(const[n,p]of Object.entries(N)){const v=Math.hypot(x-p[0],y-p[1]);if(v<d){d=v;best=n;}}return best;}
  function route(ax,ay,bx,by){const p=nodePath(closestNode(ax,ay),closestNode(bx,by));return p===null?null:p.map(n=>N[n]);}
  function isWalk(x,y){return Object.values(N).some(p=>Math.hypot(x-p[0],y-p[1])<=12)||EDGES.some(([a,b])=>distSeg(x,y,N[a],N[b])<=8);}
  const pick=list=>{const total=list.reduce((s,x)=>s+x.w,0);let r=Math.random()*total;for(const x of list)if((r-=x.w)<0)return x;return list[0];};
  const depth=y=>.78+.3*Math.max(0,Math.min(1,(y-160)/540));
  class TownLife{
    constructor(){this.agents=[];this.key='';this.dialogueAt=2;this.dialogue=0;this.dialogueLine=0;}
    sync(heroes){const key=heroes.map(h=>h.uid+h.sprite).join('|');if(key===this.key)return;this.key=key;const starts=['plazaN','forge','marketE','dojo'];
      this.agents=heroes.map((h,i)=>{const node=starts[i%starts.length],p=N[node];return{id:i,kind:'hero',...h,node,x:p[0],y:p[1],path:[],pathNodes:[],resources:[],wait:4+i*3,face:1,speed:28+i*1.5,verb:'',walkT:Math.random(),animT:Math.random()*5,speech:'',speechFor:0};})
        .concat(FOLK.map((f,i)=>{const node=f.post||f.route[0],p=N[node];return{id:heroes.length+i,kind:'folk',f:f.f,def:f,name:f.name,node,x:p[0],y:p[1],path:[],pathNodes:[],resources:[],wait:2+Math.random()*6,face:f.face||1,speed:f.speed||0,verb:f.verb,ri:0,walkT:Math.random(),animT:Math.random()*5,speech:'',speechFor:0};}));}
    go(a,to){const nodes=nodePath(a.node,to);if(!nodes?.length){a.wait=2;return false;}const seq=[a.node,...nodes],resources=[...nodes.map(n=>`n:${n}`),...nodes.map((n,i)=>`e:${edgeKey(seq[i],n)}`)],segments=nodes.map((n,i)=>[N[seq[i]],N[n]]);
      const blocked=this.agents.some(o=>{if(o===a)return false;if(o.path.length&&o.resources.some(r=>resources.includes(r)))return true;if(resources.includes(`n:${o.node}`))return true;const near=segments.some(([p,q])=>distSeg(o.x,o.y,p,q)<24);if(near)return true;return o.path.some((p,i)=>segments.some(([u,v])=>distSeg(p[0],p[1],u,v)<24||distSeg(u[0],u[1],o.path[i-1]||[o.x,o.y],p)<24));});
      if(blocked){a.wait=1+Math.random();return false;}a.pathNodes=nodes.slice();a.path=nodes.map(n=>N[n]);a.resources=resources;a.goalNode=to;return true;}
    update(dt){for(const a of this.agents){a.animT+=dt;a.speechFor=Math.max(0,a.speechFor-dt);if(a.path.length){const[tx,ty]=a.path[0],dx=tx-a.x,dy=ty-a.y,d=Math.hypot(dx,dy),step=a.speed*depth(a.y)*dt;if(Math.abs(dx)>.4)a.face=dx>0?1:-1;a.walkT+=dt;a.moving=true;
          if(d<=step){a.x=tx;a.y=ty;a.node=a.pathNodes.shift();a.path.shift();if(!a.path.length)this.arrive(a);}else{a.x+=dx/d*step;a.y+=dy/d*step;}continue;}a.moving=false;if((a.wait-=dt)>0)continue;
        if(a.kind==='hero'){const busy=new Set(this.agents.filter(o=>o!==a).map(o=>o.goalNode||o.node)),choices=SPOTS.filter(s=>!busy.has(s.node)),s=pick(choices.length?choices:SPOTS);a.spot=s;a.verb='';this.go(a,s.node);}else if(a.def.route){a.ri=(a.ri+1)%a.def.route.length;this.go(a,a.def.route[a.ri]);}else{a.face=Math.random()<.35?-a.face:a.face;a.wait=4+Math.random()*6;}}
      this.updateDialogue(dt);}
    updateDialogue(dt){if((this.dialogueAt-=dt)>0)return;this.agents.forEach(a=>{a.speech='';a.speechFor=0;});for(let tries=0;tries<DIALOGUES.length;tries++){const d=DIALOGUES[this.dialogue%DIALOGUES.length],people=d.people.map(n=>this.agents.find(a=>a.name===n));
        if(people.every(a=>a&&!a.moving)){const[speaker,text]=d.lines[this.dialogueLine%d.lines.length],a=this.agents.find(x=>x.name===speaker),other=people.find(x=>x!==a);a.speech=text;a.speechFor=4.3;a.face=other.x>=a.x?1:-1;other.face=a.x>=other.x?1:-1;this.dialogueLine++;if(this.dialogueLine>=d.lines.length){this.dialogueLine=0;this.dialogue++;this.dialogueAt=5;}else this.dialogueAt=4.5;return;}this.dialogue++;this.dialogueLine=0;}this.dialogueAt=2;}
    arrive(a){a.resources=[];a.goalNode=null;if(a.kind==='hero'){a.face=a.spot?.face||a.face;a.verb=a.spot?.verb||'';a.wait=7+Math.random()*10;}else a.wait=a.def.post?5+Math.random()*7:2+Math.random()*5;}
    drawList(){return this.agents.map(a=>({a,s:depth(a.y),h:40*depth(a.y)})).sort((p,q)=>p.a.y-q.a.y);}
  }
  KT.TownLife=TownLife;KT.TownMap={NODES:N,EDGES,SPOTS,FOLK,route,isWalk};
})();
