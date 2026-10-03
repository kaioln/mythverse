(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  // ---------------------------------------------------------------------------
  // ELEMENTOS, cada elemento é forte contra dois outros (+30% dano) e recebe
  // -20% ao atacar quem é forte contra ele. Luz e Sombra são fortes entre si.
  // ---------------------------------------------------------------------------
  const elements = {
    Fogo:     { color:'#ff7a4f', icon:'火', strong:['Natureza','Gelo'] },
    Água:     { color:'#4fb3ff', icon:'水', strong:['Fogo','Terra'] },
    Natureza: { color:'#5fe39a', icon:'木', strong:['Água','Terra'] },
    Terra:    { color:'#d8ad6a', icon:'土', strong:['Raio','Fogo'] },
    Raio:     { color:'#c9a4ff', icon:'雷', strong:['Água','Vento'] },
    Vento:    { color:'#9ce9cc', icon:'風', strong:['Natureza','Terra'] },
    Gelo:     { color:'#91dfff', icon:'氷', strong:['Vento','Natureza'] },
    Luz:      { color:'#ffe19a', icon:'光', strong:['Sombra'] },
    Sombra:   { color:'#b58cff', icon:'闇', strong:['Luz'] }
  };

  // ---------------------------------------------------------------------------
  // CLASSES, atributos base (nível 1), traço de classe e sinergia de equipe.
  // Vagas 1 e 2 são a LINHA DE FRENTE; vagas 3 e 4, a RETAGUARDA.
  // ---------------------------------------------------------------------------
  const classes = {
    Vanguarda: { icon:'盾', title:'Guardião do Véu', promise:'Segura a linha de frente e apanha no lugar da equipe.', tradeoff:'Resiste muito, mas depende da equipe para encerrar lutas longas.', color:'#6fb8ff', row:'Frente', base:{ hp:1500, atk:78, def:80, spd:.85, crit:.05, critDmg:1.5, dodge:.03 },
      trait:'Linha de frente: HP e DEF altos. Atrai mais ataques por estar à frente.', baseBonus:{ def:.15 }, threat:2,
      synergy:[{ n:2, text:'Equipe +10% DEF', stats:{ def:.10 } }, { n:3, text:'Equipe +10% DEF e +10% HP', stats:{ def:.10, hp:.10 } }] },
    Executor:  { icon:'刃', title:'Lâmina Jurada', promise:'Caça o inimigo mais ferido e o derruba em poucos golpes.', tradeoff:'Bate forte e aguenta pouco. Fora de posição, cai depressa.', color:'#ff7a8a', row:'Frente', base:{ hp:1020, atk:122, def:46, spd:1.08, crit:.15, critDmg:1.6, dodge:.08 },
      trait:'Duelista: ATK e dano crítico altos, pouca defesa.', baseBonus:{ critDmg:.25 }, threat:1,
      synergy:[{ n:2, text:'Equipe +12% dano crítico', stats:{ critDmg:.12 } }, { n:3, text:'Equipe +12% dano crítico e +5% crítico', stats:{ critDmg:.12, crit:.05 } }] },
    Arcanista: { icon:'術', title:'Tecedor da Fenda', promise:'Manipula elementos, Pontos de Técnica e efeitos para mudar o ritmo da batalha.', tradeoff:'Cada habilidade pesa, mas não aguenta virar alvo.', color:'#c9a4ff', row:'Retaguarda', base:{ hp:900, atk:118, def:40, spd:.9, crit:.08, critDmg:1.5, dodge:.05 },
      trait:'Canalizador: dano de habilidade alto, corpo frágil.', baseBonus:{ skill:.20 }, threat:1,
      synergy:[{ n:2, text:'Equipe +10% dano de habilidade', stats:{ skill:.10 } }, { n:3, text:'Equipe +10% dano de habilidade e +10% energia', stats:{ skill:.10, nrg:.10 } }] },
    Atirador:  { icon:'弓', title:'Vigia das Rotas', promise:'Bate de longe sem parar e aproveita cada marca no inimigo.', tradeoff:'Precisa de tempo e de alguém na frente para render.', color:'#ffd76a', row:'Retaguarda', base:{ hp:950, atk:112, def:42, spd:1.15, crit:.16, critDmg:1.5, dodge:.07 },
      trait:'Vigia: velocidade e crítico altos.', baseBonus:{ spd:.10 }, threat:1,
      synergy:[{ n:2, text:'Equipe +8% velocidade de ataque', stats:{ spd:.08 } }, { n:3, text:'Equipe +8% velocidade e ignora 10% da DEF', stats:{ spd:.08, pierce:.10 } }] },
    Suporte:   { icon:'癒', title:'Faroleiro de Almas', promise:'Mantém a equipe de pé até o Elo Kizuna decidir a luta.', tradeoff:'Ganha a luta pelo tempo, não pelo dano.', color:'#5fe39a', row:'Retaguarda', base:{ hp:1080, atk:84, def:55, spd:.95, crit:.06, critDmg:1.5, dodge:.05 },
      trait:'Protetor: base de poder de cura e escudo alta.', baseBonus:{ healPow:.25 }, threat:1,
      synergy:[{ n:2, text:'Equipe regenera 0,6% do HP por segundo', stats:{ regen:.006 } }, { n:3, text:'Equipe regenera 0,6% HP/s e recebe 8% menos dano', stats:{ regen:.006, dr:.08 } }] }
  };

  const elementSynergy = [
    { n:2, text:'+8% ATK para heróis do elemento', stats:{ atk:.08 } },
    { n:3, text:'+15% ATK e +10% HP para heróis do elemento', stats:{ atk:.15, hp:.10 } },
    { n:4, text:'+25% ATK, +15% HP e +10% crítico para todos', stats:{ atk:.25, hp:.15, crit:.10 } }
  ];

  // ---------------------------------------------------------------------------
  // LAÇOS, pares e trios com história juntos ganham bônus únicos.
  // ---------------------------------------------------------------------------
  const bonds = [
    { id:'aurum', name:'Rivais de Aurum', ids:['solen','varyon'], text:'+15% ATK e +20 de energia inicial', stats:{ atk:.15, startNrg:20 } },
    { id:'oath', name:'Irmãos de Juramento', ids:['hayato','ren'], text:'+12% ATK e +12% HP', stats:{ atk:.12, hp:.12 } },
    { id:'sails', name:'Tripulação das Velas', ids:['tobias','kenji'], text:'+10% ATK, +10% HP e +5% roubo de vida', stats:{ atk:.10, hp:.10, lifesteal:.05 } },
    { id:'saiyan_awake', name:'Herdeiros de Aurum', ids:['goku_ui','vegeta_ego'], text:'+14% ATK e +15 de energia inicial', stats:{ atk:.14, startNrg:15 } },
    { id:'shinobi_awake', name:'Juramento Desperto', ids:['naruto_kurama','sasuke_susanoo'], text:'+12% ATK e +12% HP', stats:{ atk:.12, hp:.12 } },
    { id:'guardians_light', name:'Guardiãs da Luz', ids:['mercy_valkyrie','sailor_eternal'], text:'+12% cura e escudos, +8% velocidade', stats:{ healPow:.12, spd:.08 } },
    { id:'souls', name:'Mosteiro Minguante', ids:['hiro','yuki'], text:'+15% dano de habilidade e +10% DEF', stats:{ skill:.15, def:.10 } },
    { id:'minase', name:'Irmãos Minase', ids:['akira','hana'], text:'+1% HP/s de regeneração e +10% ATK', stats:{ regen:.01, atk:.10 } },
    { id:'veil', name:'Academia do Véu', ids:['sora','daichi'], text:'+10% crítico e +15% dano crítico', stats:{ crit:.10, critDmg:.15 } },
    { id:'walls', name:'Patrulha de Eldria', ids:['lucan','mira','erik'], text:'+15% velocidade de ataque e +10% ATK', stats:{ spd:.15, atk:.10 } },
    { id:'alchemy', name:'Alquimistas dos Alambiques', ids:['alden','ignis'], text:'+25% dano de efeitos contínuos e +10% DEF', stats:{ dot:.25, def:.10 } },
    { id:'gifts', name:'Liga dos Juramentos', ids:['toma','ryo','grant'], text:'+12% ATK e +12% energia', stats:{ atk:.12, nrg:.12 } },
    { id:'metro', name:'Mil Degraus', ids:['kenta','volt'], text:'+20% ATK', stats:{ atk:.20 } },
    { id:'hunters', name:'Filhos das Raízes', ids:['kai','riku','elian'], text:'+10% esquiva e +10% ATK', stats:{ dodge:.10, atk:.10 } },
    { id:'wind_blades', name:'Lâminas do Vento', ids:['jin','haru'], text:'+10% crítico e +10% velocidade', stats:{ crit:.10, spd:.10 } },
    { id:'valmar', name:'Guilda de Valmar', ids:['drake','sienna'], text:'+12% ATK e +12% DEF', stats:{ atk:.12, def:.12 } },
    { id:'moonlight', name:'Guardiãs do Luar', ids:['aiko','yuki'], text:'+20% cura e escudos', stats:{ healPow:.20 } },
    { id:'mists', name:'Ilhas da Bruma', ids:['kiba','jin'], text:'+10% HP e +10% dano crítico', stats:{ hp:.10, critDmg:.10 } },
    { id:'nations', name:'Estrada dos Dojos', ids:['daigo','mei'], text:'+10% ATK e +8% esquiva', stats:{ atk:.10, dodge:.08 } },
    { id:'emerald', name:'Destino Esmeralda', ids:['kael','rina','sael'], text:'+15% ATK e +15% dano de habilidade', stats:{ atk:.15, skill:.15 } },
    { id:'north', name:'Sangue do Gelo Longo', ids:['thorn','bjorn'], text:'+15% HP e +10% ATK', stats:{ hp:.15, atk:.10 } },
    { id:'aurora', name:'Esquadrão Aurora', ids:['ivy','nari','aurelia'], text:'+10% velocidade e +10% cura', stats:{ spd:.10, healPow:.10 } },
    { id:'infected', name:'Sobreviventes da Névoa', ids:['cole','dana'], text:'+12% ATK e +10% DEF', stats:{ atk:.12, def:.10 } },
    { id:'wolf', name:'Mestre e Aprendiz das Runas', ids:['garrick','zira'], text:'+12% ATK e +10% esquiva', stats:{ atk:.12, dodge:.10 } },
    { id:'units', name:'Unidades de Combate', ids:['n9','unit7'], text:'+12% ATK e ignora 10% da DEF', stats:{ atk:.12, pierce:.10 } },
    { id:'sable', name:'Filhos de Kurenai', ids:['rex','virel'], text:'+15% ATK e +8% roubo de vida', stats:{ atk:.15, lifesteal:.08 } },
    { id:'demon_hunters', name:'Pacto Carmesim', ids:['rex','selene'], text:'+15% dano de habilidade e +8% esquiva', stats:{ skill:.15, dodge:.08 } },
    { id:'underworld', name:'Rivais das Cinzas', ids:['kaji','kori'], text:'+12% ATK e +25% dano contínuo', stats:{ atk:.12, dot:.25 } },
    { id:'ionar', name:'Vento Solto', ids:['zara','kira','haru'], text:'+12% ATK e +10% energia', stats:{ atk:.12, nrg:.10 } },
    { id:'explorers', name:'Exploradores', ids:['nadia','tessa','wade'], text:'+10% crítico e +10% ATK', stats:{ crit:.10, atk:.10 } },
    { id:'spartans', name:'Veteranos da Fenda', ids:['rook','warden'], text:'+15% DEF e +10% ATK', stats:{ def:.15, atk:.10 } },
    { id:'assassins', name:'Sombras dos Telhados', ids:['dario','riku'], text:'+20% dano crítico', stats:{ critDmg:.20 } },
    { id:'medics', name:'Anjos da Linha de Frente', ids:['aurelia','dana'], text:'+20% cura e +10% HP', stats:{ healPow:.20, hp:.10 } }
  ];

  // ---------------------------------------------------------------------------
  // MONSTROS, cada região tem criaturas exclusivas, com habilidades próprias.
  // Atributos são a base (Poder 1); a região e o estágio multiplicam o Poder.
  // Efeitos usam o mesmo sistema das habilidades dos heróis (ver roster.js).
  // ---------------------------------------------------------------------------
  const E = (o) => ({ hp:900, atk:70, def:40, atkMul:1.7, hpMul:1.5, spd:.9, crit:.05, dodge:.03, xp:14, gold:[8, 14], ...o });
  const enemies = {
    // Bosque das Lanternas, criaturas da floresta (fracas contra Fogo e Vento).
    fox:          E({ name:'Raposa do Crepúsculo', sprite:'fox', el:'Sombra', role:'Ágil', hp:760, atk:74, spd:1.15, dodge:.15, desc:'Veloz e esquiva. Sua mordida faz sangrar.', skill:{ name:'Mordida Sombria', cd:7, eff:[{ k:'dmg', m:1.5, to:'tgt' }, { k:'st', s:'bleed', d:4, v:.25, ch:.7, to:'tgt' }] } }),
    golem:        E({ name:'Sentinela de Musgo', sprite:'golem', el:'Natureza', role:'Tanque', hp:1500, atk:58, def:70, spd:.65, desc:'Resistente. Protege aliados com casca de musgo.', skill:{ name:'Casca de Musgo', cd:10, eff:[{ k:'shield', m:1.6, to:'lowAlly', d:6 }] } }),
    spider_jade:  E({ name:'Aranha de Jade', sprite:'spider_jade', el:'Natureza', role:'Venenosa', hp:820, atk:66, spd:1.0, desc:'Envenena quem estiver na retaguarda.', skill:{ name:'Presas de Jade', cd:8, eff:[{ k:'dmg', m:1.1, to:'back' }, { k:'st', s:'poison', d:6, v:.18, ch:1, to:'back' }] } }),
    oni:          E({ name:'Oni da Névoa', sprite:'oni', el:'Terra', role:'Brutamontes', hp:1150, atk:86, def:50, spd:.75, desc:'Golpes pesados que atordoam a linha de frente.', skill:{ name:'Clava Esmagadora', cd:9, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'stun', d:1.2, ch:.5, to:'tgt' }] } }),
    golem_elder:  E({ name:'Ancião de Musgo', sprite:'golem_elder', el:'Natureza', role:'Guardião', elite:true, hp:3600, atk:88, def:95, spd:.7, xp:60, gold:[40, 60], desc:'Guardião do Bosque. Cura aliados e provoca a equipe.', skill:{ name:'Raízes Antigas', cd:9, eff:[{ k:'heal', m:1.6, to:'allies' }, { k:'taunt', d:3 }, { k:'st', s:'slow', d:4, v:.3, ch:1, to:'all' }] } }),
    fox_nine:     E({ name:'Raposa de Nove Sombras', sprite:'fox_nine', el:'Sombra', role:'Guardiã', elite:true, hp:2600, atk:112, spd:1.2, dodge:.2, xp:60, gold:[40, 60], desc:'Ataca várias vezes e marca alvos frágeis.', skill:{ name:'Nove Caudas', cd:8, eff:[{ k:'dmg', m:.55, to:'randEach', hits:4 }, { k:'st', s:'mark', d:5, v:.2, ch:1, to:'low' }] } }),

    // Templo do Véu, espíritos e guardiões de pedra (fracos contra Luz e Raio).
    oni_ash:      E({ name:'Oni de Cinzas', sprite:'oni_ash', el:'Terra', role:'Brutamontes', hp:1250, atk:90, def:60, spd:.75, desc:'Enfraquece quem atinge.', skill:{ name:'Golpe de Cinzas', cd:8, eff:[{ k:'dmg', m:1.7, to:'tgt' }, { k:'st', s:'weaken', d:5, v:.2, ch:1, to:'tgt' }] } }),
    spider:       E({ name:'Aranha de Cristal', sprite:'spider', el:'Sombra', role:'Venenosa', hp:900, atk:72, spd:1.05, desc:'Cristais que quebram a armadura.', skill:{ name:'Estilhaços', cd:8, eff:[{ k:'dmg', m:.9, to:'all' }, { k:'st', s:'armorBreak', d:5, v:.2, ch:.6, to:'all' }] } }),
    wisp_void:    E({ name:'Chama do Vazio', sprite:'wisp_void', el:'Sombra', role:'Conjurador', hp:700, atk:88, def:25, spd:1.0, dodge:.1, desc:'Queima a retaguarda com fogo roxo.', skill:{ name:'Fogo do Vazio', cd:7, eff:[{ k:'dmg', m:1.4, to:'back' }, { k:'st', s:'burn', d:5, v:.3, ch:1, to:'back' }] } }),
    golem_obsidian:E({ name:'Golem de Obsidiana', sprite:'golem_obsidian', el:'Terra', role:'Tanque', hp:1700, atk:62, def:95, spd:.6, desc:'Reflete parte do dano sofrido.', thorns:.15, skill:{ name:'Muralha Negra', cd:11, eff:[{ k:'buff', s:'dr', v:.35, d:5, to:'allies' }] } }),
    oni_crimson:  E({ name:'Oni Carmesim', sprite:'oni_crimson', el:'Fogo', role:'Guardião', elite:true, hp:3900, atk:118, def:70, spd:.8, xp:70, gold:[50, 75], desc:'Entra em fúria ao perder vida.', enrageAt:.5, skill:{ name:'Tempestade Carmesim', cd:9, eff:[{ k:'dmg', m:1.2, to:'all' }, { k:'st', s:'burn', d:4, v:.3, ch:.7, to:'all' }] } }),
    fox_specter:  E({ name:'Kitsune Espectral', sprite:'fox_specter', el:'Luz', role:'Guardiã', elite:true, hp:2800, atk:108, spd:1.15, dodge:.22, xp:70, gold:[50, 75], desc:'Some e reaparece silenciando heróis.', skill:{ name:'Ilusão Espectral', cd:9, eff:[{ k:'st', s:'silence', d:4, ch:1, to:'high' }, { k:'dmg', m:1.6, to:'high' }, { k:'buff', s:'dodge', v:.3, d:4, to:'self' }] } }),
    golem_lava:   E({ name:'Guardião Ígneo', sprite:'golem_lava', el:'Fogo', role:'Chefe de Andar', elite:true, miniboss:true, hp:9000, atk:120, def:95, spd:.65, xp:180, gold:[140, 200], desc:'Chefe do Templo. Quando prepara a Erupção, escude a equipe.', skill:{ name:'Punho de Magma', cd:7, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] },
      specials:[{ name:'Erupção', cd:16, windup:2.4, eff:[{ k:'dmg', m:2.1, to:'all' }, { k:'st', s:'burn', d:5, v:.4, ch:1, to:'all' }] }] }),

    // Costa das Marés, criaturas do mar (fracas contra Raio e Natureza).
    wisp:         E({ name:'Luz Errante', sprite:'wisp', el:'Água', role:'Conjurador', hp:760, atk:84, def:28, spd:1.05, dodge:.12, desc:'Drena a energia dos heróis.', skill:{ name:'Sussurro Salgado', cd:8, eff:[{ k:'dmg', m:1.3, to:'rand' }, { k:'nrg', v:-25, to:'rand' }] } }),
    revenant:     E({ name:'Espectro das Marés', sprite:'revenant', el:'Água', role:'Lutador', hp:1250, atk:88, def:55, spd:.85, lifesteal:.2, desc:'Rouba vida a cada golpe.', skill:{ name:'Tridente Afogado', cd:8, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'drain', v:.5 }] } }),
    fox_foam:     E({ name:'Raposa da Espuma', sprite:'fox_foam', el:'Gelo', role:'Ágil', hp:820, atk:80, spd:1.2, dodge:.18, desc:'Congela quem hesita.', skill:{ name:'Sopro Gélido', cd:8, eff:[{ k:'dmg', m:1.3, to:'tgt' }, { k:'st', s:'freeze', d:1.5, ch:.5, to:'tgt' }] } }),
    spider_coral: E({ name:'Aranha de Coral', sprite:'spider_coral', el:'Terra', role:'Tanque', hp:1400, atk:66, def:85, spd:.8, thorns:.12, desc:'Carapaça espinhosa que devolve dano.', skill:{ name:'Carapaça', cd:10, eff:[{ k:'shield', m:2.0, to:'self', d:6 }, { k:'taunt', d:4 }] } }),
    oni_tide:     E({ name:'Oni Abissal', sprite:'oni_tide', el:'Água', role:'Brutamontes', hp:1300, atk:96, def:58, spd:.75, desc:'Onda que derruba a linha de frente.', skill:{ name:'Onda Abissal', cd:9, eff:[{ k:'dmg', m:1.4, to:'front' }, { k:'st', s:'slow', d:4, v:.35, ch:1, to:'front' }] } }),
    revenant_captain:E({ name:'Capitão Afogado', sprite:'revenant_captain', el:'Água', role:'Guardião', elite:true, hp:4200, atk:125, def:75, spd:.85, lifesteal:.15, xp:85, gold:[60, 90], desc:'Comanda a tripulação: fortalece aliados.', skill:{ name:'Ordem do Capitão', cd:9, eff:[{ k:'buff', s:'atk', v:.3, d:6, to:'allies' }, { k:'dmg', m:1.5, to:'tgt' }] } }),
    golem_coral:  E({ name:'Colosso de Coral', sprite:'golem_coral', el:'Terra', role:'Guardião', elite:true, hp:5200, atk:100, def:120, spd:.6, thorns:.2, xp:85, gold:[60, 90], desc:'Muralha viva. Escudos enormes e espinhos.', skill:{ name:'Recife Protetor', cd:10, eff:[{ k:'shield', m:2.2, to:'allies', d:6 }, { k:'taunt', d:4 }] } }),

    // Arquivo Submerso, conhecimento proibido (fracos contra Luz e Terra).
    revenant_scribe:E({ name:'Escriba Afogado', sprite:'revenant_scribe', el:'Sombra', role:'Conjurador', hp:950, atk:92, def:40, spd:.9, desc:'Silencia heróis com runas afogadas.', skill:{ name:'Runa do Silêncio', cd:9, eff:[{ k:'dmg', m:1.3, to:'rand' }, { k:'st', s:'silence', d:3, ch:.8, to:'rand' }] } }),
    wisp_arc:     E({ name:'Faísca Arcana', sprite:'wisp_arc', el:'Raio', role:'Conjurador', hp:780, atk:98, def:28, spd:1.15, dodge:.12, desc:'Descargas em cadeia.', skill:{ name:'Corrente Elétrica', cd:8, eff:[{ k:'dmg', m:.7, to:'randEach', hits:3 }, { k:'st', s:'stun', d:.8, ch:.3, to:'rand' }] } }),
    spider_ink:   E({ name:'Aranha de Tinta', sprite:'spider_ink', el:'Sombra', role:'Venenosa', hp:980, atk:80, spd:1.0, desc:'Tinta que cega e envenena.', skill:{ name:'Tinta Venenosa', cd:8, eff:[{ k:'dmg', m:.8, to:'all' }, { k:'st', s:'poison', d:6, v:.15, ch:1, to:'all' }] } }),
    golem_crystal:E({ name:'Autômato de Jade', sprite:'golem_crystal', el:'Natureza', role:'Tanque', hp:1800, atk:70, def:100, spd:.6, desc:'Regenera e protege os escribas.', regen:.01, skill:{ name:'Núcleo Restaurador', cd:10, eff:[{ k:'heal', m:1.8, to:'lowAlly' }, { k:'shield', m:1.4, to:'lowAlly', d:6 }] } }),
    fox_storm:    E({ name:'Raposa-Trovão', sprite:'fox_storm', el:'Raio', role:'Ágil', hp:880, atk:96, spd:1.25, dodge:.18, desc:'Salta para a retaguarda.', skill:{ name:'Salto Relâmpago', cd:7, eff:[{ k:'dmg', m:1.7, to:'back' }, { k:'st', s:'stun', d:1, ch:.4, to:'back' }] } }),
    revenant_crimson:E({ name:'Arquivista Carmesim', sprite:'revenant_crimson', el:'Sombra', role:'Guardião', elite:true, hp:4600, atk:130, def:80, spd:.9, xp:95, gold:[70, 100], desc:'Amaldiçoa a equipe: todos batem menos e apanham mais.', skill:{ name:'Maldição do Arquivo', cd:9, eff:[{ k:'dmg', m:1.1, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }, { k:'st', s:'mark', d:6, v:.15, ch:1, to:'all' }] } }),
    oni_storm:    E({ name:'Guardião da Tempestade', sprite:'oni_storm', el:'Raio', role:'Chefe de Andar', elite:true, miniboss:true, hp:11500, atk:135, def:100, spd:.75, xp:220, gold:[170, 240], desc:'Chefe do Arquivo. Carrega um Trovão que atordoa toda a equipe.', skill:{ name:'Martelo Elétrico', cd:7, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'armorBreak', d:5, v:.25, ch:1, to:'tgt' }] },
      specials:[{ name:'Trovão Ancestral', cd:17, windup:2.4, eff:[{ k:'dmg', m:1.8, to:'all' }, { k:'st', s:'stun', d:1.8, ch:1, to:'all' }] }] }),

    // Pântano dos Vaga-lumes, brejo encantado (fracos contra Fogo e Gelo).
    fox_bog:      E({ name:'Raposa do Lodo', sprite:'fox_bog', el:'Natureza', role:'Ágil', hp:800, atk:76, spd:1.1, dodge:.14, desc:'Cobre os heróis de lama pegajosa.', skill:{ name:'Lama Pegajosa', cd:7, eff:[{ k:'dmg', m:1.2, to:'tgt' }, { k:'st', s:'slow', d:4, v:.4, ch:1, to:'tgt' }] } }),
    spider_bog:   E({ name:'Aranha do Brejo', sprite:'spider_bog', el:'Água', role:'Venenosa', hp:860, atk:70, spd:1.0, desc:'Teias encharcadas de veneno lento.', skill:{ name:'Teia Encharcada', cd:8, eff:[{ k:'dmg', m:.7, to:'all' }, { k:'st', s:'poison', d:6, v:.12, ch:.6, to:'all' }] } }),
    wisp_bog:     E({ name:'Vaga-lume Errante', sprite:'wisp_bog', el:'Luz', role:'Conjurador', hp:720, atk:82, def:26, spd:1.05, dodge:.12, desc:'Hipnotiza e rouba a concentração.', skill:{ name:'Luz Hipnótica', cd:8, eff:[{ k:'st', s:'stun', d:1.2, ch:.6, to:'rand' }, { k:'nrg', v:-15, to:'rand' }, { k:'dmg', m:1.0, to:'rand' }] } }),
    oni_moss:     E({ name:'Oni do Musgo', sprite:'oni_moss', el:'Natureza', role:'Brutamontes', hp:1200, atk:88, def:55, spd:.75, desc:'Se regenera a cada pancada.', skill:{ name:'Pancada Musguenta', cd:8, eff:[{ k:'dmg', m:1.6, to:'tgt' }, { k:'heal', p:.06, to:'self' }] } }),
    golem_bog:    E({ name:'Colosso do Pântano', sprite:'golem_bog', el:'Água', role:'Guardião', elite:true, hp:3900, atk:92, def:100, spd:.65, xp:65, gold:[45, 65], desc:'Afunda a linha de frente no lodo.', skill:{ name:'Afundar', cd:9, eff:[{ k:'dmg', m:1.2, to:'front' }, { k:'st', s:'slow', d:5, v:.5, ch:1, to:'front' }, { k:'taunt', d:3 }] } }),
    revenant_bog: E({ name:'Bruxa do Brejo', sprite:'revenant_bog', el:'Sombra', role:'Guardiã', elite:true, hp:3000, atk:110, def:60, spd:.9, xp:65, gold:[45, 65], desc:'Amaldiçoa heróis e cura seus servos.', skill:{ name:'Maldição do Pântano', cd:9, eff:[{ k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }, { k:'st', s:'poison', d:6, v:.2, ch:1, to:'all' }, { k:'heal', m:1.0, to:'allies' }] } }),

    // Cripta de Jade, mortos-vivos esmeralda (fracos contra Luz e Fogo).
    spider_bone:  E({ name:'Aranha de Ossos', sprite:'spider_bone', el:'Sombra', role:'Venenosa', hp:900, atk:78, spd:1.05, desc:'Arremessa estilhaços de osso que fazem sangrar.', skill:{ name:'Estilhaço Ósseo', cd:7, eff:[{ k:'dmg', m:.5, to:'randEach', hits:3 }, { k:'st', s:'bleed', d:5, v:.2, ch:1, to:'rand' }] } }),
    wisp_jade:    E({ name:'Chama de Jade', sprite:'wisp_jade', el:'Natureza', role:'Conjurador', hp:760, atk:92, def:28, spd:1.0, dodge:.1, desc:'Fogo esmeralda que derrete armaduras da retaguarda.', skill:{ name:'Fogo Esmeralda', cd:8, eff:[{ k:'dmg', m:1.3, to:'back' }, { k:'st', s:'armorBreak', d:5, v:.2, ch:1, to:'back' }] } }),
    fox_jade:     E({ name:'Raposa de Jade', sprite:'fox_jade', el:'Natureza', role:'Ágil', hp:840, atk:86, spd:1.2, dodge:.18, desc:'Caça os feridos e some entre as lápides.', skill:{ name:'Salto Esmeralda', cd:7, eff:[{ k:'dmg', m:1.5, to:'low' }, { k:'buff', s:'dodge', v:.2, d:4, to:'self' }] } }),
    golem_emerald:E({ name:'Guardião Esmeralda', sprite:'golem_emerald', el:'Terra', role:'Tanque', hp:1750, atk:64, def:100, spd:.6, desc:'Ergue muralhas de jade sobre os aliados.', skill:{ name:'Muro de Jade', cd:10, eff:[{ k:'shield', m:1.8, to:'allies', d:5 }] } }),
    revenant_jade:E({ name:'Sacerdote de Jade', sprite:'revenant_jade', el:'Sombra', role:'Guardião', elite:true, hp:3700, atk:112, def:70, spd:.85, xp:70, gold:[50, 75], desc:'Levanta os mortos da cripta. Derrube-o primeiro.', skill:{ name:'Rito da Ressurreição', cd:12, eff:[{ k:'revive', p:.4 }, { k:'heal', m:1.2, to:'allies' }] } }),
    oni_jade:     E({ name:'Oni Carcereiro', sprite:'oni_jade', el:'Terra', role:'Guardião', elite:true, hp:4100, atk:120, def:80, spd:.8, xp:70, gold:[50, 75], desc:'Acorrenta o herói mais forte.', skill:{ name:'Correntes da Cripta', cd:9, eff:[{ k:'st', s:'stun', d:1.5, ch:1, to:'high' }, { k:'dmg', m:1.6, to:'high' }] } }),
    revenant_king:E({ name:'Rei Sem Túmulo', sprite:'revenant_king', el:'Sombra', role:'Chefe de Andar', elite:true, miniboss:true, hp:9800, atk:125, def:95, spd:.75, xp:190, gold:[150, 210], desc:'Chefe da Cripta. Sua Coroa das Almas silencia toda a equipe.', skill:{ name:'Cetro Maldito', cd:7, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'st', s:'mark', d:5, v:.25, ch:1, to:'tgt' }] },
      specials:[{ name:'Coroa das Almas', cd:17, windup:2.4, eff:[{ k:'dmg', m:2.0, to:'all' }, { k:'st', s:'silence', d:3, ch:1, to:'all' }] }] }),

    // Planalto Congelado, nevasca eterna (fracos contra Fogo e Terra).
    fox_snow:     E({ name:'Raposa da Nevasca', sprite:'fox_snow', el:'Gelo', role:'Ágil', hp:860, atk:84, spd:1.2, dodge:.16, desc:'Presas que congelam.', skill:{ name:'Presas de Gelo', cd:7, eff:[{ k:'dmg', m:1.3, to:'tgt' }, { k:'st', s:'freeze', d:1.2, ch:.35, to:'tgt' }] } }),
    spider_ice:   E({ name:'Aranha de Geada', sprite:'spider_ice', el:'Gelo', role:'Venenosa', hp:950, atk:76, spd:1.0, desc:'Teias cristalinas que desaceleram tudo.', skill:{ name:'Teia Cristalina', cd:8, eff:[{ k:'dmg', m:.6, to:'all' }, { k:'st', s:'slow', d:5, v:.45, ch:1, to:'all' }] } }),
    wisp_ice:     E({ name:'Espírito Boreal', sprite:'wisp_ice', el:'Gelo', role:'Conjurador', hp:800, atk:96, def:30, spd:1.05, dodge:.12, desc:'A aurora drena a energia das ultimates.', skill:{ name:'Aurora Gélida', cd:8, eff:[{ k:'dmg', m:1.0, to:'randEach', hits:2 }, { k:'nrg', v:-10, to:'all' }] } }),
    golem_ice:    E({ name:'Golem Glacial', sprite:'golem_ice', el:'Água', role:'Tanque', hp:1850, atk:66, def:105, spd:.6, thorns:.1, desc:'Couraça de gelo que fere quem golpeia.', skill:{ name:'Couraça de Gelo', cd:10, eff:[{ k:'buff', s:'def', v:.4, d:6, to:'self' }, { k:'taunt', d:3 }] } }),
    oni_frost:    E({ name:'Oni da Avalanche', sprite:'oni_frost', el:'Gelo', role:'Guardião', elite:true, hp:4400, atk:128, def:80, spd:.8, xp:85, gold:[60, 90], desc:'Soterra a linha de frente.', skill:{ name:'Avalanche', cd:9, eff:[{ k:'dmg', m:1.4, to:'all' }, { k:'st', s:'stun', d:.9, ch:1, to:'front' }] } }),
    revenant_frost:E({ name:'Rainha do Inverno', sprite:'revenant_frost', el:'Gelo', role:'Guardiã', elite:true, hp:3900, atk:132, def:70, spd:.9, xp:85, gold:[60, 90], desc:'Congela o herói mais forte com um beijo.', skill:{ name:'Beijo Congelante', cd:9, eff:[{ k:'st', s:'freeze', d:2.5, ch:1, to:'high' }, { k:'st', s:'mark', d:6, v:.2, ch:1, to:'high' }, { k:'dmg', m:1.2, to:'high' }] } }),

    // Forja Abissal, metal vivo e magma (fracos contra Água e Natureza).
    spider_lava:  E({ name:'Aranha de Magma', sprite:'spider_lava', el:'Fogo', role:'Venenosa', hp:980, atk:90, spd:1.0, desc:'Mordida que derrete armaduras.', skill:{ name:'Mordida Derretida', cd:8, eff:[{ k:'dmg', m:1.4, to:'tgt' }, { k:'st', s:'burn', d:5, v:.3, ch:1, to:'tgt' }, { k:'st', s:'armorBreak', d:5, v:.15, ch:1, to:'tgt' }] } }),
    wisp_lava:    E({ name:'Faísca da Forja', sprite:'wisp_lava', el:'Fogo', role:'Conjurador', hp:780, atk:100, def:28, spd:1.1, dodge:.1, desc:'Uma chuva de faíscas por todo o campo.', skill:{ name:'Chuva de Faíscas', cd:7, eff:[{ k:'dmg', m:.45, to:'randEach', hits:4 }, { k:'st', s:'burn', d:4, v:.2, ch:.5, to:'rand' }] } }),
    fox_fire:     E({ name:'Raposa Brasa', sprite:'fox_fire', el:'Fogo', role:'Ágil', hp:880, atk:96, spd:1.2, dodge:.16, desc:'Deixa um rastro ardente na retaguarda.', skill:{ name:'Rastro Ardente', cd:7, eff:[{ k:'dmg', m:1.1, to:'back' }, { k:'st', s:'burn', d:5, v:.35, ch:1, to:'back' }] } }),
    revenant_ash: E({ name:'Ferreiro de Cinzas', sprite:'revenant_ash', el:'Terra', role:'Lutador', hp:1300, atk:98, def:60, spd:.85, desc:'Cada martelada o deixa mais forte.', skill:{ name:'Martelada Incandescente', cd:8, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'buff', s:'atk', v:.15, d:12, to:'self', stack:3 }] } }),
    oni_lava:     E({ name:'Oni Fundidor', sprite:'oni_lava', el:'Fogo', role:'Guardião', elite:true, hp:4700, atk:135, def:85, spd:.8, xp:90, gold:[65, 95], desc:'Despeja metal derretido sobre todos.', skill:{ name:'Metal Derretido', cd:9, eff:[{ k:'dmg', m:1.3, to:'all' }, { k:'st', s:'burn', d:5, v:.35, ch:1, to:'all' }] } }),
    golem_iron:   E({ name:'Autômato de Ferro', sprite:'golem_iron', el:'Terra', role:'Guardião', elite:true, hp:5400, atk:105, def:130, spd:.6, thorns:.15, xp:90, gold:[65, 95], desc:'Blindagem que protege toda a forja.', skill:{ name:'Blindagem Total', cd:10, eff:[{ k:'shield', m:2.0, to:'allies', d:6 }, { k:'buff', s:'dr', v:.25, d:5, to:'allies' }] } }),
    golem_forge:  E({ name:'Coração da Forja', sprite:'golem_forge', el:'Fogo', role:'Chefe de Andar', elite:true, miniboss:true, hp:12500, atk:140, def:110, spd:.65, xp:230, gold:[180, 250], desc:'Chefe da Forja. A Fornalha Primordial incendeia a equipe inteira.', skill:{ name:'Bigorna', cd:7, eff:[{ k:'dmg', m:2.0, to:'tgt' }, { k:'st', s:'stun', d:1, ch:.5, to:'tgt' }] },
      specials:[{ name:'Fornalha Primordial', cd:16, windup:2.6, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'burn', d:6, v:.45, ch:1, to:'all' }] }] }),

    // Areias do Tempo, deserto antigo (fracos contra Água, Natureza e Vento).
    fox_sand:     E({ name:'Chacal das Dunas', sprite:'fox_sand', el:'Terra', role:'Ágil', hp:900, atk:98, spd:1.2, dodge:.16, desc:'Some na areia e salta na retaguarda.', skill:{ name:'Emboscada de Areia', cd:7, eff:[{ k:'dmg', m:1.7, to:'back' }, { k:'buff', s:'stealth', v:1, d:2, to:'self' }] } }),
    spider_sand:  E({ name:'Escorpião Dourado', sprite:'spider_sand', el:'Terra', role:'Venenosa', hp:1000, atk:88, spd:1.0, desc:'Ferrão real: veneno e fraqueza.', skill:{ name:'Ferrão Real', cd:8, eff:[{ k:'dmg', m:1.2, to:'tgt' }, { k:'st', s:'poison', d:6, v:.25, ch:1, to:'tgt' }, { k:'st', s:'weaken', d:5, v:.15, ch:1, to:'tgt' }] } }),
    wisp_sand:    E({ name:'Miragem', sprite:'wisp_sand', el:'Vento', role:'Conjurador', hp:800, atk:102, def:30, spd:1.1, dodge:.2, desc:'Ilusões que silenciam e confundem.', skill:{ name:'Ilusão Escaldante', cd:8, eff:[{ k:'st', s:'silence', d:2, ch:.7, to:'rand' }, { k:'dmg', m:1.1, to:'rand' }, { k:'buff', s:'dodge', v:.25, d:4, to:'self' }] } }),
    oni_sand:     E({ name:'Guerreiro de Areia', sprite:'oni_sand', el:'Terra', role:'Brutamontes', hp:1400, atk:100, def:65, spd:.75, desc:'Tempestades de areia que cegam a equipe.', skill:{ name:'Tempestade de Areia', cd:9, eff:[{ k:'dmg', m:1.0, to:'all' }, { k:'st', s:'slow', d:4, v:.3, ch:1, to:'all' }] } }),
    golem_sand:   E({ name:'Esfinge de Pedra', sprite:'golem_sand', el:'Terra', role:'Guardiã', elite:true, hp:5600, atk:115, def:135, spd:.6, xp:100, gold:[75, 110], desc:'Propõe um enigma: quem erra, fica paralisado.', skill:{ name:'Enigma da Esfinge', cd:10, eff:[{ k:'st', s:'stun', d:2, ch:1, to:'high' }, { k:'shield', m:1.6, to:'allies', d:6 }] } }),
    revenant_mummy:E({ name:'Múmia Real', sprite:'revenant_mummy', el:'Sombra', role:'Guardião', elite:true, hp:4900, atk:138, def:85, spd:.85, xp:100, gold:[75, 110], desc:'Bandagens malditas enfraquecem e curam o faraó.', skill:{ name:'Bandagens Malditas', cd:9, eff:[{ k:'dmg', m:1.3, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }, { k:'heal', p:.08, to:'self' }] } }),

    // Cidade Fantasma, almas presas (fracas contra Luz).
    fox_ghost:    E({ name:'Raposa Fantasma', sprite:'fox_ghost', el:'Sombra', role:'Ágil', hp:880, atk:104, spd:1.25, dodge:.2, desc:'Atravessa escudos para morder os feridos.', skill:{ name:'Travessia Espectral', cd:7, eff:[{ k:'dmg', m:1.6, to:'low', pierce:.3 }, { k:'buff', s:'stealth', v:1, d:1.5, to:'self' }] } }),
    wisp_ghost:   E({ name:'Lamento', sprite:'wisp_ghost', el:'Sombra', role:'Conjurador', hp:820, atk:100, def:30, spd:1.05, dodge:.12, desc:'Um grito que emudece heróis.', skill:{ name:'Grito Fantasmagórico', cd:8, eff:[{ k:'dmg', m:.8, to:'all' }, { k:'st', s:'silence', d:1.5, ch:.35, to:'all' }] } }),
    spider_ghost: E({ name:'Aranha Etérea', sprite:'spider_ghost', el:'Sombra', role:'Venenosa', hp:1000, atk:94, spd:1.0, desc:'Teia que suga a alma.', skill:{ name:'Teia de Almas', cd:8, eff:[{ k:'dmg', m:1.4, to:'tgt' }, { k:'drain', v:.6 }, { k:'st', s:'mark', d:5, v:.15, ch:1, to:'tgt' }] } }),
    oni_ghost:    E({ name:'Oni Espectral', sprite:'oni_ghost', el:'Sombra', role:'Brutamontes', hp:1450, atk:108, def:70, spd:.75, desc:'Cada golpe esvazia a energia do alvo.', skill:{ name:'Clava do Além', cd:8, eff:[{ k:'dmg', m:2.0, to:'tgt' }, { k:'nrg', v:-20, to:'tgt' }] } }),
    golem_ghost:  E({ name:'Sentinela Assombrada', sprite:'golem_ghost', el:'Sombra', role:'Guardiã', elite:true, hp:6000, atk:110, def:140, spd:.6, thorns:.18, xp:105, gold:[80, 115], desc:'Vigília eterna: provoca e devolve dano.', skill:{ name:'Vigília Eterna', cd:10, eff:[{ k:'shield', m:2.0, to:'self', d:6 }, { k:'taunt', d:4 }] } }),
    revenant_ghost:E({ name:'Noiva Espectral', sprite:'revenant_ghost', el:'Luz', role:'Guardiã', elite:true, hp:4800, atk:142, def:80, spd:.95, xp:105, gold:[80, 115], desc:'Uma valsa mortal que marca toda a equipe.', skill:{ name:'Valsa Mortal', cd:9, eff:[{ k:'dmg', m:.7, to:'randEach', hits:4 }, { k:'st', s:'mark', d:6, v:.2, ch:1, to:'all' }] } }),

    // Torre do Relógio, o tempo quebrado (fracos contra Terra e Gelo).
    fox_time:     E({ name:'Raposa Temporal', sprite:'fox_time', el:'Raio', role:'Ágil', hp:900, atk:106, spd:1.25, dodge:.18, desc:'Ataca duas vezes no mesmo instante.', skill:{ name:'Salto no Tempo', cd:7, eff:[{ k:'dmg', m:1.3, to:'tgt', hits:2 }, { k:'buff', s:'spd', v:.3, d:5, to:'self' }] } }),
    wisp_time:    E({ name:'Engrenagem Viva', sprite:'wisp_time', el:'Raio', role:'Conjurador', hp:840, atk:104, def:32, spd:1.1, dodge:.1, desc:'Rouba o tempo, e a energia, dos heróis.', skill:{ name:'Faísca Cronal', cd:8, eff:[{ k:'nrg', v:-30, to:'rand' }, { k:'dmg', m:1.2, to:'rand' }] } }),
    spider_clock: E({ name:'Aranha de Corda', sprite:'spider_clock', el:'Vento', role:'Venenosa', hp:1050, atk:92, spd:1.0, desc:'Engrenagens que desmontam armaduras.', skill:{ name:'Mecanismo Serrilhado', cd:8, eff:[{ k:'dmg', m:.6, to:'all' }, { k:'st', s:'armorBreak', d:5, v:.2, ch:.7, to:'all' }] } }),
    oni_time:     E({ name:'Oni do Pêndulo', sprite:'oni_time', el:'Vento', role:'Brutamontes', hp:1500, atk:112, def:72, spd:.75, desc:'Um pêndulo gigante varre a linha de frente.', skill:{ name:'Pêndulo', cd:9, eff:[{ k:'dmg', m:2.2, to:'front' }, { k:'st', s:'stun', d:1, ch:.4, to:'front' }] } }),
    revenant_time:E({ name:'Relojoeiro Louco', sprite:'revenant_time', el:'Raio', role:'Guardião', elite:true, hp:5000, atk:140, def:85, spd:.95, xp:110, gold:[85, 120], desc:'Acelera o tempo dos aliados.', skill:{ name:'Acelerar', cd:10, eff:[{ k:'buff', s:'spd', v:.4, d:6, to:'allies' }, { k:'cdr', v:3, to:'allies' }, { k:'dmg', m:1.2, to:'tgt' }] } }),
    revenant_chrono:E({ name:'Guardião do Tempo', sprite:'revenant_chrono', el:'Vento', role:'Guardião', elite:true, hp:5400, atk:136, def:95, spd:.85, xp:110, gold:[85, 120], desc:'Cria paradoxos que congelam o instante.', skill:{ name:'Paradoxo', cd:10, eff:[{ k:'st', s:'stun', d:1.5, ch:.5, to:'all' }, { k:'dmg', m:1.0, to:'all' }] } }),
    golem_clock:  E({ name:'Colosso do Relógio', sprite:'golem_clock', el:'Raio', role:'Chefe de Andar', elite:true, miniboss:true, hp:14000, atk:150, def:120, spd:.7, xp:260, gold:[200, 280], desc:'Chefe da Torre. À Meia-Noite, atordoa todos os heróis.', skill:{ name:'Tique-Taque', cd:7, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'slow', d:5, v:.3, ch:1, to:'tgt' }] },
      specials:[{ name:'Meia-Noite', cd:18, windup:3.0, eff:[{ k:'dmg', m:2.6, to:'all' }, { k:'st', s:'stun', d:1.5, ch:1, to:'all' }] }] }),

    // Ilhas Flutuantes, o céu partido (fracos contra Terra e Gelo).
    fox_cloud:    E({ name:'Raposa das Nuvens', sprite:'fox_cloud', el:'Vento', role:'Ágil', hp:950, atk:112, spd:1.3, dodge:.2, desc:'Corre sobre as nuvens e ataca de cima.', skill:{ name:'Mergulho Celeste', cd:7, eff:[{ k:'dmg', m:1.8, to:'back' }, { k:'buff', s:'dodge', v:.2, d:3, to:'self' }] } }),
    wisp_storm:   E({ name:'Centelha Celeste', sprite:'wisp_storm', el:'Raio', role:'Conjurador', hp:860, atk:114, def:34, spd:1.1, dodge:.12, desc:'Descarga que salta de herói em herói.', skill:{ name:'Arco Voltaico', cd:8, eff:[{ k:'chain', m:1.2, n:3, fall:.8 }, { k:'st', s:'stun', d:.8, ch:.3, to:'rand' }] } }),
    spider_wind:  E({ name:'Aranha dos Ventos', sprite:'spider_wind', el:'Vento', role:'Venenosa', hp:1080, atk:100, spd:1.05, desc:'Fios de vento que cortam a armadura.', skill:{ name:'Seda Cortante', cd:8, eff:[{ k:'dmg', m:1.3, to:'tgt' }, { k:'st', s:'bleed', d:6, v:.25, ch:1, to:'tgt' }, { k:'st', s:'armorBreak', d:5, v:.2, ch:1, to:'tgt' }] } }),
    oni_thunder:  E({ name:'Oni do Trovão', sprite:'oni_thunder', el:'Raio', role:'Brutamontes', hp:1600, atk:120, def:78, spd:.75, desc:'Toca o tambor do céu e atordoa a linha de frente.', skill:{ name:'Tambor Trovejante', cd:9, eff:[{ k:'dmg', m:1.9, to:'front' }, { k:'st', s:'stun', d:1, ch:.45, to:'front' }] } }),
    golem_sky:    E({ name:'Colosso Alado', sprite:'golem_sky', el:'Terra', role:'Guardião', elite:true, hp:6600, atk:124, def:150, spd:.6, xp:118, gold:[90, 130], desc:'Pedra que voa. Protege a matilha com asas de granito.', skill:{ name:'Asas de Granito', cd:10, eff:[{ k:'shield', m:2.1, to:'allies', d:6 }, { k:'dmg', m:.9, to:'all' }] } }),
    revenant_sky: E({ name:'Tengu Ancião', sprite:'revenant_sky', el:'Vento', role:'Guardião', elite:true, hp:5600, atk:150, def:92, spd:1.0, xp:118, gold:[90, 130], desc:'O leque do Tengu atrasa a vez dos heróis.', skill:{ name:'Leque do Tengu', cd:9, eff:[{ k:'dmg', m:1.2, to:'all' }, { k:'delay', v:2, to:'all' }, { k:'buff', s:'spd', v:.3, d:5, to:'allies' }] } }),

    // Vale das Cerejeiras Eternas (fracos contra Fogo e Sombra).
    fox_sakura:   E({ name:'Kitsune Rosada', sprite:'fox_sakura', el:'Luz', role:'Ágil', hp:1000, atk:116, spd:1.3, dodge:.22, desc:'Encanta o herói mais forte com pétalas.', skill:{ name:'Encanto de Pétalas', cd:8, eff:[{ k:'st', s:'stun', d:1.2, ch:.6, to:'high' }, { k:'dmg', m:1.5, to:'high' }] } }),
    wisp_petal:   E({ name:'Espírito da Pétala', sprite:'wisp_petal', el:'Natureza', role:'Conjurador', hp:900, atk:110, def:36, spd:1.1, dodge:.14, desc:'Cura os aliados com a chuva de flores.', skill:{ name:'Chuva de Flores', cd:8, eff:[{ k:'heal', p:.1, to:'allies' }, { k:'dmg', m:.9, to:'rand' }] } }),
    spider_silk:  E({ name:'Tecelã de Seda', sprite:'spider_silk', el:'Natureza', role:'Venenosa', hp:1120, atk:104, spd:1.0, desc:'Casulos que prendem e envenenam.', skill:{ name:'Casulo de Seda', cd:8, eff:[{ k:'st', s:'slow', d:5, v:.45, ch:1, to:'tgt' }, { k:'st', s:'poison', d:6, v:.28, ch:1, to:'tgt' }, { k:'dmg', m:1.1, to:'tgt' }] } }),
    oni_blossom:  E({ name:'Oni Florido', sprite:'oni_blossom', el:'Natureza', role:'Brutamontes', hp:1700, atk:122, def:80, spd:.75, desc:'Quanto mais apanha, mais floresce.', skill:{ name:'Floração Brutal', cd:9, eff:[{ k:'dmg', m:2.1, to:'tgt' }, { k:'heal', p:.08, to:'self' }, { k:'buff', s:'atk', v:.25, d:6, to:'self' }] } }),
    golem_root:   E({ name:'Guardião de Raízes', sprite:'golem_root', el:'Natureza', role:'Guardião', elite:true, hp:7000, atk:126, def:155, spd:.6, thorns:.16, xp:122, gold:[95, 135], desc:'Raízes que provocam e regeneram.', skill:{ name:'Enraizar', cd:10, eff:[{ k:'taunt', d:4 }, { k:'buff', s:'regen', v:.03, d:6, to:'self' }] } }),
    revenant_geisha:E({ name:'Dama das Flores', sprite:'revenant_geisha', el:'Luz', role:'Guardiã', elite:true, hp:5700, atk:152, def:90, spd:1.0, xp:122, gold:[95, 135], desc:'Quatro passos de dança, e a equipe emudece.', skill:{ name:'Dança do Hanami', cd:9, eff:[{ k:'dmg', m:.8, to:'randEach', hits:4 }, { k:'st', s:'silence', d:1.5, ch:.4, to:'all' }] } }),

    // Santuário das Nuvens (fracos contra Terra e Sombra).
    fox_lightning:E({ name:'Raiju', sprite:'fox_lightning', el:'Raio', role:'Ágil', hp:1000, atk:120, spd:1.35, dodge:.18, desc:'A fera do relâmpago: dois golpes num piscar.', skill:{ name:'Garras de Raio', cd:7, eff:[{ k:'dmg', m:1.3, to:'low', hits:2 }, { k:'st', s:'stun', d:.6, ch:.3, to:'low' }] } }),
    wisp_cloud:   E({ name:'Névoa Sagrada', sprite:'wisp_cloud', el:'Luz', role:'Conjurador', hp:920, atk:116, def:38, spd:1.1, dodge:.16, desc:'Esconde os aliados na névoa.', skill:{ name:'Véu de Névoa', cd:9, eff:[{ k:'buff', s:'dodge', v:.25, d:6, to:'allies' }, { k:'dmg', m:1.0, to:'rand' }] } }),
    spider_thunder:E({ name:'Aranha Trovejante', sprite:'spider_thunder', el:'Raio', role:'Venenosa', hp:1150, atk:108, spd:1.0, desc:'Teia elétrica que drena energia.', skill:{ name:'Teia Elétrica', cd:8, eff:[{ k:'dmg', m:.7, to:'all' }, { k:'nrg', v:-15, to:'all' }] } }),
    oni_wind:     E({ name:'Oni do Vendaval', sprite:'oni_wind', el:'Vento', role:'Brutamontes', hp:1750, atk:126, def:82, spd:.8, desc:'Um sopro que joga a retaguarda longe.', skill:{ name:'Sopro do Vendaval', cd:9, eff:[{ k:'dmg', m:1.6, to:'back' }, { k:'delay', v:1.5, to:'back' }] } }),
    revenant_monk:E({ name:'Monge da Tempestade', sprite:'revenant_monk', el:'Raio', role:'Guardião', elite:true, hp:6000, atk:156, def:96, spd:.95, xp:128, gold:[100, 140], desc:'Medita no olho da tempestade e acelera os aliados.', skill:{ name:'Mantra Elétrico', cd:10, eff:[{ k:'cdr', v:3, to:'allies' }, { k:'buff', s:'atk', v:.25, d:6, to:'allies' }, { k:'dmg', m:1.2, to:'tgt' }] } }),
    golem_bell:   E({ name:'Sino Colossal', sprite:'golem_bell', el:'Terra', role:'Guardião', elite:true, hp:7400, atk:128, def:165, spd:.55, xp:128, gold:[100, 140], desc:'Cada badalada atordoa quem estiver perto.', skill:{ name:'Badalada', cd:10, eff:[{ k:'dmg', m:1.0, to:'all' }, { k:'st', s:'stun', d:1.2, ch:.35, to:'all' }] } }),
    golem_fujin:  E({ name:'Fujin, Senhor dos Ventos', sprite:'golem_fujin', el:'Vento', role:'Chefe de Andar', elite:true, miniboss:true, hp:17000, atk:165, def:130, spd:.75, xp:290, gold:[220, 300], desc:'Chefe do Santuário. O Saco dos Ventos arremessa a equipe inteira.', skill:{ name:'Rajada Divina', cd:7, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'slow', d:5, v:.3, ch:1, to:'tgt' }] },
      specials:[{ name:'Saco dos Ventos', cd:17, windup:2.8, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'delay', v:2.5, to:'all' }] }] }),

    // Fenda Abissal, criaturas do vazio entre mundos (fracas contra Luz).
    rift_hound:   E({ name:'Cão do Vazio', sprite:'rift_hound', el:'Sombra', role:'Ágil', hp:900, atk:100, spd:1.25, dodge:.16, desc:'Caça em matilha e morde quem está enfraquecido.', skill:{ name:'Mordida Entre Mundos', cd:7, eff:[{ k:'dmg', m:1.6, to:'low' }, { k:'st', s:'weaken', d:4, v:.15, ch:1, to:'low' }] } }),
    rift_weaver:  E({ name:'Tecelã do Abismo', sprite:'rift_weaver', el:'Sombra', role:'Venenosa', hp:980, atk:92, spd:1.0, desc:'Tece fios de vazio que prendem a retaguarda.', skill:{ name:'Fio do Vazio', cd:8, eff:[{ k:'dmg', m:1.1, to:'back' }, { k:'st', s:'slow', d:5, v:.4, ch:1, to:'back' }, { k:'st', s:'poison', d:5, v:.18, ch:1, to:'back' }] } }),
    rift_eye:     E({ name:'Olho da Fenda', sprite:'rift_eye', el:'Luz', role:'Conjurador', hp:820, atk:104, def:30, spd:1.05, dodge:.12, desc:'Vê o futuro: marca e atrasa as habilidades dos heróis.', skill:{ name:'Olhar do Amanhã', cd:8, eff:[{ k:'st', s:'mark', d:5, v:.2, ch:1, to:'high' }, { k:'nrg', v:-20, to:'high' }, { k:'dmg', m:1.0, to:'high' }] } }),
    rift_devourer:E({ name:'Devorador de Mundos', sprite:'rift_devourer', el:'Sombra', role:'Brutamontes', hp:1500, atk:110, def:70, spd:.75, desc:'Engole escudos inteiros.', skill:{ name:'Mordida Dimensional', cd:9, eff:[{ k:'dispel', to:'tgt' }, { k:'dmg', m:2.0, to:'tgt' }] } }),
    rift_colossus:E({ name:'Colosso Estilhaçado', sprite:'rift_colossus', el:'Terra', role:'Guardião', elite:true, hp:6200, atk:118, def:140, spd:.6, thorns:.15, xp:110, gold:[80, 120], desc:'Pedaços de mundos mortos. Protege a matilha.', skill:{ name:'Fragmentos', cd:10, eff:[{ k:'shield', m:2.0, to:'allies', d:6 }, { k:'dmg', m:.8, to:'all' }] } }),
    rift_herald:  E({ name:'Arauto do Vazio', sprite:'rift_herald', el:'Sombra', role:'Guardião', elite:true, hp:5200, atk:142, def:85, spd:.9, xp:110, gold:[80, 120], desc:'Anuncia a chegada de algo maior. Acelera os outros.', skill:{ name:'Proclamação', cd:10, eff:[{ k:'buff', s:'spd', v:.35, d:6, to:'allies' }, { k:'st', s:'silence', d:2, ch:.6, to:'all' }] } }),
    rift_wyrm:    E({ name:'Wyrm da Fenda', sprite:'rift_wyrm', el:'Sombra', role:'Chefe de Andar', elite:true, miniboss:true, hp:15000, atk:150, def:120, spd:.75, xp:260, gold:[200, 280], desc:'Guardião a cada 5 andares da Fenda. Seu Colapso atinge todos.', skill:{ name:'Sopro do Vazio', cd:7, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'st', s:'weaken', d:5, v:.2, ch:1, to:'tgt' }] },
      specials:[{ name:'Colapso Dimensional', cd:17, windup:2.6, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'dispel', to:'all' }] }] }),

    // Invocações dos chefes (exclusivas de cada chefe).
    eclipse_shade:E({ name:'Sombra Lunar', sprite:'eclipse_shade', el:'Sombra', role:'Ágil', hp:1400, atk:110, spd:1.2, dodge:.2, desc:'Criada por Shirogane a partir da lua devorada.', skill:{ name:'Lâmina Minguante', cd:8, eff:[{ k:'dmg', m:1.5, to:'back' }, { k:'st', s:'bleed', d:4, v:.25, ch:1, to:'back' }] } }),
    mizuchi_spawn:E({ name:'Cria de Mizuchi', sprite:'mizuchi_spawn', el:'Água', role:'Lutador', hp:1500, atk:112, def:60, spd:.9, lifesteal:.2, desc:'Filhotes do dragão. Curam o aliado mais ferido.', skill:{ name:'Jato Abissal', cd:8, eff:[{ k:'dmg', m:1.4, to:'rand' }, { k:'heal', p:.03, to:'lowAlly' }] } }),
    sand_servant: E({ name:'Servo de Âmbar', sprite:'sand_servant', el:'Terra', role:'Brutamontes', hp:1700, atk:118, def:80, spd:.75, desc:'Guerreiro moldado pela Serpente com areia do tempo.', skill:{ name:'Grilhão do Tempo', cd:9, eff:[{ k:'dmg', m:1.5, to:'front' }, { k:'delay', v:2, to:'front' }] } }),
    storm_servant:E({ name:'Arauto do Tambor', sprite:'storm_servant', el:'Raio', role:'Brutamontes', hp:1800, atk:124, def:82, spd:.8, desc:'Servo de Raijin: carrega o trovão até os heróis.', skill:{ name:'Batida do Céu', cd:9, eff:[{ k:'dmg', m:1.5, to:'all' }, { k:'nrg', v:-10, to:'all' }] } }),
    archive_sentinel:E({ name:'Bibliotecária Espectral', sprite:'archive_sentinel', el:'Luz', role:'Guardiã', elite:true, hp:3000, atk:118, spd:1.0, dodge:.15, xp:90, gold:[65, 95], desc:'Protege os livros proibidos silenciando quem os lê.', skill:{ name:'Silêncio na Biblioteca', cd:9, eff:[{ k:'st', s:'silence', d:3, ch:1, to:'back' }, { k:'dmg', m:1.4, to:'back' }] } }),

    // Invasões Mundiais: chefes cooperativos (a vida deles é compartilhada por todos os jogadores).
    wb_titan:     E({ name:'Titã de Obsidiana', sprite:'wb_titan', el:'Terra', role:'Chefe Mundial', boss:true, worldBoss:true, hp:2400000, atk:170, def:160, spd:.7, crit:.08, xp:0, gold:[0, 0], enrage:60,
      desc:'Uma montanha que anda. Esmaga a linha de frente e fica mais forte a cada fase.',
      skill:{ name:'Punho Tectônico', cd:6, eff:[{ k:'dmg', m:2.2, to:'front' }, { k:'st', s:'armorBreak', d:6, v:.3, ch:1, to:'front' }] },
      phases:[
        { at:1, text:'Tremores', specials:[{ name:'Terremoto', cd:15, windup:2.6, eff:[{ k:'dmg', m:2.0, to:'all' }, { k:'st', s:'stun', d:1, ch:1, to:'all' }] }] },
        { at:.9, text:'Pele de obsidiana', buff:{ atk:.2 }, specials:[{ name:'Terremoto', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'stun', d:1.2, ch:1, to:'all' }] }] },
        { at:.8, text:'Coração de magma', buff:{ spd:.3, atk:.2 }, specials:[{ name:'Erupção Interior', cd:10, windup:2.0, eff:[{ k:'dmg', m:2.6, to:'all' }, { k:'st', s:'burn', d:6, v:.5, ch:1, to:'all' }] }] }
      ] }),
    wb_frost_dragon:E({ name:'Glacius, o Dragão Invernal', sprite:'wb_frost_dragon', el:'Gelo', role:'Chefe Mundial', boss:true, worldBoss:true, hp:2200000, atk:180, def:140, spd:.8, crit:.1, xp:0, gold:[0, 0], enrage:60,
      desc:'Inverno com asas. Seu sopro congela a retaguarda.',
      skill:{ name:'Garra Glacial', cd:6, eff:[{ k:'dmg', m:2.0, to:'tgt' }, { k:'st', s:'freeze', d:1.5, ch:.5, to:'tgt' }] },
      phases:[
        { at:1, text:'Vento gelado', specials:[{ name:'Sopro Invernal', cd:14, windup:2.4, eff:[{ k:'dmg', m:2.4, to:'back' }, { k:'st', s:'freeze', d:2, ch:1, to:'back' }] }] },
        { at:.9, text:'Nevasca', buff:{ spd:.25 }, specials:[{ name:'Nevasca', cd:12, windup:2.4, eff:[{ k:'dmg', m:1.8, to:'all' }, { k:'st', s:'slow', d:6, v:.5, ch:1, to:'all' }] }] },
        { at:.8, text:'Zero absoluto', buff:{ atk:.3 }, specials:[{ name:'Zero Absoluto', cd:11, windup:2.2, eff:[{ k:'dmg', m:2.8, to:'all' }, { k:'st', s:'freeze', d:1.5, ch:1, to:'all' }] }] }
      ] }),
    wb_storm_kitsune:E({ name:'Raijin-Kitsune', sprite:'wb_storm_kitsune', el:'Raio', role:'Chefe Mundial', boss:true, worldBoss:true, hp:2000000, atk:175, def:120, spd:1.0, crit:.14, dodge:.15, xp:0, gold:[0, 0], enrage:60,
      desc:'Relâmpagos em cadeia e ilusões que silenciam.',
      skill:{ name:'Cauda de Trovão', cd:5, eff:[{ k:'dmg', m:1.0, to:'randEach', hits:3 }, { k:'nrg', v:-15, to:'rand' }] },
      phases:[
        { at:1, text:'Tempestade', specials:[{ name:'Mil Relâmpagos', cd:14, windup:2.4, eff:[{ k:'dmg', m:.7, to:'randEach', hits:6 }, { k:'st', s:'stun', d:.8, ch:.4, to:'all' }] }] },
        { at:.9, text:'Ilusões', buff:{ dodge:.15 }, specials:[{ name:'Encanto Elétrico', cd:12, windup:1.6, eff:[{ k:'st', s:'silence', d:3, ch:1, to:'all' }, { k:'dmg', m:1.6, to:'all' }] }] },
        { at:.8, text:'Olho do furacão', buff:{ spd:.35, atk:.2 }, specials:[{ name:'Mil Relâmpagos', cd:10, windup:2.0, eff:[{ k:'dmg', m:.9, to:'randEach', hits:7 }, { k:'st', s:'stun', d:1, ch:.5, to:'all' }] }] }
      ] }),
    wb_blood_moon:E({ name:'Lua Sangrenta, Rainha do Eclipse', sprite:'wb_blood_moon', el:'Sombra', role:'Chefe Mundial', boss:true, worldBoss:true, hp:2600000, atk:190, def:150, spd:.85, crit:.12, xp:0, gold:[0, 0], enrage:60,
      desc:'A irmã de Shirogane. Rouba vida e marca a equipe inteira.',
      skill:{ name:'Beijo Rubro', cd:6, eff:[{ k:'dmg', m:2.0, to:'high' }, { k:'drain', v:.5 }] },
      phases:[
        { at:1, text:'Lua cheia', specials:[{ name:'Maldição Rubra', cd:14, windup:2.4, eff:[{ k:'st', s:'mark', d:8, v:.3, ch:1, to:'all' }, { k:'dmg', m:1.8, to:'all' }] }] },
        { at:.9, text:'Sede', buff:{ atk:.2 }, specials:[{ name:'Maldição Rubra', cd:12, windup:2.2, eff:[{ k:'st', s:'mark', d:8, v:.35, ch:1, to:'all' }, { k:'dmg', m:2.0, to:'all' }] }] },
        { at:.8, text:'Eclipse sangrento', buff:{ atk:.3, spd:.2 }, specials:[{ name:'Eclipse Sangrento', cd:10, windup:2.2, eff:[{ k:'dmg', m:2.6, to:'all' }, { k:'st', s:'bleed', d:6, v:.5, ch:1, to:'all' }] }] }
      ] }),

    // Invocações de evento.
    wisp_ember:   E({ name:'Fogo-Fátuo do Festival', sprite:'wisp_ember', el:'Fogo', role:'Conjurador', hp:900, atk:100, def:30, spd:1.1, dodge:.1, desc:'Lanterna viva que explode em chamas.', skill:{ name:'Estouro de Lanterna', cd:8, eff:[{ k:'dmg', m:1.2, to:'all' }, { k:'st', s:'burn', d:4, v:.3, ch:.6, to:'all' }] } }),
    fox_gold:     E({ name:'Raposa Dourada', sprite:'fox_gold', el:'Luz', role:'Tesouro', hp:2400, atk:1, def:40, spd:.5, dodge:.35, xp:40, gold:[400, 600], treasure:true, desc:'Rara e rica. Foge depois de 12 segundos.' }),
    mimic:        E({ name:'Baú Mímico', sprite:'mimic', el:'Sombra', role:'Armadilha', elite:true, hp:3200, atk:120, def:70, spd:.9, xp:80, gold:[150, 250], desc:'Parecia um baú...', skill:{ name:'Mordida do Baú', cd:7, eff:[{ k:'dmg', m:2.2, to:'tgt' }, { k:'st', s:'bleed', d:5, v:.3, ch:1, to:'tgt' }] } }),

    // Chefes, mecânicas de fase, ataques telegrafados, invocações e fúria.
    boss:         E({ name:'Shirogane, Rei do Eclipse', sprite:'eclipse', el:'Sombra', role:'Chefe', boss:true, hp:90000, atk:150, def:110, spd:.8, crit:.1, xp:1400, gold:[1500, 2000], enrage:150,
      innate:{ heroDeathHeal:.04, text:'Coroa de Sombras: cada herói nocauteado cura 4% da vida de Shirogane. Mantenha a equipe viva: curas e escudos valem mais que dano.' }, desc:'Senhor do eclipse. Invoca Sombras Lunares, marca a retaguarda e lança o Eclipse Total: segure com escudos e curas.',
      skill:{ name:'Lâmina Lunar', cd:6, eff:[{ k:'dmg', m:2.0, to:'tgt' }, { k:'st', s:'bleed', d:5, v:.35, ch:1, to:'tgt' }] },
      phases:[
        { at:1,  text:'Selo intacto', specials:[{ name:'Eclipse Total', cd:18, windup:2.8, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }] }] },
        { at:.7, text:'Selo rompido: invoca Sombras Lunares', summon:{ id:'eclipse_shade', n:2, every:28 }, specials:[{ name:'Eclipse Total', cd:16, windup:2.6, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }] }, { name:'Marca da Lua Negra', cd:12, windup:1.2, eff:[{ k:'st', s:'mark', d:8, v:.4, ch:1, to:'back' }, { k:'dmg', m:2.8, to:'back' }] }] },
        { at:.35, text:'Fúria do Eclipse, ataques acelerados', buff:{ spd:.35, atk:.2 }, specials:[{ name:'Eclipse Total', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.6, to:'all' }, { k:'st', s:'weaken', d:6, v:.3, ch:1, to:'all' }] }, { name:'Marca da Lua Negra', cd:10, windup:1.2, eff:[{ k:'st', s:'mark', d:8, v:.4, ch:1, to:'back' }, { k:'dmg', m:3.0, to:'back' }] }] }
      ] }),
    boss_tide:    E({ name:'Mizuchi, Dragão Abissal', sprite:'dragon', el:'Água', role:'Chefe', boss:true, hp:180000, atk:175, def:130, spd:.8, crit:.1, xp:2600, gold:[2600, 3400], enrage:160,
      innate:{ reflect:.12, text:'Escamas da Maré: devolve 12% do dano de cada golpe direto a quem bateu (no máximo 0,5% da vida do herói por golpe, e nunca nocauteia). Dano contínuo (queimadura, veneno, sangramento) não é refletido.' }, desc:'O dragão das marés. Seu Tsunami atinge todos, sua Maré Curativa o regenera e, no fim, ele afoga a retaguarda.',
      skill:{ name:'Mordida Abissal', cd:6, eff:[{ k:'dmg', m:2.2, to:'tgt' }, { k:'st', s:'armorBreak', d:6, v:.3, ch:1, to:'tgt' }] },
      phases:[
        { at:1,  text:'Maré baixa', specials:[{ name:'Tsunami', cd:17, windup:2.8, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }] },
        { at:.65, text:'Maré alta: as crias emergem', summon:{ id:'mizuchi_spawn', n:2, every:25 }, heal:.06, specials:[{ name:'Tsunami', cd:15, windup:2.6, eff:[{ k:'dmg', m:2.3, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }, { name:'Maré Curativa', cd:20, windup:2, eff:[{ k:'heal', p:.05, to:'self' }, { k:'shield', p:.06, to:'self', d:8 }] }] },
        { at:.3, text:'Redemoinho, o abismo desperta', buff:{ spd:.3, atk:.25 }, specials:[{ name:'Tsunami', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }, { name:'Afogamento', cd:11, windup:1.4, eff:[{ k:'dmg', m:3.2, to:'back' }, { k:'st', s:'stun', d:2, ch:1, to:'back' }] }] }
      ] }),
    boss_event:   E({ name:'Kitsune das Lanternas', sprite:'lantern_kitsune', el:'Fogo', role:'Chefe', boss:true, hp:120000, atk:165, def:115, spd:.9, crit:.12, dodge:.12, xp:2000, gold:[2000, 2800], enrage:150,
      innate:{ drPerSummon:.2, text:'Luz do Festival: cada lanterna viva reduz em 20% o dano que a Kitsune recebe (até 60%). Mate as lanternas primeiro: foque a equipe nelas.' }, desc:'Espírito do festival. Suas Nove Caudas incendeiam tudo. Lanternas vivas explodem pelo campo.',
      skill:{ name:'Fogo de Raposa', cd:6, eff:[{ k:'dmg', m:1.2, to:'randEach', hits:2 }, { k:'st', s:'burn', d:5, v:.4, ch:1, to:'rand' }] },
      phases:[
        { at:1, text:'Dança das lanternas', summon:{ id:'wisp_ember', n:2, every:26 }, specials:[{ name:'Nove Caudas', cd:17, windup:2.6, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'burn', d:6, v:.5, ch:1, to:'all' }] }] },
        { at:.6, text:'Ilusões, esquiva elevada', buff:{ dodge:.15 }, specials:[{ name:'Nove Caudas', cd:15, windup:2.4, eff:[{ k:'dmg', m:2.3, to:'all' }, { k:'st', s:'burn', d:6, v:.5, ch:1, to:'all' }] }, { name:'Encanto', cd:12, windup:1.2, eff:[{ k:'st', s:'stun', d:2.5, ch:1, to:'high' }, { k:'dmg', m:2.4, to:'high' }] }] },
        { at:.3, text:'Chama eterna', buff:{ spd:.3, atk:.2 }, specials:[{ name:'Nove Caudas', cd:11, windup:2.2, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'st', s:'burn', d:6, v:.6, ch:1, to:'all' }] }] }
      ] }),
    boss_sand:    E({ name:'Apep, Serpente do Tempo', sprite:'dragon_amber', el:'Terra', role:'Chefe', boss:true, weak:'Executor', hp:260000, atk:200, def:150, spd:.8, crit:.12, xp:4200, gold:[4200, 5400], enrage:170,
      innate:{ drain:{ every:16, min:60, nrg:60, atk:.12, max:5 }, text:'Devorador de Horas: a cada 16s rouba 60 de energia do herói mais carregado e ganha +12% de ATK (até 5×). Gaste as ultimates. Quebrar a postura dele apaga os acúmulos.' }, desc:'A serpente que devora as horas. Engole o herói mais forte, invoca guerreiros de areia e, no fim, quebra a Ampulheta.',
      skill:{ name:'Presas de Âmbar', cd:6, eff:[{ k:'dmg', m:2.2, to:'tgt' }, { k:'st', s:'poison', d:6, v:.3, ch:1, to:'tgt' }] },
      phases:[
        { at:1, text:'As areias correm', specials:[{ name:'Tempestade do Deserto', cd:17, windup:2.8, eff:[{ k:'dmg', m:2.3, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }] },
        { at:.66, text:'Servos de âmbar despertam', summon:{ id:'sand_servant', n:2, every:26 }, specials:[{ name:'Tempestade do Deserto', cd:15, windup:2.6, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }, { name:'Engolir o Tempo', cd:13, windup:1.6, eff:[{ k:'st', s:'stun', d:3, ch:1, to:'high' }, { k:'dmg', m:3.0, to:'high' }] }] },
        { at:.33, text:'A Ampulheta se quebra', buff:{ spd:.3, atk:.25 }, heal:.05, specials:[{ name:'Ampulheta Quebrada', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.8, to:'all' }, { k:'st', s:'weaken', d:6, v:.3, ch:1, to:'all' }] }, { name:'Engolir o Tempo', cd:11, windup:1.4, eff:[{ k:'st', s:'stun', d:3, ch:1, to:'high' }, { k:'dmg', m:3.2, to:'high' }] }] }
      ] }),
    boss_sky:     E({ name:'Raijin, o Tambor do Trovão', sprite:'raijin', el:'Raio', role:'Chefe', boss:true, weak:'Vanguarda', hp:215000, atk:208, def:150, spd:.85, crit:.14, xp:6400, gold:[6200, 7800], enrage:180,
      innate:{ immune:'Raio', absorb:.2, text:'Condutor Divino: imune a heróis de Raio, e 20% desse dano o cura. Monte a equipe sem Raio. Terra é o elemento forte contra ele.' }, desc:'O deus do trovão enlouquecido pelo eclipse. Toca os tambores do céu, invoca arautos e, no fim, faz chover raios sem parar.',
      skill:{ name:'Rufar dos Tambores', cd:6, eff:[{ k:'chain', m:1.6, n:4, fall:.8 }] },
      phases:[
        { at:1, text:'Os tambores despertam', specials:[{ name:'Trovão Divino', cd:16, windup:2.8, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'stun', d:1, ch:.5, to:'all' }] }] },
        { at:.66, text:'Arautos descem das nuvens', summon:{ id:'storm_servant', n:2, every:24 }, specials:[{ name:'Trovão Divino', cd:14, windup:2.6, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'st', s:'stun', d:1, ch:.5, to:'all' }] }, { name:'Relâmpago Certeiro', cd:12, windup:1.4, eff:[{ k:'dmg', m:3.2, to:'high', pierce:.4 }] }] },
        { at:.33, text:'Tempestade sem fim', buff:{ spd:.3, atk:.25 }, heal:.05, specials:[{ name:'Chuva de Raios', cd:11, windup:2.2, eff:[{ k:'dmg', m:.9, to:'randEach', hits:5 }, { k:'nrg', v:-25, to:'all' }] }, { name:'Relâmpago Certeiro', cd:10, windup:1.2, eff:[{ k:'dmg', m:3.3, to:'high', pierce:.4 }] }] }
      ] })
  };

  // Família de cada criatura (a base do desenho) e a classe de herói contra a qual ela é fraca: fraqueza tira
  // Resistência em dobro (ver TOUGH em src/engine.js). Um inimigo pode fixar a própria com `weak`.
  const FAMILY_FIX = { rift_colossus:'golem', mimic:'mimic', wb_titan:'golem', sand_servant:'oni', storm_servant:'oni', golem_fujin:'oni', rift_devourer:'oni', rift_hound:'fox',
    eclipse_shade:'fox', archive_sentinel:'revenant', rift_herald:'revenant', rift_weaver:'spider', rift_eye:'wisp', rift_wyrm:'dragon', mizuchi_spawn:'dragon', wb_frost_dragon:'dragon',
    wb_storm_kitsune:'fox', wb_blood_moon:'revenant', boss:'revenant', boss_tide:'dragon', boss_event:'fox', boss_sand:'dragon', boss_sky:'oni' };
  const familyOf = id => FAMILY_FIX[id] || String(id).split('_')[0];
  const FAMILY_WEAK = { golem:'Vanguarda', oni:'Executor', spider:'Atirador', fox:'Atirador', wisp:'Arcanista', dragon:'Arcanista', revenant:'Suporte', mimic:'Executor' };
  // Reações elementais: habilidade ou ultimate deixa no inimigo a marca do elemento do herói; um golpe de OUTRO elemento
  // consome a marca e dispara a reação do par. bonus/spread: fração do dano do golpe (no alvo / nos outros inimigos);
  // aoe: golpe extra em todos (× ATK); st/stAll: efeito no alvo / em todos [efeito, duração, valor]; heal: cura do
  // aliado mais ferido (fração do HP); nrg: energia para quem disparou; brk: Resistência tirada.
  const RX = (id, name, color, o) => ({ id, name, color, ...o });
  const REACTIONS = {
    'Fogo+Gelo':RX('melt', 'Derretimento', '#ffb07a', { bonus:.5 }),
    'Fogo+Água':RX('vapor', 'Vapor', '#cfe9ff', { bonus:.4 }),
    'Raio+Água':RX('shock', 'Eletrochoque', '#c9a4ff', { bonus:.15, st:['stun', 1], spread:.3 }),
    'Gelo+Raio':RX('supercond', 'Supercondução', '#b8d8ff', { bonus:.15, st:['armorBreak', 6, .3] }),
    'Fogo+Raio':RX('overload', 'Sobrecarga', '#ff8a5c', { aoe:.6 }),
    'Fogo+Vento':RX('wildfire', 'Incêndio', '#ff9a4f', { stAll:['burn', 5, .35] }),
    'Fogo+Natureza':RX('burnoff', 'Queimada', '#ff7a4f', { bonus:.15, st:['burn', 6, .7] }),
    'Gelo+Vento':RX('blizzard', 'Nevasca', '#bfefff', { stAll:['slow', 4, .35] }),
    'Gelo+Água':RX('frozen', 'Congelamento', '#91dfff', { st:['freeze', 1.5] }),
    'Natureza+Água':RX('bloom', 'Floração', '#7dffa8', { bonus:.1, heal:.08 }),
    'Natureza+Raio':RX('catalyze', 'Catálise', '#b6f27a', { bonus:.35, nrg:8 }),
    'Luz+Sombra':RX('eclipse', 'Eclipse', '#e7c9ff', { bonus:.2, st:['mark', 6, .2] })
  };
  const RX_EARTH = RX('shatter', 'Estilhaço', '#d8ad6a', { bonus:.1, brk:3 }), RX_WIND = RX('swirl', 'Redemoinho', '#9ce9cc', { spread:.4 }), RX_ANY = RX('resonance', 'Ressonância', '#ffe19a', { bonus:.25 });
  const reaction = (a, b) => (a === b ? null : REACTIONS[`${a}+${b}`] || REACTIONS[`${b}+${a}`] || (a === 'Terra' || b === 'Terra' ? RX_EARTH : a === 'Vento' || b === 'Vento' ? RX_WIND : RX_ANY));
  const reactionList = [...Object.entries(REACTIONS).map(([k, r]) => ({ ...r, pair:k.split('+') })), { ...RX_EARTH, pair:['Terra', 'qualquer outro'] }, { ...RX_WIND, pair:['Vento', 'os demais'] }, { ...RX_ANY, pair:['outros pares'] }];

  // Com a Quebra para todos (Resistência, dano de quebra, +35% de dano no inimigo quebrado, Assalto Total) e as reações
  // elementais, a equipe mata mais rápido do que quando os inimigos foram calibrados. Para o tempo de luta medido
  // continuar o mesmo (tools/balance.js), a vida do inimigo sobe nesta proporção. Inimigo comum (4 de Resistência) quebra
  // a cada dois ou três golpes e sofre mais com as reações em área; chefe (30) quebra poucas vezes por luta: por isso
  // a proporção é por tipo.
  const ENEMY_HP = { normal:1.85, elite:1.6, mini:1.45, boss:1.35, world:1.35 };

  // Variantes Alfa, versões raras e nomeadas de monstros comuns (mais fortes, melhor loot).
  const ALPHA = { chance:.012, hp:2.6, atk:1.5, prefix:'Alfa' };

  // ---------------------------------------------------------------------------
  // REGIÕES, caçadas têm estágios; dungeons têm andares; chefes têm dificuldade.
  // power(estágio) define o multiplicador de atributos dos inimigos. Nível do inimigo = 1 + ln(power)/ln(1,065):
  // Cap. I níveis 1–36 · Cap. II 36–62 · Cap. III 64–82 · Cap. IV 84–100 (o teto dos heróis). Antes os Capítulos III e IV
  // iam até o nível 151 e exigiam 260 milhões de poder: só dava para acompanhar com saltos enormes de poder.
  // growth: crescimento por estágio da caçada (padrão STAGE_GROWTH).
  // ---------------------------------------------------------------------------
  const STAGE_GROWTH = 1.2;
  // Força dos inimigos por NÍVEL. Até o 33 é a curva original (1,065 por nível). Depois, +5,6% por nível: é a força
  // em que uma equipe de referência no nível L (itens do mapa, refino, treino, qualidade) leva o mesmo tempo para
  // matar (~6 s por inimigo) e para morrer (~22 s) que no fim do Capítulo I, com a mitigação real de DEF do motor.
  // Validação por lutas: node tools/balance.js
  const LP33 = Math.pow(1.065, 32), LP_B = .062, LP_D = 0, LP_TAIL = LP_B;
  const levelPower = L => L <= 33 ? Math.pow(1.065, L - 1) : L <= 100 ? LP33 * Math.exp(LP_B * (L - 33) + LP_D * (L - 33) * (L - 33)) : levelPower(100) * Math.exp(LP_TAIL * (L - 100));
  // Inverso contínuo (nível de um inimigo a partir da força).
  // Ameaça dos inimigos de caçada/masmorra por nível (multiplica vida e ataque). A força dos heróis cresce mais
  // rápido que levelPower (itens, refino, talentos, cartas, laços): sem isto, uma equipe 10 níveis abaixo limpava
  // estágios "Muito difíceis" sem perder vida. Calibrado em combate real (tools/balance.js): para cada região mediu-se
  // o maior multiplicador que a equipe de referência do nível ainda vence 3/3 e usa-se 80% dele. Resultado: no
  // recomendado vence com folga; ~5 níveis abaixo ainda passa, apertado; 8+ níveis abaixo perde.
  // O Capítulo I começa suave (x1 no nível 1) para o jogador novo aprender sem muro.
  const THREAT = { hunt:[[1, 1], [10, 1.25], [20, 1.8], [33, 2.8], [45, 3.4], [60, 3.1], [72, 3.6], [80, 3], [90, 2.3], [100, 1.7]], dungeon:[[1, 1], [20, 1.5], [36, 2.2], [56, 2.5], [78, 2.6], [98, 1.4], [100, 1.35]] };
  const threat = (L, kind) => {
    const t = THREAT[kind] || THREAT.hunt; let m = t[t.length - 1][1];
    for (let i = 1; i < t.length; i++) if (L <= t[i][0]) { const [a, ma] = t[i - 1], [b, mb] = t[i]; m = ma + (mb - ma) * Math.max(0, L - a) / (b - a); break; }
    return { hp:m, atk:m };
  };
  const levelOfPower = P => { P = Math.max(1, P); if (P <= LP33) return 1 + Math.log(P) / Math.log(1.065); let lo = 33, hi = 400; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (levelPower(m) < P) lo = m; else hi = m; } return (lo + hi) / 2; };
  const zones = {
    village: { id:'village', kind:'village', chapter:0, title:'Grande Cidade de Tsukimori', subtitle:'Oito distritos entre montanhas, cerejeiras e canais.', kicker:'FESTIVAL DAS CEREJEIRAS · TSUKIMORI', difficulty:'Festival ativo', theme:'village', scene:'village-expanded',
      lore:'A capital sob a proteção do Véu cresceu em torno da Praça da Lua. Guilda, dojo, forja, mercado, santuário e oficinas recebem heróis antes de cada expedição.' },
    hunt: { id:'hunt', kind:'hunt', chapter:1, title:'Bosque das Lanternas', subtitle:'Raposas, onis e guardiões antigos entre cerejeiras.', kicker:'CAPÍTULO I · CAÇADA', difficulty:'Estágios 1 a 12', theme:'forest',
      pool:['fox','golem','spider_jade','oni'], elites:['golem_elder','fox_nine'], stages:12, basePower:1, ilvl:1,
      weakTo:['Fogo','Vento','Luz'], lore:'Desde que o eclipse começou, as lanternas do bosque atraem criaturas. Os guardiões de musgo já não reconhecem amigos.',
      unlock:{} },
    dungeon: { id:'dungeon', kind:'dungeon', chapter:1, title:'Templo do Véu', subtitle:'Cinco câmaras, uma encruzilhada e o Guardião Ígneo.', kicker:'CAPÍTULO I · DUNGEON', difficulty:'Andares I a III', theme:'dungeon',
      pool:['oni_ash','spider','wisp_void','golem_obsidian'], elites:['oni_crimson','fox_specter'], floorBoss:'golem_lava', floors:3, floorPower:[3.0, 5.2, 8.9], ilvl:5,
      weakTo:['Luz','Raio','Água'], lore:'O templo guardava o selo que prendia Shirogane. Seus corredores agora ardem com fogo do vazio.',
      unlock:{ stage:{ hunt:5 } } },
    boss: { id:'boss', kind:'boss', chapter:1, title:'Altar do Eclipse', subtitle:'Shirogane desperta em três fases.', kicker:'CAPÍTULO I · CHEFE', difficulty:'Chefe', theme:'boss', enemy:'boss', power:9, ilvl:13,
      weakTo:['Luz'], lore:'No topo da montanha, o Rei do Eclipse devora a luz da lua. Seu Eclipse Total atinge a equipe inteira.',
      unlock:{ stage:{ hunt:12 }, floor:{ dungeon:3 } } },
    hunt_tide: { id:'hunt_tide', kind:'hunt', chapter:2, title:'Costa das Marés', subtitle:'Ruínas afogadas, espectros e colossos de coral.', kicker:'CAPÍTULO II · CAÇADA', difficulty:'Estágios 1 a 12', theme:'coast',
      pool:['wisp','revenant','fox_foam','spider_coral','oni_tide'], elites:['revenant_captain','golem_coral'], stages:12, lv:[36, 60], ilvl:14,
      weakTo:['Raio','Natureza'], lore:'Com o eclipse, a maré trouxe de volta os afogados. Um capitão fantasma recruta novos marinheiros.',
      unlock:{ kills:{ boss:1 } } },
    dungeon_tide: { id:'dungeon_tide', kind:'dungeon', chapter:2, title:'Arquivo Submerso', subtitle:'A biblioteca afogada ainda escreve.', kicker:'CAPÍTULO II · DUNGEON', difficulty:'Andares I a III', theme:'archive',
      pool:['revenant_scribe','wisp_arc','spider_ink','golem_crystal','fox_storm'], elites:['revenant_crimson','archive_sentinel'], floorBoss:'oni_storm', floors:3, lvs:[48, 52, 56], ilvl:18,
      weakTo:['Luz','Terra','Vento'], lore:'A biblioteca que registrava a história do Véu. Seus escribas continuam escrevendo, com tinta venenosa.',
      unlock:{ stage:{ hunt_tide:5 } } },
    boss_tide: { id:'boss_tide', kind:'boss', chapter:2, title:'Abismo de Mizuchi', subtitle:'O dragão das marés aguarda no fundo do mar.', kicker:'CAPÍTULO II · CHEFE', difficulty:'Chefe', theme:'abyss', enemy:'boss_tide', lv:62, ilvl:27,
      weakTo:['Raio','Natureza'], lore:'Mizuchi guardava o mar até o eclipse o corromper. Seu Tsunami atinge a equipe inteira e a deixa lenta.',
      unlock:{ stage:{ hunt_tide:12 }, floor:{ dungeon_tide:3 } } },
    // --- Capítulo I: rotas secundárias ---
    hunt_swamp: { id:'hunt_swamp', kind:'hunt', chapter:1, side:true, title:'Pântano dos Vaga-lumes', subtitle:'Lodo, bruxas e luzes que hipnotizam.', kicker:'CAPÍTULO I · CAÇADA', difficulty:'Estágios 1 a 8', theme:'swamp',
      pool:['fox_bog','spider_bog','wisp_bog','oni_moss'], elites:['golem_bog','revenant_bog'], stages:8, basePower:1.8, ilvl:4,
      weakTo:['Fogo','Gelo'], lore:'Ao sul do bosque, os vaga-lumes nunca se apagam. Quem os segue à noite não volta: a Bruxa do Brejo coleciona viajantes.',
      unlock:{ stage:{ hunt:4 } } },
    dungeon_crypt: { id:'dungeon_crypt', kind:'dungeon', chapter:1, side:true, title:'Cripta de Jade', subtitle:'Mortos-vivos esmeralda e um rei sem túmulo.', kicker:'CAPÍTULO I · DUNGEON', difficulty:'Andares I a III', theme:'crypt',
      pool:['spider_bone','wisp_jade','fox_jade','golem_emerald'], elites:['revenant_jade','oni_jade'], floorBoss:'revenant_king', floors:3, floorPower:[4.2, 6.8, 11], ilvl:7,
      weakTo:['Luz','Fogo'], lore:'Sob o pântano dorme a cripta da antiga dinastia de jade. O eclipse acordou o rei, e os sacerdotes continuam seus ritos.',
      unlock:{ stage:{ hunt_swamp:5 } } },
    // --- Capítulo II: rotas secundárias ---
    hunt_frost: { id:'hunt_frost', kind:'hunt', chapter:2, side:true, title:'Planalto Congelado', subtitle:'Nevasca eterna e a Rainha do Inverno.', kicker:'CAPÍTULO II · CAÇADA', difficulty:'Estágios 1 a 8', theme:'frost',
      pool:['fox_snow','spider_ice','wisp_ice','golem_ice'], elites:['oni_frost','revenant_frost'], stages:8, lv:[40, 52], ilvl:16,
      weakTo:['Fogo','Terra'], lore:'Acima da costa, o eclipse congelou o céu. A Rainha do Inverno guarda o caminho para a forja esquecida.',
      unlock:{ stage:{ hunt_tide:4 } } },
    dungeon_forge: { id:'dungeon_forge', kind:'dungeon', chapter:2, side:true, title:'Forja Abissal', subtitle:'Metal vivo e o coração em chamas.', kicker:'CAPÍTULO II · DUNGEON', difficulty:'Andares I a III', theme:'forge',
      pool:['spider_lava','wisp_lava','fox_fire','revenant_ash'], elites:['oni_lava','golem_iron'], floorBoss:'golem_forge', floors:3, lvs:[52, 56, 60], ilvl:22,
      weakTo:['Água','Natureza'], lore:'A forja onde Ren aprendeu o ofício. Hoje os autômatos trabalham sozinhos, forjando armas para o eclipse.',
      unlock:{ stage:{ hunt_frost:5 } } },
    // --- Capítulo III ---
    hunt_desert: { id:'hunt_desert', kind:'hunt', chapter:3, title:'Areias do Tempo', subtitle:'Chacais, esfinges e múmias reais.', kicker:'CAPÍTULO III · CAÇADA', difficulty:'Estágios 1 a 12', theme:'desert', threat:1.15,
      pool:['fox_sand','spider_sand','wisp_sand','oni_sand'], elites:['golem_sand','revenant_mummy'], stages:12, lv:[64, 80], ilvl:30,
      weakTo:['Água','Natureza','Vento'], lore:'Além do mar, um deserto onde as horas escorrem como areia. Algo enorme se move sob as dunas.',
      unlock:{ kills:{ boss_tide:1 } } },
    hunt_ghost: { id:'hunt_ghost', kind:'hunt', chapter:3, side:true, title:'Cidade Fantasma', subtitle:'Uma cidade inteira presa em um único segundo.', kicker:'CAPÍTULO III · CAÇADA', difficulty:'Estágios 1 a 8', theme:'ghost',
      pool:['fox_ghost','wisp_ghost','spider_ghost','oni_ghost'], elites:['golem_ghost','revenant_ghost'], stages:8, lv:[68, 80], ilvl:34,
      weakTo:['Luz'], lore:'Quando Apep engoliu o tempo desta cidade, seus moradores ficaram presos para sempre no último baile.',
      unlock:{ stage:{ hunt_desert:5 } } },
    dungeon_clock: { id:'dungeon_clock', kind:'dungeon', chapter:3, title:'Torre do Relógio', subtitle:'Engrenagens, paradoxos e a Meia-Noite.', kicker:'CAPÍTULO III · DUNGEON', difficulty:'Andares I a III', theme:'clock',
      pool:['fox_time','wisp_time','spider_clock','oni_time'], elites:['revenant_time','revenant_chrono'], floorBoss:'golem_clock', floors:3, lvs:[72, 75, 78], ilvl:38,
      weakTo:['Terra','Gelo'], lore:'A torre que marcava as horas do mundo. Quem a controla decide quando o eclipse termina.',
      unlock:{ stage:{ hunt_desert:8 } } },
    boss_sand: { id:'boss_sand', kind:'boss', chapter:3, title:'Ninho de Apep', subtitle:'A serpente que devora as horas.', kicker:'CAPÍTULO III · CHEFE', difficulty:'Chefe', theme:'desertBoss', enemy:'boss_sand', lv:82, ilvl:44,
      weakTo:['Água','Natureza','Vento'], lore:'No coração do deserto, Apep dorme enrolada na última ampulheta. Se ela acordar por completo, o tempo deixa de existir.',
      unlock:{ stage:{ hunt_desert:12 }, floor:{ dungeon_clock:3 } } },
    // --- Capítulo IV: O Céu Partido ---
    hunt_sky: { id:'hunt_sky', kind:'hunt', chapter:4, title:'Ilhas Flutuantes', subtitle:'Ilhas de pedra presas por correntes de nuvem.', kicker:'CAPÍTULO IV · CAÇADA', difficulty:'Estágios 1 a 12', theme:'sky',
      pool:['fox_cloud','wisp_storm','spider_wind','oni_thunder'], elites:['golem_sky','revenant_sky'], stages:12, lv:[84, 94], ilvl:47,
      weakTo:['Terra','Gelo'], lore:'Quando Apep caiu, o céu rachou. Ilhas inteiras subiram com templos, pontes e criaturas, e lá no alto um tambor não para de tocar.',
      unlock:{ kills:{ boss_sand:1 } } },
    hunt_sakura: { id:'hunt_sakura', kind:'hunt', chapter:4, side:true, title:'Vale das Cerejeiras Eternas', subtitle:'Onde as flores nunca caem de verdade.', kicker:'CAPÍTULO IV · CAÇADA', difficulty:'Estágios 1 a 8', theme:'sakura',
      pool:['fox_sakura','wisp_petal','spider_silk','oni_blossom'], elites:['golem_root','revenant_geisha'], stages:8, lv:[86, 91], ilvl:49,
      weakTo:['Fogo','Sombra'], lore:'Um vale suspenso onde é sempre primavera. Lindo, e perigoso: as flores têm dentes.',
      unlock:{ stage:{ hunt_sky:5 } } },
    dungeon_sky: { id:'dungeon_sky', kind:'dungeon', chapter:4, title:'Santuário das Nuvens', subtitle:'Sinos, monges e o Senhor dos Ventos.', kicker:'CAPÍTULO IV · DUNGEON', difficulty:'Andares I a III', theme:'skyShrine',
      pool:['fox_lightning','wisp_cloud','spider_thunder','oni_wind'], elites:['revenant_monk','golem_bell'], floorBoss:'golem_fujin', floors:3, lvs:[92, 95, 98], ilvl:55,
      weakTo:['Terra','Sombra'], lore:'O templo onde Fujin guardava os ventos. Agora os sinos tocam sozinhos e cada badalada derruba um herói.',
      unlock:{ stage:{ hunt_sky:8 } } },
    boss_sky: { id:'boss_sky', kind:'boss', chapter:4, title:'Trono de Raijin', subtitle:'O tambor que racha o céu.', kicker:'CAPÍTULO IV · CHEFE', difficulty:'Chefe', theme:'skyBoss', enemy:'boss_sky', lv:100, ilvl:61,
      weakTo:['Terra'], lore:'No topo das nuvens, Raijin toca o tambor do trovão sem parar. Cada batida abre mais a Fenda.',
      unlock:{ stage:{ hunt_sky:12 }, floor:{ dungeon_sky:3 } } },
    // --- PvP: a equipe rival é a defesa salva de outro jogador ---
    arena: { id:'arena', kind:'arena', chapter:9, title:'Coliseu Carmesim', subtitle:'Heróis contra heróis, sob o olhar da cidade.', kicker:'PvP · ARENA', difficulty:'PvP', theme:'boss', scene:'boss_event',
      weakTo:[], lore:'O antigo coliseu de Tsukimori reabriu. Equipes de outros viajantes defendem sua honra aqui, e cada vitória vale Honra e MMR.', unlock:{} },
    // --- Conteúdo infinito ---
    rift: { id:'rift', kind:'rift', chapter:8, title:'Fenda Abissal', subtitle:'Andares infinitos. Até onde sua equipe chega?', kicker:'SEM FIM · FENDA', difficulty:'Andar ∞', theme:'rift', scene:'summoning',
      pool:['rift_hound','rift_weaver','rift_eye','rift_devourer'], elites:['rift_colossus','rift_herald'], floorBoss:'rift_wyrm', ilvl:6,
      weakTo:['Luz'], lore:'A ferida por onde os heróis chegaram. Criaturas do vazio vivem aqui, e cada andar sofre uma mutação diferente. Não há fim, só recordes.',
      unlock:{ kills:{ boss:1 } } },
    world_boss: { id:'world_boss', kind:'worldboss', chapter:7, title:'Invasão Mundial', subtitle:'Um chefe gigante contra todos os jogadores ao mesmo tempo.', kicker:'EVENTO · COOPERATIVO', difficulty:'2× por dia', theme:'boss', scene:'boss', ilvl:14,
      weakTo:[], lore:'Duas vezes por dia a Fenda se abre sobre Tsukimori e algo enorme atravessa. Nenhuma equipe sozinha consegue derrubá-lo: a vida dele é dividida entre todos os viajantes. Cada um tem uma investida por dia.',
      unlock:{ kills:{ boss:1 } } },
    boss_event: { id:'boss_event', kind:'boss', chapter:9, title:'Festival das Lanternas', subtitle:'A Kitsune desperta durante o festival.', kicker:'EVENTO · CHEFE', difficulty:'Evento', theme:'boss', enemy:'boss_event', power:12, ilvl:15, event:'festival',
      weakTo:['Água','Terra'], lore:'Uma vez a cada ciclo, o Festival das Lanternas acorda a raposa de nove caudas. Quem a vence ganha a chave do festival.',
      unlock:{ kills:{ boss:1 } } }
  };
  const bossTiers = [
    { id:0, name:'Normal', mult:1, reward:1 },
    { id:1, name:'Pesadelo', mult:2.4, reward:2.2, needKills:1 },
    { id:2, name:'Inferno', mult:5.5, reward:4, needKills:3 }
  ];

  // Fenda Abissal: poder do andar N = base × growth^(N−1). Sem limite.
  const RIFT = { base:4, growth:1.12, rooms:3 };

  // Invasões Mundiais: 2 janelas por dia (almoço e noite, horário de Brasília), 1 investida por
  // jogador por dia. A vida do chefe é compartilhada por todos os que investirem na mesma janela.
  const worldBoss = {
    windows:[{ from:12.5, to:14, label:'12h30 às 14h' }, { from:20.5, to:22, label:'20h30 às 22h' }],
    byDay:['wb_blood_moon', 'wb_titan', 'wb_frost_dragon', 'wb_storm_kitsune', 'wb_titan', 'wb_frost_dragon', 'wb_storm_kitsune'],
    duration:90,
    tiers:[
      { id:0, name:'Normal', P:8, minPower:0, reward:1, pool:25 },
      { id:1, name:'Heroico', lv:60, minPower:25000, reward:2.2, pool:25, ally:true },
      { id:2, name:'Mítico', lv:90, minPower:180000, reward:4, pool:25, ally:true }
    ]
  };
  // Expedições: heróis fora da equipe saem em missão e voltam com recursos (funciona offline).
  const expeditions = { durations:[1, 4, 8, 12], maxHeroes:3 };
  // Quadro de Recompensas (caça a um monstro específico) e a loja das Marcas de Caçador.
  const bountyShop = [
    { id:'b_star', name:'Aço Estelar', give:{ star:1 }, cost:40, text:'Material raro de refino.' },
    { id:'b_ori', name:'Oricalco', give:{ ori:1 }, cost:260, text:'Material épico de refino.' },
    { id:'b_luck', name:'Pergaminho da Sorte', give:{ luck:1 }, cost:15, text:'+20% chance de itens por 30 min.' },
    { id:'b_box', name:'Baú do Caçador', give:{ box:'epic' }, cost:140, text:'Um item épico do nível da sua melhor caçada.' },
    { id:'b_key', name:'Chave de Convocação', give:{ keys:1 }, cost:90, text:'Uma convocação.' }
  ];
  // Mutações da Fenda: cada andar tem uma (sempre a mesma para o mesmo andar).
  const riftMutations = [
    { id:'fury', name:'Fúria', text:'Inimigos com +20% de ATK.', enemy:{ atk:.20 } },
    { id:'shell', name:'Carapaça', text:'Inimigos com +30% de HP.', enemy:{ hp:.30 } },
    { id:'haste', name:'Pressa', text:'Inimigos com +20% de velocidade.', enemy:{ spd:.20 } },
    { id:'leech', name:'Sangria', text:'Inimigos roubam 15% do dano causado.', enemy:{ lifesteal:.15 } },
    { id:'mirror', name:'Espelho', text:'Inimigos devolvem 12% do dano recebido.', enemy:{ thorns:.12 } },
    { id:'calm', name:'Calmaria', text:'Sem mutação: +25% de ouro neste andar.', reward:{ gold:.25 } },
    { id:'bounty', name:'Recompensa', text:'Inimigos com +15% de HP, mas +40% de chance de itens.', enemy:{ hp:.15 }, reward:{ drop:.4 } }
  ];

  // ---------------------------------------------------------------------------
  // EVENTOS MUNDIAIS, calendário fixo por DATA e HORA de Brasília (UTC−3),
  // igual para todos os jogadores e independente de quando o servidor reiniciou.
  // ---------------------------------------------------------------------------
  const worldEvents = [
    { id:'golden', name:'Maré Dourada', icon:'金', color:'#ffcf6b', text:'+40% de ouro em todas as regiões.', mods:{ gold:.4 } },
    { id:'bloodmoon', name:'Lua de Sangue', icon:'血', color:'#ff5d6c', text:'Inimigos +20% ATK. +40% EXP e +25% chance de itens.', mods:{ enemyAtk:.2, xp:.4, drop:.25 } },
    { id:'festival', name:'Festival das Lanternas', icon:'灯', color:'#ff9ec7', text:'A Kitsune desperta. +30% de Éter e fogos-fátuos pelo campo.', mods:{ dust:.3 } },
    { id:'sakura', name:'Festival das Cerejeiras', icon:'桜', color:'#ffb3d6', text:'+30% de EXP e +15% de Éter. Pétalas cobrem Tsukimori.', mods:{ xp:.3, dust:.15 } },
    { id:'oninight', name:'Noite dos Oni', icon:'鬼', color:'#ff7a4f', text:'Inimigos +15% ATK. +35% chance de itens e +15% de ouro.', mods:{ enemyAtk:.15, drop:.35, gold:.15 } },
    { id:'aether', name:'Maré de Éter', icon:'霊', color:'#9fb3ff', text:'+50% de Éter e encontros especiais 50% mais comuns.', mods:{ dust:.5, encounter:.5 } },
    { id:'starfall', name:'Chuva de Estrelas', icon:'星', color:'#6fe3ff', text:'Mais itens raros e encontros especiais 2× mais comuns.', mods:{ rarity:.35, encounter:1 } }
  ];
  const calmEvent = { id:'calm', name:'Céu Calmo', icon:'月', color:'#9aa6d8', text:'Nenhum evento ativo. Confira o calendário para o próximo.', mods:{} };
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  // days: 0 = domingo … 6 = sábado · from/to em horas (horário de Brasília).
  const eventSchedule = [
    { id:'golden', days:ALL_DAYS, from:0, to:2 }, { id:'starfall', days:ALL_DAYS, from:8, to:10 },
    { id:'golden', days:ALL_DAYS, from:12, to:14 }, { id:'starfall', days:ALL_DAYS, from:16, to:18 },
    { id:'bloodmoon', days:[5], from:18, to:22 }, { id:'festival', days:[3], from:20, to:22 },
    { id:'festival', days:[0, 6], from:19, to:22 }, { id:'bloodmoon', days:ALL_DAYS, from:22, to:24 },
    { id:'aether', days:ALL_DAYS, from:4, to:6 }, { id:'sakura', days:ALL_DAYS, from:10, to:12 }, { id:'sakura', days:[1, 3, 5], from:14, to:16 },
    { id:'aether', days:[1], from:19, to:22 }, { id:'oninight', days:[2, 4], from:19, to:22 }
  ];
  const EVENT_TZ_OFFSET_MIN = -180;
  const EVENT_BLOCK_MS = 2 * 3600 * 1000;

  // ---------------------------------------------------------------------------
  // ENCONTROS ALEATÓRIOS, podem surgir ao fim de uma onda nas caçadas.
  // ---------------------------------------------------------------------------
  const encounters = [
    { id:'gold_fox', name:'Raposa Dourada', weight:4, text:'Uma raposa dourada com moedas apareceu. Você tem 12s antes que ela fuja.' },
    { id:'merchant', name:'Mercador Errante', weight:3, text:'Um mercador parou no caminho com itens raros.' },
    { id:'shrine', name:'Santuário Antigo', weight:3, text:'Um santuário esquecido no caminho. Escolha uma bênção.' },
    { id:'ambush', name:'Emboscada', weight:3, text:'Guardiões cercam a equipe. Vença e a recompensa dobra.' },
    { id:'chest', name:'Baú Misterioso', weight:3, text:'Um baú abandonado no caminho... abrir?' }
  ];
  const blessings = [
    { id:'might', name:'Bênção da Força', text:'+25% ATK para a equipe até o fim do estágio.', stats:{ atk:.25 } },
    { id:'ward', name:'Bênção da Guarda', text:'+25% DEF e 10% menos dano até o fim do estágio.', stats:{ def:.25, dr:.10 } },
    { id:'fortune', name:'Bênção da Fortuna', text:'+60% chance de itens até o fim do estágio.', mods:{ drop:.6 } },
    { id:'renewal', name:'Bênção da Renovação', text:'Restaura todo o HP e revive os caídos na hora.', instant:'heal' }
  ];

  // ---------------------------------------------------------------------------
  // HISTÓRIA, falas de Sayo, a Guardiã do Véu, e dos chefes.
  // ---------------------------------------------------------------------------
  const story = {
    intro:[
      { who:'Sayo', text:'Viajante... você atravessou o Véu. Eu sou Sayo, a última guardiã de Tsukimori.' },
      { who:'Sayo', text:'Um eclipse engoliu a lua, e com ele vieram monstros. Para enfrentá-los, o Véu pode convocar heróis de outros mundos.' },
      { who:'Sayo', text:'Use a Caixa dos Mundos: você tem dez convocações. Escolha quatro heróis. As duas primeiras vagas são a linha de frente.' }
    ],
    team:[
      { who:'Sayo', text:'Boa equipe. Vanguardas protegem a frente, Suportes curam, Executores e Atiradores causam dano, Arcanistas vivem das habilidades.' },
      { who:'Sayo', text:'Heróis do mesmo elemento, da mesma classe ou com laços de história ficam mais fortes juntos. Veja as sinergias na tela de Equipe.' },
      { who:'Sayo', text:'Agora abra o Mapa e parta para o Bosque das Lanternas. Cada estágio pesa mais que o anterior. Treine antes de avançar.' }
    ],
    zone:{
      hunt:[{ who:'Sayo', text:'O Bosque das Lanternas. Raposas e onis rondam as trilhas. A cada 4ª onda, um Guardião bloqueia o caminho.' }, { who:'Sayo', text:'Se a equipe cair, recuaremos um estágio para treinar. Use Q, W, E, R para soltar as ultimates quando a energia encher.' }],
      dungeon:[{ who:'Sayo', text:'O Templo do Véu. Cinco câmaras. Na terceira, você escolhe o caminho. No fim, o Guardião Ígneo.' }, { who:'Sayo', text:'Quando um inimigo brilhar em vermelho, ele prepara um golpe forte. Tenha escudos e curas prontos.' }],
      boss:[{ who:'Shirogane', text:'Mais heróis de mundos distantes... O eclipse devorará vocês como devorou a lua.' }, { who:'Sayo', text:'Cuidado com o Eclipse Total! Guarde ultimates de escudo e cura para esse momento.' }],
      hunt_tide:[{ who:'Sayo', text:'A Costa das Marés. Os afogados roubam vida e energia. Traga heróis de Raio e Natureza.' }],
      dungeon_tide:[{ who:'Sayo', text:'O Arquivo Submerso. Escribas silenciam heróis e o Guardião da Tempestade atordoa todos. Planeje sua equipe.' }],
      boss_tide:[{ who:'Mizuchi', text:'O mar lembra de tudo que afoga. Vocês serão lembrados... por pouco tempo.' }, { who:'Sayo', text:'O Tsunami de Mizuchi atinge todos. Na fase final ele afoga a retaguarda. Proteja os Suportes.' }],
      boss_event:[{ who:'Kitsune', text:'Hihihi... Vieram brincar no meu festival? As lanternas adoram novos amigos.' }],
      hunt_swamp:[{ who:'Sayo', text:'O Pântano dos Vaga-lumes. Não olhe muito para as luzes, elas atordoam. A Bruxa do Brejo cura seus servos: derrube-a primeiro.' }],
      dungeon_crypt:[{ who:'Sayo', text:'A Cripta de Jade. Os Sacerdotes levantam os mortos. Foque a equipe neles primeiro.' }, { who:'Sayo', text:'O Rei Sem Túmulo silencia todos com a Coroa das Almas. Tenha escudos prontos antes que ela caia.' }],
      hunt_frost:[{ who:'Sayo', text:'O Planalto Congelado. Aqui a energia das ultimates congela junto com o vento. Heróis de Fogo e Terra aquecem o caminho.' }],
      dungeon_forge:[{ who:'Sayo', text:'A Forja Abissal... Ren chorou quando soube. Os Autômatos de Ferro protegem a forja inteira, quebre a blindagem com perfuração.' }],
      hunt_desert:[{ who:'Sayo', text:'As Areias do Tempo. Um dia aqui dura um segundo lá fora. Chacais saltam na retaguarda, proteja seus curandeiros.' }, { who:'Apep', text:'Sssss... mais horas para devorar. Venham, pequenos. O deserto é paciente.' }],
      hunt_ghost:[{ who:'Sayo', text:'A Cidade Fantasma. Os moradores ainda dançam o último baile. Luz os liberta, e a Noiva Espectral não perdoa.' }],
      dungeon_clock:[{ who:'Sayo', text:'A Torre do Relógio. À Meia-Noite, tudo para. Guarde ultimates de escudo para o badalar.' }],
      boss_sand:[{ who:'Apep', text:'Eu engoli impérios, luas e memórias. O que são quatro heróis perdidos entre mundos?' }, { who:'Sayo', text:'Quando Apep mirar no herói mais forte, ele será engolido. Tenha outro pronto para carregar a equipe.' }],
      hunt_sky:[{ who:'Sayo', text:'As Ilhas Flutuantes! O céu rachou quando Apep caiu. Raposas correm sobre as nuvens e atacam a retaguarda: proteja os curandeiros.' }, { who:'Raijin', text:'BUM. BUM. Estão ouvindo? É o som do fim do mundo.' }],
      hunt_sakura:[{ who:'Sayo', text:'O Vale das Cerejeiras Eternas. As Kitsunes encantam o herói mais forte, e os Espíritos curam todos: derrube-os primeiro.' }],
      dungeon_sky:[{ who:'Sayo', text:'O Santuário das Nuvens. Fujin prepara o Saco dos Ventos. Quebre a postura dele antes: chefe quebrado perde o ataque preparado.' }],
      boss_sky:[{ who:'Raijin', text:'Quatro heróis contra o trovão? Toquem mais alto, tambores!' }, { who:'Sayo', text:'Use o Elo Kizuna: ultimates em sequência quebram a postura de Raijin rápido. Na fase final ele esvazia a energia de todos.' }],
      rift:[{ who:'Sayo', text:'A Fenda Abissal... foi por aqui que vocês chegaram. Não tem fundo. Cada andar é mais forte, lute até onde conseguir.' }]
    },
    bossWin:{
      boss:[{ who:'Shirogane', text:'Impossível... a lua... volta a brilhar...' }, { who:'Sayo', text:'O primeiro selo está restaurado! Mas o mar ainda chora. A Costa das Marés está aberta.' }],
      boss_tide:[{ who:'Mizuchi', text:'O mar... está calmo de novo. Obrigado, heróis de outro mundo.' }, { who:'Sayo', text:'Dois selos restaurados. Fortaleça a equipe: Shirogane e Mizuchi voltam mais fortes no Pesadelo e no Inferno.' }],
      boss_event:[{ who:'Kitsune', text:'Hmph. Tudo bem, vocês ganharam. Levem a chave... e voltem no próximo festival!' }],
      boss_sky:[{ who:'Raijin', text:'O tambor... silenciou...' }, { who:'Sayo', text:'Quatro selos! O céu está se fechando. Mas os tambores de Raijin acordaram algo no fundo da Fenda.' }],
      boss_sand:[{ who:'Apep', text:'As horas... escapam... de mim...' }, { who:'Sayo', text:'Três selos! O tempo volta a correr. Mas a Fenda Abissal continua aberta, e algo nos observa lá do fundo.' }]
    }
  };
  const speakers = { Raijin:{ color:'#8fd3ff', sprite:'raijin', title:'Tambor do Trovão' }, Sayo:{ color:'#ff9ec7', sprite:null, title:'Guardiã do Véu' }, Shirogane:{ color:'#b58cff', sprite:'eclipse', title:'Rei do Eclipse' }, Mizuchi:{ color:'#4fb3ff', sprite:'dragon', title:'Dragão Abissal' }, Kitsune:{ color:'#ff7a4f', sprite:'lantern_kitsune', title:'Espírito do Festival' }, Apep:{ color:'#ffb938', sprite:'dragon_amber', title:'Serpente do Tempo' } };

  // ---------------------------------------------------------------------------
  // GUIA DO VIAJANTE, passo a passo sempre visível, com recompensas.
  // cond é avaliada pelo motor (ver engine.guideDone).
  // ---------------------------------------------------------------------------
  const guide = [
    { id:'g_summon', title:'Convoque seus heróis', desc:'Abra Convocar e use as 10 convocações gratuitas.', go:'collection', cond:{ boxes:10 }, reward:{ gold:200 } },
    { id:'g_team', title:'Monte sua equipe', desc:'Coloque 4 heróis na formação. Vagas 1 e 2 na frente, 3 e 4 na retaguarda.', go:'collection', cond:{ team:4 }, reward:{ gold:300, potion:3 } },
    { id:'g_go', title:'Parta para o Bosque', desc:'Abra o Mapa e inicie o Estágio 1 do Bosque das Lanternas.', go:'journey', cond:{ entered:'hunt' }, reward:{ gold:200 } },
    { id:'g_s1', title:'Vença o Estágio 1-1', desc:'Derrote as 4 ondas do primeiro estágio.', go:'journey', cond:{ stage:['hunt', 1] }, reward:{ gold:400, item:'rare' } },
    { id:'g_equip', title:'Equipe um item', desc:'Abra a Bolsa e equipe uma arma ou acessório em um herói.', go:'inventory', cond:{ equipped:1 }, reward:{ gold:300, ore:5 } },
    { id:'g_ult', title:'Use uma Ultimate', desc:'Quando a barra dourada de energia encher, aperte Q/W/E/R ou o botão do herói.', go:null, cond:{ ults:1 }, reward:{ crystal:20 } },
    { id:'g_s3', title:'Vença o Estágio 1-3', desc:'Suba de nível caçando. Repita estágios anteriores para treinar.', go:'journey', cond:{ stage:['hunt', 3] }, reward:{ gold:800, potion:2 } },
    { id:'g_forge', title:'Aprimore um item na Forja', desc:'Na Cidade → Forja, aprimore um equipamento para +1.', go:'forge', cond:{ upgrades:1 }, reward:{ ore:10, gold:500 } },
    { id:'g_s5', title:'Vença o Estágio 1-5', desc:'O Guardião do 5º estágio é forte. Confira as sinergias da equipe.', go:'journey', cond:{ stage:['hunt', 5] }, reward:{ key:1, gold:1000 } },
    { id:'g_swamp', title:'Explore o Pântano, 3º estágio', desc:'Uma rota secundária ao sul do Bosque. Monstros novos, itens novos.', go:'journey', cond:{ stage:['hunt_swamp', 3] }, reward:{ gold:1200, ore:10 } },
    { id:'g_dungeon', title:'Conquiste o Templo: Andar I', desc:'Entre no Templo do Véu e derrote o Guardião Ígneo.', go:'journey', cond:{ floor:['dungeon', 1] }, reward:{ crystal:30, item:'epic' } },
    { id:'g_s8', title:'Vença o Estágio 1-8', desc:'Aprimore itens, eleve a qualidade dos heróis e treine no Dojo.', go:'journey', cond:{ stage:['hunt', 8] }, reward:{ ore:20, gold:2000 } },
    { id:'g_crypt', title:'Profane a Cripta de Jade: Andar I', desc:'Foque os Sacerdotes de Jade antes que ressuscitem os mortos.', go:'journey', cond:{ floor:['dungeon_crypt', 1] }, reward:{ crystal:25, item:'epic' } },
    { id:'g_s12', title:'Vença o Estágio 1-12', desc:'O último estágio do Bosque abre caminho ao Altar do Eclipse.', go:'journey', cond:{ stage:['hunt', 12] }, reward:{ key:1, gold:4000 } },
    { id:'g_d3', title:'Conquiste o Templo: Andar III', desc:'O andar mais profundo do Templo.', go:'journey', cond:{ floor:['dungeon', 3] }, reward:{ crystal:60, item:'legendary' } },
    { id:'g_boss', title:'Derrote Shirogane', desc:'O Rei do Eclipse. Prepare escudos para o Eclipse Total.', go:'journey', cond:{ kills:['boss', 1] }, reward:{ key:1, crystal:80 } },
    { id:'g_rift5', title:'Desça 5 andares da Fenda Abissal', desc:'Não tem fundo: cada andar é mais forte. Recordes vão para o ranking.', go:'journey', cond:{ floor:['rift', 5] }, reward:{ crystal:40, ore:30 } },
    { id:'g_c2', title:'Vença a Costa 2-6', desc:'Afogados drenam energia. Raio e Natureza são fortes aqui.', go:'journey', cond:{ stage:['hunt_tide', 6] }, reward:{ ore:40, gold:6000 } },
    { id:'g_frost', title:'Atravesse o Planalto, 4º estágio', desc:'A nevasca rouba energia. Leve Fogo e Terra.', go:'journey', cond:{ stage:['hunt_frost', 4] }, reward:{ crystal:30, dust:40 } },
    { id:'g_a1', title:'Conquiste o Arquivo: Andar I', desc:'O Guardião da Tempestade atordoa toda a equipe.', go:'journey', cond:{ floor:['dungeon_tide', 1] }, reward:{ crystal:60, item:'epic' } },
    { id:'g_abyss_forge', title:'Apague a Forja Abissal: Andar I', desc:'Quebre a blindagem dos Autômatos com perfuração de DEF.', go:'journey', cond:{ floor:['dungeon_forge', 1] }, reward:{ crystal:40, item:'legendary' } },
    { id:'g_c12', title:'Vença a Costa 2-12', desc:'O fim da costa, o abismo espera.', go:'journey', cond:{ stage:['hunt_tide', 12] }, reward:{ key:1, gold:12000 } },
    { id:'g_mizuchi', title:'Derrote Mizuchi', desc:'O dragão abissal. Proteja a retaguarda na fase final.', go:'journey', cond:{ kills:['boss_tide', 1] }, reward:{ key:2, crystal:150 } },
    { id:'g_nightmare', title:'Vença um chefe no Pesadelo', desc:'Chefes derrotados liberam dificuldades maiores com itens de conjunto.', go:'journey', cond:{ tierKill:1 }, reward:{ key:1, item:'legendary' } },
    { id:'g_desert', title:'Sobreviva às Areias, 6º estágio', desc:'O Capítulo III: chacais saltam na retaguarda.', go:'journey', cond:{ stage:['hunt_desert', 6] }, reward:{ crystal:60, ore:80 } },
    { id:'g_clock', title:'Conquiste a Torre do Relógio: Andar I', desc:'À Meia-Noite, tudo para. Escudos prontos.', go:'journey', cond:{ floor:['dungeon_clock', 1] }, reward:{ crystal:80, item:'legendary' } },
    { id:'g_apep', title:'Derrote Apep', desc:'A Serpente do Tempo. Tenha um segundo herói forte: ela engole o mais poderoso.', go:'journey', cond:{ kills:['boss_sand', 1] }, reward:{ key:3, crystal:250 } },
    { id:'g_sky', title:'Alcance as Ilhas Flutuantes, 6º estágio', desc:'O Capítulo IV: o céu rachou. Proteja a retaguarda das Raposas das Nuvens.', go:'journey', cond:{ stage:['hunt_sky', 6] }, reward:{ crystal:80, ore:120 } },
    { id:'g_shrine', title:'Conquiste o Santuário das Nuvens: Andar I', desc:'Quebre a postura de Fujin antes do Saco dos Ventos.', go:'journey', cond:{ floor:['dungeon_sky', 1] }, reward:{ crystal:100, item:'legendary' } },
    { id:'g_raijin', title:'Derrote Raijin', desc:'O Tambor do Trovão. Encadeie ultimates com o Elo Kizuna.', go:'journey', cond:{ kills:['boss_sky', 1] }, reward:{ key:3, crystal:300 } }
  ];

  // Crônicas, depois do Guia, metas geradas sem fim, sempre um pouco mais difíceis.
  const chronicles = [
    { type:'power', title:'Poder crescente', text:'Alcance {n} de poder total na equipe.' },
    { type:'rift', title:'Mergulho na Fenda', text:'Alcance o andar {n} da Fenda Abissal.' },
    { type:'kills', title:'Caçada sem fim', text:'Derrote mais {n} inimigos.' },
    { type:'upgrade', title:'Mestre ferreiro', text:'Aprimore {n} vezes na Forja.' },
    { type:'bossKills', title:'Caçador de chefes', text:'Derrote mais {n} chefes (qualquer dificuldade).' },
    { type:'research', title:'Pesquisador', text:'Alcance {n} níveis de pesquisa no Bestiário.' }
  ];

  // Missões diárias, renovam à meia-noite de Brasília.
  const dailies = [
    { id:'d_kills', title:'Patrulha diária', text:'Derrote {n} inimigos.', type:'kills', n:300, reward:{ gold:1, ore:4 } },
    { id:'d_elites', title:'Guardiões do dia', text:'Derrote {n} elites ou guardiões.', type:'elites', n:15, reward:{ gold:1, dust:8 } },
    { id:'d_floors', title:'Explorador', text:'Conclua {n} andares de dungeon ou da Fenda.', type:'floors', n:3, reward:{ crystal:4, ore:6 } },
    { id:'d_ults', title:'Poder liberado', text:'Use {n} ultimates.', type:'ults', n:40, reward:{ elixir:1, gold:1 } },
    { id:'d_salvage', title:'Reciclagem', text:'Desmonte {n} itens.', type:'salvage', n:15, reward:{ ore:6, dust:6 } },
    { id:'d_upgrade', title:'Na bigorna', text:'Tente {n} aprimoramentos na Forja.', type:'upgrades', n:5, reward:{ ore:5, gold:1 } },
    { id:'d_stages', title:'Avanço', text:'Conclua {n} estágios de caçada.', type:'stages', n:12, reward:{ potion:2, gold:1 } }
  ];
  // Recompensa diária de login (ciclo de 7 dias, sequência zera se faltar um dia).
  const loginRewards = [{ gold:1500 }, { potion:3 }, { ore:12 }, { dust:15, keys:1 }, { elixir:2 }, { crystal:8 }, { crystal:15, ore:20, keys:2 }];

  // Bestiário, abates liberam níveis de pesquisa (+dano e +chance de carta contra aquela criatura).
  const RESEARCH = { levels:[25, 100, 400, 1500, 5000], dmg:.03, card:.10 };

  // Contratos da Guilda, 3 ativos, renovam ao serem resgatados.
  const contracts = [
    { id:'c_kill', title:'Caça Geral', text:'Derrote {n} inimigos.', type:'kills', n:[40, 80, 150], reward:{ gold:1, crystal:6 } },
    { id:'c_elite', title:'Caça aos Guardiões', text:'Derrote {n} elites ou guardiões.', type:'elites', n:[4, 8, 12], reward:{ gold:1.5, ore:6 } },
    { id:'c_stage', title:'Patrulha', text:'Conclua {n} estágios de caçada.', type:'stages', n:[3, 5, 8], reward:{ gold:1.2, crystal:10 } },
    { id:'c_ult', title:'Poder Liberado', text:'Use {n} ultimates.', type:'ults', n:[10, 20, 35], reward:{ crystal:12, potion:1 } },
    { id:'c_loot', title:'Coleta', text:'Obtenha {n} itens.', type:'loot', n:[10, 20, 30], reward:{ gold:1, dust:15 } },
    { id:'c_salvage', title:'Reciclagem', text:'Desmonte {n} itens na Forja.', type:'salvage', n:[5, 10, 15], reward:{ ore:10, dust:10 } },
    { id:'c_dungeon', title:'Exploração', text:'Conclua {n|andar|andares} de dungeon.', type:'floors', n:[1, 2, 3], reward:{ crystal:20, ore:8 } },
    { id:'c_encounter', title:'Aventureiro', text:'Resolva {n|encontro especial|encontros especiais}.', type:'encounters', n:[1, 2, 3], reward:{ crystal:15, gold:1 } }
  ];

  // Conquistas, metas longas com recompensas.
  const achievements = [
    ...[50, 250, 1000, 5000, 20000].map((n, i) => ({ id:`a_kills_${n}`, title:`Caçador ${['I','II','III','IV','V'][i]}`, text:`Derrote ${n.toLocaleString('pt-BR')} inimigos.`, stat:'kills', n, reward:{ crystal:10 * (i + 1) } })),
    ...[1, 5, 20, 50].map((n, i) => ({ id:`a_boss_${n}`, title:`Matador de Chefes ${['I','II','III','IV'][i]}`, text:`Derrote ${n} ${n === 1 ? 'chefe' : 'chefes'}.`, stat:'bossKills', n, reward:{ key:1 + i } })),
    ...[10, 20, 35, 50, 60].map((n, i) => ({ id:`a_col_${n}`, title:`Colecionador ${['I','II','III','IV','V'][i]}`, text:`Descubra ${n} heróis diferentes.`, stat:'unique', n, reward:{ crystal:25 * (i + 1) } })),
    ...[10, 50, 200].map((n, i) => ({ id:`a_ult_${n}`, title:`Mestre das Ultimates ${['I','II','III'][i]}`, text:`Use ${n} ultimates.`, stat:'ults', n, reward:{ crystal:15 * (i + 1) } })),
    ...[5, 10, 20, 30].map((n, i) => ({ id:`a_lvl_${n}`, title:`Veterano ${['I','II','III','IV'][i]}`, text:`Leve um herói ao nível ${n}.`, stat:'maxLevel', n, reward:{ ore:10 * (i + 1), gold:1000 * (i + 1) } })),
    ...[1, 5, 10].map((n, i) => ({ id:`a_up_${n}`, title:`Ferreiro ${['I','II','III'][i]}`, text:`Aprimore um item até +${n}.`, stat:'maxUpgrade', n, reward:{ ore:15 * (i + 1) } })),
    ...[1, 5, 15].map((n, i) => ({ id:`a_leg_${n}`, title:`Lendário ${['I','II','III'][i]}`, text:`Obtenha ${n} ${n === 1 ? 'item lendário ou mítico' : 'itens lendários ou míticos'}.`, stat:'legendaries', n, reward:{ crystal:30 * (i + 1) } })),
    ...[10, 25, 50, 100, 200].map((n, i) => ({ id:`a_rift_${n}`, title:`Abismo ${['I','II','III','IV','V'][i]}`, text:`Alcance o andar ${n} da Fenda Abissal.`, stat:'riftBest', n, reward:{ crystal:20 * (i + 1), ore:20 * (i + 1) } })),
    ...[10, 40, 120].map((n, i) => ({ id:`a_res_${n}`, title:`Pesquisador ${['I','II','III'][i]}`, text:`Alcance ${n} níveis de pesquisa no Bestiário.`, stat:'research', n, reward:{ dust:40 * (i + 1) } })),
    ...[1, 10, 30].map((n, i) => ({ id:`a_card_${n}`, title:`Colecionador de Cartas ${['I','II','III'][i]}`, text:`Obtenha ${n} ${n === 1 ? 'carta' : 'cartas'} de monstros.`, stat:'cards', n, reward:{ crystal:15 * (i + 1) } })),
    ...[1, 10, 50].map((n, i) => ({ id:`a_alpha_${n}`, title:`Caçador de Alfas ${['I','II','III'][i]}`, text:`Derrote ${n} ${n === 1 ? 'monstro' : 'monstros'} Alfa.`, stat:'alphas', n, reward:{ ore:25 * (i + 1) } })),
    { id:'a_star5', title:'Qualidade Máxima', text:'Eleve um herói até 6★.', stat:'maxStars', n:6, reward:{ key:3 } },
    { id:'a_bonds', title:'Laços Firmes', text:'Ative 2 laços na mesma equipe.', stat:'bondsActive', n:2, reward:{ key:1 } }
  ];

  // ---------------------------------------------------------------------------
  // CIDADE, construções com bônus permanentes.
  // ---------------------------------------------------------------------------
  const buildings = {
    forge:    { id:'forge', name:'Forja de Ren', icon:'鍛', desc:'Aprimora e desmonta itens. Cada nível libera +2 no limite de aprimoramento e reduz o custo em 4%.', baseCost:800, growth:1.45 },
    dojo:     { id:'dojo', name:'Dojo do Eco', icon:'道', desc:'Treina ATK, HP, DEF e Crítico de toda a equipe e aumenta a EXP de combate em 4% por nível.', baseCost:900, growth:1.45 },
    shrine:   { id:'shrine', name:'Santuário da Lua', icon:'社', desc:'Convocações, troca de cristais por chaves e qualidade dos heróis. Cada nível reduz em 5% o custo da evolução.', baseCost:1200, growth:1.5 },
    workshop: { id:'workshop', name:'Oficina de Aoi', icon:'工', desc:'Cria poções e encantamentos. Cada nível reduz custos em 5% e libera receitas.', baseCost:700, growth:1.42 },
    guild:    { id:'guild', name:'Guilda de Tsukimori', icon:'城', desc:'Contratos de caça. +3% de ouro em combate por nível.', baseCost:1000, growth:1.45 },
    market:   { id:'market', name:'Mercado do Porto', icon:'市', desc:'Vende itens que mudam a cada 2 horas. Cada nível adiciona uma oferta e melhora a raridade.', baseCost:1500, growth:1.5 },
    house:    { id:'house', name:'Casa do Time', icon:'家', desc:'O lar da equipe. A Galeria expõe cartas (cada uma dá 25% dos seus atributos à equipe inteira) e ganha um espaço a cada 2 níveis.', baseCost:2500, growth:1.5 }
  };
  // Casa do Time: Galeria de cartas expostas e Álbum (coleção, como o livro de cartas do Ragnarok).
  const HOUSE = {
    displayShare:.25,
    slots:lv => Math.min(6, 1 + Math.floor(lv / 2)),
    album:[
      { n:3, name:'Primeiras páginas', stats:{ atk:.02 } },
      { n:8, name:'Caderno de campo', stats:{ hp:.03 } },
      { n:15, name:'Estudioso de criaturas', stats:{ def:.04 } },
      { n:25, name:'Colecionador', stats:{ crit:.015, critDmg:.06 } },
      { n:40, name:'Curador de relíquias', stats:{ atk:.04, hp:.04 } },
      { n:60, name:'Arquivista lendário', stats:{ skill:.08, dr:.03 } },
      { n:94, name:'Álbum completo', stats:{ atk:.08, hp:.08, def:.08 } }
    ]
  };
  // PvP: lutas mais longas que no PvE (HP multiplicado), limite de tempo e ultimates rivais telegrafadas.
  const PVP = { hpParty:2.0, hpRival:2.3, time:90, ultCd:15, ultWindup:1.4, tiers:[['bronze','Bronze','#c98a52'], ['prata','Prata','#c9d2e6'], ['ouro','Ouro','#ffcf6b'], ['platina','Platina','#8fe9d8'], ['diamante','Diamante','#8fd3ff'], ['lenda','Lenda','#ff7eb6']] };
  // Loja de Honra: preço e limite semanal espelham tools/neon_social.sql (o banco é quem cobra).
  const PVP_SHOP = [
    { id:'star', name:'Aço Estelar', price:60, limit:5, text:'Material raro de refino. Negociável no Mercado.' },
    { id:'ori', name:'Oricalco', price:400, limit:1, text:'Material épico de refino. Negociável no Mercado.' },
    { id:'glad_box', name:'Baú do Gladiador', price:300, limit:2, text:'Um item épico do nível da sua melhor caçada. Negociável.' },
    { id:'elixir', name:'Elixires de Energia ×3', price:40, limit:5, text:'Três Elixires de Energia.' },
    { id:'key', name:'Chave de Convocação', price:180, limit:2, text:'Uma convocação.' },
    { id:'glad_weapon', name:'Arma do Gladiador', price:700, limit:1, text:'Peça do conjunto Gladiador Carmesim (arma). Negociável.' },
    { id:'glad_focus', name:'Foco do Gladiador', price:550, limit:1, text:'Peça do conjunto Gladiador Carmesim (foco). Negociável.' },
    { id:'glad_seal', name:'Selo do Gladiador', price:550, limit:1, text:'Peça do conjunto Gladiador Carmesim (selo). Negociável.' },
    { id:'glad_charm', name:'Omamori do Gladiador', price:550, limit:1, text:'Peça do conjunto Gladiador Carmesim (omamori). Negociável.' }
  ];
  // Guildas: bônus por nível (valem para quem está na guilda) e janelas da guerra.
  // ORDEM DOS AVENTUREIROS (Guilda de Tsukimori): rank F→S que acompanha a campanha inteira. Subir de letra exige a
  // prova (um marco da jornada) além da experiência de contratos. Cada letra dá uma vantagem permanente.
  const GUILD_RANKS = [
    { letter:'F', lv:1, title:'Recruta', perk:'Contratos simples da Ordem.', mods:{}, stats:{} },
    { letter:'E', lv:3, title:'Aventureiro', exam:{ text:'Vença o estágio 12 do Bosque das Lanternas.', zone:'hunt', best:12 }, perk:'+5% de EXP em combate.', mods:{ xp:.05 }, stats:{} },
    { letter:'D', lv:6, title:'Veterano', exam:{ text:'Derrote Shirogane, Rei do Eclipse.', zone:'boss', kills:1 }, perk:'+1 contrato simultâneo e +5% de ouro.', mods:{ gold:.05 }, stats:{}, slots:1 },
    { letter:'C', lv:9, title:'Caçador de Selos', exam:{ text:'Vença o estágio 12 da Costa das Marés.', zone:'hunt_tide', best:12 }, perk:'+6% chance de itens.', mods:{ drop:.06 }, stats:{} },
    { letter:'B', lv:13, title:'Guardião do Véu', exam:{ text:'Derrote Mizuchi, Dragão Abissal.', zone:'boss_tide', kills:1 }, perk:'+4% de ATK e HP para toda a equipe.', mods:{}, stats:{ atk:.04, hp:.04 } },
    { letter:'A', lv:17, title:'Lâmina da Ordem', exam:{ text:'Derrote Apep, Serpente do Tempo.', zone:'boss_sand', kills:1 }, perk:'+1 vaga de Expedição e +1 contrato simultâneo.', mods:{}, stats:{}, slots:1, expedition:1 },
    { letter:'S', lv:22, title:'Lenda de Tsukimori', exam:{ text:'Derrote Raijin, Tambor do Trovão.', zone:'boss_sky', kills:1 }, perk:'+6% de ATK e HP e Contratos Lendários (Adamantina).', mods:{}, stats:{ atk:.06, hp:.06 }, legendary:true }
  ];
  const GUILD = { createCost:1500000, perks:[{ lv:2, text:'+3% de ouro', mods:{ gold:.03 } }, { lv:4, text:'+3% de EXP', mods:{ xp:.03 } }, { lv:6, text:'+5% de ouro', mods:{ gold:.05 } }, { lv:8, text:'+5% chance de itens', mods:{ drop:.05 } }, { lv:10, text:'+5% de EXP', mods:{ xp:.05 } }],
    war:{ days:[3, 6], from:20, to:22, attacks:3 } };
  // Profissões (coleta e criação, como ESO, GW2 e WoW). Materiais de coleta são negociáveis.
  const PROF = {
    gather:{ mining:{ name:'Mineração', icon:'鉱', color:'#c9b38a', text:'Veios de minério surgem entre as ondas de caçadas e masmorras.' },
      herbalism:{ name:'Herbalismo', icon:'薬', color:'#7fe39a', text:'Ervas raras crescem onde a Fenda tocou o chão.' },
      essence:{ name:'Extração de Essências', icon:'魂', color:'#b99bff', text:'Monstros derrotados deixam essências que só um extrator treinado recolhe.' } },
    craft:{ alchemy:{ name:'Alquimia', icon:'錬', color:'#6fd8b8', text:'Poções maiores e frascos de batalha.' },
      smithing:{ name:'Artesania', icon:'匠', color:'#ffb35c', text:'Equipamentos criados à mão, negociáveis no Mercado.' } },
    maxLevel:50, gatherChance:.3, rareChance:.02,
    next:lv => Math.round(60 * Math.pow(lv, 1.35)),
    tierIlvl:[0, 8, 20, 34, 50]
  };
  const PROF_MATS = [
    { id:'ore1', prof:'mining', tier:1, name:'Minério de Ferro', color:'#b9c2d6' }, { id:'ore2', prof:'mining', tier:2, name:'Prata das Marés', color:'#8fd3ff' },
    { id:'ore3', prof:'mining', tier:3, name:'Âmbar Fóssil', color:'#ffb938' }, { id:'ore4', prof:'mining', tier:4, name:'Mithril Celeste', color:'#c6fff0' },
    { id:'ore_rare', prof:'mining', tier:0, rare:true, name:'Cristal Lunar', color:'#e6d6ff' },
    { id:'herb1', prof:'herbalism', tier:1, name:'Erva-Lanterna', color:'#ffcf6b' }, { id:'herb2', prof:'herbalism', tier:2, name:'Alga Lunar', color:'#6fe3ff' },
    { id:'herb3', prof:'herbalism', tier:3, name:'Flor do Deserto', color:'#ff9a6b' }, { id:'herb4', prof:'herbalism', tier:4, name:'Pétala Eterna', color:'#ffb3d6' },
    { id:'herb_rare', prof:'herbalism', tier:0, rare:true, name:'Raiz do Mundo', color:'#7fe39a' },
    { id:'ess1', prof:'essence', tier:1, name:'Essência Selvagem', color:'#9fe38a' }, { id:'ess2', prof:'essence', tier:2, name:'Essência Abissal', color:'#4fb3ff' },
    { id:'ess3', prof:'essence', tier:3, name:'Essência Temporal', color:'#e0c77d' }, { id:'ess4', prof:'essence', tier:4, name:'Essência Tempestuosa', color:'#8fd3ff' },
    { id:'ess_rare', prof:'essence', tier:0, rare:true, name:'Essência Primordial', color:'#ff7eb6' }
  ];
  // Receitas: custo em materiais e ouro, nível mínimo da profissão e o que entregam.
  const PROF_RECIPES = [
    { id:'potion_plus', prof:'alchemy', lv:1, name:'Poções Maiores ×3', cost:{ herb1:3, ess1:1, gold:300 }, give:{ potion:3 }, xp:15 },
    { id:'elixir_plus', prof:'alchemy', lv:8, name:'Elixires Maiores ×2', cost:{ herb2:2, ess2:2, gold:900 }, give:{ elixir:2 }, xp:30 },
    { id:'flask_fury', prof:'alchemy', lv:5, name:'Frasco de Fúria', cost:{ herb2:2, ess2:1, gold:1200 }, give:{ flask_fury:1 }, xp:35 },
    { id:'flask_stone', prof:'alchemy', lv:5, name:'Frasco de Pedra', cost:{ herb2:2, ore2:1, gold:1200 }, give:{ flask_stone:1 }, xp:35 },
    { id:'flask_sage', prof:'alchemy', lv:15, name:'Frasco do Sábio', cost:{ herb3:2, ess3:1, gold:4000 }, give:{ flask_sage:1 }, xp:60 },
    { id:'flask_fortune', prof:'alchemy', lv:25, name:'Frasco da Fortuna', cost:{ herb4:2, ess4:1, herb_rare:1, gold:12000 }, give:{ flask_fortune:1 }, xp:110 },
    ...[1, 2, 3, 4].map(t => ({ id:'forge_t' + t, prof:'smithing', lv:[1, 10, 20, 32][t - 1], name:'Equipamento de ' + ['Ferro', 'Prata', 'Âmbar', 'Mithril'][t - 1], cost:{ ['ore' + t]:4, ['ess' + t]:2, gold:[800, 6000, 30000, 120000][t - 1] }, gear:t, xp:[40, 90, 160, 260][t - 1] })),
    { id:'forge_lunar', prof:'smithing', lv:40, name:'Obra-prima Lunar', cost:{ ore4:6, ess4:3, ore_rare:2, ess_rare:1, gold:400000 }, gear:4, masterwork:true, xp:600 }
  ];
  // Economia: fator base de todas as fontes de ouro e limites do ajuste dinâmico (Tesouro Imperial).
  const ECON = { faucet:.5, faucetMin:.6, faucetMax:1.15, priceMin:1, priceMax:1.6 };
  // Paragão: níveis veteranos alimentam uma progressão longa da conta.
  const PARAGON = { cap:300, per:.004, next:lv => Math.round(180000 * Math.pow(1.11, lv)) };

  const rarities = [
    { id:'common', label:'Comum', color:'#b9c2d6', affixes:0, mult:1.0 },
    { id:'rare', label:'Raro', color:'#4fb3ff', affixes:1, mult:1.25 },
    { id:'epic', label:'Épico', color:'#c07dff', affixes:2, mult:1.55 },
    { id:'legendary', label:'Lendário', color:'#ffb938', affixes:3, mult:1.9 },
    { id:'mythic', label:'Mítico', color:'#ff5d8f', affixes:3, mult:2.3 },
    { id:'set', label:'Conjunto', color:'#5fe39a', affixes:2, mult:1.7 }
  ];
  const heroRarities = [
    { id:'common', label:'Comum', color:'#b9c2d6', mult:1.0, chance:.55, shards:2 },
    { id:'rare', label:'Raro', color:'#4fb3ff', mult:1.12, chance:.30, shards:4 },
    { id:'epic', label:'Épico', color:'#c07dff', mult:1.26, chance:.12, shards:8 },
    { id:'legendary', label:'Lendário', color:'#ffb938', mult:1.42, chance:.03, shards:16 }
  ];

  // ---------------------------------------------------------------------------
  // CONVOCAÇÃO: caixas de heróis. Cada caixa tem custo em chaves, chances próprias e garantia (pity) própria.
  // Heróis de temporada só saem da Caixa da Temporada (e da Astral) enquanto a temporada estiver aberta;
  // depois dela entram na Caixa dos Mundos.
  // ---------------------------------------------------------------------------
  const SEASON = { id:'s1', name:'Temporada I · Despertares', ends:'2027-01-31T03:00:00Z',
    heroes:['goku_ui', 'sasuke_susanoo', 'gojo_void', 'tanjiro_hinokami', 'ichigo_bankai', 'vegeta_ego', 'luffy_gear5', 'naruto_kurama', 'mercy_valkyrie', 'sailor_eternal', 'dante_dt', 'jinx_arcane'],
    // Ids da primeira versão da temporada (arte que não combinava com os nomes) → formas despertadas.
    renamed:{ itachi:'sasuke_susanoo', kakashi:'vegeta_ego', yor:'ichigo_bankai', denji:'tanjiro_hinokami', frieren:'gojo_void', makima:'goku_ui',
      asta:'luffy_gear5', rem:'naruto_kurama', lux:'sailor_eternal', sage:'mercy_valkyrie', link:'dante_dt', jett:'jinx_arcane' } };
  const BOXES = [
    { id:'worlds', name:'Caixa dos Mundos', icon:'界', cost:1, color:'#b4ab9c', pity:30, pool:'base',
      rates:{ legendary:.03, epic:.12, rare:.30, common:.55 }, text:'A convocação clássica: todos os heróis fora da temporada.' },
    { id:'class', name:'Caixa de Classe', icon:'刃', cost:2, color:'#86b6c4', pity:25, pool:'class',
      rates:{ legendary:.05, epic:.17, rare:.33, common:.45 }, text:'Você escolhe a classe. Só saem heróis dela (fora da temporada).' },
    { id:'season', name:'Caixa da Temporada', icon:'季', cost:3, color:'#c9472d', pity:20, pool:'season', featured:.6,
      rates:{ legendary:.08, epic:.22, rare:.35, common:.35 }, text:'60% de chance de uma forma despertada da temporada. A garantia de lendário é sempre uma forma despertada.' },
    { id:'astral', name:'Caixa Astral', icon:'星', cost:10, color:'#d8b062', pity:8, pool:'all',
      rates:{ legendary:.20, epic:.45, rare:.35, common:0 }, text:'Sem comuns. Qualquer herói, inclusive os da temporada.' }
  ];

  // ARMAZÉM DO TANUKI: guarda de itens (como o armazém do Ragnarok). Itens desequipados e os de heróis que saem da
  // equipe vão para lá; nada no Armazém é desmontado nem ocupa a bolsa. Enfeites cosméticos (compra única) aumentam o espaço.
  const STORAGE = { base:300, decor:[
    { id:'lanterns', name:'Lanternas de Papel', icon:'灯', slots:50, price:{ crystal:250 }, text:'Um corredor iluminado de lanternas vermelhas.' },
    { id:'screen', name:'Biombo das Garças', icon:'屏', slots:100, price:{ crystal:500 }, text:'Biombo pintado a ouro que divide as prateleiras.' },
    { id:'chest', name:'Baú Laqueado de Sakura', icon:'箱', slots:150, price:{ crystal:900 }, text:'Laca negra com cerejeiras em madrepérola.' },
    { id:'dragon', name:'Cofre do Dragão Dourado', icon:'龍', slots:200, price:{ crystal:1500 }, text:'O cofre lendário dos mercadores de Tsukimori.' }
  ] };

  // Efeitos de status, texto usado na UI e na wiki.
  const statusInfo = {
    burn:{ name:'Queimadura', icon:'焼', color:'#ff7a4f', text:'Dano por segundo baseado no ATK de quem aplicou. Ignora defesa.' },
    poison:{ name:'Veneno', icon:'毒', color:'#8fe36b', text:'Dano por segundo que acumula até 5 vezes.' },
    bleed:{ name:'Sangramento', icon:'血', color:'#ff4a6a', text:'Dano por segundo. Alvos sangrando recebem +10% de dano crítico.' },
    stun:{ name:'Atordoamento', icon:'眩', color:'#ffe98a', text:'Não pode agir. Chefes resistem a 60% da duração.' },
    freeze:{ name:'Congelamento', icon:'凍', color:'#91dfff', text:'Não pode agir e recebe +20% de dano. Chefes resistem a 60%.' },
    slow:{ name:'Lentidão', icon:'遅', color:'#9fb3ff', text:'Velocidade de ataque reduzida.' },
    armorBreak:{ name:'Quebra de Armadura', icon:'破', color:'#ffd76a', text:'Defesa reduzida.' },
    mark:{ name:'Marca', icon:'印', color:'#ff9ec7', text:'Recebe mais dano de todas as fontes.' },
    weaken:{ name:'Fraqueza', icon:'⬇', color:'#c9a4ff', text:'ATK reduzido.' },
    silence:{ name:'Silêncio', icon:'黙', color:'#aaa5d0', text:'Não pode usar habilidades nem ultimates.' },
    atk:{ name:'Fúria', icon:'怒', color:'#ff9a6b', text:'ATK aumentado.', buff:true },
    def:{ name:'Guarda', icon:'守', color:'#6fb8ff', text:'DEF aumentada.', buff:true },
    spd:{ name:'Pressa', icon:'速', color:'#9ce9cc', text:'Velocidade de ataque aumentada.', buff:true },
    crit:{ name:'Precisão', icon:'精', color:'#ffd76a', text:'Chance de crítico aumentada.', buff:true },
    critDmg:{ name:'Letalidade', icon:'殺', color:'#ffb938', text:'Dano crítico aumentado.', buff:true },
    dodge:{ name:'Evasão', icon:'避', color:'#9ce9cc', text:'Esquiva aumentada.', buff:true },
    lifesteal:{ name:'Vampirismo', icon:'吸', color:'#ff5d8f', text:'Cura parte do dano causado.', buff:true },
    dr:{ name:'Barreira', icon:'障', color:'#8fe9ff', text:'Recebe menos dano.', buff:true },
    regen:{ name:'Regeneração', icon:'✚', color:'#5fe39a', text:'Recupera HP por segundo.', buff:true },
    stealth:{ name:'Furtividade', icon:'影', color:'#aaa5d0', text:'Não pode ser alvo de ataques diretos.', buff:true },
    taunt:{ name:'Provocação', icon:'挑', color:'#ff9a6b', text:'Inimigos são forçados a atacá-lo.', buff:true },
    counter:{ name:'Contra-ataque', icon:'剣', color:'#ffd9a8', text:'Devolve o golpe a quem o atingir.', buff:true }
  };

  const statNames = { breakPow:'Poder de quebra', chainPow:'Bônus por elo', atk:'ATK', hp:'HP', def:'DEF', spd:'Velocidade', crit:'Crítico', critDmg:'Dano crítico', dodge:'Esquiva', lifesteal:'Roubo de vida', dr:'Redução de dano', regen:'Regeneração', healPow:'Cura e escudos', dot:'Dano contínuo', boss:'Dano contra chefes', pierce:'Perfuração de DEF', skill:'Dano de habilidade', nrg:'Ganho de energia', cdr:'Economia de técnica', startNrg:'Energia inicial', elem:'Dano elemental' };

  KT.Data = { ENEMY_HP, familyOf, FAMILY_WEAK, REACTIONS, reaction, reactionList, GUILD_RANKS, levelPower, levelOfPower, THREAT, threat, STORAGE, SEASON, BOXES, PROF, PROF_MATS, PROF_RECIPES, ECON, PVP, PVP_SHOP, GUILD, HOUSE, PARAGON, worldBoss, expeditions, bountyShop, riftMutations, elements, classes, elementSynergy, bonds, enemies, zones, bossTiers, STAGE_GROWTH, RIFT, ALPHA, worldEvents, calmEvent, eventSchedule, EVENT_TZ_OFFSET_MIN, EVENT_BLOCK_MS, chronicles, dailies, loginRewards, RESEARCH, encounters, blessings, story, speakers, guide, contracts, achievements, buildings, rarities, heroRarities, statusInfo, statNames };
})();
