(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const heroes = {
    rin: { coat:'#26386b', trim:'#79ddf2', hair:'#10263e', skin:'#f3c9a9', accent:'#f6e59b', weapon:'sword' },
    yuna: { coat:'#80345d', trim:'#ff9ac5', hair:'#3c203b', skin:'#f5c6af', accent:'#ffbd79', weapon:'staff' },
    aoi: { coat:'#287465', trim:'#a8e8bb', hair:'#234a40', skin:'#eac7a6', accent:'#f5dea0', weapon:'staff' },
    kaito: { coat:'#483d88', trim:'#b5a5ff', hair:'#242141', skin:'#e9bfa2', accent:'#f9e296', weapon:'spear' }
  };
  function path(c, points, fill, stroke='#152033', width=3) {
    c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath();
    c.fillStyle=fill; c.fill(); if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function ellipse(c,x,y,rx,ry,fill,stroke='#17243a',width=3){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function line(c,x1,y1,x2,y2,color,width=3){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  function chibi(c,id,time,anim){
    const p=heroes[id], bob=anim==='run'?Math.sin(time*18)*4:Math.sin(time*3)*2, attack=anim==='attack'?Math.sin(Math.min(time*13,Math.PI))*.6:0;
    c.save();c.translate(0,bob);c.rotate(attack*.08);
    ellipse(c,0,-18,28,11,'rgba(8,17,37,.35)',null);
    // Cloak, boots and the sash make each silhouette readable at game scale.
    path(c,[[-23,-47],[-35,-14],[-17,-8],[0,-17],[17,-8],[35,-14],[23,-47]],p.coat);
    path(c,[[-14,-23],[-13,-2],[-2,0],[1,-24]],'#20283b');path(c,[[4,-23],[3,-1],[15,-1],[16,-25]],'#20283b');
    path(c,[[-20,-54],[-27,-25],[-10,-20],[0,-34],[10,-20],[27,-25],[20,-54]],p.coat);
    path(c,[[-20,-52],[0,-37],[20,-52],[11,-61],[-11,-61]],p.trim);
    line(c,-18,-26,18,-26,p.accent,3);
    ellipse(c,-25,-42,7,12,p.coat);ellipse(c,25,-42,7,12,p.coat);
    ellipse(c,0,-68,23,22,p.skin);
    path(c,[[-25,-72],[-24,-88],[-12,-99],[8,-101],[23,-87],[27,-72],[14,-81],[-3,-79],[-16,-69]],p.hair);
    path(c,[[-22,-80],[-13,-88],[-17,-59],[-25,-62]],p.hair);
    if(id==='yuna') {path(c,[[16,-91],[30,-78],[25,-44],[15,-61]],p.hair);ellipse(c,24,-84,5,5,'#ed81af');}
    if(id==='aoi') {path(c,[[-17,-92],[-6,-106],[7,-93]],'#c0e8ba');ellipse(c,-21,-84,5,5,'#e2d890');}
    if(id==='kaito') {path(c,[[10,-99],[22,-110],[19,-88]],p.hair);path(c,[[-6,-98],[0,-109],[6,-98]],p.trim);}
    ellipse(c,-8,-68,2.6,4,'#102436',null);ellipse(c,8,-68,2.6,4,'#102436',null);
    line(c,-11,-75,-5,-76,p.hair,2);line(c,5,-76,11,-75,p.hair,2);
    line(c,-2,-58,3,-58,'#ad706b',1.5);
    // Emblem, scarf and a distinct weapon for each hero.
    ellipse(c,0,-49,5,5,p.accent,'#f6e8c9',1);
    if(p.weapon==='sword') {line(c,29,-35,45,-91,'#e8f7ff',5);line(c,24,-46,43,-41,p.accent,4);path(c,[[45,-91],[53,-100],[48,-84]],'#b7f3ff');}
    if(p.weapon==='staff') {line(c,30,-8,30,-91,'#7d5368',5);ellipse(c,30,-92,8,8,p.accent,'#fff2c5',2);ellipse(c,30,-92,3,3,'#fff7ea',null);}
    if(p.weapon==='spear') {line(c,31,-2,37,-105,'#d5c9e7',4);path(c,[[37,-105],[31,-88],[39,-89]],p.accent);}
    if(anim==='attack'){ellipse(c,36,-65,15,5,p.trim,null);}
    c.restore();
  }
  function monster(c,id,time,anim){
    const bob=Math.sin(time*(id==='wisp'?5:2.4))*3;c.save();c.translate(0,bob);
    if(id==='fox'){
      path(c,[[-31,-46],[-51,-83],[-26,-69]],'#8d497a');path(c,[[31,-46],[51,-83],[26,-69]],'#8d497a');
      path(c,[[-46,-25],[-28,-66],[0,-71],[29,-66],[46,-25],[23,-6],[-23,-6]],'#573d78');
      path(c,[[-23,-39],[0,-28],[23,-39],[13,-12],[-13,-12]],'#ba84b5');
      ellipse(c,-12,-44,5,7,'#fbe8a6',null);ellipse(c,12,-44,5,7,'#fbe8a6',null);ellipse(c,0,-23,5,3,'#2a203d',null);
      path(c,[[31,-25],[56,-40],[65,-18],[42,-7]],'#a65c8b');
    } else if(id==='oni'){
      path(c,[[-34,-74],[-41,-106],[-18,-83]],'#f4d69c');path(c,[[34,-74],[41,-106],[18,-83]],'#f4d69c');
      path(c,[[-36,-55],[-45,-12],[-22,-3],[0,-19],[22,-3],[45,-12],[36,-55]],'#5f2c55');
      ellipse(c,0,-66,35,31,'#ae5874');path(c,[[-39,-66],[-26,-91],[4,-95],[35,-76],[22,-64],[3,-83],[-18,-71]],'#322841');
      ellipse(c,-13,-64,5,6,'#f9e6aa',null);ellipse(c,13,-64,5,6,'#f9e6aa',null);
      line(c,-19,-47,19,-47,'#57253d',4);path(c,[[-13,-47],[-9,-37],[-3,-47]],'#fff0d8');path(c,[[8,-47],[12,-37],[17,-47]],'#fff0d8');
    } else if(id==='golem'){
      path(c,[[-37,-35],[-49,-67],[-24,-80],[0,-64],[24,-80],[49,-67],[37,-35],[30,-5],[-30,-5]],'#647b73');
      path(c,[[-29,-75],[0,-101],[29,-75],[19,-43],[-19,-43]],'#789283');
      path(c,[[-29,-49],[0,-59],[29,-49],[19,-20],[-19,-20]],'#4f6965');
      ellipse(c,-12,-68,5,5,'#b5f8cf',null);ellipse(c,12,-68,5,5,'#b5f8cf',null);
      line(c,-25,-35,5,-41,'#adcea6',4);line(c,5,-41,23,-21,'#adcea6',4);
      ellipse(c,-39,-25,14,18,'#708b7b');ellipse(c,39,-25,14,18,'#708b7b');
    } else if(id==='spider'){
      for(let s of [-1,1])for(let i=0;i<3;i++){line(c,s*17,-37+i*8,s*(47+i*2),-61+i*22,'#5d4c8d',7);}
      ellipse(c,0,-36,31,27,'#42396f');path(c,[[-24,-34],[0,-68],[24,-34],[0,-10]],'#8067ac');
      for(let s of [-1,1])for(let i=0;i<2;i++)ellipse(c,s*(7+i*8),-36,3,4,'#a9edff',null);
    } else if(id==='wisp'){
      ellipse(c,0,-45,27,31,'rgba(107,222,235,.35)',null);path(c,[[0,-94],[22,-63],[14,-38],[31,-18],[0,-6],[-31,-18],[-14,-38],[-22,-63]],'#5bd1db','#c7ffff',2);
      ellipse(c,0,-48,14,18,'#b4f7ef',null);ellipse(c,-5,-49,2.5,3,'#173b5e',null);ellipse(c,5,-49,2.5,3,'#173b5e',null);
    } else if(id==='revenant'){
      path(c,[[-25,-88],[-38,-45],[-31,-7],[0,-20],[31,-7],[38,-45],[25,-88]],'#2b5475');
      path(c,[[-34,-66],[0,-108],[34,-66],[21,-56],[-21,-56]],'#416b81');
      ellipse(c,0,-67,20,18,'#829da4');ellipse(c,-8,-67,4,5,'#8de3e6',null);ellipse(c,8,-67,4,5,'#8de3e6',null);
      line(c,31,-7,35,-100,'#b5dbd4',5);path(c,[[35,-100],[45,-78],[35,-85],[25,-78]],'#a8e9ea');
    } else if(id==='eclipse' || id==='dragon'){
      const tide=id==='dragon', body=tide?'#235e79':'#484064', glow=tide?'#8deaff':'#f0b8d6';
      path(c,[[-37,-30],[-65,-89],[-27,-67]],body);path(c,[[37,-30],[65,-89],[27,-67]],body);
      path(c,[[-30,-78],[-45,-117],[-14,-90]],glow);path(c,[[30,-78],[45,-117],[14,-90]],glow);
      path(c,[[-42,-70],[-52,-13],[-29,3],[0,-11],[29,3],[52,-13],[42,-70],[17,-94],[-17,-94]],body);
      path(c,[[-35,-31],[0,-53],[35,-31],[20,-3],[-20,-3]],tide?'#4190a2':'#866187');
      ellipse(c,0,-84,35,29,body);path(c,[[-37,-84],[-26,-110],[0,-99],[26,-110],[37,-84],[12,-94],[-12,-94]],tide?'#3a7f9a':'#6f5683');
      ellipse(c,-15,-83,7,6,glow,null);ellipse(c,15,-83,7,6,glow,null);
      line(c,-15,-60,15,-60,glow,3);ellipse(c,0,-28,11,11,glow,'#fff0ea',2);
    }
    if(anim==='hit'){c.fillStyle='rgba(255,255,255,.28)';c.fillRect(-47,-110,94,110);}
    c.restore();
  }
  KT.drawOriginalUnit = (c,id,time,anim,scale=1) => {
    c.save();c.scale(scale,scale);c.lineJoin='round';
    if(heroes[id]) chibi(c,id,time,anim); else monster(c,id,time,anim);
    c.restore();
  };
})();
