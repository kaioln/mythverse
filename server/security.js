'use strict';
// Senhas (scrypt), tokens de sessão, limites de requisição e validação de entrada.
const crypto = require('node:crypto');

const SCRYPT = { N:16384, r:8, p:1, keylen:64, maxmem:64 * 1024 * 1024 };

function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(secret).normalize('NFKC'), salt, SCRYPT.keylen, { N:SCRYPT.N, r:SCRYPT.r, p:SCRYPT.p, maxmem:SCRYPT.maxmem });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifySecret(secret, stored) {
  try {
    const [algo, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(keyB64, 'base64');
    const key = crypto.scryptSync(String(secret).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N:Number(N), r:Number(r), p:Number(p), maxmem:SCRYPT.maxmem });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch (_) { return false; }
}

// Hash fictício para gastar o mesmo tempo quando o usuário não existe (evita enumeração por tempo).
const DUMMY_HASH = hashSecret('mythverse-dummy-password');

const newToken = () => crypto.randomBytes(32).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const newRecoveryCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  const chars = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{4}/g).join('-');
};

// Limitador de requisições em memória (janela deslizante simples por chave).
class RateLimiter {
  constructor() { this.hits = new Map(); setInterval(() => this.sweep(), 60_000).unref(); }
  allow(key, limit, windowMs) {
    const now = Date.now(); const arr = (this.hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= limit) { this.hits.set(key, arr); return false; }
    arr.push(now); this.hits.set(key, arr); return true;
  }
  sweep() { const now = Date.now(); for (const [k, arr] of this.hits) { const keep = arr.filter(t => now - t < 3_600_000); if (keep.length) this.hits.set(k, keep); else this.hits.delete(k); } }
}

const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
function validateUsername(u) { u = String(u || '').normalize('NFKC').trim(); return USERNAME_RE.test(u) ? u : null; }
function validateEmail(e) { if (e === undefined || e === null || e === '') return ''; e = String(e).trim().toLowerCase(); return EMAIL_RE.test(e) && e.length <= 254 ? e : null; }
function passwordProblem(p, username = '') {
  p = String(p || '');
  if (p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (p.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  if (username && p.toLowerCase().includes(username.toLowerCase())) return 'A senha não pode conter o nome de usuário.';
  if (/^(12345678|password|senha123|qwerty12)/i.test(p)) return 'Essa senha é fácil demais de adivinhar.';
  return null;
}

module.exports = { hashSecret, verifySecret, DUMMY_HASH, newToken, sha256, newRecoveryCode, RateLimiter, validateUsername, validateEmail, passwordProblem };
