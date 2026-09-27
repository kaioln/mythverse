// Modo Neon: contas e saves direto no Neon (Neon Auth + Data API), para sites só de arquivos (GitHub Pages).
// O combate roda no navegador; o Neon guarda a conta e o progresso (tabela mv_saves, protegida por RLS:
// cada jogador só lê e grava a própria linha). Configure KT.CONFIG.neon em src/config.js.
(() => {
  const KT = globalThis.KT;

  const Neon = {
    user:null, row:null, jwt:null, jwtExp:0, pending:null, timer:null, retryTimer:null, inflight:null, lastHide:0, conflict:false,
    get enabled() { return !!this.base; },
    get base() { return String(KT.CONFIG?.neon || '').replace(/\/+$/, ''); },
    // https://ep-x.region.aws.neon.tech/neondb → .neonauth…/neondb/auth e .apirest…/neondb/rest/v1
    url(kind) { const u = new URL(this.base); const [ep, ...rest] = u.hostname.split('.'); u.hostname = [ep, kind === 'auth' ? 'neonauth' : 'apirest', ...rest].join('.'); return `${u.origin}${u.pathname.replace(/\/+$/, '')}${kind === 'auth' ? '/auth' : '/rest/v1'}`; },

    async auth(path, { method = 'GET', body } = {}) {
      // A sessão do Neon Auth é um cookie HttpOnly (SameSite=None; Partitioned) no domínio do Neon: vai com credentials.
      let res;
      try { res = await fetch(this.url('auth') + path, { method, credentials:'include', headers:{ 'Content-Type':'application/json' }, body:body ? JSON.stringify(body) : undefined }); }
      catch (_) { return { ok:false, status:0, error:'Sem conexão com o Neon.' }; }
      let data = null; try { data = await res.json(); } catch (_) { data = null; }
      const jwt = res.headers.get('set-auth-jwt'); if (jwt) this.setJwt(jwt);
      return { ok:res.ok, status:res.status, data, error:res.ok ? null : this.message(data, res.status) };
    },
    message(d, status) {
      const code = d?.code || '', msg = d?.message || '';
      const pt = { USER_ALREADY_EXISTS:'Já existe uma conta com esse e-mail.', INVALID_EMAIL_OR_PASSWORD:'E-mail ou senha incorretos.', PASSWORD_TOO_SHORT:'A senha é curta demais.', INVALID_EMAIL:'E-mail inválido.', INVALID_ORIGIN:'Este site ainda não está liberado no Neon Auth (Domínios confiáveis).', EMAIL_NOT_VERIFIED:'Confirme seu e-mail antes de entrar (veja a caixa de entrada).' };
      return pt[code] || (status === 429 ? 'Muitas tentativas. Aguarde um pouco.' : msg || `Erro ${status}`);
    },
    setJwt(jwt) { this.jwt = jwt; try { this.jwtExp = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (_) { this.jwtExp = Date.now() + 10 * 60_000; } },
    async token() {
      if (this.jwt && Date.now() < this.jwtExp - 60_000) return this.jwt;
      const r = await this.auth('/token');
      if (r.ok && r.data?.token) this.setJwt(r.data.token);
      else { const s = await this.auth('/get-session'); if (!s.ok || !s.data?.user) return null; }
      return this.jwt;
    },

    async currentUser() {
      if (!this.enabled) return null;
      const r = await this.auth('/get-session');
      this.user = r.ok && r.data?.user ? { id:r.data.user.id, username:r.data.user.name || r.data.user.email, email:r.data.user.email } : null;
      return this.user;
    },
    async signUp({ username, email, password }) {
      const r = await this.auth('/sign-up/email', { method:'POST', body:{ email:String(email || '').trim(), password, name:String(username || '').trim() } });
      return r.ok ? { ok:true, user:await this.currentUser() } : r;
    },
    async signIn({ login, password }) {
      const r = await this.auth('/sign-in/email', { method:'POST', body:{ email:String(login || '').trim(), password } });
      return r.ok ? { ok:true, user:await this.currentUser() } : r;
    },
    async signOut() { await this.flush(); await this.auth('/sign-out', { method:'POST', body:{} }); this.jwt = null; this.user = null; },

    // ---- Data API (PostgREST) ----
    journalKey() { return this.user ? `mythverse-neon-pending:${this.user.id}` : ''; },
    readJournal() { const raw = this.journalKey() && KT.Utils.safeStorage.get(this.journalKey()); try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; } },
    writeJournal(entry) { return !!this.journalKey() && KT.Utils.safeStorage.set(this.journalKey(), JSON.stringify({ id:entry.id, baseRevision:entry.baseRevision, generation:entry.generation, queuedAt:entry.queuedAt })); },
    clearJournal(id) { const j = this.readJournal(); if (!id || !j || j.id === id) KT.Utils.safeStorage.remove(this.journalKey()); },
    async api(method, path, body, prefer) {
      const jwt = await this.token(); if (!jwt) return { ok:false, status:401, error:'Sessão expirada. Entre de novo.' };
      let res;
      try { res = await fetch(this.url('api') + path, { method, keepalive:method !== 'GET', headers:{ Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json', ...(prefer ? { Prefer:prefer } : {}) }, body:body ? JSON.stringify(body) : undefined }); }
      catch (_) { return { ok:false, status:0, error:'Sem conexão com o Neon.' }; }
      let data = null; try { data = await res.json(); } catch (_) { data = null; }
      return { ok:res.ok, status:res.status, data, error:res.ok ? null : (data?.message || `Erro ${res.status}`) };
    },
    async loadSave() {
      const r = await this.api('GET', '/mv_saves?select=data,revision');
      if (!r.ok) throw new Error(`Não foi possível carregar seu progresso do Neon: ${r.error}`);
      this.row = r.data?.[0] ? { revision:r.data[0].revision } : null;
      const remote = r.data?.[0]?.data || null, journal = this.readJournal(), remoteRevision = this.row?.revision || 0;
      if (journal && journal.baseRevision === remoteRevision) {
        const local = KT.State.loadState();
        if ((Number(local.saveGeneration) || 0) >= (Number(journal.generation) || 0)) {
          this.pending = { ...journal, json:JSON.stringify(local) };
          this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 0);
          return local;
        }
      }
      if (journal) {
        const local = KT.State.loadState();
        KT.Utils.safeStorage.set(`${this.journalKey()}:conflict`, JSON.stringify(local));
        this.conflict = true;
      }
      return remote;
    },
    summary(state) {
      let power = 0;
      try { const recs = KT.State.formationRecords(state), ctx = KT.State.teamContext(state, recs); power = recs.reduce((s, r) => s + KT.State.statPower(KT.State.heroStats(state, r, ctx)), 0); } catch (_) { power = 0; }
      const prog = state.progress || {};
      return { display_name:String(state.player?.name || this.user?.username || 'Viajante').slice(0, 24), power:Math.round(power), boss_kills:Number(state.stats?.bossKills) || 0,
        best_stage:Object.values(KT.Data.zones).filter(z => z.kind === 'hunt' && !z.side).reduce((a, z) => a + (prog[z.id]?.best || 0), 0), rift_best:Number(prog.rift?.best) || 0,
        account_level:Number(state.player?.level) || 1, team:(state.formation || []).map(uid => uid && state.collection.find(h => h.uid === uid)).filter(Boolean).map(h => ({ id:h.id, stars:h.stars })) };
    },
    // Salva no máximo a cada 20 s (e ao fechar a aba). A revisão evita que dois aparelhos se sobrescrevam sem aviso.
    queue(state) {
      if (this.conflict) return false;
      const entry = { id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, baseRevision:this.row?.revision || 0, generation:Number(state.saveGeneration) || 0, queuedAt:Date.now(), json:JSON.stringify(state) };
      const durable = this.writeJournal(entry);
      if (!durable) this.onError?.('O navegador bloqueou a cópia local de segurança.');
      this.pending = entry;
      if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 20_000);
      return durable;
    },
    // Um envio por vez: chamadas simultâneas (timer, trocar de aba, botão) esperam a anterior terminar.
    async flush() {
      if (this.inflight) return this.inflight;
      this.inflight = (async () => { let ok = true; while (this.pending && ok) ok = await this.flushNow(this.pending); return ok; })();
      try { return await this.inflight; } finally { this.inflight = null; }
    },
    async flushNow(entry) {
      if (!entry || !this.user || this.conflict) return !this.conflict;
      const state = JSON.parse(entry.json);
      const body = { data:state, updated_at:new Date().toISOString(), ...this.summary(state) };
      let r;
      if (!this.row) { r = await this.api('POST', '/mv_saves', { ...body, revision:1 }, 'return=representation'); if (r.ok) this.row = { revision:Number(r.data?.[0]?.revision) || 1 }; }
      else {
        r = await this.api('PATCH', `/mv_saves?revision=eq.${this.row.revision}`, { ...body, revision:this.row.revision + 1 }, 'return=representation');
        if (r.ok && !r.data?.length) { this.conflict = true; this.pending = null; this.onConflict?.(); return false; }
        if (r.ok) this.row.revision = Number(r.data?.[0]?.revision) || this.row.revision + 1;
      }
      if (r.ok) { if (this.pending?.id === entry.id) this.pending = null; this.clearJournal(entry.id); }
      else { this.onError?.(r.error); if (!this.retryTimer) this.retryTimer = setTimeout(() => { this.retryTimer = null; this.flush(); }, 15_000); }
      return r.ok;
    },
    async leaderboard(type) {
      const col = { power:'power', bosses:'boss_kills', stage:'best_stage', rift:'rift_best' }[type] || 'power';
      const r = await this.api('GET', `/mv_ranking?select=*&order=${col}.desc&limit=50`);
      return r.ok ? { ok:true, type, me:null, rows:(r.data || []).map(x => ({ id:x.me ? 'me' : null, name:x.display_name, power:x.power, boss_kills:x.boss_kills, best_stage:x.best_stage, rift_best:x.rift_best, account_level:x.account_level, team:JSON.stringify(x.team || []), me:x.me })) } : r;
    }
  };
  KT.Neon = Neon;
})();
