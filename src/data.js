(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  // ---------------------------------------------------------------------------
  // ELEMENTOS — cada elemento é forte contra dois outros (+30% dano) e recebe
  // -20% ao atacar quem é forte contra ele. Luz e Sombra são fortes entre si.
  // ---------------------------------------------------------------------------
  const elements = {
    Fogo:     { color:'#ff7a4f', icon:'🔥', strong:['Natureza','Gelo'] },
    Água:     { color:'#4fb3ff', icon:'💧', strong:['Fogo','Terra'] },
    Natureza: { color:'#5fe39a', icon:'🌿', strong:['Água','Terra'] },
    Terra:    { color:'#d8ad6a', icon:'⛰', strong:['Raio','Fogo'] },
    Raio:     { color:'#c9a4ff', icon:'⚡', strong:['Água','Vento'] },
    Vento:    { color:'#9ce9cc', icon:'🌪', strong:['Natureza','Terra'] },
    Gelo:     { color:'#91dfff', icon:'❄', strong:['Vento','Natureza'] },
    Luz:      { color:'#ffe19a', icon:'☀', strong:['Sombra'] },
    Sombra:   { color:'#b58cff', icon:'☾', strong:['Luz'] }
  };

  // ---------------------------------------------------------------------------
  // CLASSES — atributos base (nível 1), traço de classe e sinergia de equipe.
  // Vagas 1 e 2 são a LINHA DE FRENTE; vagas 3 e 4, a RETAGUARDA.
  // ---------------------------------------------------------------------------
  const classes = {
    Vanguarda: { icon:'🛡', color:'#6fb8ff', row:'Frente', base:{ hp:1500, atk:78, def:80, spd:.85, crit:.05, critDmg:1.5, dodge:.03 },
      trait:'Provocação natural: inimigos atacam Vanguardas com o dobro de frequência. +15% DEF.', traitStats:{ def:.15 }, threat:2,
      synergy:[{ n:2, text:'Equipe +10% DEF', stats:{ def:.10 } }, { n:3, text:'Equipe +10% DEF e +10% HP', stats:{ def:.10, hp:.10 } }] },
    Executor:  { icon:'⚔', color:'#ff7a8a', row:'Frente', base:{ hp:1020, atk:122, def:46, spd:1.08, crit:.15, critDmg:1.6, dodge:.08 },
      trait:'Letal: +25% de dano crítico. Abater um inimigo concede 20 de energia.', traitStats:{ critDmg:.25 }, threat:1,
      synergy:[{ n:2, text:'Equipe +12% dano crítico', stats:{ critDmg:.12 } }, { n:3, text:'Equipe +12% dano crítico e +5% crítico', stats:{ critDmg:.12, crit:.05 } }] },
    Arcanista: { icon:'✦', color:'#c9a4ff', row:'Retaguarda', base:{ hp:900, atk:118, def:40, spd:.9, crit:.08, critDmg:1.5, dodge:.05 },
      trait:'Poder arcano: habilidades e ultimates causam +20% de dano.', traitStats:{ skill:.20 }, threat:1,
      synergy:[{ n:2, text:'Equipe +10% dano de habilidade', stats:{ skill:.10 } }, { n:3, text:'Equipe +10% dano de habilidade e +10% energia', stats:{ skill:.10, nrg:.10 } }] },
    Atirador:  { icon:'🏹', color:'#ffd76a', row:'Retaguarda', base:{ hp:950, atk:112, def:42, spd:1.15, crit:.16, critDmg:1.5, dodge:.07 },
      trait:'Tiro à distância: +15% de dano quando posicionado na retaguarda. +10% velocidade.', traitStats:{ spd:.10 }, threat:1,
      synergy:[{ n:2, text:'Equipe +8% velocidade de ataque', stats:{ spd:.08 } }, { n:3, text:'Equipe +8% velocidade e ignora 10% da DEF', stats:{ spd:.08, pierce:.10 } }] },
    Suporte:   { icon:'✚', color:'#5fe39a', row:'Retaguarda', base:{ hp:1080, atk:84, def:55, spd:.95, crit:.06, critDmg:1.5, dodge:.05 },
      trait:'Devoção: +25% de cura e escudos. Ao usar a habilidade, aliados ganham 8 de energia.', traitStats:{ healPow:.25 }, threat:1,
      synergy:[{ n:2, text:'Equipe regenera 0,6% do HP por segundo', stats:{ regen:.006 } }, { n:3, text:'Equipe regenera 0,6% HP/s e recebe 8% menos dano', stats:{ regen:.006, dr:.08 } }] }
  };

  const elementSynergy = [
    { n:2, text:'+8% ATK para heróis do elemento', stats:{ atk:.08 } },
    { n:3, text:'+15% ATK e +10% HP para heróis do elemento', stats:{ atk:.15, hp:.10 } },
    { n:4, text:'+25% ATK, +15% HP e +10% crítico para todos', stats:{ atk:.25, hp:.15, crit:.10 } }
  ];

  // ---------------------------------------------------------------------------
  // LAÇOS — pares e trios com história juntos ganham bônus únicos.
  // ---------------------------------------------------------------------------
  const bonds = [
    { id:'saiyan', name:'Rivais Saiyajin', ids:['goku','vegeta'], text:'+15% ATK e +20 de energia inicial', stats:{ atk:.15, startNrg:20 } },
    { id:'team7', name:'Time 7', ids:['naruto','sasuke'], text:'+12% ATK e +12% HP', stats:{ atk:.12, hp:.12 } },
    { id:'strawhat', name:'Bando do Chapéu de Palha', ids:['luffy','zoro'], text:'+10% ATK, +10% HP e +5% roubo de vida', stats:{ atk:.10, hp:.10, lifesteal:.05 } },
    { id:'shinigami', name:'Shinigamis de Karakura', ids:['ichigo','rukia'], text:'+15% dano de habilidade e +10% DEF', stats:{ skill:.15, def:.10 } },
    { id:'kamado', name:'Irmãos Kamado', ids:['tanjiro','nezuko'], text:'+1% HP/s de regeneração e +10% ATK', stats:{ regen:.01, atk:.10 } },
    { id:'jujutsu', name:'Escola Jujutsu', ids:['gojo','yuji'], text:'+10% crítico e +15% dano crítico', stats:{ crit:.10, critDmg:.15 } },
    { id:'survey', name:'Tropa de Exploração', ids:['levi','mikasa','eren'], text:'+15% velocidade de ataque e +10% ATK', stats:{ spd:.15, atk:.10 } },
    { id:'alchemy', name:'Alquimistas Federais', ids:['edward','roy'], text:'+25% dano de efeitos contínuos e +10% DEF', stats:{ dot:.25, def:.10 } },
    { id:'ua', name:'Classe 1-A', ids:['deku','bakugo','allmight'], text:'+12% ATK e +12% energia', stats:{ atk:.12, nrg:.12 } },
    { id:'hero_assoc', name:'Associação de Heróis', ids:['saitama','genos'], text:'+20% ATK', stats:{ atk:.20 } },
    { id:'hunters', name:'Caçadores', ids:['gon','killua','kurapika'], text:'+10% esquiva e +10% ATK', stats:{ dodge:.10, atk:.10 } },
    { id:'wind_blades', name:'Lâminas do Vento', ids:['kenshin','yasuo'], text:'+10% crítico e +10% velocidade', stats:{ crit:.10, spd:.10 } },
    { id:'fairy', name:'Fairy Tail', ids:['natsu','erza'], text:'+12% ATK e +12% DEF', stats:{ atk:.12, def:.12 } },
    { id:'moonlight', name:'Guardiãs do Luar', ids:['sailormoon','rukia'], text:'+20% cura e escudos', stats:{ healPow:.20 } },
    { id:'feudal', name:'Era Feudal', ids:['inuyasha','kenshin'], text:'+10% HP e +10% dano crítico', stats:{ hp:.10, critDmg:.10 } },
    { id:'streetfighter', name:'World Warriors', ids:['ryu','chunli'], text:'+10% ATK e +8% esquiva', stats:{ atk:.10, dodge:.08 } },
    { id:'avalanche', name:'Destino de Gaia', ids:['cloud','tifa','sephiroth'], text:'+15% ATK e +15% dano de habilidade', stats:{ atk:.15, skill:.15 } },
    { id:'godofwar', name:'Pai e Filho', ids:['kratos','atreus'], text:'+15% HP e +10% ATK', stats:{ hp:.15, atk:.10 } },
    { id:'overwatch', name:'Overwatch', ids:['tracer','dva','mercy'], text:'+10% velocidade e +10% cura', stats:{ spd:.10, healPow:.10 } },
    { id:'raccoon', name:'Sobreviventes de Raccoon City', ids:['leon','jill'], text:'+12% ATK e +10% DEF', stats:{ atk:.12, def:.10 } },
    { id:'witcher', name:'Lobo Branco e Leoa', ids:['geralt','ciri'], text:'+12% ATK e +10% esquiva', stats:{ atk:.12, dodge:.10 } },
    { id:'yorha', name:'YoRHa', ids:['twob','atwo'], text:'+12% ATK e ignora 10% da DEF', stats:{ atk:.12, pierce:.10 } },
    { id:'sparda', name:'Filhos de Sparda', ids:['dante','vergil'], text:'+15% ATK e +8% roubo de vida', stats:{ atk:.15, lifesteal:.08 } },
    { id:'demon_hunters', name:'Caçadores de Demônios', ids:['dante','bayonetta'], text:'+15% dano de habilidade e +8% esquiva', stats:{ skill:.15, dodge:.08 } },
    { id:'mk', name:'Rivais de Outworld', ids:['scorpion','subzero'], text:'+12% ATK e +25% dano contínuo', stats:{ atk:.12, dot:.25 } },
    { id:'runeterra', name:'Campeões de Runeterra', ids:['jinx','ahri','yasuo'], text:'+12% ATK e +10% energia', stats:{ atk:.12, nrg:.10 } },
    { id:'explorers', name:'Exploradores', ids:['lara','aloy','arthur'], text:'+10% crítico e +10% ATK', stats:{ crit:.10, atk:.10 } },
    { id:'spartans', name:'Soldados Lendários', ids:['masterchief','doomslayer'], text:'+15% DEF e +10% ATK', stats:{ def:.15, atk:.10 } },
    { id:'assassins', name:'Mestres Assassinos', ids:['ezio','killua'], text:'+20% dano crítico', stats:{ critDmg:.20 } },
    { id:'medics', name:'Anjos da Linha de Frente', ids:['mercy','jill'], text:'+20% cura e +10% HP', stats:{ healPow:.20, hp:.10 } }
  ];

  // ---------------------------------------------------------------------------
  // MONSTROS — cada região tem criaturas exclusivas, com habilidades próprias.
  // Atributos são a base (Poder 1); a região e o estágio multiplicam o Poder.
  // Efeitos usam o mesmo sistema das habilidades dos heróis (ver roster.js).
  // ---------------------------------------------------------------------------
  const E = (o) => ({ hp:900, atk:70, def:40, atkMul:1.7, hpMul:1.5, spd:.9, crit:.05, dodge:.03, xp:14, gold:[8, 14], ...o });
  const enemies = {
    // Bosque das Lanternas — criaturas da floresta (fracas contra Fogo e Vento).
    fox:          E({ name:'Raposa do Crepúsculo', sprite:'fox', el:'Sombra', role:'Ágil', hp:760, atk:74, spd:1.15, dodge:.15, desc:'Veloz e esquiva. Sua mordida faz sangrar.', skill:{ name:'Mordida Sombria', cd:7, eff:[{ k:'dmg', m:1.5, to:'tgt' }, { k:'st', s:'bleed', d:4, v:.25, ch:.7, to:'tgt' }] } }),
    golem:        E({ name:'Sentinela de Musgo', sprite:'golem', el:'Natureza', role:'Tanque', hp:1500, atk:58, def:70, spd:.65, desc:'Resistente. Protege aliados com casca de musgo.', skill:{ name:'Casca de Musgo', cd:10, eff:[{ k:'shield', m:1.6, to:'lowAlly', d:6 }] } }),
    spider_jade:  E({ name:'Aranha de Jade', sprite:'spider_jade', el:'Natureza', role:'Venenosa', hp:820, atk:66, spd:1.0, desc:'Envenena quem estiver na retaguarda.', skill:{ name:'Presas de Jade', cd:8, eff:[{ k:'dmg', m:1.1, to:'back' }, { k:'st', s:'poison', d:6, v:.18, ch:1, to:'back' }] } }),
    oni:          E({ name:'Oni da Névoa', sprite:'oni', el:'Terra', role:'Brutamontes', hp:1150, atk:86, def:50, spd:.75, desc:'Golpes pesados que atordoam a linha de frente.', skill:{ name:'Clava Esmagadora', cd:9, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'stun', d:1.2, ch:.5, to:'tgt' }] } }),
    golem_elder:  E({ name:'Ancião de Musgo', sprite:'golem_elder', el:'Natureza', role:'Guardião', elite:true, hp:3600, atk:88, def:95, spd:.7, xp:60, gold:[40, 60], desc:'Guardião do Bosque. Cura aliados e provoca a equipe.', skill:{ name:'Raízes Antigas', cd:9, eff:[{ k:'heal', m:1.6, to:'allies' }, { k:'taunt', d:3 }, { k:'st', s:'slow', d:4, v:.3, ch:1, to:'all' }] } }),
    fox_nine:     E({ name:'Raposa de Nove Sombras', sprite:'fox_nine', el:'Sombra', role:'Guardiã', elite:true, hp:2600, atk:112, spd:1.2, dodge:.2, xp:60, gold:[40, 60], desc:'Ataca várias vezes e marca alvos frágeis.', skill:{ name:'Nove Caudas', cd:8, eff:[{ k:'dmg', m:.55, to:'randEach', hits:4 }, { k:'st', s:'mark', d:5, v:.2, ch:1, to:'low' }] } }),

    // Templo do Véu — espíritos e guardiões de pedra (fracos contra Luz e Raio).
    oni_ash:      E({ name:'Oni de Cinzas', sprite:'oni_ash', el:'Terra', role:'Brutamontes', hp:1250, atk:90, def:60, spd:.75, desc:'Enfraquece quem atinge.', skill:{ name:'Golpe de Cinzas', cd:8, eff:[{ k:'dmg', m:1.7, to:'tgt' }, { k:'st', s:'weaken', d:5, v:.2, ch:1, to:'tgt' }] } }),
    spider:       E({ name:'Aranha de Cristal', sprite:'spider', el:'Sombra', role:'Venenosa', hp:900, atk:72, spd:1.05, desc:'Cristais que quebram a armadura.', skill:{ name:'Estilhaços', cd:8, eff:[{ k:'dmg', m:.9, to:'all' }, { k:'st', s:'armorBreak', d:5, v:.2, ch:.6, to:'all' }] } }),
    wisp_void:    E({ name:'Chama do Vazio', sprite:'wisp_void', el:'Sombra', role:'Conjurador', hp:700, atk:88, def:25, spd:1.0, dodge:.1, desc:'Queima a retaguarda com fogo roxo.', skill:{ name:'Fogo do Vazio', cd:7, eff:[{ k:'dmg', m:1.4, to:'back' }, { k:'st', s:'burn', d:5, v:.3, ch:1, to:'back' }] } }),
    golem_obsidian:E({ name:'Golem de Obsidiana', sprite:'golem_obsidian', el:'Terra', role:'Tanque', hp:1700, atk:62, def:95, spd:.6, desc:'Reflete parte do dano sofrido.', thorns:.15, skill:{ name:'Muralha Negra', cd:11, eff:[{ k:'buff', s:'dr', v:.35, d:5, to:'allies' }] } }),
    oni_crimson:  E({ name:'Oni Carmesim', sprite:'oni_crimson', el:'Fogo', role:'Guardião', elite:true, hp:3900, atk:118, def:70, spd:.8, xp:70, gold:[50, 75], desc:'Entra em fúria ao perder vida.', enrageAt:.5, skill:{ name:'Tempestade Carmesim', cd:9, eff:[{ k:'dmg', m:1.2, to:'all' }, { k:'st', s:'burn', d:4, v:.3, ch:.7, to:'all' }] } }),
    fox_specter:  E({ name:'Kitsune Espectral', sprite:'fox_specter', el:'Luz', role:'Guardiã', elite:true, hp:2800, atk:108, spd:1.15, dodge:.22, xp:70, gold:[50, 75], desc:'Some e reaparece silenciando heróis.', skill:{ name:'Ilusão Espectral', cd:9, eff:[{ k:'st', s:'silence', d:4, ch:1, to:'high' }, { k:'dmg', m:1.6, to:'high' }, { k:'buff', s:'dodge', v:.3, d:4, to:'self' }] } }),
    golem_lava:   E({ name:'Guardião Ígneo', sprite:'golem_lava', el:'Fogo', role:'Chefe de Andar', elite:true, miniboss:true, hp:9000, atk:120, def:95, spd:.65, xp:180, gold:[140, 200], desc:'Chefe do Templo. Prepara uma Erupção devastadora: proteja a equipe!', skill:{ name:'Punho de Magma', cd:7, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'st', s:'burn', d:4, v:.35, ch:1, to:'tgt' }] },
      specials:[{ name:'Erupção', cd:16, windup:2.4, eff:[{ k:'dmg', m:2.1, to:'all' }, { k:'st', s:'burn', d:5, v:.4, ch:1, to:'all' }] }] }),

    // Costa das Marés — criaturas do mar (fracas contra Raio e Natureza).
    wisp:         E({ name:'Luz Errante', sprite:'wisp', el:'Água', role:'Conjurador', hp:760, atk:84, def:28, spd:1.05, dodge:.12, desc:'Drena a energia dos heróis.', skill:{ name:'Sussurro Salgado', cd:8, eff:[{ k:'dmg', m:1.3, to:'rand' }, { k:'nrg', v:-25, to:'rand' }] } }),
    revenant:     E({ name:'Espectro das Marés', sprite:'revenant', el:'Água', role:'Lutador', hp:1250, atk:88, def:55, spd:.85, lifesteal:.2, desc:'Rouba vida a cada golpe.', skill:{ name:'Tridente Afogado', cd:8, eff:[{ k:'dmg', m:1.8, to:'tgt' }, { k:'drain', v:.5 }] } }),
    fox_foam:     E({ name:'Raposa da Espuma', sprite:'fox_foam', el:'Gelo', role:'Ágil', hp:820, atk:80, spd:1.2, dodge:.18, desc:'Congela quem hesita.', skill:{ name:'Sopro Gélido', cd:8, eff:[{ k:'dmg', m:1.3, to:'tgt' }, { k:'st', s:'freeze', d:1.5, ch:.5, to:'tgt' }] } }),
    spider_coral: E({ name:'Aranha de Coral', sprite:'spider_coral', el:'Terra', role:'Tanque', hp:1400, atk:66, def:85, spd:.8, thorns:.12, desc:'Carapaça espinhosa que devolve dano.', skill:{ name:'Carapaça', cd:10, eff:[{ k:'shield', m:2.0, to:'self', d:6 }, { k:'taunt', d:4 }] } }),
    oni_tide:     E({ name:'Oni Abissal', sprite:'oni_tide', el:'Água', role:'Brutamontes', hp:1300, atk:96, def:58, spd:.75, desc:'Onda que derruba a linha de frente.', skill:{ name:'Onda Abissal', cd:9, eff:[{ k:'dmg', m:1.4, to:'front' }, { k:'st', s:'slow', d:4, v:.35, ch:1, to:'front' }] } }),
    revenant_captain:E({ name:'Capitão Afogado', sprite:'revenant_captain', el:'Água', role:'Guardião', elite:true, hp:4200, atk:125, def:75, spd:.85, lifesteal:.15, xp:85, gold:[60, 90], desc:'Comanda a tripulação: fortalece aliados.', skill:{ name:'Ordem do Capitão', cd:9, eff:[{ k:'buff', s:'atk', v:.3, d:6, to:'allies' }, { k:'dmg', m:1.5, to:'tgt' }] } }),
    golem_coral:  E({ name:'Colosso de Coral', sprite:'golem_coral', el:'Terra', role:'Guardião', elite:true, hp:5200, atk:100, def:120, spd:.6, thorns:.2, xp:85, gold:[60, 90], desc:'Muralha viva. Escudos enormes e espinhos.', skill:{ name:'Recife Protetor', cd:10, eff:[{ k:'shield', m:2.2, to:'allies', d:6 }, { k:'taunt', d:4 }] } }),

    // Arquivo Submerso — conhecimento proibido (fracos contra Luz e Terra).
    revenant_scribe:E({ name:'Escriba Afogado', sprite:'revenant_scribe', el:'Sombra', role:'Conjurador', hp:950, atk:92, def:40, spd:.9, desc:'Silencia heróis com runas afogadas.', skill:{ name:'Runa do Silêncio', cd:9, eff:[{ k:'dmg', m:1.3, to:'rand' }, { k:'st', s:'silence', d:3, ch:.8, to:'rand' }] } }),
    wisp_arc:     E({ name:'Faísca Arcana', sprite:'wisp_arc', el:'Raio', role:'Conjurador', hp:780, atk:98, def:28, spd:1.15, dodge:.12, desc:'Descargas em cadeia.', skill:{ name:'Corrente Elétrica', cd:8, eff:[{ k:'dmg', m:.7, to:'randEach', hits:3 }, { k:'st', s:'stun', d:.8, ch:.3, to:'rand' }] } }),
    spider_ink:   E({ name:'Aranha de Tinta', sprite:'spider_ink', el:'Sombra', role:'Venenosa', hp:980, atk:80, spd:1.0, desc:'Tinta que cega e envenena.', skill:{ name:'Tinta Venenosa', cd:8, eff:[{ k:'dmg', m:.8, to:'all' }, { k:'st', s:'poison', d:6, v:.15, ch:1, to:'all' }] } }),
    golem_crystal:E({ name:'Autômato de Jade', sprite:'golem_crystal', el:'Natureza', role:'Tanque', hp:1800, atk:70, def:100, spd:.6, desc:'Regenera e protege os escribas.', regen:.01, skill:{ name:'Núcleo Restaurador', cd:10, eff:[{ k:'heal', m:1.8, to:'lowAlly' }, { k:'shield', m:1.4, to:'lowAlly', d:6 }] } }),
    fox_storm:    E({ name:'Raposa-Trovão', sprite:'fox_storm', el:'Raio', role:'Ágil', hp:880, atk:96, spd:1.25, dodge:.18, desc:'Salta para a retaguarda.', skill:{ name:'Salto Relâmpago', cd:7, eff:[{ k:'dmg', m:1.7, to:'back' }, { k:'st', s:'stun', d:1, ch:.4, to:'back' }] } }),
    revenant_crimson:E({ name:'Arquivista Carmesim', sprite:'revenant_crimson', el:'Sombra', role:'Guardião', elite:true, hp:4600, atk:130, def:80, spd:.9, xp:95, gold:[70, 100], desc:'Amaldiçoa a equipe: cura recebida reduzida.', skill:{ name:'Maldição do Arquivo', cd:9, eff:[{ k:'dmg', m:1.1, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }, { k:'st', s:'mark', d:6, v:.15, ch:1, to:'all' }] } }),
    oni_storm:    E({ name:'Guardião da Tempestade', sprite:'oni_storm', el:'Raio', role:'Chefe de Andar', elite:true, miniboss:true, hp:11500, atk:135, def:100, spd:.75, xp:220, gold:[170, 240], desc:'Chefe do Arquivo. Carrega um Trovão que atordoa toda a equipe.', skill:{ name:'Martelo Elétrico', cd:7, eff:[{ k:'dmg', m:1.9, to:'tgt' }, { k:'st', s:'armorBreak', d:5, v:.25, ch:1, to:'tgt' }] },
      specials:[{ name:'Trovão Ancestral', cd:17, windup:2.4, eff:[{ k:'dmg', m:1.8, to:'all' }, { k:'st', s:'stun', d:1.8, ch:1, to:'all' }] }] }),

    // Invocações de evento.
    wisp_ember:   E({ name:'Fogo-Fátuo do Festival', sprite:'wisp_ember', el:'Fogo', role:'Conjurador', hp:900, atk:100, def:30, spd:1.1, dodge:.1, desc:'Lanterna viva que explode em chamas.', skill:{ name:'Estouro de Lanterna', cd:8, eff:[{ k:'dmg', m:1.2, to:'all' }, { k:'st', s:'burn', d:4, v:.3, ch:.6, to:'all' }] } }),
    fox_gold:     E({ name:'Raposa Dourada', sprite:'fox_storm', el:'Luz', role:'Tesouro', hp:2400, atk:1, def:40, spd:.5, dodge:.35, xp:40, gold:[400, 600], treasure:true, desc:'Rara e rica. Foge depois de 12 segundos!' }),
    mimic:        E({ name:'Baú Mímico', sprite:'spider_ink', el:'Sombra', role:'Armadilha', elite:true, hp:3200, atk:120, def:70, spd:.9, xp:80, gold:[150, 250], desc:'Parecia um baú...', skill:{ name:'Mordida do Baú', cd:7, eff:[{ k:'dmg', m:2.2, to:'tgt' }, { k:'st', s:'bleed', d:5, v:.3, ch:1, to:'tgt' }] } }),

    // Chefes — mecânicas de fase, ataques telegrafados, invocações e fúria.
    boss:         E({ name:'Shirogane, Rei do Eclipse', sprite:'eclipse', el:'Sombra', role:'Chefe', boss:true, hp:90000, atk:150, def:110, spd:.8, crit:.1, xp:1400, gold:[1500, 2000], enrage:150,
      desc:'Senhor do eclipse. Invoca Kitsunes Espectrais, marca heróis e lança o Eclipse Total — que precisa ser absorvido com escudos e curas.',
      skill:{ name:'Lâmina Lunar', cd:6, eff:[{ k:'dmg', m:2.0, to:'tgt' }, { k:'st', s:'bleed', d:5, v:.35, ch:1, to:'tgt' }] },
      phases:[
        { at:1,  text:'Selo intacto', specials:[{ name:'Eclipse Total', cd:18, windup:2.8, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }] }] },
        { at:.7, text:'Selo rompido — invoca Kitsunes', summon:{ id:'fox_specter', n:2, every:28 }, specials:[{ name:'Eclipse Total', cd:16, windup:2.6, eff:[{ k:'dmg', m:2.4, to:'all' }, { k:'st', s:'weaken', d:6, v:.25, ch:1, to:'all' }] }, { name:'Marca da Lua Negra', cd:12, windup:1.2, eff:[{ k:'st', s:'mark', d:8, v:.4, ch:1, to:'back' }, { k:'dmg', m:2.8, to:'back' }] }] },
        { at:.35, text:'Fúria do Eclipse — ataques acelerados', buff:{ spd:.35, atk:.2 }, specials:[{ name:'Eclipse Total', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.6, to:'all' }, { k:'st', s:'weaken', d:6, v:.3, ch:1, to:'all' }] }, { name:'Marca da Lua Negra', cd:10, windup:1.2, eff:[{ k:'st', s:'mark', d:8, v:.4, ch:1, to:'back' }, { k:'dmg', m:3.0, to:'back' }] }] }
      ] }),
    boss_tide:    E({ name:'Mizuchi, Dragão Abissal', sprite:'dragon', el:'Água', role:'Chefe', boss:true, hp:180000, atk:175, def:130, spd:.8, crit:.1, xp:2600, gold:[2600, 3400], enrage:160,
      desc:'O dragão das marés. Seu Tsunami atinge todos, sua Maré Curativa o regenera e, no fim, ele afoga a retaguarda.',
      skill:{ name:'Mordida Abissal', cd:6, eff:[{ k:'dmg', m:2.2, to:'tgt' }, { k:'st', s:'armorBreak', d:6, v:.3, ch:1, to:'tgt' }] },
      phases:[
        { at:1,  text:'Maré baixa', specials:[{ name:'Tsunami', cd:17, windup:2.8, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }] },
        { at:.65, text:'Maré alta — Espectros emergem', summon:{ id:'revenant', n:2, every:25 }, heal:.06, specials:[{ name:'Tsunami', cd:15, windup:2.6, eff:[{ k:'dmg', m:2.3, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }, { name:'Maré Curativa', cd:20, windup:2, eff:[{ k:'heal', p:.05, to:'self' }, { k:'shield', p:.06, to:'self', d:8 }] }] },
        { at:.3, text:'Redemoinho — o abismo desperta', buff:{ spd:.3, atk:.25 }, specials:[{ name:'Tsunami', cd:12, windup:2.4, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'st', s:'slow', d:6, v:.4, ch:1, to:'all' }] }, { name:'Afogamento', cd:11, windup:1.4, eff:[{ k:'dmg', m:3.2, to:'back' }, { k:'st', s:'stun', d:2, ch:1, to:'back' }] }] }
      ] }),
    boss_event:   E({ name:'Kitsune das Lanternas', sprite:'lantern_kitsune', el:'Fogo', role:'Chefe', boss:true, hp:120000, atk:165, def:115, spd:.9, crit:.12, dodge:.12, xp:2000, gold:[2000, 2800], enrage:150,
      desc:'Espírito do festival. Suas Nove Caudas incendeiam tudo; lanternas vivas explodem pelo campo.',
      skill:{ name:'Fogo de Raposa', cd:6, eff:[{ k:'dmg', m:1.2, to:'randEach', hits:2 }, { k:'st', s:'burn', d:5, v:.4, ch:1, to:'rand' }] },
      phases:[
        { at:1, text:'Dança das lanternas', summon:{ id:'wisp_ember', n:2, every:26 }, specials:[{ name:'Nove Caudas', cd:17, windup:2.6, eff:[{ k:'dmg', m:2.2, to:'all' }, { k:'st', s:'burn', d:6, v:.5, ch:1, to:'all' }] }] },
        { at:.6, text:'Ilusões — esquiva elevada', buff:{ dodge:.15 }, specials:[{ name:'Nove Caudas', cd:15, windup:2.4, eff:[{ k:'dmg', m:2.3, to:'all' }, { k:'st', s:'burn', d:6, v:.5, ch:1, to:'all' }] }, { name:'Encanto', cd:12, windup:1.2, eff:[{ k:'st', s:'stun', d:2.5, ch:1, to:'high' }, { k:'dmg', m:2.4, to:'high' }] }] },
        { at:.3, text:'Chama eterna', buff:{ spd:.3, atk:.2 }, specials:[{ name:'Nove Caudas', cd:11, windup:2.2, eff:[{ k:'dmg', m:2.5, to:'all' }, { k:'st', s:'burn', d:6, v:.6, ch:1, to:'all' }] }] }
      ] })
  };

  // ---------------------------------------------------------------------------
  // REGIÕES — caçadas têm estágios; dungeons têm andares; chefes têm dificuldade.
  // power(estágio) define o multiplicador de atributos dos inimigos.
  // ---------------------------------------------------------------------------
  const STAGE_GROWTH = 1.2;
  const zones = {
    village: { id:'village', kind:'village', chapter:0, title:'Cidade de Tsukimori', subtitle:'Portões abertos para as terras do Véu.', kicker:'REFÚGIO · TSUKIMORI', difficulty:'Refúgio', theme:'village',
      lore:'A última cidade sob a proteção do Véu. Aqui os heróis convocados descansam, forjam armas e se preparam para enfrentar o eclipse.' },
    hunt: { id:'hunt', kind:'hunt', chapter:1, title:'Bosque das Lanternas', subtitle:'Raposas, onis e guardiões antigos entre cerejeiras.', kicker:'CAPÍTULO I · CAÇADA', difficulty:'Estágios 1–12', theme:'forest',
      pool:['fox','golem','spider_jade','oni'], elites:['golem_elder','fox_nine'], stages:12, basePower:1, ilvl:1,
      weakTo:['Fogo','Vento','Luz'], lore:'Desde que o eclipse começou, as lanternas do bosque atraem criaturas. Os guardiões de musgo já não reconhecem amigos.',
      unlock:{} },
    dungeon: { id:'dungeon', kind:'dungeon', chapter:1, title:'Templo do Véu', subtitle:'Cinco câmaras, uma encruzilhada e o Guardião Ígneo.', kicker:'CAPÍTULO I · DUNGEON', difficulty:'Andares I–III', theme:'dungeon',
      pool:['oni_ash','spider','wisp_void','golem_obsidian'], elites:['oni_crimson','fox_specter'], floorBoss:'golem_lava', floors:3, floorPower:[3.0, 5.2, 8.9], ilvl:5,
      weakTo:['Luz','Raio','Água'], lore:'O templo guardava o selo que prendia Shirogane. Seus corredores agora ardem com fogo do vazio.',
      unlock:{ stage:{ hunt:5 } } },
    boss: { id:'boss', kind:'boss', chapter:1, title:'Altar do Eclipse', subtitle:'Shirogane desperta em três fases.', kicker:'CAPÍTULO I · CHEFE', difficulty:'Chefe', theme:'boss', enemy:'boss', power:9, ilvl:13,
      weakTo:['Luz'], lore:'No topo da montanha, o Rei do Eclipse devora a luz da lua. Só uma equipe preparada sobrevive ao Eclipse Total.',
      unlock:{ stage:{ hunt:12 }, floor:{ dungeon:3 } } },
    hunt_tide: { id:'hunt_tide', kind:'hunt', chapter:2, title:'Costa das Marés', subtitle:'Ruínas afogadas, espectros e colossos de coral.', kicker:'CAPÍTULO II · CAÇADA', difficulty:'Estágios 1–12', theme:'coast',
      pool:['wisp','revenant','fox_foam','spider_coral','oni_tide'], elites:['revenant_captain','golem_coral'], stages:12, basePower:13, ilvl:14,
      weakTo:['Raio','Natureza'], lore:'Com o eclipse, a maré trouxe de volta os afogados. Um capitão fantasma recruta novos marinheiros.',
      unlock:{ kills:{ boss:1 } } },
    dungeon_tide: { id:'dungeon_tide', kind:'dungeon', chapter:2, title:'Arquivo Submerso', subtitle:'Conhecimento proibido sob a maré.', kicker:'CAPÍTULO II · DUNGEON', difficulty:'Andares I–III', theme:'archive',
      pool:['revenant_scribe','wisp_arc','spider_ink','golem_crystal','fox_storm'], elites:['revenant_crimson','fox_specter'], floorBoss:'oni_storm', floors:3, floorPower:[33, 57, 98], ilvl:18,
      weakTo:['Luz','Terra','Vento'], lore:'A biblioteca que registrava a história do Véu. Seus escribas continuam escrevendo — com tinta venenosa.',
      unlock:{ stage:{ hunt_tide:5 } } },
    boss_tide: { id:'boss_tide', kind:'boss', chapter:2, title:'Abismo de Mizuchi', subtitle:'O dragão das marés aguarda no fundo do mar.', kicker:'CAPÍTULO II · CHEFE', difficulty:'Chefe', theme:'abyss', enemy:'boss_tide', power:100, ilvl:27,
      weakTo:['Raio','Natureza'], lore:'Mizuchi foi o guardião do mar até o eclipse corromper seu coração. Seu Tsunami pode varrer uma equipe despreparada.',
      unlock:{ stage:{ hunt_tide:12 }, floor:{ dungeon_tide:3 } } },
    boss_event: { id:'boss_event', kind:'boss', chapter:9, title:'Festival das Lanternas', subtitle:'A Kitsune desperta durante o festival.', kicker:'EVENTO · CHEFE', difficulty:'Evento', theme:'boss', enemy:'boss_event', power:12, ilvl:15, event:'festival',
      weakTo:['Água','Terra'], lore:'Uma vez a cada ciclo, o Festival das Lanternas acorda a raposa de nove caudas. Quem a vence ganha a chave do festival.',
      unlock:{ kills:{ boss:1 } } }
  };
  const bossTiers = [
    { id:0, name:'Normal', mult:1, reward:1 },
    { id:1, name:'Pesadelo', mult:2.4, reward:2.2, needKills:1 },
    { id:2, name:'Inferno', mult:5.5, reward:4, needKills:3 }
  ];

  // ---------------------------------------------------------------------------
  // EVENTOS MUNDIAIS — giram em blocos de 2 horas (relógio real).
  // ---------------------------------------------------------------------------
  const worldEvents = [
    { id:'golden', name:'Maré Dourada', icon:'🪙', color:'#ffcf6b', text:'+50% de ouro em todas as regiões.', mods:{ gold:.5 } },
    { id:'bloodmoon', name:'Lua de Sangue', icon:'🌕', color:'#ff5d6c', text:'Inimigos +20% ATK. +40% EXP e +30% chance de itens.', mods:{ enemyAtk:.2, xp:.4, drop:.3 } },
    { id:'festival', name:'Festival das Lanternas', icon:'🏮', color:'#ff9ec7', text:'Kitsune das Lanternas disponível. +30% Éter e fogos-fátuos pelo campo.', mods:{ dust:.3 } },
    { id:'starfall', name:'Chuva de Estrelas', icon:'🌠', color:'#6fe3ff', text:'Raridade dos itens melhorada e encontros especiais 2x mais comuns.', mods:{ rarity:.5, encounter:1 } }
  ];
  const EVENT_BLOCK_MS = 2 * 3600 * 1000;

  // ---------------------------------------------------------------------------
  // ENCONTROS ALEATÓRIOS — podem surgir ao fim de uma onda nas caçadas.
  // ---------------------------------------------------------------------------
  const encounters = [
    { id:'gold_fox', name:'Raposa Dourada!', weight:4, text:'Uma raposa dourada carregando moedas apareceu. Derrote-a antes que fuja (12s)!' },
    { id:'merchant', name:'Mercador Errante', weight:3, text:'Um mercador ambulante oferece mercadorias raras.' },
    { id:'shrine', name:'Santuário Antigo', weight:3, text:'Um santuário esquecido oferece uma bênção. Escolha uma.' },
    { id:'ambush', name:'Emboscada!', weight:3, text:'Guardiões cercam a equipe! Vença para recompensas em dobro.' },
    { id:'chest', name:'Baú Misterioso', weight:3, text:'Um baú abandonado no caminho... abrir?' }
  ];
  const blessings = [
    { id:'might', name:'Bênção da Força', text:'+25% ATK para a equipe até o fim do estágio.', stats:{ atk:.25 } },
    { id:'ward', name:'Bênção da Guarda', text:'+25% DEF e 10% menos dano até o fim do estágio.', stats:{ def:.25, dr:.10 } },
    { id:'fortune', name:'Bênção da Fortuna', text:'+60% chance de itens até o fim do estágio.', mods:{ drop:.6 } },
    { id:'renewal', name:'Bênção da Renovação', text:'Restaura todo o HP e revive heróis caídos agora.', instant:'heal' }
  ];

  // ---------------------------------------------------------------------------
  // HISTÓRIA — falas de Sayo, a Guardiã do Véu, e dos chefes.
  // ---------------------------------------------------------------------------
  const story = {
    intro:[
      { who:'Sayo', text:'Viajante... você atravessou o Véu. Eu sou Sayo, a última guardiã de Tsukimori.' },
      { who:'Sayo', text:'Um eclipse engoliu a lua, e com ele vieram monstros. Para enfrentá-los, o Véu pode convocar heróis de outros mundos.' },
      { who:'Sayo', text:'Use a Caixa dos Mundos: você tem dez convocações. Escolha quatro heróis — as duas primeiras vagas são a linha de frente.' }
    ],
    team:[
      { who:'Sayo', text:'Uma equipe! Lembre-se: Vanguardas protegem a frente, Suportes curam, Executores e Atiradores causam dano, Arcanistas dominam habilidades.' },
      { who:'Sayo', text:'Heróis do mesmo elemento, da mesma classe ou com laços de história ficam mais fortes juntos. Veja as sinergias na tela de Equipe.' },
      { who:'Sayo', text:'Agora abra o Mapa e parta para o Bosque das Lanternas. Cada estágio é mais difícil que o anterior — fortaleça-se antes de avançar.' }
    ],
    zone:{
      hunt:[{ who:'Sayo', text:'O Bosque das Lanternas. Raposas e onis rondam as trilhas. A cada 4ª onda, um Guardião bloqueia o caminho.' }, { who:'Sayo', text:'Se a equipe cair, recuaremos um estágio para treinar. Use Q, W, E, R para soltar as ultimates quando a energia encher!' }],
      dungeon:[{ who:'Sayo', text:'O Templo do Véu. Cinco câmaras — na terceira, você escolhe o caminho. No fim, o Guardião Ígneo.' }, { who:'Sayo', text:'Quando um inimigo começar a brilhar em vermelho, ele prepara um ataque devastador. Tenha escudos e curas prontos!' }],
      boss:[{ who:'Shirogane', text:'Mais heróis de mundos distantes... O eclipse devorará vocês como devorou a lua.' }, { who:'Sayo', text:'Cuidado com o Eclipse Total! Guarde ultimates de escudo e cura para esse momento.' }],
      hunt_tide:[{ who:'Sayo', text:'A Costa das Marés. Os afogados roubam vida e energia. Heróis de Raio e Natureza serão valiosos aqui.' }],
      dungeon_tide:[{ who:'Sayo', text:'O Arquivo Submerso. Escribas silenciam heróis e o Guardião da Tempestade atordoa todos. Planeje sua equipe.' }],
      boss_tide:[{ who:'Mizuchi', text:'O mar lembra de tudo que afoga. Vocês serão lembrados... por pouco tempo.' }, { who:'Sayo', text:'O Tsunami de Mizuchi atinge todos. Na fase final, ele afoga a retaguarda — proteja seus Suportes!' }],
      boss_event:[{ who:'Kitsune', text:'Hihihi... Vieram brincar no meu festival? As lanternas adoram novos amigos.' }]
    },
    bossWin:{
      boss:[{ who:'Shirogane', text:'Impossível... a lua... volta a brilhar...' }, { who:'Sayo', text:'O primeiro selo está restaurado! Mas o mar ainda chora. A Costa das Marés foi liberada.' }],
      boss_tide:[{ who:'Mizuchi', text:'O mar... está calmo de novo. Obrigado, heróis de outro mundo.' }, { who:'Sayo', text:'Dois selos restaurados. Continue fortalecendo a equipe: o Pesadelo e o Inferno aguardam os mais corajosos.' }],
      boss_event:[{ who:'Kitsune', text:'Hmph! Tudo bem, vocês ganharam. Levem a chave... e voltem no próximo festival!' }]
    }
  };
  const speakers = { Sayo:{ color:'#ff9ec7', sprite:null, title:'Guardiã do Véu' }, Shirogane:{ color:'#b58cff', sprite:'eclipse', title:'Rei do Eclipse' }, Mizuchi:{ color:'#4fb3ff', sprite:'dragon', title:'Dragão Abissal' }, Kitsune:{ color:'#ff7a4f', sprite:'lantern_kitsune', title:'Espírito do Festival' } };

  // ---------------------------------------------------------------------------
  // GUIA DO VIAJANTE — passo a passo sempre visível, com recompensas.
  // cond é avaliada pelo motor (ver engine.guideDone).
  // ---------------------------------------------------------------------------
  const guide = [
    { id:'g_summon', title:'Convoque seus heróis', desc:'Abra Convocar e use as 10 convocações gratuitas.', go:'collection', cond:{ boxes:10 }, reward:{ gold:200 } },
    { id:'g_team', title:'Monte sua equipe', desc:'Coloque 4 heróis na formação. Vagas 1–2: frente; 3–4: retaguarda.', go:'collection', cond:{ team:4 }, reward:{ gold:300, potion:3 } },
    { id:'g_go', title:'Parta para o Bosque', desc:'Abra o Mapa e inicie o Estágio 1 do Bosque das Lanternas.', go:'journey', cond:{ entered:'hunt' }, reward:{ gold:200 } },
    { id:'g_s1', title:'Vença o Estágio 1-1', desc:'Derrote as 4 ondas do primeiro estágio.', go:'journey', cond:{ stage:['hunt', 1] }, reward:{ gold:400, item:'rare' } },
    { id:'g_equip', title:'Equipe um item', desc:'Abra a Bolsa e equipe uma arma ou acessório em um herói.', go:'inventory', cond:{ equipped:1 }, reward:{ gold:300, ore:5 } },
    { id:'g_ult', title:'Use uma Ultimate', desc:'Quando a barra dourada de energia encher, aperte Q/W/E/R ou clique no botão do herói.', go:null, cond:{ ults:1 }, reward:{ crystal:20 } },
    { id:'g_s3', title:'Vença o Estágio 1-3', desc:'Suba de nível caçando. Estágios anteriores podem ser repetidos para treinar.', go:'journey', cond:{ stage:['hunt', 3] }, reward:{ gold:800, potion:2 } },
    { id:'g_forge', title:'Aprimore um item na Forja', desc:'Na Cidade → Forja, aprimore um equipamento para +1.', go:'forge', cond:{ upgrades:1 }, reward:{ ore:10, gold:500 } },
    { id:'g_s5', title:'Vença o Estágio 1-5', desc:'O Guardião do 5º estágio é forte. Confira as sinergias da equipe!', go:'journey', cond:{ stage:['hunt', 5] }, reward:{ key:1, gold:1000 } },
    { id:'g_dungeon', title:'Conquiste o Templo — Andar I', desc:'Entre no Templo do Véu e derrote o Guardião Ígneo.', go:'journey', cond:{ floor:['dungeon', 1] }, reward:{ crystal:40, item:'epic' } },
    { id:'g_s8', title:'Vença o Estágio 1-8', desc:'Aprimore itens, desperte heróis e treine no Dojo.', go:'journey', cond:{ stage:['hunt', 8] }, reward:{ key:1, ore:20 } },
    { id:'g_s12', title:'Vença o Estágio 1-12', desc:'O último estágio do Bosque abre caminho ao Altar do Eclipse.', go:'journey', cond:{ stage:['hunt', 12] }, reward:{ key:1, gold:4000 } },
    { id:'g_d3', title:'Conquiste o Templo — Andar III', desc:'O andar mais profundo do Templo.', go:'journey', cond:{ floor:['dungeon', 3] }, reward:{ crystal:80, item:'legendary' } },
    { id:'g_boss', title:'Derrote Shirogane', desc:'O Rei do Eclipse. Prepare escudos para o Eclipse Total.', go:'journey', cond:{ kills:['boss', 1] }, reward:{ key:2, crystal:100 } },
    { id:'g_c2', title:'Vença a Costa 2-6', desc:'Afogados drenam energia. Raio e Natureza são fortes aqui.', go:'journey', cond:{ stage:['hunt_tide', 6] }, reward:{ key:1, ore:40 } },
    { id:'g_a1', title:'Conquiste o Arquivo — Andar I', desc:'O Guardião da Tempestade atordoa toda a equipe.', go:'journey', cond:{ floor:['dungeon_tide', 1] }, reward:{ crystal:80, item:'epic' } },
    { id:'g_c12', title:'Vença a Costa 2-12', desc:'O fim da costa — o abismo espera.', go:'journey', cond:{ stage:['hunt_tide', 12] }, reward:{ key:2, gold:12000 } },
    { id:'g_mizuchi', title:'Derrote Mizuchi', desc:'O dragão abissal. Proteja a retaguarda na fase final.', go:'journey', cond:{ kills:['boss_tide', 1] }, reward:{ key:3, crystal:200 } },
    { id:'g_nightmare', title:'Vença um chefe no Pesadelo', desc:'Chefes derrotados liberam dificuldades maiores com itens de conjunto.', go:'journey', cond:{ tierKill:1 }, reward:{ key:2, item:'legendary' } }
  ];

  // Contratos da Guilda — 3 ativos, renovam ao serem resgatados.
  const contracts = [
    { id:'c_kill', title:'Caça Geral', text:'Derrote {n} inimigos.', type:'kills', n:[40, 80, 150], reward:{ gold:1, crystal:6 } },
    { id:'c_elite', title:'Caça aos Guardiões', text:'Derrote {n} elites ou guardiões.', type:'elites', n:[4, 8, 12], reward:{ gold:1.5, ore:6 } },
    { id:'c_stage', title:'Patrulha', text:'Conclua {n} estágios de caçada.', type:'stages', n:[3, 5, 8], reward:{ gold:1.2, crystal:10 } },
    { id:'c_ult', title:'Poder Liberado', text:'Use {n} ultimates.', type:'ults', n:[10, 20, 35], reward:{ crystal:12, potion:1 } },
    { id:'c_loot', title:'Coleta', text:'Obtenha {n} itens.', type:'loot', n:[10, 20, 30], reward:{ gold:1, dust:15 } },
    { id:'c_salvage', title:'Reciclagem', text:'Desmonte {n} itens na Forja.', type:'salvage', n:[5, 10, 15], reward:{ ore:10, dust:10 } },
    { id:'c_dungeon', title:'Exploração', text:'Conclua {n} andar(es) de dungeon.', type:'floors', n:[1, 2, 3], reward:{ crystal:20, ore:8 } },
    { id:'c_encounter', title:'Aventureiro', text:'Resolva {n} encontros especiais.', type:'encounters', n:[1, 2, 3], reward:{ crystal:15, gold:1 } }
  ];

  // Conquistas — metas longas com recompensas.
  const achievements = [
    ...[50, 250, 1000, 5000, 20000].map((n, i) => ({ id:`a_kills_${n}`, title:`Caçador ${['I','II','III','IV','V'][i]}`, text:`Derrote ${n.toLocaleString('pt-BR')} inimigos.`, stat:'kills', n, reward:{ crystal:10 * (i + 1) } })),
    ...[1, 5, 20, 50].map((n, i) => ({ id:`a_boss_${n}`, title:`Matador de Chefes ${['I','II','III','IV'][i]}`, text:`Derrote ${n} chefe(s).`, stat:'bossKills', n, reward:{ key:1 + i } })),
    ...[10, 20, 35, 50, 60].map((n, i) => ({ id:`a_col_${n}`, title:`Colecionador ${['I','II','III','IV','V'][i]}`, text:`Descubra ${n} heróis diferentes.`, stat:'unique', n, reward:{ crystal:25 * (i + 1) } })),
    ...[10, 50, 200].map((n, i) => ({ id:`a_ult_${n}`, title:`Mestre das Ultimates ${['I','II','III'][i]}`, text:`Use ${n} ultimates.`, stat:'ults', n, reward:{ crystal:15 * (i + 1) } })),
    ...[5, 10, 20, 30].map((n, i) => ({ id:`a_lvl_${n}`, title:`Veterano ${['I','II','III','IV'][i]}`, text:`Leve um herói ao nível ${n}.`, stat:'maxLevel', n, reward:{ ore:10 * (i + 1), gold:1000 * (i + 1) } })),
    ...[1, 5, 10].map((n, i) => ({ id:`a_up_${n}`, title:`Ferreiro ${['I','II','III'][i]}`, text:`Aprimore um item até +${n}.`, stat:'maxUpgrade', n, reward:{ ore:15 * (i + 1) } })),
    ...[1, 5, 15].map((n, i) => ({ id:`a_leg_${n}`, title:`Lendário ${['I','II','III'][i]}`, text:`Obtenha ${n} item(ns) lendário(s) ou mítico(s).`, stat:'legendaries', n, reward:{ crystal:30 * (i + 1) } })),
    { id:'a_star5', title:'Despertar Máximo', text:'Desperte um herói até 6★.', stat:'maxStars', n:6, reward:{ key:3 } },
    { id:'a_bonds', title:'Laços Verdadeiros', text:'Ative 2 laços na mesma equipe.', stat:'bondsActive', n:2, reward:{ key:1 } }
  ];

  // ---------------------------------------------------------------------------
  // CIDADE — construções com bônus permanentes.
  // ---------------------------------------------------------------------------
  const buildings = {
    forge:    { id:'forge', name:'Forja de Ren', icon:'⚒', desc:'Aprimora e desmonta itens. Cada nível libera +2 no limite de aprimoramento e reduz o custo em 4%.', baseCost:800, growth:1.8 },
    dojo:     { id:'dojo', name:'Dojo do Eco', icon:'🥋', desc:'Treina heróis fora da equipe (EXP passiva) e aumenta a EXP de combate em 4% por nível.', baseCost:900, growth:1.8 },
    shrine:   { id:'shrine', name:'Santuário da Lua', icon:'⛩', desc:'Convocações, troca de cristais por chaves e Despertar de heróis. Cada nível reduz em 5% o custo de Despertar.', baseCost:1200, growth:1.9 },
    workshop: { id:'workshop', name:'Oficina de Aoi', icon:'⚗', desc:'Cria poções e encantamentos. Cada nível reduz custos em 5% e libera receitas.', baseCost:700, growth:1.75 },
    guild:    { id:'guild', name:'Guilda de Tsukimori', icon:'🏯', desc:'Contratos de caça. +3% de ouro em combate por nível.', baseCost:1000, growth:1.8 },
    market:   { id:'market', name:'Mercado do Porto', icon:'🏮', desc:'Vende itens que mudam a cada 2 horas. Cada nível adiciona uma oferta e melhora a raridade.', baseCost:1500, growth:1.9 }
  };

  const rarities = [
    { id:'common', label:'Comum', color:'#b9c2d6', affixes:0, mult:1.0 },
    { id:'rare', label:'Raro', color:'#4fb3ff', affixes:1, mult:1.25 },
    { id:'epic', label:'Épico', color:'#c07dff', affixes:2, mult:1.55 },
    { id:'legendary', label:'Lendário', color:'#ffb938', affixes:3, mult:1.9 },
    { id:'mythic', label:'Mítico', color:'#ff5d8f', affixes:3, mult:2.3 },
    { id:'set', label:'Conjunto', color:'#5fe39a', affixes:2, mult:1.7 }
  ];
  const heroRarities = [
    { id:'common', label:'Comum', color:'#b9c2d6', mult:1.0, chance:.55, shards:5 },
    { id:'rare', label:'Raro', color:'#4fb3ff', mult:1.12, chance:.30, shards:10 },
    { id:'epic', label:'Épico', color:'#c07dff', mult:1.26, chance:.12, shards:20 },
    { id:'legendary', label:'Lendário', color:'#ffb938', mult:1.42, chance:.03, shards:40 }
  ];

  // Efeitos de status — texto usado na UI e na wiki.
  const statusInfo = {
    burn:{ name:'Queimadura', icon:'🔥', color:'#ff7a4f', text:'Dano por segundo baseado no ATK de quem aplicou. Ignora defesa.' },
    poison:{ name:'Veneno', icon:'☠', color:'#8fe36b', text:'Dano por segundo que acumula até 5 vezes.' },
    bleed:{ name:'Sangramento', icon:'🩸', color:'#ff4a6a', text:'Dano por segundo. Alvos sangrando recebem +10% de dano crítico.' },
    stun:{ name:'Atordoamento', icon:'💫', color:'#ffe98a', text:'Não pode agir. Chefes resistem a 60% da duração.' },
    freeze:{ name:'Congelamento', icon:'❄', color:'#91dfff', text:'Não pode agir e recebe +20% de dano. Chefes resistem a 60%.' },
    slow:{ name:'Lentidão', icon:'🐌', color:'#9fb3ff', text:'Velocidade de ataque reduzida.' },
    armorBreak:{ name:'Quebra de Armadura', icon:'⛨', color:'#ffd76a', text:'Defesa reduzida.' },
    mark:{ name:'Marca', icon:'🎯', color:'#ff9ec7', text:'Recebe mais dano de todas as fontes.' },
    weaken:{ name:'Fraqueza', icon:'⬇', color:'#c9a4ff', text:'ATK reduzido.' },
    silence:{ name:'Silêncio', icon:'🤐', color:'#aaa5d0', text:'Não pode usar habilidades nem ultimates.' },
    atk:{ name:'Fúria', icon:'⚔', color:'#ff9a6b', text:'ATK aumentado.', buff:true },
    def:{ name:'Guarda', icon:'🛡', color:'#6fb8ff', text:'DEF aumentada.', buff:true },
    spd:{ name:'Pressa', icon:'💨', color:'#9ce9cc', text:'Velocidade de ataque aumentada.', buff:true },
    crit:{ name:'Precisão', icon:'🎯', color:'#ffd76a', text:'Chance de crítico aumentada.', buff:true },
    critDmg:{ name:'Letalidade', icon:'💥', color:'#ffb938', text:'Dano crítico aumentado.', buff:true },
    dodge:{ name:'Evasão', icon:'🌀', color:'#9ce9cc', text:'Esquiva aumentada.', buff:true },
    lifesteal:{ name:'Vampirismo', icon:'🩸', color:'#ff5d8f', text:'Cura parte do dano causado.', buff:true },
    dr:{ name:'Barreira', icon:'🔰', color:'#8fe9ff', text:'Recebe menos dano.', buff:true },
    regen:{ name:'Regeneração', icon:'✚', color:'#5fe39a', text:'Recupera HP por segundo.', buff:true },
    stealth:{ name:'Furtividade', icon:'👤', color:'#aaa5d0', text:'Não pode ser alvo de ataques diretos.', buff:true },
    taunt:{ name:'Provocação', icon:'📢', color:'#ff9a6b', text:'Inimigos são forçados a atacá-lo.', buff:true }
  };

  const statNames = { atk:'ATK', hp:'HP', def:'DEF', spd:'Velocidade', crit:'Crítico', critDmg:'Dano crítico', dodge:'Esquiva', lifesteal:'Roubo de vida', dr:'Redução de dano', regen:'Regeneração', healPow:'Cura e escudos', dot:'Dano contínuo', boss:'Dano contra chefes', pierce:'Perfuração de DEF', skill:'Dano de habilidade', nrg:'Ganho de energia', cdr:'Recarga de habilidade', startNrg:'Energia inicial', elem:'Dano elemental' };

  KT.Data = { elements, classes, elementSynergy, bonds, enemies, zones, bossTiers, STAGE_GROWTH, worldEvents, EVENT_BLOCK_MS, encounters, blessings, story, speakers, guide, contracts, achievements, buildings, rarities, heroRarities, statusInfo, statNames };
})();
