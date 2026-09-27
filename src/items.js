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
  // TIPOS DE ITEM: cada classe usa certos tipos em cada espaço, e cada tipo tem atributos próprios
  // (implícitos) e afixos mais prováveis. Tipos são compartilhados por 2 ou 3 classes, para dar
  // variedade de builds. Omamoris servem a todos; peças de conjunto seguem as classes do conjunto.
  const itemTypes = {
    sword:{ slot:'weapon', name:'Espada', icon:'⚔', classes:['Executor','Vanguarda'], attr:'str', implicit:{ crit:.03, critDmg:.08 }, affixW:{ crit:3, critDmg:3, atkP:2, pierce:2, lifesteal:2, boss:1.5 } },
    heavy:{ slot:'weapon', name:'Arma pesada', icon:'🔨', classes:['Vanguarda'], attr:'vit', implicit:{ hp:.05, def:.04 }, affixW:{ hpP:3, defP:3, dr:2.5, atkP:1.5, regen:1.5, lifesteal:1.5, breakPow:3, thorns:2 } },
    ranged:{ slot:'weapon', name:'Arco / à distância', icon:'🏹', classes:['Atirador'], attr:'dex', implicit:{ spd:.05, pierce:.03 }, affixW:{ spd:3, crit:2.5, pierce:2.5, critDmg:2, boss:2, elem:1.5 } },
    arcane:{ slot:'weapon', name:'Cajado arcano', icon:'✦', classes:['Arcanista','Suporte'], attr:'int', implicit:{ skill:.08, nrg:.04 }, affixW:{ skill:3, nrg:3, cdr:2.5, elem:2, dot:2, startNrg:1.5 } },
    holy:{ slot:'weapon', name:'Relíquia sagrada', icon:'✚', classes:['Suporte'], attr:'int', implicit:{ healPow:.10, regen:.002 }, affixW:{ healPow:3.5, regen:2.5, nrg:2, cdr:2, hpP:2, dr:1.5 } },
    tome:{ slot:'focus', name:'Tomo', icon:'📖', classes:['Arcanista','Suporte'], implicit:{ skill:.05, cdr:.03 }, affixW:{ skill:3, cdr:3, healPow:2, nrg:2 } },
    crystal:{ slot:'focus', name:'Cristal', icon:'💎', classes:['Arcanista','Atirador','Suporte'], implicit:{ nrg:.05, elem:.04 }, affixW:{ nrg:3, elem:3, startNrg:2, skill:1.5, chainPow:2.5, ultDmg:2 } },
    emblem:{ slot:'focus', name:'Emblema de guerra', icon:'🎖', classes:['Vanguarda','Executor'], implicit:{ atk:.04, critDmg:.06 }, affixW:{ atkP:3, critDmg:2.5, defP:2, boss:2, breakPow:2.5 } },
    quiver:{ slot:'focus', name:'Aljava', icon:'🎯', classes:['Atirador','Executor'], implicit:{ spd:.04, crit:.02 }, affixW:{ spd:3, crit:3, pierce:2, critDmg:2 } },
    plate:{ slot:'seal', name:'Selo de aço', icon:'🛡', classes:['Vanguarda','Executor','Atirador'], implicit:{ def:.06, dr:.015 }, affixW:{ defP:3, dr:3, hpP:2, lifesteal:1.5 } },
    ward:{ slot:'seal', name:'Selo espiritual', icon:'🔮', classes:['Arcanista','Suporte','Atirador'], implicit:{ hp:.05, healPow:.04 }, affixW:{ hpP:3, healPow:2.5, regen:2, dodge:2 } },
    relic:{ slot:null, name:'Relíquia de conjunto', icon:'◆', classes:null, implicit:{}, affixW:{} }
  };
  const weaponTypes = itemTypes;
  // Exceções pela história do personagem (tipos EXTRAS de arma além dos da classe).
  const heroWeaponExtra = {
    bjorn:['ranged'], dana:['ranged'], selene:['ranged'], aurelia:['ranged'],
    alden:['sword','heavy'], rina:['heavy'], yuki:['sword'], elian:['heavy'],
    ren:['sword'], sael:['sword'], garrick:['sword'], kori:['sword'], solen:['heavy'], drake:['heavy'], ryo:['heavy'],
    mei:['heavy'], riku:['heavy'], kenji:[], n9:['sword'], rex:['sword'], warden:['heavy'], rook:['heavy']
  };
  const wtFallback = { katana_01:'sword', tide_blade:'sword', bow_loaded_01:'ranged', crystal_01:'arcane', sea_heart:'arcane', tome_01:'holy', magic_dust_01:'holy', lantern_seal:'holy' };
  // Tipo de um item (null para omamoris, que servem a todos).
  function typeOf(item) {
    if (!item) return null;
    if (item.kind === 'set') return 'relic';
    if (item.slot === 'charm') return null;
    if (item.wt) return item.wt;
    if (item.kind === 'unique') return uniqueWT[item.uniqueId] || (item.slot === 'weapon' ? 'sword' : null);
    const b = bases.find(x => x.id === item.baseId);
    if (b?.wt) return b.wt;
    return item.slot === 'weapon' ? (wtFallback[item.icon] || 'sword') : null;
  }
  const weaponTypeOf = typeOf;
  function allowedTypes(heroId) {
    const t = KT.Data.roster?.find(h => h.id === heroId); if (!t) return [];
    return [...new Set([...Object.keys(itemTypes).filter(k => !itemTypes[k].classes || itemTypes[k].classes.includes(t.cls)), ...(heroWeaponExtra[heroId] || [])])];
  }
  const allowedWeaponTypes = allowedTypes;
  // Requisitos para equipar: nível do herói e, nas armas, pontos no atributo principal do tipo.
  const RAR_REQ = { common:0, rare:2, epic:5, legendary:9, mythic:12, set:7 };
  const RAR_ATTR = { common:.3, rare:.4, epic:.5, legendary:.6, mythic:.6, set:.5 };
  function reqFor(item) {
    const level = Math.max(1, Math.min(60, Math.round((item.ilvl || 1) * 1.15) + (RAR_REQ[item.rarity] || 0)));
    const t = typeOf(item), attr = t ? itemTypes[t]?.attr || null : null;
    return { level, attr, attrVal:attr ? Math.floor(level * (RAR_ATTR[item.rarity] || .3)) : 0 };
  }
  // hero = id do herói (só confere o tipo) ou o registro do herói (confere tudo).
  function equipCheck(item, hero) {
    if (!item) return { ok:false, reason:'Item inexistente.' };
    const rec = typeof hero === 'object' ? hero : null, heroId = rec ? rec.id : hero;
    const t = typeOf(item), tpl = KT.Data.roster?.find(h => h.id === heroId);
    if (!tpl) return { ok:false, reason:'Herói inválido.' };
    if (item.kind === 'set') { const st = sets.find(x => x.id === item.setId); if (st?.classes && !st.classes.includes(tpl.cls)) return { ok:false, reason:`O conjunto ${st.name} é para ${st.classes.join(', ')}.` }; }
    else if (t && !allowedTypes(heroId).includes(t)) return { ok:false, reason:`${tpl.name} não usa ${itemTypes[t].name}.` };
    if (rec) {
      const r = reqFor(item);
      if (rec.level < r.level) return { ok:false, reason:`Requer nível ${r.level} (${tpl.name} está no ${rec.level}).` };
      if (r.attr && (rec.attr?.[r.attr] || 0) < r.attrVal) return { ok:false, reason:`Requer ${r.attrVal} de ${KT.Progression?.attributes?.[r.attr]?.short || r.attr} (tem ${rec.attr?.[r.attr] || 0}).` };
    }
    return { ok:true };
  }
  const canEquip = (item, hero) => equipCheck(item, hero).ok;
  // Crescimento do atributo principal por nível de item: +12% até o 30, +4,5% depois. Antes era +12% sempre, e no fim
  // de jogo os itens multiplicavam o poder por centenas de vezes (a equipe crescia muito mais rápido que os inimigos).
  const ILVL_KNEE = 30, ILVL_G1 = 1.12, ILVL_G2 = 1.045;
  const ilvlGrowth = ilvl => Math.pow(ILVL_G1, Math.min(ilvl, ILVL_KNEE) - 1) * Math.pow(ILVL_G2, Math.max(0, ilvl - ILVL_KNEE));
  const primaryValue = (stat, ilvl) => stat === 'atk' ? 14 * ilvlGrowth(ilvl) : stat === 'def' ? 9 * ilvlGrowth(ilvl) : stat === 'hp' ? 95 * ilvlGrowth(ilvl) : .05 + ilvl * .006;
  // Itens criados com a curva antiga (nível acima de 30) são recalculados preservando a sorte e a raridade.
  const legacyGrowth = ilvl => Math.pow(1.12, ilvl - 1);
  function normalizeItemPrimary(it) {
    if (!it || it.pv === 2) return it;
    const p = slots[it.slot]?.primary;
    if (p && p !== 'skill' && (it.ilvl || 1) > ILVL_KNEE && Number.isFinite(it.primary)) it.primary = it.primary / legacyGrowth(it.ilvl) * ilvlGrowth(it.ilvl);
    it.pv = 2; return it;
  }

  // ---------------------------------------------------------------------------
  // BASES, cada nível de item (ilvl) libera bases melhores.
  // ---------------------------------------------------------------------------
  const B = (id, slot, name, icon, hue, minIlvl, flavor, wt) => ({ id, slot, name, icon, hue, minIlvl, flavor, ...(wt ? { wt } : {}) });
  const W = (wt, id, name, icon, hue, minIlvl, flavor) => B(id, 'weapon', name, icon, hue, minIlvl, flavor, wt);
  const bases = [
    // Espadas: Executores e Vanguardas.
    W('sword','bokken','Bokken de Treino','katana_01',160,1,'Madeira de carvalho, marcada por mil treinos.'),
    W('sword','tsuki_katana','Katana de Tsukimori','katana_01',0,5,'Forjada pela família de Ren.'),
    W('sword','jade_dagger','Adaga de Jade','katana_01',130,7,'Roubada de um túmulo real.'),
    W('sword','curved_blade','Lâmina Curva','tide_blade',290,9,'Uma lâmina de pirata esquecida.'),
    W('sword','temple_nodachi','Nodachi do Templo','katana_01',290,12,'Longa demais para mãos comuns.'),
    W('sword','tide_blade','Lâmina da Maré Crescente','tide_blade',0,16,'O aço lembra o movimento das ondas.'),
    W('sword','frost_blade','Lâmina Glacial','katana_01',190,19,'Nunca derrete.'),
    W('sword','abyss_katana','Katana Abissal','katana_01',220,24,'Fria como o fundo do oceano.'),
    W('sword','eclipse_blade','Lâmina do Eclipse','tide_blade',45,28,'Corta a própria luz.'),
    W('sword','dune_scimitar','Cimitarra das Dunas','tide_blade',20,33,'A areia nunca gruda na lâmina.'),
    W('sword','ghost_katana','Katana Espectral','katana_01',190,40,'Atravessa armaduras como névoa.'),
    W('sword','rift_edge','Gume Abissal','tide_blade',330,46,'Forjada do outro lado do Véu.'),
    // Armas pesadas e manoplas: Vanguardas (e lutadores de punho).
    W('heavy','oak_club','Clava de Carvalho','tide_blade',160,1,'Pesada, honesta e sem firula.'),
    W('heavy','bog_spear','Lança do Brejo','tide_blade',100,4,'Ainda pinga lodo.'),
    W('heavy','iron_gauntlets','Manoplas de Ferro','tide_blade',250,9,'Para quem prefere resolver no soco.'),
    W('heavy','temple_glaive','Glaive do Templo','katana_01',100,13,'Varre três inimigos de uma vez.'),
    W('heavy','tide_trident','Tridente das Marés','tide_blade',220,17,'Tirado da mão de um capitão afogado.'),
    W('heavy','forge_hammer','Martelo da Forja','tide_blade',20,22,'Ainda quente depois de séculos.'),
    W('heavy','dune_axe','Machado das Dunas','tide_blade',70,32,'Corta pedra como se fosse areia.'),
    W('heavy','clock_maul','Marreta do Relógio','tide_blade',190,38,'Cada golpe atrasa o tempo do alvo.'),
    W('heavy','void_mace','Maça do Vazio','tide_blade',330,46,'Não faz barulho. Só estrago.'),
    // Arcos e armas à distância: Atiradores.
    W('ranged','bamboo_bow','Arco de Bambu','bow_loaded_01',45,1,'Leve e flexível.'),
    W('ranged','sky_bow','Arco Celeste','bow_loaded_01',0,5,'Suas flechas brilham como estrelas.'),
    W('ranged','swamp_sling','Arco do Caçador de Brejo','bow_loaded_01',100,8,'Cordas de junco trançado.'),
    W('ranged','dusk_bow','Arco do Crepúsculo','bow_loaded_01',290,12,'Encordoado com fios de sombra.'),
    W('ranged','coral_bow','Arco de Coral','bow_loaded_01',220,16,'Cresceu no fundo do mar.'),
    W('ranged','iron_crossbow','Besta de Ferro','bow_loaded_01',160,22,'Engenharia da forja abissal.'),
    W('ranged','amber_bow','Arco de Âmbar','bow_loaded_01',20,30,'Presa no âmbar, uma flecha espera há mil anos.'),
    W('ranged','chrono_bow','Arco Cronal','bow_loaded_01',250,36,'A flecha chega antes do disparo.'),
    W('ranged','rift_bow','Arco da Fenda','bow_loaded_01',330,46,'Dispara através dos mundos.'),
    // Cajados e orbes arcanos: Arcanistas (Suportes também canalizam).
    W('arcane','apprentice_staff','Cajado de Aprendiz','crystal_01',100,1,'Ainda tem o nome do dono anterior riscado.'),
    W('arcane','firefly_orb','Orbe do Vaga-lume','sea_heart',70,5,'A luz responde ao pensamento.'),
    W('arcane','jade_staff','Cajado de Jade','crystal_01',130,9,'Canaliza ritos da dinastia.'),
    W('arcane','veil_scepter','Cetro do Véu','crystal_01',290,13,'Vibra perto de portais.'),
    W('arcane','aurora_scepter','Cetro da Aurora','crystal_01',190,18,'Uma aurora presa no cristal.'),
    W('arcane','magma_orb','Orbe de Magma','sea_heart',20,23,'Quente demais para segurar sem luvas.'),
    W('arcane','sun_staff','Cajado Solar','crystal_01',45,32,'Guarda o calor de mil dias no deserto.'),
    W('arcane','specter_orb','Orbe Espectral','sea_heart',250,40,'Almas giram lá dentro.'),
    W('arcane','rift_scepter','Cetro do Vazio','crystal_01',330,46,'A ponta encosta em outro mundo.'),
    // Relíquias sagradas: Suportes.
    W('holy','prayer_bell','Sino de Oração','tome_01',20,1,'Cada badalada, uma bênção.'),
    W('holy','shrine_rosary','Rosário do Santuário','magic_dust_01',70,6,'Contas polidas por mãos devotas.'),
    W('holy','sacred_staff','Cajado Sagrado','crystal_01',70,12,'Abençoado pela Guardiã do Véu.'),
    W('holy','ice_lily','Lírio de Gelo','crystal_01',160,18,'Floresce mesmo na nevasca.'),
    W('holy','censer','Incensário da Forja','sea_heart',100,24,'A fumaça cura queimaduras.'),
    W('holy','golden_ankh','Ankh Dourado','lantern_seal',70,33,'Símbolo da vida eterna.'),
    W('holy','spectral_harp','Harpa Espectral','tome_01',250,40,'Toca a canção que liberta almas.'),
    W('holy','rift_reliquary','Relicário Entre-Mundos','sea_heart',330,47,'Guarda luz de um mundo que acabou.'),

    B('novice_tome','focus','Tomo do Aprendiz','tome_01',100,1,'Anotações de um estudante do Véu.','tome'),
    B('dull_crystal','focus','Cristal Opaco','crystal_01',45,1,'Ainda guarda um pouco de energia.','crystal'),
    B('echo_tome','focus','Tomo dos Ecos','tome_01',0,5,'Repete palavras ditas há séculos.','tome'),
    B('memory_crystal','focus','Cristal de Memória','crystal_01',0,6,'Guarda lembranças de heróis antigos.','crystal'),
    B('firefly_jar','focus','Pote de Vaga-lumes','crystal_01',70,4,'A luz obedece a quem canta.','crystal'),
    B('jade_tablet','focus','Tábua de Jade','tome_01',130,8,'Ritos proibidos da dinastia.','tome'),
    B('aurora_orb','focus','Orbe da Aurora','sea_heart',190,18,'Guarda uma aurora inteira.','crystal'),
    B('veil_grimoire','focus','Grimório do Véu','tome_01',290,11,'Suas páginas mudam sozinhas.','tome'),
    B('dusk_orb','focus','Orbe do Crepúsculo','sea_heart',290,12,'Pulsa com luz violeta.','crystal'),
    B('tide_heart','focus','Coração das Marés','sea_heart',0,16,'Bate no ritmo da maré.','crystal'),
    B('abyss_crystal','focus','Cristal Abissal','crystal_01',220,22,'Encontrado no estômago de um leviatã.','crystal'),
    B('eclipse_codex','focus','Códice do Eclipse','tome_01',220,27,'Escrito com tinta de lua negra.','tome'),
    B('star_prism','focus','Prisma Estelar','crystal_01',160,30,'Refrata a luz de estrelas mortas.','crystal'),
    B('sand_hourglass','focus','Ampulheta Rachada','sea_heart',20,33,'Cada grão é um segundo roubado.','crystal'),
    B('specter_lantern','focus','Lanterna Espectral','crystal_01',190,39,'Ilumina o que já morreu.','crystal'),
    B('rift_codex','focus','Códice Proibido','tome_01',330,45,'Escrito em línguas de mundos que não existem.','tome'),

    B('wood_seal','seal','Selo de Madeira','eclipse_seal',100,1,'Um amuleto simples de proteção.','ward'),
    B('fox_seal','seal','Selo da Raposa','lantern_seal',45,3,'Presente dos santuários de raposa.','ward'),
    B('eclipse_seal','seal','Selo Lunar','eclipse_seal',0,7,'Bloqueia parte da escuridão.','ward'),
    B('crimson_seal','seal','Selo Carmesim','lantern_seal',0,12,'Tingido com laca vermelha sagrada.','plate'),
    B('moss_seal','seal','Selo de Musgo','eclipse_seal',70,5,'Cresce sobre o dono.','ward'),
    B('frost_seal','seal','Selo de Geada','lantern_seal',190,19,'Frio que endurece a pele.','plate'),
    B('anvil_seal','seal','Selo da Bigorna','eclipse_seal',20,23,'Pesado como uma promessa.','plate'),
    B('tide_seal','seal','Selo da Maré','eclipse_seal',220,17,'Protege contra o afogamento.','plate'),
    B('shadow_seal','seal','Selo das Sombras','lantern_seal',290,23,'Absorve golpes em silêncio.','ward'),
    B('star_seal','seal','Selo Estelar','eclipse_seal',160,29,'Gravado com constelações perdidas.','ward'),
    B('pharaoh_seal','seal','Selo do Faraó','lantern_seal',45,34,'Traz o nome de um rei esquecido.','plate'),
    B('gear_seal','seal','Selo de Engrenagem','eclipse_seal',250,40,'Gira sozinho quando o perigo se aproxima.','plate'),
    B('rift_seal','seal','Selo do Abismo','lantern_seal',330,47,'Sela ferimentos entre mundos.','ward'),

    // Novos focos e selos por classe.
    B('tide_tome','focus','Tomo das Marés','tome_01',220,17,'As páginas cheiram a sal.','tome'),
    B('sand_scroll','focus','Pergaminho do Deserto','tome_01',45,34,'Escrito com areia que não cai.','tome'),
    B('recruit_emblem','focus','Emblema de Recruta','lantern_seal',20,1,'Todo herói começa em algum lugar.','emblem'),
    B('fox_banner','focus','Estandarte da Raposa','lantern_seal',70,6,'Tremula mesmo sem vento.','emblem'),
    B('temple_emblem','focus','Emblema do Templo','lantern_seal',130,12,'Dado aos guardiões do Véu.','emblem'),
    B('tide_crest','focus','Brasão da Maré','lantern_seal',220,18,'Da frota que o mar engoliu.','emblem'),
    B('forge_emblem','focus','Insígnia da Forja','lantern_seal',20,24,'Martelada à mão por Ren.','emblem'),
    B('pharaoh_banner','focus','Estandarte do Faraó','lantern_seal',45,33,'Um exército inteiro já o seguiu.','emblem'),
    B('clock_crest','focus','Brasão do Relógio','lantern_seal',250,40,'O ponteiro aponta para a vitória.','emblem'),
    B('rift_banner','focus','Estandarte Rasgado','lantern_seal',330,46,'Tecido com fios de outro mundo.','emblem'),
    B('bamboo_quiver','focus','Aljava de Bambu','backpack_LVL_01',100,1,'Leve e resistente.','quiver'),
    B('hunter_quiver','focus','Aljava do Caçador','backpack_LVL_01',70,6,'Couro curtido no pântano.','quiver'),
    B('dusk_quiver','focus','Aljava do Crepúsculo','backpack_LVL_01',290,12,'As flechas saem em silêncio.','quiver'),
    B('coral_quiver','focus','Aljava de Coral','backpack_LVL_01',160,18,'Nunca molha as penas.','quiver'),
    B('iron_quiver','focus','Aljava de Ferro','backpack_LVL_01',20,24,'Feita para besteiros da forja.','quiver'),
    B('amber_quiver','focus','Aljava de Âmbar','backpack_LVL_01',45,32,'Flechas presas no tempo.','quiver'),
    B('chrono_quiver','focus','Aljava Cronal','backpack_LVL_01',250,40,'Sempre há mais uma flecha.','quiver'),
    B('rift_quiver','focus','Aljava da Fenda','backpack_LVL_01',330,46,'Busca flechas de outros mundos.','quiver'),
    B('iron_plate','seal','Placa de Ferro','eclipse_seal',190,1,'Pesada, mas confiável.','plate'),
    B('guard_plate','seal','Placa da Guarda','eclipse_seal',130,6,'Usada pela guarda de Tsukimori.','plate'),
    B('rift_plate','seal','Placa Estilhaçada','eclipse_seal',330,46,'Não amassa. Nunca.','plate'),
    B('shrine_ward','seal','Selo do Santuário','lantern_seal',160,14,'Abençoado por Sayo.','ward'),
    B('cloth_omamori','charm','Omamori de Pano','magic_dust_01',45,1,'Costurado pela avó de alguém.'),
    B('pilgrim_bag','charm','Bolsa do Peregrino','backpack_LVL_01',0,2,'Tem tudo que um viajante precisa.'),
    B('luck_omamori','charm','Omamori da Sorte','magic_dust_01',0,6,'Dizem que atrai boa fortuna.'),
    B('witch_charm','charm','Amuleto da Bruxa','backpack_LVL_01',70,5,'Não pergunte o que tem dentro.'),
    B('jade_omamori','charm','Omamori de Jade','magic_dust_01',130,9,'Frio ao toque, quente no coração.'),
    B('snow_omamori','charm','Omamori da Neve','magic_dust_01',190,18,'Cada floco, uma prece.'),
    B('sacred_omamori','charm','Omamori Sagrado','magic_dust_01',290,12,'Abençoado no Templo do Véu.'),
    B('sailor_bag','charm','Bolsa do Marinheiro','backpack_LVL_01',220,17,'Cheira a sal e aventura.'),
    B('abyss_omamori','charm','Omamori Abissal','magic_dust_01',220,23,'Brilha no escuro do fundo do mar.'),
    B('celestial_omamori','charm','Omamori Celestial','magic_dust_01',160,29,'Tecido com fios de nuvem.'),
    B('scarab_charm','charm','Escaravelho de Âmbar','magic_dust_01',45,35,'Dizem que ainda está vivo.'),
    B('ghost_veil','charm','Véu da Noiva','backpack_LVL_01',190,41,'Leve como um suspiro.'),
    B('rift_heart','charm','Coração Pulsante','magic_dust_01',330,48,'Pulsa no ritmo de dois mundos.'),
    // Capítulo IV: O Céu Partido.
    W('sword','thunder_tachi','Tachi do Trovão','katana_01',190,50,'A lâmina zumbe antes de cada tempestade.'),
    W('heavy','bell_maul','Malho do Sino Colossal','tide_blade',20,52,'Cada golpe badala no peito do inimigo.'),
    W('ranged','tengu_bow','Arco de Pena de Tengu','bow_loaded_01',100,48,'As flechas voltam para a aljava sozinhas.'),
    W('arcane','cloud_staff','Cajado das Nuvens','tome_01',190,49,'Chove um pouco onde ele aponta.'),
    W('holy','hanami_relic','Relíquia do Hanami','crystal_01',330,53,'Uma pétala que nunca murcha.'),
    B('storm_core','focus','Núcleo de Tempestade','crystal_01',190,54,'Um relâmpago preso em cristal.','crystal'),
    B('fujin_scroll','focus','Pergaminho de Fujin','tome_01',130,51,'Ensina a ler o vento.','tome'),
    B('raiju_emblem','focus','Emblema do Raiju','eclipse_seal',70,50,'Arranhado por garras elétricas.','emblem'),
    B('cloud_plate','seal','Selo de Granito Alado','lantern_seal',190,49,'Pedra que não sabe cair.','plate'),
    B('sakura_ward','seal','Selo da Primavera Eterna','eclipse_seal',330,52,'Cheira a flores mesmo no inverno.','ward'),
    B('drum_charm','charm','Omamori do Tambor','sea_heart',190,56,'Bate junto com o seu coração.')
  ];

  // ---------------------------------------------------------------------------
  // AFIXOS, atributos extras aleatórios. Raridade define a quantidade.
  // ---------------------------------------------------------------------------
  const A = (id, stat, name, min, max, pct = true, minIlvl = 0) => ({ id, stat, name, min, max, pct, minIlvl });
  const affixes = [
    A('atkP','atk','Feroz',.03,.10), A('hpP','hp','Robusto',.04,.12), A('defP','def','Blindado',.04,.12),
    A('crit','crit','Preciso',.02,.06), A('critDmg','critDmg','Letal',.08,.25), A('spd','spd','Veloz',.03,.09),
    A('lifesteal','lifesteal','Vampírico',.02,.06), A('dodge','dodge','Esquivo',.02,.05), A('dr','dr','Guardião',.02,.06),
    A('regen','regen','Vital',.002,.006), A('healPow','healPow','Sagrado',.06,.18), A('dot','dot','Pestilento',.10,.30),
    A('boss','boss','Matador de Chefes',.06,.18), A('pierce','pierce','Perfurante',.04,.12), A('skill','skill','Arcano',.05,.15),
    A('nrg','nrg','Energizado',.05,.15), A('cdr','cdr','Ágil',.04,.12), A('startNrg','startNrg','Desperto',8,25,false),
    A('elem','elem','Elemental',.06,.18),
    // Afixos de fim de jogo (Capítulo III+): ligados à Quebra de postura e ao Elo Kizuna.
    A('breakPow','breakPow','Quebra-Muralhas',.10,.30,true,36), A('chainPow','chainPow','Encadeado',.03,.08,true,36),
    A('ultDmg','ultDmg','Apoteótico',.06,.18,true,44), A('thorns','thorns','Espinhoso',.06,.16,true,30)
  ];

  // ---------------------------------------------------------------------------
  // CONJUNTOS, 4 peças (uma por espaço). Bônus com 2 e 4 peças equipadas.
  // ---------------------------------------------------------------------------
  const sets = [
    { id:'grove', classes:['Vanguarda','Suporte'], name:'Guardião do Bosque', source:'Guardiões do Bosque (estágio 6+) e Shirogane', ilvl:8, color:'#5fe39a',
      pieces:{ weapon:['Bastão do Guardião','katana_01',100], focus:['Semente Ancestral','crystal_01',100], seal:['Casca de Musgo','eclipse_seal',100], charm:['Omamori de Folhas','magic_dust_01',100] },
      bonus2:{ text:'+15% HP', stats:{ hp:.15 } }, bonus4:{ text:'Ao receber dano: 15% de chance de ganhar escudo de 8% do HP máximo.', stats:{}, hook:{ onHurt:{ ch:.15, eff:[{ k:'shield', p:.08, to:'self', d:5 }] } } } },
    { id:'temple', classes:['Executor','Arcanista','Atirador'], name:'Chama do Templo', source:'Templo do Véu (baú e Guardião Ígneo)', ilvl:10, color:'#ff7a4f',
      pieces:{ weapon:['Lâmina Ígnea','tide_blade',45], focus:['Tomo de Brasas','tome_01',45], seal:['Selo de Magma','lantern_seal',0], charm:['Omamori Fumegante','magic_dust_01',45] },
      bonus2:{ text:'+20% dano contínuo', stats:{ dot:.20 } }, bonus4:{ text:'Ataques básicos têm 20% de chance de aplicar Queimadura (4s).', stats:{}, hook:{ onAtk:{ ch:.2, eff:[{ k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] } } } },
    { id:'eclipse', classes:['Arcanista','Executor'], name:'Regalia do Eclipse', source:'Shirogane (Normal, Pesadelo, Inferno)', ilvl:14, color:'#b58cff',
      pieces:{ weapon:['Lâmina da Lua Negra','katana_01',290], focus:['Códice Lunar','tome_01',290], seal:['Selo do Eclipse','eclipse_seal',0], charm:['Omamori Crepuscular','magic_dust_01',290] },
      bonus2:{ text:'+12% ATK', stats:{ atk:.12 } }, bonus4:{ text:'Ultimates causam +35% de dano e concedem 15 de energia à equipe.', stats:{ ultDmg:.35 }, hook:{ onUlt:{ eff:[{ k:'nrg', v:15, to:'allies' }] } } } },
    { id:'tide', classes:['Vanguarda'], name:'Vestes da Maré', source:'Guardiões da Costa (estágio 6+)', ilvl:18, color:'#4fb3ff',
      pieces:{ weapon:['Arpão das Marés','tide_blade',0], focus:['Concha Cantante','sea_heart',0], seal:['Escama da Maré','eclipse_seal',220], charm:['Bolsa de Pérolas','backpack_LVL_01',220] },
      bonus2:{ text:'+12% DEF', stats:{ def:.12 } }, bonus4:{ text:'Abaixo de 50% de HP, regenera 2% do HP por segundo.', stats:{}, hook:{ lowRegen:.02 } } },
    { id:'archive', classes:['Arcanista','Suporte'], name:'Arquivista Proibido', source:'Arquivo Submerso (baú e Guardião da Tempestade)', ilvl:22, color:'#c9a4ff',
      pieces:{ weapon:['Pena Afiada','tide_blade',290], focus:['Tomo Afogado','tome_01',220], seal:['Selo das Runas','lantern_seal',290], charm:['Omamori de Tinta','magic_dust_01',220] },
      bonus2:{ text:'+15% ganho de energia', stats:{ nrg:.15 } }, bonus4:{ text:'Habilidades recarregam 20% mais rápido e têm 25% de chance de Silenciar o alvo.', stats:{ cdr:.20 }, hook:{ onSkill:{ eff:[{ k:'st', s:'silence', d:3, ch:.25, to:'tgt' }] } } } },
    { id:'dragon', classes:['Vanguarda','Executor'], name:'Relíquias de Mizuchi', source:'Mizuchi (Normal, Pesadelo, Inferno)', ilvl:28, color:'#6fe3ff',
      pieces:{ weapon:['Presa de Mizuchi','tide_blade',160], focus:['Olho do Dragão','sea_heart',160], seal:['Escama Abissal','eclipse_seal',160], charm:['Pérola do Dragão','magic_dust_01',160] },
      bonus2:{ text:'+15% HP e +10% DEF', stats:{ hp:.15, def:.10 } }, bonus4:{ text:'Recebe 20% menos dano e contra-ataca 25% dos golpes recebidos.', stats:{ dr:.20 }, hook:{ onHurt:{ ch:.25, eff:[{ k:'dmg', m:1.0, to:'attacker' }] } } } },
    { id:'lantern', classes:['Executor','Atirador'], name:'Lanterna da Kitsune', source:'Kitsune das Lanternas (evento)', ilvl:16, color:'#ff9ec7',
      pieces:{ weapon:['Leque de Nove Caudas','bow_loaded_01',290], focus:['Lanterna Viva','crystal_01',290], seal:['Selo da Raposa Carmesim','lantern_seal',0], charm:['Omamori do Festival','magic_dust_01',0] },
      bonus2:{ text:'+10% crítico', stats:{ crit:.10 } }, bonus4:{ text:'Críticos aplicam Queimadura e +25% de dano crítico.', stats:{ critDmg:.25 }, hook:{ onCrit:{ eff:[{ k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] } } } },
    { id:'swamp', classes:['Suporte','Arcanista'], name:'Segredos da Bruxa', source:'Guardiões do Pântano dos Vaga-lumes', ilvl:6, color:'#8fe36b',
      pieces:{ weapon:['Varinha de Salgueiro','tide_blade',100], focus:['Caldeirão de Bolso','sea_heart',100], seal:['Selo do Brejo','lantern_seal',100], charm:['Bolsa de Ervas','backpack_LVL_01',100] },
      bonus2:{ text:'+15% cura e escudos', stats:{ healPow:.15 } }, bonus4:{ text:'Habilidades envenenam todos os inimigos (18% do ATK/s por 5s).', stats:{}, hook:{ onSkill:{ eff:[{ k:'st', s:'poison', d:5, v:.18, ch:1, to:'all' }] } } } },
    { id:'crypt', classes:['Vanguarda','Suporte'], name:'Dinastia de Jade', source:'Cripta de Jade (baú e Rei Sem Túmulo)', ilvl:9, color:'#5fe3b0',
      pieces:{ weapon:['Cetro da Dinastia','katana_01',130], focus:['Selo Imperial de Jade','crystal_01',130], seal:['Máscara Funerária','eclipse_seal',130], charm:['Mortalha de Jade','magic_dust_01',130] },
      bonus2:{ text:'+10% DEF e +8% HP', stats:{ def:.10, hp:.08 } }, bonus4:{ text:'Abaixo de 50% de HP (1× por onda): escudo de 15% do HP e +20 de energia para a equipe.', stats:{}, hook:{ low:{ th:.5, eff:[{ k:'shield', p:.15, to:'self', d:6 }, { k:'nrg', v:20, to:'allies' }] } } } },
    { id:'frost', classes:['Atirador','Executor'], name:'Inverno Eterno', source:'Guardiões do Planalto Congelado', ilvl:18, color:'#91dfff',
      pieces:{ weapon:['Presa da Nevasca','katana_01',190], focus:['Floco Eterno','crystal_01',190], seal:['Coroa de Gelo','lantern_seal',190], charm:['Manto Boreal','magic_dust_01',190] },
      bonus2:{ text:'+6% crítico', stats:{ crit:.06 } }, bonus4:{ text:'Ataques básicos têm 15% de chance de Congelar (1,2s); +25% de dano contra congelados.', stats:{}, hook:{ onAtk:{ ch:.15, eff:[{ k:'st', s:'freeze', d:1.2, v:0, ch:1, to:'tgt' }] }, vs:{ s:'freeze', v:.25 } } } },
    { id:'forge', classes:['Executor','Vanguarda','Atirador'], name:'Ferreiro Abissal', source:'Forja Abissal (baú e Coração da Forja)', ilvl:23, color:'#ff9a4f',
      pieces:{ weapon:['Martelo do Primeiro Aço','tide_blade',20], focus:['Brasa Eterna','sea_heart',20], seal:['Placa de Bigorna','eclipse_seal',20], charm:['Avental de Ren','backpack_LVL_01',20] },
      bonus2:{ text:'+10% perfuração de DEF', stats:{ pierce:.10 } }, bonus4:{ text:'+10% ATK. A cada 4 ataques, golpe de 150% ATK que ignora 50% da DEF.', stats:{ atk:.10 }, hook:{ every:{ n:4, eff:[{ k:'dmg', m:1.5, to:'tgt', pierce:.5 }] } } } },
    { id:'sands', classes:['Vanguarda','Executor'], name:'Tesouro do Faraó', source:'Guardiões das Areias do Tempo e Apep', ilvl:31, color:'#ffcf6b',
      pieces:{ weapon:['Khopesh Dourado','tide_blade',45], focus:['Olho de Hórus','sea_heart',45], seal:['Selo Real','lantern_seal',45], charm:['Escaravelho Sagrado','magic_dust_01',45] },
      bonus2:{ text:'+12% HP e 0,4% HP/s', stats:{ hp:.12, regen:.004 } }, bonus4:{ text:'Abaixo de 35% de HP (1× por onda): escudo de 30% do HP e purifica efeitos negativos.', stats:{}, hook:{ low:{ th:.35, eff:[{ k:'shield', p:.30, to:'self', d:6 }, { k:'cleanse', to:'self' }] } } } },
    { id:'gladiator', classes:null, name:'Gladiador Carmesim', source:'Loja de Honra (Arena PvP)', ilvl:30, color:'#ff9a6b',
      pieces:{ weapon:['Gládio da Honra','katana_01',20], focus:['Estandarte do Coliseu','tome_01',20], seal:['Escudo da Arena','eclipse_seal',20], charm:['Laurel do Campeão','magic_dust_01',20] },
      bonus2:{ text:'+8% ATK e +8% HP', stats:{ atk:.08, hp:.08 } }, bonus4:{ text:'Início de cada onda: +25 de energia e escudo de 10% do HP.', stats:{}, hook:{ start:{ eff:[{ k:'nrg', v:25, to:'self' }, { k:'shield', p:.10, to:'self', d:6 }] } } } },
    { id:'storm', classes:['Arcanista','Atirador'], name:'Tambores da Tempestade', source:'Guardiões das Ilhas Flutuantes, Santuário das Nuvens e Raijin', ilvl:48, color:'#8fd3ff',
      pieces:{ weapon:['Baqueta do Trovão','bow_loaded_01',190], focus:['Tambor Celeste','sea_heart',190], seal:['Selo das Nuvens','lantern_seal',190], charm:['Pena de Tengu','magic_dust_01',190] },
      bonus2:{ text:'+10% ATK e +8% de energia', stats:{ atk:.10, nrg:.08 } }, bonus4:{ text:'Ao usar a ultimate: raio encadeado de 120% do ATK em até 4 inimigos.', stats:{}, hook:{ onUlt:{ eff:[{ k:'chain', m:1.2, n:4, fall:.8 }] } } } },
    { id:'blossom', classes:['Suporte','Vanguarda'], name:'Hanami Eterno', source:'Guardiões do Vale das Cerejeiras Eternas', ilvl:52, color:'#ffb3d6',
      pieces:{ weapon:['Leque de Pétalas','tome_01',330], focus:['Botão Eterno','crystal_01',330], seal:['Selo da Primavera','eclipse_seal',330], charm:['Omamori Florido','magic_dust_01',330] },
      bonus2:{ text:'+15% de cura e +8% HP', stats:{ healPow:.15, hp:.08 } }, bonus4:{ text:'A cada 6 ataques: cura a equipe em 6% do HP máximo.', stats:{}, hook:{ every:{ n:6, eff:[{ k:'heal', p:.06, to:'allies' }] } } } },
    { id:'ghost', classes:['Executor','Atirador'], name:'Véu Fantasma', source:'Guardiões da Cidade Fantasma', ilvl:35, color:'#b8a8ff',
      pieces:{ weapon:['Lâmina do Último Baile','katana_01',250], focus:['Espelho Assombrado','crystal_01',250], seal:['Broche da Noiva','eclipse_seal',250], charm:['Véu Rasgado','backpack_LVL_01',250] },
      bonus2:{ text:'+6% esquiva', stats:{ dodge:.06 } }, bonus4:{ text:'Ao esquivar: fica furtivo por 1,5s e revida com 120% do ATK.', stats:{}, hook:{ onDodge:{ eff:[{ k:'buff', s:'stealth', v:1, d:1.5, to:'self' }, { k:'dmg', m:1.2, to:'attacker' }] } } } },
    { id:'clock', classes:['Suporte','Arcanista'], name:'Engrenagens do Tempo', source:'Torre do Relógio (baú e Colosso do Relógio)', ilvl:39, color:'#c9a4ff',
      pieces:{ weapon:['Ponteiro Afiado','tide_blade',290], focus:['Mola Mestra','sea_heart',290], seal:['Mostrador de Bronze','eclipse_seal',290], charm:['Corda do Relógio','magic_dust_01',290] },
      bonus2:{ text:'+12% recarga de habilidade', stats:{ cdr:.12 } }, bonus4:{ text:'Usar a ultimate reduz em 3s a recarga das habilidades de toda a equipe.', stats:{}, hook:{ onUlt:{ eff:[{ k:'cdr', v:3, to:'allies' }] } } } },
    { id:'abyss', classes:null, name:'Herança do Abismo', source:'Fenda Abissal (andar 15+)', ilvl:20, color:'#ff5d8f',
      pieces:{ weapon:['Lâmina entre Mundos','katana_01',330], focus:['Olho da Fenda','crystal_01',330], seal:['Selo do Vazio','lantern_seal',330], charm:['Fragmento do Véu','magic_dust_01',330] },
      bonus2:{ text:'+8% ATK e +8% HP', stats:{ atk:.08, hp:.08 } }, bonus4:{ text:'+20% dano contra chefes e +15% dano elemental.', stats:{ boss:.20, elem:.15 } } }
  ];
  // Onde cada conjunto cai: [zona, fontes, nível mínimo do item].
  const setSources = {
    grove:[['hunt', ['guardian'], 6], ['boss', ['boss']]], temple:[['dungeon', ['floorBoss','chest']]], eclipse:[['boss', ['boss']]],
    tide:[['hunt_tide', ['guardian'], 19]], archive:[['dungeon_tide', ['floorBoss','chest']]], dragon:[['boss_tide', ['boss']]], lantern:[['boss_event', ['boss']]],
    swamp:[['hunt_swamp', ['guardian'], 6]], crypt:[['dungeon_crypt', ['floorBoss','chest']]], frost:[['hunt_frost', ['guardian'], 18]], forge:[['dungeon_forge', ['floorBoss','chest']]],
    sands:[['hunt_desert', ['guardian'], 32], ['boss_sand', ['boss']]], storm:[['hunt_sky', ['guardian'], 48], ['dungeon_sky', ['floorBoss','chest']], ['boss_sky', ['boss']]], blossom:[['hunt_sakura', ['guardian']]], ghost:[['hunt_ghost', ['guardian']]], clock:[['dungeon_clock', ['floorBoss','chest']]], abyss:[['rift', ['floorBoss','chest','guardian'], 20]]
  };

  // ---------------------------------------------------------------------------
  // ÚNICOS (Míticos), nome, atributos fixos e um efeito especial.
  // ---------------------------------------------------------------------------
  const Q = (id, slot, name, icon, hue, minIlvl, source, stats, effect, hook) => ({ id, slot, name, icon, hue, minIlvl, source, stats, effect, hook });
  const uniques = [
    Q('raijin_drum','charm','Tambor de Raijin','sea_heart',190,60,'Raijin',{ atk:.12, spd:.08 },'A cada 4 ataques: raio encadeado de 150% do ATK em até 5 inimigos.',{ every:{ n:4, eff:[{ k:'chain', m:1.5, n:5, fall:.8 }] } }),
    Q('fujin_bag','focus','Saco dos Ventos','magic_dust_01',130,54,'Santuário das Nuvens',{ dodge:.08, cdr:.08 },'Ao esquivar: +40 de energia.',{ onDodge:{ eff:[{ k:'nrg', v:40, to:'self' }] } }),
    Q('muramasa','weapon','Muramasa Sedenta','katana_01',0,6,'Qualquer inimigo (raro)',{ lifesteal:.10, atk:.10 },'Abates curam 10% do HP máximo.',{ onKill:{ eff:[{ k:'heal', p:.10, to:'self' }] } }),
    Q('kusanagi','weapon','Kusanagi, Cortadora de Ventos','tide_blade',100,10,'Guardiões e chefes',{ atk:.12 },'Ataques básicos também atingem todos os outros inimigos por 25% do dano.',{ cleave:.25 }),
    Q('star_bow','weapon','Arco das Mil Estrelas','bow_loaded_01',160,8,'Qualquer inimigo (raro)',{ spd:.12, crit:.05 },'25% de chance de disparar uma segunda flecha.',{ onAtk:{ ch:.25, eff:[{ k:'dmg', m:1.0, to:'tgt' }] } }),
    Q('lunar_edge','weapon','Lâmina Lunar de Shirogane','katana_01',220,13,'Shirogane',{ boss:.25, atk:.10 },'Ataques aplicam Sangramento (30% de chance).',{ onAtk:{ ch:.3, eff:[{ k:'st', s:'bleed', d:4, v:.3, ch:1, to:'tgt' }] } }),
    Q('hagoromo_staff','weapon','Cajado de Hagoromo','crystal_01',250,12,'Guardiões e chefes',{ skill:.18, nrg:.10 },'Ultimates recarregam 30 de energia de um aliado aleatório.',{ onUlt:{ eff:[{ k:'nrg', v:30, to:'atkAlly' }] } }),
    Q('celestial_chime','weapon','Sino Celestial','tome_01',160,14,'Chefes',{ healPow:.25, regen:.004 },'Ao usar a habilidade, purifica e protege o aliado mais ferido (escudo de 10% do HP).',{ onSkill:{ eff:[{ k:'cleanse', to:'lowAlly' }, { k:'shield', p:.10, to:'lowAlly', d:5 }] } }),
    Q('titan_gauntlets','weapon','Manoplas do Titã','tide_blade',100,16,'Guardiões e chefes',{ hp:.12, def:.10 },'Ao ser atingido: 20% de chance de ganhar escudo de 6% do HP e provocar por 2s.',{ onHurt:{ ch:.2, eff:[{ k:'shield', p:.06, to:'self', d:4 }, { k:'taunt', d:2 }] } }),
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
    Q('tide_pearl','charm','Pérola da Maré','magic_dust_01',160,18,'Costa das Marés',{ nrg:.15, startNrg:30 },'Começa cada onda carregado de energia.',null),
    Q('witch_broom','charm','Vassoura da Bruxa','backpack_LVL_01',100,6,'Pântano dos Vaga-lumes',{ healPow:.15 },'Habilidades dão 12 de energia ao aliado mais ferido.',{ onSkill:{ eff:[{ k:'nrg', v:12, to:'lowAlly' }] } }),
    Q('jade_crown','seal','Coroa do Rei Sem Túmulo','lantern_seal',130,10,'Cripta de Jade',{ def:.12 },'Abaixo de 30% de HP: silencia todos os inimigos por 3s (1× por onda).',{ low:{ th:.3, eff:[{ k:'st', s:'silence', d:3, ch:1, to:'all' }] } }),
    Q('frost_heart','focus','Coração da Rainha do Inverno','sea_heart',190,18,'Planalto Congelado',{ skill:.15 },'Habilidades têm 30% de chance de Congelar o alvo por 1s.',{ onSkill:{ eff:[{ k:'st', s:'freeze', d:1, ch:.3, to:'tgt' }] } }),
    Q('primordial_hammer','weapon','Martelo Primordial','tide_blade',20,23,'Forja Abissal',{ atk:.12, pierce:.10 },'Críticos atordoam o alvo por 0,8s.',{ onCrit:{ eff:[{ k:'st', s:'stun', d:.8, ch:1, to:'tgt' }] } }),
    Q('sphinx_eye','focus','Olho da Esfinge','crystal_01',45,33,'Areias do Tempo',{ crit:.08, skill:.12 },'Ao usar a ultimate, a equipe ganha +15% de crítico por 6s.',{ onUlt:{ eff:[{ k:'buff', s:'crit', v:.15, d:6, to:'allies' }] } }),
    Q('apep_fang','weapon','Presa de Apep','tide_blade',45,43,'Apep',{ atk:.18 },'35% de chance de envenenar; +20% de dano contra envenenados.',{ onAtk:{ ch:.35, eff:[{ k:'st', s:'poison', d:5, v:.3, ch:1, to:'tgt' }] }, vs:{ s:'poison', v:.2 } }),
    Q('bride_ring','charm','Anel da Noiva Espectral','magic_dust_01',250,36,'Cidade Fantasma',{ dodge:.08, hp:.08 },'Ao esquivar: cura 5% do HP máximo.',{ onDodge:{ eff:[{ k:'heal', p:.05, to:'self' }] } }),
    Q('midnight_bell','seal','Sino da Meia-Noite','eclipse_seal',290,40,'Torre do Relógio',{ def:.12 },'No início de cada onda, atordoa todos os inimigos por 1s.',{ start:{ eff:[{ k:'st', s:'stun', d:1, ch:1, to:'all' }] } }),
    Q('rift_shard','focus','Estilhaço Primordial','crystal_01',330,25,'Fenda Abissal',{ ultDmg:.30, nrg:.10 },'Ultimates também causam 80% do ATK em todos os inimigos.',{ onUlt:{ eff:[{ k:'dmg', m:.8, to:'all' }] } }),
    Q('void_omamori','charm','Omamori do Vazio','magic_dust_01',330,30,'Fenda Abissal',{ hp:.12, dr:.06 },'Aura: toda a equipe recebe +5% ATK.',{ aura:{ atk:.05 } })
  ];


  const uniqueWT = { muramasa:'sword', kusanagi:'sword', star_bow:'ranged', lunar_edge:'sword', dragon_fang:'heavy', primordial_hammer:'heavy', apep_fang:'sword', hagoromo_staff:'arcane', celestial_chime:'holy', titan_gauntlets:'heavy' };

  // ---------------------------------------------------------------------------
  // CARTAS, cada monstro tem a sua. Encaixe em slots de equipamento.
  // Cartas de chefe (MVP) são raríssimas e poderosas.
  // ---------------------------------------------------------------------------
  const cardStats = {
    fox:{ dodge:.04, crit:.03 }, golem:{ def:.08 }, spider_jade:{ dot:.12 }, oni:{ atk:.05 }, golem_elder:{ hp:.10, regen:.003 }, fox_nine:{ critDmg:.10, crit:.03 },
    oni_ash:{ atk:.05, pierce:.04 }, spider:{ pierce:.07 }, wisp_void:{ skill:.08 }, golem_obsidian:{ dr:.05 }, oni_crimson:{ atk:.09 }, fox_specter:{ dodge:.06 }, golem_lava:{ dot:.12, atk:.05 },
    wisp:{ nrg:.08 }, revenant:{ lifesteal:.035 }, fox_foam:{ spd:.05 }, spider_coral:{ thorns:.08 }, oni_tide:{ hp:.08 }, revenant_captain:{ atk:.06, def:.06 }, golem_coral:{ def:.12 },
    revenant_scribe:{ cdr:.08 }, wisp_arc:{ spd:.06, crit:.03 }, spider_ink:{ dot:.15 }, golem_crystal:{ healPow:.10 }, fox_storm:{ spd:.07 }, revenant_crimson:{ skill:.10 }, oni_storm:{ boss:.10, atk:.05 },
    wisp_ember:{ elem:.10 }, fox_gold:{ critDmg:.10, dodge:.04 }, mimic:{ atk:.06, hp:.06 },
    boss:{ atk:.15, boss:.15 }, boss_tide:{ hp:.20, dr:.10 }, boss_event:{ crit:.12, critDmg:.25 },
    revenant_king:{ skill:.10, def:.06 }, golem_forge:{ pierce:.10, atk:.06 }, golem_clock:{ cdr:.10, spd:.05 }, boss_sand:{ hp:.15, atk:.12, dot:.15 },
    revenant_jade:{ healPow:.12, hp:.05 }, oni_jade:{ atk:.07, crit:.03 }, golem_bog:{ hp:.10 }, revenant_bog:{ dot:.14, healPow:.05 },
    oni_frost:{ atk:.08, def:.04 }, revenant_frost:{ crit:.05, critDmg:.08 }, oni_lava:{ atk:.06, dot:.10 }, golem_iron:{ def:.10, dr:.04 },
    golem_sand:{ def:.08, hp:.08 }, revenant_mummy:{ lifesteal:.03, hp:.06 }, golem_ghost:{ thorns:.10, def:.05 }, revenant_ghost:{ critDmg:.12 },
    revenant_time:{ spd:.07, cdr:.04 }, revenant_chrono:{ nrg:.10, spd:.03 },
    wb_titan:{ def:.15, hp:.12 }, wb_frost_dragon:{ critDmg:.20, crit:.05 }, wb_storm_kitsune:{ spd:.10, nrg:.10 }, wb_blood_moon:{ lifesteal:.06, atk:.10 },
    rift_wyrm:{ boss:.10, elem:.08 },
    golem_sky:{ def:.09, hp:.07 }, revenant_sky:{ spd:.06, dodge:.04 }, golem_root:{ thorns:.10, regen:.003 }, revenant_geisha:{ healPow:.10, skill:.05 },
    revenant_monk:{ cdr:.06, nrg:.06 }, golem_bell:{ dr:.05, def:.06 }, golem_fujin:{ spd:.08, pierce:.06 }, boss_sky:{ atk:.14, crit:.06, elem:.10 }
  };
  // Monstros comuns sem carta própria recebem um bônus pelo papel e um toque do elemento.
  const roleCard = { 'Ágil':{ dodge:.035, crit:.02 }, Venenosa:{ dot:.12 }, Conjurador:{ skill:.07 }, Tanque:{ def:.07 }, Brutamontes:{ atk:.045 }, Lutador:{ lifesteal:.03 } };
  const elemCard = { Fogo:{ atk:.01 }, 'Água':{ hp:.02 }, Natureza:{ regen:.001 }, Terra:{ def:.02 }, Raio:{ spd:.015 }, Vento:{ dodge:.01 }, Gelo:{ critDmg:.03 }, Luz:{ healPow:.03 }, Sombra:{ pierce:.015 } };
  Object.entries(KT.Data.enemies).forEach(([id, e]) => {
    if (cardStats[id]) return;
    const out = { ...(roleCard[e.role] || { atk:.03 }) };
    Object.entries(elemCard[e.el] || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
    cardStats[id] = out;
  });
  // Cartas são raríssimas de propósito (dias para uma carta comum, meses para uma MVP) e fortes o
  // bastante para mudar uma build. Raridade da carta = tipo de criatura que a deixa cair.
  const cardTiers = {
    common:{ id:'common', label:'Comum', color:'#b9c2d6', mult:2.0, chance:1 / 60000 },
    rare:{ id:'rare', label:'Rara', color:'#4fb3ff', mult:2.4, chance:1 / 22000 },
    epic:{ id:'epic', label:'Épica', color:'#c07dff', mult:2.8, chance:1 / 6000 },
    mvp:{ id:'mvp', label:'MVP', color:'#ffb938', mult:3.0, chance:1 / 1500 }
  };
  // Efeitos especiais das cartas de chefe e chefes de andar.
  const cardHooks = {
    boss:{ text:'Ataques têm 5% de chance de causar 150% do ATK em todos os inimigos.', hook:{ onAtk:{ ch:.05, eff:[{ k:'dmg', m:1.5, to:'all' }] } } },
    boss_tide:{ text:'Ao cair abaixo de 30% de HP (1× por onda): escudo de 25% do HP.', hook:{ low:{ th:.3, eff:[{ k:'shield', p:.25, to:'self', d:6 }] } } },
    boss_event:{ text:'Críticos incendeiam o alvo (40% do ATK/s por 4s).', hook:{ onCrit:{ eff:[{ k:'st', s:'burn', d:4, v:.4, ch:1, to:'tgt' }] } } },
    boss_sand:{ text:'Ao abater: +12% ATK por 8s (acumula 3×).', hook:{ onKill:{ eff:[{ k:'buff', s:'atk', v:.12, d:8, to:'self', stack:3 }] } } },
    golem_lava:{ text:'Início de cada onda: +20 de energia.', hook:{ start:{ eff:[{ k:'nrg', v:20, to:'self' }] } } },
    oni_storm:{ text:'Habilidades têm 20% de chance de atordoar (1s).', hook:{ onSkill:{ eff:[{ k:'st', s:'stun', d:1, ch:.2, to:'tgt' }] } } },
    revenant_king:{ text:'Ao usar a ultimate: silencia o inimigo mais forte por 2s.', hook:{ onUlt:{ eff:[{ k:'st', s:'silence', d:2, ch:1, to:'high' }] } } },
    golem_forge:{ text:'A cada 5 ataques: golpe de 200% do ATK.', hook:{ every:{ n:5, eff:[{ k:'dmg', m:2.0, to:'tgt' }] } } },
    golem_clock:{ text:'Ao usar a habilidade: −1s na recarga dos aliados.', hook:{ onSkill:{ eff:[{ k:'cdr', v:1, to:'allies' }] } } },
    golem_fujin:{ text:'Ao usar a habilidade: +30% de velocidade de ataque por 5s.', hook:{ onSkill:{ eff:[{ k:'buff', s:'spd', v:.3, d:5, to:'self' }] } } },
    boss_sky:{ text:'Críticos disparam um raio encadeado de 90% do ATK em até 3 inimigos.', hook:{ onCrit:{ eff:[{ k:'chain', m:.9, n:3, fall:.8 }] } } },
    rift_wyrm:{ text:'Ultimates removem escudos e bônus dos inimigos.', hook:{ onUlt:{ eff:[{ k:'dispel', to:'all' }] } } },
    wb_titan:{ text:'Ao ser atingido (10%): escudo de 12% do HP.', hook:{ onHurt:{ ch:.1, eff:[{ k:'shield', p:.12, to:'self', d:5 }] } } },
    wb_frost_dragon:{ text:'Ataques têm 8% de chance de congelar (1,5s).', hook:{ onAtk:{ ch:.08, eff:[{ k:'st', s:'freeze', d:1.5, ch:1, to:'tgt' }] } } },
    wb_storm_kitsune:{ text:'Ao usar a ultimate: raio encadeado de 150% do ATK em até 4 inimigos.', hook:{ onUlt:{ eff:[{ k:'chain', m:1.5, n:4, fall:.8 }] } } },
    wb_blood_moon:{ text:'Ao abater: cura 6% do HP máximo.', hook:{ onKill:{ eff:[{ k:'heal', p:.06, to:'self' }] } } }
  };
  const cards = Object.entries(cardStats).map(([enemy, stats]) => {
    const e = KT.Data.enemies[enemy];
    const tier = e.boss ? cardTiers.mvp : e.miniboss ? cardTiers.epic : (e.elite || e.treasure) ? cardTiers.rare : cardTiers.common;
    const scaled = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Math.round(v * tier.mult * 1000) / 1000]));
    const special = cardHooks[enemy];
    return { id:`card_${enemy}`, enemy, name:`Carta ${e.name.split(',')[0]}`, stats:scaled, tier:tier.id, tierLabel:tier.label, color:tier.color, mvp:tier.id === 'mvp',
      sprite:e.sprite, el:e.el, chance:tier.chance, effect:special?.text || null, hook:special?.hook || null };
  });
  const cardById = id => cards.find(c => c.id === id);
  const socketsFor = rarity => ({ common:0, rare:U.random() < .35 ? 1 : 0, epic:1, legendary:U.random() < .5 ? 2 : 1, mythic:2, set:1 }[rarity] || 0);

  const rarityById = id => D.rarities.find(r => r.id === id) || D.rarities[0];

  function rollAffix(ilvl, exclude = [], weights = null) {
    const pool = affixes.filter(a => !exclude.includes(a.id) && (a.minIlvl || 0) <= ilvl);
    const a = weights ? U.weighted(pool, x => weights[x.id] || 1) : U.pick(pool); const roll = U.random();
    const scale = 1 + Math.min(ilvl, 40) / 40;
    let v = (a.min + (a.max - a.min) * roll) * scale;
    v = a.pct ? Math.round(v * 1000) / 1000 : Math.round(v);
    return { id:a.id, stat:a.stat, v, roll };
  }

  function makeItem(opts) { const it = makeItemRaw(opts); if (it) it.pv = 2; return it; }
  function makeItemRaw(opts) {
    const ilvl = Math.max(1, Math.round(opts.ilvl || 1));
    let rarity = opts.rarity || 'common';
    if (opts.unique) {
      const q = uniques.find(x => x.id === opts.unique);
      return { uid:U.uid('it'), kind:'unique', uniqueId:q.id, slot:q.slot, ...(uniqueWT[q.id] ? { wt:uniqueWT[q.id] } : {}), name:q.name, icon:q.icon, hue:q.hue, ilvl:Math.max(ilvl, q.minIlvl), rarity:'mythic', plus:0,
        primary:primaryValue(slots[q.slot].primary, Math.max(ilvl, q.minIlvl)) * rarityById('mythic').mult, affixes:[rollAffix(ilvl), rollAffix(ilvl)], cards:Array(socketsFor('mythic')).fill(null), locked:false, isNew:true };
    }
    if (opts.set) {
      const s = sets.find(x => x.id === opts.set); const slot = opts.slot || U.pick(Object.keys(slots)); const [name, icon, hue] = s.pieces[slot];
      const il = Math.max(ilvl, s.ilvl);
      const affs = []; for (let i = 0; i < 2; i++) { const a = rollAffix(il, affs.map(x => x.id)); affs.push(a); }
      return { uid:U.uid('it'), kind:'set', setId:s.id, slot, name, icon, hue, ilvl:il, rarity:'set', plus:0, primary:primaryValue(slots[slot].primary, il) * rarityById('set').mult, affixes:affs, cards:Array(socketsFor('set')).fill(null), locked:false, isNew:true };
    }
    let slot = opts.slot || null, wt = opts.wt || null;
    if (!slot && !opts.base) slot = U.pick(Object.keys(slots));
    if (slot && slot !== 'charm' && !wt && !opts.base) {
      const kinds = Object.keys(itemTypes).filter(k => itemTypes[k].slot === slot);
      const pref = (opts.prefer || []).filter(k => kinds.includes(k));
      wt = pref.length && U.random() < .65 ? U.pick(pref) : U.pick(kinds);
    }
    const candidates = bases.filter(b => b.minIlvl <= ilvl && (!slot || b.slot === slot) && (!wt || b.wt === wt));
    const top = Math.max(...candidates.map(b => b.minIlvl));
    const base = opts.base ? bases.find(b => b.id === opts.base) : U.pick(candidates.filter(b => b.minIlvl >= top - 8));
    const r = rarityById(rarity);
    const weights = base.wt ? itemTypes[base.wt].affixW : null;
    const affs = []; for (let i = 0; i < r.affixes; i++) { const a = rollAffix(ilvl, affs.map(x => x.id), weights); affs.push(a); }
    return { uid:U.uid('it'), kind:'base', baseId:base.id, slot:base.slot, name:base.name, icon:base.icon, hue:base.hue, ilvl, rarity, plus:0, ...(base.wt ? { wt:base.wt } : {}),
      primary:primaryValue(slots[base.slot].primary, ilvl) * r.mult * U.rand(.92, 1.08), affixes:affs, cards:Array(socketsFor(rarity)).fill(null), locked:false, isNew:true };
  }

  // Atributos finais de um item (primário + afixos + fixos do único), com aprimoramento.
  // REFINO: o atributo principal cresce muito a cada nível (×2,18 no +10 e ×4,25 no +15).
  // Acima de +10 o ganho por nível é constante (+14%): antes o +15 multiplicava o atributo principal por 4,25.
  const REFINE_BONUS = [0, .06, .12, .18, .24, .34, .46, .60, .76, .95, 1.18, 1.32, 1.46, 1.60, 1.75, 1.90];
  const REFINE_AFFIX = [0, .03, .06, .09, .12, .16, .20, .24, .28, .33, .38, .46, .54, .63, .72, .82];
  // Bônus extra por marco de refino, no atributo principal do espaço.
  const refineMilestone = plus => plus >= 15 ? .15 : plus >= 10 ? .08 : plus >= 7 ? .04 : 0;
  const implicitValue = (item, v) => v * (1 + Math.min(item.ilvl, 50) / 50) * (1 + REFINE_AFFIX[Math.min(15, item.plus || 0)]);
  function itemStats(item) {
    const out = {}; const add = (k, v) => { out[k] = (out[k] || 0) + v; };
    const plus = Math.min(15, item.plus || 0), up = 1 + REFINE_BONUS[plus], upA = 1 + REFINE_AFFIX[plus];
    const p = slots[item.slot].primary;
    if (p === 'skill') add('skill', item.primary * up); else add(`${p}Flat`, item.primary * up);
    const ms = refineMilestone(plus); if (ms) add(p === 'skill' ? 'skill' : p, ms);
    const wt = typeOf(item);
    if (wt) Object.entries(itemTypes[wt].implicit).forEach(([k, v]) => add(k, implicitValue(item, v)));
    (item.affixes || []).forEach(a => add(a.stat, a.v * upA));
    if (item.kind === 'unique') { const q = uniques.find(x => x.id === item.uniqueId); Object.entries(q?.stats || {}).forEach(([k, v]) => add(k, v)); }
    (item.cards || []).forEach(cid => { const c = cid && cardById(cid); if (c) Object.entries(c.stats).forEach(([k, v]) => add(k, v)); });
    return out;
  }

  const RAR_ORDER = ['common', 'rare', 'epic', 'legendary'];
  function rollRarity(weights) {
    let total = weights.reduce((a, b) => a + b, 0), r = U.random() * total;
    for (let i = 0; i < RAR_ORDER.length; i++) { r -= weights[i]; if (r <= 0) return RAR_ORDER[i]; }
    return 'common';
  }
  // Teto de raridade por região: mapas iniciais nunca dão itens realmente fortes.
  function rarityCap(zone, source, ilvl) {
    if (!zone) return 'epic';
    if (zone.rarityCap) return zone.rarityCap;
    if (zone.kind === 'boss') return 'legendary';
    if (zone.kind === 'rift') return ilvl >= 22 ? 'legendary' : 'epic';
    if ((zone.chapter || 1) <= 1) return source === 'floorBoss' ? 'epic' : 'epic';
    return 'legendary';
  }
  // Tabela de drops, POR ITEM que cai (a chance de cair algum item fica no motor).
  // Resultado por abate de monstro comum (3% de item): raro ~0,42%, épico ~0,003%, lendário ~0,0001% (só capítulo II+).
  const DROP_TABLES = { normal:[86, 13.9, .1, .004], elite:[74, 25.5, .5, .02], guardian:[72, 27.5, .5, .02], floorBoss:[0, 94.7, 5, .3], boss:[0, 70.5, 27, 2.5], chest:[50, 47.9, 2, .1] };
  function rollDrop(source, zone, ilvl, luck = 0, prefer = null) {
    const w = (DROP_TABLES[source] || DROP_TABLES.normal).slice();
    luck = Math.min(luck, 3);
    if (luck) { w[1] *= 1 + luck * .3; w[2] *= 1 + luck * .5; w[3] *= 1 + luck * .6; }
    const cap = RAR_ORDER.indexOf(rarityCap(zone, source, ilvl));
    for (let i = cap + 1; i < w.length; i++) w[i] = 0;
    const rarity = rollRarity(w);
    // Míticos e peças de conjunto: troféus. Valem muito no Mercado de Jogadores.
    const uniqueChance = { normal:.000005, elite:.00004, guardian:.0001, floorBoss:.0008, boss:.006, chest:.0003 }[source] || 0;
    // Míticos só onde a fonte já permite Lendário: nada de troféus nos mapas iniciais (só no chefe do Capítulo I).
    if (cap >= 3 && U.random() < uniqueChance * (1 + luck * .3)) {
      const pool = uniques.filter(q => q.minIlvl <= ilvl + 4 && (sourceMatches(q, zone, source)));
      if (pool.length) return makeItem({ unique:U.pick(pool).id, ilvl });
    }
    const set = setForSource(zone, source, ilvl);
    const setChance = { guardian:.003, floorBoss:.025, boss:.08, chest:.008 }[source] || 0;
    if (set && U.random() < setChance * (1 + luck * .3)) return makeItem({ set:set.id, ilvl });
    return makeItem({ ilvl, rarity, prefer });
  }
  const SOURCE_ZONES = { 'Shirogane':['boss'], 'Mizuchi':['boss_tide'], 'Kitsune':['boss_event'], 'Festival':['boss_event'], 'Templo':['dungeon'], 'Arquivo':['dungeon_tide'], 'Costa':['hunt_tide'],
    'Pântano':['hunt_swamp'], 'Cripta':['dungeon_crypt'], 'Planalto':['hunt_frost'], 'Forja':['dungeon_forge'], 'Areias':['hunt_desert'], 'Apep':['boss_sand'], 'Cidade Fantasma':['hunt_ghost'], 'Torre':['dungeon_clock'], 'Fenda':['rift'], 'Ilhas':['hunt_sky'], 'Cerejeiras':['hunt_sakura'], 'Santuário das Nuvens':['dungeon_sky'], 'Raijin':['boss_sky'] };
  function sourceMatches(q, zone, source) {
    const s = q.source;
    if (s.includes('Qualquer')) return true;
    if (s.includes('Guardiões') && ['guardian','floorBoss','boss'].includes(source)) return true;
    if (s.includes('Chefes') && source === 'boss') return true;
    if (s.includes('Dungeons') && zone?.kind === 'dungeon') return true;
    if (s.includes('Onis') && ['guardian','elite','normal'].includes(source)) return U.random() < .3;
    return Object.entries(SOURCE_ZONES).some(([key, zones]) => s.includes(key) && zones.includes(zone?.id));
  }
  function setForSource(zone, source, ilvl) {
    if (!zone) return null;
    const opts = sets.filter(st => (setSources[st.id] || []).some(([z, src, min]) => z === zone.id && src.includes(source) && ilvl >= (min || 0)));
    return opts.length ? U.pick(opts) : null;
  }

  // Desmontar, aprimorar e encantar.
  const salvageTable = { common:{ ore:.5, dust:.5 }, rare:{ ore:1.5, dust:1.5 }, epic:{ ore:4, dust:5 }, legendary:{ ore:9, dust:12 }, mythic:{ ore:16, dust:26 }, set:{ ore:8, dust:14 } };
  function salvageValue(item) { const t = salvageTable[item.rarity] || salvageTable.common; const m = 1 + item.ilvl / 25 + (item.plus || 0) * .25; return { ore:Math.round(t.ore * m), dust:Math.round(t.dust * m), gold:Math.round(6 * item.ilvl * (1 + (item.plus || 0) * .5)) }; }
  // MATERIAIS DE REFINO. Tamahagane é o comum; os outros são raros, negociáveis e muito valiosos.
  const materials = {
    common:{ id:'common', key:'ore', name:'Tamahagane', short:'Tamahagane', color:'#b9c2d6', icon:'crystal_01', hue:290, maxTarget:10, tradeable:false,
      text:'Refina até +10. De +5 a +8 a falha faz o item voltar 1 nível; em +9 e +10 a falha QUEBRA o item.' },
    rare:{ id:'rare', key:'star', name:'Aço Estelar', short:'Aço Estelar', color:'#4fb3ff', icon:'crystal_01', hue:190, maxTarget:10, tradeable:true,
      text:'Refina até +10. Até +8 a falha não tira nível; em +9 e +10 a falha QUEBRA o item.' },
    epic:{ id:'epic', key:'ori', name:'Oricalco', short:'Oricalco', color:'#c07dff', icon:'crystal_01', hue:250, maxTarget:15, tradeable:true,
      text:'Refina até +15. Até +10 a falha não tira nível; de +11 a +15 a falha faz o item voltar 1 nível.' },
    legendary:{ id:'legendary', key:'adam', name:'Adamantina', short:'Adamantina', color:'#ffb938', icon:'crystal_01', hue:45, maxTarget:15, tradeable:true,
      text:'Refina até +15 sem nunca perder nível nem quebrar. Só a chance de sucesso limita.' }
  };
  const REFINE_CHANCE = [1, 1, 1, 1, 1, .85, .70, .55, .40, .25, .15, .12, .09, .06, .04, .02];
  function refineRule(matId, target) {
    const m = materials[matId]; if (!m) return null;
    if (target > m.maxTarget) return { allowed:false, reason:`${m.name} só refina até +${m.maxTarget}.` };
    let onFail = 'none';
    if (matId === 'common') onFail = target <= 4 ? 'none' : target <= 8 ? 'regress' : 'break';
    if (matId === 'rare') onFail = target <= 8 ? 'none' : 'break';
    if (matId === 'epic') onFail = target <= 10 ? 'none' : 'regress';
    return { allowed:true, onFail };
  }
  function upgradeCost(item, forgeLevel = 1, matId = 'common') {
    const n = (item.plus || 0) + 1, rm = { common:1, rare:1.3, epic:1.7, legendary:2.2, mythic:2.8, set:2.4 }[item.rarity] || 1;
    const disc = 1 - Math.min(.4, (forgeLevel - 1) * .04), rule = refineRule(matId, n) || { allowed:false, reason:'Material inválido.' };
    const qty = matId === 'common' ? Math.round((3 + n * n * 1.1) * rm * disc) : matId === 'rare' ? 1 + Math.floor(n / 4) : matId === 'epic' ? 1 + Math.max(0, Math.floor((n - 6) / 3)) : 1 + Math.max(0, Math.floor((n - 9) / 3));
    return { gold:Math.round(120 * Math.pow(item.ilvl, .9) * Math.pow(n, 1.8) * rm * disc), mat:matId, key:materials[matId]?.key, qty, ore:matId === 'common' ? qty : 0,
      chance:REFINE_CHANCE[Math.min(15, n)] ?? 0, target:n, ...rule };
  }
  function enchantCost(item, workshopLevel = 1) { const disc = 1 - Math.min(.4, (workshopLevel - 1) * .05); return { dust:Math.round((12 + item.ilvl * 2.2) * disc), gold:Math.round(60 * item.ilvl * disc) }; }
  const maxPlus = forgeLevel => Math.min(15, 4 + forgeLevel * 2);
  const MAX_BAG = 400, OVERFLOW_CAP = 300;
  // Material negociável: de refino (Aço Estelar, Oricalco, Adamantina) ou de profissão (coleta).
  const matInfo = id => {
    const m = materials[id]; if (m) return m.tradeable ? { id, name:m.name, color:m.color, text:m.text, have:s => s.mats?.[m.key] || 0, add:(s, n) => { s.mats[m.key] = (s.mats[m.key] || 0) + n; } } : null;
    const p = KT.Data.PROF_MATS.find(x => x.id === id); if (!p) return null;
    return { id, name:p.name, color:p.color, text:`Material de ${KT.Data.PROF.gather[p.prof].name}${p.rare ? ' (raro)' : `, nível ${p.tier}`}.`, have:s => s.prof?.mats?.[id] || 0, add:(s, n) => { s.prof.mats[id] = (s.prof.mats[id] || 0) + n; } };
  };

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

  KT.Items = { normalizeItemPrimary, ilvlGrowth, matInfo, implicitValue, setSources, itemTypes, weaponTypes, heroWeaponExtra, typeOf, weaponTypeOf, allowedTypes, allowedWeaponTypes, canEquip, equipCheck, reqFor,
    REFINE_BONUS, REFINE_CHANCE, materials, refineRule, cardTiers, rarityCap, MAX_BAG, OVERFLOW_CAP, DROP_TABLES, slots, bases, affixes, sets, uniques, cards, cardById, makeItem, itemStats, rollDrop, rollAffix, salvageValue, upgradeCost, enchantCost, maxPlus, itemScore, primaryValue };
})();
