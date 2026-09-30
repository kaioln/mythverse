// Telas sociais: Arena PvP (lutar, Loja de Honra, ranking, histórico) e Guilda (painel, guerra, busca).
(() => {
  const KT = globalThis.KT;
  const D = KT.Data, U = KT.Utils, P = KT.UIController.prototype;
  const { esc, portrait, compact } = KT.UIController.helpers;
  const S = () => KT.Social;
  const tierOf = id => D.PVP.tiers.find(t => t[0] === id) || D.PVP.tiers[0];
  const tierTag = id => { const t = tierOf(id); return `<span class="tier-tag" style="--tc:${t[2]}">${t[1]}</span>`; };
  const faces = team => (team || []).map(h => { const t = D.roster.find(x => x.id === h.id); return t ? `<img src="${portrait(t.id)}" alt="${esc(t.name)}" title="${esc(t.name)}${h.stars ? ` ${'★'.repeat(h.stars)}` : ''}">` : ''; }).join('');
  const ROLE = { leader:'Líder', officer:'Oficial', member:'Membro' };
  const since = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 2 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
  const needNeon = what => `<div class="empty-state"><h3>${what}</h3><p>Disponível com conta online (modo Neon). No modo offline não há jogadores para enfrentar.</p></div>`;
  const warWindowText = () => { const w = D.GUILD.war; return `${w.days.map(d => ['domingo','segunda','terça','quarta','quinta','sexta','sábado'][d]).join(' e ')}, das ${w.from}h às ${w.to}h (Brasília)`; };

  // ---------------------------------------------------------------------------
  // ARENA
  // ---------------------------------------------------------------------------
  P.arenaPanel = function(_, tab) {
    const so = S(); if (!so?.enabled) return needNeon('Arena PvP');
    if (!so.status && !so.arenaLoaded && !so.loadingArena) { so.loadingArena = true; so.refreshArena().finally(() => { so.loadingArena = false; }); return '<div class="empty-state"><p>Abrindo os portões da Arena…</p></div>'; }
    if (!so.status) return `<div class="empty-state"><h3>Os portões não responderam</h3><p>${esc(so.err || 'Aguardando conexão com a Arena.')}</p><button class="action" data-pvp-refresh type="button">Tentar novamente</button></div>`;
    const st = so.status || {}, t = tierOf(st.tier), ready = this.engine.heroes.length === 4, power = this.engine.getPower();
    const head = `<section class="arena-hero" style="--tc:${t[2]}"><div class="arena-crest"><b>${t[1]}</b><small>${U.fmt(st.mmr || 1000)} MMR</small></div>
      <div class="arena-copy"><span class="eyebrow">COLISEU CARMESIM · #${st.rank || '–'}</span><h3>${U.fmt(st.honor || 0)} de Honra</h3>
      <p>${st.wins || 0} vitórias · ${st.losses || 0} derrotas${st.streak > 1 ? ` · <b>${st.streak} seguidas</b>` : ''}. Ingressos hoje: <b>${(st.attacksMax || 10) - (st.attacks || 0)}/${st.attacksMax || 10}</b>. Você luta no <b>manual</b> contra a defesa salva de outro jogador.</p></div>
      <div class="arena-cta"><button class="action primary" data-pvp-save-def type="button"><i class="ic ic-shield"></i> Salvar minha defesa</button><button class="action small" data-pvp-refresh type="button">↻ Atualizar</button></div></section>`;
    if (tab === 'shop') return head + this.honorShopHtml(st);
    if (tab === 'ranking') { if (!so.ranking) so.loadRanking(); return head + this.pvpRankingHtml(); }
    if (tab === 'history') { if (!so.history) so.loadHistory(); return head + this.pvpHistoryHtml(); }
    const week = `<div class="panel arena-week"><div><b>Liga da semana ${esc(st.week || '')}</b><small>Lute ao menos 5 vezes (${Math.min(5, st.weekMatches || 0)}/5) e resgate Honra pela sua liga: Bronze 70 · Prata 120 · Ouro 200 · Platina 300 · Diamante 420 · Lenda 600.</small></div>
      <button class="action ${st.weekMatches >= 5 && !st.weekClaimed ? 'pink' : ''}" data-pvp-week type="button" ${st.weekMatches >= 5 && !st.weekClaimed ? '' : 'disabled'}>${st.weekClaimed ? 'Resgatado ✓' : 'Resgatar'}</button></div>`;
    const foes = (so.foes || []).slice().sort((a, b) => Math.abs(Math.log(Math.max(1, a.power) / Math.max(1, power))) - Math.abs(Math.log(Math.max(1, b.power) / Math.max(1, power)))).map(f => {
      const ratio = f.power / Math.max(1, power), danger = ratio > 1.35, team = (f.team || []).map(h => D.roster.find(t => t.id === h.id)).filter(Boolean);
      const roles = [...new Set(team.map(h => h.cls))], elements = [...new Set(team.map(h => h.el))];
      return `<article class="foe-card" style="--tc:${tierOf(f.tier)[2]}"><header>${tierTag(f.tier)}<b>${esc(f.name)}</b><small>${U.fmt(f.mmr)} MMR · poder ${compact(f.power)} · ${f.wins}V/${f.losses}D</small></header><div class="foe-faces">${faces(f.team)}</div><p class="matchup ${danger ? 'txt-pink' : ''}">${ratio > 1.35 ? 'Desafio elevado' : ratio < .75 ? 'Vantagem de poder' : 'Poder próximo'} · ${Math.round(ratio * 100)}% do seu poder</p><small class="dim">${esc(roles.join(' · '))}<br>${esc(elements.join(' · '))}</small><button class="action primary" data-pvp-attack="${esc(f.ref)}" type="button" ${!ready || so.busy || so.match || st.attacks >= st.attacksMax ? 'disabled' : ''}>Analisar e desafiar</button></article>`;
    }).join('');
    return `${head}${!st.hasDefense ? '<p class="note warn-note">Salve sua equipe de defesa para aparecer no matchmaking e ganhar Honra quando defender.</p>' : ''}
      ${!ready ? '<p class="note warn-note">Complete sua formação com 4 heróis para desafiar. Frente protege; retaguarda precisa de espaço para agir.</p>' : `<p class="note">Sua equipe: <b>${compact(power)} de poder</b>. Poder não decide sozinho: observe classes, elementos, cura e controle antes de gastar um ingresso. A defesa salva só muda quando você a registra novamente.</p>`}${so.err ? `<p class="note warn-note">${esc(so.err)}</p>` : ''}<h4 class="sub-title">Defesas disponíveis · mais próximas primeiro</h4><div class="foe-grid">${foes || '<p class="empty-note">Ainda não há outros jogadores com defesa salva. Chame seus amigos: cada um salva a defesa aqui.</p>'}</div>
      ${week}
      <div class="panel arena-rules"><b>Regras</b><ul><li>Você controla ultimates (Q/W/E/R), poções e o foco; a defesa rival usa IA e <b>telegrafa</b> as ultimates.</li><li>90 segundos: se o tempo acabar, vence quem tiver mais vida proporcional (empate: defensor).</li><li>Vitória: MMR (Elo) e 20 a 40 de Honra (sequência aumenta). Derrota: perde MMR e ganha 4 de Honra. Defender bem rende 6.</li><li><b>Fechar a aba ou abandonar conta como derrota.</b> Resultado impossível para o tempo real também.</li></ul></div>`;
  };
  P.honorShopHtml = function(st) {
    const bought = st.shopWeek || {};
    return `<p class="note">A Honra fica guardada no servidor: não dá para comprar com dinheiro nem editar. Tudo o que é marcado como negociável pode ser vendido no Mercado de Jogadores.</p>
      <div class="shop-grid">${D.PVP_SHOP.map(o => { const n = bought[o.id] || 0, can = (st.honor || 0) >= o.price && n < o.limit;
        return `<article class="shop-card honor-card"><b>${esc(o.name)}</b><small>${esc(o.text)}</small><small class="dim">Nesta semana: ${n}/${o.limit}</small><button class="action ${can ? 'primary' : ''}" data-pvp-buy="${o.id}" type="button" ${can ? '' : 'disabled'}>${U.fmt(o.price)} Honra</button></article>`; }).join('')}</div>`;
  };
  P.pvpRankingHtml = function() {
    const rows = S().ranking; if (!rows) return '<p class="empty-note">Carregando ranking…</p>';
    return `<div class="rank-table">${rows.map((r, i) => `<div class="rank-row ${r.me ? 'me' : ''}"><b>#${i + 1}</b><span>${r.guild_tag ? `<em class="gtag">[${esc(r.guild_tag)}]</em> ` : ''}${esc(r.display_name)}</span>${tierTag(r.tier)}<small>${U.fmt(r.mmr)} MMR · ${r.wins}V/${r.losses}D</small></div>`).join('') || '<p class="empty-note">Ninguém na Arena ainda.</p>'}</div>`;
  };
  P.pvpHistoryHtml = function() {
    const rows = S().history; if (!rows) return '<p class="empty-note">Carregando histórico…</p>';
    return `<div class="rank-table">${rows.map(h => `<div class="rank-row ${h.won ? 'win' : 'lose'}"><b>${h.won ? 'V' : 'D'}</b><span>${h.attack ? 'Você atacou' : 'Defendeu contra'} ${esc(h.foe || '?')}${h.kind === 'gvg' ? ' <em class="gtag">guerra</em>' : ''}</span><small>${h.delta ? `${h.delta > 0 ? '+' : ''}${h.delta} MMR · ` : ''}${since(h.at)}</small></div>`).join('') || '<p class="empty-note">Nenhuma luta ainda.</p>'}</div>`;
  };

  // ---------------------------------------------------------------------------
  // GUILDA
  // ---------------------------------------------------------------------------
  P.guildPanel = function(_, tab) {
    const so = S(); if (!so?.enabled) return needNeon('Guildas');
    if (tab === 'list') { if (!so.guildList) so.listGuilds(); return this.guildListHtml(); }
    if (!so.guild && !so.guildLoaded && !so.loadingGuild) { so.loadingGuild = true; so.refreshGuild().finally(() => { so.loadingGuild = false; }); return '<div class="empty-state"><p>Carregando guilda…</p></div>'; }
    if (!so.guild && so.guildLoaded) return `<div class="empty-state"><h3>Não foi possível consultar a guilda</h3><p>${esc(so.err || 'Verifique a conexão e tente novamente.')}</p><button class="action" data-guild-refresh type="button">Tentar novamente</button></div>`;
    const g = so.guild?.guild;
    if (!g) return this.guildCreateHtml();
    if (tab === 'war') { if (!so.board) so.refreshWar(); so.watchWar(true); return this.guildWarHtml(); }
    KT.Community?.start(this);
    const me = so.guild.me, officer = me.role !== 'member', perks = D.GUILD.perks;
    const need = lv => Math.round(1000 * Math.pow(1.6, lv - 1)); let rest = g.xp, lv = 1; while (lv < g.level) { rest -= need(lv); lv++; }
    const members = so.guild.members.map(m => `<div class="gm-row"><span class="gm-role r-${m.role}">${ROLE[m.role]}</span><b>${esc(m.name)}</b><small>poder ${compact(m.power)}${m.mmr ? ` · ${U.fmt(m.mmr)} MMR` : ''} · doou ${compact(m.contributed)} · visto há ${since(m.seen)}</small>
      ${m.ref !== me.ref && officer && m.role !== 'leader' && !(me.role === 'officer' && m.role === 'officer') ? `<span class="gm-acts">${me.role === 'leader' ? (m.role === 'member' ? `<button class="action small" data-guild-act="promote" data-ref="${m.ref}" type="button">Promover</button>` : `<button class="action small" data-guild-act="demote" data-ref="${m.ref}" type="button">Rebaixar</button>`) + `<button class="action small" data-guild-act="transfer" data-ref="${m.ref}" type="button">Passar liderança</button>` : ''}<button class="action small red" data-guild-act="kick" data-ref="${m.ref}" type="button">Expulsar</button></span>` : ''}</div>`).join('');
    const reqs = officer && so.guild.requests.length ? `<h4 class="sub-title">Pedidos de entrada</h4>${so.guild.requests.map(r => `<div class="gm-row"><b>${esc(r.name)}</b><small>poder ${compact(r.power)}</small><span class="gm-acts"><button class="action small primary" data-guild-act="accept" data-ref="${r.ref}" type="button">Aceitar</button><button class="action small" data-guild-act="reject" data-ref="${r.ref}" type="button">Recusar</button></span></div>`).join('')}` : '';
    const feed = so.guild.feed.map(f => `<div class="feed-row ${f.kind}">${f.kind === 'chat' ? `<b>${esc(f.author)}</b> ` : ''}<span>${esc(f.text)}</span><small>${since(f.at)}</small></div>`).join('');
    return `<section class="guild-hero"><span class="guild-emblem">${esc(g.emblem)}</span><div><span class="eyebrow">[${esc(g.tag)}] · NÍVEL ${g.level} · ${so.guild.members.length}/${g.cap} MEMBROS</span><h3>${esc(g.name)}</h3><p>${esc(g.motto || 'Sem lema ainda.')}</p>
        <div class="meter"><span style="width:${g.level >= 20 ? 100 : Math.min(100, rest / need(g.level) * 100)}%"></span></div><small class="dim">EXP ${compact(Math.max(0, rest))}/${compact(need(g.level))} · cofre ${compact(g.bank)} ouro · guerras ${g.warsWon}V/${g.warsLost}D · rating ${g.rating}</small></div></section>
      <div class="guild-grid"><div>
        <h4 class="sub-title">Bônus da guilda</h4><div class="perk-list">${perks.map(p => `<span class="${g.level >= p.lv ? 'on' : ''}"><b>Nv ${p.lv}</b>${esc(p.text)}</span>`).join('')}</div>
        <h4 class="sub-title">Doar ouro</h4><div class="card-sell"><input id="guild-donate" type="number" min="1000" step="1000" placeholder="Ouro (1 EXP a cada 1.000)"><button class="action primary" data-guild-donate type="button">Doar</button></div>
        <h4 class="sub-title">Membros</h4><div class="gm-list">${members}</div>${reqs}
        ${officer ? `<h4 class="sub-title">Configurações</h4><div class="card-sell"><input id="guild-motto" maxlength="120" value="${esc(g.motto)}" placeholder="Lema"><input id="guild-emblem" maxlength="4" value="${esc(g.emblem)}" style="max-width:70px"><label class="check"><input type="checkbox" id="guild-open" ${g.open ? 'checked' : ''}> Aberta</label><button class="action" data-guild-settings type="button">Salvar</button></div>` : ''}
        <div class="box-actions"><button class="action red" data-guild-leave type="button">${me.role === 'leader' && so.guild.members.length === 1 ? 'Desfazer guilda' : 'Sair da guilda'}</button></div>
      </div><div>
        <h4 class="sub-title">Conversa e registros da guilda</h4><small class="chat-status">Canal reservado aos membros · atualização automática</small><div class="guild-feed" role="log" aria-live="polite">${this.chatLines?.(true) || feed || '<p class="dim">Nenhuma mensagem.</p>'}</div><button class="action small" data-chat-latest type="button" hidden>Novas mensagens ↓</button><form class="chat-form" data-chat-form data-channel="guild"><label class="sr-only" for="chat-input">Mensagem para a guilda</label><input id="chat-input" maxlength="200" autocomplete="off" placeholder="Combine a próxima caçada…"><button class="action primary" type="submit">Enviar</button></form>
      </div></div>`;
  };
  P.guildCreateHtml = function() {
    const so = S(), pend = so.guild?.requests || [];
    return `<section class="guild-hero"><span class="guild-emblem"><i class="ic ic-lantern"></i></span><div><span class="eyebrow">SEM GUILDA</span><h3>Encontre seus companheiros</h3><p>Guildas sobem de nível com doações de ouro, vitórias na Arena e na Guerra de Guildas, e dão bônus de ouro, EXP e itens a todos os membros.</p></div></section>
      ${pend.length ? `<p class="note">Pedidos aguardando resposta: ${pend.map(p => `<b>${esc(p.name)}</b>`).join(', ')}.</p>` : ''}
      <div class="box-actions"><button class="action primary" data-tab-go="list" type="button">Procurar guildas</button></div>
      <h4 class="sub-title">Fundar uma guilda (${U.fmt(D.GUILD.createCost)} de ouro)</h4>
      <div class="guild-form"><input id="gc-name" maxlength="22" placeholder="Nome (3 a 22)"><input id="gc-tag" maxlength="4" placeholder="Sigla (2 a 4)"><input id="gc-emblem" maxlength="4" placeholder="Emblema (ex.: 月)"><input id="gc-motto" maxlength="120" placeholder="Lema"><label class="check"><input type="checkbox" id="gc-open" checked> Qualquer um pode entrar</label>
      <button class="action pink" data-guild-create type="button" ${this.state.player.gold >= D.GUILD.createCost ? '' : 'disabled'}>Fundar guilda</button></div>`;
  };
  P.guildListHtml = function() {
    const so = S(), rows = so.guildList, mine = so.guild?.guild?.id;
    if (!rows) return '<p class="empty-note">Procurando guildas…</p>';
    return `<div class="box-actions"><button class="action small" data-guild-list-refresh type="button">↻ Atualizar</button></div><div class="guild-cards">${rows.map(g => `<article class="guild-card"><span class="guild-emblem sm">${esc(g.emblem)}</span><div><b>[${esc(g.tag)}] ${esc(g.name)}</b><small>Nível ${g.level} · ${g.members}/${g.cap} · poder ${compact(g.power)} · rating ${g.rating} · ${g.open ? 'aberta' : 'com convite'}</small><p>${esc(g.motto || '')}</p></div>
      ${mine ? (mine === g.id ? '<span class="tag">Sua guilda</span>' : '') : `<button class="action small ${g.open ? 'primary' : ''}" data-guild-join="${g.id}" type="button" ${g.members >= g.cap ? 'disabled' : ''}>${g.open ? 'Entrar' : 'Pedir para entrar'}</button>`}</article>`).join('') || '<p class="empty-note">Nenhuma guilda fundada ainda. Seja o primeiro!</p>'}</div>`;
  };
  P.guildWarHtml = function() {
    const so = S(), b = so.board;
    if (!b) return '<p class="empty-note">Consultando o campo de batalha…</p>';
    const rules = `<div class="panel arena-rules"><b>Como funciona</b><ul><li>Janela: <b>${warWindowText()}</b>. Inscreva a guilda e ela é pareada com a guilda inscrita de rating mais próximo; sem par, enfrenta a <b>Legião Sem Bandeira</b> (meta: 12 pontos).</li><li>Cada membro tem <b>${D.GUILD.war.attacks} investidas</b> manuais contra as defesas da guilda inimiga. Primeira vitória sobre cada defensor: <b>3 pontos</b>; repetir: 1.</li><li>Depois da janela, quem lutou resgata Honra (vencedora 120 + 10 por investida; perdedora 40 + 10). A guilda ganha EXP e rating.</li></ul></div>`;
    if (!b.active) {
      const done = b.us && !b.claimed ? `<div class="box-actions"><button class="action pink big" data-gvg-claim type="button">Resgatar recompensa da última guerra</button></div>` : '';
      return `<section class="war-hero"><span class="eyebrow">GUERRA DE GUILDAS</span><h3>Fora da janela</h3><p>Próximas batalhas: ${warWindowText()}.</p>${b.us ? `<p>Última guerra: <b>${esc(b.us.name)}</b> ${b.us.points} × ${b.them?.points ?? 0} <b>${esc(b.them?.name || '')}</b>.</p>` : ''}</section>${done}${rules}`;
    }
    if (!b.entered) return `<section class="war-hero live"><span class="eyebrow">GUERRA DE GUILDAS · AO VIVO</span><h3>A janela está aberta!</h3><p>Inscreva a guilda para ser pareada e começar as investidas.</p><button class="action pink big" data-gvg-enter type="button">Inscrever a guilda</button></section>${rules}`;
    const left = D.GUILD.war.attacks - (b.myAttacks || 0);
    const targets = (so.targets || []).map(t => `<article class="foe-card ${t.beaten ? 'beaten' : ''}"><header><b>${esc(t.name)}</b><small>${U.fmt(t.mmr)} MMR · poder ${compact(t.power)}${t.beaten ? ' · já derrotado (1 ponto)' : ' · vale 3 pontos'}</small></header><div class="foe-faces">${faces(t.team)}</div><button class="action ${t.beaten ? '' : 'primary'}" data-gvg-attack="${esc(t.ref)}" type="button" ${left > 0 ? '' : 'disabled'}>Investir</button></article>`).join('');
    return `<section class="war-hero live"><span class="eyebrow">GUERRA DE GUILDAS · AO VIVO · atualiza sozinho</span>
        <div class="war-score"><div><b>${esc(b.us.name)}</b><em>${b.us.points}</em><small>${b.us.wins} vitórias em ${b.us.attacks} investidas</small></div><span>×</span><div><b>${esc(b.them.name)}</b><em>${b.them.points}</em><small>${b.them.npc ? 'meta da Legião' : `${b.them.wins} vitórias em ${b.them.attacks} investidas`}</small></div></div>
        <p>Suas investidas: <b>${left}/${D.GUILD.war.attacks}</b>.</p></section>
      <div class="guild-grid"><div><h4 class="sub-title">Alvos</h4><div class="foe-grid">${targets || '<p class="empty-note">Nenhum defensor disponível.</p>'}</div></div>
      <div><h4 class="sub-title">Campo de batalha</h4><div class="guild-feed">${(b.feed || []).map(f => `<div class="feed-row event"><span>${esc(f.text)}</span><small>${since(f.at)}</small></div>`).join('') || '<p class="dim">Nenhuma investida ainda.</p>'}</div></div></div>${rules}`;
  };

  // ---------------------------------------------------------------------------
  // Ações (chamadas antes do handler geral do painel)
  // ---------------------------------------------------------------------------
  P.socialAction = function(b) {
    const d = b.dataset, so = S(), val = id => this.el.modalBody.querySelector(id);
    if (!so) return false;
    if (b.hasAttribute('data-pvp-refresh')) { so.status = null; so.ranking = null; so.history = null; so.refreshArena(); return true; }
    if (b.hasAttribute('data-pvp-save-def')) { so.saveDefense(); return true; }
    if (d.pvpAttack) {
      const f = (so.foes || []).find(x => x.ref === d.pvpAttack); if (!f || so.busy || so.match) return true;
      const p = this.engine.getPower(), ratio = f.power / Math.max(1, p);
      this.ask('Antes do desafio', `<b>${esc(f.name)}</b> · ${compact(f.power)} de poder (${Math.round(ratio * 100)}% do seu).<br>${faces(f.team)}<p>${ratio > 1.35 ? 'A defesa é bem mais forte. Revise sua formação e seus contra-ataques.' : 'Compare os elementos e planeje a ordem das ultimates.'}</p><small>Consome um ingresso ao iniciar. Abandonar conta como derrota.</small>`, [{ id:'yes', label:'Desafiar', primary:true }, { id:'no', label:'Preparar equipe' }]).then(x => { if (x === 'yes') so.attack(f.ref, 'arena'); else if (x === 'no') this.openPanel('party'); }); return true;
    }
    if (b.hasAttribute('data-pvp-week')) { so.claimWeek(); return true; }
    if (d.pvpBuy) { const o = D.PVP_SHOP.find(x => x.id === d.pvpBuy); this.ask('Loja de Honra', `Comprar <b>${esc(o.name)}</b> por <b>${U.fmt(o.price)} de Honra</b>?`, [{ id:'yes', label:'Comprar', primary:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') so.buy(o.id); }); return true; }
    if (b.hasAttribute('data-guild-create')) { so.createGuild({ name:val('#gc-name')?.value, tag:val('#gc-tag')?.value, emblem:val('#gc-emblem')?.value, motto:val('#gc-motto')?.value, open:val('#gc-open')?.checked }); return true; }
    if (d.guildJoin) { so.join(Number(d.guildJoin)); return true; }
    if (b.hasAttribute('data-guild-list-refresh')) { so.guildList = null; so.listGuilds(); return true; }
    if (b.hasAttribute('data-guild-refresh')) { so.refreshGuild(); return true; }
    if (d.guildAct) { const go = () => so.manage(d.guildAct, d.ref); if (['kick', 'transfer'].includes(d.guildAct)) this.ask('Confirmar', d.guildAct === 'kick' ? 'Expulsar este membro da guilda?' : 'Passar a liderança para este membro? Você vira oficial.', [{ id:'yes', label:'Confirmar', danger:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') go(); }); else go(); return true; }
    if (b.hasAttribute('data-guild-leave')) { this.ask('Sair da guilda', 'Tem certeza? Sua contribuição fica com a guilda.', [{ id:'yes', label:'Sair', danger:true }, { id:'no', label:'Cancelar' }]).then(x => { if (x === 'yes') so.leave(); }); return true; }
    if (b.hasAttribute('data-guild-donate')) { so.donate(val('#guild-donate')?.value); return true; }
    if (b.hasAttribute('data-guild-post')) { so.post(val('#guild-msg')?.value); return true; }
    if (b.hasAttribute('data-guild-settings')) { so.settings({ motto:val('#guild-motto')?.value, emblem:val('#guild-emblem')?.value, open:val('#guild-open')?.checked }); return true; }
    if (b.hasAttribute('data-gvg-enter')) { so.enterWar(); return true; }
    if (d.gvgAttack) { so.attack(d.gvgAttack, 'gvg'); return true; }
    if (b.hasAttribute('data-gvg-claim')) { so.claimWar(); return true; }
    return false;
  };

  // Resultado da luta de arena na tela de combate.
  P.onArenaResult = function(r) {
    const card = this.el.result.querySelector('.arena-result-line'); if (!card) return;
    card.innerHTML = r.kind === 'gvg' ? (r.won ? `+${r.points} ponto(s) para a guilda` : 'Nenhum ponto nesta investida') : `${r.delta >= 0 ? '+' : ''}${r.delta} MMR · +${r.honor} Honra · ${tierOf(r.tier)[1]}`;
  };
})();
