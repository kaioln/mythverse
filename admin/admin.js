'use strict';
// Painel econômico do administrador: lê /api/admin/economy e /api/admin/withdrawals com o cabeçalho X-Admin-Token.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('pt-BR');
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const when = t => new Date(Number(t)).toLocaleString('pt-BR');
  let token = '';
  try { token = sessionStorage.getItem('mv-admin') || ''; } catch (_) { token = ''; }

  async function api(method, path, body) {
    const res = await fetch(path, { method, headers:{ 'X-Admin-Token':token, 'X-MV-Request':'1', ...(body ? { 'Content-Type':'application/json' } : {}) }, body:body ? JSON.stringify(body) : undefined, credentials:'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  }
  const kpi = (label, value, note = '') => `<div class="kpi"><small>${esc(label)}</small><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
  const table = (head, rows) => `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Nada por aqui.</td></tr>`}</tbody>`;
  const FLAG = { same_network:'Mesma rede (bloqueada)', price_outlier:'Preço fora da curva', pair_trading:'Par negociando demais (Gemas)', pair_trading_gold:'Par negociando demais (ouro)' };

  async function load() {
    $('status').textContent = 'Carregando…'; $('status').className = 'muted';
    try {
      const [e, w] = await Promise.all([api('GET', '/api/admin/economy'), api('GET', '/api/admin/withdrawals')]);
      $('app').hidden = false; $('status').textContent = 'Conectado'; $('status').className = 'ok'; $('when').textContent = `Atualizado em ${when(e.at)}`;
      $('gold').innerHTML = kpi('Ouro total em circulação', fmt(e.gold.total)) + kpi('Contas com save', fmt(e.gold.saves)) + kpi('Média por conta', fmt(e.gold.avg)) + kpi('Maior estoque', fmt(e.gold.max));
      $('gems').innerHTML = kpi('Saldo dos jogadores', brl(e.gems.balance), `${fmt(e.gems.balance)} Gemas`) + kpi('Reservado em saques', brl(e.gems.held)) + kpi('Depósitos (7 dias)', brl(e.gems.deposits7d.total), `${fmt(e.gems.deposits7d.n)} pagamentos`) + kpi('Saques pagos (7 dias)', brl(e.gems.withdrawals7d.total), `${fmt(e.gems.withdrawals7d.n)} saques`) + kpi('Taxas da casa (7 dias)', brl(e.gems.fees7d), `Total: ${brl(e.gems.houseTotal)}`);
      const vol = cur => e.market.volume.find(v => v.currency === cur) || { n7d:0, total7d:0, n24h:0, total24h:0 }, open = cur => (e.market.open.find(o => o.currency === cur) || { n:0 }).n;
      const g = vol('gold'), m = vol('gems');
      $('market').innerHTML = kpi('Vendas em ouro (24h / 7d)', `${fmt(g.n24h)} / ${fmt(g.n7d)}`, `${fmt(g.total7d)} ouro em 7 dias · imposto ${e.config.goldTaxBps / 100}%`) + kpi('Vendas em Gemas (24h / 7d)', `${fmt(m.n24h)} / ${fmt(m.n7d)}`, `${brl(m.total7d)} em 7 dias`) + kpi('Anúncios abertos', `${fmt(open('gold'))} ouro · ${fmt(open('gems'))} Gemas`) + kpi('Retenção antes do saque', `${e.config.holdHours ?? 72} h`);
      $('top').innerHTML = table(['Item', 'Moeda', 'Vendas', 'Menor preço', 'Maior preço'], e.market.top.map(t => `<tr><td>${esc(t.name)}</td><td>${t.currency === 'gold' ? 'Ouro' : 'Gemas'}</td><td>${fmt(t.n)}</td><td>${fmt(t.lo)}</td><td>${fmt(t.hi)}</td></tr>`));
      $('rich').innerHTML = table(['Jogador', 'Ouro', 'Poder'], e.gold.richest.map(r => `<tr><td>${esc(r.name)}</td><td>${fmt(r.gold)}</td><td>${fmt(r.power)}</td></tr>`));
      $('flags').innerHTML = table(['Quando', 'Tipo', 'Conta', 'Outra conta', 'Detalhe'], e.flags.map(f => `<tr><td>${when(f.at)}</td><td><span class="tag">${esc(FLAG[f.kind] || f.kind)}</span></td><td>${esc(f.user_name || f.user_id || '')}</td><td>${esc(f.other_name || f.other_id || '')}</td><td>${esc(f.detail)}</td></tr>`));
      $('withdrawals').innerHTML = table(['Pedido', 'Conta', 'Valor', 'Taxa', 'Chave Pix', 'Ação'], w.pending.map(x => `<tr><td>#${x.id}<br><small class="muted">${when(x.created_at)}</small></td><td>${esc(x.username || x.user_id)}</td><td>${brl(x.amount)}</td><td>${brl(x.fee)}</td><td>${esc(x.pix_key)}</td><td><button class="primary" data-pay="${x.id}" type="button">Marcar pago</button> <button class="danger" data-reject="${x.id}" type="button">Recusar</button></td></tr>`));
    } catch (err) { $('app').hidden = true; $('status').textContent = err.message; $('status').className = 'err'; }
  }

  $('login').addEventListener('submit', ev => { ev.preventDefault(); token = $('token').value.trim(); try { sessionStorage.setItem('mv-admin', token); } catch (_) { /* aba privada */ } $('token').value = ''; load(); });
  $('logout').addEventListener('click', () => { token = ''; try { sessionStorage.removeItem('mv-admin'); } catch (_) { /* aba privada */ } $('app').hidden = true; $('status').textContent = 'Saiu.'; });
  $('refresh').addEventListener('click', load);
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-pay],[data-reject]'); if (!b) return;
    const id = Number(b.dataset.pay || b.dataset.reject), action = b.dataset.pay ? 'paid' : 'rejected';
    const note = action === 'rejected' ? (prompt('Motivo da recusa (aparece para o jogador):') || '') : '';
    if (action === 'paid' && !confirm(`Confirma que o Pix do saque #${id} já foi enviado?`)) return;
    b.disabled = true;
    try { await api('POST', '/api/admin/withdrawals/decide', { id, action, note }); await load(); } catch (err) { alert(err.message); b.disabled = false; }
  });
  if (token) load();
})();
