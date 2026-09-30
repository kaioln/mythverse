(() => {
  const KT = globalThis.KT;

  // Nível da conta, não do herói: introduz um sistema por vez, sem custo de desbloqueio.
  const services = {
    guild:{ level:2, name:'Contratos da Ordem', text:'Conheça as necessidades dos moradores e escolha suas caçadas.' },
    forge:{ level:3, name:'Forja de Ren', text:'Aprimore o equipamento que encontrou na jornada.' },
    dojo:{ level:4, name:'Dojo do Eco', text:'Treine a equipe sem substituir suas escolhas de build.' },
    workshop:{ level:5, name:'Oficina de Aoi', text:'Prepare consumíveis e retrabalhe afixos.' },
    house:{ level:6, name:'Casa do Time', text:'Exponha cartas e registre as descobertas da equipe.' },
    shrine:{ level:7, name:'Santuário da Lua', text:'Use fragmentos para elevar a qualidade dos heróis.' },
    expeditions:{ level:8, name:'Expedições', text:'Envie os heróis da reserva em missões.' },
    prof:{ level:10, name:'Profissões', text:'Especialize-se em coleta e criação de equipamentos.' },
    market:{ level:12, name:'Mercado do Porto', text:'Acompanhe as ofertas rotativas dos comerciantes.' },
    trade:{ level:15, name:'Mercado de Jogadores', text:'Negocie espólios; confira preço, quantidade e taxas.' },
    clans:{ level:18, name:'Guildas de jogadores', text:'Encontre aliados e participe de uma comunidade.' },
    arena:{ level:20, name:'Coliseu Carmesim', text:'Teste suas decisões contra as defesas de outros jogadores.' }
  };
  const serviceFor = (panel, tab) => panel === 'city' ? (services[tab] ? tab : null)
    : panel === 'shop' ? ({ market:'market', p2p:'trade', gems:'trade' }[tab] || null)
    : panel === 'adventure' && tab === 'expeditions' ? 'expeditions'
    : panel === 'quests' && tab === 'contracts' ? 'guild'
    : panel === 'guild' ? 'clans' : panel === 'arena' ? 'arena'
    : panel === 'bank' && tab === 'wallet' ? 'trade' : null;
  const serviceActions = { train:'dojo', craft:'workshop', enchantItem:'workshop', awaken:'shrine',
    upgradeItem:'forge', displayCard:'house', startExpedition:'expeditions', craftProf:'prof',
    buyMarket:'market', marketList:'trade', marketBuyGold:'trade' };

  // ---------------------------------------------------------------------------
  // ATRIBUTOS DO HERÓI (estilo clássico), 3 pontos por nível.
  // ---------------------------------------------------------------------------
  const attributes = {
    str: { name:'Força', short:'FOR', color:'#ff7a6b', text:'+1,5% ATK por ponto.', per:{ atk:.015 } },
    agi: { name:'Agilidade', short:'AGI', color:'#9ce9cc', text:'+1% velocidade de ataque e +0,3% esquiva por ponto.', per:{ spd:.01, dodge:.003 } },
    vit: { name:'Vitalidade', short:'VIT', color:'#5fe39a', text:'+2,5% HP e +0,8% DEF por ponto.', per:{ hp:.025, def:.008 } },
    int: { name:'Inteligência', short:'INT', color:'#c9a4ff', text:'+1,5% dano de habilidade e +1% cura/escudo por ponto.', per:{ skill:.015, healPow:.01 } },
    dex: { name:'Destreza', short:'DES', color:'#ffd76a', text:'+0,4% crítico e +0,5% perfuração de DEF por ponto.', per:{ crit:.004, pierce:.005 } },
    luk: { name:'Sorte', short:'SOR', color:'#ff9ec7', text:'+1,5% dano crítico e +0,6% ganho de energia por ponto.', per:{ critDmg:.015, nrg:.006 } }
  };
  const ATTR_PER_LEVEL = 3;
  const classAttrHint = {
    Vanguarda:'VIT e FOR, aguentar a linha de frente e revidar.',
    Executor:'FOR, DES e SOR, críticos devastadores.',
    Arcanista:'INT e SOR, habilidades e ultimates frequentes.',
    Atirador:'AGI e DES, muitos ataques e críticos.',
    Suporte:'INT e VIT, curas fortes e sobrevivência.'
  };

  // ---------------------------------------------------------------------------
  // ÍCONES (traços SVG 24×24) usados nas árvores de talento.
  // ---------------------------------------------------------------------------
  const icons = {
    sword:'M14.5 3H21v6.5L9 21.5 2.5 15zM7 13l4 4M4 20l2.5-2.5',
    shield:'M12 2 20 5v6c0 5.2-3.4 9.3-8 11-4.6-1.7-8-5.8-8-11V5z',
    heart:'M12 20s-7.5-4.6-9.2-9.3C1.6 7.1 4.4 4 7.6 4.9 9.5 5.4 11 7 12 8.4 13 7 14.5 5.4 16.4 4.9 19.6 4 22.4 7.1 21.2 10.7 19.5 15.4 12 20 12 20z',
    bolt:'M13 2 4 14h7l-1 8 9-12h-7z',
    target:'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 .01 0M12 11a1 1 0 1 0 .01 0',
    skull:'M12 3c4.4 0 8 3.1 8 7.3 0 2.4-1.2 4.2-3 5.3V19H7v-3.4c-1.8-1.1-3-2.9-3-5.3C4 6.1 7.6 3 12 3zM9 11a1.5 1.5 0 1 0 .01 0M15 11a1.5 1.5 0 1 0 .01 0M10 19v2M14 19v2',
    fang:'M4 4h16l-2 6-3-2-3 12-3-12-3 2z',
    wind:'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
    drop:'M12 2s7 7.6 7 12.2A7 7 0 0 1 5 14.2C5 9.6 12 2 12 2z',
    flame:'M12 22c-4 0-7-2.8-7-6.8 0-4.4 4.2-6.5 4.2-11.2 2.6 1.5 4.3 4 4.4 6.9 1-1 1.6-2.2 1.7-3.6C18 9.2 19 12 19 15.2 19 19.2 16 22 12 22z',
    crown:'M3 18h18l-1.5-11-4.5 4-3-6-3 6-4.5-4zM3 21h18',
    spear:'M21 3l-6 1.5L4 15.5 8.5 20 19.5 9zM4 20l2-2M15 4.5l4.5 4.5',
    orb:'M12 3a9 9 0 1 0 .01 0M8.5 9.5a3.5 3.5 0 0 1 3.5-3',
    battery:'M5 7h13v10H5zM18 10h2v4h-2M8 10v4M11 10v4',
    hourglass:'M6 2h12M6 22h12M7 2c0 5 5 6 5 10S7 17 7 22M17 2c0 5-5 6-5 10s5 5 5 10',
    star:'M12 2.5 14.9 8.6l6.6.8-4.9 4.5 1.3 6.6L12 17.2 6.1 20.5l1.3-6.6-4.9-4.5 6.6-.8z',
    cross:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    wall:'M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4',
    thorns:'M12 2v20M5 7l7 5 7-5M5 17l7-5 7 5M2 12h4M18 12h4',
    eye:'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 .01 0',
    fist:'M7 10V6a2 2 0 0 1 4 0v4M11 9V5a2 2 0 0 1 4 0v5M15 9a2 2 0 0 1 4 0v5c0 4-3 7-7 7s-7-3-7-7v-3a2 2 0 0 1 4 0',
    wings:'M12 8C9 4 4 3 2 4c1 4 3 7 7 8-2 1-4 1-6 0 2 3 6 4 9 2M12 8c3-4 8-5 10-4-1 4-3 7-7 8 2 1 4 1 6 0-2 3-6 4-9 2M12 8v12',
    moon:'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
    sparkle:'M12 2c.8 5 2 6.2 7 7-5 .8-6.2 2-7 7-.8-5-2-6.2-7-7 5-.8 6.2-2 7-7zM19 15c.4 2.2 1 2.8 3 3.2-2 .4-2.6 1-3 3.2-.4-2.2-1-2.8-3-3.2 2-.4 2.6-1 3-3.2z',
    arrows:'M3 21 21 3M15 3h6v6M3 13l4 4M7 9l4 4',
    book:'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z',
    gem:'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3 7 9l5 12 5-12-2-6'
  };

  // ---------------------------------------------------------------------------
  // ÁRVORE DE CLASSES
  //   Classe base → nível 30: escolhe 1 de 2 caminhos (classe avançada) → nível 60: Transcendência.
  //   Cada caminho tem bônus próprios e uma Pedra-angular exclusiva no Círculo IV da árvore de talentos.
  //   Saves antigos com classe avançada seguem no caminho A (o mesmo nome de antes).
  // ---------------------------------------------------------------------------
  const jobs = {
    Vanguarda:{ a:{ name:'Bastião Celeste', role:'Defesa absoluta', text:'+8% HP e +8% DEF. Segura a linha e protege a equipe.', stats:{ hp:.08, def:.08 }, trans:'Muralha dos Céus' },
                b:{ name:'Berserker Rubro', role:'Tanque ofensivo', text:'+10% ATK e +3% roubo de vida. Aguenta batendo.', stats:{ atk:.10, lifesteal:.03 }, trans:'Rei da Carnificina' } },
    Executor:{ a:{ name:'Lâmina do Eclipse', role:'Críticos devastadores', text:'+3% crítico e +12% dano crítico.', stats:{ crit:.03, critDmg:.12 }, trans:'Senhor do Eclipse' },
               b:{ name:'Ronin das Sombras', role:'Esquiva e velocidade', text:'+4% esquiva e +5% velocidade de ataque.', stats:{ dodge:.04, spd:.05 }, trans:'Espectro Sem Nome' } },
    Arcanista:{ a:{ name:'Oráculo Astral', role:'Habilidades e energia', text:'+8% dano de habilidade e +6% energia.', stats:{ skill:.08, nrg:.06 }, trans:'Arauto das Estrelas' },
                b:{ name:'Feiticeiro da Ruína', role:'Queimaduras e elementos', text:'+15% dano contínuo e +6% dano elemental.', stats:{ dot:.15, elem:.06 }, trans:'Soberano da Ruína' } },
    Atirador:{ a:{ name:'Olho do Vendaval', role:'Cadência de tiro', text:'+6% velocidade de ataque e +3% crítico.', stats:{ spd:.06, crit:.03 }, trans:'Tempestade Viva' },
               b:{ name:'Caçador de Relíquias', role:'Caça a chefes', text:'+10% dano em chefes e +5% perfuração.', stats:{ boss:.10, pierce:.05 }, trans:'Arqueiro do Fim' } },
    Suporte:{ a:{ name:'Tecelão de Almas', role:'Cura e escudos', text:'+10% cura/escudos e +5% HP.', stats:{ healPow:.10, hp:.05 }, trans:'Guardião das Almas' },
              b:{ name:'Sacerdote da Aurora', role:'Apoio e recarga', text:'+6% dano de habilidade e +5% recarga.', stats:{ skill:.06, cdr:.05 }, trans:'Profeta da Aurora' } }
  };
  // Compatibilidade: PR.jobs[cls].name continua sendo o caminho A.
  Object.values(jobs).forEach(j => { j.name = j.a.name; j.text = j.a.text; });
  const JOB_LEVEL = 30;
  const JOB_CLASS_LEVEL = 10;
  const JOB2_LEVEL = 60;
  const JOB2_CLASS_LEVEL = 30;
  const CLASS_LEVEL_CAP = 50;
  const jobCost = { gold:60000, crystal:150 };
  const job2Cost = { gold:900000, crystal:400 };   // Transcendência: um dos grandes destinos do ouro no fim do jogo
  const TIER_REQ = [0, 8, 20, 40];   // pontos gastos na árvore para liberar cada círculo
  const branchOf = rec => (rec?.branch === 'b' ? 'b' : 'a');
  // Nome da classe atual do herói (base, avançada ou transcendida).
  const jobTitle = (cls, rec) => { const j = jobs[cls]?.[branchOf(rec)]; if (!j || !rec?.job) return cls; return rec.job >= 2 ? j.trans : j.name; };

  // ---------------------------------------------------------------------------
  // ÁRVORES DE TALENTO POR CLASSE, cada herói tem a sua própria distribuição.
  // 1 ponto por nível do herói (+5 ao mudar de classe).
  // stats: por rank · hook(rank): efeito especial · sig: nó exclusivo do herói.
  // ---------------------------------------------------------------------------
  const T = (id, tier, x, name, icon, max, stats, desc, o = {}) => ({ id, tier, x, name, icon, max, stats, desc, ...o });
  const common = (cls) => [
    T('ess', 0, 850, 'Essência', 'star', 3, {}, 'Traço único do herói.', { sig:'ess', req:[] }),
    T('sig_skill', 1, 850, 'Maestria', 'book', 5, { skillMastery:.08, cdr:.03 }, 'Aprimora a habilidade exclusiva deste herói.', { sig:'skill', req:['ess'] }),
    T('sig_ult', 2, 850, 'Ápice', 'sparkle', 5, { ultDmg:.08, startNrg:4 }, 'Aprimora a ultimate exclusiva deste herói.', { sig:'ult', req:['sig_skill'] })
  ];
  const classTrees = {
    Vanguarda: [
      T('v1', 0, 110, 'Pele de Ferro', 'shield', 5, { def:.03 }, 'Endurece o corpo contra golpes.'),
      T('v2', 0, 290, 'Vigor', 'heart', 5, { hp:.03 }, 'Mais vida para segurar a linha.'),
      T('v3', 0, 470, 'Postura Firme', 'wall', 5, { dr:.012 }, 'Reduz todo o dano recebido.'),
      T('v4', 0, 650, 'Punho de Aço', 'fist', 5, { atk:.02 }, 'Golpes mais pesados.'),
      T('v5', 1, 110, 'Muralha Viva', 'shield', 5, {}, 'Começa cada onda com escudo.', { req:['v1'], hook:r => ({ start:{ eff:[{ k:'shield', p:.03 * r, to:'self', d:10 }] } }), hookText:r => `Escudo de ${3 * r}% do HP no início de cada onda.` }),
      T('v6', 1, 290, 'Sangue Resistente', 'drop', 5, { regen:.002 }, 'Regenera HP continuamente.', { req:['v2'] }),
      T('v7', 1, 470, 'Retaliação', 'thorns', 5, { thorns:.04 }, 'Devolve parte do dano recebido.', { req:['v3'] }),
      T('v8', 1, 650, 'Contra-ataque', 'sword', 5, {}, 'Chance de revidar ao ser atingido.', { req:['v4'], hook:r => ({ onHurt:{ ch:.04 * r, eff:[{ k:'dmg', m:1.0, to:'attacker' }] } }), hookText:r => `${4 * r}% de chance de contra-atacar (100% ATK).` }),
      T('vN', 1, 470, 'Bastião', 'crown', 1, { def:.10, hp:.10 }, 'NOTÁVEL: fortaleza viva.', { req:['v6|v7'], notable:true, y:1.5 }),
      T('v9', 2, 110, 'Escudo Sagrado', 'cross', 5, { healPow:.06 }, 'Escudos e curas mais fortes.', { req:['v5'] }),
      T('v10', 2, 290, 'Fortaleza', 'wall', 5, { dr:.02 }, 'Reduz ainda mais o dano.', { req:['vN'] }),
      T('v11', 2, 650, 'Juízo', 'sword', 5, { atk:.04 }, 'O Bastião Celeste também pune.', { req:['v8'] }),
      T('vK', 2, 470, 'Égide Imortal', 'wings', 1, { dr:.10, atk:-.15 }, 'PEDRA-CHAVE: renasce uma vez por batalha com 30% do HP. −15% ATK.', { req:['vN'], keystone:true, hook:() => ({ phoenix:.30 }) })
    ],
    Executor: [
      T('e1', 0, 110, 'Olho Treinado', 'target', 5, { crit:.012 }, 'Mais golpes críticos.'),
      T('e2', 0, 290, 'Lâmina Cruel', 'skull', 5, { critDmg:.05 }, 'Críticos mais letais.'),
      T('e3', 0, 470, 'Fio Afiado', 'sword', 5, { atk:.02 }, 'Mais ATK.'),
      T('e4', 0, 650, 'Passos Rápidos', 'wind', 5, { spd:.015 }, 'Ataca mais rápido.'),
      T('e5', 1, 110, 'Sede de Sangue', 'fang', 5, { lifesteal:.01 }, 'Rouba vida a cada golpe.', { req:['e1'] }),
      T('e6', 1, 290, 'Golpe de Misericórdia', 'skull', 5, {}, 'Abates restauram vida.', { req:['e2'], hook:r => ({ onKill:{ eff:[{ k:'heal', p:.025 * r, to:'self' }] } }), hookText:r => `Ao abater: cura ${2.5 * r}% do HP.` }),
      T('e7', 1, 470, 'Perfurar', 'spear', 5, { pierce:.03 }, 'Ignora parte da DEF.', { req:['e3'] }),
      T('e8', 1, 650, 'Caçador de Gigantes', 'crown', 5, { boss:.04 }, 'Mais dano contra chefes.', { req:['e4'] }),
      T('eN', 1, 470, 'Assassino', 'target', 1, { crit:.05, critDmg:.20 }, 'NOTÁVEL: mestre dos pontos fracos.', { req:['e6|e7'], notable:true, y:1.5 }),
      T('e9', 2, 110, 'Sombra Veloz', 'wind', 5, { dodge:.015 }, 'Esquiva de golpes.', { req:['e5'] }),
      T('e10', 2, 290, 'Frenesi', 'bolt', 5, {}, 'Abates geram energia.', { req:['eN'], hook:r => ({ onKill:{ eff:[{ k:'nrg', v:5 * r, to:'self' }] } }), hookText:r => `Ao abater: +${5 * r} de energia.` }),
      T('e11', 2, 650, 'Execução', 'sword', 5, { atk:.04 }, 'Mais ATK.', { req:['e8'] }),
      T('eK', 2, 470, 'Mil Cortes', 'arrows', 1, { dr:-.10 }, 'PEDRA-CHAVE: a cada 3 ataques, um golpe extra de 120% ATK. Recebe 10% mais dano.', { req:['eN'], keystone:true, hook:() => ({ every:{ n:3, eff:[{ k:'dmg', m:1.2, to:'tgt' }] } }) })
    ],
    Arcanista: [
      T('a1', 0, 110, 'Mente Focada', 'orb', 5, { skill:.03 }, 'Habilidades mais fortes.'),
      T('a2', 0, 290, 'Fluxo de Mana', 'battery', 5, { nrg:.03 }, 'Mais energia para ultimates.'),
      T('a3', 0, 470, 'Afinidade Elemental', 'star', 5, { elem:.03 }, 'Mais dano com vantagem elemental.'),
      T('a4', 0, 650, 'Chama Interior', 'flame', 5, { dot:.05 }, 'Queimaduras e venenos mais fortes.'),
      T('a5', 1, 110, 'Canalização', 'hourglass', 5, { cdr:.03 }, 'Habilidades recarregam mais rápido.', { req:['a1'] }),
      T('a6', 1, 290, 'Sobrecarga', 'bolt', 5, { ultDmg:.05 }, 'Ultimates mais fortes.', { req:['a2'] }),
      T('a7', 1, 470, 'Despertar Rápido', 'sparkle', 5, { startNrg:4 }, 'Começa com energia.', { req:['a3'] }),
      T('a8', 1, 650, 'Precisão Arcana', 'target', 5, { crit:.01 }, 'Mais críticos.', { req:['a4'] }),
      T('aN', 1, 470, 'Mente Arcana', 'book', 1, { skill:.10, nrg:.10 }, 'NOTÁVEL: poder e energia.', { req:['a6|a7'], notable:true, y:1.5 }),
      T('a9', 2, 110, 'Eco Arcano', 'orb', 5, {}, 'Ultimates recarregam a habilidade.', { req:['a5'], hook:r => ({ onUlt:{ eff:[{ k:'cdr', v:1.2 * r, to:'self' }] } }), hookText:r => `Ao usar a ultimate: −${(1.2 * r).toFixed(1).replace('.', ',')}s na recarga da habilidade.` }),
      T('a10', 2, 290, 'Poder Bruto', 'sword', 5, { atk:.03 }, 'Mais ATK.', { req:['aN'] }),
      T('a11', 2, 650, 'Penetração Mística', 'spear', 5, { pierce:.03 }, 'Ignora DEF.', { req:['a8'] }),
      T('aK', 2, 470, 'Singularidade', 'moon', 1, { ultDmg:.40, hp:-.15 }, 'PEDRA-CHAVE: +40% dano de ultimate. −15% HP.', { req:['aN'], keystone:true })
    ],
    Atirador: [
      T('t1', 0, 110, 'Dedo Leve', 'wind', 5, { spd:.02 }, 'Mais ataques por segundo.'),
      T('t2', 0, 290, 'Mira Firme', 'target', 5, { crit:.012 }, 'Mais críticos.'),
      T('t3', 0, 470, 'Munição Pesada', 'sword', 5, { atk:.02 }, 'Mais ATK.'),
      T('t4', 0, 650, 'Perfurante', 'spear', 5, { pierce:.025 }, 'Ignora parte da DEF.'),
      T('t5', 1, 110, 'Rolamento', 'wind', 5, { dodge:.015 }, 'Esquiva de golpes.', { req:['t1'] }),
      T('t6', 1, 290, 'Tiro Duplo', 'arrows', 5, {}, 'Chance de disparo extra.', { req:['t2'], hook:r => ({ onAtk:{ ch:.04 * r, eff:[{ k:'dmg', m:.8, to:'tgt' }] } }), hookText:r => `${4 * r}% de chance de disparo extra (80% ATK).` }),
      T('t7', 1, 470, 'Pontos Vitais', 'skull', 5, { critDmg:.05 }, 'Críticos mais fortes.', { req:['t3'] }),
      T('t8', 1, 650, 'Caçador de Monstros', 'crown', 5, { boss:.04 }, 'Mais dano contra chefes.', { req:['t4'] }),
      T('tN', 1, 470, 'Olho de Águia', 'eye', 1, { crit:.06, spd:.06 }, 'NOTÁVEL: visão perfeita.', { req:['t6|t7'], notable:true, y:1.5 }),
      T('t9', 2, 110, 'Tiro Elemental', 'star', 5, { elem:.04 }, 'Mais dano com vantagem elemental.', { req:['t5'] }),
      T('t10', 2, 290, 'Rajada', 'arrows', 5, {}, 'A cada 4 ataques, uma rajada.', { req:['tN'], hook:r => ({ every:{ n:4, eff:[{ k:'dmg', m:.3 * r, to:'rand' }] } }), hookText:r => `A cada 4 ataques: tiro extra de ${30 * r}% ATK num inimigo aleatório.` }),
      T('t11', 2, 650, 'Calibre Mortal', 'sword', 5, { atk:.03 }, 'Mais ATK.', { req:['t8'] }),
      T('tK', 2, 470, 'Tiro Mortal', 'target', 1, { crit:.15, critDmg:.30, spd:-.15 }, 'PEDRA-CHAVE: +15% crítico e +30% dano crítico. −15% velocidade.', { req:['tN'], keystone:true })
    ],
    Suporte: [
      T('s1', 0, 110, 'Mãos Curadoras', 'cross', 5, { healPow:.05 }, 'Curas e escudos mais fortes.'),
      T('s2', 0, 290, 'Vitalidade', 'heart', 5, { hp:.03 }, 'Mais HP.'),
      T('s3', 0, 470, 'Renovação', 'drop', 5, { regen:.001 }, 'Regenera HP.'),
      T('s4', 0, 650, 'Inspiração', 'battery', 5, { nrg:.03 }, 'Mais energia.'),
      T('s5', 1, 110, 'Bênção Inicial', 'wings', 5, {}, 'Protege a equipe no início da onda.', { req:['s1'], hook:r => ({ start:{ eff:[{ k:'shield', p:.012 * r, to:'allies', d:8 }] } }), hookText:r => `No início de cada onda: escudo de ${(1.2 * r).toFixed(1).replace('.', ',')}% do HP em toda a equipe.` }),
      T('s6', 1, 290, 'Guarda Sagrada', 'shield', 5, { def:.03 }, 'Mais DEF.', { req:['s2'] }),
      T('s7', 1, 470, 'Prece Rápida', 'hourglass', 5, { cdr:.03 }, 'Habilidades recarregam mais rápido.', { req:['s3'] }),
      T('s8', 1, 650, 'Purificação', 'sparkle', 1, {}, 'A habilidade também purifica o aliado mais ferido.', { req:['s4'], hook:() => ({ onSkill:{ eff:[{ k:'cleanse', to:'lowAlly' }] } }) }),
      T('sN', 1, 470, 'Luz Guia', 'star', 1, { healPow:.12, regen:.003 }, 'NOTÁVEL: presença curadora.', { req:['s6|s7'], notable:true, y:1.5 }),
      T('s9', 2, 110, 'Aura Vital', 'drop', 5, {}, 'Regeneração para toda a equipe.', { req:['s5'], hook:r => ({ start:{ eff:[{ k:'buff', s:'regen', v:.003 * r, d:12, to:'allies' }] } }), hookText:r => `No início de cada onda: equipe regenera ${(.3 * r).toFixed(1).replace('.', ',')}% HP/s por 12s.` }),
      T('s10', 2, 290, 'Barreira Divina', 'wall', 5, { dr:.02 }, 'Recebe menos dano.', { req:['sN'] }),
      T('s11', 2, 650, 'Fervor', 'orb', 5, { skill:.04 }, 'Habilidades mais fortes.', { req:['s8'] }),
      T('sK', 2, 470, 'Milagre', 'wings', 1, { atk:-.20 }, 'PEDRA-CHAVE: ao usar a habilidade, cura 5% do HP de toda a equipe. −20% ATK.', { req:['sN'], keystone:true, hook:() => ({ onSkill:{ eff:[{ k:'heal', p:.05, to:'allies' }] } }) })
    ]
  };
  // Círculo IV (Transcendência): nós fortes para os pontos dos níveis altos + uma pedra-angular por caminho.
  const circle4 = {
    Vanguarda:[
      T('v12', 3, 150, 'Pele de Titã', 'heart', 5, { hp:.04 }, 'Vida de gigante.', { req:['v10|v9'] }),
      T('v13', 3, 810, 'Martelo Celeste', 'fist', 5, { atk:.04, def:.02 }, 'Força e guarda.', { req:['v11'] }),
      T('vA', 3, 370, 'Céu Inabalável', 'shield', 1, { dr:.06, hp:.10 }, 'PEDRA-ANGULAR (Muralha dos Céus): no início de cada onda, escudo de 8% do HP para toda a equipe.', { req:['v12|v13'], capstone:true, branch:'a', hook:() => ({ start:{ eff:[{ k:'shield', p:.08, to:'allies', d:10 }] } }) }),
      T('vB', 3, 590, 'Fúria Carmesim', 'fang', 1, { atk:.15, lifesteal:.04 }, 'PEDRA-ANGULAR (Rei da Carnificina): abates curam 6% do HP.', { req:['v12|v13'], capstone:true, branch:'b', hook:() => ({ onKill:{ eff:[{ k:'heal', p:.06, to:'self' }] } }) })
    ],
    Executor:[
      T('e12', 3, 150, 'Corte Fantasma', 'wind', 5, { dodge:.01, spd:.02 }, 'Mais rápido e esquivo.', { req:['e9|e10'] }),
      T('e13', 3, 810, 'Golpe Final', 'skull', 5, { critDmg:.06, boss:.02 }, 'Críticos que derrubam chefes.', { req:['e11'] }),
      T('eA', 3, 370, 'Eclipse Total', 'moon', 1, { crit:.06, critDmg:.30 }, 'PEDRA-ANGULAR (Senhor do Eclipse): críticos ainda mais letais.', { req:['e12|e13'], capstone:true, branch:'a' }),
      T('eB', 3, 590, 'Sem Nome, Sem Rastro', 'wind', 1, { dodge:.08, spd:.08 }, 'PEDRA-ANGULAR (Espectro Sem Nome): ao esquivar, contra-ataca com 150% ATK.', { req:['e12|e13'], capstone:true, branch:'b', hook:() => ({ onDodge:{ eff:[{ k:'dmg', m:1.5, to:'attacker' }] } }) })
    ],
    Arcanista:[
      T('a12', 3, 150, 'Torrente Arcana', 'battery', 5, { nrg:.03, skill:.02 }, 'Energia e poder mágico.', { req:['a9|a10'] }),
      T('a13', 3, 810, 'Véu Estelar', 'star', 5, { elem:.03, pierce:.02 }, 'Magia que atravessa defesas.', { req:['a11'] }),
      T('aA', 3, 370, 'Chuva de Estrelas', 'sparkle', 1, { ultDmg:.20, nrg:.10 }, 'PEDRA-ANGULAR (Arauto das Estrelas): ultimates mais fortes e mais frequentes.', { req:['a12|a13'], capstone:true, branch:'a' }),
      T('aB', 3, 590, 'Cinzas do Mundo', 'flame', 1, { dot:.30, elem:.08 }, 'PEDRA-ANGULAR (Soberano da Ruína): queimaduras e venenos devastadores.', { req:['a12|a13'], capstone:true, branch:'b' })
    ],
    Atirador:[
      T('t12', 3, 150, 'Gatilho Leve', 'wind', 5, { spd:.02, crit:.005 }, 'Cadência ainda maior.', { req:['t9|t10'] }),
      T('t13', 3, 810, 'Munição Rúnica', 'spear', 5, { pierce:.02, boss:.03 }, 'Atravessa armaduras de chefes.', { req:['t11'] }),
      T('tA', 3, 370, 'Olho da Tempestade', 'eye', 1, { spd:.10, crit:.05 }, 'PEDRA-ANGULAR (Tempestade Viva): a cada 3 ataques, um disparo extra de 90% ATK.', { req:['t12|t13'], capstone:true, branch:'a', hook:() => ({ every:{ n:3, eff:[{ k:'dmg', m:.9, to:'rand' }] } }) }),
      T('tB', 3, 590, 'Flecha do Fim', 'target', 1, { boss:.20, pierce:.08 }, 'PEDRA-ANGULAR (Arqueiro do Fim): feita para derrubar chefes.', { req:['t12|t13'], capstone:true, branch:'b' })
    ],
    Suporte:[
      T('s12', 3, 150, 'Graça Profunda', 'cross', 5, { healPow:.04, hp:.02 }, 'Curas mais fortes.', { req:['s9|s10'] }),
      T('s13', 3, 810, 'Hino Sagrado', 'orb', 5, { skill:.03, cdr:.02 }, 'Habilidades mais frequentes.', { req:['s11'] }),
      T('sA', 3, 370, 'Santuário de Almas', 'wings', 1, { healPow:.20, dr:.04 }, 'PEDRA-ANGULAR (Guardião das Almas): no início de cada onda, escudo de 6% do HP para a equipe.', { req:['s12|s13'], capstone:true, branch:'a', hook:() => ({ start:{ eff:[{ k:'shield', p:.06, to:'allies', d:10 }] } }) }),
      T('sB', 3, 590, 'Alvorada', 'sparkle', 1, { skill:.12, nrg:.08 }, 'PEDRA-ANGULAR (Profeta da Aurora): a habilidade também dá 10 de energia à equipe.', { req:['s12|s13'], capstone:true, branch:'b', hook:() => ({ onSkill:{ eff:[{ k:'nrg', v:10, to:'allies' }] } }) })
    ]
  };
  Object.keys(classTrees).forEach(cls => { classTrees[cls].push(...circle4[cls]); });
  Object.keys(classTrees).forEach(cls => { classTrees[cls].push(...common(cls)); classTrees[cls].forEach(n => { n.req = n.req || []; }); });
  // Árvore de um herói: a da classe + a Essência exclusiva dele (ver builds.js).
  const treeCache = new Map();
  function treeFor(heroId) {
    if (treeCache.has(heroId)) return treeCache.get(heroId);
    const t = KT.Data.roster?.find(h => h.id === heroId); if (!t) return [];
    const ess = KT.Builds?.essenceNode(heroId);
    const tree = classTrees[t.cls].map(n => n.id === 'ess' && ess ? ess : n);
    if (KT.Builds) treeCache.set(heroId, tree);
    return tree;
  }

  // ---------------------------------------------------------------------------
  // TREINO DA EQUIPE (Dojo), melhorias permanentes pagas com ouro.
  // ---------------------------------------------------------------------------
  // Dojo v2: antes o teto chegava a 180 níveis por treino (+360% ATK para a equipe inteira) com preço que a renda do
  // fim de jogo pagava em minutos, e o time ficava invencível. Agora: teto de 40 níveis, os 20 primeiros valem cheio e os
  // seguintes metade (máximo +60% ATK/DEF, +75% HP, +12% crítico), o preço segue o antigo até o nível 20 e cresce 15% a mais por nível depois disso.
  const TRAIN_MAX = 40, TRAIN_FULL = 20;
  const training = {
    atk: { name:'Treino de Força', per:.02, stat:'atk', text:'+2% ATK para todos os heróis por nível (metade após o nível 20).' },
    hp:  { name:'Treino de Resistência', per:.025, stat:'hp', text:'+2,5% HP para todos os heróis por nível (metade após o nível 20).' },
    def: { name:'Treino de Guarda', per:.02, stat:'def', text:'+2% DEF para todos os heróis por nível (metade após o nível 20).' },
    crit:{ name:'Treino de Precisão', per:.004, stat:'crit', text:'+0,4% crítico para todos os heróis por nível (metade após o nível 20).' }
  };
  const trainingBonus = (key, lv) => { const tr = training[key]; if (!tr) return 0; lv = Math.max(0, Math.min(TRAIN_MAX, lv || 0)); return tr.per * (Math.min(lv, TRAIN_FULL) + Math.max(0, lv - TRAIN_FULL) * .5); };
  // Preço antigo até o nível 20 (o começo do jogo não muda); depois, +15% a mais por nível: o nível 30 custa ~4 h de farm
  // no fim de jogo e o 39 ~90 h. Os últimos níveis são uma meta longa, não um atalho.
  const trainingCost = lvl => Math.round(450 * Math.pow(1.24, lvl) * Math.pow(1.15, Math.max(0, lvl - 20)));
  const trainingCostV1 = lvl => Math.round(450 * Math.pow(1.24, lvl));
  const trainingCap = dojoLevel => Math.min(TRAIN_MAX, 5 + dojoLevel * 3);

  // ---------------------------------------------------------------------------
  // LOJA
  // ---------------------------------------------------------------------------
  // Comidas e pergaminhos: buffs temporários (a duração acumula ao usar mais de um).
  const buffs = {
    onigiri:{ name:'Onigiri do Viajante', text:'+10% HP por 30 min.', stats:{ hp:.10 }, dur:1800, icon:'magic_dust_01', hue:130 },
    ramen:{ name:'Ramen Picante', text:'+10% ATK por 30 min.', stats:{ atk:.10 }, dur:1800, icon:'potion_red_01', hue:20 },
    tea:{ name:'Chá de Jasmim', text:'+10% EXP por 30 min.', mods:{ xp:.10 }, dur:1800, icon:'potion_blue_01', hue:130 },
    luck:{ name:'Pergaminho da Sorte', text:'+20% chance de itens por 30 min.', mods:{ drop:.20 }, dur:1800, icon:'tome_01', hue:45 },
    flask_fury:{ name:'Frasco de Fúria', text:'+12% ATK e +6% crítico por 30 min.', stats:{ atk:.12, crit:.06 }, dur:1800, icon:'potion_red_01', hue:330 },
    flask_stone:{ name:'Frasco de Pedra', text:'+12% HP e +12% DEF por 30 min.', stats:{ hp:.12, def:.12 }, dur:1800, icon:'potion_blue_01', hue:45 },
    flask_sage:{ name:'Frasco do Sábio', text:'+15% EXP por 30 min.', mods:{ xp:.15 }, dur:1800, icon:'potion_blue_01', hue:250 },
    flask_fortune:{ name:'Frasco da Fortuna', text:'+30% chance de itens e +10% de ouro por 30 min.', mods:{ drop:.30, gold:.10 }, dur:1800, icon:'potion_red_01', hue:45 }
  };
  const shop = {
    gold: [
      { id:'potion', name:'Poção de Cura', icon:'potion_red_01', hue:0, give:{ potion:1 }, price:{ gold:250 }, scale:true, text:'Cura 35% do HP de toda a equipe durante o combate (recarga 20s).' },
      { id:'potion5', name:'Poções de Cura ×5', icon:'potion_red_01', hue:0, give:{ potion:5 }, price:{ gold:1100 }, scale:true, text:'Pacote econômico de 5 poções.' },
      { id:'elixir', name:'Elixir de Energia', icon:'potion_blue_01', hue:0, give:{ elixir:1 }, price:{ gold:400 }, scale:true, text:'+50 de energia para toda a equipe (recarga 30s). Ultimates na hora certa!' },
      { id:'scroll', name:'Pergaminho de Estudo', icon:'tome_01', hue:45, give:{ scroll:1 }, price:{ gold:2400 }, scale:true, limit:3, text:'Concede 8% da EXP do próximo nível. Compra e uso limitados a 3 por dia.' },
      { id:'onigiri', name:'Onigiri do Viajante', icon:'magic_dust_01', hue:130, give:{ onigiri:1 }, price:{ gold:900 }, scale:true, text:'Comida: +10% HP para a equipe por 30 minutos.' },
      { id:'ramen', name:'Ramen Picante', icon:'potion_red_01', hue:20, give:{ ramen:1 }, price:{ gold:1100 }, scale:true, text:'Comida: +10% ATK para a equipe por 30 minutos.' },
      { id:'tea', name:'Chá de Jasmim', icon:'potion_blue_01', hue:130, give:{ tea:1 }, price:{ gold:1400 }, scale:true, text:'Bebida: +10% de EXP por 30 minutos.' },
      { id:'ore10', name:'Tamahagane ×10', icon:'crystal_01', hue:290, give:{ ore:10 }, price:{ gold:1500 }, scale:true, text:'Material comum de refino (até +10).' },
      { id:'dust10', name:'Pó de Éter ×15', icon:'magic_dust_01', hue:220, give:{ dust:15 }, price:{ gold:1200 }, scale:true, text:'Usado para encantar (re-sortear afixos) na Oficina.' }
    ],
    crystal: [
      { id:'key1', name:'Chave de Convocação', icon:'lantern_seal', hue:290, give:{ keys:1 }, price:{ crystal:150 }, text:'Uma convocação na Caixa dos Mundos.' },
      { id:'key10', name:'10 Chaves de Convocação', icon:'lantern_seal', hue:290, give:{ keys:10 }, price:{ crystal:1350 }, text:'10 convocações com 10% de desconto.' },
      { id:'bag', name:'Expansão da Bolsa (+25)', icon:'backpack_LVL_01', hue:0, give:{ invCap:25 }, price:{ crystal:100 }, text:'Mais espaço para itens. O preço sobe a cada expansão. Máximo de 400 espaços.' },
      { id:'luck', name:'Pergaminho da Sorte', icon:'tome_01', hue:45, give:{ luck:1 }, price:{ crystal:40 }, text:'+20% chance de itens por 30 minutos.' },
      { id:'boost', name:'Incenso do Viajante (1h)', icon:'magic_dust_01', hue:45, give:{ boost:3600 }, price:{ crystal:80 }, limit:1, text:'+20% de EXP e ouro por 1 hora. Limite de 1 por dia.' },
      { id:'respec', name:'Pergaminho do Esquecimento', icon:'tome_01', hue:290, give:{ respec:1 }, price:{ crystal:50 }, text:'Redefine gratuitamente os talentos de um herói.' },
      { id:'ore50', name:'Tamahagane ×50', icon:'crystal_01', hue:290, give:{ ore:50 }, price:{ crystal:160 }, text:'Estoque de material comum de refino.' },
      { id:'star1', name:'Aço Estelar', icon:'crystal_01', hue:190, give:{ star:1 }, price:{ crystal:180 }, limit:2, text:'Material raro de refino: até +8 sem perder nível. Limite de 2 por dia.' },
      { id:'ori1', name:'Oricalco', icon:'crystal_01', hue:250, give:{ ori:1 }, price:{ crystal:900 }, limit:1, text:'Material épico de refino: até +15. Limite de 1 por dia.' }
    ]
  };

  KT.Progression = { services, serviceFor, serviceActions, buffs, attributes, ATTR_PER_LEVEL, classAttrHint, icons, jobs, JOB_LEVEL, JOB_CLASS_LEVEL, JOB2_LEVEL, JOB2_CLASS_LEVEL, CLASS_LEVEL_CAP, jobCost, job2Cost, branchOf, jobTitle, TIER_REQ, classTrees, treeFor, training, trainingBonus, trainingCost, trainingCostV1, trainingCap, TRAIN_MAX, shop };
})();
