(() => {
  const KT = globalThis.KT;
  const D = KT.Data;

  // ---------------------------------------------------------------------------
  // Linguagem de efeitos (compartilhada com monstros e itens)
  //  dmg    { m: multiplicador do ATK, to, hits, pierce, crit, exec }
  //  st     { s: status, d: duração, v: valor, ch: chance, to }
  //  heal   { m: × ATK de quem cura  |  p: % do HP máximo do alvo, to }
  //  shield { m | p, to, d }
  //  buff   { s: atributo, v, d, to, stack }
  //  nrg    { v, to }   cleanse { to }   taunt { d }   drain { v }
  //  revive { p }   cdr { v, to }   hp { p (negativo = custo de vida), to }
  // Alvos: tgt (alvo atual) · all · low (menor HP%) · high (maior HP) · rand · randEach
  //        back (retaguarda inimiga) · front · attacker · self · allies · lowAlly · atkAlly
  // ---------------------------------------------------------------------------
  const dmg = (m, to = 'tgt', o = {}) => ({ k:'dmg', m, to, ...o });
  const st = (s, d, v = 0, ch = 1, to = 'tgt') => ({ k:'st', s, d, v, ch, to });
  const heal = (m, to = 'lowAlly') => (typeof m === 'object' ? { k:'heal', ...m, to } : { k:'heal', m, to });
  const shield = (m, to = 'self', d = 6) => (typeof m === 'object' ? { k:'shield', ...m, to, d } : { k:'shield', m, to, d });
  const buff = (s, v, d, to = 'self', o = {}) => ({ k:'buff', s, v, d, to, ...o });
  const nrg = (v, to = 'self') => ({ k:'nrg', v, to });
  const cleanse = (to = 'allies') => ({ k:'cleanse', to });
  const taunt = d => ({ k:'taunt', d });
  const drain = v => ({ k:'drain', v });
  const revive = p => ({ k:'revive', p });
  const cdr = (v, to = 'self') => ({ k:'cdr', v, to });
  const selfHp = p => ({ k:'hp', p, to:'self' });
  const dispel = (to = 'tgt') => ({ k:'dispel', to });
  const delay = (v, to = 'tgt') => ({ k:'delay', v, to });
  const execute = (th, to = 'tgt') => ({ k:'execute', th, to });
  const chain = (m, n = 3, fall = .7) => ({ k:'chain', m, n, fall });

  // Formas despertadas (Temporada I) → herói original.
  const AWAKEN_BASE = { goku_ui:'solen', sasuke_susanoo:'ren', gojo_void:'sora', tanjiro_hinokami:'akira', ichigo_bankai:'hiro', vegeta_ego:'varyon',
    luffy_gear5:'tobias', naruto_kurama:'hayato', mercy_valkyrie:'aurelia', sailor_eternal:'aiko', dante_dt:'rex', jinx_arcane:'zara' };
  const ORIGINAL_NAMES = {
    solen:'Goku', varyon:'Vegeta', hayato:'Naruto Uzumaki', ren:'Sasuke Uchiha', tobias:'Monkey D. Luffy', kenji:'Roronoa Zoro',
    hiro:'Ichigo Kurosaki', yuki:'Rukia Kuchiki', akira:'Tanjiro Kamado', hana:'Nezuko Kamado', sora:'Satoru Gojo', daichi:'Yuji Itadori',
    lucan:'Levi Ackerman', mira:'Mikasa Ackerman', erik:'Eren Yeager', alden:'Edward Elric', ignis:'Roy Mustang', toma:'Izuku Midoriya',
    ryo:'Katsuki Bakugo', grant:'All Might', kenta:'Saitama', volt:'Genos', kai:'Gon Freecss', riku:'Killua Zoldyck', elian:'Kurapika',
    aiko:'Sailor Moon', kiba:'Inuyasha', jin:'Kenshin Himura', drake:'Natsu Dragneel', sienna:'Erza Scarlet',
    daigo:'Ryu', mei:'Chun-Li', kael:'Cloud Strife', sael:'Sephiroth', rina:'Tifa Lockhart', nadia:'Lara Croft', thorn:'Kratos', bjorn:'Atreus',
    rook:'Master Chief', warden:'Doom Slayer', zara:'Jinx', kira:'Ahri', haru:'Yasuo', ivy:'Tracer', nari:'D.Va', aurelia:'Mercy',
    dario:'Ezio Auditore', cole:'Leon S. Kennedy', dana:'Jill Valentine', wade:'Arthur Morgan', garrick:'Geralt de Rívia', zira:'Ciri',
    n9:'2B', unit7:'A2', rex:'Dante', virel:'Vergil', selene:'Bayonetta', tessa:'Aloy', kaji:'Scorpion', kori:'Sub-Zero'
  };
  // Os ids permanecem estáveis para preservar todos os saves existentes; só o nome exibido volta ao original.
  const H = (id, name, world, origin, cls, el, prof, passive, skill, ult, color) => ({ id, name:ORIGINAL_NAMES[id] || name, world, origin, cls, el, prof, passive, skill, ult, color, base:AWAKEN_BASE[id] || id });
  const P = (name, hooks) => ({ name, hooks });
  const S = (name, cd, eff, fx = 'burst') => ({ name, cd, eff, fx });
  const Ult = (name, eff, fx = 'ult') => ({ name, eff, fx });

  const heroes = [
    H('solen','Solen Kairos','Picos de Aurum','fenda','Arcanista','Luz',{ atk:1.05, hp:1.05 },
      P('Sangue Estelar', { stats:{ atk:.05 }, low:{ th:.35, eff:[buff('atk', .4, 8), heal({ p:.2 }, 'self')] } }),
      S('Onda Solar', 9, [dmg(2.6, 'tgt', { pierce:.3 })], 'beam'),
      Ult('Esfera dos Mil Sóis', [dmg(3.0, 'all'), st('stun', 1.2, 0, .5, 'all')])),
    H('varyon','Varyon, o Príncipe Cinza','Picos de Aurum','fenda','Executor','Raio',{ atk:1.08, def:.95 },
      P('Orgulho Real', { onCrit:{ eff:[buff('atk', .06, 8, 'self', { stack:5 })] } }),
      S('Disparo Violeta', 8, [dmg(2.2), st('armorBreak', 5, .25)], 'beam'),
      Ult('Raio Real', [dmg(4.4, 'tgt', { pierce:.5 }), st('stun', 1.5)])),
    H('hayato','Hayato Kazeno','Vila do Redemoinho','fenda','Vanguarda','Vento',{ hp:1.08 },
      P('Espírito do Vento', { stats:{ hp:.10 }, low:{ th:.4, once:true, eff:[heal({ p:.25 }, 'self'), buff('dr', .3, 6)] } }),
      S('Legião de Sombras', 10, [taunt(4), shield(1.5, 'self', 6), dmg(1.0, 'randEach', { hits:3 })], 'slash'),
      Ult('Ciclone Cortante', [dmg(2.3, 'all'), st('slow', 4, .3, 1, 'all')])),
    H('ren','Rai Kurogane','Vila do Redemoinho','fenda','Arcanista','Raio',{ atk:1.04, hp:.95 },
      P('Olhos Rubros', { stats:{ dodge:.12 }, onDodge:{ eff:[dmg(1.2, 'attacker')] } }),
      S('Lança Trovejante', 8, [dmg(2.8, 'tgt', { pierce:.2 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Chama do Eclipse', [dmg(2.2, 'high'), st('burn', 8, .8, 1, 'high'), st('burn', 6, .25, 1, 'all')])),
    H('tobias','Tobias Maré','Arquipélago das Velas','fenda','Vanguarda','Fogo',{ atk:1.06 },
      P('Corpo Resiliente', { stats:{ dr:.10 }, onHurt:{ ch:.25, eff:[nrg(10)] } }),
      S('Rajada de Punhos', 8, [dmg(.6, 'tgt', { hits:5 })], 'slash'),
      Ult('Maré Gigante', [buff('atk', .5, 8), buff('spd', .4, 8), taunt(4), heal({ p:.3 }, 'self')])),
    H('kenji','Kenji Tríplice','Arquipélago das Velas','fenda','Executor','Vento',{ atk:1.05, hp:1.05 },
      P('Tríade de Aço', { stats:{ critDmg:.2 }, every:{ n:3, eff:[dmg(1.2, 'tgt', { pierce:.4 })] } }),
      S('Corte Cruzado', 7, [dmg(2.4), st('bleed', 5, .3)], 'slash'),
      Ult('Tempestade de Lâminas', [dmg(.9, 'all', { hits:3 })])),
    H('hiro','Hiro Kagetsu','Vale das Almas','fenda','Executor','Sombra',{ atk:1.04, hp:1.04 },
      P('Voz Interior', { low:{ th:.3, eff:[buff('atk', .6, 10), buff('lifesteal', .2, 10)] } }),
      S('Crescente Cortante', 8, [dmg(2.0, 'high', { pierce:.3 }), dmg(.6, 'all')], 'wave'),
      Ult('Lua Sem Fim', [dmg(5.0, 'tgt', { pierce:.6 }), buff('atk', -.3, 6)])),
    H('yuki','Yuki Shirasagi','Vale das Almas','fenda','Suporte','Gelo',{ atk:1.05 },
      P('Dança da Neve', { onAtk:{ ch:.2, eff:[st('freeze', 1.5)] } }),
      S('Lótus Branca', 10, [dmg(1.1, 'all'), st('slow', 4, .35, 1, 'all'), shield(1.0, 'front', 6)], 'wave'),
      Ult('Floresta de Gelo Eterno', [st('freeze', 3, 0, 1, 'all'), st('mark', 6, .25, 1, 'all')])),
    H('akira','Akira Minase','Montanhas do Carvão','fenda','Executor','Água',{ hp:1.05 },
      P('Faro Apurado', { stats:{ crit:.05 }, onKill:{ eff:[nrg(30), heal({ p:.08 }, 'self')] } }),
      S('Correnteza Giratória', 7, [dmg(1.2, 'all'), heal({ p:.05 }, 'self')], 'wave'),
      Ult('Dança da Brasa', [dmg(3.6), st('burn', 6, .5), buff('atk', .25, 8)])),
    H('hana','Hana Minase','Montanhas do Carvão','fenda','Vanguarda','Fogo',{ hp:1.05 },
      P('Sangue Regenerativo', { stats:{ regen:.015 } }),
      S('Chute Carmesim', 7, [dmg(1.8), taunt(3), buff('regen', .03, 4)], 'slash'),
      Ult('Sangue Incandescente', [dmg(2.0, 'all'), st('burn', 6, .4, 1, 'all'), cleanse('allies')])),
    H('sora','Sora Hakuren','Academia do Véu','fenda','Arcanista','Luz',{ atk:1.08, hp:.95 },
      P('Espaço Intocável', { start:{ eff:[shield({ p:.3 }, 'self', 20)] } }),
      S('Ponto Rubro', 9, [dmg(2.2), dispel('tgt'), delay(3)], 'beam'),
      Ult('Colapso Índigo', [dmg(3.0, 'all', { pierce:1 }), dispel('all')])),
    H('daichi','Daichi Kuroba','Academia do Véu','fenda','Vanguarda','Sombra',{ atk:1.08 },
      P('Punho Maldito', { onAtk:{ ch:.12, eff:[dmg(2.5, 'tgt', { crit:1 })] } }),
      S('Punho Atrasado', 7, [dmg(1.4, 'tgt', { hits:2 }), taunt(3), buff('def', .3, 5)], 'slash'),
      Ult('Despertar Amaldiçoado', [dmg(2.2, 'all'), st('bleed', 6, .35, 1, 'all'), drain(.3)])),
    H('lucan','Lucan Voss','Muralhas de Eldria','fenda','Executor','Vento',{ atk:1.06, hp:.95 },
      P('Veterano Implacável', { stats:{ spd:.15, crit:.10 }, onKill:{ eff:[cdr(3)] } }),
      S('Investida Vertical', 6, [dmg(1.0, 'low', { hits:3 })], 'slash'),
      Ult('Giro Cortante', [dmg(1.5, 'all', { hits:2, exec:.8 })])),
    H('mira','Mira Voss','Muralhas de Eldria','fenda','Executor','Vento',{ hp:1.05 },
      P('Proteger a Família', { allyLow:{ th:.3, eff:[buff('atk', .35, 8), taunt(3)] } }),
      S('Lâminas Gêmeas', 7, [dmg(1.3, 'tgt', { hits:2, exec:.6 })], 'slash'),
      Ult('Fúria do Clã', [dmg(1.1, 'low', { hits:4 }), buff('spd', .3, 6)])),
    H('erik','Erik Hallen','Muralhas de Eldria','fenda','Vanguarda','Terra',{ hp:1.1, def:1.05 },
      P('Forma Colossal', { stats:{ hp:.20, def:.10 }, low:{ th:.5, once:true, eff:[shield({ p:.35 }, 'self', 8)] } }),
      S('Soco Colossal', 8, [dmg(1.7), st('stun', 1.3, 0, .7), taunt(4)], 'slash'),
      Ult('Colosso Primordial', [dmg(1.6, 'all'), st('weaken', 6, .25, 1, 'all'), buff('dr', .35, 8, 'allies')])),
    H('alden','Alden Ferro','Cidade da Transmutação','fenda','Suporte','Terra',{ def:1.1 },
      P('Alquimia de Combate', { stats:{ healPow:.20 }, start:{ eff:[shield(1.2, 'front', 8)] } }),
      S('Muralha de Aço', 10, [shield(1.8, 'front', 8), dmg(1.0)], 'buff'),
      Ult('Transmutação Suprema', [shield(2.2, 'allies', 10), st('armorBreak', 6, .3, 1, 'all')])),
    H('ignis','Coronel Ignis Varra','Cidade da Transmutação','fenda','Arcanista','Fogo',{ atk:1.05 },
      P('Mestre das Brasas', { stats:{ dot:.20 }, vs:{ s:'burn', v:.25 } }),
      S('Faísca Alquímica', 7, [dmg(1.5, 'rand'), st('burn', 6, .4, 1, 'rand'), dmg(1.0, 'rand')], 'burst'),
      Ult('Inferno do Deserto', [dmg(1.4, 'all'), st('burn', 8, .6, 1, 'all'), st('mark', 6, .15, 1, 'all')])),
    H('toma','Toma Hikari','Academia dos Dons','fenda','Vanguarda','Raio',{ atk:1.06 },
      P('Poder Herdado', { every:{ n:5, eff:[dmg(2.0), selfHp(-.04)] } }),
      S('Rajada de Dedo', 8, [dmg(1.5, 'all'), taunt(3)], 'wave'),
      Ult('Soco Supremo', [dmg(4.2), st('stun', 2), selfHp(-.12)])),
    H('ryo','Ryo Kazan','Academia dos Dons','fenda','Arcanista','Fogo',{ atk:1.06, hp:.97 },
      P('Palmas Explosivas', { onAtk:{ ch:1, eff:[buff('atk', .03, 10, 'self', { stack:10 })] } }),
      S('Tiro Guiado', 7, [dmg(2.0, 'tgt', { pierce:.3 }), dispel('tgt')], 'beam'),
      Ult('Impacto Giratório', [dmg(3.2), dmg(1.0, 'all'), dispel('all')])),
    H('grant','Grant Valor','Academia dos Dons','fenda','Vanguarda','Luz',{ atk:1.08, hp:1.05 },
      P('Símbolo da Esperança', { aura:{ atk:.08 }, start:{ eff:[buff('dr', .2, 6, 'allies')] } }),
      S('Golpe Vendaval', 8, [dmg(1.8), taunt(4), shield(1.2, 'self')], 'wave'),
      Ult('Golpe da Nação', [dmg(4.0, 'tgt', { pierce:.4 }), buff('atk', .2, 8, 'allies')])),
    H('kenta','Mestre Kenta','Metrópole Cinzenta','fenda','Vanguarda','Luz',{ atk:1.1, hp:1.05, def:1.05 },
      P('Treino Diário', { stats:{ hp:.10, atk:.10, def:.10 }, onAtk:{ ch:.03, eff:[dmg(10, 'tgt', { pierce:1 })] } }),
      S('Socos em Série', 8, [dmg(.5, 'tgt', { hits:8 }), taunt(3)], 'slash'),
      Ult('Golpe Definitivo', [dmg(7.0, 'tgt', { pierce:1 })])),
    H('volt','Volt-7','Metrópole Cinzenta','fenda','Atirador','Fogo',{ atk:1.04 },
      P('Núcleo Térmico', { stats:{ crit:.05 }, onCrit:{ eff:[st('burn', 4, .3)] } }),
      S('Canhão Térmico', 8, [dmg(1.8, 'tgt', { pierce:.4 }), st('burn', 4, .3), st('armorBreak', 4, .15)], 'beam'),
      Ult('Sobrecarga do Núcleo', [dmg(3.0, 'all'), selfHp(-.2)])),
    H('kai','Kai Morinaga','Terras Selvagens','fenda','Vanguarda','Natureza',{ atk:1.05 },
      P('Instinto Selvagem', { low:{ th:.3, once:true, eff:[buff('atk', 1.0, 6)] } }),
      S('Punho Carregado', 7, [dmg(2.8, 'tgt', { exec:.5 }), taunt(2), selfHp(-.03)], 'slash'),
      Ult('Forma do Juramento', [buff('atk', .8, 10), buff('dr', .3, 10), dmg(2.0)])),
    H('riku','Riku Shiro','Terras Selvagens','fenda','Executor','Raio',{ atk:1.02, hp:.95 },
      P('Passo Relâmpago', { stats:{ spd:.20, dodge:.10 }, onDodge:{ eff:[dmg(1.0, 'attacker')] } }),
      S('Coroa Trovejante', 7, [dmg(.8, 'tgt', { hits:3 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Relâmpago Divino', [dmg(1.2, 'all', { hits:2 }), st('stun', 1.5, 0, .6, 'all')])),
    H('elian','Elian Rubra','Terras Selvagens','fenda','Suporte','Luz',{ atk:1.04 },
      P('Pacto das Correntes', { stats:{ healPow:.20 }, allyLow:{ th:.4, eff:[shield(1.5, 'lowAlly', 6)] } }),
      S('Grilhão Restaurador', 9, [heal(2.2, 'lowAlly'), cleanse('lowAlly')], 'heal'),
      Ult('Sentença Acorrentada', [st('silence', 6, 0, 1, 'high'), st('stun', 2, 0, 1, 'high'), dmg(2.5, 'high'), heal(1.5, 'allies')])),
    H('aiko','Aiko Lunaris','Reino da Lua Prateada','fenda','Suporte','Luz',{ hp:1.05 },
      P('Cristal Lunar', { aura:{ regen:.006 } }),
      S('Tiara Lunar', 8, [dmg(1.2), heal(.6, 'allies'), cleanse('lowAlly')], 'heal'),
      Ult('Cura do Luar', [heal(3.0, 'allies'), cleanse('allies'), st('weaken', 5, .2, 1, 'all')])),
    H('kiba','Kiba, o Meio-Espírito','Era das Brumas','fenda','Vanguarda','Vento',{ atk:1.05 },
      P('Sangue Espiritual', { low:{ th:.25, eff:[buff('atk', .5, 8), shield({ p:.15 }, 'self', 6)] } }),
      S('Garras de Aço', 7, [dmg(1.0, 'tgt', { hits:2 }), st('bleed', 5, .3), taunt(3)], 'slash'),
      Ult('Fenda do Vendaval', [dmg(2.2, 'all', { pierce:.2 }), execute(.12, 'all')])),
    H('jin','Jin Hayate','Era das Brumas','fenda','Executor','Vento',{ atk:1.04 },
      P('Saque Relâmpago', { stats:{ spd:.10 }, start:{ eff:[dmg(1.5, 'high')] } }),
      S('Queda da Garça', 7, [dmg(2.5, 'tgt', { crit:.4 }), execute(.15)], 'slash'),
      Ult('Relâmpago do Céu Alto', [dmg(4.2, 'tgt', { crit:.5 }), execute(.2)])),
    H('drake','Drake Ember','Guildas de Valmar','fenda','Arcanista','Fogo',{ hp:1.06 },
      P('Comedor de Chamas', { vs:{ s:'burn', v:.2 }, onKill:{ eff:[heal({ p:.1 }, 'self')] } }),
      S('Rugido Flamejante', 8, [dmg(1.4, 'all'), st('burn', 5, .35, .7, 'all')], 'wave'),
      Ult('Forma Draconiana', [buff('atk', .4, 8), dmg(1.6, 'all'), st('burn', 6, .5, 1, 'all')])),
    H('sienna','Sienna Valmar','Guildas de Valmar','fenda','Vanguarda','Terra',{ def:1.08 },
      P('Arsenal Mutável', { stats:{ def:.10 }, start:{ eff:[buff('def', .3, 8), buff('atk', .15, 8)] } }),
      S('Armadura Adamantina', 10, [shield(2.0, 'self', 8), taunt(5), shield(.8, 'allies', 6)], 'buff'),
      Ult('Armadura do Céu', [dmg(.6, 'all', { hits:5 })])),
    H('daigo','Daigo Arashi','Torneio das Nações','fenda','Vanguarda','Fogo',{ def:1.05 },
      P('Caminho do Guerreiro', { stats:{ def:.10 }, onHurt:{ ch:.2, eff:[dmg(1.0, 'attacker')] } }),
      S('Esfera de Ki', 7, [dmg(2.0, 'back'), delay(1.5, 'back')], 'beam'),
      Ult('Punho Ascendente', [dmg(3.4, 'tgt', { crit:.3 }), st('stun', 1.5), buff('dr', .25, 5)])),
    H('mei','Mei Lan','Torneio das Nações','fenda','Executor','Vento',{ atk:.98 },
      P('Pernas Relâmpago', { stats:{ spd:.25 }, every:{ n:4, eff:[dmg(.4, 'tgt', { hits:3 })] } }),
      S('Tempestade de Chutes', 7, [dmg(.35, 'tgt', { hits:8 })], 'slash'),
      Ult('Giro da Garça', [dmg(.5, 'tgt', { hits:8 }), st('stun', 1.5), buff('dodge', .2, 6)])),
    H('kael','Kael Arden','Planeta Esmeralda','fenda','Executor','Raio',{ atk:1.06, hp:1.04 },
      P('Mercenário Errante', { stats:{ critDmg:.25 }, onKill:{ eff:[nrg(25)] } }),
      S('Corte em X', 8, [dmg(.8, 'tgt', { hits:3 }), st('armorBreak', 5, .2)], 'slash'),
      Ult('Nove Golpes Celestes', [dmg(.8, 'randEach', { hits:8 })])),
    H('sael','Sael, a Asa Negra','Planeta Esmeralda','fenda','Arcanista','Sombra',{ atk:1.1, hp:.95 },
      P('Asa Sombria', { stats:{ atk:.12 }, onKill:{ eff:[buff('atk', .1, 10, 'self', { stack:5 })] } }),
      S('Oito Cortes', 8, [dmg(.4, 'tgt', { hits:8 }), st('mark', 4, .15)], 'slash'),
      Ult('Estrela Cadente', [dmg(2.0, 'all', { pierce:.3 }), st('weaken', 6, .25, 1, 'all'), st('burn', 6, .4, 1, 'all')])),
    H('rina','Rina Akemi','Planeta Esmeralda','fenda','Suporte','Terra',{ atk:1.08, hp:1.05 },
      P('Estilo do Punho Livre', { low:{ th:.5, once:true, eff:[heal({ p:.25 }, 'self')] }, onAtk:{ ch:.25, eff:[nrg(8, 'allies')] } }),
      S('Sequência de Golpes', 8, [dmg(.7, 'tgt', { hits:3 }), heal(1.2, 'lowAlly')], 'heal'),
      Ult('Golpe do Firmamento', [dmg(3.2), buff('atk', .25, 8, 'allies'), nrg(20, 'allies')])),
    H('nadia','Nádia Crane','Ruínas Perdidas','fenda','Atirador','Terra',{ atk:1.02 },
      P('Sobrevivente', { stats:{ dodge:.10, crit:.08 }, onKill:{ eff:[buff('spd', .15, 5)] } }),
      S('Tiro Preciso', 7, [dmg(2.6, 'high', { pierce:.4 })], 'beam'),
      Ult('Flechas Explosivas', [dmg(1.6, 'all'), st('bleed', 5, .25, 1, 'all'), st('armorBreak', 5, .2, 1, 'all')])),
    H('thorn','Thorn Varg','Reinos Nórdicos','fenda','Vanguarda','Gelo',{ atk:1.06, hp:1.06 },
      P('Fúria Guerreira', { onHurt:{ ch:1, eff:[nrg(4)] }, low:{ th:.35, eff:[buff('atk', .5, 8), buff('dr', .3, 8)] } }),
      S('Arremesso do Machado Gélido', 8, [dmg(2.0), st('freeze', 1.5, 0, .5), taunt(3)], 'slash'),
      Ult('Ira do Guerreiro', [dmg(1.2, 'all', { hits:2 }), heal({ p:.25 }, 'self'), taunt(4)])),
    H('bjorn','Bjorn Varg','Reinos Nórdicos','fenda','Suporte','Natureza',{ atk:1.04 },
      P('Flechas Rúnicas', { onAtk:{ ch:.3, eff:[st('mark', 4, .12)] } }),
      S('Flecha de Luz', 9, [dmg(1.4), heal(1.8, 'lowAlly')], 'heal'),
      Ult('Invocação Rúnica', [buff('atk', .3, 8, 'allies'), buff('crit', .15, 8, 'allies'), st('mark', 6, .2, 1, 'all')])),
    H('rook','Comandante Rook','Frota de Órion','fenda','Atirador','Raio',{ hp:1.1, def:1.1 },
      P('Escudo de Energia', { stats:{ def:.15 }, start:{ eff:[shield({ p:.25 }, 'self', 30)] } }),
      S('Granada de Fragmentação', 8, [dmg(1.3, 'all'), st('armorBreak', 4, .2, 1, 'all')], 'wave'),
      Ult('Canhão Orbital', [dmg(3.6, 'high', { pierce:.5 }), st('stun', 1.5, 0, 1, 'high')])),
    H('warden','O Carrasco','Portões do Abismo','fenda','Atirador','Fogo',{ atk:1.06, hp:1.05 },
      P('Carnificina', { stats:{ atk:.10 }, onKill:{ eff:[heal({ p:.12 }, 'self'), nrg(15)] } }),
      S('Escopeta Dupla', 7, [dmg(2.8), dmg(.8, 'rand')], 'burst'),
      Ult('Canhão de Plasma', [dmg(2.6, 'all', { pierce:.3 }), heal({ p:.15 }, 'self')])),
    H('zara','Zara Fagulha','Cidade Subterrânea','fenda','Atirador','Fogo',{ atk:1.05, hp:.95 },
      P('Euforia', { onKill:{ eff:[buff('spd', .4, 6, 'self', { stack:3 })] } }),
      S('Faísca!', 7, [dmg(1.8), st('slow', 3, .35)], 'beam'),
      Ult('Míssil Maluco', [dmg(2.4, 'all', { exec:1.0 }), buff('spd', .3, 6)])),
    H('kira','Kira das Nove Caudas','Bosque Espiritual','fenda','Arcanista','Luz',{ atk:1.02 },
      P('Essência Vital', { stats:{ spd:.05 }, onAtk:{ ch:.35, eff:[heal(.3, 'self')] } }),
      S('Encanto', 8, [dmg(1.8), st('stun', 1.6), st('mark', 4, .2)], 'beam'),
      Ult('Dança dos Fogos-Fátuos', [dmg(1.2, 'randEach', { hits:3 }), buff('dodge', .3, 4)])),
    H('haru','Haru Kaze','Planícies de Ionar','fenda','Executor','Vento',{ atk:1.04 },
      P('Andarilho do Vento', { stats:{ crit:.15 }, start:{ eff:[shield({ p:.15 }, 'self', 10)] } }),
      S('Vórtice de Aço', 6, [dmg(1.6), buff('crit', .1, 10, 'self', { stack:3 })], 'slash'),
      Ult('Vendaval Final', [dmg(3.4, 'tgt', { pierce:.5, crit:.3 }), buff('critDmg', .5, 6)])),
    H('ivy','Ivy Tempo','Esquadrão Aurora','fenda','Atirador','Raio',{ hp:.9 },
      P('Salto Temporal', { stats:{ dodge:.20, spd:.15 } }),
      S('Retrocesso', 12, [heal({ p:.3 }, 'self'), cleanse('self'), dmg(.4, 'tgt', { hits:4 })], 'heal'),
      Ult('Mina Cronal', [dmg(3.8), dmg(1.0, 'all')])),
    H('nari','Nari Mecha','Esquadrão Aurora','fenda','Vanguarda','Raio',{ hp:1.08 },
      P('Campo Refletor', { stats:{ hp:.10 }, onHurt:{ ch:.25, eff:[shield(.6, 'self', 4)] } }),
      S('Propulsores', 8, [dmg(1.2, 'all'), taunt(4), shield(.6, 'self', 5)], 'slash'),
      Ult('Autodestruição', [dmg(3.0, 'all'), shield(1.5, 'allies', 6)])),
    H('aurelia','Aurélia Asas','Esquadrão Aurora','fenda','Suporte','Luz',{ hp:1.02 },
      P('Anjo da Guarda', { stats:{ healPow:.25 } }),
      S('Cajado Curativo', 8, [heal(2.4, 'lowAlly'), buff('atk', .2, 5, 'atkAlly')], 'heal'),
      Ult('Ressurreição', [revive(.5), heal(2.0, 'allies')])),
    H('dario','Dario Venturi','Irmandade Oculta','fenda','Executor','Sombra',{ atk:1.03 },
      P('Credo das Sombras', { stats:{ critDmg:.30 }, start:{ eff:[buff('stealth', 1, 4)] } }),
      S('Lâmina do Punho', 7, [dmg(2.2, 'low', { exec:1.2 })], 'slash'),
      Ult('Mergulho do Telhado', [dmg(4.5, 'low', { exec:1.5, crit:.5 }), buff('stealth', 1, 3)])),
    H('cole','Cole Harper','Cidade Infectada','fenda','Atirador','Fogo',{ hp:1.03 },
      P('Mira de Precisão', { every:{ n:4, eff:[dmg(1.8, 'tgt', { crit:1 })] } }),
      S('Tiro na Cabeça', 7, [dmg(2.4, 'tgt', { crit:.5 }), delay(2)], 'beam'),
      Ult('Magnum e Chute', [dmg(1.2, 'all'), dmg(3.0, 'high')])),
    H('dana','Dana Reyes','Cidade Infectada','fenda','Suporte','Natureza',{ hp:1.04 },
      P('Mestra da Sobrevivência', { stats:{ healPow:.15 }, start:{ eff:[buff('dodge', .1, 10, 'allies')] } }),
      S('Spray de Primeiros Socorros', 9, [heal(2.0, 'lowAlly'), cleanse('lowAlly'), buff('regen', .02, 5, 'lowAlly')], 'heal'),
      Ult('Granada Incendiária', [dmg(1.6, 'all'), st('burn', 6, .4, 1, 'all'), heal(1.2, 'allies')])),
    H('wade','Wade Callahan','Fronteira Selvagem','fenda','Atirador','Terra',{ hp:1.05 },
      P('Código do Fora-da-Lei', { onCrit:{ eff:[nrg(10)] } }),
      S('Revólver de Seis Tiros', 7, [dmg(.7, 'tgt', { hits:4 })], 'burst'),
      Ult('Mira Lenta', [dmg(1.6, 'randEach', { hits:6, crit:.4 })])),
    H('garrick','Garrick do Vale','Reinos do Norte','fenda','Arcanista','Fogo',{ hp:1.1 },
      P('Sangue Mutante', { stats:{ hp:.10 }, vs:{ s:'burn', v:.2 }, start:{ eff:[shield(1.2, 'self', 10)] } }),
      S('Runa Ígnea', 8, [dmg(1.2, 'all'), st('burn', 5, .35, 1, 'all'), dispel('all')], 'wave'),
      Ult('Runa de Impacto', [st('stun', 1.5, 0, 1, 'all'), dmg(1.8, 'all'), st('armorBreak', 5, .25, 1, 'all')])),
    H('zira','Zira','Reinos do Norte','fenda','Executor','Vento',{ atk:1.02 },
      P('Sangue Antigo', { stats:{ dodge:.15 }, onDodge:{ eff:[cdr(2)] } }),
      S('Salto entre Mundos', 6, [dmg(1.6, 'low'), buff('stealth', 1, 1.5)], 'slash'),
      Ult('Fúria do Relâmpago Branco', [dmg(.9, 'randEach', { hits:7 })])),
    H('n9','Unidade Ômega','Guerra das Máquinas','fenda','Atirador','Sombra',{ atk:1.03 },
      P('Drone de Apoio', { onAtk:{ ch:1, eff:[dmg(.25, 'rand')] } }),
      S('Programa Laser', 9, [dmg(2.2, 'tgt', { pierce:.3 }), dmg(.6, 'all')], 'beam'),
      Ult('Programa Supremo', [chain(2.6, 5, .8)])),
    H('unit7','Unidade Sigma','Guerra das Máquinas','fenda','Vanguarda','Fogo',{ atk:1.08 },
      P('Modo Berserker', { stats:{ atk:.10 }, low:{ th:.5, eff:[buff('atk', .4, 10), buff('lifesteal', .15, 10)] } }),
      S('Corte Selvagem', 7, [dmg(1.9), drain(.3), taunt(3)], 'slash'),
      Ult('Berserker Total', [buff('atk', .6, 8), buff('spd', .4, 8), selfHp(-.1), dmg(2.2, 'all')])),
    H('rex','Rex Sable','Cidade dos Demônios','fenda','Atirador','Fogo',{ hp:1.05 },
      P('Estilo Acrobata', { stats:{ dodge:.12 }, onDodge:{ eff:[nrg(10)] } }),
      S('Pistolas Gêmeas', 6, [dmg(.4, 'randEach', { hits:6 })], 'burst'),
      Ult('Pacto Demoníaco', [buff('atk', .5, 10), buff('lifesteal', .25, 10), heal({ p:.3 }, 'self'), dmg(2.0)])),
    H('virel','Virel Sable','Cidade dos Demônios','fenda','Executor','Sombra',{ atk:1.06 },
      P('Poder Absoluto', { stats:{ critDmg:.25, pierce:.15 } }),
      S('Espadas Espirituais', 7, [dmg(.5, 'all', { hits:3 })], 'wave'),
      Ult('Corte Dimensional', [dmg(3.0, 'all', { pierce:.5 }), st('bleed', 6, .3, 1, 'all'), delay(2, 'all')])),
    H('selene','Selene Noir','Cidade dos Demônios','fenda','Arcanista','Sombra',{ atk:1.03 },
      P('Tempo Suspenso', { stats:{ dodge:.15 }, onDodge:{ eff:[st('slow', 4, .5, 1, 'all')] } }),
      S('Chuva de Balas', 7, [dmg(.5, 'randEach', { hits:5 })], 'burst'),
      Ult('Demônio Infernal', [dmg(4.0, 'high'), dmg(1.5, 'all'), st('weaken', 5, .2, 1, 'all')])),
    H('tessa','Tessa Rubra','Terras das Máquinas','fenda','Atirador','Natureza',{ atk:1.02 },
      P('Foco', { onAtk:{ ch:.25, eff:[st('armorBreak', 4, .15)] }, vs:{ s:'armorBreak', v:.2 } }),
      S('Flecha Elemental', 7, [dmg(1.8), st('armorBreak', 5, .25), st('slow', 4, .3)], 'beam'),
      Ult('Tempestade de Flechas', [dmg(.8, 'randEach', { hits:6 }), st('armorBreak', 6, .3, 1, 'all')])),
    H('kaji','Kaji, o Espectro','Torneio do Submundo','fenda','Executor','Fogo',{ atk:1.04 },
      P('Fogo do Inferno', { onAtk:{ ch:.25, eff:[st('burn', 4, .3)] } }),
      S('Lança de Corrente', 8, [dmg(1.8, 'high'), st('stun', 1.5, 0, 1, 'high')], 'beam'),
      Ult('Execução', [dmg(3.5, 'low', { exec:2.0 }), st('burn', 6, .6)])),
    H('kori','Kori, o Gélido','Torneio do Submundo','fenda','Arcanista','Gelo',{ def:1.05 },
      P('Clã do Gelo', { onAtk:{ ch:.2, eff:[st('slow', 3, .3)] }, vs:{ s:'freeze', v:.25 } }),
      S('Esfera de Gelo', 8, [dmg(1.8), st('freeze', 2)], 'beam'),
      Ult('Congelamento Profundo', [dmg(1.6, 'all'), st('freeze', 2.5, 0, 1, 'all')])),

    // --- Temporada I · Despertares: formas despertadas de heróis do elenco (Caixa da Temporada; ver D.SEASON).
    // base: o herói original. Forma e original não entram juntos na mesma equipe.
    H('goku_ui','Goku Instinto Superior','Picos de Aurum','temporada','Arcanista','Vento',{ atk:1.05, hp:.98 },
      P('Instinto Superior', { stats:{ dodge:.12 }, onDodge:{ eff:[dmg(1.0, 'attacker'), nrg(5)] } }),
      S('Kamehameha Silencioso', 9, [dmg(2.6, 'tgt', { pierce:.35 })], 'beam'),
      Ult('Kamehameha do Instinto', [dmg(3.1, 'all'), buff('dodge', .25, 6)])),
    H('sasuke_susanoo','Sasuke Susanoo','Vila do Redemoinho','temporada','Arcanista','Sombra',{ atk:1.04, hp:1.0 },
      P('Susanoo Perfeito', { stats:{ dr:.06 }, start:{ eff:[shield({ p:.10 }, 'self', 8)] } }),
      S('Flecha de Indra', 9, [dmg(2.8, 'high', { pierce:.4 }), st('burn', 6, .4, 1, 'high')], 'beam'),
      Ult('Amaterasu Negra', [dmg(2.0, 'all'), st('burn', 8, .45, 1, 'all')])),
    H('gojo_void','Gojo Vazio Roxo','Colégio de Jujutsu','temporada','Arcanista','Luz',{ atk:1.05, hp:.97 },
      P('Infinito', { stats:{ dr:.08, skill:.08 } }),
      S('Vermelho Invertido', 8, [dmg(2.2, 'tgt'), { k:'delay', v:1.5, to:'tgt' }], 'beam'),
      Ult('Roxo Imaginário', [dmg(3.8, 'all', { pierce:.5 })])),
    H('tanjiro_hinokami','Tanjiro Dança do Deus do Fogo','Montanhas de Sagiri','temporada','Executor','Fogo',{ atk:1.06, hp:.97 },
      P('Marca do Caçador', { stats:{ crit:.06 }, onCrit:{ ch:.3, eff:[st('burn', 4, .3)] } }),
      S('Dança do Deus do Fogo', 8, [dmg(.8, 'tgt', { hits:4 }), st('burn', 5, .4)], 'slash'),
      Ult('Sol Nascente Resplandecente', [dmg(3.0, 'all'), st('burn', 6, .5, 1, 'all')])),
    H('ichigo_bankai','Ichigo Bankai Final','Sociedade das Almas','temporada','Executor','Sombra',{ atk:1.07, hp:.95 },
      P('Máscara Hollow', { stats:{ critDmg:.25 }, low:{ th:.35, once:true, eff:[buff('atk', .35, 8), heal({ p:.2 }, 'self')] } }),
      S('Getsuga Tenshou Negro', 8, [dmg(2.5, 'tgt', { pierce:.3 }), st('mark', 5, .2)], 'slash'),
      Ult('Mugetsu', [dmg(4.6, 'high', { crit:.4 })])),
    H('vegeta_ego','Vegeta Ultra Ego','Picos de Aurum','temporada','Executor','Raio',{ atk:1.06, hp:1.0 },
      P('Ego Destrutivo', { stats:{ lifesteal:.06 }, onHurt:{ ch:.25, eff:[buff('atk', .06, 8, 'self', { stack:5 })] } }),
      S('Big Bang Attack', 8, [dmg(2.4), st('armorBreak', 5, .3)], 'beam'),
      Ult('Hakai', [dmg(3.6, 'low', { exec:1.6 }), st('stun', 1.2)])),
    H('luffy_gear5','Luffy Gear 5','Arquipélago das Velas','temporada','Vanguarda','Luz',{ hp:1.08, atk:1.03 },
      P('Tambores da Libertação', { stats:{ hp:.10 }, onHurt:{ ch:.2, eff:[nrg(8), buff('dr', .1, 3)] } }),
      S('Bajrang Gun', 9, [taunt(3), dmg(2.0), st('stun', 1, 0, .5)], 'slash'),
      Ult('Nika: Mundo de Borracha', [dmg(2.2, 'all'), st('stun', 1.5, 0, .6, 'all'), heal({ p:.3 }, 'self')])),
    H('naruto_kurama','Naruto Modo Kurama','Vila do Redemoinho','temporada','Vanguarda','Fogo',{ hp:1.07, atk:1.02 },
      P('Chakra da Kurama', { stats:{ regen:.003, hp:.06 }, start:{ eff:[shield({ p:.06 }, 'allies', 6)] } }),
      S('Bijuudama', 9, [taunt(3), dmg(1.9, 'all')], 'burst'),
      Ult('Rasen Shuriken da Raposa', [dmg(2.6, 'all'), buff('dr', .2, 6, 'allies')])),
    H('mercy_valkyrie','Mercy Valquíria','Aliança Overwatch','temporada','Suporte','Luz',{ hp:1.03, atk:1.02 },
      P('Asas da Valquíria', { stats:{ healPow:.15 }, onAtk:{ ch:.25, eff:[heal({ m:.4 }, 'lowAlly')] } }),
      S('Raio Curativo Duplo', 8, [heal(1.8, 'allies'), buff('atk', .12, 6, 'atkAlly')], 'burst'),
      Ult('Renascer Coletivo', [revive(.5), heal({ p:.3 }, 'allies'), cleanse('allies')])),
    H('sailor_eternal','Eternal Sailor Moon','Reino da Lua','temporada','Suporte','Luz',{ hp:1.04 },
      P('Cristal de Prata', { stats:{ healPow:.10, regen:.002 }, allyLow:{ th:.3, eff:[shield({ p:.1 }, 'lowAlly', 6)] } }),
      S('Beijo Estelar', 9, [shield(1.5, 'allies', 6), dmg(1.3, 'all')], 'burst'),
      Ult('Poder Eterno da Lua', [heal({ p:.35 }, 'allies'), st('weaken', 6, .25, 1, 'all')])),
    H('dante_dt','Dante Devil Trigger','Cidade de Capulet','temporada','Atirador','Fogo',{ atk:1.05, hp:1.0 },
      P('Gatilho do Demônio', { stats:{ lifesteal:.06, spd:.06 }, every:{ n:5, eff:[dmg(1.2, 'rand')] } }),
      S('Ebony & Ivory', 7, [dmg(.5, 'randEach', { hits:6 })], 'slash'),
      Ult('Sin Devil Trigger', [dmg(1.3, 'all', { hits:3 }), buff('atk', .3, 6)])),
    H('jinx_arcane','Jinx Arcane','Zaun','temporada','Atirador','Raio',{ atk:1.06, hp:.95 },
      P('Caos de Zaun', { stats:{ spd:.10 }, onKill:{ eff:[buff('spd', .2, 6)] } }),
      S('Fishbones Supercarregado', 8, [dmg(1.6, 'all'), st('burn', 4, .3, 1, 'all')], 'burst'),
      Ult('Super Mega Foguete da Morte', [dmg(3.4, 'high'), dmg(1.4, 'all')]))
  ];

  // ---------------------------------------------------------------------------
  // Descrição automática, o texto sempre corresponde ao efeito real.
  // ---------------------------------------------------------------------------
  const TGT = { tgt:'no alvo', all:'em todos os inimigos', low:'no inimigo com menos HP', high:'no inimigo com mais HP', rand:'em um inimigo aleatório', randEach:'em inimigos aleatórios', back:'na retaguarda', front:'na linha de frente', attacker:'em quem atacou', self:'em si', allies:'na equipe', lowAlly:'no aliado mais ferido', atkAlly:'no aliado mais forte' };
  const TGT_ALLY = { self:'si mesmo', allies:'toda a equipe', lowAlly:'o aliado mais ferido', atkAlly:'o aliado de maior ATK', front:'a linha de frente', all:'toda a equipe', tgt:'si mesmo' };
  const ALLY_IN = { self:'em si mesmo', allies:'em toda a equipe', lowAlly:'no aliado mais ferido', atkAlly:'no aliado mais forte', front:'na linha de frente', all:'em toda a equipe', tgt:'em si mesmo' };
  const pct = v => `${Math.round(v * 100)}%`;
  const sec = v => `${String(v).replace('.', ',')}s`;
  function describeEffect(e, enemySide = false) {
    const sInfo = D.statusInfo[e.s] || {};
    switch (e.k) {
      case 'dmg': {
        let t = `Causa ${pct(e.m)} do ATK${e.hits > 1 ? ` ×${e.hits} golpes` : ''} ${TGT[e.to] || ''}`;
        const extra = [];
        if (e.pierce) extra.push(e.pierce >= 1 ? 'ignorando a DEF' : `ignorando ${pct(e.pierce)} da DEF`);
        if (e.crit) extra.push(e.crit >= 1 ? 'sempre crítico' : `+${pct(e.crit)} de chance de crítico`);
        if (e.exec) extra.push(`até +${pct(e.exec)} de dano conforme a vida que falta ao alvo`);
        return t + (extra.length ? ` (${extra.join(', ')})` : '') + '.';
      }
      case 'st': {
        const val = e.v ? (['burn','poison','bleed'].includes(e.s) ? ` (${pct(e.v)} do ATK/s)` : e.s === 'slow' || e.s === 'armorBreak' || e.s === 'weaken' || e.s === 'mark' ? ` (${pct(e.v)})` : '') : '';
        return `${e.ch < 1 ? `${pct(e.ch)} de chance de aplicar` : 'Aplica'} ${sInfo.name || e.s}${val} por ${sec(e.d)} ${TGT[e.to] || ''}.`;
      }
      case 'heal': return `Cura ${e.p ? `${pct(e.p)} do HP máximo` : `${pct(e.m)} do ATK`} ${ALLY_IN[e.to] || ''}.`;
      case 'shield': return `Concede escudo de ${e.p ? `${pct(e.p)} do HP máximo` : `${pct(e.m)} do ATK`} para ${TGT_ALLY[e.to] || 'si mesmo'} por ${sec(e.d)}.`;
      case 'buff': return e.s === 'stealth' ? `Fica furtivo por ${sec(e.d)}.` : `${e.v < 0 ? 'Perde' : 'Concede'} ${e.s === 'regen' ? `${(Math.abs(e.v) * 100).toFixed(0)}% HP/s de regeneração` : `${pct(Math.abs(e.v))} de ${(D.statNames[e.s] || e.s)}`}${e.stack ? ` (acumula até ${e.stack}×)` : ''}${e.v < 0 ? '' : ` para ${TGT_ALLY[e.to] || 'si mesmo'}`} por ${sec(e.d)}.`;
      case 'nrg': return e.v < 0 ? `Drena ${-e.v} de energia ${TGT[e.to] || ''}.` : `Concede ${e.v} de energia para ${TGT_ALLY[e.to] || 'si mesmo'}.`;
      case 'cleanse': return `Remove efeitos negativos de ${TGT_ALLY[e.to] || 'si mesmo'}.`;
      case 'taunt': return `Provoca os inimigos por ${sec(e.d)}.`;
      case 'drain': return `Cura ${pct(e.v)} do dano causado.`;
      case 'revive': return `Revive um aliado caído com ${pct(e.p)} do HP.`;
      case 'cdr': return `Reduz em ${sec(e.v)} a recarga da habilidade de ${TGT_ALLY[e.to] || 'si mesmo'}.`;
      case 'hp': return `Custa ${pct(-e.p)} do HP máximo.`;
      case 'cdreset': return 'Reinicia a recarga da habilidade.';
      case 'dispel': return `Remove escudos e efeitos positivos ${TGT[e.to] || ''}.`;
      case 'delay': return `Atrasa em ${sec(e.v)} as habilidades e ataques preparados ${TGT[e.to] || ''}.`;
      case 'execute': return `Finaliza ${e.to === 'all' ? 'os inimigos' : 'o alvo'} com ${pct(e.th)} de HP ou menos (chefes resistem).`;
      case 'chain': return `Raio encadeado: ${pct(e.m)} do ATK que salta entre até ${e.n} inimigos, perdendo ${pct(1 - e.fall)} a cada salto.`;
      default: return '';
    }
  }
  const describe = effs => (effs || []).map(e => describeEffect(e)).join(' ');
  function describeHooks(h) {
    if (!h) return '';
    const parts = [];
    if (h.stats) parts.push(Object.entries(h.stats).map(([k, v]) => `${v >= 0 ? '+' : ''}${k === 'regen' ? `${(v * 100).toFixed(1)}% HP/s` : pct(v)} ${k === 'regen' ? 'de regeneração' : D.statNames[k] || k}`).join(', ') + '.');
    if (h.aura) parts.push(`Aura: a equipe recebe ${Object.entries(h.aura).map(([k, v]) => `${k === 'regen' ? `${(v * 100).toFixed(1)}% HP/s` : '+' + pct(v)} de ${D.statNames[k] || k}`).join(' e ')}.`);
    if (h.start) parts.push(`No início de cada onda: ${describe(h.start.eff)}`);
    if (h.onAtk) parts.push(`${h.onAtk.ch < 1 ? `Ataques básicos têm ${pct(h.onAtk.ch)} de chance de:` : 'A cada ataque básico:'} ${describe(h.onAtk.eff)}`);
    if (h.every) parts.push(`A cada ${h.every.n} ataques: ${describe(h.every.eff)}`);
    if (h.onCrit) parts.push(`Ao causar crítico: ${describe(h.onCrit.eff)}`);
    if (h.onKill) parts.push(`Ao abater: ${describe(h.onKill.eff)}`);
    if (h.onHurt) parts.push(`${h.onHurt.ch < 1 ? `Ao ser atingido (${pct(h.onHurt.ch)}):` : 'Ao ser atingido:'} ${describe(h.onHurt.eff)}`);
    if (h.onDodge) parts.push(`Ao esquivar: ${describe(h.onDodge.eff)}`);
    if (h.low) parts.push(`Abaixo de ${pct(h.low.th)} de HP${h.low.once ? ' (1× por batalha)' : ' (1× por onda)'}: ${describe(h.low.eff)}`);
    if (h.allyLow) parts.push(`Quando um aliado fica abaixo de ${pct(h.allyLow.th)} de HP (1× por onda): ${describe(h.allyLow.eff)}`);
    if (h.vs) parts.push(`+${pct(h.vs.v)} de dano contra alvos com ${D.statusInfo[h.vs.s]?.name || h.vs.s}.`);
    return parts.join(' ');
  }

  // Monta o elenco final com atributos de classe e perfil individual.
  const roster = heroes.map((h, i) => {
    const c = D.classes[h.cls];
    return { ...h, index:i, sprite:h.id, title:h.world, role:h.cls, element:h.el, color:h.color || D.elements[h.el].color,
      skillCd:h.skill.cd, passiveText:describeHooks(h.passive.hooks), skillText:describe(h.skill.eff), ultText:describe(h.ult.eff), classRow:c.row };
  });

  KT.Data.roster = roster;
  KT.Kit = { describe, describeEffect, describeHooks };
})();
