// Economia viva: painel do Banco Central da Fenda e ordens de compra do Mercado de Jogadores.
(() => {
  const KT = globalThis.KT;
  const U = KT.Utils, I = KT.Items, P = KT.UIController.prototype;
  const { esc, compact } = KT.UIController.helpers;
  const M = () => KT.NeonMarket;
  const pct = v => `${(Number(v) * 100).toFixed(0)}%`;

  // Gráfico de linha simples em SVG (índice de inflação e torneira de ouro).
  const spark = (pts, key, color, lo, hi) => {
    if (!pts?.length) return '';
    const W = 560, H = 120, xs = i => pts.length === 1 ? W / 2 : i / (pts.length - 1) * W, ys = v => H - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * H;
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(Number(p[key])).toFixed(1)}`).join(' ');
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
  };
  const verdict = ix => ix > 1.5 ? ['Inflação alta', 'hot', 'O Banco Central está fechando a torneira de ouro e encarecendo NPCs e impostos.'] : ix > 1.1 ? ['Inflação moderada', 'warm', 'Ajustes leves em andamento para segurar os preços.'] : ix < .6 ? ['Ouro escasso', 'cold', 'A torneira está aberta: vale a pena caçar, vender e produzir.'] : ['Economia estável', 'ok', 'Ouro em circulação perto da meta para o nível médio dos jogadores.'];

  P.econPanel = function() {
    if (this.session?.mode !== 'neon') return this.cloudOnly('Economia da Fenda');
    const eco = M().econ;
    if (!eco && !this.econLoading) { this.econLoading = true; M().economy(this.engine).then(() => { this.econLoading = false; if (this.view.tab === 'econ') this.refreshPanel(); }); }
    if (!eco) return '<div class="empty-state"><p>Consultando o Banco Central da Fenda…</p></div>';
    const v = verdict(Number(eco.index)), hist = eco.history || [];
    const mats = Object.values(I.materials).filter(m => m.tradeable).map(m => { const p = eco.prices?.[`m:${m.id}`]; return `<div class="eco-price"><b>${esc(m.name)}</b><em>${p ? `${U.fmt(p.median)}` : '–'}</em><small>${p ? `${p.n} venda(s) na semana` : 'sem vendas recentes'}</small></div>`; }).join('');
    const rar = ['rare', 'epic', 'legendary', 'mythic', 'set'].map(r => `<div class="eco-price"><b class="rtext rarity-${r}">${esc(KT.Data.rarities.find(x => x.id === r)?.label || r)}</b><em>${eco.rarity?.[r] ? U.fmt(eco.rarity[r]) : '–'}</em><small>mediana de itens</small></div>`).join('');
    return `<section class="eco-hero ${v[1]}"><div><span class="eyebrow">BANCO CENTRAL DA FENDA</span><h3>${v[0]}</h3><p>${v[2]}</p></div>
        <div class="eco-gauge"><b>${Number(eco.index).toFixed(2)}</b><small>índice (1,00 = meta)</small></div></section>
      <div class="eco-kpis">
        <span><b>${pct(eco.faucet)}</b>Torneira de ouro<small>quanto as caçadas e recompensas pagam</small></span>
        <span><b>×${Number(eco.price).toFixed(2)}</b>Preços de NPC<small>loja e construções</small></span>
        <span><b>${(eco.taxBps / 100).toFixed(1)}%</b>Imposto do mercado<small>sai de circulação</small></span>
        <span><b>${compact(eco.perPlayer)}</b>Ouro por jogador<small>meta ${compact(eco.target)} · nível médio ${eco.avgLevel}</small></span>
        <span><b>${compact(eco.volume24)}</b>Volume 24 h<small>${eco.trades24} negócio(s) · ${eco.listings} anúncios · ${eco.orders} ordens</small></span>
        <span><b>${eco.growth24 === null || eco.growth24 === undefined ? '–' : `${eco.growth24 > 0 ? '+' : ''}${eco.growth24}%`}</b>Variação 24 h<small>ouro por jogador</small></span>
      </div>
      <h4 class="sub-title">Histórico</h4><div class="eco-chart"><svg viewBox="0 0 560 120" preserveAspectRatio="none"><line x1="0" x2="560" y1="60" y2="60" class="eco-mid"/>${spark(hist, 'index', '#ff7eb6', 0, 2)}${spark(hist, 'faucet', '#6fd8b8', 0, 2)}</svg><div class="eco-legend"><span class="l-index">Índice de inflação</span><span class="l-faucet">Torneira de ouro</span><small>linha do meio = 1,00</small></div></div>
      <div class="guild-grid"><div><h4 class="sub-title">Preço de referência (unidade)</h4><div class="eco-prices">${mats}</div></div><div><h4 class="sub-title">Itens por raridade</h4><div class="eco-prices">${rar}</div></div></div>
      <div class="panel arena-rules"><b>Como a economia se regula</b><ul>
        <li>A cada 20 minutos o Banco Central mede o ouro em circulação (bolsos, cofres de guilda, correio e ordens) por jogador ativo e compara com a meta para o nível médio da comunidade.</li>
        <li>Acima da meta (inflação): a torneira de ouro fecha aos poucos (até 60%), preços de NPC e obras sobem (até ×1,6) e o imposto do mercado sobe (até 12%). Abaixo: tudo afrouxa. O ajuste é gradual, no máximo 3% por medição.</li>
        <li>Sumidouros permanentes: impostos e taxas de anúncio, refino (que pode quebrar itens), construções, treino, culinária e Despertar.</li>
        <li>Mercado protegido: um anúncio só é vendido uma vez; preço acima de 15× a mediana é recusado; no máximo 5 compras por dia do mesmo vendedor; anúncios expiram em 7 dias.</li></ul></div>`;
  };

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
      return `<article class="prof-card" style="--pc:${def.color}"><span class="prof-ico">${def.icon}</span><div><b>${esc(def.name)} · Nv ${lv}</b><small>${esc(def.text)}</small><div class="meter"><span style="width:${lv >= D.PROF.maxLevel ? 100 : Math.min(100, xp / need * 100)}%"></span></div><small class="dim">${lv >= D.PROF.maxLevel ? 'Mestre' : `${U.fmt(xp)}/${U.fmt(need)} EXP`}</small></div></article>`; };
    const slotSel = `<select id="prof-slot">${Object.entries(I.slots).map(([k, sl]) => `<option value="${k}">${esc(sl.name)}</option>`).join('')}</select>`;
    const matName = k => k === 'gold' ? 'ouro' : (D.PROF_MATS.find(m => m.id === k)?.name || k);
    const recipes = D.PROF_RECIPES.map(r => {
      const cost = { ...r.cost, gold:Math.round((r.cost.gold || 0) * e.priceMult()) }, lvOk = (pr.lv[r.prof] || 1) >= r.lv, can = lvOk && Object.entries(cost).every(([k, v]) => e.profHave(k) >= v);
      return `<div class="craft-row ${lvOk ? '' : 'locked'}"><div><b>${D.PROF.craft[r.prof].icon} ${esc(r.name)}</b><small>${Object.entries(cost).map(([k, v]) => `<span class="${e.profHave(k) >= v ? 'cost-ok' : 'cost-bad'}">${U.fmt(v)} ${esc(matName(k))}</span>`).join(' · ')}${lvOk ? '' : ` · requer ${esc(D.PROF.craft[r.prof].name)} ${r.lv}`}</small>
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
