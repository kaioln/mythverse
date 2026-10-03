// Comunidade (modo Neon): chat global e perfil público com privacidade (tools/neon_community.sql).
// O banco filtra racismo/ódio e silencia reincidentes; o cliente também avisa antes de enviar.
(() => {
  const KT = globalThis.KT, P = KT.UIController.prototype;
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const hhmm = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  const Community = {
    msgs:[], last:0, timer:null, err:null, guildErr:null, profiles:{}, mine:null, sending:false, sentAt:0,
    get enabled() { return !!KT.Neon?.enabled && !!KT.Neon.user; },
    async rpc(fn, args = {}) { const r = await KT.Neon.api('POST', `/rpc/${fn}`, args); if (!r.ok) throw new Error(r.error || 'Falha de conexão.'); return r.data; },
    async poll() {
      if (!this.enabled) return;
      if (this.pending) return this.pending;
      const owner = KT.Neon.user.id;
      this.pending = (async () => {
        try {
          const rows = await this.rpc('mv_chat_recent', { p_after:this.last });
          if (KT.Neon.user?.id !== owner) return;
          const unique = new Map(this.msgs.map(m => [String(m.id), m]));
          (Array.isArray(rows) ? rows : []).forEach(m => { if (/^\d+$/.test(String(m.id))) unique.set(String(m.id), m); });
          this.msgs = [...unique.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0).slice(-120);
          if (this.msgs.length && BigInt(this.msgs.at(-1).id) > BigInt(this.last)) this.last = this.msgs.at(-1).id;
          this.err = null;
        } catch (e) { if (KT.Neon.user?.id === owner) this.err = e.message; }
        finally { this.ui?.onChat?.(); }
      })();
      try { await this.pending; } finally { this.pending = null; }
    },
    async pollGuild() {
      if (!this.enabled || this.guildPending) return;
      this.guildPending = true;
      try { KT.Social.guild = await this.rpc('mv_guild_mine'); this.guildErr = null; }
      catch (e) { this.guildErr = e.message; }
      finally { this.guildPending = false; this.ui?.onChat?.(); }
    },
    start(ui) {
      this.ui = ui; if (!this.enabled) return;
      if (this.owner !== KT.Neon.user.id) { this.owner = KT.Neon.user.id; this.msgs = []; this.last = 0; this.profiles = {}; this.err = null; this.guildErr = null; }
      if (this.timer) return;
      this.poll();
      this.timer = setInterval(() => {
        if (document.hidden) return;
        if (ui.view.panel === 'guild' && ui.view.tab === 'home' || ui.view.panel === 'chat' && ui.view.tab === 'guild') this.pollGuild();
        else if (ui.view.panel === 'chat' && ui.view.tab !== 'profile') this.poll();
      }, 4000);
    },
    async send(text) {
      text = String(text).trim();
      if (!text || text.length > 200) throw new Error('Escreva entre 1 e 200 caracteres.');
      if (this.sending) throw new Error('A mensagem anterior ainda está sendo enviada.');
      if (Date.now() - this.sentAt < 3000) throw new Error('Espere 3 segundos entre mensagens.');
      this.sending = true;
      try {
      const id = await this.rpc('mv_chat_send', { p_text:text });
      if (id === -1) throw new Error('Mensagem bloqueada: racismo e discurso de ódio são proibidos no Mythverse.');
      if (id === -2) throw new Error('Mensagem bloqueada. Por insistir em discurso de ódio, você foi silenciado no chat por 24 horas.');
      this.sentAt = Date.now();
      await this.poll(); if (!this.msgs.some(m => String(m.id) === String(id))) await this.poll(); return id;
      } finally { this.sending = false; }
    },
    async sendGuild(text) {
      text = String(text).trim();
      if (!text || text.length > 200) throw new Error('Escreva entre 1 e 200 caracteres.');
      if (this.sending) throw new Error('A mensagem anterior ainda está sendo enviada.');
      if (Date.now() - this.sentAt < 10000) throw new Error('Espere 10 segundos entre mensagens da guilda.');
      this.sending = true;
      try { await this.rpc('mv_guild_post', { p_text:text }); this.sentAt = Date.now(); await this.pollGuild(); }
      finally { this.sending = false; }
    },
    async profile(ref = '') { const p = await this.rpc('mv_profile_get', { p_ref:ref }); this.profiles[ref || 'me'] = { at:Date.now(), data:p }; return p; },
    async saveProfile(f) { await this.rpc('mv_profile_set', { p_avatar:f.avatar, p_title:f.title, p_bio:f.bio, p_show_team:f.team, p_show_stats:f.stats, p_show_guild:f.guild }); return this.profile(''); }
  };
  KT.Community = Community;

  const avatar = (id, cls = '') => id ? `<img class="av ${cls}" src="${KT.portraitUrl(id)}" alt="" loading="lazy">` : `<span class="av av-empty ${cls}">旅</span>`;

  P.onChat = function() {
    const guild = this.view.panel === 'guild' || this.view.tab === 'guild';
    if (!['chat', 'guild'].includes(this.view.panel) || this.view.tab === 'profile') return;
    const box = this.el.modalBody.querySelector('.chat-log,.guild-feed');
    if (box) {
      const html = this.chatLines(guild), near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      if (box.innerHTML !== html) { box.innerHTML = html; if (near) box.scrollTop = box.scrollHeight; else { const more = this.el.modalBody.querySelector('[data-chat-latest]'); if (more) more.hidden = false; } }
    }
    const status = this.el.modalBody.querySelector('.chat-status');
    if (status) { const err = guild ? Community.guildErr : Community.err; status.textContent = err ? `Sem conexão. Tentando de novo. ${err}` : 'Conectado'; status.classList.toggle('txt-pink', !!err); }
  };
  P.chatLines = function(guild = false) {
    const C = Community;
    if (guild) return (KT.Social?.guild?.feed || []).slice().reverse().map(m => `<div class="chat-line ${m.kind === 'event' ? 'chat-event' : ''}"><b>${esc(m.kind === 'event' ? 'Registro da guilda' : m.author)}</b><small>${hhmm(m.at)}</small><p>${esc(m.text)}</p></div>`).join('') || '<p class="empty-note">Combine uma caçada com sua guilda.</p>';
    return C.msgs.map(m => `<div class="chat-line ${m.me ? 'me' : ''}"><button class="chat-who" data-player="${esc(m.ref)}" type="button">${avatar(m.avatar)}<b>${esc(m.name)}</b></button><small>${hhmm(m.at)}</small><p>${esc(m.text)}</p></div>`).join('')
      || '<p class="empty-note">Ninguém falou ainda. Puxe conversa.</p>';
  };
  P.chatPanel = function(_, tab) {
    const C = Community;
    if (!C.enabled) return '<p class="empty-note">O chat global funciona com conta online.</p>';
    C.start(this);
    if (tab === 'profile') return this.myProfileHtml();
    const guild = tab === 'guild';
    if (guild && this.engine.serviceStatus('clans').locked) return this.serviceLockedHtml(this.engine.serviceStatus('clans'));
    if (guild && !KT.Social?.guild?.guild) return '<div class="empty-state"><h3>Uma mesa para seus aliados</h3><p>Este canal é reservado aos membros da sua guilda.</p><button class="action primary" data-go="guild:list" type="button">Procurar guildas</button></div>';
    if (guild) C.pollGuild();
    setTimeout(() => { const box = this.el.modalBody.querySelector('.chat-log'); if (box) box.scrollTop = box.scrollHeight; }, 30);
    return `<section class="chat"><header class="chat-channel"><div><span class="eyebrow">${guild ? 'SOMENTE SUA GUILDA' : 'PRAÇA DE TSUKIMORI · PÚBLICO'}</span><h3>${guild ? esc(KT.Social.guild.guild.name) : 'Viajantes de todos os mundos'}</h3></div><small class="chat-status">${esc((guild ? C.guildErr : C.err) || 'Conectado')}</small></header>
      <div class="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="${guild ? 'Chat da guilda' : 'Chat global'}">${this.chatLines(guild)}</div><button class="action small" data-chat-latest type="button" hidden>Novas mensagens ↓</button>
      <form class="chat-form" data-chat-form data-channel="${guild ? 'guild' : 'global'}"><label class="sr-only" for="chat-input">Sua mensagem</label><input id="chat-input" maxlength="200" autocomplete="off" placeholder="${guild ? 'Fale com a guilda…' : 'Converse com os viajantes…'}"><button class="action primary" type="submit">Enviar</button></form>
      <small class="dim chat-rules">Até 200 caracteres · Enter envia. ${guild ? 'Canal reservado aos membros. ' : 'Canal público: não compartilhe dados pessoais. '}Respeite os demais jogadores.</small></section>`;
  };
  P.myProfileHtml = function() {
    const C = Community, p = C.profiles.me?.data;
    if (!p) { if (!C._loadingMe) { C._loadingMe = true; C.profile('').then(() => { C._loadingMe = false; this.refreshPanel(); }).catch(e => { C._loadingMe = false; this.toast(esc(e.message)); }); } return '<p class="empty-note">Carregando perfil…</p>'; }
    const heroes = [...new Map(this.state.collection.map(r => [r.id, r])).keys()];
    return `<section class="profile-edit"><div class="profile-card">${this.playerCardHtml(p)}</div>
      <form class="profile-form" data-profile-form>
        <h4>Avatar</h4><div class="avatar-pick">${heroes.map(id => `<label><input type="radio" name="avatar" value="${id}" ${p.avatar === id ? 'checked' : ''}>${avatar(id)}</label>`).join('')}</div>
        <small class="dim">Só retratos dos seus heróis. Nada de fotos.</small>
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
      if (Community.sending) return;
      const button = ev.target.querySelector('[type="submit"]');
      try { inp.disabled = true; button.disabled = true; button.textContent = 'Enviando…'; await (ev.target.dataset.channel === 'guild' ? Community.sendGuild(text) : Community.send(text)); inp.value = ''; ui.onChat(); } catch (e) { ui.toast(esc(e.message)); } finally { inp.disabled = false; button.disabled = false; button.textContent = 'Enviar'; inp.focus(); }
    }
    if (ev.target.matches('[data-profile-form]')) {
      ev.preventDefault(); const f = new FormData(ev.target);
      try { await Community.saveProfile({ avatar:f.get('avatar') || '', title:f.get('title') || '', bio:f.get('bio') || '', team:f.has('team'), stats:f.has('stats'), guild:f.has('guild') }); ui.toast('Perfil salvo.', 'gold'); ui.refreshPanel(); }
      catch (e) { ui.toast(esc(e.message)); }
    }
  });
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-player]'); if (b && Community.ui) { ev.preventDefault(); Community.ui.openPanel('player', b.dataset.player); } });
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-chat-latest]'); if (!b) return; const box = Community.ui?.el.modalBody.querySelector('.chat-log,.guild-feed'); if (box) box.scrollTop = box.scrollHeight; b.hidden = true; });
})();
