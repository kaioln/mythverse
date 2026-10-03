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
  //  sp { v } devolve Pontos de Técnica · brk { v, to } tira Resistência · adv { v, to } adianta a vez
  //  dmg aceita ainda: vsBroken, perDebuff, vs { s, v }, spScale, lowSelf, hpm (ver KITS)
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
  // Nomes, mundos e kits são todos originais do Mythverse. Os ids antigos só existem por compatibilidade de saves
  // (server/legacy_ids.js); nenhum nome de personagem de outra obra aparece para o jogador.
  const H = (id, name, world, origin, cls, el, prof, passive, skill, ult, color) => ({ id, name, world, origin, cls, el, prof, passive, skill, ult, color, base:AWAKEN_BASE[id] || id });
  const P = (name, hooks) => ({ name, hooks });
  const S = (name, cd, eff, fx = 'burst') => ({ name, cd, eff, fx });
  const Ult = (name, eff, fx = 'ult') => ({ name, eff, fx });

  const heroes = [
    H('solen','Hinata Asahi','Picos de Aurum','fenda','Arcanista','Luz',{ atk:1.05, hp:1.05 },
      P('Sangue Estelar', { stats:{ atk:.05 }, low:{ th:.35, eff:[buff('atk', .4, 8), heal({ p:.2 }, 'self')] } }),
      S('Onda Solar', 9, [dmg(2.6, 'tgt', { pierce:.3 })], 'beam'),
      Ult('Esfera dos Mil Sóis', [dmg(3.0, 'all'), st('stun', 1.2, 0, .5, 'all')])),
    H('varyon','Shiden, o Príncipe Cinza','Picos de Aurum','fenda','Executor','Raio',{ atk:1.08, def:.95 },
      P('Orgulho Real', { onCrit:{ eff:[buff('atk', .06, 8, 'self', { stack:5 })] } }),
      S('Disparo Violeta', 8, [dmg(2.2), st('armorBreak', 5, .25)], 'beam'),
      Ult('Raio Real', [dmg(4.4, 'tgt', { pierce:.5 }), st('stun', 1.5)])),
    H('hayato','Hayato Kazeno','Vale dos Cataventos','fenda','Vanguarda','Vento',{ hp:1.08 },
      P('Espírito do Vento', { stats:{ hp:.10 }, low:{ th:.4, once:true, eff:[heal({ p:.25 }, 'self'), buff('dr', .3, 6)] } }),
      S('Legião de Sombras', 10, [taunt(4), shield(1.5, 'self', 6), dmg(1.0, 'randEach', { hits:3 })], 'slash'),
      Ult('Ciclone Cortante', [dmg(2.3, 'all'), st('slow', 4, .3, 1, 'all')])),
    H('ren','Rai Kurogane','Vale dos Cataventos','fenda','Arcanista','Raio',{ atk:1.04, hp:.95 },
      P('Olhos Rubros', { stats:{ dodge:.12 }, onDodge:{ eff:[dmg(1.2, 'attacker')] } }),
      S('Lança Trovejante', 8, [dmg(2.8, 'tgt', { pierce:.2 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Chama do Eclipse', [dmg(2.2, 'high'), st('burn', 8, .8, 1, 'high'), st('burn', 6, .25, 1, 'all')])),
    H('tobias','Tobimaru da Maré','Arquipélago das Velas','fenda','Vanguarda','Fogo',{ atk:1.06 },
      P('Pele Curtida', { stats:{ dr:.10 }, onHurt:{ ch:.25, eff:[nrg(10)] } }),
      S('Rajada de Punhos', 8, [dmg(.6, 'tgt', { hits:5 })], 'slash'),
      Ult('Maré Gigante', [buff('atk', .5, 8), buff('spd', .4, 8), taunt(4), heal({ p:.3 }, 'self')])),
    H('kenji','Kenji Sanjin','Arquipélago das Velas','fenda','Executor','Vento',{ atk:1.05, hp:1.05 },
      P('Tríade de Aço', { stats:{ critDmg:.2 }, every:{ n:3, eff:[dmg(1.2, 'tgt', { pierce:.4 })] } }),
      S('Corte Cruzado', 7, [dmg(2.4), st('bleed', 5, .3)], 'slash'),
      Ult('Tempestade de Lâminas', [dmg(.9, 'all', { hits:3 })])),
    H('hiro','Hiro Kagetsu','Mosteiro da Lua Minguante','fenda','Executor','Sombra',{ atk:1.04, hp:1.04 },
      P('Voz Interior', { low:{ th:.3, eff:[buff('atk', .6, 10), buff('lifesteal', .2, 10)] } }),
      S('Crescente Cortante', 8, [dmg(2.0, 'high', { pierce:.3 }), dmg(.6, 'all')], 'wave'),
      Ult('Lua Sem Fim', [dmg(5.0, 'tgt', { pierce:.6 }), buff('atk', -.3, 6)])),
    H('yuki','Yuki Shirasagi','Mosteiro da Lua Minguante','fenda','Suporte','Gelo',{ atk:1.05 },
      P('Dança da Neve', { onAtk:{ ch:.2, eff:[st('freeze', 1.5)] } }),
      S('Lótus Branca', 10, [dmg(1.1, 'all'), st('slow', 4, .35, 1, 'all'), shield(1.0, 'front', 6)], 'wave'),
      Ult('Floresta de Gelo', [st('freeze', 3, 0, 1, 'all'), st('mark', 6, .25, 1, 'all')])),
    H('akira','Akira Minase','Aldeia do Rio Cinzento','fenda','Executor','Água',{ hp:1.05 },
      P('Faro Apurado', { stats:{ crit:.05 }, onKill:{ eff:[nrg(30), heal({ p:.08 }, 'self')] } }),
      S('Correnteza Giratória', 7, [dmg(1.2, 'all'), heal({ p:.05 }, 'self')], 'wave'),
      Ult('Dança da Brasa', [dmg(3.6), st('burn', 6, .5), buff('atk', .25, 8)])),
    H('hana','Hana Minase','Aldeia do Rio Cinzento','fenda','Vanguarda','Fogo',{ hp:1.05 },
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
    H('lucan','Genzō Asagiri','Fronteira de Eldria','fenda','Executor','Vento',{ atk:1.06, hp:.95 },
      P('Veterano da Fronteira', { stats:{ spd:.15, crit:.10 }, onKill:{ eff:[cdr(3)] } }),
      S('Investida Vertical', 6, [dmg(1.0, 'low', { hits:3 })], 'slash'),
      Ult('Giro Cortante', [dmg(1.5, 'all', { hits:2, exec:.8 })])),
    H('mira','Mirai Asagiri','Fronteira de Eldria','fenda','Executor','Vento',{ hp:1.05 },
      P('Proteger a Família', { allyLow:{ th:.3, eff:[buff('atk', .35, 8), taunt(3)] } }),
      S('Lâminas Gêmeas', 7, [dmg(1.3, 'tgt', { hits:2, exec:.6 })], 'slash'),
      Ult('Fúria do Clã', [dmg(1.1, 'low', { hits:4 }), buff('spd', .3, 6)])),
    H('erik','Iwao Hazama','Fronteira de Eldria','fenda','Vanguarda','Terra',{ hp:1.1, def:1.05 },
      P('Forma Colossal', { stats:{ hp:.20, def:.10 }, low:{ th:.5, once:true, eff:[shield({ p:.35 }, 'self', 8)] } }),
      S('Soco Colossal', 8, [dmg(1.7), st('stun', 1.3, 0, .7), taunt(4)], 'slash'),
      Ult('Colosso Primordial', [dmg(1.6, 'all'), st('weaken', 6, .25, 1, 'all'), buff('dr', .35, 8, 'allies')])),
    H('alden','Kōji Ibara','Cidade dos Alambiques','fenda','Suporte','Terra',{ def:1.1 },
      P('Alquimia de Combate', { stats:{ healPow:.20 }, start:{ eff:[shield(1.2, 'front', 8)] } }),
      S('Muralha de Aço', 10, [shield(1.8, 'front', 8), dmg(1.0)], 'buff'),
      Ult('Chumbo em Ouro', [shield(2.2, 'allies', 10), st('armorBreak', 6, .3, 1, 'all')])),
    H('ignis','Coronel Homura Kaga','Cidade dos Alambiques','fenda','Arcanista','Fogo',{ atk:1.05 },
      P('Mestre das Brasas', { stats:{ dot:.20 }, vs:{ s:'burn', v:.25 } }),
      S('Faísca Alquímica', 7, [dmg(1.5, 'rand'), st('burn', 6, .4, 1, 'rand'), dmg(1.0, 'rand')], 'burst'),
      Ult('Inferno do Deserto', [dmg(1.4, 'all'), st('burn', 8, .6, 1, 'all'), st('mark', 6, .15, 1, 'all')])),
    H('toma','Toma Hikari','Liga dos Juramentos','fenda','Vanguarda','Raio',{ atk:1.06 },
      P('Poder Herdado', { every:{ n:5, eff:[dmg(2.0), selfHp(-.04)] } }),
      S('Rajada de Dedo', 8, [dmg(1.5, 'all'), taunt(3)], 'wave'),
      Ult('Soco Supremo', [dmg(4.2), st('stun', 2), selfHp(-.12)])),
    H('ryo','Ryo Kazan','Liga dos Juramentos','fenda','Arcanista','Fogo',{ atk:1.06, hp:.97 },
      P('Palmas Explosivas', { onAtk:{ ch:1, eff:[buff('atk', .03, 10, 'self', { stack:10 })] } }),
      S('Tiro Guiado', 7, [dmg(2.0, 'tgt', { pierce:.3 }), dispel('tgt')], 'beam'),
      Ult('Impacto Giratório', [dmg(3.2), dmg(1.0, 'all'), dispel('all')])),
    H('grant','Takeru Ōtaka','Liga dos Juramentos','fenda','Vanguarda','Luz',{ atk:1.08, hp:1.05 },
      P('Símbolo da Esperança', { aura:{ atk:.08 }, start:{ eff:[buff('dr', .2, 6, 'allies')] } }),
      S('Golpe Vendaval', 8, [dmg(1.8), taunt(4), shield(1.2, 'self')], 'wave'),
      Ult('Golpe da Nação', [dmg(4.0, 'tgt', { pierce:.4 }), buff('atk', .2, 8, 'allies')])),
    H('kenta','Mestre Kenta','Cidade dos Mil Degraus','fenda','Vanguarda','Luz',{ atk:1.1, hp:1.05, def:1.05 },
      P('Treino Diário', { stats:{ hp:.10, atk:.10, def:.10 }, onAtk:{ ch:.03, eff:[dmg(10, 'tgt', { pierce:1 })] } }),
      S('Socos em Série', 8, [dmg(.5, 'tgt', { hits:8 }), taunt(3)], 'slash'),
      Ult('Soco dos Mil Degraus', [dmg(7.0, 'tgt', { pierce:1 })])),
    H('volt','Jōki-7','Cidade dos Mil Degraus','fenda','Atirador','Fogo',{ atk:1.04 },
      P('Núcleo Térmico', { stats:{ crit:.05 }, onCrit:{ eff:[st('burn', 4, .3)] } }),
      S('Canhão Térmico', 8, [dmg(1.8, 'tgt', { pierce:.4 }), st('burn', 4, .3), st('armorBreak', 4, .15)], 'beam'),
      Ult('Sobrecarga do Núcleo', [dmg(3.0, 'all'), selfHp(-.2)])),
    H('kai','Kai Morinaga','Floresta de Raízes Altas','fenda','Vanguarda','Natureza',{ atk:1.05 },
      P('Instinto Selvagem', { low:{ th:.3, once:true, eff:[buff('atk', 1.0, 6)] } }),
      S('Punho Carregado', 7, [dmg(2.8, 'tgt', { exec:.5 }), taunt(2), selfHp(-.03)], 'slash'),
      Ult('Forma do Juramento', [buff('atk', .8, 10), buff('dr', .3, 10), dmg(2.0)])),
    H('riku','Riku Shiro','Floresta de Raízes Altas','fenda','Executor','Raio',{ atk:1.02, hp:.95 },
      P('Passo Relâmpago', { stats:{ spd:.20, dodge:.10 }, onDodge:{ eff:[dmg(1.0, 'attacker')] } }),
      S('Coroa Trovejante', 7, [dmg(.8, 'tgt', { hits:3 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Clarão Branco', [dmg(1.2, 'all', { hits:2 }), st('stun', 1.5, 0, .6, 'all')])),
    H('elian','Seiran Ake','Floresta de Raízes Altas','fenda','Suporte','Luz',{ atk:1.04 },
      P('Pacto das Correntes', { stats:{ healPow:.20 }, allyLow:{ th:.4, eff:[shield(1.5, 'lowAlly', 6)] } }),
      S('Grilhão Restaurador', 9, [heal(2.2, 'lowAlly'), cleanse('lowAlly')], 'heal'),
      Ult('Sentença Acorrentada', [st('silence', 6, 0, 1, 'high'), st('stun', 2, 0, 1, 'high'), dmg(2.5, 'high'), heal(1.5, 'allies')])),
    H('aiko','Aiko Tsukishiro','Reino da Lua Prateada','fenda','Suporte','Luz',{ hp:1.05 },
      P('Cristal Lunar', { aura:{ regen:.006 } }),
      S('Tiara Lunar', 8, [dmg(1.2), heal(.6, 'allies'), cleanse('lowAlly')], 'heal'),
      Ult('Cura do Luar', [heal(3.0, 'allies'), cleanse('allies'), st('weaken', 5, .2, 1, 'all')])),
    H('kiba','Kiba, o Meio-Espírito','Ilhas da Bruma','fenda','Vanguarda','Vento',{ atk:1.05 },
      P('Sangue Espiritual', { low:{ th:.25, eff:[buff('atk', .5, 8), shield({ p:.15 }, 'self', 6)] } }),
      S('Garras de Aço', 7, [dmg(1.0, 'tgt', { hits:2 }), st('bleed', 5, .3), taunt(3)], 'slash'),
      Ult('Fenda do Vendaval', [dmg(2.2, 'all', { pierce:.2 }), execute(.12, 'all')])),
    H('jin','Jin Hayate','Ilhas da Bruma','fenda','Executor','Vento',{ atk:1.04 },
      P('Saque Relâmpago', { stats:{ spd:.10 }, start:{ eff:[dmg(1.5, 'high')] } }),
      S('Queda da Garça', 7, [dmg(2.5, 'tgt', { crit:.4 }), execute(.15)], 'slash'),
      Ult('Relâmpago do Céu Alto', [dmg(4.2, 'tgt', { crit:.5 }), execute(.2)])),
    H('drake','Tatsuya Hibana','Valmar','fenda','Arcanista','Fogo',{ hp:1.06 },
      P('Comedor de Chamas', { vs:{ s:'burn', v:.2 }, onKill:{ eff:[heal({ p:.1 }, 'self')] } }),
      S('Rugido Flamejante', 8, [dmg(1.4, 'all'), st('burn', 5, .35, .7, 'all')], 'wave'),
      Ult('Forma Draconiana', [buff('atk', .4, 8), dmg(1.6, 'all'), st('burn', 6, .5, 1, 'all')])),
    H('sienna','Kaede Tetsuyama','Valmar','fenda','Vanguarda','Terra',{ def:1.08 },
      P('Arsenal Mutável', { stats:{ def:.10 }, start:{ eff:[buff('def', .3, 8), buff('atk', .15, 8)] } }),
      S('Armadura Adamantina', 10, [shield(2.0, 'self', 8), taunt(5), shield(.8, 'allies', 6)], 'buff'),
      Ult('Armadura do Céu', [dmg(.6, 'all', { hits:5 })])),
    H('daigo','Daigo Arashi','Estrada dos Dojos','fenda','Vanguarda','Fogo',{ def:1.05 },
      P('Caminho do Guerreiro', { stats:{ def:.10 }, onHurt:{ ch:.2, eff:[dmg(1.0, 'attacker')] } }),
      S('Esfera de Ki', 7, [dmg(2.0, 'back'), delay(1.5, 'back')], 'beam'),
      Ult('Punho Ascendente', [dmg(3.4, 'tgt', { crit:.3 }), st('stun', 1.5), buff('dr', .25, 5)])),
    H('mei','Mei Lan','Estrada dos Dojos','fenda','Executor','Vento',{ atk:.98 },
      P('Pernas Relâmpago', { stats:{ spd:.25 }, every:{ n:4, eff:[dmg(.4, 'tgt', { hits:3 })] } }),
      S('Tempestade de Chutes', 7, [dmg(.35, 'tgt', { hits:8 })], 'slash'),
      Ult('Giro da Garça', [dmg(.5, 'tgt', { hits:8 }), st('stun', 1.5), buff('dodge', .2, 6)])),
    H('kael','Kaito Arata','Coroa Esmeralda','fenda','Executor','Raio',{ atk:1.06, hp:1.04 },
      P('Mercenário Errante', { stats:{ critDmg:.25 }, onKill:{ eff:[nrg(25)] } }),
      S('Corte em X', 8, [dmg(.8, 'tgt', { hits:3 }), st('armorBreak', 5, .2)], 'slash'),
      Ult('Nove Golpes Celestes', [dmg(.8, 'randEach', { hits:8 })])),
    H('sael','Karasu, a Asa Negra','Coroa Esmeralda','fenda','Arcanista','Sombra',{ atk:1.1, hp:.95 },
      P('Asa Sombria', { stats:{ atk:.12 }, onKill:{ eff:[buff('atk', .1, 10, 'self', { stack:5 })] } }),
      S('Oito Cortes', 8, [dmg(.4, 'tgt', { hits:8 }), st('mark', 4, .15)], 'slash'),
      Ult('Estrela Cadente', [dmg(2.0, 'all', { pierce:.3 }), st('weaken', 6, .25, 1, 'all'), st('burn', 6, .4, 1, 'all')])),
    H('rina','Rina Akemi','Coroa Esmeralda','fenda','Suporte','Terra',{ atk:1.08, hp:1.05 },
      P('Estilo do Punho Livre', { low:{ th:.5, once:true, eff:[heal({ p:.25 }, 'self')] }, onAtk:{ ch:.25, eff:[nrg(8, 'allies')] } }),
      S('Um-Dois-Três', 8, [dmg(.7, 'tgt', { hits:3 }), heal(1.2, 'lowAlly')], 'heal'),
      Ult('Golpe do Firmamento', [dmg(3.2), buff('atk', .25, 8, 'allies'), nrg(20, 'allies')])),
    H('nadia','Nanami Sunaga','Deserto dos Mapas Perdidos','fenda','Atirador','Terra',{ atk:1.02 },
      P('Sobrevivente', { stats:{ dodge:.10, crit:.08 }, onKill:{ eff:[buff('spd', .15, 5)] } }),
      S('Tiro Preciso', 7, [dmg(2.6, 'high', { pierce:.4 })], 'beam'),
      Ult('Flechas Explosivas', [dmg(1.6, 'all'), st('bleed', 5, .25, 1, 'all'), st('armorBreak', 5, .2, 1, 'all')])),
    H('thorn','Gorō Shimotsuki','Terras do Gelo Longo','fenda','Vanguarda','Gelo',{ atk:1.06, hp:1.06 },
      P('Pele de Urso', { onHurt:{ ch:1, eff:[nrg(4)] }, low:{ th:.35, eff:[buff('atk', .5, 8), buff('dr', .3, 8)] } }),
      S('Arremesso do Machado Gélido', 8, [dmg(2.0), st('freeze', 1.5, 0, .5), taunt(3)], 'slash'),
      Ult('Ira do Guerreiro', [dmg(1.2, 'all', { hits:2 }), heal({ p:.25 }, 'self'), taunt(4)])),
    H('bjorn','Botan Shimotsuki','Terras do Gelo Longo','fenda','Suporte','Natureza',{ atk:1.04 },
      P('Flechas Rúnicas', { onAtk:{ ch:.3, eff:[st('mark', 4, .12)] } }),
      S('Flecha de Luz', 9, [dmg(1.4), heal(1.8, 'lowAlly')], 'heal'),
      Ult('Invocação Rúnica', [buff('atk', .3, 8, 'allies'), buff('crit', .15, 8, 'allies'), st('mark', 6, .2, 1, 'all')])),
    H('rook','Comandante Rokurō','Frota de Órion','fenda','Atirador','Raio',{ hp:1.1, def:1.1 },
      P('Escudo de Energia', { stats:{ def:.15 }, start:{ eff:[shield({ p:.25 }, 'self', 30)] } }),
      S('Granada de Fragmentação', 8, [dmg(1.3, 'all'), st('armorBreak', 4, .2, 1, 'all')], 'wave'),
      Ult('Canhão Orbital', [dmg(3.6, 'high', { pierce:.5 }), st('stun', 1.5, 0, 1, 'high')])),
    H('warden','Mumei, o Carrasco','Forjas do Abismo','fenda','Atirador','Fogo',{ atk:1.06, hp:1.05 },
      P('Carnificina', { stats:{ atk:.10 }, onKill:{ eff:[heal({ p:.12 }, 'self'), nrg(15)] } }),
      S('Escopeta Dupla', 7, [dmg(2.8), dmg(.8, 'rand')], 'burst'),
      Ult('Canhão de Plasma', [dmg(2.6, 'all', { pierce:.3 }), heal({ p:.15 }, 'self')])),
    H('zara','Suzu Hanabi','Galerias de Sucata','fenda','Atirador','Fogo',{ atk:1.05, hp:.95 },
      P('Euforia', { onKill:{ eff:[buff('spd', .4, 6, 'self', { stack:3 })] } }),
      S('Faísca!', 7, [dmg(1.8), st('slow', 3, .35)], 'beam'),
      Ult('Míssil Maluco', [dmg(2.4, 'all', { exec:1.0 }), buff('spd', .3, 6)])),
    H('kira','Kira das Nove Caudas','Bosque das Nove Lanternas','fenda','Arcanista','Luz',{ atk:1.02 },
      P('Nove Vidas', { stats:{ spd:.05 }, onAtk:{ ch:.35, eff:[heal(.3, 'self')] } }),
      S('Encanto', 8, [dmg(1.8), st('stun', 1.6), st('mark', 4, .2)], 'beam'),
      Ult('Dança dos Fogos-Fátuos', [dmg(1.2, 'randEach', { hits:3 }), buff('dodge', .3, 4)])),
    H('haru','Haru Kaze','Estepes do Vento Solto','fenda','Executor','Vento',{ atk:1.04 },
      P('Andarilho do Vento', { stats:{ crit:.15 }, start:{ eff:[shield({ p:.15 }, 'self', 10)] } }),
      S('Vórtice de Aço', 6, [dmg(1.6), buff('crit', .1, 10, 'self', { stack:3 })], 'slash'),
      Ult('Vendaval Final', [dmg(3.4, 'tgt', { pierce:.5, crit:.3 }), buff('critDmg', .5, 6)])),
    H('ivy','Itsuki Tokiwa','Esquadrão Aurora','fenda','Atirador','Raio',{ hp:.9 },
      P('Salto Temporal', { stats:{ dodge:.20, spd:.15 } }),
      S('Retrocesso', 12, [heal({ p:.3 }, 'self'), cleanse('self'), dmg(.4, 'tgt', { hits:4 })], 'heal'),
      Ult('Mina Cronal', [dmg(3.8), dmg(1.0, 'all')])),
    H('nari','Nari Kōkaku','Esquadrão Aurora','fenda','Vanguarda','Raio',{ hp:1.08 },
      P('Campo Refletor', { stats:{ hp:.10 }, onHurt:{ ch:.25, eff:[shield(.6, 'self', 4)] } }),
      S('Propulsores', 8, [dmg(1.2, 'all'), taunt(4), shield(.6, 'self', 5)], 'slash'),
      Ult('Autodestruição', [dmg(3.0, 'all'), shield(1.5, 'allies', 6)])),
    H('aurelia','Akane Tsubasa','Esquadrão Aurora','fenda','Suporte','Luz',{ hp:1.02 },
      P('Anjo da Guarda', { stats:{ healPow:.25 } }),
      S('Cajado Curativo', 8, [heal(2.4, 'lowAlly'), buff('atk', .2, 5, 'atkAlly')], 'heal'),
      Ult('Ressurreição', [revive(.5), heal(2.0, 'allies')])),
    H('dario','Daisuke Yane','Irmandade dos Telhados','fenda','Executor','Sombra',{ atk:1.03 },
      P('Credo das Sombras', { stats:{ critDmg:.30 }, start:{ eff:[buff('stealth', 1, 4)] } }),
      S('Lâmina do Punho', 7, [dmg(2.2, 'low', { exec:1.2 })], 'slash'),
      Ult('Mergulho do Telhado', [dmg(4.5, 'low', { exec:1.5, crit:.5 }), buff('stealth', 1, 3)])),
    H('cole','Kōta Harada','Cidade da Névoa Verde','fenda','Atirador','Fogo',{ hp:1.03 },
      P('Mira de Precisão', { every:{ n:4, eff:[dmg(1.8, 'tgt', { crit:1 })] } }),
      S('Tiro na Cabeça', 7, [dmg(2.4, 'tgt', { crit:.5 }), delay(2)], 'beam'),
      Ult('Magnum e Chute', [dmg(1.2, 'all'), dmg(3.0, 'high')])),
    H('dana','Nagi Kusano','Cidade da Névoa Verde','fenda','Suporte','Natureza',{ hp:1.04 },
      P('Mestra da Sobrevivência', { stats:{ healPow:.15 }, start:{ eff:[buff('dodge', .1, 10, 'allies')] } }),
      S('Spray de Primeiros Socorros', 9, [heal(2.0, 'lowAlly'), cleanse('lowAlly'), buff('regen', .02, 5, 'lowAlly')], 'heal'),
      Ult('Granada Incendiária', [dmg(1.6, 'all'), st('burn', 6, .4, 1, 'all'), heal(1.2, 'allies')])),
    H('wade','Watari Kōya','Planalto dos Coiotes','fenda','Atirador','Terra',{ hp:1.05 },
      P('Código do Fora-da-Lei', { onCrit:{ eff:[nrg(10)] } }),
      S('Revólver de Seis Tiros', 7, [dmg(.7, 'tgt', { hits:4 })], 'burst'),
      Ult('Mira Lenta', [dmg(1.6, 'randEach', { hits:6, crit:.4 })])),
    H('garrick','Gantetsu do Vale','Vale das Runas','fenda','Arcanista','Fogo',{ hp:1.1 },
      P('Sangue Mutante', { stats:{ hp:.10 }, vs:{ s:'burn', v:.2 }, start:{ eff:[shield(1.2, 'self', 10)] } }),
      S('Runa Ígnea', 8, [dmg(1.2, 'all'), st('burn', 5, .35, 1, 'all'), dispel('all')], 'wave'),
      Ult('Runa de Impacto', [st('stun', 1.5, 0, 1, 'all'), dmg(1.8, 'all'), st('armorBreak', 5, .25, 1, 'all')])),
    H('zira','Shiina Kagemi','Vale das Runas','fenda','Executor','Vento',{ atk:1.02 },
      P('Sangue Antigo', { stats:{ dodge:.15 }, onDodge:{ eff:[cdr(2)] } }),
      S('Salto entre Mundos', 6, [dmg(1.6, 'low'), buff('stealth', 1, 1.5)], 'slash'),
      Ult('Relâmpago Branco', [dmg(.9, 'randEach', { hits:7 })])),
    H('n9','Unidade Kū','Cidadela Autômata','fenda','Atirador','Sombra',{ atk:1.03 },
      P('Drone de Apoio', { onAtk:{ ch:1, eff:[dmg(.25, 'rand')] } }),
      S('Programa Laser', 9, [dmg(2.2, 'tgt', { pierce:.3 }), dmg(.6, 'all')], 'beam'),
      Ult('Programa em Cadeia', [chain(2.6, 5, .8)])),
    H('unit7','Unidade Tetsu','Cidadela Autômata','fenda','Vanguarda','Fogo',{ atk:1.08 },
      P('Modo Berserker', { stats:{ atk:.10 }, low:{ th:.5, eff:[buff('atk', .4, 10), buff('lifesteal', .15, 10)] } }),
      S('Corte Selvagem', 7, [dmg(1.9), drain(.3), taunt(3)], 'slash'),
      Ult('Ferro em Brasa', [buff('atk', .6, 8), buff('spd', .4, 8), selfHp(-.1), dmg(2.2, 'all')])),
    H('rex','Raizō Kurenai','Cidade do Pacto Carmesim','fenda','Atirador','Fogo',{ hp:1.05 },
      P('Estilo Acrobata', { stats:{ dodge:.12 }, onDodge:{ eff:[nrg(10)] } }),
      S('Pistolas Gêmeas', 6, [dmg(.4, 'randEach', { hits:6 })], 'burst'),
      Ult('Pacto Demoníaco', [buff('atk', .5, 10), buff('lifesteal', .25, 10), heal({ p:.3 }, 'self'), dmg(2.0)])),
    H('virel','Yūgen Kurenai','Cidade do Pacto Carmesim','fenda','Executor','Sombra',{ atk:1.06 },
      P('Fio da Lâmina', { stats:{ critDmg:.25, pierce:.15 } }),
      S('Espadas Espirituais', 7, [dmg(.5, 'all', { hits:3 })], 'wave'),
      Ult('Corte Dimensional', [dmg(3.0, 'all', { pierce:.5 }), st('bleed', 6, .3, 1, 'all'), delay(2, 'all')])),
    H('selene','Tokiko Yoru','Cidade do Pacto Carmesim','fenda','Arcanista','Sombra',{ atk:1.03 },
      P('Tempo Suspenso', { stats:{ dodge:.15 }, onDodge:{ eff:[st('slow', 4, .5, 1, 'all')] } }),
      S('Chuva de Balas', 7, [dmg(.5, 'randEach', { hits:5 })], 'burst'),
      Ult('Demônio da Noite', [dmg(4.0, 'high'), dmg(1.5, 'all'), st('weaken', 5, .2, 1, 'all')])),
    H('tessa','Tsubaki Morie','Selva de Engrenagens','fenda','Atirador','Natureza',{ atk:1.02 },
      P('Foco', { onAtk:{ ch:.25, eff:[st('armorBreak', 4, .15)] }, vs:{ s:'armorBreak', v:.2 } }),
      S('Flecha Farpada', 7, [dmg(1.8), st('armorBreak', 5, .25), st('slow', 4, .3)], 'beam'),
      Ult('Tempestade de Flechas', [dmg(.8, 'randEach', { hits:6 }), st('armorBreak', 6, .3, 1, 'all')])),
    H('kaji','Kaji, o Espectro','Arena das Cinzas','fenda','Executor','Fogo',{ atk:1.04 },
      P('Fogo do Inferno', { onAtk:{ ch:.25, eff:[st('burn', 4, .3)] } }),
      S('Lança de Corrente', 8, [dmg(1.8, 'high'), st('stun', 1.5, 0, 1, 'high')], 'beam'),
      Ult('Execução', [dmg(3.5, 'low', { exec:2.0 }), st('burn', 6, .6)])),
    H('kori','Kori, o Gélido','Arena das Cinzas','fenda','Arcanista','Gelo',{ def:1.05 },
      P('Clã do Gelo', { onAtk:{ ch:.2, eff:[st('slow', 3, .3)] }, vs:{ s:'freeze', v:.25 } }),
      S('Esfera de Gelo', 8, [dmg(1.8), st('freeze', 2)], 'beam'),
      Ult('Congelamento Profundo', [dmg(1.6, 'all'), st('freeze', 2.5, 0, 1, 'all')])),

    // --- Temporada I · Despertares: formas despertadas de heróis do elenco (Caixa da Temporada; ver D.SEASON).
    // base: o herói original. Forma e original não entram juntos na mesma equipe.
    H('goku_ui','Hinata, Aurora Silenciosa','Picos de Aurum','temporada','Arcanista','Vento',{ atk:1.05, hp:.98 },
      P('Reflexo da Aurora', { stats:{ dodge:.12 }, onDodge:{ eff:[dmg(1.0, 'attacker'), nrg(5)] } }),
      S('Raio da Aurora', 9, [dmg(2.6, 'tgt', { pierce:.35 })], 'beam'),
      Ult('Sol Sem Sombra', [dmg(3.1, 'all'), buff('dodge', .25, 6)])),
    H('sasuke_susanoo','Rai, Armadura do Trovão Negro','Vale dos Cataventos','temporada','Arcanista','Sombra',{ atk:1.04, hp:1.0 },
      P('Couraça Espectral', { stats:{ dr:.06 }, start:{ eff:[shield({ p:.10 }, 'self', 8)] } }),
      S('Flecha do Céu Rachado', 9, [dmg(2.8, 'high', { pierce:.4 }), st('burn', 6, .4, 1, 'high')], 'beam'),
      Ult('Chama do Eclipse Negro', [dmg(2.0, 'all'), st('burn', 8, .45, 1, 'all')])),
    H('gojo_void','Sora, Olhar do Vazio','Academia do Véu','temporada','Arcanista','Luz',{ atk:1.05, hp:.97 },
      P('Distância Sem Fim', { stats:{ dr:.08, skill:.08 } }),
      S('Ponto Carmim', 8, [dmg(2.2, 'tgt'), { k:'delay', v:1.5, to:'tgt' }], 'beam'),
      Ult('Colapso Violeta', [dmg(3.8, 'all', { pierce:.5 })])),
    H('tanjiro_hinokami','Akira, Dança da Brasa Solar','Aldeia do Rio Cinzento','temporada','Executor','Fogo',{ atk:1.06, hp:.97 },
      P('Marca da Brasa', { stats:{ crit:.06 }, onCrit:{ ch:.3, eff:[st('burn', 4, .3)] } }),
      S('Passos da Brasa', 8, [dmg(.8, 'tgt', { hits:4 }), st('burn', 5, .4)], 'slash'),
      Ult('Alvorada Incandescente', [dmg(3.0, 'all'), st('burn', 6, .5, 1, 'all')])),
    H('ichigo_bankai','Hiro, Lâmina da Lua Final','Mosteiro da Lua Minguante','temporada','Executor','Sombra',{ atk:1.07, hp:.95 },
      P('Máscara do Vazio', { stats:{ critDmg:.25 }, low:{ th:.35, once:true, eff:[buff('atk', .35, 8), heal({ p:.2 }, 'self')] } }),
      S('Crescente Negro', 8, [dmg(2.5, 'tgt', { pierce:.3 }), st('mark', 5, .2)], 'slash'),
      Ult('Noite Sem Lua', [dmg(4.6, 'high', { crit:.4 })])),
    H('vegeta_ego','Shiden, Orgulho Destruidor','Picos de Aurum','temporada','Executor','Raio',{ atk:1.06, hp:1.0 },
      P('Orgulho Ferido', { stats:{ lifesteal:.06 }, onHurt:{ ch:.25, eff:[buff('atk', .06, 8, 'self', { stack:5 })] } }),
      S('Estrela Partida', 8, [dmg(2.4), st('armorBreak', 5, .3)], 'beam'),
      Ult('Sentença Real', [dmg(3.6, 'low', { exec:1.6 }), st('stun', 1.2)])),
    H('luffy_gear5','Tobimaru, Tambor da Maré Livre','Arquipélago das Velas','temporada','Vanguarda','Luz',{ hp:1.08, atk:1.03 },
      P('Tambor da Liberdade', { stats:{ hp:.10 }, onHurt:{ ch:.2, eff:[nrg(8), buff('dr', .1, 3)] } }),
      S('Punho do Maremoto', 9, [taunt(3), dmg(2.0), st('stun', 1, 0, .5)], 'slash'),
      Ult('Festa da Maré Alta', [dmg(2.2, 'all'), st('stun', 1.5, 0, .6, 'all'), heal({ p:.3 }, 'self')])),
    H('naruto_kurama','Hayato, Raposa do Vento','Vale dos Cataventos','temporada','Vanguarda','Fogo',{ hp:1.07, atk:1.02 },
      P('Espírito da Raposa', { stats:{ regen:.003, hp:.06 }, start:{ eff:[shield({ p:.06 }, 'allies', 6)] } }),
      S('Esfera da Raposa', 9, [taunt(3), dmg(1.9, 'all')], 'burst'),
      Ult('Ciclone da Raposa', [dmg(2.6, 'all'), buff('dr', .2, 6, 'allies')])),
    H('mercy_valkyrie','Akane, Asas da Alvorada','Esquadrão Aurora','temporada','Suporte','Luz',{ hp:1.03, atk:1.02 },
      P('Asas da Alvorada', { stats:{ healPow:.15 }, onAtk:{ ch:.25, eff:[heal({ m:.4 }, 'lowAlly')] } }),
      S('Feixe Restaurador', 8, [heal(1.8, 'allies'), buff('atk', .12, 6, 'atkAlly')], 'burst'),
      Ult('Todos de Pé', [revive(.5), heal({ p:.3 }, 'allies'), cleanse('allies')])),
    H('sailor_eternal','Aiko, Lua Cheia','Reino da Lua Prateada','temporada','Suporte','Luz',{ hp:1.04 },
      P('Coração Lunar', { stats:{ healPow:.10, regen:.002 }, allyLow:{ th:.3, eff:[shield({ p:.1 }, 'lowAlly', 6)] } }),
      S('Bênção Estelar', 9, [shield(1.5, 'allies', 6), dmg(1.3, 'all')], 'burst'),
      Ult('Maré Lunar', [heal({ p:.35 }, 'allies'), st('weaken', 6, .25, 1, 'all')])),
    H('dante_dt','Raizō, Pacto Carmesim','Cidade do Pacto Carmesim','temporada','Atirador','Fogo',{ atk:1.05, hp:1.0 },
      P('Pacto Carmesim', { stats:{ lifesteal:.06, spd:.06 }, every:{ n:5, eff:[dmg(1.2, 'rand')] } }),
      S('Salva do Pacto', 7, [dmg(.5, 'randEach', { hits:6 })], 'slash'),
      Ult('Forma do Pacto', [dmg(1.3, 'all', { hits:3 }), buff('atk', .3, 6)])),
    H('jinx_arcane','Suzu, Fagulha Sem Freio','Galerias de Sucata','temporada','Atirador','Raio',{ atk:1.06, hp:.95 },
      P('Caos das Galerias', { stats:{ spd:.10 }, onKill:{ eff:[buff('spd', .2, 6)] } }),
      S('Canhão Sobrecarregado', 8, [dmg(1.6, 'all'), st('burn', 4, .3, 1, 'all')], 'burst'),
      Ult('Foguete do Fim da Festa', [dmg(3.4, 'high'), dmg(1.4, 'all')]))
  ];

  // ---------------------------------------------------------------------------
  // KITS. Todo herói tem passiva, três habilidades e ultimate, todas só dele (nada compartilhado por classe ou elemento).
  //   I   assinatura (a de sempre)      nível 1   2 PT (3 se a recarga antiga era de 10 s ou mais)
  //   II  técnica                       nível 6   1 PT, golpe leve com um efeito de preparo
  //   III arte secreta                  nível 16  3 PT, descansa 3 vezes do herói depois de usada
  // K(nome, custo em Pontos de Técnica, efeitos, efeito visual). Efeitos novos: sp (devolve PT), brk (tira Resistência),
  // adv (adianta a vez), o bônus 'counter' (contra-ataque) e modificadores de dano: vsBroken, perDebuff, vs, spScale,
  // lowSelf, hpm. FLAVOR: uma frase para cada ação, na ordem [I, II, III, ultimate].
  // ---------------------------------------------------------------------------
  const K = (name, cost, eff, fx = 'burst', o = {}) => ({ name, cost, eff, fx, ...o });
  const sp = v => ({ k:'sp', v });
  const brk = (v, to = 'tgt') => ({ k:'brk', v, to });
  const adv = (v, to = 'atkAlly') => ({ k:'adv', v, to });
  const LEARN = [1, 6, 16], REST = [0, 0, 3];
  const KITS = {
    solen:[K('Clarão da Alvorada', 1, [dmg(1.2), st('weaken', 4, .2)], 'beam'),
      K('Carga Solar', 3, [dmg(3.2, 'tgt', { pierce:.4, vsBroken:.4 }), nrg(15), brk(1)], 'beam')],
    varyon:[K('Desprezo Real', 1, [dmg(1.3, 'tgt', { crit:.3 }), buff('critDmg', .2, 6)], 'slash'),
      K('Chuva de Meteoros Cinzentos', 3, [dmg(.7, 'randEach', { hits:6, crit:.15 })], 'burst')],
    hayato:[K('Passo do Vendaval', 1, [dmg(1.2), buff('dodge', .3, 4)], 'slash'),
      K('Muralha de Sombras', 3, [shield(1.6, 'allies', 6), taunt(5), buff('counter', 1.0, 5)], 'buff')],
    ren:[K('Olhar Rubro', 1, [st('mark', 5, .2), dmg(1.0), delay(1.5)], 'beam'),
      K('Trovão Encadeado', 3, [chain(1.8, 4, .7), st('stun', 1, 0, .5)], 'beam')],
    tobias:[K('Estilingue Humano', 1, [dmg(1.3), delay(1.5), taunt(2)], 'slash'),
      K('Punho de Brasa Gigante', 3, [dmg(2.8, 'tgt', { hpm:.04 }), st('burn', 5, .4), brk(2)], 'burst')],
    kenji:[K('Saque Triplo', 1, [dmg(.5, 'tgt', { hits:3 }), st('bleed', 4, .2)], 'slash'),
      K('Dragão que Sobe', 3, [dmg(3.1, 'tgt', { crit:.3, perDebuff:.12 }), brk(1)], 'slash')],
    hiro:[K('Sede da Lâmina', 1, [dmg(1.2), buff('lifesteal', .2, 6)], 'slash'),
      K('Máscara Rachada', 3, [selfHp(-.10), buff('atk', .5, 8), dmg(2.4, 'tgt', { lowSelf:.8 })], 'wave')],
    yuki:[K('Floco Guardião', 1, [shield(1.2, 'lowAlly', 5), st('slow', 3, .25)], 'buff'),
      K('Nevasca Dançante', 3, [dmg(1.3, 'all', { vs:{ s:'slow', v:.3 } }), st('freeze', 1.5, 0, .5, 'all'), heal({ p:.08 }, 'allies')], 'wave')],
    akira:[K("Fio d'Água", 1, [dmg(1.5, 'tgt', { crit:.25 }), buff('spd', .15, 5)], 'slash'),
      K('Serpente do Rio', 3, [dmg(1.05, 'tgt', { hits:3, exec:.6 }), heal({ p:.10 }, 'self')], 'wave')],
    hana:[K('Sangue que Queima', 1, [selfHp(-.04), dmg(1.0), st('burn', 5, .45)], 'burst'),
      K('Proteger o Irmão', 3, [shield({ p:.2 }, 'lowAlly', 6), taunt(5), buff('dr', .3, 5), buff('counter', .8, 5)], 'buff')],
    sora:[K('Ponto Celeste', 1, [dmg(.6, 'all'), delay(1, 'all')], 'wave'),
      K('Véu do Infinito', 3, [shield({ p:.25 }, 'allies', 5), buff('dodge', .2, 5, 'allies'), sp(1)], 'buff')],
    daichi:[K('Eco do Punho', 1, [dmg(1.4, 'tgt', { vs:{ s:'bleed', v:.4 } }), st('bleed', 4, .25)], 'slash'),
      K('Impacto Maldito', 3, [dmg(2.6, 'tgt', { crit:1 }), brk(2)], 'burst')],
    lucan:[K('Lâminas Reservas', 1, [dmg(1.3, 'low', { exec:.6 })], 'slash'),
      K('Corte do Capitão', 3, [dmg(3.0, 'high', { pierce:.5, vsBroken:.5 }), brk(2)], 'slash')],
    mira:[K('Cobertura', 1, [shield(1.0, 'lowAlly', 5), dmg(1.0)], 'slash'),
      K('Tempestade Escarlate', 3, [dmg(.55, 'tgt', { hits:6, crit:.2 }), st('bleed', 6, .35)], 'slash')],
    erik:[K('Couraça de Pedra', 1, [shield({ p:.12 }, 'self', 6), taunt(3)], 'buff'),
      K('Pisada Sísmica', 3, [dmg(1.1, 'all', { hpm:.03 }), st('slow', 4, .3, 1, 'all'), brk(2, 'all')], 'wave')],
    alden:[K('Frasco Corrosivo', 1, [dmg(1.0), st('armorBreak', 5, .25)], 'burst'),
      K('Grande Obra', 3, [heal({ p:.15 }, 'allies'), buff('atk', .2, 8, 'allies'), sp(1)], 'heal')],
    ignis:[K('Estalo Incendiário', 1, [dmg(1.3), st('burn', 5, .4)], 'burst'),
      K('Combustão', 3, [dmg(1.5, 'all', { vs:{ s:'burn', v:.5 } }), dispel('all')], 'wave')],
    toma:[K('Chute Relâmpago', 1, [selfHp(-.03), dmg(1.5), st('slow', 3, .3)], 'slash'),
      K('Tudo de Uma Vez', 3, [selfHp(-.08), buff('atk', .4, 8), buff('spd', .3, 8), dmg(2.2, 'tgt', { lowSelf:.6 }), brk(1)], 'burst')],
    ryo:[K('Propulsão', 1, [dmg(1.2, 'back'), buff('spd', .3, 5)], 'burst'),
      K('Bombardeio em Cadeia', 3, [dmg(.85, 'randEach', { hits:5 }), st('burn', 4, .3, .6, 'all')], 'burst')],
    grant:[K('Sorriso Inabalável', 1, [cleanse('lowAlly'), heal({ p:.08 }, 'lowAlly'), taunt(3)], 'heal'),
      K('Impacto da Esperança', 3, [dmg(2.4, 'tgt', { hpm:.04 }), nrg(15, 'allies'), brk(2)], 'wave')],
    kenta:[K('Soco Simples', 1, [dmg(1.7)], 'slash'),
      K('Golpe de Verdade', 3, [dmg(3.0, 'tgt', { pierce:.5 }), st('stun', 2), brk(3)], 'burst')],
    volt:[K('Jato de Vapor', 1, [dmg(.8, 'front'), st('weaken', 4, .2, 1, 'front')], 'wave'),
      K('Reator Aberto', 3, [selfHp(-.08), buff('crit', .25, 8), dmg(1.2, 'tgt', { hits:3, pierce:.3 })], 'beam')],
    kai:[K('Faro de Caçador', 1, [st('mark', 5, .2), dmg(1.1), taunt(2)], 'slash'),
      K('Três Golpes do Juramento', 3, [dmg(1.1, 'tgt', { hits:3, exec:.5 }), brk(2)], 'slash')],
    riku:[K('Palma Elétrica', 1, [dmg(1.2), st('stun', .8, 0, .6), adv(.4, 'self')], 'beam'),
      K('Passo do Trovão', 3, [buff('spd', .6, 6), buff('dodge', .25, 6), dmg(.65, 'randEach', { hits:5 })], 'slash')],
    elian:[K('Elo da Sentença', 1, [st('silence', 3), dmg(1.0), delay(1)], 'beam'),
      K('Corrente da Aurora', 3, [heal({ p:.12 }, 'allies'), buff('regen', .02, 6, 'allies'), adv(.5, 'atkAlly')], 'heal')],
    aiko:[K('Bênção do Luar', 1, [heal(1.4, 'lowAlly'), buff('dr', .15, 4, 'lowAlly')], 'heal'),
      K('Cetro da Lua Cheia', 3, [dmg(1.3, 'all'), st('weaken', 5, .25, 1, 'all'), nrg(12, 'allies')], 'wave')],
    kiba:[K('Uivo', 1, [taunt(4), buff('atk', .2, 6), st('weaken', 4, .15, 1, 'all')], 'buff'),
      K('Presa do Meio-Espírito', 3, [dmg(2.8, 'tgt', { vs:{ s:'bleed', v:.5 } }), drain(.5), brk(1)], 'slash')],
    jin:[K('Postura do Saque', 1, [buff('crit', .3, 6), buff('critDmg', .3, 6), sp(1)], 'buff'),
      K('Corte que Não se Vê', 3, [dmg(3.2, 'tgt', { crit:.5, pierce:.3 }), adv(.5, 'self')], 'slash')],
    drake:[K('Engolir Chamas', 1, [heal({ p:.10 }, 'self'), nrg(15), buff('atk', .15, 6)], 'heal'),
      K('Punho Escama-Rubra', 3, [dmg(2.8, 'tgt', { vs:{ s:'burn', v:.4 } }), st('burn', 6, .5), brk(2)], 'burst')],
    sienna:[K('Arsenal: Asas de Ferro', 1, [buff('atk', .3, 6), buff('spd', .2, 6), dmg(1.0)], 'slash'),
      K('Arsenal: Roda de Lâminas', 3, [dmg(.5, 'all', { hits:3 }), buff('def', .3, 6, 'allies'), brk(1, 'all')], 'wave')],
    daigo:[K('Guarda Firme', 1, [buff('counter', 1.0, 5), buff('dr', .2, 5), taunt(3)], 'buff'),
      K('Furacão de Chutes', 3, [dmg(.75, 'all', { hits:2 }), st('burn', 4, .3, 1, 'all'), brk(1, 'all')], 'wave')],
    mei:[K('Garça Giratória', 1, [dmg(.35, 'all', { hits:2 }), buff('dodge', .15, 4)], 'wave'),
      K('Chute do Céu Partido', 3, [dmg(2.8, 'high', { crit:.3 }), st('armorBreak', 6, .3), brk(2)], 'slash')],
    kael:[K('Investida', 1, [dmg(1.4, 'tgt', { vsBroken:.5 }), brk(1)], 'slash'),
      K('Corte Meteoro', 3, [dmg(1.4, 'all', { crit:.2, spScale:.06 })], 'wave')],
    sael:[K('Pena Negra', 1, [dmg(1.1), st('silence', 3)], 'beam'),
      K('Sombra em Brasa', 3, [dmg(2.9, 'tgt', { pierce:.4, perDebuff:.15 }), st('burn', 6, .5)], 'burst')],
    rina:[K('Encorajar', 1, [buff('atk', .2, 6, 'atkAlly'), adv(.5, 'atkAlly')], 'buff'),
      K('Chute Mergulho', 3, [dmg(2.4), heal({ p:.12 }, 'allies'), brk(2)], 'heal')],
    nadia:[K('Flecha de Corda', 1, [dmg(1.2), st('slow', 4, .35), delay(1)], 'beam'),
      K('Emboscada', 3, [buff('stealth', 1, 2), dmg(3.1, 'low', { crit:.4, exec:.6 })], 'beam')],
    thorn:[K('Grito de Guerra', 1, [taunt(4), buff('def', .3, 6), nrg(10)], 'buff'),
      K('Machado do Inverno', 3, [st('freeze', 2, 0, .7), dmg(2.5, 'tgt', { vs:{ s:'freeze', v:.5 }, hpm:.03 }), brk(2)], 'slash')],
    bjorn:[K('Runa de Vigor', 1, [buff('regen', .03, 5, 'lowAlly'), buff('def', .2, 5, 'lowAlly')], 'heal'),
      K('Chuva Rúnica', 3, [dmg(1.2, 'all', { vs:{ s:'mark', v:.4 } }), heal(1.2, 'allies')], 'wave')],
    rook:[K('Rajada de Rifle', 1, [dmg(.5, 'tgt', { hits:3 }), st('mark', 4, .15)], 'burst'),
      K('Domo de Energia', 3, [shield({ p:.18 }, 'allies', 6), cleanse('allies')], 'buff')],
    warden:[K('Motosserra', 1, [dmg(1.3, 'tgt', { exec:.8 }), drain(.4)], 'slash'),
      K('Abate Brutal', 3, [execute(.2), dmg(2.9, 'tgt', { vsBroken:.6 }), nrg(20)], 'burst')],
    zara:[K('Dentes de Sucata', 1, [dmg(1.0), st('stun', 1, 0, .6), st('bleed', 4, .25)], 'burst'),
      K('Zum-Zum, a Metralhadora', 3, [dmg(.41, 'tgt', { hits:8, crit:.1 }), buff('spd', .3, 6)], 'burst')],
    kira:[K('Chama Brincalhona', 1, [dmg(1.0), st('weaken', 4, .2), nrg(8)], 'beam'),
      K('Nove Caudas em Flor', 3, [dmg(.5, 'randEach', { hits:9 }), st('weaken', 5, .2, 1, 'all')], 'burst')],
    haru:[K('Cortina de Vento', 1, [shield(1.0, 'allies', 3), buff('dodge', .15, 3, 'allies')], 'buff'),
      K('Lâmina no Ar', 3, [dmg(1.0, 'tgt', { hits:3, crit:.3, vsBroken:.4 }), delay(2)], 'slash')],
    ivy:[K('Pulso Duplo', 1, [dmg(.7, 'tgt', { hits:2 }), adv(.5, 'self')], 'burst'),
      K('Carga Temporal', 3, [dmg(2.3), dmg(.8, 'all'), delay(2, 'all')], 'burst')],
    nari:[K('Malha Refletora', 1, [shield({ p:.10 }, 'lowAlly', 4), taunt(3)], 'buff'),
      K('Canhões Gêmeos', 3, [dmg(.5, 'front', { hits:4 }), st('armorBreak', 5, .25, 1, 'front'), brk(1, 'front')], 'burst')],
    aurelia:[K('Asas de Socorro', 1, [heal({ p:.10 }, 'lowAlly'), cleanse('lowAlly'), adv(.3, 'lowAlly')], 'heal'),
      K('Chuva de Penas', 3, [heal({ p:.18 }, 'allies'), buff('regen', .02, 6, 'allies'), dmg(1.0, 'all')], 'heal')],
    dario:[K('Bomba de Fumaça', 1, [buff('stealth', 1, 2.5), st('weaken', 4, .2, 1, 'all')], 'buff'),
      K('Corrente de Abates', 3, [dmg(1.5, 'low', { exec:1.0, crit:.3 }), dmg(1.5, 'low', { exec:1.0, crit:.3 })], 'slash')],
    cole:[K('Faca de Combate', 1, [dmg(1.2), st('bleed', 5, .3), st('armorBreak', 4, .15)], 'slash'),
      K('Granada de Luz', 3, [st('stun', 1.5, 0, .8, 'all'), dmg(1.2, 'all'), brk(1, 'all')], 'burst')],
    dana:[K('Erva do Pântano', 1, [heal({ p:.12 }, 'lowAlly'), buff('dodge', .15, 4, 'lowAlly')], 'heal'),
      K('Mistura Dupla', 3, [heal({ p:.20 }, 'allies'), cleanse('allies'), buff('atk', .15, 6, 'allies')], 'heal')],
    wade:[K('Laço', 1, [dmg(.8), st('slow', 4, .4), delay(2)], 'beam'),
      K('Dinamite', 3, [dmg(1.4, 'all'), st('burn', 4, .3, 1, 'all'), brk(1, 'all')], 'burst')],
    garrick:[K('Runa de Proteção', 1, [shield(1.4, 'self', 6), buff('dr', .15, 6)], 'buff'),
      K('Círculo Rúnico', 3, [st('slow', 5, .5, 1, 'all'), st('mark', 5, .2, 1, 'all'), dmg(1.0, 'all')], 'wave')],
    zira:[K('Passo Entre Véus', 1, [dmg(1.2, 'back', { crit:.3 }), buff('dodge', .2, 4)], 'slash'),
      K('Fenda Branca', 3, [dmg(2.6, 'tgt', { pierce:.6 }), dispel('tgt'), delay(2.5)], 'slash')],
    n9:[K('Programa: Varredura', 1, [st('mark', 6, .2), st('armorBreak', 5, .15)], 'beam'),
      K('Programa: Míssil', 3, [dmg(.8, 'randEach', { hits:5, vs:{ s:'mark', v:.4 } })], 'burst')],
    unit7:[K('Superaquecer', 1, [selfHp(-.05), buff('atk', .3, 6), buff('spd', .2, 6)], 'buff'),
      K('Lâmina Giratória', 3, [dmg(.7, 'all', { hits:2, lowSelf:.5 }), drain(.3)], 'wave')],
    rex:[K('Passo de Malandro', 1, [dmg(1.2), buff('dodge', .3, 4), adv(.3, 'self')], 'burst'),
      K('Chuva Escarlate', 3, [dmg(.54, 'tgt', { hits:6, crit:.2 }), st('burn', 5, .4)], 'burst')],
    virel:[K('Corte Rápido', 1, [dmg(1.4, 'tgt', { pierce:.4, crit:.2 })], 'slash'),
      K('Sentença do Vazio', 3, [delay(2, 'all'), dmg(1.3, 'all', { pierce:.3, vsBroken:.5 }), brk(1, 'all')], 'wave')],
    selene:[K('Compasso Lento', 1, [st('slow', 5, .4, 1, 'all'), delay(1, 'all')], 'wave'),
      K('Meia-Noite Suspensa', 3, [adv(.6, 'allies'), buff('spd', .2, 6, 'allies')], 'buff')],
    tessa:[K('Armadilha de Corda', 1, [st('stun', 1.2, 0, .7), dmg(.9)], 'beam'),
      K('Tiro Concentrado', 3, [dmg(3.2, 'tgt', { pierce:.3, vs:{ s:'armorBreak', v:.4 } }), brk(2)], 'beam')],
    kaji:[K('Passo de Cinzas', 1, [dmg(1.3, 'back'), st('burn', 4, .35)], 'burst'),
      K('Sopro do Submundo', 3, [dmg(2.0, 'tgt', { vs:{ s:'burn', v:.5 } }), dmg(.7, 'all'), st('burn', 6, .4, 1, 'all')], 'wave')],
    kori:[K('Deslizar', 1, [dmg(1.1), st('slow', 4, .35), buff('dodge', .2, 4)], 'slash'),
      K('Estátua de Gelo', 3, [buff('counter', 1.2, 6), shield(1.5, 'self', 6), st('freeze', 1.5), dmg(1.6, 'tgt', { vs:{ s:'freeze', v:.4 } })], 'beam')],
    goku_ui:[K('Corpo Sem Pensamento', 1, [buff('dodge', .35, 4), buff('counter', 1.0, 4)], 'buff'),
      K('Maré de Golpes Silenciosos', 3, [dmg(.55, 'tgt', { hits:6, pierce:.3 }), adv(.4, 'self')], 'slash')],
    sasuke_susanoo:[K('Costela Espectral', 1, [shield({ p:.12 }, 'self', 6), buff('counter', .8, 6)], 'buff'),
      K('Lâmina do Colosso', 3, [dmg(2.6, 'tgt', { pierce:.4 }), dmg(.7, 'all'), brk(2)], 'slash')],
    gojo_void:[K('Atração', 1, [st('mark', 5, .2, 1, 'all'), delay(.8, 'all')], 'wave'),
      K('Santuário do Vazio', 3, [st('stun', 2, 0, 1, 'all'), dispel('all'), dmg(.8, 'all')], 'wave')],
    tanjiro_hinokami:[K('Valsa da Brasa', 1, [dmg(1.2, 'tgt', { vs:{ s:'burn', v:.5 } }), nrg(10)], 'slash'),
      K('Sol Poente em Arco', 3, [dmg(1.6, 'front', { crit:.2 }), st('burn', 6, .5, 1, 'front'), brk(1, 'front')], 'wave')],
    ichigo_bankai:[K('Passo Fantasma', 1, [dmg(.9), buff('crit', .2, 5), adv(.6, 'self')], 'slash'),
      K('Crescente Sem Fim', 3, [dmg(2.2, 'tgt', { pierce:.4 }), dmg(.9, 'all', { pierce:.4 }), drain(.2)], 'wave')],
    vegeta_ego:[K('Provocação Orgulhosa', 1, [taunt(4), buff('atk', .15, 6), buff('dr', .15, 4)], 'buff'),
      K('Esfera da Ruína', 3, [dmg(3.2, 'tgt', { lowSelf:.5 }), dispel('tgt'), brk(2)], 'burst')],
    luffy_gear5:[K('Risada Livre', 1, [cleanse('allies'), nrg(8, 'allies')], 'heal'),
      K('Raio nas Mãos', 3, [dmg(2.5, 'high', { hpm:.04 }), st('stun', 1.5), brk(2)], 'beam')],
    naruto_kurama:[K('Manto da Raposa', 1, [shield({ p:.08 }, 'allies', 5), buff('regen', .015, 5, 'allies')], 'buff'),
      K('Esfera da Fera', 3, [dmg(2.3, 'tgt', { hpm:.03 }), dmg(.7, 'all'), st('burn', 5, .3, 1, 'all')], 'burst')],
    mercy_valkyrie:[K('Feixe Amplificador', 1, [buff('atk', .25, 6, 'atkAlly'), buff('crit', .15, 6, 'atkAlly')], 'buff'),
      K('Asas Abertas', 3, [buff('dr', .25, 6, 'allies'), buff('regen', .025, 6, 'allies'), adv(.4, 'allies')], 'heal')],
    sailor_eternal:[K('Beijo da Lua', 1, [heal({ p:.10 }, 'lowAlly'), nrg(12, 'lowAlly')], 'heal'),
      K('Espiral de Luar', 3, [dmg(1.4, 'all'), st('silence', 3, 0, 1, 'all'), cleanse('allies')], 'wave')],
    dante_dt:[K('Lâmina do Pacto', 1, [dmg(.7, 'tgt', { hits:2 }), buff('lifesteal', .15, 6)], 'slash'),
      K('Despertar do Pacto', 3, [selfHp(-.06), buff('atk', .35, 8), buff('lifesteal', .2, 8), dmg(1.3, 'all')], 'wave')],
    jinx_arcane:[K('Choque!', 1, [dmg(1.1), st('stun', 1, 0, .7), st('slow', 3, .3)], 'beam'),
      K('Granadas Saltitantes', 3, [dmg(.8, 'randEach', { hits:5 }), st('armorBreak', 5, .2, 1, 'all')], 'burst')]
  };
  const FLAVOR = {
    solen:['Um feixe do tamanho da manhã.', 'Quem olha direto, tropeça.', 'Ele junta o sol inteiro na palma da mão.', 'Mil sóis cabem numa esfera, por um instante.'],
    varyon:['Um raio violeta, com o nome dele assinado.', 'Ele nem olha para quem acerta.', 'O céu cinzento desaba em pedaços.', 'A realeza não pede licença.'],
    hayato:['Uma sombra para cada inimigo, e sobra.', 'O vento passa primeiro, o golpe depois.', 'Atrás dele, ninguém se machuca.', 'O vale inteiro gira com ele.'],
    ren:['O trovão tem ponta.', 'Os olhos rubros leem o próximo passo.', 'O raio não escolhe um só.', 'A chama negra só apaga quando acaba o que queimar.'],
    tobias:['Punhos que esticam, braços que voltam.', 'Ele mesmo é a pedra do estilingue.', 'O punho cresce, a brasa também.', 'Quando a maré sobe, ele sobe junto.'],
    kenji:['Dois cortes que se cruzam no mesmo fôlego.', 'Três lâminas saem da bainha de uma vez.', 'A lâmina sobe como um dragão acordando.', 'Onde ele passa, o ar fica em tiras.'],
    hiro:['A lua crescente corta na ida e na volta.', 'A lâmina bebe antes dele.', 'A máscara racha e a voz de dentro assume.', 'Um golpe só. Depois, o silêncio da lua.'],
    yuki:['Uma flor branca abre sobre o gelo.', 'Um floco que não derrete, na frente de quem precisa.', 'Ela dança, a nevasca acompanha.', 'Uma floresta inteira nasce do gelo.'],
    akira:['A correnteza gira em volta da lâmina.', 'Um corte limpo, como água parada.', 'O rio vira serpente e morde três vezes.', 'A dança que o pai ensinou, em brasa viva.'],
    hana:['Um chute que deixa marca vermelha no ar.', 'O sangue dela pega fogo quando quer.', 'Ninguém toca no irmão dela.', 'O sangue ferve e o campo queima junto.'],
    sora:['Um ponto vermelho que empurra o mundo.', 'Um ponto azul que puxa tudo para perto.', 'Entre você e ele, o infinito.', 'Rubro e celeste se chocam: o que sobra é vazio.'],
    daichi:['O segundo impacto chega depois do primeiro.', 'O punho ecoa dentro da ferida.', 'Uma faísca negra no instante exato.', 'A maldição acorda com fome.'],
    lucan:['Do alto, três vezes, sem errar.', 'Lâmina gasta se troca no ar.', 'Ele mira onde o gigante não alcança.', 'Um giro, e a rua fica quieta.'],
    mira:['Duas lâminas, um só movimento.', 'Ela chega antes do golpe que ia acertar você.', 'Vermelho girando, sem pausa.', 'O clã inteiro grita pela boca dela.'],
    erik:['Um soco do tamanho de uma casa.', 'A pele vira rocha.', 'O chão treme a quilômetros.', 'O colosso antigo levanta de dentro dele.'],
    alden:['Uma parede de aço nasce do chão.', 'Um frasco que come metal.', 'A obra da vida dele, pronta num círculo.', 'Tudo vira outra coisa, e a seu favor.'],
    ignis:['Uma faísca basta.', 'Ele estala os dedos. O resto queima.', 'O que estava em brasa, explode.', 'O deserto inteiro vira fornalha.'],
    toma:['O dedo estala e o vento arrebenta.', 'Dói nele também.', 'O corpo não aguenta. Ele usa assim mesmo.', 'Um soco com tudo o que ele herdou.'],
    ryo:['Ela segue o alvo até acertar.', 'A explosão empurra ele para a frente.', 'Uma explosão chama a outra.', 'Ele gira, e o impacto gira junto.'],
    grant:['Um soco que vira ventania.', 'Enquanto ele sorri, ninguém cai.', 'A esperança tem peso, e ele bate com ela.', 'Um golpe do tamanho de uma nação.'],
    kenta:['Muitos socos, todos iguais.', 'Só um soco. Nada de mais.', 'Agora é sério.', 'Acabou.'],
    volt:['O canhão aquece até brilhar.', 'Vapor na cara de quem estiver na frente.', 'Ele abre o reator e deixa queimar.', 'O núcleo passa do limite, de propósito.'],
    kai:['O punho carrega até doer.', 'Ele fareja quem está fraco.', 'Pedra, lâmina, palma: três golpes, uma promessa.', 'O menino some. Fica o juramento.'],
    riku:['Uma coroa de raios em volta do alvo.', 'A mão encosta, o corpo trava.', 'Rápido demais para o olho.', 'O raio cai onde ele mandar.'],
    elian:['A corrente fecha a ferida e leva o veneno.', 'O elo aperta, e a voz do inimigo some.', 'A corrente dourada passa por todos os aliados.', 'A corrente prende o mais forte. A sentença cai.'],
    aiko:['A tiara voa e volta trazendo luz.', 'Um pouco de luar sobre quem está caído.', 'Lua cheia na ponta do cetro.', 'O luar cobre a equipe inteira.'],
    kiba:['Garras que rasgam aço.', 'O uivo chama a briga para ele.', 'Metade espírito, mordida inteira.', 'Uma fenda de vento do céu ao chão.'],
    jin:['A garça mergulha uma vez só.', 'A lâmina volta para a bainha. Ele espera.', 'Você só vê quando ele já guardou a espada.', 'O relâmpago desce do céu mais alto.'],
    drake:['Um rugido que sai em chamas.', 'Fogo, para ele, é comida.', 'O punho coberto de escamas em brasa.', 'Escamas até o pescoço. O chão vira brasa.'],
    sienna:['Uma armadura que nada atravessa.', 'Armadura nova no ar, corte na descida.', 'Cem lâminas giram em volta dela.', 'O arsenal do céu desce todo de uma vez.'],
    daigo:['O ki sai das mãos e atravessa o campo.', 'Pés firmes, guarda fechada.', 'Um furacão com pernas.', 'O punho sobe, o inimigo sobe junto.'],
    mei:['Tantos chutes que parecem um só.', 'Ela gira de cabeça para baixo.', 'O chute que abre o céu ao meio.', 'A garça gira e ninguém fica de pé.'],
    kael:['Dois cortes formam um X.', 'A espada grande vai na frente.', 'A lâmina cai como um meteoro.', 'Nove golpes, cada um mais alto que o outro.'],
    sael:['Oito cortes antes de a pena cair.', 'Uma pena negra cala quem ela toca.', 'A sombra brilha antes de queimar.', 'Uma estrela cai onde ela aponta.'],
    rina:['Três golpes e um sorriso para quem precisa.', 'Você consegue. Vai!', 'Ela mergulha, e todo mundo levanta.', 'Um golpe que sobe até o firmamento.'],
    nadia:['Ela espera. Depois não erra.', 'A corda prende o pé de quem corre.', 'Ela some na areia e reaparece atrás.', 'Flechas que explodem ao chegar.'],
    thorn:['O machado vai girando e volta com gelo.', 'Um grito que acorda a montanha.', 'O inverno inteiro na lâmina.', 'A ira dele esquenta o gelo.'],
    bjorn:['Uma flecha que fere e outra que cura.', 'Uma runa de vigor nas costas do amigo.', 'As runas caem como chuva.', 'Os espíritos do norte atendem.'],
    rook:['Fragmentos para todo lado.', 'Três tiros, um alvo marcado.', 'Um domo de energia sobre a equipe.', 'O disparo vem de cima das nuvens.'],
    warden:['Dois canos, uma resposta.', 'Ela não corta. Ela mastiga.', 'Termina o que a motosserra começou.', 'Plasma suficiente para todos.'],
    zara:['Zap! Agora corre mais devagar.', 'Sucata com dentes.', 'Ela ri mais alto que a metralhadora.', 'Um míssil com cara feliz.'],
    kira:['Um olhar, e o inimigo esquece de lutar.', 'A chama vai, brinca e volta.', 'Nove caudas, nove fogos.', 'Fogos-fátuos dançam em volta dela.'],
    haru:['O aço gira e o vento afia.', 'Uma cortina de vento segura o golpe.', 'Três cortes antes de o inimigo tocar o chão.', 'O último vento sopra mais forte.'],
    ivy:['Três segundos atrás ela estava inteira.', 'Dois tiros no tempo de um.', 'A carga gruda. O tempo conta.', 'A mina estoura ontem, hoje e amanhã.'],
    nari:['Propulsores no máximo, direto no grupo.', 'A malha devolve o que chega.', 'Dois canhões, fogo contínuo.', 'Ela ejeta. O resto explode.'],
    aurelia:['O cajado toca e a dor some.', 'Ela chega voando onde precisam dela.', 'Penas brancas caem sobre a equipe.', 'Quem caiu levanta com ela.'],
    dario:['A lâmina escondida no punho.', 'Fumaça: quando some, ele também.', 'Um cai, o próximo já está marcado.', 'Do telhado, sem aviso.'],
    cole:['Mira alta, um disparo.', 'De perto, é a faca.', 'Feche os olhos. Eles não vão fechar a tempo.', 'Um tiro pesado e o chute para terminar.'],
    dana:['Primeiros socorros, em spray.', 'Erva do pântano, amassada na hora.', 'Duas ervas, uma mistura, equipe de pé.', 'Fogo para eles, fôlego para nós.'],
    wade:['Seis balas, quatro acertos, tá bom.', 'O laço pega e não solta.', 'Pavio curto.', 'O mundo fica lento. Ele não.'],
    garrick:['Uma runa de fogo no chão.', 'Uma runa que segura o golpe.', 'Quem pisa no círculo, fica.', 'A runa estoura e a terra obedece.'],
    zira:['Ela pula para outro mundo e volta atrás de você.', 'Um passo entre dois véus.', 'Uma fenda branca corta o que protege.', 'Relâmpago branco, sete vezes.'],
    n9:['Feixe concentrado, alvo travado.', 'Varredura concluída. Pontos fracos expostos.', 'Os mísseis seguem as marcas.', 'O drone libera tudo.'],
    unit7:['Ele corta e recarrega no mesmo golpe.', 'Temperatura acima do limite seguro.', 'A lâmina gira. Ele gira com ela.', 'Todos os limites desligados.'],
    rex:['Duas pistolas, nenhuma pausa.', 'Ele desvia rindo.', 'Chove vermelho.', 'O pacto cobra, mas paga bem.'],
    virel:['Espadas de espírito atravessam o campo.', 'Nenhum movimento a mais.', 'O vazio dá a sentença.', 'Um corte que passa por dentro de tudo.'],
    selene:['Balas que escolhem o próprio alvo.', 'O relógio dela anda. O deles, quase.', 'Meia-noite: o tempo é da equipe.', 'Ela chama algo maior que o tempo.'],
    tessa:['A ponta muda conforme a presa.', 'Uma corda esticada no caminho.', 'Ela segura o ar. Solta a flecha.', 'O céu escurece de flechas.'],
    kaji:['A corrente puxa: vem cá.', 'Ele some em cinzas e volta atrás.', 'O hálito do submundo.', 'O fim, em brasa.'],
    kori:['Uma esfera que congela onde toca.', 'Ele desliza no próprio gelo.', 'Você acertou a estátua.', 'O frio chega ao osso.'],
    goku_ui:['Um raio de aurora, sem som.', 'O corpo responde antes do pensamento.', 'Golpes sem som, um atrás do outro.', 'Um sol que não faz sombra.'],
    sasuke_susanoo:['A flecha racha o céu no caminho.', 'Costelas de trovão negro em volta dele.', 'A lâmina do colosso desce.', 'O eclipse não termina.'],
    gojo_void:['Um ponto carmim. Depois, nada.', 'Tudo é puxado para o mesmo lugar.', 'Dentro do santuário, ninguém se move.', 'Violeta: onde os dois pontos se encontram.'],
    tanjiro_hinokami:['Passos que deixam brasa no chão.', 'Uma valsa com a lâmina em chamas.', 'O sol se põe num arco de fogo.', 'A alvorada chega incandescente.'],
    ichigo_bankai:['Uma lua negra em forma de corte.', 'Ele já está do outro lado.', 'A crescente não para de crescer.', 'A noite sem lua cai de uma vez.'],
    vegeta_ego:['Uma estrela partida na palma da mão.', 'Venham. Todos de uma vez.', 'Uma esfera que desfaz o que toca.', 'A realeza decide quem cai.'],
    luffy_gear5:['Um punho do tamanho da onda.', 'Ele ri, e o medo vai embora.', 'Ele pega o raio com as mãos.', 'Festa na maré alta: todos convidados.'],
    naruto_kurama:['Uma esfera que gira com a fúria da raposa.', 'O manto da raposa cobre os amigos.', 'A fera concentra tudo num ponto.', 'O ciclone tem nove caudas.'],
    mercy_valkyrie:['Um feixe que recompõe o que quebrou.', 'O feixe azul deixa o amigo mais forte.', 'As asas abrem e a equipe respira.', 'Todos de pé outra vez.'],
    sailor_eternal:['As estrelas emprestam um escudo.', 'Um beijo da lua na testa.', 'O luar gira e cala o inimigo.', 'A maré lunar leva embora a dor.'],
    dante_dt:['Uma salva, sem mirar.', 'A lâmina do pacto tem sede.', 'O pacto acorda inteiro.', 'A forma verdadeira não cabe na sala.'],
    jinx_arcane:['Carregou demais. De propósito.', 'Zap! Doeu?', 'Elas quicam. E quicam. E explodem.', 'O foguete do fim da festa.']
  };

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
        if (e.vsBroken) extra.push(`+${pct(e.vsBroken)} contra alvo quebrado`);
        if (e.vs) extra.push(`+${pct(e.vs.v)} contra alvo com ${D.statusInfo[e.vs.s]?.name || e.vs.s}`);
        if (e.perDebuff) extra.push(`+${pct(e.perDebuff)} por efeito negativo no alvo, até 5`);
        if (e.spScale) extra.push(`+${pct(e.spScale)} por Ponto de Técnica guardado`);
        if (e.lowSelf) extra.push(`até +${pct(e.lowSelf)} conforme a vida que falta ao herói`);
        if (e.hpm) extra.push(`mais ${pct(e.hpm)} do HP máximo do herói`);
        return t + (extra.length ? ` (${extra.join(', ')})` : '') + '.';
      }
      case 'st': {
        const val = e.v ? (['burn','poison','bleed'].includes(e.s) ? ` (${pct(e.v)} do ATK/s)` : e.s === 'slow' || e.s === 'armorBreak' || e.s === 'weaken' || e.s === 'mark' ? ` (${pct(e.v)})` : '') : '';
        return `${e.ch < 1 ? `${pct(e.ch)} de chance de aplicar` : 'Aplica'} ${sInfo.name || e.s}${val} por ${sec(e.d)} ${TGT[e.to] || ''}.`;
      }
      case 'heal': return `Cura ${e.p ? `${pct(e.p)} do HP máximo` : `${pct(e.m)} do ATK`} ${ALLY_IN[e.to] || ''}.`;
      case 'shield': return `Concede escudo de ${e.p ? `${pct(e.p)} do HP máximo` : `${pct(e.m)} do ATK`} para ${TGT_ALLY[e.to] || 'si mesmo'} por ${sec(e.d)}.`;
      case 'buff': return e.s === 'stealth' ? `Entra em Furtividade por ${sec(e.d)}.` : e.s === 'counter' ? `Contra-ataca quem atacar (${pct(e.v)} do ATK) por ${sec(e.d)}.` : `${e.v < 0 ? 'Perde' : 'Concede'} ${e.s === 'regen' ? `regeneração de ${(Math.abs(e.v) * 100).toFixed(0)}% HP/s` : `${pct(Math.abs(e.v))} de ${(D.statNames[e.s] || e.s)}`}${e.stack ? ` (acumula até ${e.stack}×)` : ''}${e.v < 0 ? '' : ` para ${TGT_ALLY[e.to] || 'si mesmo'}`} por ${sec(e.d)}.`;
      case 'nrg': return e.v < 0 ? `Drena ${-e.v} de energia ${TGT[e.to] || ''}.` : `Concede ${e.v} de energia para ${TGT_ALLY[e.to] || 'si mesmo'}.`;
      case 'cleanse': return `Remove efeitos negativos ${ALLY_IN[e.to] || 'em si mesmo'}.`;
      case 'taunt': return `Provoca os inimigos por ${sec(e.d)}.`;
      case 'drain': return `Cura ${pct(e.v)} do dano causado.`;
      case 'revive': return `Revive um aliado caído com ${pct(e.p)} do HP.`;
      case 'cdr': return `Devolve ${String(Math.round(e.v / 3 * 10) / 10).replace('.', ',')} de Ponto de Técnica à equipe.`;
      case 'sp': return `Devolve ${e.v} Ponto${e.v > 1 ? 's' : ''} de Técnica.`;
      case 'brk': return `Tira ${e.v} de Resistência ${TGT[e.to] || ''}.`;
      case 'adv': return `Adianta em ${pct(e.v)} a próxima vez para ${TGT_ALLY[e.to] || 'si mesmo'}.`;
      case 'hp': return `Custa ${pct(-e.p)} do HP máximo.`;
      case 'cdreset': return 'Zera o descanso das habilidades e devolve 1 Ponto de Técnica.';
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
    // Habilidades: a de assinatura (custo pelo peso da recarga antiga) e as duas do kit. cd (segundos) só vale para heróis
    // rivais da Arena, que agem pela IA de inimigo.
    const fl = FLAVOR[h.id] || [];
    const skills = [{ ...h.skill, cost:h.skill.cost || (h.skill.cd >= 10 ? 3 : 2) }, ...(KITS[h.id] || []).map(k => ({ cd:4 + k.cost * 2, ...k }))]
      .map((k, j) => ({ ...k, slot:j, lv:k.lv || LEARN[j], tcd:k.tcd ?? REST[j], text:describe(k.eff), flavor:fl[j] || '' }));
    return { ...h, skill:skills[0], skills, ult:{ ...h.ult, flavor:fl[3] || '' }, index:i, sprite:h.id, title:h.world, role:h.cls, element:h.el, color:h.color || D.elements[h.el].color,
      skillCd:h.skill.cd, passiveText:describeHooks(h.passive.hooks), skillText:skills[0].text, ultText:describe(h.ult.eff), classRow:c.row };
  });

  KT.Data.roster = roster;
  KT.Kit = { describe, describeEffect, describeHooks, LEARN };
})();
