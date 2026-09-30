// Comunidade (modo Neon): chat global e perfil público com privacidade (tools/neon_community.sql).
// O banco filtra racismo/ódio e silencia reincidentes; o cliente também avisa antes de enviar.
(() => {
  const KT = globalThis.KT, P = KT.UIController.prototype;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const hhmm = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  const Community = {
    msgs:[], last:0, timer:null, err:null, profiles:{}, mine:null,
    get enabled() { return !!KT.Neon?.enabled && !!KT.Neon.user; },
    async rpc(fn, args = {}) { const r = await KT.Neon.api('POST', `/rpc/${fn}`, args); if (!r.ok) throw new Error(r.error || 'Falha de conexão.'); return r.data; },
    async poll() {
      if (!this.enabled) return;
      try { const rows = await this.rpc('mv_chat_recent', { p_after:this.last }); if (rows?.length) { this.msgs = this.msgs.concat(rows).slice(-120); this.last = rows[rows.length - 1].id; this.ui?.onChat?.(); } this.err = null; }
      catch (e) { this.err = e.message; }
    },
    start(ui) { this.ui = ui; if (this.timer || !this.enabled) return; this.poll(); this.timer = setInterval(() => { if (!document.hidden && ui.view.panel === 'chat') this.poll(); }, 4000); },
    async send(text) {
      const id = await this.rpc('mv_chat_send', { p_text:text });
      if (id === -1) throw new Error('Mensagem bloqueada: racismo e discurso de ódio são proibidos no Mythverse.');
      if (id === -2) throw new Error('Mensagem bloqueada. Por insistir em discurso de ódio, você foi silenciado no chat por 24 horas.');
      await this.poll(); return id;
    },
    async profile(ref = '') { const p = await this.rpc('mv_profile_get', { p_ref:ref }); this.profiles[ref || 'me'] = { at:Date.now(), data:p }; return p; },
    async saveProfile(f) { await this.rpc('mv_profile_set', { p_avatar:f.avatar, p_title:f.title, p_bio:f.bio, p_show_team:f.team, p_show_stats:f.stats, p_show_guild:f.guild }); return this.profile(''); }
  };
  KT.Community = Community;

  const avatar = (id, cls = '') => id ? `<img class="av ${cls}" src="${KT.portraitUrl(id)}" alt="" loading="lazy">` : `<span class="av av-empty ${cls}">旅</span>`;

  P.onChat = function() { if (this.view.panel === 'chat' && this.view.tab !== 'profile') { const box = this.el.modalBody.querySelector('.chat-log'); if (box) { const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80; box.innerHTML = this.chatLines(); if (near) box.scrollTop = box.scrollHeight; } } };
  P.chatLines = function() {
    const C = Community;
    return C.msgs.map(m => `<div class="chat-line ${m.me ? 'me' : ''}"><button class="chat-who" data-player="${esc(m.ref)}" type="button">${avatar(m.avatar)}<b>${esc(m.name)}</b></button><small>${hhmm(m.at)}</small><p>${esc(m.text)}</p></div>`).join('')
      || '<p class="empty-note">Ninguém falou ainda. Diga olá para Tsukimori!</p>';
  };
  P.chatPanel = function(_, tab) {
    const C = Community;
    if (!C.enabled) return '<p class="empty-note">O chat global funciona com conta online.</p>';
    C.start(this);
    if (tab === 'profile') return this.myProfileHtml();
    setTimeout(() => { const box = this.el.modalBody.querySelector('.chat-log'); if (box) box.scrollTop = box.scrollHeight; }, 30);
    return `<section class="chat">
      <div class="chat-log" aria-live="polite">${this.chatLines()}</div>
      <form class="chat-form" data-chat-form><input id="chat-input" maxlength="200" autocomplete="off" placeholder="Mensagem para todo o servidor (Enter envia)"><button class="action primary" type="submit">Enviar</button></form>
      <small class="dim chat-rules">Respeito acima de tudo. Racismo, injúria e discurso de ódio são bloqueados automaticamente e silenciam a conta. ${C.err ? `<b class="txt-pink">${esc(C.err)}</b>` : ''}</small></section>`;
  };
  P.myProfileHtml = function() {
    const C = Community, p = C.profiles.me?.data;
    if (!p) { if (!C._loadingMe) { C._loadingMe = true; C.profile('').then(() => { C._loadingMe = false; this.refreshPanel(); }).catch(e => { C._loadingMe = false; this.toast(esc(e.message)); }); } return '<p class="empty-note">Carregando perfil…</p>'; }
    const heroes = [...new Map(this.state.collection.map(r => [r.id, r])).keys()];
    return `<section class="profile-edit"><div class="profile-card">${this.playerCardHtml(p)}</div>
      <form class="profile-form" data-profile-form>
        <h4>Avatar</h4><div class="avatar-pick">${heroes.map(id => `<label><input type="radio" name="avatar" value="${id}" ${p.avatar === id ? 'checked' : ''}>${avatar(id)}</label>`).join('')}</div>
        <small class="dim">Só retratos dos seus heróis: nada de fotos, então nada de imagens impróprias.</small>
        <h4>Título</h4><input name="title" maxlength="40" value="${esc(p.title)}" placeholder="Ex.: Caçadora de Selos">
        <h4>Sobre você</h4><textarea name="bio" maxlength="240" rows="3" placeholder="Horários, estilo de jogo, guilda que procura…">${esc(p.bio)}</textarea>
        <h4>Quem vê o quê</h4>
        <label class="check"><input type="checkbox" name="team" ${p.privacy.team ? 'checked' : ''}> Mostrar minha equipe</label>
        <label class="check"><input type="checkbox" name="stats" ${p.privacy.stats ? 'checked' : ''}> Mostrar Poder, chefes, progresso e Arena</label>
        <label class="check"><input type="checkbox" name="guild" ${p.privacy.guild ? 'checked' : ''}> Mostrar minha guilda</label>
        <button class="action primary" type="submit">Salvar perfil</button></form></section>`;
  };
  // Cartão público (também usado no próprio perfil e ao tocar num nome do chat).
  P.playerCardHtml = function(p) {
    const s = p.stats, team = Array.isArray(p.team) ? p.team : [];
    return `<header class="pc-head">${avatar(p.avatar, 'big')}<div><h3>${esc(p.name)}</h3>${p.title ? `<small class="pc-title">${esc(p.title)}</small>` : ''}<small class="dim">Conta nível ${p.level || 1}${p.guild ? ` · [${esc(p.guild.tag)}] ${esc(p.guild.name)}` : ''}</small></div></header>
      ${p.bio ? `<p class="pc-bio">${esc(p.bio)}</p>` : ''}
      ${s ? `<div class="pc-stats"><span><b>${KT.Utils.fmt(s.power)}</b><small>Poder</small></span><span><b>${s.boss_kills}</b><small>Chefes</small></span><span><b>${s.best_stage}</b><small>Estágios</small></span><span><b>${s.rift_best}</b><small>Fenda</small></span>${s.pvp ? `<span><b>${esc(s.pvp.tier?.name || s.pvp.tier || '')}</b><small>Arena · ${s.pvp.mmr}</small></span>` : ''}</div>` : '<p class="dim">Os números deste jogador são privados.</p>'}
      ${team.length ? `<div class="pc-team">${team.map(h => `<span>${avatar(h.id)}<small>${'★'.repeat(h.stars || 1)}</small></span>`).join('')}</div>` : (p.team === null ? '<p class="dim">A equipe deste jogador é privada.</p>' : '')}`;
  };
  P.playerPanel = function(ref) {
    const C = Community, c = C.profiles[ref];
    if (!c) { C.profile(ref).then(() => this.refreshPanel()).catch(e => { this.toast(esc(e.message)); }); return '<p class="empty-note">Carregando perfil…</p>'; }
    return `<section class="profile-card">${this.playerCardHtml(c.data)}</section>`;
  };

  // Envio do chat e do perfil (formulários) e toque em nomes.
  document.addEventListener('submit', async ev => {
    const ui = Community.ui; if (!ui) return;
    if (ev.target.matches('[data-chat-form]')) {
      ev.preventDefault(); const inp = ev.target.querySelector('#chat-input'), text = inp.value.trim(); if (!text) return;
      try { inp.disabled = true; await Community.send(text); inp.value = ''; ui.onChat(); } catch (e) { ui.toast(esc(e.message)); } finally { inp.disabled = false; inp.focus(); }
    }
    if (ev.target.matches('[data-profile-form]')) {
      ev.preventDefault(); const f = new FormData(ev.target);
      try { await Community.saveProfile({ avatar:f.get('avatar') || '', title:f.get('title') || '', bio:f.get('bio') || '', team:f.has('team'), stats:f.has('stats'), guild:f.has('guild') }); ui.toast('Perfil salvo.', 'gold'); ui.refreshPanel(); }
      catch (e) { ui.toast(esc(e.message)); }
    }
  });
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-player]'); if (b && Community.ui) { ev.preventDefault(); Community.ui.openPanel('player', b.dataset.player); } });
})();
