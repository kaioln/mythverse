(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const D = KT.Data, U = KT.Utils;
  const KEYS = ['Q','W','E','R'];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const portrait = id => KT.portraitUrl(id);
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };
  const compact = n => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : U.fmt(n);

  class UIController {
    constructor(state, engine, assets, renderer, callbacks = {}) {
      this.state = state; this.engine = engine; this.assets = assets; this.renderer = renderer; this.callbacks = callbacks;
      this.logs = []; this.lootHistory = []; this.newItems = 0; this.dockKey = ''; this.lastHp = new Map(); this.dialogQueue = [];
      this.view = { panel:null, tab:null, param:null }; this.invFilter = { slot:'all', sort:'rarity' }; this.selectedSlot = 0; this.pickSlot = null;
      this.cache(); this.bind();
    }
    get U() { return U; }

    cache() {
      const $ = s => document.querySelector(s);
      this.el = {
        app:$('#app'), gold:$('#gold-value'), crystal:$('#crystal-value'), dust:$('#dust-value'), ore:$('#ore-value'), keys:$('#key-value'), keyCaption:$('#key-caption'), gems:$('#gem-value'), saveStatus:$('#save-status'),
        playerName:$('#player-name'), power:$('#power-label'), level:$('#player-level'), xpFill:$('#player-xp-fill'), avatar:$('#player-avatar-img'),
        zoneTitle:$('#zone-title'), zoneKick:$('#zone-kicker'), difficulty:$('#zone-difficulty'), wave:$('#wave-label'), powerCheck:$('#power-check'),
        locations:$('#village-actions'), viewport:$('#viewport'), canvas:$('#game-canvas'), hint:$('#stage-hint'), warn:$('#warn-banner'), result:$('#result-overlay'), dialog:$('#dialog-box'), choice:$('#choice-modal'),
        party:$('#party-strip'), cons:$('#consumables'), potionBtn:$('#potion-btn'), elixirBtn:$('#elixir-btn'), potionCount:$('#potion-count'), elixirCount:$('#elixir-count'),
        bossPanel:$('#boss-panel'), bossBreak:$('#boss-break'), bossBreakFill:$('#boss-break-fill'), bossBreakLabel:$('#boss-break-label'), bossKind:$('#boss-kind'), bossName:$('#boss-name'), bossFill:$('#boss-fill'), bossChip:$('#boss-chip'), bossShield:$('#boss-shield'), bossPercent:$('#boss-percent'), bossPhase:$('#boss-phase'), bossTimer:$('#boss-timer'), bossMark1:$('#boss-mark-1'), bossMark2:$('#boss-mark-2'),
        guide:$('#guide-card'), event:$('#event-card'), rightObjectives:$('#right-objectives'), rightLoot:$('#right-loot'), rightCombat:$('#right-combat'), lootToast:$('#loot-toast-area'),
        inventoryBadge:$('#inventory-badge'), adventureBadge:$('#adventure-badge'), questBadge:$('#quest-badge'), summonBadge:$('#summon-badge'), talentBadge:$('#talent-badge'), partyBadge:$('#party-badge'),
        auto:$('#auto-btn'), advance:$('#advance-btn'), speed:$('#speed-btn'), retreat:$('#retreat-btn'),
        modal:$('#modal'), modalTitle:$('#modal-title'), modalKicker:$('#modal-kicker'), modalBody:$('#modal-body'), modalTabs:$('#modal-tabs'), modalBackNav:$('#modal-back-nav'),
        villageHub:$('#village-hub'), toastStack:$('#toast-stack'), reveal:$('#summon-reveal'), tooltip:$('#tooltip')
      };
    }

    bind() {
      const on = (sel, ev, fn) => document.querySelector(sel)?.addEventListener(ev, fn);
      document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => this.openPanel(b.dataset.panel)));
      document.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (!b || this.el.modalBody.contains(b)) return; const [p, tab] = b.dataset.open.split(':'); this.openPanel(p, tab); });
      on('#player-chip', 'click', () => this.openPanel('record'));
      this.el.party.addEventListener('click', e => {
        const ult = e.target.closest('[data-ult]'); if (ult) { this.castUlt(Number(ult.dataset.ult)); return; }
        const det = e.target.closest('[data-hero-detail]'); if (det) { this.openPanel('hero', det.dataset.heroDetail); return; }
        const slot = e.target.closest('[data-slot-open]'); if (slot) this.openPanel('party');
      });
      this.el.auto.addEventListener('click', () => { const v = !this.state.settings.auto; if (this.engine.seg) this.engine.input('auto', v); else { this.state.settings.auto = v; this.cmd('setSetting', 'auto', v); } this.renderControls(); this.toast(this.state.settings.auto ? 'Ultimates automáticas <b>ativadas</b>.' : 'Ultimates <b>manuais</b>: use Q W E R quando a energia encher.'); });
      this.el.advance.addEventListener('click', () => { const v = !this.state.settings.autoAdvance; if (this.engine.seg) this.engine.input('advance', v); else { this.state.settings.autoAdvance = v; this.cmd('setSetting', 'autoAdvance', v); } this.renderControls(); this.toast(this.state.settings.autoAdvance ? 'Avanço automático <b>ligado</b>: ao vencer, segue para o próximo estágio.' : 'Avanço <b>desligado</b>: a equipe repete o estágio atual para treinar.'); });
      this.el.speed.addEventListener('click', () => { const seq = [1, 2, 3], i = seq.indexOf(this.state.settings.speed); this.state.settings.speed = seq[(i + 1) % seq.length]; this.renderControls(); });
      this.el.retreat.addEventListener('click', () => this.engine.enterZone('village'));
      this.el.potionBtn.addEventListener('click', () => this.engine.input('potion'));
      this.el.elixirBtn.addEventListener('click', () => this.engine.input('elixir'));
      on('#sound-btn', 'click', async () => { const onState = !this.state.settings.sound; this.state.settings.sound = onState; await this.callbacks.sound?.(onState); document.querySelector('#sound-btn').classList.toggle('on', onState); });
      on('#help-btn', 'click', () => this.openPanel('help'));
      on('#panel-toggle', 'click', () => { const narrow = matchMedia('(max-width:1100px)').matches; this.el.app.classList.toggle(narrow ? 'panel-open' : 'panel-hidden'); setTimeout(() => this.renderer.resize(), 320); });
      on('#save-status', 'click', () => {
        const local = this.engine.save(), mode = this.session?.mode;
        if (mode === 'neon') KT.Neon.flush().then(ok => this.toast(ok && local ? 'Progresso confirmado na nuvem.' : 'Save protegido localmente; tentando sincronizar.', ok && local ? 'gold' : 'red'));
        else if (mode === 'cloud') KT.Server.flush().then(r => this.toast(r.ok ? 'Progresso confirmado no servidor.' : 'Sincronização pendente.', r.ok ? 'gold' : 'red'));
        else this.toast(local ? 'Progresso salvo neste navegador.' : 'O navegador bloqueou o save.', local ? 'gold' : 'red');
      });
      document.querySelectorAll('[data-close-modal]').forEach(x => x.addEventListener('click', () => this.closeModal()));
      this.el.modalBackNav.addEventListener('click', () => this.openPanel('journey'));
      document.querySelectorAll('.right-tab').forEach(b => b.addEventListener('click', () => this.switchRight(b.dataset.right)));
      document.addEventListener('keydown', e => {
        if (e.target.matches('input,textarea,select')) return;
        if (e.code === 'Escape') { if (!this.el.reveal.hidden) this.closeReveal(); else if (!this.el.dialog.hidden) this.advanceDialog(); else this.closeModal(); return; }
        if (!this.el.modal.hidden) return;
        if (!this.el.dialog.hidden && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); this.advanceDialog(); return; }
        const map = { KeyQ:0, KeyW:1, KeyE:2, KeyR:3 }; if (map[e.code] !== undefined) this.castUlt(map[e.code]);
        if (e.code === 'Digit1') this.engine.input('potion');
        if (e.code === 'Digit2') this.engine.input('elixir');
        if (e.code === 'KeyA') this.el.auto.click();
        if (e.code === 'KeyM') this.openPanel('journey');
        if (e.code === 'KeyI') this.openPanel('inventory');
        if (e.code === 'KeyT') this.openPanel('talents');
      });
      this.el.modalBody.addEventListener('click', e => this.handleAction(e));
      this.el.modalTabs.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { this.view.tab = b.dataset.tab; this.refreshPanel(); } });
      this.el.modalBody.addEventListener('input', e => this.handleInput(e));
      this.el.modalBody.addEventListener('change', e => this.handleInput(e));
      [this.el.villageHub, this.el.result, this.el.hint, this.el.guide, this.el.choice, this.el.rightObjectives, this.el.event].forEach(n => n.addEventListener('click', e => this.handleAction(e)));
      this.el.dialog.addEventListener('click', () => this.advanceDialog());
      this.el.reveal.addEventListener('click', () => this.closeReveal());
      // Foco em inimigos.
      const cv = this.el.canvas;
      cv.addEventListener('click', e => { const p = this.renderer.toLogical(e.clientX, e.clientY); const uid = this.renderer.enemyAt(p.x, p.y); if (uid) { this.engine.input('focus', uid); const f = this.engine.focusUid; this.callbacks.click?.(); if (f) this.onLog({ text:`Equipe focando ${this.engine.enemies.find(x => x.uid === f)?.name}.`, type:'system' }); } });
      cv.addEventListener('mousemove', e => { const p = this.renderer.toLogical(e.clientX, e.clientY); const uid = this.renderer.enemyAt(p.x, p.y); this.renderer.hoverEnemy = uid; cv.classList.toggle('can-target', !!uid); if (uid) this.showEnemyTip(uid, e); else this.hideTip(); });
      cv.addEventListener('mouseleave', () => { this.renderer.hoverEnemy = null; this.hideTip(); });
      // Tooltips gerais.
      document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t) this.showTip(t.dataset.tip, t); });
      document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) this.hideTip(); });
    }

    showTip(html, anchor) {
      const t = this.el.tooltip; t.innerHTML = html; t.hidden = false;
      const r = anchor.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
      if (y + th > innerHeight - 8) y = r.top - th - 8;
      t.style.left = `${U.clamp(x, 8, innerWidth - tw - 8)}px`; t.style.top = `${Math.max(8, y)}px`;
    }
    showEnemyTip(uid, ev) {
      const e = this.engine.enemies.find(x => x.uid === uid); if (!e) return;
      const el = D.elements[e.el], weak = Object.entries(D.elements).filter(([, v]) => v.strong.includes(e.el)).map(([k, v]) => `${v.icon} ${k}`).join(', ');
      this.el.tooltip.innerHTML = `<b style="color:${el.color}">${el.icon} ${esc(e.name)}</b><br><small>Nv.${e.level} · ${e.t.role} · HP ${U.fmt(Math.max(0, e.hp))}/${U.fmt(e.maxHp)}</small><br><small>${esc(e.t.desc || '')}</small>${weak ? `<br><small>Fraco contra: <b>${weak}</b></small>` : ''}${e.t.skill ? `<br><small>Habilidade: <b>${esc(e.t.skill.name)}</b></small>` : ''}<br><small class="dim">Clique para focar a equipe neste alvo.</small>`;
      const t = this.el.tooltip; t.hidden = false; t.style.left = `${Math.min(ev.clientX + 16, innerWidth - t.offsetWidth - 8)}px`; t.style.top = `${Math.min(ev.clientY + 16, innerHeight - t.offsetHeight - 8)}px`;
    }
    hideTip() { this.el.tooltip.hidden = true; }

    castUlt(i) {
      const u = this.engine.party[i];
      const ok = this.engine.input('ult', i);
      const btn = this.el.party.querySelector(`[data-ult="${i}"]`);
      if (ok && btn) { btn.classList.remove('fired'); void btn.offsetWidth; btn.classList.add('fired'); }
      else if (!ok && u && this.engine.active && u.alive && u.energy < 100) this.toast(`${esc(u.name)}: energia ${Math.floor(u.energy)}/100.`);
      return ok;
    }
    switchRight(name) { document.querySelectorAll('.right-tab').forEach(b => b.classList.toggle('active', b.dataset.right === name)); ['objectives','loot','combat'].forEach(n => document.querySelector(`#right-${n}`).hidden = n !== name); if (name === 'combat') this.renderCombat(true); }

    // ======================= HUD =======================
    renderAll() { this.renderResources(); this.renderZone(); this.renderParty(); this.renderBoss(); this.renderControls(); this.renderSide(); this.renderLoot(); }

    renderResources() {
      const p = this.state.player, set = (el, v) => { const t = String(v); if (el.textContent !== t) { if (el.textContent && el.textContent !== ', ') { const box = el.parentElement; box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); } el.textContent = t; } };
      this.el.playerName.textContent = p.name;
      set(this.el.gold, compact(p.gold)); set(this.el.crystal, compact(p.crystal)); set(this.el.dust, compact(p.dust)); set(this.el.ore, compact(p.ore)); set(this.el.gems, this.session?.mode === 'cloud' && this.wallet && !this.wallet.error ? compact(this.wallet.balance || 0) : ', ');
      const free = this.state.starterRolls > 0; set(this.el.keys, free ? this.state.starterRolls : p.keys); this.el.keyCaption.textContent = free ? 'Grátis' : 'Chaves';
      this.el.power.textContent = `Poder ${compact(this.engine.getPower())}`;
      this.el.level.textContent = `Conta Nv. ${p.level}`;
      this.el.xpFill.style.width = `${U.clamp(p.xp / KT.State.accountXpNext(p.level) * 100, 0, 100)}%`;
      const lead = this.engine.heroes[0];
      if (lead) { const src = portrait(lead.id); if (!this.el.avatar.src.endsWith(src)) this.el.avatar.src = src; this.el.avatar.hidden = false; } else this.el.avatar.hidden = true;
      const badge = (el, n) => { el.hidden = !n; el.textContent = n > 99 ? '99+' : n; };
      const g = this.engine.guideStep();
      const ch = !g && this.state.chronicle, ls = this.engine.loginStatus();
      const claimable = (this.state.contracts || []).filter(c => c.progress >= c.n).length + D.achievements.filter(a => !this.state.achievements[a.id] && this.engine.achievementValue(a) >= a.n).length + (g && this.engine.guideDone(g) ? 1 : 0)
        + (this.state.daily?.list || []).filter(d => !d.claimed && d.progress >= d.n).length + (ch && this.engine.chronicleValue(ch) >= ch.target ? 1 : 0) + (ls.available ? 1 : 0);
      badge(this.el.questBadge, claimable);
      badge(this.el.summonBadge, this.state.starterRolls + p.keys);
      badge(this.el.inventoryBadge, this.newItems);
      { const e = this.engine, s = this.state, w = e.wbWindow(), now = e.now();
        const adv = s.expeditions.filter(x => now >= x.start + x.hours * 3600000).length + (w.active && s.worldBoss.day !== KT.State.dayKey(now) && !e.zoneLock('world_boss').locked ? 1 : 0) + (s.worldBoss.day && !s.worldBoss.claimed && !(w.active && w.index === s.worldBoss.window && w.day === s.worldBoss.day) ? 1 : 0) + (s.bounty.active && s.bounty.active.progress >= s.bounty.active.n ? 1 : 0);
        badge(this.el.adventureBadge, adv); }
      badge(this.el.talentBadge, Math.max(0, this.engine.talentPoints()));
      this.renderCloud();
      const attrPts = this.engine.heroes.reduce((s, r) => s + Math.max(0, this.engine.freeAttr(r)), 0);
      const awakenReady = this.engine.heroes.some(r => r.stars < 6 && (this.state.shards[r.id] || 0) >= KT.State.awakenCost(r.stars, this.state.buildings.shrine).shards);
      this.el.partyBadge.hidden = !(attrPts || awakenReady || this.engine.heroes.length < 4); this.el.partyBadge.textContent = attrPts || '!';
    }

    renderZone() {
      const z = this.engine.zone, e = this.engine;
      this.el.zoneTitle.textContent = z.title; this.el.zoneKick.textContent = z.kicker;
      let diff = z.difficulty, wave = z.kind === 'village' ? '8 distritos ativos' : 'Cidade segura';
      if (z.kind === 'hunt') { diff = `Estágio ${e.opts.stage}/${z.stages}`; wave = e.phase === 'stageClear' ? 'Estágio vencido!' : e.wave === 4 ? 'Guardião' : `Onda ${e.wave}/4`; }
      if (z.kind === 'dungeon') { diff = `Andar ${['I','II','III'][e.opts.floor - 1]}`; wave = `Sala ${e.room}/5`; }
      if (z.kind === 'rift') { diff = `Andar ${e.opts.floor} · recorde ${this.state.progress.rift?.best || 0}`; wave = e.phase === 'stageClear' ? 'Andar vencido!' : `Sala ${e.room}/${D.RIFT.rooms}`; }
      if (z.kind === 'boss') { diff = D.bossTiers[e.opts.tier || 0].name; wave = `Fase ${(e.bossPhase || 0) + 1}/3`; }
      if (z.kind === 'arena') { diff = `vs ${e.arenaFoe?.name || 'rival'}`; wave = e.phase === 'fight' ? `⏱ ${Math.max(0, Math.ceil(D.PVP.time - (e.arenaTime || 0)))}s` : 'Arena'; }
      this.el.difficulty.textContent = diff; this.el.wave.textContent = wave;
      if (z.kind !== 'village' && z.kind !== 'arena') {
        const rec = e.recommendedPower(z.id, e.opts), pow = e.getPower(), ratio = pow / rec;
        this.el.powerCheck.hidden = false; this.el.powerCheck.className = ratio >= 1 ? 'ok' : ratio >= .8 ? 'warn' : 'bad';
        const dl = KT.difficultyLabel ? KT.difficultyLabel(ratio) : null;
        this.el.powerCheck.textContent = `⚔ ${compact(pow)} / ${compact(rec)}${dl ? ` · ${dl[0]}` : ''}`;
        this.el.powerCheck.dataset.tip = 'Seu Poder / Poder recomendado. Fácil ou Justo: pode seguir. Difícil: arrisque. Muito difícil: fique mais forte (⚡ FORÇA, Forja, Dojo, nível).';
        this.el.powerCheck.dataset.tip = `Poder da equipe / poder recomendado.${ratio < .8 ? ' Sua equipe está fraca para esta região, treine em estágios anteriores.' : ''}`;
      } else this.el.powerCheck.hidden = true;
      this.el.locations.hidden = z.kind !== 'village' || this.engine.heroes.length < 4;
      document.querySelector('#journey-cta').hidden = this.el.locations.hidden;
      this.renderVillage();
      this.el.cons.hidden = z.kind === 'village';
      const needTeam = this.engine.heroes.length < 4;
      const key = needTeam ? `team-${this.engine.heroes.length}-${this.state.starterRolls}` : z.kind === 'village' ? 'village' : '';
      if (key !== this.hintKey) {
        this.hintKey = key; this.el.hint.hidden = !needTeam;
        if (needTeam) this.el.hint.innerHTML = this.state.starterRolls > 0
          ? `<p>Você tem <b>${this.state.starterRolls} convocações grátis</b>. Descubra seus heróis!</p><button class="action pink" data-go="collection" type="button">Convocar agora</button>`
          : `<p>Equipe <b>${this.engine.heroes.length}/4</b>, escolha quem viaja com você.</p><button class="action primary" data-go="party" type="button">Montar equipe</button>`;
      }
      // Consumíveis.
      const c = this.state.consumables;
      this.el.potionCount.textContent = c.potion; this.el.elixirCount.textContent = c.elixir;
      this.el.potionBtn.disabled = !c.potion || e.potionCd > 0 || e.phase !== 'fight'; this.el.elixirBtn.disabled = !c.elixir || e.elixirCd > 0 || e.phase !== 'fight';
      this.el.potionBtn.style.setProperty('--cd', e.potionCd / 20); this.el.elixirBtn.style.setProperty('--cd', e.elixirCd / 30);
    }

    // Cidade: painel de boas-vindas e selos vivos nas placas dos distritos.
    renderVillage() {
      const hub = this.el.villageHub, show = !this.el.locations.hidden;
      hub.hidden = !show; if (!show) { this.villageKey = ''; return; }
      const s = this.state, e = this.engine, ev = e.event(), PRG = KT.Progression;
      const hour = new Date(e.now() + D.EVENT_TZ_OFFSET_MIN * 60000).getUTCHours();
      const greet = hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      const hz = D.zones[s.lastHunt] || D.zones.hunt, hp = s.progress[hz.id] || {}, stage = Math.max(1, Math.min(hz.stages || 1, hp.cur || hp.best || 1));
      const exp = s.expeditions.filter(x => e.now() >= x.start + x.hours * 3600000).length;
      const contracts = (s.contracts || []).filter(c => c.progress >= c.n).length, daily = (s.daily?.list || []).filter(x => x.progress >= x.n && !x.claimed).length;
      const shown = s.house?.display || [], freeSlots = e.houseSlots() - shown.filter(Boolean).length, freeCards = Object.entries(s.cards).some(([id, n]) => n > 0 && !shown.includes(id));
      const cap = PRG.trainingCap(s.buildings.dojo), dojo = Object.keys(PRG.training).filter(k => (s.training[k] || 0) < cap && s.player.gold >= PRG.trainingCost(s.training[k] || 0)).length;
      const shrine = s.collection.filter(r => { const c = KT.State.awakenCost(r.stars, s.buildings.shrine); return r.stars < 6 && (s.shards[r.id] || 0) >= c.shards && s.player.gold >= c.gold; }).length;
      const badges = { guild:contracts, dojo, collection:s.starterRolls + s.player.keys, shrine, house:freeCards ? Math.max(0, freeSlots) : 0, expeditions:exp };
      document.querySelectorAll('#village-actions [data-badge]').forEach(b => { const n = badges[b.dataset.badge] || 0, em = b.querySelector('.sp-badge'); if (em) { em.hidden = !n; em.textContent = n > 9 ? '9+' : n; } b.classList.toggle('ready', !!n); });
      const pending = exp + contracts + daily + (s.worldBoss.day && !s.worldBoss.claimed ? 1 : 0);
      const key = [greet, hz.id, stage, pending, ev.id, s.player.name].join('|'); if (key === this.villageKey) return; this.villageKey = key;
      const now = ev.id !== 'calm' ? `Agora: <b style="color:${ev.color}">${ev.icon} ${esc(ev.name)}</b>.` : 'O céu está calmo a esta hora.';
      hub.innerHTML = `<span class="eyebrow">${greet}, ${esc(s.player.name || 'Viajante')}</span>
        <h3>Bem-vindo(a) a Tsukimori</h3><p>Sua equipe descansa na Praça da Lua. ${now}</p>
        <div class="hub-actions"><button class="action primary" data-enter="${hz.id}" data-opts='${JSON.stringify({ stage })}' type="button">⚔ Continuar: ${esc(hz.title)} · ${stage}</button>
        <button class="action ${pending ? 'pink' : ''}" data-go="adventure" type="button">${pending ? `🎁 ${pending} para resgatar` : '🗺 O que fazer agora'}</button></div>`;
    }

    renderParty() {
      const e = this.engine, village = !e.active;
      const units = village ? this.state.formation.map((uid, slot) => { const r = uid && e.record(uid); return r ? { rec:r, slot } : null; }) : [0, 1, 2, 3].map(i => e.party.find(u => u.slot === i) || null);
      const key = (village ? 'v' : 'b') + units.map(u => u ? (u.uid || u.rec.uid) : '-').join('|');
      if (key !== this.dockKey) {
        this.dockKey = key;
        this.el.party.innerHTML = units.map((u, i) => {
          if (!u) return `<button class="hero-slot empty" data-slot-open type="button"><div><b>Vaga ${i + 1}</b><small>${i < 2 ? 'Linha de frente' : 'Retaguarda'}</small></div></button>`;
          const rec = u.rec || e.record(u.recUid), t = e.template(rec.id);
          const idx = village ? i : e.party.indexOf(u);
          return `<article class="hero-slot rarity-${rec.rarity}" data-uid="${rec.uid}" style="--hc:${t.color};--rc:var(--${rec.rarity})">
            <button class="hero-portrait" data-hero-detail="${rec.uid}" type="button" data-tip="Ver ficha de ${esc(t.name)}"><img src="${portrait(t.id)}" alt=""><span class="lv">Nv.${rec.level}</span><span class="cls">${D.classes[t.cls].icon}</span></button>
            <div class="hero-info"><header><b>${esc(t.name)}</b><small>${D.elements[t.el].icon} <span class="row-txt">${i < 2 ? 'Frente' : 'Trás'}</span></small></header>
              <div class="bar hp"><span class="fill"></span><span class="shield"></span><em></em></div>
              <div class="skill-line"><span class="skill-cd" data-tip="<b>${esc(t.skill.name)}</b> (automática)<br>${esc(t.skillText)}"><i></i>${esc(t.skill.name)}</span></div></div>
            <button class="ult-btn" data-ult="${idx}" type="button" data-tip="<b>ULTIMATE · ${esc(t.ult.name)}</b><br>${esc(t.ultText)}<br><small>Tecla ${KEYS[idx]} quando a energia estiver cheia.</small>"><span class="ult-ic" style="${glyphStyle(t)}">${ic(skillGlyph(t))}<kbd>${KEYS[idx]}</kbd></span><span><b>${esc(t.ult.name)}</b><small>ULTIMATE</small></span><i class="nrg"></i></button>
          </article>`;
        }).join('');
      }
      units.forEach((u, i) => {
        const card = this.el.party.children[i]; if (!u || !card?.dataset.uid) return;
        const hpBar = card.querySelector('.bar.hp'), ult = card.querySelector('.ult-btn'), cdEl = card.querySelector('.skill-cd');
        if (village) {
          const r = u.rec; const st = KT.State.heroStats(this.state, r);
          hpBar.querySelector('.fill').style.width = '100%'; hpBar.querySelector('em').textContent = U.fmt(st.maxHp);
          ult.disabled = true; ult.style.setProperty('--nrg', 0); ult.classList.remove('ready'); cdEl.style.setProperty('--cd', 0);
          card.querySelector('.lv').textContent = `Nv.${r.level}`;
          return;
        }
        const hp = U.clamp(u.hp / u.maxHp, 0, 1), sh = U.clamp(u.shield / u.maxHp, 0, 1 - hp);
        hpBar.querySelector('.fill').style.width = `${hp * 100}%`;
        const shEl = hpBar.querySelector('.shield'); shEl.style.left = `${hp * 100}%`; shEl.style.width = `${sh * 100}%`;
        hpBar.querySelector('em').textContent = U.fmt(Math.max(0, u.hp)); hpBar.classList.toggle('low', hp < .3);
        const ready = u.alive && u.energy >= 100 && e.phase === 'fight';
        ult.disabled = !ready; ult.classList.toggle('ready', ready); ult.style.setProperty('--nrg', U.clamp(u.energy / 100, 0, 1));
        ult.querySelector('small').textContent = !u.alive ? 'NOCAUTEADO' : ready ? 'PRONTA!' : `ENERGIA ${Math.floor(u.energy)}%`;
        cdEl.style.setProperty('--cd', U.clamp(u.skillCd / u.template.skill.cd, 0, 1));
        card.querySelector('.lv').textContent = `Nv.${u.level}`;
        card.classList.toggle('dead', !u.alive);
        const prev = this.lastHp.get(u.uid); if (prev !== undefined && u.hp < prev - u.maxHp * .05) { card.classList.remove('hurt'); void card.offsetWidth; card.classList.add('hurt'); }
        this.lastHp.set(u.uid, u.hp);
      });
    }

    renderBoss() {
      const boss = this.engine.enemies.find(e => (e.boss || e.miniboss) && e.alive);
      this.el.bossPanel.hidden = !boss; if (!boss) return;
      const pct = U.clamp(boss.hp / boss.maxHp * 100, 0, 100);
      this.el.bossKind.textContent = boss.boss ? (this.engine.zone.event ? 'CHEFE DE EVENTO' : 'CHEFE DA REGIÃO') : 'CHEFE DO ANDAR';
      this.el.bossName.textContent = `${boss.name} · Nv.${boss.level}`; this.el.bossFill.style.width = `${pct}%`; this.el.bossChip.style.width = `${pct}%`;
      this.el.bossShield.style.width = `${U.clamp(boss.shield / boss.maxHp * 100, 0, 100)}%`; this.el.bossPercent.textContent = `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
      const phases = boss.t.phases || [];
      this.el.bossMark1.hidden = !phases[1]; this.el.bossMark2.hidden = !phases[2];
      if (phases[1]) this.el.bossMark1.style.left = `${phases[1].at * 100}%`; if (phases[2]) this.el.bossMark2.style.left = `${phases[2].at * 100}%`;
      this.el.bossPhase.textContent = boss.windup > 0 ? `⚠ Preparando ${boss.windupSpecial?.name || 'ataque'}!` : boss.boss ? `Fase ${(boss.phaseIdx || 0) + 1}/3 · ${phases[boss.phaseIdx || 0]?.text || ''}` : boss.t.desc;
      this.el.bossPanel.classList.toggle('danger', boss.windup > 0);
      const broken = boss.broken > 0, bp = broken ? boss.broken / KT.State.BREAK.time : U.clamp(boss.breakG / boss.breakMax, 0, 1);
      this.el.bossBreakFill.style.width = `${bp * 100}%`; this.el.bossBreak.classList.toggle('broken', broken); this.el.bossBreakLabel.textContent = broken ? 'POSTURA QUEBRADA · +35% DE DANO' : 'POSTURA';
      if (boss.boss) { const left = (boss.t.enrage || 150) - (this.engine.bossTimer || 0); this.el.bossTimer.textContent = left > 0 ? `Fúria em ${fmtTime(left)}` : '🔥 FÚRIA!'; this.el.bossTimer.classList.toggle('enraged', left <= 0); } else this.el.bossTimer.textContent = '';
    }

    renderControls() {
      const s = this.state.settings, z = this.engine.zone;
      this.el.auto.classList.toggle('active', s.auto); this.el.auto.querySelector('b').textContent = s.auto ? 'ON' : 'OFF';
      this.el.advance.classList.toggle('active', s.autoAdvance); this.el.advance.querySelector('b').textContent = s.autoAdvance ? 'ON' : 'OFF';
      this.el.speed.querySelector('b').textContent = `x${s.speed}`; this.el.speed.classList.toggle('active', s.speed > 1);
      const village = z.kind === 'village';
      this.el.auto.hidden = this.el.speed.hidden = this.el.retreat.hidden = village; this.el.advance.hidden = z.kind !== 'hunt' && z.kind !== 'rift';
      this.renderChoiceTimer(); this.renderAfk?.();
    }

    // ======================= PAINEL LATERAL =======================
    renderSide() { this.renderGuide(); this.renderEvent(); this.renderContracts(); }
    renderGuide() {
      const e = this.engine, g = e.guideStep(), ch = !g && e.ensureChronicle(), ls = e.loginStatus();
      let main;
      if (g) main = `<span class="eyebrow">PRÓXIMO PASSO · ${D.guide.indexOf(g) + 1}/${D.guide.length}</span><strong>${esc(g.title)}</strong><small>${esc(g.desc)}</small><div class="guide-reward">${this.rewardPills(g.reward)}</div>${e.guideDone(g) ? `<button class="action primary small" data-claim-guide type="button">✓ Resgatar recompensa</button>` : g.go ? `<button class="action small" data-go="${g.go}" type="button">Ir →</button>` : ''}`;
      else if (ch) { const v = e.chronicleValue(ch), done = v >= ch.target; main = `<span class="eyebrow">CRÔNICA ${ch.k} · SEM FIM</span><strong>${esc(ch.title)}</strong><small>${esc(ch.text)}</small><div class="meter"><span style="width:${Math.min(1, (v - ch.start) / Math.max(1, ch.target - ch.start)) * 100}%"></span></div><small class="dim">${U.fmt(v)} / ${U.fmt(ch.target)}</small>${done ? '<button class="action primary small" data-claim-chronicle type="button">✓ Resgatar</button>' : ''}`; }
      else main = `<span class="eyebrow">GUIA DO VIAJANTE</span><strong>Jornada concluída!</strong>`;
      const extra = `<div class="guide-extra">${ls.available ? `<button class="action pink small" data-claim-login type="button">🎁 Login do dia ${ls.day}</button>` : ''}<button class="action small ghost" data-go="quests:advisor" type="button" data-tip="Um plano do que fazer para ficar mais forte.">🧭 Travado? Conselheiro</button></div>`;
      const html = main + extra, done = (g && e.guideDone(g)) || (ch && e.chronicleValue(ch) >= ch.target);
      if (html !== this.guideHtml) { this.guideHtml = html; this.el.guide.innerHTML = html; this.el.guide.classList.toggle('done', !!done); }
    }
    renderEvent() {
      const ev = this.engine.event(), now = KT.Clock.now(), left = (ev.ends - now) / 1000;
      const hm = ms => new Date(ms).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo', weekday:'short', hour:'2-digit', minute:'2-digit' });
      const nexts = KT.State.upcomingEvents(now, 3).filter(x => x.start > now).slice(0, 3);
      const html = `<span class="eyebrow" style="color:${ev.color}">${ev.id === 'calm' ? `SEM EVENTO · próximo em ${fmtTime(left)}` : `EVENTO MUNDIAL · termina em ${fmtTime(left)}`}</span><strong>${ev.icon} ${ev.name}</strong><small>${ev.text}</small><ul class="ev-next">${nexts.map(x => `<li><span style="color:${x.color}">${x.icon} ${x.name}</span><em>${hm(x.start)}</em></li>`).join('')}</ul><small class="dim">Horário de Brasília · <button class="link-btn" data-go="wiki:events" type="button">ver calendário</button></small>${ev.id === 'festival' ? `<button class="action pink small" data-go="destination:boss_event" type="button">Enfrentar a Kitsune</button>` : ''}`;
      if (html !== this.eventHtml) { this.eventHtml = html; this.el.event.innerHTML = html; this.el.event.style.setProperty('--ec', ev.color); }
    }
    rewardPills(r) {
      const names = { gold:['ouro','gold'], crystal:['cristais','crystal'], dust:['Éter','dust'], ore:['Tamahagane','ore'], keys:['chave(s)','key'], key:['chave(s)','key'], potion:['poção(ões)','potion'], elixir:['elixir(es)','potion'], item:['item','item'] };
      return Object.entries(r || {}).map(([k, v]) => { const [n, c] = names[k] || [k, '']; return `<span class="rw rw-${c}">${k === 'item' ? `Item ${D.rarities.find(x => x.id === v)?.label || v}` : `${U.fmt(v)} ${n}`}</span>`; }).join('');
    }
    renderContracts() {
      const key = JSON.stringify(this.state.contracts);
      if (key === this.contractKey) return; this.contractKey = key;
      this.el.rightObjectives.innerHTML = `<p class="pane-note">Contratos da Guilda: conclua para ganhar recompensas. Um novo chega a cada resgate.</p>` + this.state.contracts.map((c, i) => {
        const def = D.contracts.find(d => d.id === c.id), done = c.progress >= c.n;
        return `<article class="objective ${done ? 'done' : ''}"><header><b>${def.title}</b><span>${c.progress}/${c.n}</span></header><p>${def.text.replace('{n}', c.n)}</p><div class="meter"><span style="width:${c.progress / c.n * 100}%"></span></div><div class="guide-reward">${this.rewardPills(this.engine.contractReward(c))}</div>${done ? `<button class="action primary small" data-claim-contract="${i}" type="button">Resgatar</button>` : ''}</article>`;
      }).join('');
    }
    renderLoot() {
      const items = this.lootHistory.slice(0, 18);
      this.el.rightLoot.innerHTML = items.length ? items.map(it => `<article class="loot-row rarity-${it.rarity}">${KT.itemIcon(it)}<div><b class="rtext">${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</b><small>${KT.Items.slots[it.slot].name} · Nv.${it.ilvl}${it.autoSalvaged ? ' · desmontado' : ''}</small></div></article>`).join('') : '<div class="empty-note">Nenhum item ainda. Inimigos, guardiões e chefes deixam equipamentos.</div>';
    }
    renderCombat(force) {
      if (this.el.rightCombat.hidden && !force) return;
      const tag = { boss:'CHEFE', reward:'LOOT', skill:'HAB.', enemy:'ALERTA', system:'INFO' };
      this.el.rightCombat.innerHTML = this.logs.slice(0, 40).map(l => `<div class="log-row t-${l.type}"><strong>${tag[l.type] || 'INFO'}</strong>${esc(l.text)}</div>`).join('');
    }

    // ======================= EVENTOS DO MOTOR =======================
    onZone(zone) {
      this.logs = []; this.onLog({ text:`Você chegou a ${zone.title}.`, type:'system' });
      this.el.result.hidden = true; this.el.choice.hidden = true; this.el.warn.hidden = true; this.dockKey = '';
      if (zone.kind !== 'village') this.renderer.showBanner(zone.title, zone.kicker, '#ff9ec7');
      this.renderAll();
    }
    onWave(info) {
      if (info?.detail) this.onLog({ text:`${info.label} · ${info.detail}`, type:info.boss ? 'boss' : 'system' });
      const z = this.engine.zone;
      if (info.special) this.renderer.showBanner(info.label, info.detail.slice(0, 60), '#ffd76a');
      else if (info.guardian) this.renderer.showBanner('GUARDIÃO!', info.detail, '#c77dff');
      else if (z.kind === 'dungeon') this.renderer.showBanner(`SALA ${this.engine.room}/5`, info.detail, '#c9b8ff');
      else if (z.kind === 'hunt' && this.engine.wave === 1) this.renderer.showBanner(`ESTÁGIO ${this.engine.opts.stage}`, z.title, '#ff9ec7');
      this.renderZone();
    }
    onPhase(p) { this.renderer.showBanner(`FASE ${p.idx + 1}`, p.text, '#ff6b7a'); this.callbacks.warn?.(); }
    onStageClear(r) {
      const z = r.zone;
      if (r.rift) { this.renderer.showBanner(r.first ? `NOVO RECORDE: ANDAR ${r.stage}!` : `ANDAR ${r.stage} VENCIDO`, r.first && r.rewards.crystal ? `+${r.rewards.crystal} cristais${r.rewards.keys ? ' · 1 chave' : ''}` : z.title, '#ff5d8f'); this.callbacks.victory?.(); return; }
      this.renderer.showBanner(r.first ? 'ESTÁGIO CONQUISTADO!' : 'ESTÁGIO VENCIDO', r.first ? `Recompensa de primeira vitória: ${[r.rewards.crystal && `${r.rewards.crystal} cristais`, r.rewards.keys && `${r.rewards.keys} chave`].filter(Boolean).join(' · ')}` : `${z.title} · ${r.stage}`, '#ffd76a');
      if (r.first && r.stage === z.stages) this.toast(`<b>${z.title} concluído!</b> O chefe da região pode ser desafiado no Mapa.`, 'gold');
      this.callbacks.victory?.();
    }
    onDefeatHunt(r) { this.renderer.showBanner('DERROTA', `Recuando para o ${r.rift ? 'andar' : 'estágio'} ${r.back} para treinar`, '#ff6b7a'); this.toast(`A equipe caiu no estágio ${r.stage}. <b>Avanço automático desligado</b>, fortaleça a equipe (atributos, itens, treino) e tente de novo.`); this.renderControls(); }
    onLoot(item) {
      this.lootHistory.unshift(item); this.lootHistory = this.lootHistory.slice(0, 30);
      if (!item.autoSalvaged) this.newItems++;
      this.renderer.emit({ type:'loot', item });
      if (item.rarity !== 'common' || !this.engine.active) {
        const pop = document.createElement('div'); pop.className = `loot-pop rarity-${item.rarity}`;
        pop.innerHTML = `${KT.itemIcon(item)}<span><b>${esc(item.name)}</b> <small>${D.rarities.find(r => r.id === item.rarity).label}</small></span>`;
        this.el.lootToast.appendChild(pop); while (this.el.lootToast.children.length > 5) this.el.lootToast.firstChild.remove();
        setTimeout(() => pop.remove(), 3300);
      }
      if (['legendary', 'mythic', 'set'].includes(item.rarity) && !item.autoSalvaged) this.toast(`🌟 <b>${esc(item.name)}</b> (${D.rarities.find(r => r.id === item.rarity).label}) está em <b>Bolsa → ${item.inOverflow ? 'Excedentes' : 'Itens'}</b>.`, 'gold');
      if (!this.el.rightLoot.hidden) this.renderLoot();
    }
    onLog(p) { const e = typeof p === 'string' ? { text:p, type:'system' } : p; this.logs.unshift(e); this.logs = this.logs.slice(0, 80); if (!this.logTimer) this.logTimer = setTimeout(() => { this.logTimer = null; this.renderCombat(); }, 300); }
    onWarn(text) { this.el.warn.textContent = `⚠ ${text}`; this.el.warn.hidden = false; this.el.warn.style.animation = 'none'; void this.el.warn.offsetWidth; this.el.warn.style.animation = ''; clearTimeout(this.warnTimer); this.warnTimer = setTimeout(() => this.el.warn.hidden = true, 2200); this.callbacks.warn?.(); }
    onAccountLevel() { this.renderResources(); }
    onCard(c) {
      const card = c.card;
      if (c.mvp) this.renderer.showBanner('CARTA MVP!', card.name, '#ffb938');
      const pop = document.createElement('div'); pop.className = `loot-pop card-pop ${c.mvp ? 'mvp' : ''}`;
      pop.innerHTML = `<span class="card-mini"><img src="${KT.spriteUrl(card.sprite)}" alt=""></span><span><b>${esc(card.name)}</b> <small>${c.mvp ? 'CARTA MVP' : 'Carta'}</small></span>`;
      this.el.lootToast.appendChild(pop); setTimeout(() => pop.remove(), 4200);
      this.toast(`${c.mvp ? '🌟 <b>CARTA MVP!</b>' : '🃏 Nova carta:'} <b>${esc(card.name)}</b>, encaixe na Oficina → Cartas.`, 'gold');
    }
    renderCloud() {
      const dot = document.querySelector('#cloud-dot'), badge = this.el.saveStatus; if (!dot) return;
      const mode = this.session?.mode || 'offline', c = KT.Server || {};
      let cls = 'off', label = 'Local', tip = 'Modo offline: salvo só neste navegador.';
      if (mode === 'cloud') {
        if (c.status === 'error') { cls = 'err'; label = 'Erro'; tip = `Sem conexão com o servidor: ${c.error || ''}`; }
        else if (c.status === 'saving') { cls = 'sync'; label = 'Salvando'; tip = 'Sincronizando com o servidor…'; }
        else { cls = 'ok'; label = 'Salvo'; tip = c.lastSync ? `Progresso conferido pelo servidor às ${new Date(c.lastSync).toLocaleTimeString('pt-BR')}` : 'Conectado ao servidor.'; }
      } else if (mode === 'neon') {
        const n = KT.Neon || {};
        if (n.status === 'error') { cls = 'err'; label = 'Erro'; tip = `Save local protegido. Nuvem indisponível: ${n.error || ''}`; }
        else if (n.status === 'saving' || n.status === 'pending') { cls = 'sync'; label = 'Salvando'; tip = 'Salvando progresso no Neon…'; }
        else { cls = 'ok'; label = 'Salvo'; tip = n.lastSync ? `Salvo na nuvem às ${new Date(n.lastSync).toLocaleTimeString('pt-BR')}` : 'Conectado ao Neon.'; }
      }
      dot.className = `cloud-dot ${cls}`; dot.dataset.tip = tip;
      if (badge) { badge.className = `save-status ${cls}`; badge.dataset.tip = tip; badge.querySelector('b').textContent = label; }
    }
    onChoice(c) {
      this.el.choice.innerHTML = `<section><span class="eyebrow">${c.kind === 'route' ? 'DECISÃO DE ROTA' : 'ENCONTRO ESPECIAL'}</span><h2>${esc(c.title)}</h2><p>${esc(c.text || 'Escolha como a equipe continuará. A decisão altera risco e recompensa desta expedição.')}</p><div class="choice-options ${c.options.length > 2 ? 'many' : ''}">${c.options.map(o => `<button class="choice-option ${o.item ? `rarity-${o.item.rarity}` : ''} ${o.id === c.recommended ? 'recommended' : ''}" data-choice="${o.id}" data-kind="${c.kind}" type="button" ${o.price && this.state.player.gold < o.price ? 'disabled' : ''}>${o.id === c.recommended ? '<span class="rec-badge">★ RECOMENDADO</span>' : ''}${o.item ? KT.itemIcon(o.item) : ''}<b>${o.id === 'risk' ? '🔥 ' : o.id === 'safe' ? '🌙 ' : ''}${esc(o.label)}</b><small>${esc(o.desc)}</small>${o.item ? `<small class="aff">${this.itemLines(o.item).join(' · ')}</small>` : ''}</button>`).join('')}</div><p class="choice-timer" id="choice-timer"></p></section>`;
      this.el.choice.hidden = false; this.renderChoiceTimer();
    }
    renderChoiceTimer() {
      const pc = this.engine.pendingChoice, el = this.el.choice.querySelector('#choice-timer'); if (!el || !pc) return;
      const left = Math.max(0, KT.State.CHOICE_WAIT - pc.wait), rec = pc.options.find(o => o.id === pc.recommended);
      el.innerHTML = `Sem resposta em <b>${fmtTime(left)}</b>, a equipe segue com “${esc(rec?.label || '')}”. Ligue o AUTO para decidir sempre sozinho.`;
    }
    onChoiceResolved() { this.el.choice.hidden = true; }
    onStuck(p) {
      if (!this.el.modal.hidden) { this.toast('🧭 A equipe está travada, veja o <b>Conselheiro</b> (Missões → Conselheiro).'); return; }
      this.openPanel('quests', 'advisor');
      this.toast('A equipe caiu duas vezes no mesmo desafio. <b>Sayo preparou um plano.</b>', 'gold');
    }
    onDialog(lines) { this.dialogQueue.push(...lines); if (this.el.dialog.hidden) this.advanceDialog(); }
    advanceDialog() {
      const line = this.dialogQueue.shift();
      if (!line) { this.el.dialog.hidden = true; this.engine.paused = false; return; }
      const sp = D.speakers[line.who] || { color:'#fff', title:'' };
      this.engine.paused = true;
      this.el.dialog.innerHTML = `<div class="dlg-portrait" style="--sc:${sp.color}">${sp.sprite ? `<img src="${KT.spriteUrl(sp.sprite)}" alt="">` : '<span>🌸</span>'}</div><div class="dlg-body"><span class="dlg-name" style="color:${sp.color}">${esc(line.who)} <small>${esc(sp.title)}</small></span><p>${esc(line.text)}</p><small class="dlg-next">${this.dialogQueue.length ? 'Clique para continuar ▸' : 'Clique para fechar ✕'}</small></div>`;
      this.el.dialog.hidden = false;
      const p = this.el.dialog.querySelector('p'); p.classList.remove('typing'); void p.offsetWidth; p.classList.add('typing');
    }
    onResult(r) {
      const lootHtml = (r.loot || []).filter(it => !it.autoSalvaged).slice(0, 8).map(it => `<div class="result-item rarity-${it.rarity}">${KT.itemIcon(it)}<b>${esc(it.name)}</b><small>${D.rarities.find(x => x.id === it.rarity).label}</small></div>`).join('');
      const rw = r.rewards ? this.rewardPills({ gold:r.rewards.gold, crystal:r.rewards.crystal, keys:r.rewards.keys }) : '';
      if (r.kind === 'worldboss') {
        this.el.result.innerHTML = `<div class="result-card win"><span class="eyebrow">INVASÃO MUNDIAL · ${esc(KT.Data.worldBoss.tiers[r.tier || 0].name)}</span><h2>${esc(r.boss)}</h2><p>Sua equipe causou <b>${U.fmt(r.damage)}</b> de dano. Ele entrou para a barra de vida compartilhada com todos os viajantes desta janela.</p><p class="dim">A recompensa pode ser resgatada em Aventuras → Invasão Mundial quando a janela terminar (ou quando a comunidade derrubar o chefe).</p><div class="result-actions"><button class="action primary" data-result="hunt" type="button">Voltar a caçar</button><button class="action" data-go="adventure:worldboss" type="button">Ver Invasão</button></div></div>`;
        this.el.result.hidden = false; this.callbacks.victory?.(); return;
      }
      if (r.kind === 'arena') {
        this.el.result.innerHTML = `<div class="result-card ${r.won ? 'win' : 'lose'}"><span class="eyebrow">COLISEU CARMESIM · ${esc(r.foe || '')}</span><h2>${r.won ? 'VITÓRIA!' : 'DERROTA'}</h2><p>${esc(r.reason || (r.won ? 'A equipe rival caiu diante de você.' : 'Sua equipe foi derrotada.'))}</p><p class="arena-result-line">Registrando o resultado…</p><div class="result-actions"><button class="action primary" data-go="arena" type="button">Voltar à Arena</button></div></div>`;
        this.el.result.hidden = false; if (r.won) this.callbacks.victory?.(); return;
      }
      if (r.kind === 'defeat') {
        const tips = this.defeatTips();
        this.el.result.innerHTML = `<div class="result-card lose"><span class="eyebrow">EXPEDIÇÃO FRACASSOU</span><h2>DERROTA</h2><p>A equipe foi nocauteada em ${esc(r.zone.title)}${r.room ? ` (sala ${r.room})` : ''}. Voltando a treinar na caçada em instantes.</p><ul class="result-tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul><div class="result-actions"><button class="action" data-result="retry" type="button">↻ Tentar de novo</button><button class="action primary" data-result="hunt" type="button">Treinar na caçada</button><button class="action" data-result="city" type="button">Cidade</button></div><small class="auto-note">Voltando à caçada automaticamente…</small></div>`;
      } else {
        const title = r.kind === 'boss' ? (r.first ? 'CHEFE DERROTADO!' : 'VITÓRIA!') : 'ANDAR CONQUISTADO!';
        this.el.result.innerHTML = `<div class="result-card win"><span class="eyebrow">${esc(r.zone.title)}${r.kind === 'boss' ? ` · ${D.bossTiers[r.tier || 0].name}` : ` · Andar ${['I','II','III'][r.floor - 1]}`}</span><h2>${title}</h2><p>${r.kind === 'boss' ? `${esc(r.boss)} caiu diante da sua equipe.` : 'As cinco câmaras foram vencidas.'}${r.first ? ' <b>Primeira vitória!</b>' : ''}${r.kind === 'boss' ? (r.lootLocked ? ' <b class="txt-pink">Espólio de hoje esgotado: só ouro e EXP até a meia-noite.</b>' : ` Espólio restante hoje: <b>${r.lootLeft}/${KT.State.BOSS_LOOT_PER_DAY}</b>.`) : ''}</p><div class="reward-line center">${rw}</div><div class="result-items">${lootHtml || '<small class="dim">Sem itens novos desta vez.</small>'}</div><div class="result-actions"><button class="action primary" data-result="retry" type="button">↻ Repetir</button><button class="action" data-result="hunt" type="button">Caçada</button><button class="action" data-result="map" type="button">Mapa</button></div><label class="auto-repeat"><input type="checkbox" id="auto-repeat" ${this.state.settings.autoRepeat ? 'checked' : ''}> Repetir automaticamente</label></div>`;
        this.el.result.querySelector('#auto-repeat')?.addEventListener('change', e => { this.state.settings.autoRepeat = e.target.checked; this.cmd('setSetting', 'autoRepeat', e.target.checked); if (!e.target.checked) this.engine.autoAfterResult = null; else this.engine.autoAfterResult = () => this.engine.repeatRun(); });
        this.callbacks.victory?.();
      }
      this.el.result.hidden = false;
    }
    onResultClose() { this.el.result.hidden = true; }
    // Depois de receber o estado oficial do servidor: redesenha tudo.
    afterServerState() { this.dockKey = ''; this.guideHtml = ''; this.contractKey = ''; this.renderAll(); if (!this.el.modal.hidden) this.refreshPanel(); }
    showOffline(o) {
      if (!o || !o.seconds) return;
      const h = o.seconds >= 3600 ? `${(o.seconds / 3600).toFixed(1).replace('.0', '').replace('.', ',')}h` : `${Math.round(o.seconds / 60)} min`;
      this.toast(`<b>Treino AFK:</b> em ${h} longe, sua equipe caçou e trouxe +${U.fmt(o.gold)} ouro, +${U.fmt(o.xp)} EXP, ${o.items.length} item(ns), +${o.ore} Tamahagane e +${o.dust} Éter.`, 'gold');
      (o.items || []).forEach(it => this.lootHistory.unshift({ ...it, slot:it.slot || 'weapon', ilvl:it.ilvl || 0, icon:it.icon || 'katana_01' }));
      this.newItems += (o.items || []).length;
    }
    defeatTips() {
      const tips = [], e = this.engine, ctx = e.ctx();
      if (!ctx.clsCount.Suporte) tips.push('Sua equipe não tem <b>Suporte</b>: sem cura, chefes vencem pelo cansaço.');
      if (!ctx.clsCount.Vanguarda) tips.push('Sem <b>Vanguarda</b> na frente, o dano cai nos heróis frágeis.');
      if (this.engine.heroes.some(r => e.freeAttr(r) > 0)) tips.push('Há <b>pontos de atributo</b> não distribuídos (Equipe → ficha do herói).');
      if (e.talentPoints() > 0) tips.push(`Você tem <b>${e.talentPoints()} ponto(s) de talento</b> livres.`);
      tips.push('Aprimore equipamentos na <b>Forja</b> e treine a equipe no <b>Dojo</b>.');
      tips.push('Desligue o AUTO e guarde ultimates de escudo/cura para quando o inimigo mostrar ⚠.');
      return tips.slice(0, 4);
    }
    toast(text, tone = '') { const t = document.createElement('div'); t.className = `toast ${tone}`; t.innerHTML = text; this.el.toastStack.appendChild(t); while (this.el.toastStack.children.length > 4) this.el.toastStack.firstChild.remove(); setTimeout(() => t.remove(), 4200); }

    // ======================= REVELAÇÃO DE CONVOCAÇÃO =======================
    showReveal(results) {
      if (!results.length) return;
      const order = { legendary:0, epic:1, rare:2, common:3 }, single = results.length === 1;
      const best = results.reduce((a, h) => order[h.rarityRolled] < order[a.rarityRolled] ? h : a, results[0]);
      const label = r => D.heroRarities.find(x => x.id === r)?.label || r;
      this.el.reveal.innerHTML = `<div><h2>${single ? label(results[0].rarityRolled).toUpperCase() + '!' : 'A FENDA SE ABRIU'}</h2><p>${single ? esc(this.engine.template(results[0].id).world) : `Melhor resultado: <b class="rarity-${best.rarityRolled} rtext">${esc(this.engine.template(best.id).name)} · ${label(best.rarityRolled)}</b>`}</p><div class="reveal-grid">${results.map((h, i) => { const t = this.engine.template(h.id); return `<div class="reveal-card ${single ? 'single' : ''}"><div class="reveal-inner" style="--d:${(i * .12).toFixed(2)}s"><div class="reveal-face rarity-${h.rarityRolled}"><span class="rays"></span><img src="${KT.spriteUrl(t.sprite)}" alt=""><footer><b>${esc(t.name)}</b><small>${label(h.rarityRolled)} · ${D.classes[t.cls].icon} ${t.cls}</small>${h.dupe ? `<em>Repetido · +${h.shardsGained} fragmentos</em>` : '<em class="new">NOVO!</em>'}</footer></div><div class="reveal-back"><img src="assets/brand/emblem.png?v=2" alt=""></div></div></div>`; }).join('')}</div><p class="reveal-hint">Toque em qualquer lugar para continuar</p></div>`;
      this.el.reveal.hidden = false;
      this.callbacks.summon?.(best.rarityRolled);
    }
    closeReveal() {
      if (this.el.reveal.hidden) return; this.el.reveal.hidden = true;
      if (this.engine.heroes.length < 4 && !this.state.story.seen.formation) { this.cmd('markSeen', 'formation'); this.openPanel('party'); this.toast('Agora escolha <b>4 heróis</b> para a equipe. As vagas 1 e 2 ficam na linha de frente.', 'gold'); }
      else this.openPanel('collection');
    }
  }

  // Ícones vetoriais autorais (assets/ui/ic-*.svg, usados como máscara: a cor vem do CSS).
  const ic = (name, cls = '') => `<i class="ic ic-${name}${cls ? ` ${cls}` : ''}" aria-hidden="true"></i>`;
  const EL_GLYPH = { Fogo:'flame', Gelo:'frost', Raio:'bolt', Vento:'vortex', Água:'wave', Natureza:'leaf', Terra:'rock', Luz:'burst', Sombra:'moon' };
  // Glifo do golpe: cura/escudo/execução pelo efeito; senão, pelo estilo da classe ou pelo elemento.
  function skillGlyph(t, part = 'ult') {
    const eff = t[part]?.eff || [], kinds = eff.map(e => e.k), hasDmg = kinds.includes('dmg');
    if (kinds.includes('revive') || (kinds.includes('heal') && (!hasDmg || kinds[0] === 'heal'))) return 'heal';
    if (kinds.includes('shield') && (!hasDmg || kinds[0] === 'shield')) return 'shield';
    if (kinds.includes('execute')) return 'skull';
    if (t[part]?.fx === 'beam') return 'beam';
    if (t.cls === 'Executor') return 'slash';
    if (t.cls === 'Atirador') return 'arrows';
    if (t.cls === 'Vanguarda' && !['Fogo','Gelo','Raio'].includes(t.el)) return 'fist';
    return EL_GLYPH[t.el] || 'burst';
  }
  const shade = (hex, f) => { const n = parseInt(String(hex).slice(1), 16), c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return `rgb(${c(16)},${c(8)},${c(0)})`; };
  const glyphStyle = t => { const col = D.elements[t.el]?.color || '#ffcf6b'; return `--e1:${col};--e2:${shade(col, .55)}`; };
  UIController.helpers = { esc, portrait, fmtTime, compact, KEYS, ic, skillGlyph, glyphStyle };
  KT.UIController = UIController;
})();
