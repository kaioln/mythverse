(() => {
  const KT = globalThis.KT;

  // ---------------------------------------------------------------------------
  // Cliente da API
  // ---------------------------------------------------------------------------
  const Net = {
    online:false, user:null,
    async api(method, url, body) {
      let res;
      try {
        res = await fetch(url, { method, credentials:'same-origin', headers:{ 'Content-Type':'application/json', 'X-MV-Request':'1' }, body:body === undefined ? undefined : JSON.stringify(body) });
      } catch (_) { return { ok:false, status:0, error:'Sem conexão com o servidor.' }; }
      let data = {}; try { data = await res.json(); } catch (_) {}
      return { ...data, ok:res.ok && data.ok !== false, status:res.status, error:data.error || (res.ok ? null : `Erro ${res.status}`) };
    },
    async detect() {
      if (location.protocol === 'file:') return false;
      try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000); const r = await fetch('/api/health', { signal:ctl.signal, credentials:'same-origin' }); clearTimeout(t); this.online = r.ok; if (r.ok) { const d = await r.json().catch(() => ({})); KT.Clock.sync(d.time); } }
      catch (_) { this.online = false; }
      return this.online;
    },
    async me() { const r = await this.api('GET', '/api/auth/me'); this.user = r.ok ? r.user : null; return this.user; },
    register(d) { return this.api('POST', '/api/auth/register', d); },
    login(d) { return this.api('POST', '/api/auth/login', d); },
    logout() { return this.api('POST', '/api/auth/logout'); },
    recover(d) { return this.api('POST', '/api/auth/recover', d); },
    changePassword(d) { return this.api('POST', '/api/auth/password', d); },
    newRecovery(password) { return this.api('POST', '/api/auth/recovery-code', { password }); },
    logoutAll() { return this.api('POST', '/api/auth/logout-all'); },
    deleteAccount(d) { return this.api('POST', '/api/account/delete', d); },
    getState() { return this.api('GET', '/api/state'); },
    history() { return this.api('GET', '/api/save/history'); },
    restore(id) { return this.api('POST', '/api/save/restore', { id }); },
    leaderboard(type) { return this.api('GET', `/api/leaderboard?type=${encodeURIComponent(type)}`); },
    async syncClock() { const t0 = Date.now(), r = await this.api('GET', '/api/time'); if (r.ok) KT.Clock.sync(r.time + (Date.now() - t0) / 2); return r; },
    // Carteira (Gemas) e Mercado de Jogadores, tudo validado no servidor.
    wallet() { return this.api('GET', '/api/wallet'); },
    worldBoss() { return this.api('GET', '/api/worldboss'); },
    deposit(amount) { return this.api('POST', '/api/wallet/deposit', { amount }); },
    withdraw(d) { return this.api('POST', '/api/wallet/withdraw', d); },
    market(f = {}) { const q = new URLSearchParams({ type:f.type || 'all', sort:f.sort || 'recent', q:f.q || '', slot:f.slot || 'all', rarity:f.rarity || 'all', ...(f.currency && !f.seller ? { currency:f.currency } : {}), ...(f.seller ? { seller:String(f.seller) } : {}) }); return this.api('GET', `/api/market?${q}`); },
    profile(id) { return this.api('GET', `/api/profile?id=${encodeURIComponent(id)}`); },
    myMarket() { return this.api('GET', '/api/market/mine'); },
    priceHistory(key, currency = 'gems') { return this.api('GET', `/api/market/history?key=${encodeURIComponent(key)}&currency=${currency === 'gold' ? 'gold' : 'gems'}`); },
    listItem(d) { return this.api('POST', '/api/market/list', { kind:'item', ...d }); },
    listCard(d) { return this.api('POST', '/api/market/list', { kind:'card', ...d }); },
    buyListing(id) { return this.api('POST', '/api/market/buy', { id }); },
    cancelListing(id) { return this.api('POST', '/api/market/cancel', { id }); },
    claimMail(d) { return this.api('POST', '/api/market/claim', d); }
  };

  // ---------------------------------------------------------------------------
  // Servidor autoritativo: fila única de sincronização. Cada chamada pode entregar a luta que
  // terminou (finish), pedir uma ação (act) e/ou começar a próxima luta (start). A resposta traz o
  // estado oficial, que substitui o do navegador.
  // ---------------------------------------------------------------------------
  const Server = {
    enabled:false, engine:null, ui:null, chain:Promise.resolve(), pendingFinish:null, revision:0, status:'idle', error:null, lastSync:0,
    attach(engine, ui, revision) {
      this.enabled = true; this.engine = engine; this.ui = ui; this.revision = revision || 0;
      engine.segmentProvider = this; engine.save = () => true;
      addEventListener('pagehide', () => this.beacon());
    },
    finished(fin) { this.pendingFinish = fin; },
    request(start) { return this.enqueue({ start }); },
    flush() { return this.enqueue({}); },
    act(op, args = []) { return this.enqueue({ act:{ op, args } }, true); },
    enqueue(body, isAct = false) {
      const task = async () => {
        const eng = this.engine;
        let restart = false;
        if (isAct && eng.seg) { eng.abortSegment(); restart = true; }
        const payload = { ...body }; if (this.pendingFinish) payload.finish = this.pendingFinish;
        this.pendingFinish = null;
        if (!payload.finish && !payload.act && !payload.start) return { ok:true };
        this.status = 'saving';
        let r = await Net.api('POST', '/api/sync', payload);
        for (let i = 0; !r.ok && r.status !== 400 && r.status !== 401 && r.status !== 403 && i < 4; i++) { await new Promise(res => setTimeout(res, 1500 * (i + 1))); r = await Net.api('POST', '/api/sync', payload); }
        if (!r.ok) {
          this.status = 'error'; this.error = r.error; this.ui?.renderCloud?.();
          if (r.status === 401) this.ui?.toast('Sua sessão expirou. Entre novamente.');
          else this.ui?.toast(`Não foi possível falar com o servidor: ${r.error}`);
          if (body.start) { eng.segWaiting = false; setTimeout(() => { if (eng.active && !eng.seg && eng.zone.kind !== 'village') eng.startRun(); }, 5000); }
          return { ok:false, error:r.error };
        }
        this.apply(r);
        if (body.start) {
          if (r.seg && eng.active && eng.zone.id === r.seg.zone) eng.beginSegment(r.seg);
          else { eng.segWaiting = false; if (r.startError) { this.ui?.toast(r.startError); eng.enterZone('village'); } }
        }
        if (restart && eng.active && !eng.seg && !eng.segWaiting && eng.zone.kind !== 'village') eng.startRun();
        if (isAct) return r.actError ? { ok:false, error:r.actError } : { ok:true, result:r.result };
        return r;
      };
      const p = this.chain.then(task, task);
      this.chain = p.catch(() => {});
      return p;
    },
    apply(r) {
      // Controle de qualidade: a luta que o servidor refez deve bater com a que foi mostrada.
      const st = this.engine.state;
      if (r.finish?.status === 'ok') { this.checked = (this.checked || 0) + 1; if (st.stats.kills !== r.state.stats.kills || Math.round(st.player.gold) !== Math.round(r.state.player.gold) || st.inventory.length !== r.state.inventory.length) this.desyncs = (this.desyncs || 0) + 1; }
      replaceState(this.engine.state, r.state);
      this.revision = r.revision; this.lastSync = Date.now(); this.status = 'ok'; this.error = null;
      if (r.offline) this.ui?.showOffline?.(r.offline);
      this.engine.refreshPartyUnits?.();
      this.ui?.afterServerState?.();
    },
    // Fechando a aba: entrega a luta em andamento para o servidor pagar o que já foi feito.
    beacon() {
      if (!this.enabled || !navigator.sendBeacon) return;
      if (this.engine.seg) this.engine.abortSegment();
      if (!this.pendingFinish) return;
      navigator.sendBeacon('/api/sync/beacon', new Blob([JSON.stringify({ finish:this.pendingFinish })], { type:'application/json' }));
      this.pendingFinish = null;
    }
  };
  // Substitui o estado local pelo oficial, mantendo preferências que só existem no navegador.
  function replaceState(dst, src) {
    const keep = { speed:dst.settings?.speed || 1, sound:!!dst.settings?.sound };
    const fresh = KT.State.mergeState(src);
    Object.keys(dst).forEach(k => { delete dst[k]; });
    Object.assign(dst, fresh);
    dst.settings.speed = keep.speed; dst.settings.sound = keep.sound;
  }

  KT.Net = Net;
  KT.Server = Server;
  KT.Cloud = { enabled:false, onLocalSave() {}, push:() => Promise.resolve(), storageKey:'' };
})();
