(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    uid: (p = 'id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    deep: value => JSON.parse(JSON.stringify(value)),
    fmt: n => Math.round(n).toLocaleString('pt-BR'),
    weighted(items, getWeight) {
      const total = items.reduce((s, item) => s + Math.max(0, getWeight(item)), 0);
      if (total <= 0) return items[0];
      let r = Math.random() * total;
      for (const item of items) {
        r -= Math.max(0, getWeight(item));
        if (r <= 0) return item;
      }
      return items[items.length - 1];
    },
    safeStorage: {
      get(key) { try { return globalThis.localStorage ? localStorage.getItem(key) : null; } catch (_) { return null; } },
      set(key, value) { try { if (globalThis.localStorage) localStorage.setItem(key, value); return true; } catch (_) { return false; } },
      remove(key) { try { if (globalThis.localStorage) localStorage.removeItem(key); } catch (_) {} }
    }
  };
  KT.Utils = U;
})();
