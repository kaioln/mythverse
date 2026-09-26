'use strict';
// Provedores de pagamento para depósitos de Gemas (Pix).
//  • mercadopago: Pix real via API do Mercado Pago (MP_ACCESS_TOKEN + MP_WEBHOOK_SECRET).
//  • dev: credita na hora; só para desenvolvimento e testes (bloqueado com NODE_ENV=production).
// O webhook nunca é confiado sozinho: a assinatura é verificada e o pagamento é consultado de novo na API
// do provedor antes de creditar qualquer valor.
const crypto = require('node:crypto');

function safeEqualHex(a, b) {
  try { const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex'); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); } catch (_) { return false; }
}

function mercadoPago({ accessToken, webhookSecret, publicOrigin, fetchImpl = globalThis.fetch }) {
  const api = async (method, path, body, idem) => {
    const res = await fetchImpl(`https://api.mercadopago.com${path}`, { method, headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json', ...(idem ? { 'X-Idempotency-Key':idem } : {}) }, body:body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || `Mercado Pago ${res.status}`), { status:502 });
    return data;
  };
  return {
    name:'mercadopago', enabled:!!(accessToken && webhookSecret),
    async createPix({ depositId, amount, email }) {
      const p = await api('POST', '/v1/payments', { transaction_amount:amount / 100, description:'Gemas: Mythverse', payment_method_id:'pix', external_reference:String(depositId), payer:{ email }, ...(publicOrigin ? { notification_url:`${publicOrigin}/api/payments/webhook` } : {}) }, `mv-dep-${depositId}`);
      return { ref:String(p.id), pixCopyPaste:p.point_of_interaction?.transaction_data?.qr_code || null, checkoutUrl:p.point_of_interaction?.transaction_data?.ticket_url || null };
    },
    // Assinatura: x-signature "ts=…,v1=…" sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
    verifyWebhook(req, url) {
      const sig = String(req.headers['x-signature'] || ''), reqId = String(req.headers['x-request-id'] || '');
      const parts = Object.fromEntries(sig.split(',').map(x => x.trim().split('=')).filter(x => x.length === 2));
      const dataId = url.searchParams.get('data.id') || url.searchParams.get('id');
      if (!parts.ts || !parts.v1 || !dataId || !webhookSecret) return null;
      if (Math.abs(Date.now() - Number(parts.ts) * (String(parts.ts).length <= 10 ? 1000 : 1)) > 15 * 60_000) return null;
      const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
      const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
      return safeEqualHex(expected, parts.v1) ? String(dataId) : null;
    },
    async fetchPayment(id) {
      const p = await api('GET', `/v1/payments/${encodeURIComponent(id)}`);
      return { ref:String(p.id), approved:p.status === 'approved', amount:Math.round(Number(p.transaction_amount) * 100), depositId:Number(p.external_reference) };
    }
  };
}

function devProvider() {
  return { name:'dev', enabled:true, instant:true, async createPix() { return { ref:`dev-${crypto.randomUUID()}` }; }, verifyWebhook() { return null; }, async fetchPayment() { return null; } };
}

function createProvider(cfg) {
  if (cfg.paymentProvider) return cfg.paymentProvider; // injeção (testes)
  const kind = cfg.paymentKind;
  if (kind === 'mercadopago') return mercadoPago({ accessToken:cfg.mpAccessToken, webhookSecret:cfg.mpWebhookSecret, publicOrigin:cfg.publicOrigin });
  if (kind === 'dev' && !cfg.production) return devProvider();
  return { name:'none', enabled:false };
}

module.exports = { createProvider, mercadoPago, devProvider, safeEqualHex };
