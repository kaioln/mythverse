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
      try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000); const r = await fetch('/api/health', { signal:ctl.signal, credentials:'same-origin' }); clearTimeout(t); this.online = r.ok; }
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
    getSave() { return this.api('GET', '/api/save'); },
    putSave(save, revision, force = false) { return this.api('PUT', '/api/save', { save, revision, force }); },
    history() { return this.api('GET', '/api/save/history'); },
    restore(id) { return this.api('POST', '/api/save/restore', { id }); },
    leaderboard(type) { return this.api('GET', `/api/leaderboard?type=${encodeURIComponent(type)}`); }
  };

  // ---------------------------------------------------------------------------
  // Sincronização do save com a nuvem
  // ---------------------------------------------------------------------------
  class CloudSync {
    constructor() { this.revision = 0; this.dirty = false; this.lastJson = null; this.pushing = false; this.lastSync = 0; this.status = 'idle'; this.error = null; this.ui = null; this.enabled = false; }
    start(revision, ui) {
      this.revision = revision || 0; this.ui = ui; this.enabled = true;
      setInterval(() => this.push(), 30_000);
      addEventListener('online', () => this.push(true));
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.beacon(); });
      addEventListener('pagehide', () => this.beacon());
    }
    onLocalSave(state, json) { if (!this.enabled) return; this.dirty = true; this.lastJson = json; this.state = state; }
    async push(forceNow = false, force = false) {
      if (!this.enabled || this.pushing || (!this.dirty && !forceNow && !force) || !this.lastJson) return;
      this.pushing = true; this.status = 'saving';
      const payload = JSON.parse(this.lastJson); this.dirty = false;
      const r = await Net.putSave(payload, this.revision, force);
      this.pushing = false;
      if (r.ok) { this.revision = r.revision; this.lastSync = Date.now(); this.status = 'ok'; this.error = null; }
      else if (r.status === 409) { this.status = 'conflict'; await this.resolveConflict(r); }
      else if (r.status === 401) { this.status = 'auth'; this.error = 'Sessão expirada. Entre novamente.'; this.ui?.toast('Sua sessão expirou — faça login de novo para salvar na nuvem.'); }
      else { this.dirty = true; this.status = 'error'; this.error = r.error; }
      this.ui?.renderCloud?.();
    }
    async resolveConflict(r) {
      const localPlay = this.state?.totalPlaySeconds || 0, remotePlay = r.playSeconds || 0;
      const fmt = s => `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}min`;
      const useRemote = await this.ui.ask('Progresso em outro dispositivo', `A nuvem tem um save diferente (${fmt(remotePlay)} de jogo, salvo ${new Date(r.updatedAt).toLocaleString('pt-BR')}). Este dispositivo tem ${fmt(localPlay)}. Qual deseja manter?`, [{ id:'remote', label:'Usar o da nuvem', primary:remotePlay >= localPlay }, { id:'local', label:'Manter este', primary:localPlay > remotePlay }]);
      if (useRemote === 'remote') { KT.Utils.safeStorage.set(this.storageKey, JSON.stringify(r.save)); this.enabled = false; location.reload(); }
      else { this.revision = r.revision; this.dirty = true; await this.push(true, true); }
    }
    beacon() {
      if (!this.enabled || !this.dirty || !this.lastJson || !navigator.sendBeacon) return;
      const ok = navigator.sendBeacon('/api/save/beacon', new Blob([JSON.stringify({ save:JSON.parse(this.lastJson), revision:this.revision })], { type:'application/json' }));
      if (ok) { this.dirty = false; this.revision++; }
    }
  }

  KT.Net = Net;
  KT.Cloud = new CloudSync();
})();
