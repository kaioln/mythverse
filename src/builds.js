(() => {
  const KT = globalThis.KT;
  const D = KT.Data, I = KT.Items, PR = KT.Progression;

  // ---------------------------------------------------------------------------
  // ESSÊNCIAS, o nó exclusivo de cada herói (Círculo I, até 3 ranks).
  // Nenhuma se repete: cada uma nasce da história do personagem.
  // [nome, ícone, atributos por rank, efeito(rank) | null, texto(rank)]
  // ---------------------------------------------------------------------------
  const dmg = (m, to = 'tgt', o = {}) => ({ k:'dmg', m, to, ...o });
  const st = (s, d, v = 0, ch = 1, to = 'tgt') => ({ k:'st', s, d, v, ch, to });
  const buff = (s, v, d, to = 'self', o = {}) => ({ k:'buff', s, v, d, to, ...o });
  const shield = (p, to = 'self', d = 5) => ({ k:'shield', p, to, d });
  const heal = (p, to = 'self') => ({ k:'heal', p, to });
  const nrg = (v, to = 'self') => ({ k:'nrg', v, to });
  const pc = v => `${Math.round(v * 100)}%`;
  const X = (name, icon, stats, hook, text) => ({ name, icon, stats, hook, text });

  const essences = {
    solen:X('Reflexo Estelar', 'wind', { dodge:.03 }, r => ({ onDodge:{ eff:[dmg(.6 * r, 'attacker')] } }), r => `Ao esquivar: contra-ataca com ${pc(.6 * r)} do ATK.`),
    varyon:X('Além do Limite Real', 'bolt', { critDmg:.06 }, r => ({ onCrit:{ ch:.1 * r, eff:[nrg(10)] } }), r => `Críticos têm ${pc(.1 * r)} de chance de dar 10 de energia.`),
    hayato:X('Clones das Sombras', 'shield', { hp:.03 }, r => ({ onHurt:{ ch:.06 * r, eff:[{ k:'taunt', d:2 }, shield(.05)] } }), r => `Ao ser atingido (${pc(.06 * r)}): provoca por 2s e ganha escudo de 5% do HP.`),
    ren:X('Olho do Eclipse', 'eye', { pierce:.03 }, r => ({ onDodge:{ eff:[st('stun', .8, 0, .15 * r, 'attacker')] } }), r => `Ao esquivar: ${pc(.15 * r)} de chance de atordoar quem atacou (0,8s).`),
    tobias:X('Vontade do Capitão', 'crown', { atk:.02 }, r => ({ start:{ eff:[st('stun', .6, 0, .1 * r, 'all')] } }), r => `Início de cada onda: ${pc(.1 * r)} de chance de atordoar cada inimigo (0,6s).`),
    kenji:X('Nove Espadas', 'sword', { critDmg:.05 }, r => ({ every:{ n:6, eff:[dmg(.8 * r, 'all')] } }), r => `A cada 6 ataques: corte de ${pc(.8 * r)} do ATK em todos os inimigos.`),
    hiro:X('Lâmina Interior', 'moon', { spd:.04 }, r => ({ onKill:{ eff:[buff('spd', .1 * r, 5)] } }), r => `Ao abater: +${pc(.1 * r)} de velocidade por 5s.`),
    yuki:X('Lâmina da Garça Branca', 'star', { healPow:.04 }, r => ({ vs:{ s:'freeze', v:.1 * r } }), r => `+${pc(.1 * r)} de dano contra alvos congelados.`),
    akira:X('Marca do Caçador', 'flame', { crit:.015 }, r => ({ onKill:{ eff:[heal(.03 * r, 'allies')] } }), r => `Ao abater: cura ${pc(.03 * r)} do HP de toda a equipe.`),
    hana:X('Forma Despertada', 'fang', { regen:.001 }, r => ({ low:{ th:.4, eff:[buff('atk', .15 * r, 8), { k:'cleanse', to:'self' }] } }), r => `Abaixo de 40% de HP (1× por onda): +${pc(.15 * r)} ATK por 8s e purifica-se.`),
    sora:X('Visão Absoluta', 'eye', { cdr:.03 }, r => ({ onSkill:{ eff:[nrg(5 * r)] } }), r => `Ao usar a habilidade: +${5 * r} de energia.`),
    daichi:X('Divergência', 'fist', { lifesteal:.01 }, r => ({ onAtk:{ ch:.04 * r, eff:[dmg(1.5, 'tgt', { crit:1 })] } }), r => `Ataques têm ${pc(.04 * r)} de chance de golpe crítico extra de 150% ATK.`),
    lucan:X('Lâminas de Aço', 'sword', { spd:.03 }, r => ({ onAtk:{ ch:.08 * r, eff:[st('bleed', 4, .25)] } }), r => `Ataques têm ${pc(.08 * r)} de chance de causar Sangramento (4s).`),
    mira:X('Despertar do Clã', 'shield', { atk:.02 }, r => ({ allyLow:{ th:.35, eff:[shield(.06 * r, 'lowAlly')] } }), r => `Quando um aliado cai abaixo de 35%: dá a ele escudo de ${pc(.06 * r)} do HP.`),
    erik:X('Couraça Colossal', 'wall', { def:.03 }, r => ({ onHurt:{ ch:.05 * r, eff:[buff('def', .3, 4)] } }), r => `Ao ser atingido (${pc(.05 * r)}): +30% DEF por 4s.`),
    alden:X('Transmutação Instantânea', 'cross', { healPow:.03 }, r => ({ onSkill:{ eff:[shield(.03 * r, 'allies')] } }), r => `Ao usar a habilidade: escudo de ${pc(.03 * r)} do HP em toda a equipe.`),
    ignis:X('Chama Precisa', 'flame', { dot:.05 }, r => ({ onCrit:{ ch:.15 * r, eff:[st('burn', 4, .3)] } }), r => `Críticos têm ${pc(.15 * r)} de chance de Queimar (4s).`),
    toma:X('Poder Distribuído', 'bolt', { spd:.03 }, r => ({ every:{ n:5, eff:[buff('atk', .05 * r, 8, 'self', { stack:3 })] } }), r => `A cada 5 ataques: +${pc(.05 * r)} ATK por 8s (acumula 3×).`),
    ryo:X('Granadas de Suor', 'flame', { atk:.02 }, r => ({ onSkill:{ eff:[dmg(.5 * r, 'all')] } }), r => `Ao usar a habilidade: explosão de ${pc(.5 * r)} do ATK em todos.`),
    grant:X('Além do Limite', 'crown', { hp:.03 }, r => ({ low:{ th:.3, once:true, eff:[buff('atk', .2 * r, 10), { k:'taunt', d:4 }] } }), r => `Abaixo de 30% de HP (1× por batalha): +${pc(.2 * r)} ATK por 10s e provoca.`),
    kenta:X('Treino de Herói', 'fist', { atk:.02 }, r => ({ onKill:{ eff:[buff('atk', .03 * r, 15, 'self', { stack:5 })] } }), r => `Ao abater: +${pc(.03 * r)} ATK por 15s (acumula 5×).`),
    volt:X('Atualização do Núcleo', 'battery', { skill:.04 }, r => ({ onUlt:{ eff:[shield(.05 * r)] } }), r => `Ao usar a ultimate: escudo de ${pc(.05 * r)} do HP.`),
    kai:X('Aura Transbordante', 'heart', { atk:.02 }, r => ({ onHurt:{ ch:.08 * r, eff:[nrg(10)] } }), r => `Ao ser atingido (${pc(.08 * r)}): +10 de energia.`),
    riku:X('Transmutação Elétrica', 'bolt', { crit:.015 }, r => ({ onAtk:{ ch:.06 * r, eff:[st('stun', .6)] } }), r => `Ataques têm ${pc(.06 * r)} de chance de atordoar (0,6s).`),
    elian:X('Corrente Imperial', 'gem', { nrg:.03 }, r => ({ onSkill:{ eff:[buff('atk', .1 * r, 6, 'atkAlly')] } }), r => `Ao usar a habilidade: +${pc(.1 * r)} ATK no aliado mais forte por 6s.`),
    aiko:X('Poder do Cristal Lunar', 'moon', { healPow:.04 }, r => ({ allyLow:{ th:.3, eff:[heal(.05 * r, 'lowAlly')] } }), r => `Quando um aliado cai abaixo de 30%: cura ${pc(.05 * r)} do HP dele.`),
    kiba:X('Presa Carmesim', 'spear', { boss:.04 }, r => ({ onCrit:{ ch:.2 * r, eff:[dmg(.8, 'tgt', { pierce:.5 })] } }), r => `Críticos têm ${pc(.2 * r)} de chance de golpe extra de 80% ATK que ignora metade da DEF.`),
    jin:X('Estilo do Céu Veloz', 'wind', { crit:.015 }, r => ({ start:{ eff:[dmg(.8 * r, 'high')] } }), r => `Início de cada onda: saque de ${pc(.8 * r)} do ATK no inimigo mais resistente.`),
    drake:X('Chama do Dragão', 'flame', { elem:.04 }, r => ({ onKill:{ ch:.2 * r, eff:[st('burn', 4, .4, 1, 'all')] } }), r => `Ao abater: ${pc(.2 * r)} de chance de incendiar todos os inimigos.`),
    sienna:X('Armadura do Purgatório', 'thorns', { def:.03 }, r => ({ onHurt:{ ch:.1 * r, eff:[dmg(.6, 'attacker')] } }), r => `Ao ser atingida (${pc(.1 * r)}): revida com 60% do ATK.`),
    daigo:X('Instinto Assassino', 'fist', { critDmg:.05 }, r => ({ low:{ th:.35, once:true, eff:[buff('critDmg', .15 * r, 8)] } }), r => `Abaixo de 35% de HP (1× por batalha): +${pc(.15 * r)} de dano crítico por 8s.`),
    mei:X('Esfera de Energia', 'orb', { spd:.03 }, r => ({ every:{ n:6, eff:[dmg(.6 * r, 'rand')] } }), r => `A cada 6 ataques: Kikoken de ${pc(.6 * r)} do ATK num inimigo aleatório.`),
    kael:X('Ruptura de Limite', 'battery', { nrg:.03 }, r => ({ onHurt:{ ch:.1 * r, eff:[nrg(8)] } }), r => `Ao ser atingido (${pc(.1 * r)}): +8 de energia.`),
    sael:X('Lâmina Longa', 'moon', { pierce:.03 }, r => ({ onKill:{ eff:[st('mark', 5, .1 * r, 1, 'all')] } }), r => `Ao abater: marca todos os inimigos (+${pc(.1 * r)} de dano recebido, 5s).`),
    rina:X('Firmamento Carregado', 'fist', { healPow:.03 }, r => ({ onAtk:{ ch:.08 * r, eff:[{ k:'heal', m:.5, to:'lowAlly' }] } }), r => `Ataques têm ${pc(.08 * r)} de chance de curar o aliado mais ferido (50% do ATK).`),
    nadia:X('Instinto de Sobrevivência', 'heart', { dodge:.02 }, r => ({ low:{ th:.4, eff:[buff('stealth', 1, 2), heal(.05 * r)] } }), r => `Abaixo de 40% de HP (1× por onda): some por 2s e cura ${pc(.05 * r)}.`),
    thorn:X('Lâminas Acorrentadas', 'skull', { atk:.02 }, r => ({ onAtk:{ ch:.06 * r, eff:[dmg(.5, 'all')] } }), r => `Ataques têm ${pc(.06 * r)} de chance de varrer todos os inimigos (50% ATK).`),
    bjorn:X('Espírito do Lobo', 'target', { nrg:.03 }, r => ({ onSkill:{ eff:[st('mark', 5, .06 * r, 1, 'all')] } }), r => `Ao usar a habilidade: marca todos os inimigos (+${pc(.06 * r)} de dano, 5s).`),
    rook:X('Armadura de Energia', 'shield', { dr:.01 }, r => ({ onHurt:{ ch:.06 * r, eff:[shield(.06)] } }), r => `Ao ser atingido (${pc(.06 * r)}): recarrega escudo de 6% do HP.`),
    warden:X('Fúria Primordial', 'skull', { lifesteal:.01 }, r => ({ onKill:{ eff:[buff('atk', .06 * r, 6, 'self', { stack:3 })] } }), r => `Ao abater: +${pc(.06 * r)} ATK por 6s (acumula 3×).`),
    zara:X('Lançador de Peixe-Espinho', 'target', { critDmg:.05 }, r => ({ onKill:{ eff:[dmg(.6 * r, 'all')] } }), r => `Ao abater: foguete de ${pc(.6 * r)} do ATK em todos os inimigos.`),
    kira:X('Chama Raposa', 'sparkle', { skill:.03 }, r => ({ onSkill:{ eff:[heal(.02 * r), nrg(5)] } }), r => `Ao usar a habilidade: cura ${pc(.02 * r)} do HP e ganha 5 de energia.`),
    haru:X('Vento Cortante', 'wind', { crit:.02 }, r => ({ onCrit:{ ch:.1 * r, eff:[shield(.06)] } }), r => `Críticos têm ${pc(.1 * r)} de chance de erguer escudo de vento (6% do HP).`),
    ivy:X('Salto Curto', 'hourglass', { dodge:.02 }, r => ({ onDodge:{ eff:[nrg(6 * r)] } }), r => `Ao esquivar: +${6 * r} de energia.`),
    nari:X('Mecha Blindado', 'battery', { hp:.03 }, r => ({ low:{ th:.3, once:true, eff:[shield(.08 * r), { k:'taunt', d:3 }] } }), r => `Abaixo de 30% de HP (1× por batalha): escudo de ${pc(.08 * r)} do HP e provoca.`),
    aurelia:X('Valquíria', 'wings', { healPow:.04 }, r => ({ onUlt:{ eff:[heal(.04 * r, 'allies')] } }), r => `Ao usar a ultimate: cura ${pc(.04 * r)} do HP de toda a equipe.`),
    dario:X('Visão de Águia', 'eye', { critDmg:.05 }, r => ({ vs:{ s:'mark', v:.06 * r } }), r => `+${pc(.06 * r)} de dano contra alvos Marcados.`),
    cole:X('Treinamento Policial', 'target', { crit:.015 }, r => ({ every:{ n:5, eff:[dmg(.5 * r, 'tgt', { crit:.5 })] } }), r => `A cada 5 ataques: disparo extra de ${pc(.5 * r)} do ATK (+50% de crítico).`),
    dana:X('Ervas Misturadas', 'drop', { healPow:.03 }, r => ({ onSkill:{ eff:[buff('dr', .04 * r, 5, 'allies')] } }), r => `Ao usar a habilidade: equipe recebe ${pc(.04 * r)} menos dano por 5s.`),
    wade:X('Olhos da Morte', 'target', { crit:.015 }, r => ({ onCrit:{ ch:.1 * r, eff:[dmg(.8, 'rand')] } }), r => `Críticos têm ${pc(.1 * r)} de chance de disparo extra (80% ATK) num inimigo aleatório.`),
    garrick:X('Óleo de Caçador', 'drop', { boss:.04 }, r => ({ vs:{ s:'burn', v:.06 * r } }), r => `+${pc(.06 * r)} de dano contra alvos em Queimadura.`),
    zira:X('Sangue Ancestral', 'sparkle', { spd:.03 }, r => ({ onKill:{ eff:[{ k:'cdr', v:1 * r, to:'self' }] } }), r => `Ao abater: −${r}s na recarga da habilidade.`),
    n9:X('Drone Tático', 'orb', { skill:.03 }, r => ({ onSkill:{ eff:[dmg(.4 * r, 'rand')] } }), r => `Ao usar a habilidade: laser extra de ${pc(.4 * r)} do ATK num inimigo aleatório.`),
    unit7:X('Núcleo Instável', 'flame', { atk:.02 }, r => ({ low:{ th:.5, eff:[buff('spd', .1 * r, 8)] } }), r => `Abaixo de 50% de HP (1× por onda): +${pc(.1 * r)} de velocidade por 8s.`),
    rex:X('Estilo Guardião Real', 'shield', { dr:.01 }, r => ({ onHurt:{ ch:.06 * r, eff:[shield(.05), nrg(5)] } }), r => `Ao ser atingido (${pc(.06 * r)}): bloqueia (escudo de 5% do HP) e ganha 5 de energia.`),
    virel:X('Lâmina Dimensional', 'moon', { pierce:.03 }, r => ({ every:{ n:4, eff:[dmg(.4 * r, 'all', { pierce:.3 })] } }), r => `A cada 4 ataques: corte dimensional de ${pc(.4 * r)} do ATK em todos.`),
    selene:X('Trama Maligna', 'wings', { dodge:.02 }, r => ({ onDodge:{ eff:[buff('atk', .08 * r, 4)] } }), r => `Ao esquivar: +${pc(.08 * r)} ATK por 4s.`),
    tessa:X('Lança de Foco', 'spear', { pierce:.03 }, r => ({ onKill:{ eff:[st('armorBreak', 4, .1 * r, 1, 'all')] } }), r => `Ao abater: quebra a armadura de todos os inimigos (−${pc(.1 * r)} DEF, 4s).`),
    kaji:X('Fogo do Submundo', 'flame', { dot:.05 }, r => ({ vs:{ s:'burn', v:.05 * r } }), r => `+${pc(.05 * r)} de dano contra alvos em Queimadura.`),
    goku_ui:X('Corpo que Pensa Sozinho', 'wind', { dodge:.02 }, r => ({ onDodge:{ eff:[buff('crit', .04 * r, 5)] } }), r => `Ao esquivar: +${pc(.04 * r)} de crítico por 5s.`),
    sasuke_susanoo:X('Rinnegan', 'eye', { pierce:.03 }, r => ({ onSkill:{ eff:[st('slow', 4, .1 * r, 1, 'all')] } }), r => `Ao usar a habilidade: lentidão de ${pc(.1 * r)} em todos os inimigos (4s).`),
    gojo_void:X('Seis Olhos', 'eye', { cdr:.03 }, r => ({ onUlt:{ eff:[nrg(5 * r)] } }), r => `Ao usar a ultimate: recupera ${5 * r} de energia.`),
    tanjiro_hinokami:X('Respiração do Sol', 'flame', { dot:.05 }, r => ({ vs:{ s:'burn', v:.05 * r } }), r => `+${pc(.05 * r)} de dano contra alvos em Queimadura.`),
    ichigo_bankai:X('Tensa Zangetsu', 'moon', { spd:.03 }, r => ({ onCrit:{ ch:.08 * r, eff:[nrg(8)] } }), r => `Críticos têm ${pc(.08 * r)} de chance de dar 8 de energia.`),
    vegeta_ego:X('Orgulho Saiyajin', 'crown', { atk:.02 }, r => ({ low:{ th:.4, eff:[buff('critDmg', .12 * r, 8)] } }), r => `Abaixo de 40% de HP (1× por onda): +${pc(.12 * r)} de dano crítico por 8s.`),
    luffy_gear5:X('Riso de Joy Boy', 'fist', { hp:.03 }, r => ({ onHurt:{ ch:.05 * r, eff:[heal(.04)] } }), r => `Ao ser atingido (${pc(.05 * r)}): cura 4% do HP.`),
    naruto_kurama:X('Vínculo com Kurama', 'shield', { def:.03 }, r => ({ allyLow:{ th:.35, eff:[shield(.05 * r, 'lowAlly')] } }), r => `Quando um aliado cai abaixo de 35%: escudo de ${pc(.05 * r)} do HP nele.`),
    mercy_valkyrie:X('Anjo da Guarda', 'wings', { healPow:.04 }, r => ({ onSkill:{ eff:[buff('dr', .04 * r, 5, 'allies')] } }), r => `Ao usar a habilidade: −${pc(.04 * r)} de dano recebido na equipe por 5s.`),
    sailor_eternal:X('Coração Puro', 'moon', { regen:.001 }, r => ({ onUlt:{ eff:[{ k:'cleanse', to:'allies' }, shield(.03 * r, 'allies')] } }), r => `Ao usar a ultimate: purifica e dá escudo de ${pc(.03 * r)} do HP à equipe.`),
    dante_dt:X('Rebellion', 'sword', { critDmg:.05 }, r => ({ onKill:{ eff:[buff('atk', .05 * r, 6, 'self', { stack:3 })] } }), r => `Ao abater: +${pc(.05 * r)} ATK por 6s (acumula 3×).`),
    jinx_arcane:X('Zap!', 'bolt', { crit:.015 }, r => ({ onAtk:{ ch:.05 * r, eff:[st('stun', .5)] } }), r => `Ataques têm ${pc(.05 * r)} de chance de atordoar (0,5s).`),
    kori:X('Clone de Gelo', 'star', { def:.03 }, r => ({ onHurt:{ eff:[st('freeze', 1, 0, .06 * r, 'attacker')] } }), r => `Ao ser atingido: ${pc(.06 * r)} de chance de congelar quem atacou (1s).`)
  };

  function essenceNode(heroId) {
    const e = essences[heroId]; if (!e) return null;
    return { id:'ess', tier:0, x:850, name:e.name, icon:PR.icons[e.icon] ? e.icon : 'star', max:3, stats:e.stats, desc:`ESSÊNCIA: ${e.text(3)} (no rank máximo)`, sig:'ess', req:[],
      hook:e.hook, hookText:e.text };
  }

  // ---------------------------------------------------------------------------
  // BUILDS RECOMENDADAS, atributos, ordem de talentos, arma, conjuntos e afixos.
  // ---------------------------------------------------------------------------
  const classDefaults = {
    Vanguarda:{ attr:{ vit:3, str:2, agi:1 }, sets:['grove','crypt','sands','dragon'], affixes:['hpP','defP','dr','regen','lifesteal'],
      talents:['ess','v1','v2','v3','v5','v6','v7','vN','sig_skill','v8','v4','v9','v10','vK','sig_ult','v11'], style:'Tanque: fique na frente, provoque e segure o dano.' },
    Executor:{ attr:{ str:3, dex:2, luk:2 }, sets:['eclipse','forge','lantern','ghost'], affixes:['crit','critDmg','atkP','pierce','boss'],
      talents:['ess','e1','e2','e3','e6','e7','eN','sig_skill','e4','e5','e8','e10','eK','e11','sig_ult','e9'], style:'Dano letal: críticos e execução dos alvos feridos.' },
    Arcanista:{ attr:{ int:4, luk:2, vit:1 }, sets:['eclipse','archive','clock','swamp'], affixes:['skill','nrg','cdr','elem','startNrg'],
      talents:['ess','a1','a2','a3','a6','a7','aN','sig_skill','a5','a4','a8','a9','a10','aK','sig_ult','a11'], style:'Habilidades e ultimates frequentes; dano em área.' },
    Atirador:{ attr:{ agi:3, dex:3, str:1 }, sets:['frost','forge','lantern','abyss'], affixes:['spd','crit','pierce','critDmg','boss'],
      talents:['ess','t1','t2','t3','t6','t7','tN','sig_skill','t4','t5','t8','t10','tK','t9','t11','sig_ult'], style:'Dano constante da retaguarda; foca guardiões e chefes.' },
    Suporte:{ attr:{ int:3, vit:3 }, sets:['swamp','crypt','tide','clock'], affixes:['healPow','regen','nrg','cdr','hpP'],
      talents:['ess','s1','s2','s3','s5','s6','s7','sN','sig_skill','s4','s8','s9','s10','sK','s11','sig_ult'], style:'Cura, escudos e energia para a equipe. Indispensável contra chefes.' }
  };
  // Ajustes finos por personagem (atributos e estilo).
  const heroTweaks = {
    kenta:{ attr:{ str:4, vit:2 }, talents:['ess','v4','v1','v2','v8','v5','v6','vN','sig_skill','v3','v7','v11','v10','sig_ult','v9'], note:'Vanguarda ofensivo: FOR alta para o Golpe Definitivo.' },
    toma:{ attr:{ str:3, vit:2, agi:1 }, note:'O Poder Distribuído acumula ATK, invista em FOR e VIT para aguentar o custo de HP das ultimates.' },
    tobias:{ attr:{ vit:3, str:2, luk:1 }, note:'A Maré Gigante depende de energia: um pouco de SOR ajuda.' },
    grant:{ attr:{ vit:3, str:3 }, note:'Aura de ATK para a equipe: mantenha-o vivo e na frente.' },
    ryo:{ attr:{ int:3, str:2, luk:1 }, note:'As Palmas Explosivas acumulam ATK a cada golpe: mistura de INT e FOR.' },
    solen:{ attr:{ int:3, str:2, agi:1 }, note:'Esquiva (AGI) ativa o Reflexo Estelar.' },
    ivy:{ attr:{ agi:4, dex:2 }, note:'Esquiva gera energia: AGI máxima.' },
    riku:{ attr:{ agi:3, dex:2, luk:1 }, note:'Passo Relâmpago: velocidade e contra-ataques.' },
    lucan:{ attr:{ agi:3, str:2, dex:2 }, note:'Ataques rápidos que fazem sangrar.' },
    dario:{ attr:{ dex:3, luk:3 }, note:'Críticos enormes contra alvos marcados, combine com Atreus ou Sephiroth.' },
    rina:{ attr:{ int:2, str:2, vit:2 }, note:'Suporte lutadora: cura atacando e dá energia à equipe.' },
    aurelia:{ attr:{ int:4, vit:2 }, note:'Guarde a Ressurreição para quando alguém cair.' },
    elian:{ attr:{ int:3, vit:2, luk:1 }, note:'Correntes: fortalece o aliado mais forte.' },
    alden:{ attr:{ int:3, vit:3 }, note:'Escudos para a linha de frente.' },
    volt:{ attr:{ agi:2, dex:2, int:2 }, note:'Atirador de área: dano de habilidade conta muito.' },
    rook:{ attr:{ agi:2, dex:2, vit:2 }, note:'Atirador resistente: aguenta a frente se precisar.' },
    garrick:{ attr:{ int:3, vit:2, str:1 }, note:'Caçador durável: Runas em área e dano contra queimados.' },
    kori:{ attr:{ int:3, vit:2, dex:1 }, note:'Controle: congela e pune quem ataca.' },
    sael:{ attr:{ int:3, dex:2, luk:1 }, note:'Marca todos ao abater, ótimo com Executores.' },
    hana:{ attr:{ vit:4, str:2 }, note:'Regenera sem parar: VIT máxima.' },
    thorn:{ attr:{ vit:3, str:3 }, note:'Fúria ao tomar dano; varre a arena com as Lâminas Acorrentadas.' },
    nari:{ attr:{ vit:4, str:1, agi:1 }, note:'Campo Refletor: escudos constantes.' }
  };

  const recTypes = { Vanguarda:'heavy', Executor:'sword', Arcanista:'arcane', Atirador:'ranged', Suporte:'holy' };
  function buildFor(heroId) {
    const t = D.roster.find(h => h.id === heroId); if (!t) return null;
    const c = classDefaults[t.cls], tw = heroTweaks[heroId] || {};
    const allowed = I.allowedWeaponTypes(heroId);
    // A arma da classe combina com os atributos da build; as exceções de história ficam como alternativa.
    const weapon = recTypes[t.cls];
    const ess = essences[heroId];
    return { hero:t, attr:tw.attr || c.attr, talents:tw.talents || c.talents, sets:c.sets, affixes:c.affixes, weapon, allowedWeapons:allowed,
      style:c.style, note:tw.note || `${ess ? `Essência “${ess.name}”: ` : ''}${ess ? ess.text(3) : ''}` };
  }

  // Pesos de atributos para avaliar itens por herói (usado em "equipar melhor").
  const statWeights = {
    Vanguarda:{ hpFlat:1.1, defFlat:7, atkFlat:3, hp:900, def:900, dr:1800, regen:40000, lifesteal:900, atk:350, thorns:500, crit:300, critDmg:150, dodge:900, healPow:100 },
    Executor:{ atkFlat:6, hpFlat:.35, defFlat:2, atk:900, crit:1800, critDmg:800, pierce:800, boss:700, lifesteal:900, spd:800, hp:250, def:150, dodge:600, elem:400 },
    Arcanista:{ atkFlat:5, hpFlat:.35, defFlat:2, skill:1000, nrg:900, cdr:800, elem:700, atk:700, startNrg:10, ultDmg:900, dot:500, hp:250, crit:600, critDmg:300 },
    Atirador:{ atkFlat:6, hpFlat:.3, defFlat:2, atk:850, spd:1000, crit:1600, critDmg:700, pierce:900, boss:700, elem:500, dodge:600, hp:200 },
    Suporte:{ atkFlat:3, hpFlat:.8, defFlat:4, healPow:1300, regen:50000, nrg:900, cdr:800, hp:700, def:500, dr:1200, skill:500, startNrg:8, atk:250 }
  };
  function heroItemScore(item, heroId) {
    const t = D.roster.find(h => h.id === heroId); if (!t || !I.canEquip(item, heroId)) return -1;
    const w = statWeights[t.cls], s = I.itemStats(item); let v = 0;
    Object.entries(s).forEach(([k, val]) => { v += (w[k] || (k.endsWith('Flat') ? 1 : 200)) * val; });
    if (item.kind === 'unique') v *= 1.2;
    if (item.kind === 'set' && classDefaults[t.cls].sets.includes(item.setId)) v *= 1.15;
    return Math.round(v);
  }

  // Valor de combate de um herói a partir dos atributos FINAIS (com conjuntos, cartas, refino, talentos e sinergias).
  // Cada classe mede o que decide as lutas dela; a média geométrica dá retorno decrescente a um atributo só.
  const ROLE = {
    Vanguarda:{ ehp:.62, hit:.22, cast:.08, heal:0, utility:.08 },
    Executor:{ ehp:.2, hit:.68, cast:.12, heal:0, utility:0 },
    Arcanista:{ ehp:.18, hit:.4, cast:.42, heal:0, utility:0 },
    Atirador:{ ehp:.18, hit:.7, cast:.12, heal:0, utility:0 },
    Suporte:{ ehp:.3, hit:.08, cast:.2, heal:.42, utility:0 }
  };
  function heroValue(cls, st) {
    const w = ROLE[cls] || ROLE.Executor, n = v => Math.max(1e-6, v);
    const crit = 1 + Math.min(1, st.crit) * Math.max(0, st.critDmg - 1);
    const hit = st.atk * crit * st.spd * (1 + st.pierce * .5) * (1 + st.elem * .3) * (1 + st.boss * .15) * (1 + (st.dot || 0) * .5);
    const cast = st.atk * crit * (1 + st.skill) * (1 + (st.skillMastery || 0)) * (1 + st.cdr) * (1 + st.nrg * .8) * (1 + st.ultDmg * .5) * (1 + (st.startNrg || 0) / 200);
    const ehp = st.maxHp * (1 + st.def / 400) / Math.max(.25, 1 - st.dr) / Math.max(.4, 1 - Math.min(.6, st.dodge)) * (1 + st.regen * 25 + st.lifesteal * .6);
    const heal = st.atk * (1 + st.healPow) * (1 + st.cdr) * (1 + st.nrg * .8) * (1 + st.regen * 10);
    const utility = 1 + (st.thorns || 0) * .4;
    const hooks = 1 + .06 * (st.hooks?.length || 0);
    return Math.exp(w.ehp * Math.log(n(ehp)) + w.hit * Math.log(n(hit)) + w.cast * Math.log(n(cast)) + w.heal * Math.log(n(heal)) + w.utility * Math.log(n(utility))) * hooks;
  }

  KT.Builds = { essences, essenceNode, buildFor, classDefaults, heroTweaks, heroItemScore, statWeights, heroValue };
})();
