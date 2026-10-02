(() => {
  const KT = globalThis.KT = globalThis.KT || {};

  // Gerador de números aleatórios. Fora de uma luta usa Math.random; dentro de uma luta o motor
  // instala um gerador com semente (mulberry32), para que o servidor reproduza exatamente o mesmo
  // combate a partir da mesma semente e dos mesmos comandos do jogador.
  const Rng = {
    cur:null,
    next() { return Rng.cur ? Rng.cur() : Math.random(); },
    seeded(seed) {
      let a = (Number(seed) >>> 0) || 0x9e3779b9;
      const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      return f;
    },
    // Executa fn com o gerador indicado (null = aleatório comum) e restaura o anterior.
    with(rng, fn) { const prev = Rng.cur; Rng.cur = rng; try { return fn(); } finally { Rng.cur = prev; } },
    hash(str) { let h = 2166136261 >>> 0; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
  };
  const B36 = n => Math.floor(n).toString(36);

  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    random: () => Rng.next(),
    rand: (a, b) => a + Rng.next() * (b - a),
    randInt: (a, b) => Math.floor(a + Rng.next() * (b - a + 1)),
    pick: arr => arr[Math.floor(Rng.next() * arr.length)],
    uid: (p = 'id') => Rng.cur ? `${p}_${B36(Rng.next() * 2821109907456)}${B36(Rng.next() * 2821109907456)}` : `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    deep: value => JSON.parse(JSON.stringify(value)),
    fmt: n => Math.round(n).toLocaleString('pt-BR'),
    // Plural certo no texto que o jogador lê: nunca "ponto(s)".
    plural: (n, one, many) => n === 1 ? one : (many || one + 's'),
    count: (n, one, many) => `${Math.round(n).toLocaleString('pt-BR')} ${n === 1 ? one : (many || one + 's')}`,
    // Modelos de texto: "{n}" vira o número; "{n|andar|andares}" vira número e palavra no plural certo.
    fill: (text, n) => String(text).replace(/\{n(?:\|([^|}]+)\|([^}]+))?\}/g, (_, one, many) => one ? U.count(n, one, many) : U.fmt(n)),
    weighted(items, getWeight) {
      const total = items.reduce((s, item) => s + Math.max(0, getWeight(item)), 0);
      if (total <= 0) return items[0];
      let r = Rng.next() * total;
      for (const item of items) {
        r -= Math.max(0, getWeight(item));
        if (r <= 0) return item;
      }
      return items[items.length - 1];
    },
    safeStorage: {
      get(key) { try { return globalThis.localStorage ? localStorage.getItem(key) : null; } catch (_) { return null; } },
      set(key, value) { try { if (!globalThis.localStorage) return false; localStorage.setItem(key, value); return localStorage.getItem(key) === value; } catch (_) { return false; } },
      remove(key) { try { if (globalThis.localStorage) localStorage.removeItem(key); } catch (_) {} }
    }
  };
  KT.Utils = U;
  KT.Rng = Rng;
  // Relógio do jogo: sincronizado com o servidor quando online (offset em ms), para que
  // eventos, missões diárias e o Mercado sigam a mesma data e hora para todos.
  KT.Clock = KT.Clock || { offset:0, now() { return Date.now() + this.offset; }, sync(serverMs) { if (Number.isFinite(serverMs)) this.offset = serverMs - Date.now(); } };
})();
