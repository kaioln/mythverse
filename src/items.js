(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const D = KT.Data, U = KT.Utils;

  // ---------------------------------------------------------------------------
  // ESPAÇOS DE EQUIPAMENTO
  // ---------------------------------------------------------------------------
  const slots = {
    weapon: { name:'Arma', icon:'⚔', primary:'atk', desc:'Aumenta o ATK.' },
    focus:  { name:'Foco', icon:'📖', primary:'skill', desc:'Aumenta o dano de habilidade e ultimate.' },
    seal:   { name:'Selo', icon:'🔰', primary:'def', desc:'Aumenta a DEF.' },
    charm:  { name:'Omamori', icon:'🧿', primary:'hp', desc:'Aumenta o HP.' }
  };
  const primaryValue = (stat, ilvl) => stat === 'atk' ? 14 * Math.pow(1.12, ilvl - 1) : stat === 'def' ? 9 * Math.pow(1.12, ilvl - 1) : stat === 'hp' ? 95 * Math.pow(1.12, ilvl - 1) : .05 + ilvl * .006;

  // ---------------------------------------------------------------------------
  // BASES — cada nível de item (ilvl) libera bases melhores.
  // ---------------------------------------------------------------------------
  const B = (id, slot, name, icon, hue, minIlvl, flavor) => ({ id, slot, name, icon, hue, minIlvl, flavor });
  const bases = [
    B('bokken','weapon','Bokken de Treino','katana_01',160,1,'Madeira de carvalho, marcada por mil treinos.'),
    B('bamboo_bow','weapon','Arco de Bambu','bow_loaded_01',45,1,'Leve e flexível.'),
    B('tsuki_katana','weapon','Katana de Tsukimori','katana_01',0,5,'Forjada pela família de Ren.'),
    B('sky_bow','weapon','Arco Celeste','bow_loaded_01',0,5,'Suas flechas brilham como estrelas.'),
    B('curved_blade','weapon','Lâmina Curva','tide_blade',290,8,'Uma lâmina de pirata esquecida.'),
    B('temple_nodachi','weapon','Nodachi do Templo','katana_01',290,11,'Longa demais para mãos comuns.'),
    B('dusk_bow','weapon','Arco do Crepúsculo','bow_loaded_01',290,11,'Encordoado com fios de sombra.'),
    B('tide_blade','weapon','Lâmina da Maré Crescente','tide_blade',0,16,'O aço lembra o movimento das ondas.'),
    B('coral_bow','weapon','Arco de Coral','bow_loaded_01',220,16,'Cresceu no fundo do mar.'),
    B('abyss_katana','weapon','Katana Abissal','katana_01',220,24,'Fria como o fundo do oceano.'),
    B('eclipse_blade','weapon','Lâmina do Eclipse','tide_blade',45,28,'Corta a própria luz.'),

    B('novice_tome','focus','Tomo do Aprendiz','tome_01',100,1,'Anotações de um estudante do Véu.'),
    B('dull_crystal','focus','Cristal Opaco','crystal_01',45,1,'Ainda guarda um pouco de energia.'),
    B('echo_tome','focus','Tomo dos Ecos','tome_01',0,5,'Repete palavras ditas há séculos.'),
    B('memory_crystal','focus','Cristal de Memória','crystal_01',0,6,'Guarda lembranças de heróis antigos.'),
    B('veil_grimoire','focus','Grimório do Véu','tome_01',290,11,'Suas páginas mudam sozinhas.'),
    B('dusk_orb','focus','Orbe do Crepúsculo','sea_heart',290,12,'Pulsa com luz violeta.'),
    B('tide_heart','focus','Coração das Marés','sea_heart',0,16,'Bate no ritmo da maré.'),
    B('abyss_crystal','focus','Cristal Abissal','crystal_01',220,22,'Encontrado no estômago de um leviatã.'),
    B('eclipse_codex','focus','Códice do Eclipse','tome_01',220,27,'Escrito com tinta de lua negra.'),
    B('star_prism','focus','Prisma Estelar','crystal_01',160,30,'Refrata a luz de estrelas mortas.'),

    B('wood_seal','seal','Selo de Madeira','eclipse_seal',100,1,'Um amuleto simples de proteção.'),
    B('fox_seal','seal','Selo da Raposa','lantern_seal',45,3,'Presente dos santuários de raposa.'),
    B('eclipse_seal','seal','Selo Lunar','eclipse_seal',0,7,'Bloqueia parte da escuridão.'),
    B('crimson_seal','seal','Selo Carmesim','lantern_seal',0,12,'Tingido com laca vermelha sagrada.'),
    B('tide_seal','seal','Selo da Maré','eclipse_seal',220,17,'Protege contra o afogamento.'),
    B('shadow_seal','seal','Selo das Sombras','lantern_seal',290,23,'Absorve golpes em silêncio.'),
    B('star_seal','seal','Selo Estelar','eclipse_seal',160,29,'Gravado com constelações perdidas.'),

    B('cloth_omamori','charm','Omamori de Pano','magic_dust_01',45,1,'Costurado pela avó de alguém.'),
    B('pilgrim_bag','charm','Bolsa do Peregrino','backpack_LVL_01',0,2,'Tem tudo que um viajante precisa.'),
    B('luck_omamori','charm','Omamori da Sorte','magic_dust_01',0,6,'Dizem que atrai boa fortuna.'),
    B('sacred_omamori','charm','Omamori Sagrado','magic_dust_01',290,12,'Abençoado no Templo do Véu.'),
    B('sailor_bag','charm','Bolsa do Marinheiro','backpack_LVL_01',220,17,'Cheira a sal e aventura.'),
    B('abyss_omamori','charm','Omamori Abissal','magic_dust_01',220,23,'Brilha no escuro do fundo do mar.'),
    B('celestial_omamori','charm','Omamori Celestial','magic_dust_01',160,29,'Tecido com fios de nuvem.')
  ];

  // ---------------------------------------------------------------------------
  // AFIXOS — atributos extras aleatórios. Raridade define a quantidade.
  // ---------------------------------------------------------------------------
  const A = (id, stat, name, min, max, pct = true) => ({ id, stat, name, min, max, pct });
  const affixes = [
    A('atkP','atk','Feroz',.03,.10), A('hpP','hp','Robusto',.04,.12), A('defP','def','Blindado',.04,.12),
    A('crit','crit','Preciso',.02,.06), A('critDmg','critDmg','Letal',.08,.25), A('spd','spd','Veloz',.03,.09),
    A('lifesteal','lifesteal','Vampírico',.02,.06), A('dodge','dodge','Esquivo',.02,.05), A('dr','dr','Guardião',.02,.06),
    A('regen','regen','Vital',.002,.006), A('healPow','healPow','Sagrado',.06,.18), A('dot','dot','Pestilento',.10,.30),
    A('boss','boss','Matador de Chefes',.06,.18), A('pierce','pierce','Perfurante',.04,.12), A('skill','skill','Arcano',.05,.15),
    A('nrg','nrg','Energizado',.05,.15), A('cdr','cdr','Ágil',.04,.12), A('startNrg','startNrg','Desperto',8,25,false),
    A('elem','elem','Elemental',.06,.18)
  ];

  // ---------------------------------------------------------------------------
  // CONJUNTOS — 4 peças (uma por espaço). Bônus com 2 e 4 peças equipadas.
  // ---------------------------------------------------------------------------
  const sets = [
    { id:'grove', name:'Guardião do Bosque', source:'Guardiões do Bosque (estágio 6+) e Shirogane', ilvl:8, color:'#5fe39a',
      pieces:{ weapon:['Bastão do Guardião','katana_01',100], focus:['Semente Ancestral','crystal_01',100], seal:['Casca de Musgo','eclipse_seal',100], charm:['Omamori de Folhas','magic_dust_01',100] },
      bonus2:{ text:'+15% HP', stats:{ hp:.15 } }, bonus4:{ text:'Ao receber dano: 15% de chance de ganhar escudo de 8% do HP máximo.', stats:{}, hook:{ onHurt:{ ch:.15, eff:[{ k:'shield', p:.08, to:'self', d:5 }] } } } },
    { id:'temple', name:'Chama do Templo', source:'Templo do Véu (baú e Guardião Ígneo)', ilvl:10, color:'#ff7a4f',
      pieces:{ weapon:['Lâmina Ígnea','tide_blade',45], focus:['Tomo de Brasas','tome_01',45], seal:['Selo de Magma','lantern_seal',0], charm:['Omamori Fumegante','magic_dust_01',45] },
      bonus2:{ text:'+20% dano contínuo', stats:{ dot:.20 } }, bonus4:{ text:'Ataques básicos têm 20% de chance de aplicar Queimadura (4s).', stats:{}, hook:{ onAtk:{ ch:.2, eff:[{ k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] } } } },
    { id:'eclipse', name:'Regalia do Eclipse', source:'Shirogane (Normal, Pesadelo, Inferno)', ilvl:14, color:'#b58cff',
      pieces:{ weapon:['Lâmina da Lua Negra','katana_01',290], focus:['Códice Lunar','tome_01',290], seal:['Selo do Eclipse','eclipse_seal',0], charm:['Omamori Crepuscular','magic_dust_01',290] },
      bonus2:{ text:'+12% ATK', stats:{ atk:.12 } }, bonus4:{ text:'Ultimates causam +35% de dano e concedem 15 de energia à equipe.', stats:{ ultDmg:.35 }, hook:{ onUlt:{ eff:[{ k:'nrg', v:15, to:'allies' }] } } } },
    { id:'tide', name:'Vestes da Maré', source:'Guardiões da Costa (estágio 6+)', ilvl:18, color:'#4fb3ff',
      pieces:{ weapon:['Arpão das Marés','tide_blade',0], focus:['Concha Cantante','sea_heart',0], seal:['Escama da Maré','eclipse_seal',220], charm:['Bolsa de Pérolas','backpack_LVL_01',220] },
      bonus2:{ text:'+12% DEF', stats:{ def:.12 } }, bonus4:{ text:'Abaixo de 50% de HP, regenera 2% do HP por segundo.', stats:{}, hook:{ lowRegen:.02 } } },
    { id:'archive', name:'Arquivista Proibido', source:'Arquivo Submerso (baú e Guardião da Tempestade)', ilvl:22, color:'#c9a4ff',
      pieces:{ weapon:['Pena Afiada','tide_blade',290], focus:['Tomo Afogado','tome_01',220], seal:['Selo das Runas','lantern_seal',290], charm:['Omamori de Tinta','magic_dust_01',220] },
      bonus2:{ text:'+15% ganho de energia', stats:{ nrg:.15 } }, bonus4:{ text:'Habilidades recarregam 20% mais rápido e têm 25% de chance de Silenciar o alvo.', stats:{ cdr:.20 }, hook:{ onSkill:{ eff:[{ k:'st', s:'silence', d:3, ch:.25, to:'tgt' }] } } } },
    { id:'dragon', name:'Relíquias de Mizuchi', source:'Mizuchi (Normal, Pesadelo, Inferno)', ilvl:28, color:'#6fe3ff',
      pieces:{ weapon:['Presa de Mizuchi','tide_blade',160], focus:['Olho do Dragão','sea_heart',160], seal:['Escama Abissal','eclipse_seal',160], charm:['Pérola do Dragão','magic_dust_01',160] },
      bonus2:{ text:'+15% HP e +10% DEF', stats:{ hp:.15, def:.10 } }, bonus4:{ text:'Recebe 20% menos dano e contra-ataca 25% dos golpes recebidos.', stats:{ dr:.20 }, hook:{ onHurt:{ ch:.25, eff:[{ k:'dmg', m:1.0, to:'attacker' }] } } } },
    { id:'lantern', name:'Lanterna da Kitsune', source:'Kitsune das Lanternas (evento)', ilvl:16, color:'#ff9ec7',
      pieces:{ weapon:['Leque de Nove Caudas','bow_loaded_01',290], focus:['Lanterna Viva','crystal_01',290], seal:['Selo da Raposa Carmesim','lantern_seal',0], charm:['Omamori do Festival','magic_dust_01',0] },
      bonus2:{ text:'+10% crítico', stats:{ crit:.10 } }, bonus4:{ text:'Críticos aplicam Queimadura e +25% de dano crítico.', stats:{ critDmg:.25 }, hook:{ onCrit:{ eff:[{ k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] } } } }
  ];

  // ---------------------------------------------------------------------------
  // ÚNICOS (Míticos) — nome, atributos fixos e um efeito especial.
  // ---------------------------------------------------------------------------
  const Q = (id, slot, name, icon, hue, minIlvl, source, stats, effect, hook) => ({ id, slot, name, icon, hue, minIlvl, source, stats, effect, hook });
  const uniques = [
    Q('muramasa','weapon','Muramasa Sedenta','katana_01',0,6,'Qualquer inimigo (raro)',{ lifesteal:.10, atk:.10 },'Abates curam 10% do HP máximo.',{ onKill:{ eff:[{ k:'heal', p:.10, to:'self' }] } }),
    Q('kusanagi','weapon','Kusanagi, Cortadora de Ventos','tide_blade',100,10,'Guardiões e chefes',{ atk:.12 },'Ataques básicos também atingem todos os outros inimigos por 25% do dano.',{ cleave:.25 }),
    Q('star_bow','weapon','Arco das Mil Estrelas','bow_loaded_01',160,8,'Qualquer inimigo (raro)',{ spd:.12, crit:.05 },'25% de chance de disparar uma segunda flecha.',{ onAtk:{ ch:.25, eff:[{ k:'dmg', m:1.0, to:'tgt' }] } }),
    Q('lunar_edge','weapon','Lâmina Lunar de Shirogane','katana_01',220,13,'Shirogane',{ boss:.25, atk:.10 },'Ataques aplicam Sangramento (30% de chance).',{ onAtk:{ ch:.3, eff:[{ k:'st', s:'bleed', d:4, v:.3, ch:1, to:'tgt' }] } }),
    Q('dragon_fang','weapon','Presa Viva de Mizuchi','tide_blade',160,27,'Mizuchi',{ atk:.15, pierce:.15 },'Ataques quebram a armadura do alvo (20%).',{ onAtk:{ ch:.2, eff:[{ k:'st', s:'armorBreak', d:5, v:.25, ch:1, to:'tgt' }] } }),
    Q('forbidden_tome','focus','Tomo Proibido','tome_01',290,9,'Dungeons',{ skill:.30, hp:-.10 },'Poder imenso, ao custo de vitalidade.',null),
    Q('dragon_eye','focus','Olho do Dragão Celeste','sea_heart',45,15,'Guardiões e chefes',{ crit:.10, critDmg:.30 },'Visão perfeita para pontos fracos.',null),
    Q('kitsune_heart','focus','Coração da Kitsune','crystal_01',290,15,'Kitsune das Lanternas',{ nrg:.20 },'Usar a ultimate reinicia a recarga da habilidade.',{ onUlt:{ eff:[{ k:'cdreset' }] } }),
    Q('still_clock','focus','Relógio Parado','sea_heart',220,20,'Arquivo Submerso',{ cdr:.25 },'O tempo corre diferente para quem o carrega.',null),
    Q('yata_mirror','seal','Espelho Yata','eclipse_seal',45,12,'Guardiões e chefes',{ def:.15 },'Reflete 20% do dano recebido.',{ thorns:.20 }),
    Q('emperor_seal','seal','Selo do Imperador','lantern_seal',160,18,'Chefes',{ def:.10 },'Toda a equipe recebe +10% DEF e +5% HP.',{ aura:{ def:.10, hp:.05 } }),
    Q('oni_mask','seal','Máscara Oni','lantern_seal',0,8,'Onis (raro)',{ atk:.08 },'Abaixo de 40% de HP: +40% ATK.',{ low:{ th:.4, eff:[{ k:'buff', s:'atk', v:.4, d:10, to:'self' }] } }),
    Q('phoenix_omamori','charm','Omamori da Fênix','magic_dust_01',0,14,'Chefes',{ hp:.10 },'Uma vez por batalha, revive com 40% do HP ao cair.',{ phoenix:.40 }),
    Q('temple_bell','charm','Sino do Templo','backpack_LVL_01',45,9,'Templo do Véu',{ hp:.08 },'No início de cada onda, a equipe recebe escudo de 6% do HP.',{ start:{ eff:[{ k:'shield', p:.06, to:'allies', d:6 }] } }),
    Q('eternal_lantern','charm','Lanterna Eterna','magic_dust_01',290,16,'Festival',{ healPow:.20, regen:.008 },'A luz nunca se apaga.',null),
    Q('tide_pearl','charm','Pérola da Maré','magic_dust_01',160,18,'Costa das Marés',{ nrg:.15, startNrg:30 },'Começa cada onda carregado de energia.',null)
  ];


  // ---------------------------------------------------------------------------
  // CARTAS — cada monstro tem a sua. Encaixe em slots de equipamento.
  // Cartas de chefe (MVP) são raríssimas e poderosas.
  // ---------------------------------------------------------------------------
  const cardStats = {
    fox:{ dodge:.04, crit:.03 }, golem:{ def:.08 }, spider_jade:{ dot:.12 }, oni:{ atk:.05 }, golem_elder:{ hp:.10, regen:.003 }, fox_nine:{ critDmg:.10, crit:.03 },
    oni_ash:{ atk:.05, pierce:.04 }, spider:{ pierce:.07 }, wisp_void:{ skill:.08 }, golem_obsidian:{ dr:.05 }, oni_crimson:{ atk:.09 }, fox_specter:{ dodge:.06 }, golem_lava:{ dot:.12, atk:.05 },
    wisp:{ nrg:.08 }, revenant:{ lifesteal:.035 }, fox_foam:{ spd:.05 }, spider_coral:{ thorns:.08 }, oni_tide:{ hp:.08 }, revenant_captain:{ atk:.06, def:.06 }, golem_coral:{ def:.12 },
    revenant_scribe:{ cdr:.08 }, wisp_arc:{ spd:.06, crit:.03 }, spider_ink:{ dot:.15 }, golem_crystal:{ healPow:.10 }, fox_storm:{ spd:.07 }, revenant_crimson:{ skill:.10 }, oni_storm:{ boss:.10, atk:.05 },
    wisp_ember:{ elem:.10 }, fox_gold:{ critDmg:.10, dodge:.04 }, mimic:{ atk:.06, hp:.06 },
    boss:{ atk:.15, boss:.15 }, boss_tide:{ hp:.20, dr:.10 }, boss_event:{ crit:.12, critDmg:.25 }
  };
  const cards = Object.entries(cardStats).map(([enemy, stats]) => {
    const e = KT.Data.enemies[enemy];
    return { id:`card_${enemy}`, enemy, name:`Carta ${e.name.split(',')[0]}`, stats, mvp:!!e.boss, sprite:e.sprite, el:e.el,
      chance:e.boss ? .04 : e.miniboss ? .03 : e.elite ? .012 : e.treasure ? .05 : .003 };
  });
  const cardById = id => cards.find(c => c.id === id);
  const socketsFor = rarity => ({ common:0, rare:Math.random() < .35 ? 1 : 0, epic:1, legendary:Math.random() < .5 ? 2 : 1, mythic:2, set:1 }[rarity] || 0);

  const rarityById = id => D.rarities.find(r => r.id === id) || D.rarities[0];

  function rollAffix(ilvl, exclude = []) {
    const pool = affixes.filter(a => !exclude.includes(a.id));
    const a = U.pick(pool); const roll = Math.random();
    const scale = 1 + Math.min(ilvl, 40) / 40;
    let v = (a.min + (a.max - a.min) * roll) * scale;
    v = a.pct ? Math.round(v * 1000) / 1000 : Math.round(v);
    return { id:a.id, stat:a.stat, v, roll };
  }

  function makeItem(opts) {
    const ilvl = Math.max(1, Math.round(opts.ilvl || 1));
    let rarity = opts.rarity || 'common';
    if (opts.unique) {
      const q = uniques.find(x => x.id === opts.unique);
      return { uid:U.uid('it'), kind:'unique', uniqueId:q.id, slot:q.slot, name:q.name, icon:q.icon, hue:q.hue, ilvl:Math.max(ilvl, q.minIlvl), rarity:'mythic', plus:0,
        primary:primaryValue(slots[q.slot].primary, Math.max(ilvl, q.minIlvl)) * rarityById('mythic').mult, affixes:[rollAffix(ilvl), rollAffix(ilvl)], cards:Array(socketsFor('mythic')).fill(null), locked:false, isNew:true };
    }
    if (opts.set) {
      const s = sets.find(x => x.id === opts.set); const slot = opts.slot || U.pick(Object.keys(slots)); const [name, icon, hue] = s.pieces[slot];
      const il = Math.max(ilvl, s.ilvl);
      const affs = []; for (let i = 0; i < 2; i++) { const a = rollAffix(il, affs.map(x => x.id)); affs.push(a); }
      return { uid:U.uid('it'), kind:'set', setId:s.id, slot, name, icon, hue, ilvl:il, rarity:'set', plus:0, primary:primaryValue(slots[slot].primary, il) * rarityById('set').mult, affixes:affs, cards:Array(socketsFor('set')).fill(null), locked:false, isNew:true };
    }
    const candidates = bases.filter(b => b.minIlvl <= ilvl && (!opts.slot || b.slot === opts.slot));
    const top = Math.max(...candidates.map(b => b.minIlvl));
    const base = opts.base ? bases.find(b => b.id === opts.base) : U.pick(candidates.filter(b => b.minIlvl >= top - 8));
    const r = rarityById(rarity);
    const affs = []; for (let i = 0; i < r.affixes; i++) { const a = rollAffix(ilvl, affs.map(x => x.id)); affs.push(a); }
    return { uid:U.uid('it'), kind:'base', baseId:base.id, slot:base.slot, name:base.name, icon:base.icon, hue:base.hue, ilvl, rarity, plus:0,
      primary:primaryValue(slots[base.slot].primary, ilvl) * r.mult * U.rand(.92, 1.08), affixes:affs, cards:Array(socketsFor(rarity)).fill(null), locked:false, isNew:true };
  }

  // Atributos finais de um item (primário + afixos + fixos do único), com aprimoramento.
  function itemStats(item) {
    const out = {}; const add = (k, v) => { out[k] = (out[k] || 0) + v; };
    const up = 1 + (item.plus || 0) * .10, upA = 1 + (item.plus || 0) * .05;
    const p = slots[item.slot].primary;
    if (p === 'skill') add('skill', item.primary * up); else add(`${p}Flat`, item.primary * up);
    (item.affixes || []).forEach(a => add(a.stat, a.v * upA));
    if (item.kind === 'unique') { const q = uniques.find(x => x.id === item.uniqueId); Object.entries(q?.stats || {}).forEach(([k, v]) => add(k, v)); }
    (item.cards || []).forEach(cid => { const c = cid && cardById(cid); if (c) Object.entries(c.stats).forEach(([k, v]) => add(k, v)); });
    return out;
  }

  function rollRarity(weights) {
    const ids = ['common','rare','epic','legendary'];
    let total = weights.reduce((a, b) => a + b, 0), r = Math.random() * total;
    for (let i = 0; i < ids.length; i++) { r -= weights[i]; if (r <= 0) return ids[i]; }
    return 'common';
  }

  // Tabela de drops: fonte ('normal' | 'elite' | 'guardian' | 'floorBoss' | 'boss' | 'chest'), zona e estágio.
  function rollDrop(source, zone, ilvl, luck = 0) {
    const tables = { normal:[70, 24, 5.5, .5], elite:[40, 40, 16, 4], guardian:[20, 45, 27, 8], floorBoss:[0, 40, 42, 18], boss:[0, 10, 55, 35], chest:[10, 50, 32, 8] };
    const w = (tables[source] || tables.normal).slice();
    if (luck) { w[1] *= 1 + luck * .5; w[2] *= 1 + luck; w[3] *= 1 + luck * 1.5; }
    const rarity = rollRarity(w);
    // Chance de único e de peça de conjunto.
    const uniqueChance = { normal:.002, elite:.01, guardian:.02, floorBoss:.05, boss:.10, chest:.03 }[source] || 0;
    if (Math.random() < uniqueChance * (1 + luck)) {
      const pool = uniques.filter(q => q.minIlvl <= ilvl + 4 && (sourceMatches(q, zone, source)));
      if (pool.length) return makeItem({ unique:U.pick(pool).id, ilvl });
    }
    const set = setForSource(zone, source, ilvl);
    const setChance = { guardian:.06, floorBoss:.25, boss:.35, chest:.12 }[source] || 0;
    if (set && Math.random() < setChance * (1 + luck * .5)) return makeItem({ set:set.id, ilvl });
    return makeItem({ ilvl, rarity });
  }
  function sourceMatches(q, zone, source) {
    const s = q.source;
    if (s.includes('Qualquer')) return true;
    if (s.includes('Guardiões') && ['guardian','floorBoss','boss'].includes(source)) return true;
    if (s.includes('Chefes') && source === 'boss') return true;
    if (s.includes('Dungeons') && zone?.kind === 'dungeon') return true;
    if (s.includes('Shirogane') && zone?.id === 'boss') return true;
    if (s.includes('Mizuchi') && zone?.id === 'boss_tide') return true;
    if (s.includes('Kitsune') && zone?.id === 'boss_event') return true;
    if (s.includes('Festival') && zone?.id === 'boss_event') return true;
    if (s.includes('Templo') && zone?.id === 'dungeon') return true;
    if (s.includes('Arquivo') && zone?.id === 'dungeon_tide') return true;
    if (s.includes('Costa') && zone?.id === 'hunt_tide') return true;
    if (s.includes('Onis') && ['guardian','elite','normal'].includes(source)) return Math.random() < .3;
    return false;
  }
  function setForSource(zone, source, ilvl) {
    if (!zone) return null;
    if (zone.id === 'hunt' && source === 'guardian' && ilvl >= 6) return sets[0];
    if (zone.id === 'dungeon' && ['floorBoss','chest'].includes(source)) return sets[1];
    if (zone.id === 'boss') return Math.random() < .5 ? sets[2] : sets[0];
    if (zone.id === 'hunt_tide' && source === 'guardian' && ilvl >= 19) return sets[3];
    if (zone.id === 'dungeon_tide' && ['floorBoss','chest'].includes(source)) return sets[4];
    if (zone.id === 'boss_tide') return sets[5];
    if (zone.id === 'boss_event') return sets[6];
    return null;
  }

  // Desmontar, aprimorar e encantar.
  const salvageTable = { common:{ ore:1, dust:1 }, rare:{ ore:3, dust:3 }, epic:{ ore:6, dust:8 }, legendary:{ ore:12, dust:18 }, mythic:{ ore:20, dust:35 }, set:{ ore:10, dust:20 } };
  function salvageValue(item) { const t = salvageTable[item.rarity] || salvageTable.common; const m = 1 + item.ilvl / 15 + (item.plus || 0) * .3; return { ore:Math.round(t.ore * m), dust:Math.round(t.dust * m), gold:Math.round(10 * item.ilvl * (1 + (item.plus || 0))) }; }
  function upgradeCost(item, forgeLevel = 1) {
    const n = (item.plus || 0) + 1, rm = { common:1, rare:1.3, epic:1.7, legendary:2.2, mythic:2.8, set:2.4 }[item.rarity] || 1;
    const disc = 1 - Math.min(.4, (forgeLevel - 1) * .04);
    return { gold:Math.round(60 * item.ilvl * Math.pow(n, 1.6) * rm * disc), ore:Math.round((2 + n * n * .8) * rm * disc), chance:n <= 5 ? 1 : Math.max(.35, 1 - (n - 5) * .12) };
  }
  function enchantCost(item, workshopLevel = 1) { const disc = 1 - Math.min(.4, (workshopLevel - 1) * .05); return { dust:Math.round((8 + item.ilvl * 1.5) * disc), gold:Math.round(40 * item.ilvl * disc) }; }
  const maxPlus = forgeLevel => Math.min(15, 3 + forgeLevel * 2);

  function itemScore(item) {
    const s = itemStats(item); let v = 0;
    v += (s.atkFlat || 0) * 6 + (s.defFlat || 0) * 4 + (s.hpFlat || 0) * .5;
    ['atk','hp','def','skill','spd','critDmg','boss','healPow','dot','pierce','nrg','cdr','elem'].forEach(k => { v += (s[k] || 0) * 800; });
    ['crit','lifesteal','dodge','dr'].forEach(k => { v += (s[k] || 0) * 1600; });
    v += (s.regen || 0) * 40000 + (s.startNrg || 0) * 8;
    if (item.kind === 'unique') v *= 1.25;
    v += (item.cards || []).length * 150;
    return Math.round(v);
  }

  KT.Items = { slots, bases, affixes, sets, uniques, cards, cardById, makeItem, itemStats, rollDrop, rollAffix, salvageValue, upgradeCost, enchantCost, maxPlus, itemScore, primaryValue };
})();
