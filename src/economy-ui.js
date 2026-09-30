// Economia viva: painel do Tesouro Imperial e ordens de compra do Mercado de Jogadores.
(() => {
  const KT = globalThis.KT;
  const U = KT.Utils, I = KT.Items, P = KT.UIController.prototype;
  const { esc, compact } = KT.UIController.helpers;
  const M = () => KT.NeonMarket;
  const pct = v => `${(Number(v) * 100).toFixed(0)}%`;

  // ---------------------------------------------------------------------------
  // BANCO KOGANE: o banco central de Tsukimori (índice, torneira de ouro, cotações e carteira).
  // ---------------------------------------------------------------------------
  const CREST = '<svg class="bank-crest" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" class="c-ring"/><circle cx="32" cy="32" r="21" class="c-coin"/><rect x="27" y="27" width="10" height="10" rx="1.5" class="c-hole"/><path d="M14 44c6-3 10-9 18-9s12 6 18 9" class="c-wave"/><path d="M20 20l4 4M44 20l-4 4" class="c-wave"/></svg>';
  const fmtAt = iso => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`; };
  const num2 = v => Number(v).toFixed(2).replace('.', ',');

  // Gráfico de linhas com escala automática, grade, rótulos de valor e de tempo (SVG sem distorção).
  function lineChart(pts, series, { ref = null, fmt = num2, h = 210 } = {}) {
    if (!pts || pts.length < 2) return `<div class="bank-chart empty"><p>O Banco ainda está coletando medições (uma a cada 20 minutos). O gráfico aparece a partir da 2ª medição.</p></div>`;
    const W = 680, H = h, L = 52, R = 16, T = 16, B = 30, iw = W - L - R, ih = H - T - B;
    const vals = pts.flatMap(p => series.map(s => Number(p[s.key]))).filter(Number.isFinite).concat(ref !== null ? [ref] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const span = Math.max((hi - lo) * .15, Math.abs(hi) * .05, .05); lo -= span; hi += span; if (lo < 0 && Math.min(...vals) >= 0) lo = 0;
    const x = i => L + i / (pts.length - 1) * iw, y = v => T + (1 - (v - lo) / (hi - lo)) * ih;
    const ticks = Array.from({ length:5 }, (_, i) => lo + (hi - lo) * i / 4);
    const grid = ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" class="yl">${fmt(v)}</text>`).join('');
    const xi = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
    const xl = xi.map((i, k) => `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="xl" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}">${fmtAt(pts[i].at)}</text>`).join('');
    const refLine = ref !== null ? `<line x1="${L}" x2="${W - R}" y1="${y(ref).toFixed(1)}" y2="${y(ref).toFixed(1)}" class="ref"/><text x="${W - R}" y="${(y(ref) - 5).toFixed(1)}" class="rl" text-anchor="end">meta ${fmt(ref)}</text>` : '';
    const lines = series.map(s => {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(p[s.key])).toFixed(1)}`).join(' ');
      const area = s.area ? `<path d="${d} L${x(pts.length - 1).toFixed(1)},${(T + ih).toFixed(1)} L${L},${(T + ih).toFixed(1)} Z" fill="${s.color}" opacity=".12"/>` : '';
      const last = pts[pts.length - 1], lx = x(pts.length - 1), ly = y(Number(last[s.key]));
      const dots = pts.length <= 40 ? pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(Number(p[s.key])).toFixed(1)}" r="2.2" fill="${s.color}"><title>${fmtAt(p.at)} · ${s.label}: ${fmt(Number(p[s.key]))}</title></circle>`).join('') : '';
      return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${dots}<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5" fill="${s.color}" class="last"/><text x="${(lx - 8).toFixed(1)}" y="${(ly - 8).toFixed(1)}" class="vl" fill="${s.color}" text-anchor="end">${fmt(Number(last[s.key]))}</text>`;
    }).join('');
    return `<div class="bank-chart"><svg viewBox="0 0 ${W} ${H}" role="img">${grid}${refLine}${lines}${xl}</svg><div class="bank-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div></div>`;
  }
  const verdict = ix => ix > 1.5 ? ['Inflação alta', 'hot', 'O Banco está fechando a torneira de ouro e encarecendo NPCs e impostos.'] : ix > 1.1 ? ['Inflação moderada', 'warm', 'Ajustes leves em andamento para segurar os preços.'] : ix < .6 ? ['Ouro escasso', 'cold', 'A torneira está aberta: vale a pena caçar, vender e produzir.'] : ['Economia estável', 'ok', 'O ouro guardado pelos jogadores está perto de 6 horas da própria renda: saudável.'];

  // Estimativa de valor quando ainda não há negócios: custo de produzir (receitas da Oficina) ou de desmontar.
  P.bankEstimate = function(kind, id) {
    const eco = M().econ || {}, px = Number(eco.price) || 1, e = this.engine;
    const star = (20000 + 60 * 150 + 20 * 80) * px, ori = (150000 + 6 * star + 60 * 80) * px;
    if (kind === 'mat') return { star, ori, adam:ori * 4 }[({ rare:'star', epic:'ori', legendary:'adam' })[id] || id] || 0;
    const z = KT.Data.zones[this.state.lastHunt] || KT.Data.zones.hunt, il = KT.State.itemLevelFor(z, { stage:Math.max(1, this.state.progress[z.id]?.best || 1) });
    const v = I.salvageValue({ rarity:id === 'mythic' || id === 'set' ? 'legendary' : id, ilvl:il, plus:0 }), base = v.gold + v.ore * 150 + v.dust * 80;
    return Math.round(base * ({ rare:3, epic:12, legendary:60, mythic:150, set:40 }[id] || 3) * px);
  };
  const quote = (sold, ask, bid, est) => sold ? { v:sold.median, src:`mediana de ${sold.n} venda(s) em 7 dias`, cls:'q-sold' } : ask ? { v:ask, src:'menor anúncio aberto', cls:'q-ask' } : bid ? { v:bid, src:'maior ordem de compra', cls:'q-bid' } : { v:est, src:'estimativa do Banco (custo de produção)', cls:'q-est' };

  P.bankPanel = function(_, tab) {
    if (tab === 'wallet') return this.walletPanel();
    if (this.session?.mode !== 'neon') return this.cloudOnly('Banco Kogane');
    const eco = M().econ;
    if (!eco && !this.econLoading) { this.econLoading = true; M().economy(this.engine).then(() => { this.econLoading = false; if (this.view.panel === 'bank') this.refreshPanel(); }); }
    const head = `<section class="bank-hero">${CREST}<div><span class="eyebrow">BANCO KOGANE · 黄金 · desde a fundação de Tsukimori</span><h3>Tesoureira Oharu</h3><p>“Guardo o valor do ouro da cidade. Quando sobra ouro, fecho a torneira; quando falta, abro. Aqui você vê o pulso da economia e quanto vale cada coisa.”</p></div></section>`;
    if (!eco) return `${head}<div class="empty-state"><p>Consultando os livros do Banco…</p></div>`;
    if (tab === 'quotes') return head + this.bankQuotes(eco);
    const ix = Number(eco.index) || 1, v = verdict(ix), hist = eco.history || [];
    return `${head}<section class="bank-status ${v[1]}"><div><small>SITUAÇÃO</small><h3>${v[0]}</h3><p>${v[2]}</p></div><div class="bank-gauge"><b>${num2(ix)}</b><small>índice · meta 1,00</small></div></section>
      <div class="bank-kpis">
        <span><b>${pct(eco.faucet)}</b>Torneira de ouro<small>quanto caçadas e recompensas pagam agora</small></span>
        <span><b>×${num2(eco.price)}</b>Preços de NPC<small>loja e construções</small></span>
        <span><b>${(eco.taxBps / 100).toFixed(1).replace('.', ',')}%</b>Imposto do mercado<small>sai de circulação</small></span>
        <span><b>${compact(eco.perPlayer)}</b>Ouro guardado (mediana)<small>reserva saudável ${compact(eco.target)} = 6 h de renda</small></span>
        <span><b>${compact(eco.income || 0)}/h</b>Renda típica<small>ouro ganho por hora de jogo (mediana)</small></span>
        <span><b>${U.fmt(eco.players || 0)}</b>Jogadores ativos<small>últimos 7 dias · ouro total ${compact(eco.money)}</small></span>
        <span><b>${compact(eco.volume24)}</b>Volume 24 h<small>${eco.trades24} negócio(s) · ${eco.listings} anúncios · ${eco.orders} ordens</small></span>
        <span><b>${eco.growth24 === null || eco.growth24 === undefined ? '–' : `${eco.growth24 > 0 ? '+' : ''}${String(eco.growth24).replace('.', ',')}%`}</b>Variação 24 h<small>ouro guardado por jogador</small></span>
      </div>
      <h4 class="sub-title">Índice de inflação e torneira de ouro</h4>
      ${lineChart(hist, [{ key:'index', label:'Índice (suavizado)', color:'#e8b64c', area:true }, { key:'raw', label:'Medição', color:'#8f86c9' }, { key:'faucet', label:'Torneira', color:'#4fc9a4' }], { ref:1 })}
      <h4 class="sub-title">Ouro guardado por jogador × reserva saudável</h4>
      ${lineChart(hist, [{ key:'perPlayer', label:'Ouro guardado (mediana)', color:'#e8b64c', area:true }, { key:'target', label:'Reserva saudável', color:'#4fc9a4' }], { fmt:v => compact(v), h:180 })}
      <div class="panel arena-rules"><b>Como o Banco calcula</b><ul>
        <li>Para cada jogador ativo, a <b>reserva saudável</b> é 6 horas da própria renda (ouro ganho ÷ horas jogadas). A razão é o ouro no bolso ÷ essa reserva.</li>
        <li>O <b>índice</b> é a mediana dessas razões: um jogador muito rico não distorce a economia de todos. Ele é suavizado (70% anterior + 30% nova medição) para não dar trancos.</li>
        <li>Acima de 1,00 (inflação): a torneira fecha até 3% por medição (mínimo 60%), NPCs e obras sobem até ×1,6 e o imposto até 12%. Abaixo: tudo afrouxa até 115%.</li>
        <li>Sumidouros permanentes: impostos e taxas de anúncio, refino (que pode quebrar itens), construções, treino, culinária e evolução de qualidade.</li></ul></div>`;
  };

  P.bankQuotes = function(eco) {
    const mats = Object.values(I.materials).filter(m => m.tradeable).map(m => {
      const k = `m:${m.id}`, q = quote(eco.prices?.[k], eco.asks?.[k], eco.bids?.[k], this.bankEstimate('mat', m.id));
      return `<div class="bank-quote ${q.cls}"><b>${esc(m.name)}</b><em>${U.fmt(Math.round(q.v))}</em><small>${q.src}</small></div>`; }).join('');
    const rar = ['rare', 'epic', 'legendary', 'mythic', 'set'].map(r => {
      const sold = eco.rarity?.[r] && typeof eco.rarity[r] === 'object' ? eco.rarity[r] : eco.rarity?.[r] ? { median:eco.rarity[r], n:'?' } : null;
      const q = quote(sold, eco.rarityAsk?.[r], null, this.bankEstimate('item', r));
      return `<div class="bank-quote ${q.cls}"><b class="rtext rarity-${r}">${esc(KT.Data.rarities.find(x => x.id === r)?.label || r)}</b><em>${U.fmt(Math.round(q.v))}</em><small>${q.src}</small></div>`; }).join('');
    const top = Object.entries(eco.prices || {}).filter(([k]) => !k.startsWith('m:')).slice(0, 12).map(([k, p]) => `<div class="order-row"><b>${esc(k.replace(/^[a-z]:/, '').replace(/_/g, ' '))}</b><span><b class="price"><span class="coin-ic" aria-hidden="true"></span> ${U.fmt(p.median)}</b></span><small>${p.n} venda(s)</small></div>`).join('');
    return `<p class="note">Cotação em ouro por unidade. Ordem de confiança: <b>vendas reais</b> → menor anúncio → maior ordem de compra → <b>estimativa</b> do Banco pelo custo de produção (nível da sua melhor caçada).</p>
      <div class="guild-grid"><div><h4 class="sub-title">Materiais raros</h4><div class="bank-quotes">${mats}</div></div><div><h4 class="sub-title">Equipamentos por raridade</h4><div class="bank-quotes">${rar}</div></div></div>
      <h4 class="sub-title">Mais negociados (7 dias)</h4><div class="order-list">${top || '<p class="empty-note">Nenhum item ou carta vendido nos últimos 7 dias. Anuncie no Mercado de Jogadores (Loja) para abrir as cotações.</p>'}</div>
      <button class="action" data-go="shop:p2p" type="button">Ir ao Mercado de Jogadores →</button>`;
  };
  // Compatibilidade: telas antigas chamavam o painel da economia.
  P.econPanel = function() { return this.bankPanel(null, 'overview'); };

  // Ordens de compra: quem quer comprar reserva o ouro; quem tem o material vende na hora.
  P.ordersHtml = function() {
    const s = this.state, list = this.ordersList;
    if (!list && !this.ordersLoading) { this.ordersLoading = true; M().orders().then(o => { this.ordersList = o; this.ordersLoading = false; if (this.view.tab === 'p2p') this.refreshPanel(); }); }
    const goods = [...[...Object.keys(I.materials), ...KT.Data.PROF_MATS.map(m => m.id)].map(id => I.matInfo(id)).filter(Boolean).map(m => ({ v:`mat:${m.id}`, n:m.name })), ...I.cards.map(c => ({ v:`card:${c.id}`, n:c.name }))];
    const have = o => o.kind === 'card' ? (s.cards[o.payload?.id] || 0) : (I.matInfo(o.payload?.id)?.have(s) || 0);
    const rows = (list || []).map(o => { const h = have(o); return `<div class="order-row ${o.mine ? 'mine' : ''}"><b>${esc(o.name)}</b><span>${U.fmt(o.qtyLeft)}/${U.fmt(o.qty)} × <b class="price"><span class="coin-ic" aria-hidden="true"></span> ${U.fmt(o.price)}</b></span><small>${o.mine ? 'sua ordem' : `por ${esc(o.buyer)} · você tem ${U.fmt(h)}`}</small>
      ${o.mine ? `<button class="action small" data-order-cancel="${o.id}" type="button">Cancelar</button>` : `<button class="action small ${h ? 'primary' : ''}" data-order-fill="${o.id}" type="button" ${h ? '' : 'disabled'}>Vender</button>`}</div>`; }).join('');
    return `<section class="orders-box"><h4 class="sub-title">Ordens de compra</h4>
      <p class="dim small-note">Materiais e cartas. O ouro da ordem fica reservado no banco; quem vende recebe na hora (menos o imposto de ${((M().econ?.taxBps || 500) / 100).toFixed(1)}%). Cancelar devolve o que sobrou.</p>
      <div class="card-sell"><select id="ord-goods">${goods.map(g => `<option value="${g.v}">${esc(g.n)}</option>`).join('')}</select><input id="ord-qty" type="number" min="1" max="9999" placeholder="Quantidade"><input id="ord-price" type="number" min="100" placeholder="Preço por unidade"><button class="action" data-order-place type="button">Criar ordem</button></div>
      <div class="order-list">${rows || '<p class="empty-note">Nenhuma ordem aberta.</p>'}</div></section>`;
  };

  // ---------------------------------------------------------------------------
  // PROFISSÕES (Cidade → Profissões)
  // ---------------------------------------------------------------------------
  const D = KT.Data;
  P.profMatsGrid = function() {
    const s = this.state;
    return `<div class="mat-grid">${D.PROF_MATS.map(m => `<article class="mat-card" style="--mc:${m.color}"><b>${esc(m.name)}</b><em>${U.fmt(s.prof?.mats?.[m.id] || 0)}</em><small>${esc(D.PROF.gather[m.prof].icon)} ${esc(D.PROF.gather[m.prof].name)}${m.rare ? ' · raro' : ` · nível ${m.tier}`}</small></article>`).join('')}</div>`;
  };
  P.profHtml = function() {
    const s = this.state, e = this.engine, pr = s.prof;
    const bar = (id, def) => { const lv = pr.lv[id] || 1, need = D.PROF.next(lv), xp = pr.xp[id] || 0;
      return `<article class="prof-card" style="--pc:${def.color}"><span class="prof-ico">${KT.glyph(def.icon)}</span><div><b>${esc(def.name)} · Nv ${lv}</b><small>${esc(def.text)}</small><div class="meter"><span style="width:${lv >= D.PROF.maxLevel ? 100 : Math.min(100, xp / need * 100)}%"></span></div><small class="dim">${lv >= D.PROF.maxLevel ? 'Mestre' : `${U.fmt(xp)}/${U.fmt(need)} EXP`}</small></div></article>`; };
    const slotSel = `<select id="prof-slot">${Object.entries(I.slots).map(([k, sl]) => `<option value="${k}">${esc(sl.name)}</option>`).join('')}</select>`;
    const matName = k => k === 'gold' ? 'ouro' : (D.PROF_MATS.find(m => m.id === k)?.name || k);
    const recipes = D.PROF_RECIPES.map(r => {
      const cost = { ...r.cost, gold:Math.round((r.cost.gold || 0) * e.priceMult()) }, lvOk = (pr.lv[r.prof] || 1) >= r.lv, can = lvOk && Object.entries(cost).every(([k, v]) => e.profHave(k) >= v);
      return `<div class="craft-row ${lvOk ? '' : 'locked'}"><div><b>${KT.glyph(D.PROF.craft[r.prof].icon)} ${esc(r.name)}</b><small>${Object.entries(cost).map(([k, v]) => `<span class="${e.profHave(k) >= v ? 'cost-ok' : 'cost-bad'}">${U.fmt(v)} ${esc(matName(k))}</span>`).join(' · ')}${lvOk ? '' : ` · requer ${esc(D.PROF.craft[r.prof].name)} ${r.lv}`}</small>
        ${r.gear ? `<small class="dim">Item nível ${D.PROF.tierIlvl[r.gear] + Math.floor((pr.lv.smithing || 1) / 5)}${r.masterwork ? ', épico ou lendário garantido' : ''}. Negociável e assinado com seu nome.</small>` : ''}</div>
        <button class="action ${can ? 'primary' : ''}" data-prof-craft="${r.id}" type="button" ${can ? '' : 'disabled'}>Criar</button></div>`; }).join('');
    return `<section class="house-hero"><div><span class="eyebrow">OFÍCIOS DE TSUKIMORI</span><h3>Profissões</h3><p>Entre as ondas de caçadas e salas de masmorra, sua equipe coleta minérios, ervas e essências do capítulo em que está (mais nível = mais coleta e mais achados raros). Com eles a Alquimia prepara frascos de batalha e a Artesania forja equipamentos que você pode usar ou <b>vender no Mercado</b>.</p></div></section>
      <h4 class="sub-title">Coleta</h4><div class="prof-grid">${Object.entries(D.PROF.gather).map(([id, d]) => bar(id, d)).join('')}</div>
      <h4 class="sub-title">Criação</h4><div class="prof-grid">${Object.entries(D.PROF.craft).map(([id, d]) => bar(id, d)).join('')}</div>
      <h4 class="sub-title">Receitas</h4><div class="card-sell"><span class="dim">Espaço para equipamentos de Artesania:</span>${slotSel}</div><div class="recipe-grid">${recipes}</div>
      <h4 class="sub-title">Materiais de coleta</h4>${this.profMatsGrid()}`;
  };

  const baseSocial = P.socialAction;
  P.socialAction = function(b) {
    const d = b.dataset, val = id => this.el.modalBody.querySelector(id)?.value;
    const done = (r, okMsg) => { if (!r.ok) this.toast(esc(r.error || 'Falhou.')); else this.toast(okMsg, 'gold'); this.ordersList = null; this.renderResources(); this.loadMarket(true); this.refreshPanel(); };
    if (b.hasAttribute('data-order-place')) {
      const [kind, id] = String(val('#ord-goods') || '').split(':'), qty = val('#ord-qty'), price = val('#ord-price'), total = Math.floor(qty) * Math.floor(price);
      this.ask('Criar ordem de compra', `Reservar <b>${U.fmt(total || 0)} de ouro</b> para comprar ${U.fmt(qty || 0)} × a ${U.fmt(price || 0)} cada?`, [{ id:'yes', label:'Criar ordem', primary:true }, { id:'no', label:'Cancelar' }])
        .then(x => { if (x === 'yes') M().placeOrder(this.engine, { kind, id, qty, price }).then(r => done(r, 'Ordem criada: o ouro está reservado.')); });
      return true;
    }
    if (d.orderFill) {
      const o = (this.ordersList || []).find(x => x.id === Number(d.orderFill)); if (!o) return true;
      const have = o.kind === 'card' ? (this.state.cards[o.payload?.id] || 0) : (I.matInfo(o.payload?.id)?.have(this.state) || 0), max = Math.min(have, o.qtyLeft, o.kind === 'card' ? 1 : 9999);
      this.ask('Vender para a ordem', `Vender <b>${U.fmt(max)} × ${esc(o.name)}</b> por ${U.fmt(o.price)} cada (${U.fmt(max * o.price)} antes do imposto)?`, [{ id:'yes', label:'Vender', primary:true }, { id:'no', label:'Cancelar' }])
        .then(x => { if (x === 'yes') M().fillOrder(this.engine, o, max).then(r => done(r, 'Venda concluída: o ouro já está na sua bolsa.')); });
      return true;
    }
    if (d.profCraft) {
      const slot = this.el.modalBody.querySelector('#prof-slot')?.value;
      Promise.resolve(this.cmd('craftProf', d.profCraft, slot)).then(r => { if (r) { this.toast(`Criado: <b>${esc(r.name)}</b>.`, 'gold'); this.callbacks.reward?.(); } this.renderResources(); this.refreshPanel(); });
      return true;
    }
    if (d.orderCancel) { M().cancelOrder(this.engine, Number(d.orderCancel)).then(r => done(r, 'Ordem cancelada: ouro devolvido.')); return true; }
    return baseSocial ? baseSocial.call(this, b) : false;
  };
})();
