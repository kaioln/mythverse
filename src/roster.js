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

  // [id, nome, franquia, origem, classe, elemento, perfil de atributos, passiva, habilidade, ultimate]
  const H = (id, name, franchise, origin, cls, el, prof, passive, skill, ult, color) => ({ id, name, franchise, origin, cls, el, prof, passive, skill, ult, color });
  const P = (name, hooks) => ({ name, hooks });
  const S = (name, cd, eff, fx = 'burst') => ({ name, cd, eff, fx });
  const Ult = (name, eff, fx = 'ult') => ({ name, eff, fx });

  const heroes = [
    // ======================= ANIME =======================
    H('goku','Goku','Dragon Ball','anime','Arcanista','Luz',{ atk:1.05, hp:1.05 },
      P('Sangue Saiyajin', { stats:{ atk:.05 }, low:{ th:.35, eff:[buff('atk', .4, 8), heal({ p:.2 }, 'self')] } }),
      S('Kamehameha', 9, [dmg(2.6, 'tgt', { pierce:.3 })], 'beam'),
      Ult('Genki Dama', [dmg(3.0, 'all'), st('stun', 1.2, 0, .5, 'all')])),
    H('vegeta','Vegeta','Dragon Ball','anime','Executor','Raio',{ atk:1.08, def:.95 },
      P('Orgulho do Príncipe', { onCrit:{ eff:[buff('atk', .06, 8, 'self', { stack:5 })] } }),
      S('Galick Ho', 8, [dmg(2.2), st('armorBreak', 5, .25)], 'beam'),
      Ult('Final Flash', [dmg(4.4, 'tgt', { pierce:.5 }), st('stun', 1.5)])),
    H('naruto','Naruto Uzumaki','Naruto','anime','Vanguarda','Vento',{ hp:1.08 },
      P('Chakra da Kurama', { stats:{ hp:.10 }, low:{ th:.4, once:true, eff:[heal({ p:.25 }, 'self'), buff('dr', .3, 6)] } }),
      S('Kage Bunshin', 10, [taunt(4), shield(1.5, 'self', 6), dmg(1.0, 'randEach', { hits:3 })], 'slash'),
      Ult('Rasenshuriken', [dmg(2.3, 'all'), st('slow', 4, .3, 1, 'all')])),
    H('sasuke','Sasuke Uchiha','Naruto','anime','Arcanista','Raio',{ atk:1.04, hp:.95 },
      P('Sharingan', { stats:{ dodge:.12 }, onDodge:{ eff:[dmg(1.2, 'attacker')] } }),
      S('Chidori', 8, [dmg(2.8, 'tgt', { pierce:.2 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Amaterasu', [dmg(1.7, 'all'), st('burn', 8, .35, 1, 'all')])),
    H('luffy','Monkey D. Luffy','One Piece','anime','Vanguarda','Fogo',{ atk:1.06 },
      P('Corpo de Borracha', { stats:{ dr:.10 }, onHurt:{ ch:.25, eff:[nrg(10)] } }),
      S('Gomu Gomu no Gatling', 8, [dmg(.6, 'tgt', { hits:5 })], 'slash'),
      Ult('Gear Fifth', [buff('atk', .5, 8), buff('spd', .4, 8), taunt(4), heal({ p:.3 }, 'self')])),
    H('zoro','Roronoa Zoro','One Piece','anime','Executor','Vento',{ atk:1.05, hp:1.05 },
      P('Santoryu', { stats:{ critDmg:.2 }, every:{ n:3, eff:[dmg(1.2, 'tgt', { pierce:.4 })] } }),
      S('Oni Giri', 7, [dmg(2.4), st('bleed', 5, .3)], 'slash'),
      Ult('Asura: Kokujo Oni Giri', [dmg(.9, 'all', { hits:3 })])),
    H('ichigo','Ichigo Kurosaki','Bleach','anime','Executor','Sombra',{ atk:1.04, hp:1.04 },
      P('Hollow Interior', { low:{ th:.3, eff:[buff('atk', .6, 10), buff('lifesteal', .2, 10)] } }),
      S('Getsuga Tensho', 8, [dmg(1.6, 'all')], 'wave'),
      Ult('Mugetsu', [dmg(5.0, 'tgt', { pierce:.6 }), buff('atk', -.3, 6)])),
    H('rukia','Rukia Kuchiki','Bleach','anime','Suporte','Gelo',{ atk:1.05 },
      P('Dança da Lua Branca', { onAtk:{ ch:.2, eff:[st('freeze', 1.5)] } }),
      S('Tsugi no Mai: Hakuren', 10, [dmg(1.1, 'all'), st('slow', 4, .35, 1, 'all'), shield(1.0, 'front', 6)], 'wave'),
      Ult('Bankai: Hakka no Togame', [st('freeze', 3, 0, 1, 'all'), st('mark', 6, .25, 1, 'all')])),
    H('tanjiro','Tanjiro Kamado','Demon Slayer','anime','Executor','Água',{ hp:1.05 },
      P('Olfato Aguçado', { stats:{ crit:.05 }, onKill:{ eff:[nrg(30), heal({ p:.08 }, 'self')] } }),
      S('Água: Dança Giratória', 7, [dmg(1.3, 'all')], 'wave'),
      Ult('Hinokami Kagura', [dmg(3.6), st('burn', 6, .5), buff('atk', .25, 8)])),
    H('nezuko','Nezuko Kamado','Demon Slayer','anime','Vanguarda','Fogo',{ hp:1.05 },
      P('Regeneração Demoníaca', { stats:{ regen:.015 } }),
      S('Chute Demoníaco', 7, [dmg(1.8), st('stun', 1.2, 0, .6), taunt(3)], 'slash'),
      Ult('Sangue Explosivo', [dmg(2.0, 'all'), st('burn', 6, .4, 1, 'all'), cleanse('allies')])),
    H('gojo','Satoru Gojo','Jujutsu Kaisen','anime','Arcanista','Luz',{ atk:1.08, hp:.95 },
      P('Infinito', { start:{ eff:[shield({ p:.3 }, 'self', 20)] } }),
      S('Vermelho Reverso', 9, [dmg(2.2), st('stun', 1)], 'beam'),
      Ult('Vazio Roxo', [dmg(3.0, 'all', { pierce:1 })])),
    H('yuji','Yuji Itadori','Jujutsu Kaisen','anime','Vanguarda','Sombra',{ atk:1.08 },
      P('Black Flash', { onAtk:{ ch:.12, eff:[dmg(2.5, 'tgt', { crit:1 })] } }),
      S('Punho Divergente', 7, [dmg(1.4, 'tgt', { hits:2 }), taunt(3), buff('def', .3, 5)], 'slash'),
      Ult('Sukuna Desperta', [dmg(2.2, 'all'), st('bleed', 6, .35, 1, 'all'), drain(.3)])),
    H('levi','Levi Ackerman','Attack on Titan','anime','Executor','Vento',{ atk:1.06, hp:.95 },
      P('O Mais Forte da Humanidade', { stats:{ spd:.15, crit:.10 }, onKill:{ eff:[cdr(3)] } }),
      S('Investida Vertical', 6, [dmg(1.0, 'low', { hits:3 })], 'slash'),
      Ult('Ataque Rotativo', [dmg(1.5, 'all', { hits:2, exec:.8 })])),
    H('mikasa','Mikasa Ackerman','Attack on Titan','anime','Executor','Vento',{ hp:1.05 },
      P('Proteger a Família', { allyLow:{ th:.3, eff:[buff('atk', .35, 8), taunt(3)] } }),
      S('Lâminas Gêmeas', 7, [dmg(1.3, 'tgt', { hits:2, exec:.6 })], 'slash'),
      Ult('Fúria Ackerman', [dmg(1.1, 'low', { hits:4 }), buff('spd', .3, 6)])),
    H('eren','Eren Yeager','Attack on Titan','anime','Vanguarda','Terra',{ hp:1.1, def:1.05 },
      P('Titã de Ataque', { stats:{ hp:.20, def:.10 }, low:{ th:.5, once:true, eff:[shield({ p:.35 }, 'self', 8)] } }),
      S('Soco do Titã', 8, [dmg(1.7), st('stun', 1.3, 0, .7), taunt(4)], 'slash'),
      Ult('Titã Fundador', [dmg(1.6, 'all'), st('weaken', 6, .25, 1, 'all'), buff('dr', .35, 8, 'allies')])),
    H('edward','Edward Elric','Fullmetal Alchemist','anime','Suporte','Terra',{ def:1.1 },
      P('Alquimia de Combate', { stats:{ healPow:.20 }, start:{ eff:[shield(1.2, 'front', 8)] } }),
      S('Muralha de Aço', 10, [shield(1.8, 'front', 8), dmg(1.0)], 'buff'),
      Ult('Transmutação Suprema', [shield(2.2, 'allies', 10), st('armorBreak', 6, .3, 1, 'all')])),
    H('roy','Roy Mustang','Fullmetal Alchemist','anime','Arcanista','Fogo',{ atk:1.05 },
      P('Alquimista das Chamas', { stats:{ dot:.20 }, vs:{ s:'burn', v:.25 } }),
      S('Estalo Flamejante', 7, [dmg(1.5, 'rand'), st('burn', 6, .4, 1, 'rand'), dmg(1.0, 'rand')], 'burst'),
      Ult('Inferno de Ishval', [dmg(2.0, 'all'), st('burn', 8, .6, 1, 'all')])),
    H('deku','Izuku Midoriya','My Hero Academia','anime','Vanguarda','Raio',{ atk:1.06 },
      P('One For All', { every:{ n:5, eff:[dmg(2.0), selfHp(-.04)] } }),
      S('Delaware Smash', 8, [dmg(1.5, 'all'), taunt(3)], 'wave'),
      Ult('Detroit Smash 1.000.000%', [dmg(4.2), st('stun', 2), selfHp(-.12)])),
    H('bakugo','Katsuki Bakugo','My Hero Academia','anime','Arcanista','Fogo',{ atk:1.06, hp:.97 },
      P('Suor Explosivo', { onAtk:{ ch:1, eff:[buff('atk', .03, 10, 'self', { stack:10 })] } }),
      S('AP Shot', 7, [dmg(2.3, 'tgt', { pierce:.3 })], 'beam'),
      Ult('Howitzer Impact', [dmg(2.6, 'all'), st('stun', 1, 0, .4, 'all')])),
    H('allmight','All Might','My Hero Academia','anime','Vanguarda','Luz',{ atk:1.08, hp:1.05 },
      P('Símbolo da Paz', { aura:{ atk:.08 }, start:{ eff:[buff('dr', .2, 6, 'allies')] } }),
      S('Texas Smash', 8, [dmg(1.8), taunt(4), shield(1.2, 'self')], 'wave'),
      Ult('United States of Smash', [dmg(4.0, 'tgt', { pierce:.4 }), buff('atk', .2, 8, 'allies')])),
    H('saitama','Saitama','One Punch Man','anime','Vanguarda','Luz',{ atk:1.1, hp:1.05, def:1.05 },
      P('Treino Diário', { stats:{ hp:.10, atk:.10, def:.10 }, onAtk:{ ch:.03, eff:[dmg(10, 'tgt', { pierce:1 })] } }),
      S('Socos Normais Consecutivos', 8, [dmg(.5, 'tgt', { hits:8 }), taunt(3)], 'slash'),
      Ult('Soco Sério', [dmg(7.0, 'tgt', { pierce:1 })])),
    H('genos','Genos','One Punch Man','anime','Atirador','Fogo',{ atk:1.04 },
      P('Núcleo Incinerador', { stats:{ crit:.05 }, onCrit:{ eff:[st('burn', 4, .3)] } }),
      S('Canhão Incinerador', 8, [dmg(1.6, 'all'), st('burn', 4, .3, .5, 'all')], 'wave'),
      Ult('Sobrecarga do Núcleo', [dmg(3.0, 'all'), selfHp(-.2)])),
    H('gon','Gon Freecss','Hunter x Hunter','anime','Vanguarda','Natureza',{ atk:1.05 },
      P('Instinto Selvagem', { low:{ th:.3, once:true, eff:[buff('atk', 1.0, 6)] } }),
      S('Jajanken: Pedra', 7, [dmg(2.4), taunt(3)], 'slash'),
      Ult('Forma Adulta', [buff('atk', .8, 10), buff('dr', .3, 10), dmg(2.0)])),
    H('killua','Killua Zoldyck','Hunter x Hunter','anime','Executor','Raio',{ atk:1.02, hp:.95 },
      P('Godspeed', { stats:{ spd:.20, dodge:.10 }, onDodge:{ eff:[dmg(1.0, 'attacker')] } }),
      S('Kanmuru', 7, [dmg(.8, 'tgt', { hits:3 }), st('stun', 1, 0, .5)], 'beam'),
      Ult('Relâmpago Divino', [dmg(1.2, 'all', { hits:2 }), st('stun', 1.5, 0, .6, 'all')])),
    H('kurapika','Kurapika','Hunter x Hunter','anime','Suporte','Luz',{ atk:1.04 },
      P('Corrente do Juramento', { stats:{ healPow:.20 }, allyLow:{ th:.4, eff:[shield(1.5, 'lowAlly', 6)] } }),
      S('Corrente da Cura', 9, [heal(2.2, 'lowAlly'), cleanse('lowAlly')], 'heal'),
      Ult('Corrente do Juízo', [st('silence', 6, 0, 1, 'high'), st('stun', 2, 0, 1, 'high'), dmg(2.5, 'high'), heal(1.5, 'allies')])),
    H('sailormoon','Usagi Tsukino','Sailor Moon','anime','Suporte','Luz',{ hp:1.05 },
      P('Cristal de Prata', { aura:{ regen:.006 } }),
      S('Moon Tiara Action', 8, [dmg(1.4), heal(1.4, 'lowAlly')], 'heal'),
      Ult('Moon Healing Escalation', [heal(3.0, 'allies'), cleanse('allies'), st('weaken', 5, .2, 1, 'all')])),
    H('inuyasha','Inuyasha','Inuyasha','anime','Vanguarda','Vento',{ atk:1.05 },
      P('Sangue Youkai', { low:{ th:.25, eff:[buff('atk', .5, 8), buff('lifesteal', .15, 8)] } }),
      S('Garras de Aço', 7, [dmg(1.0, 'tgt', { hits:2 }), st('bleed', 5, .3), taunt(3)], 'slash'),
      Ult('Kaze no Kizu', [dmg(2.6, 'all', { pierce:.2 })])),
    H('kenshin','Kenshin Himura','Rurouni Kenshin','anime','Executor','Vento',{ atk:1.04 },
      P('Batto-jutsu', { stats:{ spd:.10 }, start:{ eff:[dmg(1.5, 'high')] } }),
      S('Ryu Tsui Sen', 7, [dmg(2.5), st('stun', .8, 0, .5)], 'slash'),
      Ult('Amakakeru Ryu no Hirameki', [dmg(4.8, 'tgt', { crit:.5 })])),
    H('natsu','Natsu Dragneel','Fairy Tail','anime','Arcanista','Fogo',{ hp:1.06 },
      P('Comedor de Chamas', { vs:{ s:'burn', v:.2 }, onKill:{ eff:[heal({ p:.1 }, 'self')] } }),
      S('Rugido do Dragão', 8, [dmg(1.4, 'all'), st('burn', 5, .35, .7, 'all')], 'wave'),
      Ult('Modo Dragão Flamejante', [buff('atk', .4, 8), dmg(3.0), st('burn', 6, .6)])),
    H('erza','Erza Scarlet','Fairy Tail','anime','Vanguarda','Terra',{ def:1.08 },
      P('Reequipar', { stats:{ def:.10 }, start:{ eff:[buff('def', .3, 8), buff('atk', .15, 8)] } }),
      S('Armadura de Adamantina', 10, [shield(2.0, 'self', 8), taunt(5), shield(.8, 'allies', 6)], 'buff'),
      Ult('Armadura do Céu', [dmg(.6, 'all', { hits:5 })])),

    // ======================= JOGOS =======================
    H('ryu','Ryu','Street Fighter','game','Vanguarda','Fogo',{ def:1.05 },
      P('Caminho do Guerreiro', { stats:{ def:.10 }, onHurt:{ ch:.2, eff:[dmg(1.0, 'attacker')] } }),
      S('Hadouken', 7, [dmg(2.0), taunt(3)], 'beam'),
      Ult('Shin Shoryuken', [dmg(3.4, 'tgt', { crit:.3 }), st('stun', 1.5), buff('dr', .25, 5)])),
    H('chunli','Chun-Li','Street Fighter','game','Executor','Vento',{ atk:.98 },
      P('Pernas Relâmpago', { stats:{ spd:.25 }, every:{ n:4, eff:[dmg(.4, 'tgt', { hits:3 })] } }),
      S('Hyakuretsukyaku', 7, [dmg(.35, 'tgt', { hits:8 })], 'slash'),
      Ult('Hoyokusen', [dmg(.5, 'tgt', { hits:8 }), st('stun', 1.5), buff('dodge', .2, 6)])),
    H('cloud','Cloud Strife','Final Fantasy VII','game','Executor','Raio',{ atk:1.06, hp:1.04 },
      P('Ex-SOLDIER', { stats:{ critDmg:.25 }, onKill:{ eff:[nrg(25)] } }),
      S('Cross Slash', 8, [dmg(2.4), st('stun', 1, 0, .5)], 'slash'),
      Ult('Omnislash', [dmg(.8, 'randEach', { hits:8 })])),
    H('sephiroth','Sephiroth','Final Fantasy VII','game','Arcanista','Sombra',{ atk:1.1, hp:.95 },
      P('Asa Única', { stats:{ atk:.12 }, onKill:{ eff:[buff('atk', .1, 10, 'self', { stack:5 })] } }),
      S('Octaslash', 8, [dmg(.4, 'tgt', { hits:8 }), st('mark', 4, .15)], 'slash'),
      Ult('Supernova', [dmg(2.0, 'all', { pierce:.3 }), st('weaken', 6, .25, 1, 'all'), st('burn', 6, .4, 1, 'all')])),
    H('tifa','Tifa Lockhart','Final Fantasy VII','game','Suporte','Terra',{ atk:1.08, hp:1.05 },
      P('Estilo Zangan', { low:{ th:.5, once:true, eff:[heal({ p:.25 }, 'self')] }, onAtk:{ ch:.25, eff:[nrg(8, 'allies')] } }),
      S('Beat Rush', 8, [dmg(.7, 'tgt', { hits:3 }), heal(1.2, 'lowAlly')], 'heal'),
      Ult('Final Heaven', [dmg(3.2), buff('atk', .25, 8, 'allies'), nrg(20, 'allies')])),
    H('lara','Lara Croft','Tomb Raider','game','Atirador','Terra',{ atk:1.02 },
      P('Sobrevivente', { stats:{ dodge:.10, crit:.08 }, onKill:{ eff:[buff('spd', .15, 5)] } }),
      S('Tiro Preciso', 7, [dmg(2.6, 'high', { pierce:.4 })], 'beam'),
      Ult('Flechas Explosivas', [dmg(1.8, 'all'), st('bleed', 5, .25, 1, 'all')])),
    H('kratos','Kratos','God of War','game','Vanguarda','Gelo',{ atk:1.06, hp:1.06 },
      P('Fúria Espartana', { onHurt:{ ch:1, eff:[nrg(4)] }, low:{ th:.35, eff:[buff('atk', .5, 8), buff('dr', .3, 8)] } }),
      S('Arremesso do Leviatã', 8, [dmg(2.0), st('freeze', 1.5, 0, .5), taunt(3)], 'slash'),
      Ult('Ira Espartana', [dmg(1.2, 'all', { hits:2 }), heal({ p:.25 }, 'self'), taunt(4)])),
    H('atreus','Atreus','God of War','game','Suporte','Natureza',{ atk:1.04 },
      P('Flechas Rúnicas', { onAtk:{ ch:.3, eff:[st('mark', 4, .12)] } }),
      S('Flecha de Luz', 9, [dmg(1.4), heal(1.8, 'lowAlly')], 'heal'),
      Ult('Invocação Rúnica', [buff('atk', .3, 8, 'allies'), buff('crit', .15, 8, 'allies'), st('mark', 6, .2, 1, 'all')])),
    H('masterchief','Master Chief','Halo','game','Atirador','Raio',{ hp:1.1, def:1.1 },
      P('Escudo MJOLNIR', { stats:{ def:.15 }, start:{ eff:[shield({ p:.25 }, 'self', 30)] } }),
      S('Granada de Fragmentação', 8, [dmg(1.3, 'all'), st('armorBreak', 4, .2, 1, 'all')], 'wave'),
      Ult('Canhão Spartan', [dmg(3.6, 'high', { pierce:.5 }), st('stun', 1.5, 0, 1, 'high')])),
    H('doomslayer','Doom Slayer','DOOM','game','Atirador','Fogo',{ atk:1.06, hp:1.05 },
      P('Rasgar e Destroçar', { stats:{ atk:.10 }, onKill:{ eff:[heal({ p:.12 }, 'self'), nrg(15)] } }),
      S('Super Shotgun', 7, [dmg(2.8), dmg(.8, 'rand')], 'burst'),
      Ult('BFG 9000', [dmg(3.2, 'all', { pierce:.3 })])),
    H('jinx','Jinx','League of Legends','game','Atirador','Fogo',{ atk:1.05, hp:.95 },
      P('Empolgação!', { onKill:{ eff:[buff('spd', .4, 6, 'self', { stack:3 })] } }),
      S('Zap!', 7, [dmg(1.8), st('slow', 3, .35)], 'beam'),
      Ult('Super Mega Míssil da Morte!', [dmg(2.4, 'all', { exec:1.0 })])),
    H('ahri','Ahri','League of Legends','game','Arcanista','Luz',{ atk:1.02 },
      P('Essência Vital', { stats:{ spd:.05 }, onAtk:{ ch:.35, eff:[heal(.3, 'self')] } }),
      S('Encanto', 8, [dmg(1.8), st('stun', 1.6), st('mark', 4, .2)], 'beam'),
      Ult('Ímpeto Espiritual', [dmg(1.2, 'randEach', { hits:3 }), buff('dodge', .3, 4)])),
    H('yasuo','Yasuo','League of Legends','game','Executor','Vento',{ atk:1.04 },
      P('Caminho do Errante', { stats:{ crit:.15 }, start:{ eff:[shield({ p:.15 }, 'self', 10)] } }),
      S('Tempestade de Aço', 6, [dmg(1.6), st('stun', .7, 0, .3)], 'slash'),
      Ult('Último Suspiro', [dmg(3.8, 'tgt', { pierce:.5, crit:.3 }), st('stun', 1.5)])),
    H('tracer','Tracer','Overwatch','game','Atirador','Raio',{ hp:.9 },
      P('Salto Temporal', { stats:{ dodge:.20, spd:.15 } }),
      S('Retorno', 12, [heal({ p:.3 }, 'self'), cleanse('self'), dmg(.4, 'tgt', { hits:4 })], 'heal'),
      Ult('Bomba de Pulso', [dmg(3.8), dmg(1.0, 'all')])),
    H('dva','D.Va','Overwatch','game','Vanguarda','Raio',{ hp:1.08 },
      P('Matriz de Defesa', { stats:{ hp:.10 }, onHurt:{ ch:.25, eff:[shield(.6, 'self', 4)] } }),
      S('Propulsores', 8, [dmg(1.4), st('stun', 1, 0, .6), taunt(4)], 'slash'),
      Ult('Autodestruição', [dmg(3.0, 'all'), shield(1.5, 'allies', 6)])),
    H('mercy','Mercy','Overwatch','game','Suporte','Luz',{ hp:1.02 },
      P('Anjo da Guarda', { stats:{ healPow:.25 } }),
      S('Cajado Caduceu', 8, [heal(2.4, 'lowAlly'), buff('atk', .2, 5, 'atkAlly')], 'heal'),
      Ult('Ressurreição', [revive(.5), heal(2.0, 'allies')])),
    H('ezio','Ezio Auditore','Assassin’s Creed','game','Executor','Sombra',{ atk:1.03 },
      P('Nada é Verdade', { stats:{ critDmg:.30 }, start:{ eff:[buff('stealth', 1, 4)] } }),
      S('Lâmina Oculta', 7, [dmg(2.2, 'low', { exec:1.2 })], 'slash'),
      Ult('Salto de Fé', [dmg(4.5, 'low', { exec:1.5, crit:.5 }), buff('stealth', 1, 3)])),
    H('leon','Leon S. Kennedy','Resident Evil','game','Atirador','Fogo',{ hp:1.03 },
      P('Mira de Precisão', { every:{ n:4, eff:[dmg(1.8, 'tgt', { crit:1 })] } }),
      S('Disparo na Cabeça', 7, [dmg(2.4), st('stun', 1, 0, .5)], 'beam'),
      Ult('Magnum + Chute Giratório', [dmg(1.2, 'all'), dmg(3.0, 'high')])),
    H('jill','Jill Valentine','Resident Evil','game','Suporte','Natureza',{ hp:1.04 },
      P('Mestre da Sobrevivência', { stats:{ healPow:.15 }, start:{ eff:[buff('dodge', .1, 10, 'allies')] } }),
      S('Spray de Primeiros Socorros', 9, [heal(2.0, 'lowAlly'), cleanse('lowAlly'), buff('regen', .02, 5, 'lowAlly')], 'heal'),
      Ult('Granada Incendiária', [dmg(1.6, 'all'), st('burn', 6, .4, 1, 'all'), heal(1.2, 'allies')])),
    H('arthur','Arthur Morgan','Red Dead Redemption 2','game','Atirador','Terra',{ hp:1.05 },
      P('Código do Fora-da-Lei', { onCrit:{ eff:[nrg(10)] } }),
      S('Revólver Cattleman', 7, [dmg(.7, 'tgt', { hits:4 })], 'burst'),
      Ult('Dead Eye', [dmg(1.6, 'randEach', { hits:6, crit:.4 })])),
    H('geralt','Geralt de Rívia','The Witcher','game','Arcanista','Fogo',{ hp:1.1 },
      P('Mutações de Bruxo', { stats:{ hp:.10 }, vs:{ s:'burn', v:.2 }, start:{ eff:[shield(1.2, 'self', 10)] } }),
      S('Sinal Igni', 8, [dmg(1.4, 'all'), st('burn', 5, .35, 1, 'all')], 'wave'),
      Ult('Sinal Aard', [st('stun', 1.5, 0, 1, 'all'), dmg(1.8, 'all'), st('armorBreak', 5, .25, 1, 'all')])),
    H('ciri','Ciri','The Witcher','game','Executor','Vento',{ atk:1.02 },
      P('Sangue Antigo', { stats:{ dodge:.15 }, onDodge:{ eff:[cdr(2)] } }),
      S('Salto entre Mundos', 6, [dmg(1.6, 'low'), buff('stealth', 1, 1.5)], 'slash'),
      Ult('Fúria de Zireael', [dmg(.9, 'randEach', { hits:7 })])),
    H('twob','2B','NieR:Automata','game','Atirador','Sombra',{ atk:1.03 },
      P('Pod 042', { onAtk:{ ch:1, eff:[dmg(.25, 'rand')] } }),
      S('Programa Laser', 9, [dmg(2.2, 'tgt', { pierce:.3 }), dmg(.6, 'all')], 'beam'),
      Ult('Programa A140', [dmg(2.8, 'all', { pierce:.2 })])),
    H('atwo','A2','NieR:Automata','game','Vanguarda','Fogo',{ atk:1.08 },
      P('Modo Berserker', { stats:{ atk:.10 }, low:{ th:.5, eff:[buff('atk', .4, 10), buff('lifesteal', .15, 10)] } }),
      S('Corte Selvagem', 7, [dmg(1.9), drain(.3), taunt(3)], 'slash'),
      Ult('Berserker Total', [buff('atk', .6, 8), buff('spd', .4, 8), selfHp(-.1), dmg(2.2, 'all')])),
    H('dante','Dante','Devil May Cry','game','Atirador','Fogo',{ hp:1.05 },
      P('Estilo Trickster', { stats:{ dodge:.12 }, onDodge:{ eff:[nrg(10)] } }),
      S('Ebony & Ivory', 6, [dmg(.4, 'randEach', { hits:6 })], 'burst'),
      Ult('Devil Trigger', [buff('atk', .5, 10), buff('lifesteal', .25, 10), heal({ p:.3 }, 'self'), dmg(2.0)])),
    H('vergil','Vergil','Devil May Cry','game','Executor','Sombra',{ atk:1.06 },
      P('Poder Absoluto', { stats:{ critDmg:.25, pierce:.15 } }),
      S('Espadas Espirituais', 7, [dmg(.5, 'all', { hits:3 })], 'wave'),
      Ult('Judgement Cut End', [dmg(3.0, 'all', { pierce:.5 }), st('bleed', 6, .3, 1, 'all')])),
    H('bayonetta','Bayonetta','Bayonetta','game','Arcanista','Sombra',{ atk:1.03 },
      P('Witch Time', { stats:{ dodge:.15 }, onDodge:{ eff:[st('slow', 4, .5, 1, 'all')] } }),
      S('Bullet Climax', 7, [dmg(.5, 'randEach', { hits:5 })], 'burst'),
      Ult('Demônio Infernal', [dmg(4.0, 'high'), dmg(1.5, 'all'), st('weaken', 5, .2, 1, 'all')])),
    H('aloy','Aloy','Horizon','game','Atirador','Natureza',{ atk:1.02 },
      P('Foco', { onAtk:{ ch:.25, eff:[st('armorBreak', 4, .15)] }, vs:{ s:'armorBreak', v:.2 } }),
      S('Flecha Elemental', 7, [dmg(2.0), st('freeze', 1.5, 0, .5)], 'beam'),
      Ult('Tempestade de Flechas', [dmg(.8, 'randEach', { hits:6 }), st('armorBreak', 6, .3, 1, 'all')])),
    H('scorpion','Scorpion','Mortal Kombat','game','Executor','Fogo',{ atk:1.04 },
      P('Fogo do Inferno', { onAtk:{ ch:.25, eff:[st('burn', 4, .3)] } }),
      S('Get Over Here!', 8, [dmg(1.8, 'high'), st('stun', 1.5, 0, 1, 'high')], 'beam'),
      Ult('Fatality', [dmg(3.5, 'low', { exec:2.0 }), st('burn', 6, .6)])),
    H('subzero','Sub-Zero','Mortal Kombat','game','Arcanista','Gelo',{ def:1.05 },
      P('Lin Kuei', { onAtk:{ ch:.2, eff:[st('slow', 3, .3)] }, vs:{ s:'freeze', v:.25 } }),
      S('Bola de Gelo', 8, [dmg(1.8), st('freeze', 2)], 'beam'),
      Ult('Congelamento Profundo', [dmg(1.6, 'all'), st('freeze', 2.5, 0, 1, 'all')]))
  ];

  // ---------------------------------------------------------------------------
  // Descrição automática — o texto sempre corresponde ao efeito real.
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
    return { ...h, index:i, sprite:h.id, title:h.franchise, role:h.cls, element:h.el, color:h.color || D.elements[h.el].color,
      skillCd:h.skill.cd, passiveText:describeHooks(h.passive.hooks), skillText:describe(h.skill.eff), ultText:describe(h.ult.eff), classRow:c.row };
  });

  KT.Data.roster = roster;
  KT.Kit = { describe, describeEffect, describeHooks };
})();
