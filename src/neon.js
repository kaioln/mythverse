// Modo Neon: contas e saves direto no Neon (Neon Auth + Data API), para sites só de arquivos (GitHub Pages).
// O combate roda no navegador; o Neon guarda a conta e o progresso (tabela mv_saves, protegida por RLS:
// cada jogador só lê e grava a própria linha). Configure KT.CONFIG.neon em src/config.js.
(() => {
  const KT = globalThis.KT;

  const Neon = {
    user:null, row:null, jwt:null, jwtExp:0, pending:null, timer:null, retryTimer:null, inflight:null, lastHide:0, conflict:false, status:'idle', error:null, lastSync:0,
    get enabled() { return !!this.base; },
    get base() { return String(KT.CONFIG?.neon || '').replace(/\/+$/, ''); },
    // https://ep-x.region.aws.neon.tech/neondb → .neonauth…/neondb/auth e .apirest…/neondb/rest/v1
    url(kind) { const u = new URL(this.base); const [ep, ...rest] = u.hostname.split('.'); u.hostname = [ep, kind === 'auth' ? 'neonauth' : 'apirest', ...rest].join('.'); return `${u.origin}${u.pathname.replace(/\/+$/, '')}${kind === 'auth' ? '/auth' : '/rest/v1'}`; },

    async auth(path, { method = 'GET', body } = {}) {
      // A sessão do Neon Auth é um cookie HttpOnly (SameSite=None; Partitioned) no domínio do Neon: vai com credentials.
      let res; const ctl = new AbortController(), timeout = setTimeout(() => ctl.abort(), 12_000);
      try { res = await fetch(this.url('auth') + path, { method, credentials:'include', signal:ctl.signal, headers:{ 'Content-Type':'application/json' }, body:body ? JSON.stringify(body) : undefined }); }
      catch (_) { return { ok:false, status:0, error:ctl.signal.aborted ? 'Tempo de conexão esgotado.' : 'Sem conexão com o Neon.' }; }
      finally { clearTimeout(timeout); }
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
    setStatus(status, error = null) { this.status = status; this.error = error; this.onStatus?.(); },
    async api(method, path, body, prefer) {
      const jwt = await this.token(); if (!jwt) return { ok:false, status:401, error:'Sessão expirada. Entre de novo.' };
      let res;
      const payload = body ? JSON.stringify(body) : undefined;
      // Navegadores rejeitam fetch keepalive com corpo acima de ~64 KiB. Saves grandes
      // pareciam perda de conexão e nunca chegavam ao Neon.
      const keepalive = method !== 'GET' && payload && new Blob([payload]).size <= 60 * 1024;
      const ctl = new AbortController(), timeout = setTimeout(() => ctl.abort(), 12_000);
      try { res = await fetch(this.url('api') + path, { method, cache:method === 'GET' ? 'no-store' : 'default', keepalive:!!keepalive, signal:ctl.signal, headers:{ Authorization:`Bearer ${jwt}`, 'Content-Type':'application/json', ...(prefer ? { Prefer:prefer } : {}) }, body:payload }); }
      catch (_) { return { ok:false, status:0, error:ctl.signal.aborted ? 'Tempo de conexão esgotado.' : 'Sem conexão com o Neon.' }; }
      finally { clearTimeout(timeout); }
      let data = null; try { data = await res.json(); } catch (_) { data = null; }
      return { ok:res.ok, status:res.status, data, error:res.ok ? null : (data?.message || `Erro ${res.status}`) };
    },
    async loadSave() {
      const r = await this.api('GET', '/mv_saves?select=data,revision');
      if (!r.ok) throw new Error(`Não foi possível carregar seu progresso do Neon: ${r.error}`);
      this.row = r.data?.[0] ? { revision:r.data[0].revision } : null;
      const remote = r.data?.[0]?.data || null, journal = this.readJournal(), remoteRevision = this.row?.revision || 0;
      // A cópia local deste aparelho é salva a cada 5 s, mesmo quando a nuvem falha. Se ela for mais
      // recente (hora real do último save) que a da nuvem, ela vence: recarregar a página nunca volta no tempo.
      const local = KT.State.loadState(), hasLocal = !!journal || local.collection.length > 0;
      const localNewer = hasLocal && (!remote || journal?.baseRevision === remoteRevision || (Number(local.lastSeen) || 0) > (Number(remote.lastSeen) || 0) + 1000);
      if (localNewer) {
        this.pending = { id:journal?.id || `boot-${Date.now().toString(36)}`, baseRevision:remoteRevision, generation:Number(local.saveGeneration) || 0, queuedAt:Date.now(), json:JSON.stringify(local) };
        this.writeJournal(this.pending);
        this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 0);
        return local;
      }
      if (journal) this.clearJournal(journal.id);
      return remote;
    },
    // Sessão ativa: o aparelho/aba aberto por último é o dono do save. Um aparelho antigo que continue
    // aberto em segundo plano para de salvar em vez de sobrescrever o progresso mais novo.
    sessionId:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, sessionAt:Date.now(),
    supersededBy(remoteData) { const s = remoteData?.activeSession; return !!(s && s.id !== this.sessionId && Number(s.at) > this.sessionAt); },
    summary(state) {
      let power = 0;
      try { const recs = KT.State.formationRecords(state), ctx = KT.State.teamContext(state, recs); power = recs.reduce((s, r) => s + KT.State.statPower(KT.State.heroStats(state, r, ctx)), 0); } catch (_) { power = 0; }
      const prog = state.progress || {};
      return { display_name:String(state.player?.name || this.user?.username || 'Viajante').slice(0, 24), power:Math.round(power), boss_kills:Number(state.stats?.bossKills) || 0,
        best_stage:Object.values(KT.Data.zones).filter(z => z.kind === 'hunt' && !z.side).reduce((a, z) => a + (prog[z.id]?.best || 0), 0), rift_best:Number(prog.rift?.best) || 0,
        account_level:Number(state.player?.level) || 1, team:(state.formation || []).map(uid => uid && state.collection.find(h => h.uid === uid)).filter(Boolean).map(h => ({ id:h.id, stars:h.stars })) };
    },
    // Protege localmente a cada ciclo e envia à nuvem em até 5 s.
    queue(state) {
      if (this.conflict) return false;
      const entry = { id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, baseRevision:this.row?.revision || 0, generation:Number(state.saveGeneration) || 0, queuedAt:Date.now(), json:JSON.stringify(state) };
      const durable = this.writeJournal(entry);
      if (!durable) this.onError?.('O navegador bloqueou a cópia local de segurança.');
      this.pending = entry;
      this.setStatus('pending');
      if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 5_000);
      return durable;
    },
    // Um envio por vez: chamadas simultâneas (timer, trocar de aba, botão) esperam a anterior terminar.
    async flush() {
      if (this.inflight) return this.inflight;
      this.inflight = (async () => { let ok = true; while (this.pending && ok) ok = await this.flushNow(this.pending); return ok; })();
      try { return await this.inflight; } finally { this.inflight = null; }
    },
    async flushNow(entry, reconciled = false) {
      if (!entry || !this.user || this.conflict) return !this.conflict;
      this.setStatus('saving');
      const state = JSON.parse(entry.json);
      state.activeSession = { id:this.sessionId, at:this.sessionAt };
      const body = { data:state, updated_at:new Date().toISOString(), ...this.summary(state) };
      let r;
      if (!this.row) { r = await this.api('POST', '/mv_saves', { ...body, revision:1 }, 'return=representation'); if (r.ok) this.row = { revision:Number(r.data?.[0]?.revision) || 1 }; }
      else {
        r = await this.api('PATCH', `/mv_saves?revision=eq.${this.row.revision}`, { ...body, revision:this.row.revision + 1 }, 'return=representation');
        if (r.ok && !r.data?.length) {
          const latest = await this.api('GET', '/mv_saves?select=data,revision');
          const current = latest.ok ? latest.data?.[0] : null;
          if (!current) { r = latest.ok ? { ok:false, error:'Save remoto não encontrado.' } : latest; }
          else {
            this.row = { revision:Number(current.revision) || 0 };
            if (this.pending?.id !== entry.id) return true;
            if (this.supersededBy(current.data)) {
              // Outro aparelho abriu o jogo depois deste: guarda esta cópia e para de salvar.
              KT.Utils.safeStorage.set(`${this.journalKey()}:conflict`, entry.json);
              this.pending = null; this.clearJournal(entry.id); this.conflict = true;
              this.setStatus('error', 'Jogo aberto em outro aparelho.');
              this.onTakeover?.(current.data);
              return true;
            }
            if (!reconciled) {
              // Mesma sessão ou sessão mais antiga no servidor: este aparelho é o dono, regrava por cima.
              entry.baseRevision = this.row.revision;
              this.writeJournal(entry);
              return this.flushNow(entry, true);
            }
            r = { ok:false, error:'Conflito de revisão.' };
          }
        }
        if (r.ok) this.row.revision = Number(r.data?.[0]?.revision) || this.row.revision + 1;
      }
      if (r.ok) { if (this.pending?.id === entry.id) this.pending = null; this.clearJournal(entry.id); this.lastSync = Date.now(); this.setStatus('ok'); }
      else { this.setStatus('error', r.error); this.onError?.(r.error); if (!this.retryTimer) this.retryTimer = setTimeout(() => { this.retryTimer = null; this.flush(); }, 10_000); }
      return r.ok;
    },
    async leaderboard(type) {
      const col = { power:'power', bosses:'boss_kills', stage:'best_stage', rift:'rift_best' }[type] || 'power';
      const r = await this.api('GET', `/mv_ranking?select=*&order=${col}.desc&limit=50`);
      return r.ok ? { ok:true, type, me:null, rows:(r.data || []).map(x => ({ id:x.me ? 'me' : null, name:x.display_name, power:x.power, boss_kills:x.boss_kills, best_stage:x.best_stage, rift_best:x.rift_best, account_level:x.account_level, team:JSON.stringify(x.team || []), me:x.me })) } : r;
    }
  };
  KT.Neon = Neon;

  // ---------------------------------------------------------------------------
  // Mercado de Jogadores (ouro) no modo Neon. Mesma interface de KT.Net usada pelas telas.
  // O banco garante as regras críticas (tools/neon_setup.sql): um anúncio só é vendido uma vez,
  // o correio só é resgatado uma vez e o imposto de 5% sai de circulação.
  // ---------------------------------------------------------------------------
  const CFG = { enabled:false, goldMarket:true, goldMinPrice:100, goldListFeeBps:100, goldListFeeMin:50, goldTaxBps:500 };
  const itemKey = it => it.kind === 'unique' ? `u:${it.uniqueId}` : it.kind === 'set' ? `s:${it.setId}:${it.slot}` : `b:${it.baseId}:${it.rarity}`;
  const rpc = async (fn, args) => { const r = await Neon.api('POST', `/rpc/${fn}`, args); return r.ok ? { ok:true, data:r.data } : { ok:false, error:r.error }; };
  const toListing = r => ({ id:Number(r.id), sellerId:r.mine ? 'me' : r.seller_ref, seller:r.seller_name, kind:r.kind, payload:r.payload, price:Number(r.price), currency:'gold', name:r.name, mine:!!r.mine });
  const NeonMarket = {
    wallet() { return Promise.resolve({ ok:true, balance:0, config:CFG }); },
    async market(f = {}) {
      const q = ['select=*'];
      if (f.type && f.type !== 'all') q.push(`kind=eq.${encodeURIComponent(f.type)}`);
      if (f.slot && f.slot !== 'all') q.push(`slot=eq.${encodeURIComponent(f.slot)}`);
      if (f.rarity && f.rarity !== 'all') q.push(`rarity=eq.${encodeURIComponent(f.rarity)}`);
      if (f.seller) q.push(f.seller === 'me' ? 'mine=is.true' : `seller_ref=eq.${encodeURIComponent(f.seller)}`);
      if (f.q) q.push(`name=ilike.*${encodeURIComponent(String(f.q).replace(/[*,()]/g, ''))}*`);
      q.push(`order=${f.sort === 'price' ? 'price.asc' : f.sort === '-price' ? 'price.desc' : 'created_at.desc'}`, 'limit=120');
      const r = await Neon.api('GET', `/mv_market?${q.join('&')}`);
      return r.ok ? { ok:true, config:CFG, listings:(r.data || []).map(toListing) } : { ok:false, error:r.error, listings:[] };
    },
    async myMarket() {
      await rpc('mv_market_expire', {});
      const [l, m] = await Promise.all([Neon.api('GET', '/mv_market?select=*&mine=is.true&order=created_at.desc'), Neon.api('GET', '/mv_mail?select=*&order=created_at.asc')]);
      if (!l.ok || !m.ok) return { ok:false, error:l.error || m.error };
      return { ok:true, listings:(l.data || []).map(toListing), mailbox:(m.data || []).map(x => ({ id:Number(x.id), kind:x.kind, payload:x.payload, reason:x.reason })) };
    },
    async priceHistory(key) {
      const r = await Neon.api('GET', `/mv_sales?select=price,closed_at&item_key=eq.${encodeURIComponent(key)}&order=closed_at.desc&limit=30`);
      return r.ok ? { ok:true, sales:(r.data || []).map(x => ({ price:Number(x.price), at:x.closed_at })) } : { ok:false, sales:[] };
    },
    async cancelListing(id) { const r = await rpc('mv_market_cancel', { p_id:id }); return r.ok ? { ok:true } : r; },
    // Ações que mexem no save: o motor tira/coloca no estado local e o banco faz a custódia.
    async act(engine, op, args) {
      const s = engine.state;
      if (op === 'marketList') {
        const a = args[0] || {}, price = Math.floor(Number(a.price));
        if (!(price >= CFG.goldMinPrice)) return { ok:false, error:`Preço mínimo: ${CFG.goldMinPrice} de ouro.` };
        const fee = Math.max(CFG.goldListFeeMin, Math.ceil(price * CFG.goldListFeeBps / 10000));
        if (s.player.gold < fee) return { ok:false, error:`A taxa de anúncio é de ${fee} de ouro.` };
        const payload = engine.marketTake(a.kind, a.kind === 'item' ? a.itemUid : a.kind === 'card' ? a.cardId : a.matId, a.qty);
        if (!payload) return { ok:false, error:engine.lastError || 'Não foi possível anunciar.' };
        const meta = a.kind === 'item' ? { key:itemKey(payload), name:payload.name, rarity:payload.rarity, slot:payload.slot }
          : a.kind === 'card' ? { key:`c:${payload.id}`, name:KT.Items.cardById(payload.id).name, rarity:'', slot:'' }
          : { key:`m:${payload.id}`, name:`${KT.Items.matInfo(payload.id).name} ×${payload.qty}`, rarity:'', slot:'' };
        const r = await rpc('mv_market_list', { p_kind:a.kind, p_key:meta.key, p_name:meta.name, p_rarity:meta.rarity || '', p_slot:meta.slot || '', p_payload:payload, p_price:price, p_seller_name:String(s.player.name || 'Viajante').slice(0, 24) });
        if (!r.ok) { engine.marketReceive(a.kind, payload); engine.save(); return { ok:false, error:r.error }; }
        s.player.gold -= fee; engine.save(); Neon.flush();
        return { ok:true, result:{ id:r.data } };
      }
      if (op === 'marketBuyGold') {
        const id = Number(args[0]), l = await Neon.api('GET', `/mv_market?select=price,mine&id=eq.${id}`), row = l.ok && l.data?.[0];
        if (!row) return { ok:false, error:'Anúncio indisponível.' };
        if (s.player.gold < Number(row.price)) return { ok:false, error:'Ouro insuficiente.' };
        const r = await rpc('mv_market_buy', { p_id:id }); if (!r.ok) return r;
        s.player.gold -= Number(r.data.price); engine.save();
        // A mercadoria foi para o correio do comprador: resgata na hora.
        const mail = await this.myMarket(); let got = null;
        for (const m of (mail.mailbox || []).filter(x => x.kind === r.data.kind)) { const c = await this.claim(engine, m.id); if (c.ok) { got = c.result; break; } }
        Neon.flush();
        return { ok:true, result:{ kind:r.data.kind, delivered:got ? 'bag' : 'mail' } };
      }
      if (op === 'marketClaim') return this.claim(engine, Number(args[0]));
      return { ok:false, error:'Ação indisponível no modo Neon.' };
    },
    // ---------- Banco Central da Fenda ----------
    async economy(engine) {
      const r = await rpc('mv_economy', {}); if (!r.ok) return r;
      this.econ = r.data; CFG.goldTaxBps = r.data.taxBps || 500;
      if (engine) engine.state.econ = { faucet:Number(r.data.faucet) || 1, price:Number(r.data.price) || 1, taxBps:r.data.taxBps || 500, at:Date.now() };
      return { ok:true, data:r.data };
    },
    async dailyHistory(key) { const r = await rpc('mv_price_history', { p_key:key }); return r.ok ? r.data || [] : []; },
    // ---------- Ordens de compra (materiais e cartas) ----------
    async orders() {
      const r = await Neon.api('GET', '/mv_orders_open?select=*&order=price_each.desc&limit=150');
      return r.ok ? (r.data || []).map(o => ({ id:Number(o.id), kind:o.kind, key:o.item_key, name:o.name, payload:o.payload, qtyLeft:o.qty_left, qty:o.qty, price:Number(o.price_each), buyer:o.buyer_name, mine:!!o.mine })) : [];
    },
    goodsMeta(kind, id) {
      if (kind === 'card') { const cd = KT.Items.cardById(id); return cd ? { key:`c:${id}`, name:cd.name, payload:{ id } } : null; }
      const m = KT.Items.matInfo(id); return m ? { key:`m:${id}`, name:m.name, payload:{ id } } : null;
    },
    async placeOrder(engine, o) {
      const s = engine.state, qty = Math.floor(Number(o.qty)), price = Math.floor(Number(o.price)), meta = this.goodsMeta(o.kind, o.id);
      if (!meta) return { ok:false, error:'Escolha um material ou carta negociável.' };
      if (!(qty >= 1 && qty <= 9999) || !(price >= 100)) return { ok:false, error:'Quantidade de 1 a 9.999 e preço mínimo de 100 por unidade.' };
      const total = qty * price; if (s.player.gold < total) return { ok:false, error:`A ordem reserva ${total.toLocaleString('pt-BR')} de ouro.` };
      s.player.gold -= total; engine.save();
      const r = await rpc('mv_order_place', { p_kind:o.kind, p_key:meta.key, p_name:meta.name, p_payload:meta.payload, p_qty:qty, p_price:price, p_buyer_name:String(s.player.name || 'Viajante').slice(0, 24) });
      if (!r.ok) { s.player.gold += total; engine.save(); return r; }
      Neon.flush(); return { ok:true };
    },
    async fillOrder(engine, order, qty) {
      qty = Math.min(order.qtyLeft, Math.floor(Number(qty)) || 0); if (qty < 1) return { ok:false, error:'Quantidade inválida.' };
      const id = order.payload?.id, got = order.kind === 'card' ? (qty === 1 ? engine.marketTake('card', id) : null) : engine.marketTake('mat', id, qty);
      if (!got) return { ok:false, error:order.kind === 'card' && qty > 1 ? 'Venda cartas uma de cada vez.' : engine.lastError || 'Você não tem o suficiente.' };
      const r = await rpc('mv_order_fill', { p_id:order.id, p_qty:qty });
      if (!r.ok) { engine.marketReceive(order.kind, order.kind === 'card' ? { id } : { id, qty }); engine.save(); return r; }
      engine.save(); Neon.flush();
      // O ouro vem pelo correio: resgata na hora.
      const mail = await this.myMarket();
      for (const m of (mail.mailbox || []).filter(x => x.kind === 'gold')) await this.claim(engine, m.id);
      return { ok:true, result:r.data };
    },
    async cancelOrder(engine, id) {
      const r = await rpc('mv_order_cancel', { p_id:id }); if (!r.ok) return r;
      const mail = await this.myMarket();
      for (const m of (mail.mailbox || []).filter(x => x.kind === 'gold')) await this.claim(engine, m.id);
      return { ok:true, refund:r.data?.refund };
    },
    async claim(engine, id) {
      const r = await rpc('mv_mail_claim', { p_id:id }); if (!r.ok) return r;
      engine.marketReceive(r.data.kind, r.data.payload); engine.save(); Neon.flush();
      return { ok:true, result:{ kind:r.data.kind } };
    }
  };
  KT.NeonMarket = NeonMarket;
})();
