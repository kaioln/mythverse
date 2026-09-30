// Social (modo Neon): Arena PvP, Loja de Honra, Guildas e Guerra de Guildas.
// O banco (tools/neon_social.sql) guarda honra, MMR, limites e compras; aqui só chamamos as funções
// e comandamos a luta no motor (semente sorteada pelo banco, comandos gravados para auditoria).
(() => {
  const KT = globalThis.KT;

  const Social = {
    engine:null, ui:null, status:null, foes:null, guild:null, board:null, targets:null, history:null, ranking:null, guildList:null, err:null, busy:false, match:null, poll:null,
    get enabled() { return !!KT.Neon?.enabled && !!KT.Neon.user; },
    async rpc(fn, args = {}) {
      const r = await KT.Neon.api('POST', `/rpc/${fn}`, args);
      if (!r.ok) throw new Error(r.error || 'Falha de conexão.');
      return r.data;
    },
    attach(engine, ui) {
      this.engine = engine; this.ui = ui;
      engine.events.onArena = rec => this.finish(rec);
      this.refreshGuild().catch(() => {});
    },
    changed() { this.ui?.renderResources?.(); if (this.ui && ['arena', 'guild'].includes(this.ui.view.panel)) this.ui.refreshPanel(); },
    fail(e) { this.err = e.message || String(e); this.ui?.toast(KT.UIController.helpers.esc(this.err)); this.changed(); return null; },

    // ---------- Arena ----------
    async refreshArena() {
      if (this.loadingArenaRequest) return;
      this.loadingArenaRequest = true;
      try { [this.status, this.foes] = await Promise.all([this.rpc('mv_pvp_status'), this.rpc('mv_pvp_find')]); this.err = null; }
      catch (e) { this.err = e.message; }
      this.loadingArenaRequest = false; this.arenaLoaded = true; this.changed();
    },
    async saveDefense(silent = false) {
      const e = this.engine; if (!e.requireService('arena')) return false;
      if (this.savingDefense) return false;
      if (e.heroes.length < 4) return this.fail(new Error('Monte uma equipe completa com 4 heróis antes de salvar a defesa.'));
      this.savingDefense = true;
      try { await this.rpc('mv_pvp_defense', { p_name:String(e.state.player.name || 'Viajante'), p_power:Math.round(e.getPower()), p_defense:e.pvpSnapshot() }); if (!silent) this.ui.toast('Equipe de defesa salva na Arena.', 'gold'); await this.refreshArena(); return true; }
      catch (err) { return this.fail(err); }
      finally { this.savingDefense = false; }
    },
    async attack(ref, kind = 'arena') {
      const e = this.engine;
      if (!e.requireService('arena') || kind === 'gvg' && !e.requireService('clans')) return;
      if (this.match) return this.fail(new Error('Conclua a luta atual antes de iniciar outra.'));
      if (this.busy) return; if (e.heroes.length < 4) return this.fail(new Error('Monte uma equipe com 4 heróis.'));
      this.busy = true;
      try {
        if (!this.status?.hasDefense && !await this.saveDefense(true)) throw new Error('Não foi possível registrar sua defesa. Nenhum desafio foi iniciado.');
        const m = await this.rpc(kind === 'gvg' ? 'mv_gvg_start' : 'mv_pvp_start', { p_ref:ref });
        this.match = { id:m.match, kind, name:m.name, mmr:m.mmr };
        e.arenaFoe = { name:m.name, mmr:m.mmr, tier:m.tier, defense:m.defense, seed:Number(m.seed), kind };
        this.ui.closeModal();
        if (!e.enterZone('arena')) throw new Error('Não foi possível entrar na Arena.');
        this.ui.toast(`<b>${KT.UIController.helpers.esc(m.name)}</b> aceitou o desafio! Use Q/W/E/R nas ultimates e clique para focar.`, 'gold');
      } catch (err) { this.fail(err); }
      finally { this.busy = false; }
    },
    async finish(rec) {
      const m = this.match; this.match = null; if (!m) return;
      try {
        const fn = m.kind === 'gvg' ? 'mv_gvg_finish' : 'mv_pvp_finish';
        const r = await this.rpc(fn, { p_match:m.id, p_won:!!rec.won, p_inputs:rec.inputs.slice(0, 800), p_end_tick:rec.endTick });
        this.lastResult = { ...r, kind:m.kind, foe:m.name };
        if (m.kind === 'gvg') this.ui.toast(r.won ? `Vitória na Guerra de Guildas: <b>+${r.points} ponto(s)</b>.` : 'Investida perdida. A guilda conta com você na próxima.', r.won ? 'gold' : '');
        else this.ui.toast(`${r.won ? 'Vitória' : 'Derrota'} na Arena: <b>${r.delta >= 0 ? '+' : ''}${r.delta} MMR</b>, +${r.honor} de Honra.${r.note ? ` ${r.note}` : ''}`, r.won ? 'gold' : '');
        this.ui.onArenaResult?.(this.lastResult);
      } catch (err) { this.fail(err); }
      this.refreshArena(); if (m.kind === 'gvg') this.refreshWar();
    },
    async claimWeek() { try { const r = await this.rpc('mv_pvp_claim_week'); this.ui.toast(`Recompensa da liga: <b>+${r.honor} de Honra</b>.`, 'gold'); await this.refreshArena(); } catch (e) { this.fail(e); } },
    async buy(id) {
      if (!this.engine.requireService('arena') || this.buying) return;
      this.buying = true;
      try {
        await this.rpc('mv_pvp_buy', { p_item:id });
        const got = this.engine.pvpGrant(id); this.engine.save(); KT.Neon.flush();
        this.ui.toast(`Loja de Honra: <b>${KT.UIController.helpers.esc(got || id)}</b>.`, 'gold');
        await this.refreshArena();
      } catch (e) { this.fail(e); }
      finally { this.buying = false; }
    },
    async loadHistory() { if (this.loadingHistory) return; this.loadingHistory = true; try { this.history = await this.rpc('mv_pvp_history'); } catch (e) { this.history = []; this.err = e.message; } finally { this.loadingHistory = false; } this.changed(); },
    async loadRanking() { const r = await KT.Neon.api('GET', '/mv_pvp_ranking?select=*&order=mmr.desc&limit=50'); this.ranking = r.ok ? r.data : []; this.changed(); },

    // ---------- Guildas ----------
    async refreshGuild() {
      if (this.guildRequest) return;
      this.guildRequest = true;
      try { this.guild = await this.rpc('mv_guild_mine'); this.err = null; }
      catch (e) { this.err = e.message; }
      this.guildRequest = false; this.guildLoaded = true;
      const lv = this.guild?.guild?.level || 0, s = this.engine?.state;
      if (s) { s.social = { ...(s.social || {}), guildLevel:lv, guildTag:this.guild?.guild?.tag || '' }; }
      this.changed();
    },
    async listGuilds() { const r = await KT.Neon.api('GET', '/mv_guild_list?select=*&order=level.desc,power.desc&limit=60'); this.guildList = r.ok ? r.data : []; this.changed(); },
    async createGuild(f) {
      if (!this.engine.requireService('clans') || this.creatingGuild) return;
      const s = this.engine.state, cost = KT.Data.GUILD.createCost;
      if (s.player.gold < cost) return this.fail(new Error(`Fundar uma guilda custa ${cost.toLocaleString('pt-BR')} de ouro.`));
      this.creatingGuild = true;
      try {
        await this.rpc('mv_guild_create', { p_name:f.name, p_tag:f.tag, p_emblem:f.emblem || '月', p_motto:f.motto || '', p_open:!!f.open, p_display:String(s.player.name || 'Viajante'), p_power:Math.round(this.engine.getPower()) });
        s.player.gold -= cost; this.engine.save(); KT.Neon.flush();
        this.ui.toast(`Guilda <b>${KT.UIController.helpers.esc(f.name)}</b> fundada!`, 'gold'); await this.refreshGuild();
      } catch (e) { this.fail(e); }
      finally { this.creatingGuild = false; }
    },
    async join(id) {
      if (!this.engine.requireService('clans')) return;
      try { const r = await this.rpc('mv_guild_join', { p_gid:id, p_display:String(this.engine.state.player.name || 'Viajante'), p_power:Math.round(this.engine.getPower()) }); this.ui.toast(r === 'joined' ? 'Bem-vindo à guilda!' : 'Pedido enviado. Um oficial precisa aceitar.', 'gold'); await this.refreshGuild(); await this.listGuilds(); }
      catch (e) { this.fail(e); }
    },
    async manage(action, ref) { try { await this.rpc('mv_guild_manage', { p_action:action, p_ref:ref }); await this.refreshGuild(); } catch (e) { this.fail(e); } },
    async leave() { try { await this.rpc('mv_guild_leave'); this.ui.toast('Você saiu da guilda.'); await this.refreshGuild(); } catch (e) { this.fail(e); } },
    async donate(gold) {
      if (this.donating || !this.engine.requireService('clans')) return;
      const s = this.engine.state; gold = Math.floor(Number(gold));
      if (!(gold >= 1000)) return this.fail(new Error('Doe ao menos 1.000 de ouro.'));
      if (s.player.gold < gold) return this.fail(new Error('Ouro insuficiente.'));
      this.donating = true;
      try { await this.rpc('mv_guild_donate', { p_gold:gold }); s.player.gold -= gold; this.engine.save(); KT.Neon.flush(); this.ui.toast(`Doou ${gold.toLocaleString('pt-BR')} de ouro à guilda.`, 'gold'); await this.refreshGuild(); }
      catch (e) { this.fail(e); }
      finally { this.donating = false; }
    },
    async post(text) { if (!String(text || '').trim()) return; try { await this.rpc('mv_guild_post', { p_text:String(text).slice(0, 200) }); await this.refreshGuild(); } catch (e) { this.fail(e); } },
    async settings(f) { try { await this.rpc('mv_guild_settings', { p_motto:f.motto, p_open:!!f.open, p_emblem:f.emblem }); await this.refreshGuild(); } catch (e) { this.fail(e); } },

    // ---------- Guerra de Guildas ----------
    async refreshWar() {
      try { this.board = await this.rpc('mv_gvg_board'); this.targets = this.board?.active && this.board.entered ? await this.rpc('mv_gvg_targets') : []; this.err = null; }
      catch (e) { this.err = e.message; }
      this.changed();
    },
    async enterWar() { try { this.board = await this.rpc('mv_gvg_enter'); this.targets = await this.rpc('mv_gvg_targets'); this.changed(); } catch (e) { this.fail(e); } },
    async claimWar() { try { const r = await this.rpc('mv_gvg_claim'); this.ui.toast(`${r.won ? 'Vitória' : 'Guerra encerrada'}: <b>+${r.honor} de Honra</b>.`, 'gold'); await this.refreshWar(); await this.refreshGuild(); } catch (e) { this.fail(e); } },
    // Placar ao vivo: atualiza a cada 8 s enquanto a aba da guerra estiver aberta.
    watchWar(on) {
      if (on && !this.poll) this.poll = setInterval(() => { if (this.ui?.view.panel === 'guild' && this.ui.view.tab === 'war' && !this.ui.el.modal.hidden) this.refreshWar(); else this.watchWar(false); }, 8000);
      if (!on && this.poll) { clearInterval(this.poll); this.poll = null; }
    }
  };
  KT.Social = Social;
})();
