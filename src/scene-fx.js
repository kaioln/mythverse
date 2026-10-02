// Pintura viva. O cenário é uma pintura parada; este passe de vídeo (WebGL) a redesenha movendo a própria arte, só
// onde a máscara do cenário manda (assets/scenes/masks/<cenário>.png, de tools/build_scene_masks.py):
//   água: ondula e ganha brilho de crista · árvores: as copas balançam com o vento, em rajadas que atravessam a tela
//   ar: a fumaça pintada tremula · céu: nuvens novas passam só onde é céu (atrás de prédios e montanhas)
//   cachoeiras: a água desce em fios claros
// A máscara é uma imagem RGB com duas metades lado a lado (esquerda: água, árvores, ar · direita: céu, cachoeiras).
// Custa quase nada ao processador (um quadrado na tela, tudo na placa de vídeo), roda a 30 quadros por segundo e, sem
// WebGL, com a opção desligada ou com "reduzir movimento" no sistema, o jogo desenha a pintura parada como antes.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uScene, uMask, uNoise;
uniform float uTime, uWind, uAmt;
uniform vec3 uCloud;
varying vec2 v;
void main() {
  float mu = clamp(v.x, .003, .997) * .5;
  vec3 m = texture2D(uMask, vec2(mu, v.y)).rgb * uAmt;
  vec3 m2 = texture2D(uMask, vec2(mu + .5, v.y)).rgb * uAmt;      // r = céu, g = cachoeiras
  if (m.r + m.g + m.b + m2.r + m2.g < .012) { gl_FragColor = vec4(texture2D(uScene, v).rgb, 1.); return; }
  float t = uTime;
  vec2 uv = v;
  // cachoeiras: fios claros descendo, com a queda tremendo de leve
  float f1 = texture2D(uNoise, vec2(v.x * 22., v.y * 2.2 - t * .9)).r;
  float f2 = texture2D(uNoise, vec2(v.x * 41., v.y * 3.5 - t * 1.5)).g;
  uv.x += m2.g * (f1 - .5) * .0016;
  // água: duas ondas de ruído que se cruzam e uma ondulação fina por linha
  float n1 = texture2D(uNoise, v * vec2(3., 9.) + vec2(t * .021, t * .013)).r - .5;
  float n2 = texture2D(uNoise, v * vec2(7., 21.) - vec2(t * .034, -t * .009)).g - .5;
  uv.x += m.r * (n1 * .0042 + sin(v.y * 260. + t * 1.6 + n2 * 6.) * .0010);
  uv.y += m.r * n2 * .0034;
  // árvores: brisa. Cada galho vai e volta no seu tempo (a fase vem de um ruído parado no lugar), as folhas tremem por
  // cima e a copa cede de leve no alto, mais nas rajadas que atravessam a cena. Tronco e pé da copa ficam parados (a
  // máscara é zero ali). Medido com tools/dev/scenefx.html: ~1 px na brisa comum, ~3 px no vento mais forte. Mais que
  // isso a copa vira borracha e a distorção aparece.
  float gust = texture2D(uNoise, vec2(v.x * .7 - t * .03, v.y * .4 + t * .004)).b;
  float breeze = (.35 + .65 * gust) * uWind;
  float pb = texture2D(uNoise, v * vec2(3., 4.)).r * 6.283, pl = texture2D(uNoise, v * vec2(10., 12.) + .37).g * 6.283;
  float sway = sin(t * .9 + v.x * 5. + v.y * 3.);
  uv.x -= m.g * (sway * .0013 + sin(t * 1.7 + pb) * .0011 + sin(t * 3.1 + pl) * .0005) * breeze;
  uv.y += m.g * (sin(t * 1.4 + pb + 1.3) * .0008 + sin(t * 2.7 + pl) * .0005) * breeze;
  // fumaça e névoa pintadas: tremulam e pendem para o lado do vento
  float n3 = texture2D(uNoise, v * vec2(4., 6.) + vec2(t * .015, t * .05)).r - .5;
  float n4 = texture2D(uNoise, v * vec2(6., 4.) + vec2(-t * .01, t * .04)).g - .5;
  uv.x += m.b * (n3 * .0075 + .0016 * uWind);
  uv.y += m.b * n4 * .0065;
  vec3 col = texture2D(uScene, uv).rgb;
  // folhagem: a luz corre pelas copas em ondas, junto com as rajadas (as folhas viram e pegam a luz das lanternas)
  col *= 1. + m.g * (texture2D(uNoise, vec2(v.x * 2.6 - t * .09, v.y * 2.2 + t * .015)).r - .5) * .34 * breeze;
  // brilho de crista: faixas claras correndo sobre a água
  float crest = smoothstep(.60, .88, texture2D(uNoise, v * vec2(5., 26.) + vec2(t * .05, -t * .02)).b + n1 * .5);
  col += m.r * crest * vec3(.09, .12, .16);
  col += m2.g * smoothstep(.52, .84, f1 * .6 + f2 * .4) * vec3(.15, .19, .23);
  // nuvens passando no céu
  if (m2.r > .012) {
    float c1 = texture2D(uNoise, v * vec2(.9, 1.6) - vec2(t * .0065, 0.)).r;
    float c2 = texture2D(uNoise, v * vec2(2.3, 3.4) - vec2(t * .0125, t * .0012)).g;
    col = mix(col, uCloud, smoothstep(.50, .78, c1 * .68 + c2 * .32) * m2.r * .44);
  }
  gl_FragColor = vec4(col, 1.);
}`;
  // Ruído suave que se repete nas bordas (três canais independentes), para as texturas correrem sem emenda.
  function noiseTexture(size = 256) {
    const out = new Uint8Array(size * size * 4);
    for (let ch = 0; ch < 3; ch++) {
      const acc = new Float32Array(size * size);
      let amp = 1, total = 0;
      for (const cells of [4, 8, 16, 32]) {
        const g = new Float32Array(cells * cells).map(() => Math.random()), step = size / cells;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const fx = x / step, fy = y / step, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
          const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
          acc[y * size + x] += (a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy) * amp;
        }
        total += amp; amp *= .5;
      }
      for (let i = 0; i < acc.length; i++) out[i * 4 + ch] = Math.round(acc[i] / total * 255);
    }
    for (let i = 3; i < out.length; i += 4) out[i] = 255;
    return out;
  }
  const KEY = 'mythverse-scenefx';
  const store = { get() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (_) {} } };
  class Layer {
    constructor(scene, mask) {
      this.cv = document.createElement('canvas'); this.ok = false; this.last = -1; this.scene = scene;
      const gl = this.gl = this.cv.getContext('webgl', { alpha:false, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:true, powerPreference:'low-power' });
      if (!gl) return;
      this.cv.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ok = false; });
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
      try {
        const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'link');
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const tex = (unit, src, repeat) => {
          const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
          if (src instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        };
        tex(0, scene, false); tex(1, mask, false); tex(2, noiseTexture(), true);
        this.u = {}; ['uScene', 'uMask', 'uNoise', 'uTime', 'uWind', 'uAmt', 'uCloud'].forEach(n => { this.u[n] = gl.getUniformLocation(pr, n); });
        gl.uniform1i(this.u.uScene, 0); gl.uniform1i(this.u.uMask, 1); gl.uniform1i(this.u.uNoise, 2);
        this.ok = true;
      } catch (err) { console.warn('SceneFx:', err.message); this.ok = false; }
    }
    // Desenha o quadro do instante `time` (no máximo 30 vezes por segundo) e devolve a tela para o jogo copiar.
    render(time, w, h, cloud) {
      if (!this.ok) return null;
      const gl = this.gl;
      w = Math.max(64, Math.min(this.scene.naturalWidth || this.scene.width, Math.round(w))); h = Math.max(36, Math.min(this.scene.naturalHeight || this.scene.height, Math.round(h)));
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; gl.viewport(0, 0, w, h); this.last = -1; }
      if (this.last >= 0 && Math.abs(time - this.last) < 1 / 31) return this.cv;
      this.last = time;
      const t = time % 3600;
      gl.uniform1f(this.u.uTime, t); gl.uniform1f(this.u.uWind, SceneFx.wind(t)); gl.uniform1f(this.u.uAmt, 1);
      gl.uniform3f(this.u.uCloud, cloud[0], cloud[1], cloud[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return this.cv;
    }
  }
  const SceneFx = {
    layers: new Map(), masks: new Map(), spotsOf: new Map(),
    // Ligado por padrão; desliga com a opção das Configurações ou com "reduzir movimento" do sistema.
    enabled() { const v = store.get(); if (v) return v === 'on'; return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; },
    setEnabled(on) { store.set(on ? 'on' : 'off'); },
    // Vento do mundo (0,2 a 1,4): sobe e desce devagar. As copas, a fumaça, as nuvens e as pétalas seguem o mesmo vento.
    wind(t) { return Math.max(.2, .78 + .34 * Math.sin(t * .21) + .2 * Math.sin(t * .57 + 1.3) + .1 * Math.sin(t * 1.9)); },
    // A pintura viva do cenário `key`, pronta para drawImage, ou null (ainda carregando, sem máscara, sem WebGL ou desligada).
    frame(key, scene, time, w, h, cloud = [.56, .6, .8]) {
      if (!scene?.complete || !this.enabled()) return null;
      let L = this.layers.get(key);
      if (L === undefined) {
        this.layers.set(key, L = null);
        const mask = new Image(); mask.decoding = 'async';
        mask.onload = () => { this.masks.set(key, mask); try { this.layers.set(key, new Layer(scene, mask)); } catch (_) { this.layers.set(key, false); } };
        mask.onerror = () => this.layers.set(key, false);
        mask.src = `assets/scenes/masks/${key}.png${KT.VERSION ? `?v=${KT.VERSION}` : ''}`;
      }
      return L ? L.render(time, w, h, cloud) : null;
    }
  };
  // Pontos de copa de um cenário: [x, y, cor] na cena 1280×720, lidos da máscara (onde a copa balança) e da própria
  // pintura (a cor da folhagem naquele ponto). O jogo solta dali as folhas e pétalas que o vento leva.
  SceneFx.treeSpots = function(key, scene) {
    const got = this.spotsOf.get(key); if (got !== undefined) return got;
    const mask = this.masks.get(key); if (!mask || !scene?.complete || !this.enabled()) return null;
    let out = [];
    try {
      const w = 320, h = 180, cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently:true });
      g.drawImage(mask, 0, 0, mask.naturalWidth / 2, mask.naturalHeight, 0, 0, w, h); g.drawImage(scene, w, 0, w, h);
      const m = g.getImageData(0, 0, w, h).data, c = g.getImageData(w, 0, w, h).data;
      for (let y = 1; y < h; y += 2) for (let x = 1; x < w; x += 2) {
        const i = (y * w + x) * 4; if (m[i + 1] < 150) continue;
        const r = c[i], gg = c[i + 1], b = c[i + 2]; if (r * .3 + gg * .59 + b * .11 < 46) continue;      // vão escuro da copa: não é folha
        const up = v => Math.round(Math.min(255, v * 1.12 + 26));
        out.push([x * 4 + 2, y * 4 + 2, `rgb(${up(r)},${up(gg)},${up(b)})`]);
      }
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      out = out.slice(0, 420);
    } catch (_) { out = []; }
    this.spotsOf.set(key, out); return out;
  };
  KT.SceneFx = SceneFx;
})();
