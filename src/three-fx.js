// Camada 3D (three.js, carregada sob demanda de vendor/three.min.js):
//  · KT.Map3D: o mapa do mundo vira um relevo inclinado com câmera; o "Ir →" de um objetivo voa até a região.
//  · KT.Atmos: atmosfera em profundidade sobre o palco (vaga-lumes, pétalas, neve, areia, brasas...), com parallax.
// Tudo é opcional: sem WebGL, com "reduzir movimento" ou com a opção desligada, o jogo segue com as imagens 2D.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  const U = KT.Utils;
  const PREF = 'mythverse-3d';
  let modP = null;
  const enabled = () => { try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false; return U.safeStorage.get(PREF) !== 'off'; } catch { return true; } };
  const webgl = (() => { let ok = null; return () => { if (ok !== null) return ok; try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { ok = false; } return ok; }; })();
  const load = () => (modP ||= import(new URL('vendor/three.min.js', document.baseURI).href).catch(err => { console.warn('three.js indisponível', err); modP = null; return null; }));
  KT.Three = { load, enabled, webgl, setEnabled(on) { U.safeStorage.set(PREF, on ? 'on' : 'off'); KT.Atmos?.refresh(); } };

  // Textura redonda e macia para partículas (gerada uma vez).
  const SOFT_FS = `uniform vec3 uColor; varying float vA; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; float a = smoothstep(.5, .0, d); gl_FragColor = vec4(uColor, a * a * vA); }`;

  // ---------------------------------------------------------------------------
  // MAPA 3D
  // ---------------------------------------------------------------------------
  const MW = 16, MH = 9;                    // tamanho do plano (mesma proporção da arte 16:9)
  const OVER = 15.2;                        // distância da câmera na visão geral (o mapa inteiro cabe)
  const bend = (x, y) => -.018 * x * x - .026 * y * y; // leve curvatura: o mundo "cai" nas bordas
  const Map3D = {
    T:null, r:null, scene:null, cam:null, mesh:null, lanterns:null, canvas:null, host:null, pins:[], raf:0,
    look:{ x:0, y:0, dist:OVER }, want:{ x:0, y:0, dist:OVER }, drag:null, focusId:null, t0:0, lastT:0,
    // Prepara renderizador e textura antes do jogador abrir o mapa (o painel abre instantâneo).
    async prewarm() { if (this.r || !enabled() || !webgl()) return; const T = this.T || await load(); if (!T || this.r) return; this.T = T; this.build(T); },
    async attach(host, focusId) {
      if (!host || !enabled() || !webgl()) return;
      const T = this.T || await load(); if (!T || !host.isConnected) return;
      this.T = T;
      if (!this.r) this.build(T);
      this.host = host;
      if (this.canvas.parentNode !== host) host.prepend(this.canvas);
      host.classList.add('map3d'); if (this.texReady) host.classList.add('map3d-ready');
      this.pins = [...host.querySelectorAll('.map-pin')].map(el => { const x = parseFloat(el.style.left) / 100, y = parseFloat(el.style.top) / 100; const wx = (x - .5) * MW, wy = (.5 - y) * MH; return { el, v:new T.Vector3(wx, wy, bend(wx, wy) + .05) }; });
      if (focusId !== this.focusId) {
        this.focusId = focusId;
        const pin = this.pins.find(p => p.el.dataset.previewZone === focusId);
        if (pin) Object.assign(this.want, { x:pin.v.x, y:pin.v.y, dist:OVER * .6 });
        else Object.assign(this.want, { x:0, y:0, dist:OVER });
      }
      this.resize();
      if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t));
    },
    build(T) {
      const canvas = this.canvas = document.createElement('canvas'); canvas.className = 'map3d-canvas';
      const r = this.r = new T.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'low-power' });
      r.setPixelRatio(Math.min(1.75, devicePixelRatio || 1)); r.outputColorSpace = T.SRGBColorSpace; r.setClearColor(0x14121c, 1);
      this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(30, 16 / 9, .1, 100);
      const tex = new T.TextureLoader().load(new URL(KT.sceneUrl('world-map'), document.baseURI).href, () => { this.texReady = true; this.host?.classList.add('map3d-ready'); });
      tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy()); tex.minFilter = T.LinearMipmapLinearFilter;
      const geo = new T.PlaneGeometry(MW, MH, 96, 54), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, bend(pos.getX(i), pos.getY(i)));
      geo.computeVertexNormals();
      // Relevo leve com luz rasante e sombras de nuvens passando devagar (sem brilho, só profundidade).
      this.mat = new T.ShaderMaterial({
        uniforms:{ uMap:{ value:tex }, uTime:{ value:0 } },
        vertexShader:`varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader:`uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying vec3 vN;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
          void main(){
            vec3 c = texture2D(uMap, vUv).rgb;
            float lum = dot(c, vec3(.299, .587, .114));
            vec2 e = vec2(1. / 1672., 1. / 941.) * 2.;
            float dx = dot(texture2D(uMap, vUv + vec2(e.x, 0.)).rgb - texture2D(uMap, vUv - vec2(e.x, 0.)).rgb, vec3(.33));
            float dy = dot(texture2D(uMap, vUv + vec2(0., e.y)).rgb - texture2D(uMap, vUv - vec2(0., e.y)).rgb, vec3(.33));
            float relief = clamp(1. + (dx * -1.4 + dy * 1.1), .82, 1.14);
            float cloud = n(vUv * vec2(5., 3.) + vec2(uTime * .018, uTime * .007)) * n(vUv * vec2(9., 5.) - vec2(uTime * .011, 0.));
            float shade = 1. - smoothstep(.18, .5, cloud) * .12;
            float vig = smoothstep(.95, .35, length((vUv - .5) * vec2(1.25, 1.1)));
            gl_FragColor = vec4(c * relief * shade * mix(.72, 1., vig), 1.);
          }`
      });
      this.mesh = new T.Mesh(geo, this.mat); this.scene.add(this.mesh);
      // Lanternas subindo devagar sobre o mapa.
      const N = 70, g = new T.BufferGeometry(), p = new Float32Array(N * 3), s = new Float32Array(N);
      for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - .5) * MW; p[i * 3 + 1] = (Math.random() - .5) * MH; p[i * 3 + 2] = Math.random() * 2.2; s[i] = Math.random(); }
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('seed', new T.BufferAttribute(s, 1));
      this.lanterns = new T.Points(g, new T.ShaderMaterial({ transparent:true, depthWrite:false, blending:T.AdditiveBlending,
        uniforms:{ uColor:{ value:new T.Color('#e8b36a') }, uTime:{ value:0 }, uPx:{ value:r.getPixelRatio() } },
        vertexShader:`attribute float seed; uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 p = position; float k = fract(seed + uTime * .02); p.z = k * 2.4; p.x += sin(uTime * .3 + seed * 20.) * .15; vA = smoothstep(0., .15, k) * smoothstep(1., .7, k) * .55; vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = (40. + seed * 30.) * uPx / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader:SOFT_FS }));
      this.scene.add(this.lanterns);
      // Arrastar move a câmera; roda do mouse aproxima; duplo clique volta à visão geral.
      canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; this.drag = { x:e.clientX, y:e.clientY, lx:this.want.x, ly:this.want.y }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!this.drag) return; const k = this.want.dist / 700; this.want.x = U.clamp(this.drag.lx - (e.clientX - this.drag.x) * k, -MW * .35, MW * .35); this.want.y = U.clamp(this.drag.ly + (e.clientY - this.drag.y) * k, -MH * .32, MH * .32); });
      canvas.addEventListener('pointerup', () => { this.drag = null; });
      canvas.addEventListener('wheel', e => { e.preventDefault(); this.want.dist = U.clamp(this.want.dist * (e.deltaY > 0 ? 1.1 : .9), OVER * .45, OVER); }, { passive:false });
      canvas.addEventListener('dblclick', () => Object.assign(this.want, { x:0, y:0, dist:OVER }));
      addEventListener('resize', () => this.resize());
    },
    resize() { if (!this.host || !this.r) return; const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); },
    frame(t) {
      this.raf = 0;
      if (!this.canvas.isConnected || document.hidden) { if (this.canvas.isConnected) this.raf = requestAnimationFrame(x => this.frame(x)); return; }
      const dt = Math.min(.05, (t - (this.lastT || t)) / 1000); this.lastT = t;
      const L = this.look, W2 = this.want, k = 1 - Math.pow(.02, dt);
      // Mantém a câmera dentro do mapa (sem mostrar a borda vazia) em qualquer zoom.
      const th = Math.tan(this.cam.fov * Math.PI / 360) * W2.dist, hx = Math.max(0, MW * .5 - th * this.cam.aspect), hy = Math.max(0, MH * .5 - th); W2.x = U.clamp(W2.x, -hx, hx); W2.y = U.clamp(W2.y, -hy, hy);
      L.x += (W2.x - L.x) * k; L.y += (W2.y - L.y) * k; L.dist += (W2.dist - L.dist) * k;
      const sway = Math.sin(t / 4000) * .12;
      // Câmera inclinada ~28°: perspectiva de mesa de guerra, sem esconder o norte do mapa.
      this.cam.position.set(L.x + sway * (L.dist / 10), L.y - L.dist * .27, L.dist * .96); this.cam.lookAt(L.x, L.y + .05, 0);
      this.mat.uniforms.uTime.value = t / 1000; this.lanterns.material.uniforms.uTime.value = t / 1000;
      this.r.render(this.scene, this.cam);
      const w = this.host.clientWidth, h = this.host.clientHeight, v = new this.T.Vector3();
      this.pins.forEach(p => { v.copy(p.v).project(this.cam); const on = v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.08 && v.y < 1.08; const hw = p.el.offsetWidth / 2 + 6, hh = p.el.offsetHeight / 2 + 6; p.el.style.left = `${U.clamp((v.x * .5 + .5) * w, hw, w - hw)}px`; p.el.style.top = `${U.clamp((-v.y * .5 + .5) * h, hh, h - hh)}px`; p.el.style.visibility = on ? '' : 'hidden'; });
      this.raf = requestAnimationFrame(x => this.frame(x));
    }
  };
  KT.Map3D = Map3D;

  // ---------------------------------------------------------------------------
  // ATMOSFERA DO PALCO
  // ---------------------------------------------------------------------------
  // Cada tema: cor, quantidade, tamanho, velocidade (x, y), oscilação e mistura aditiva (brilho) ou normal.
  const THEMES = {
    village:{ color:'#f1b7c4', n:70, size:[10, 18], v:[.10, -.16], sway:.6, add:false, a:.55 },
    forest:{ color:'#d7f59a', n:60, size:[6, 12], v:[0, .04], sway:1.2, add:true, a:.7, blink:true },
    swamp:{ color:'#9ef0b0', n:60, size:[6, 12], v:[0, .03], sway:1.0, add:true, a:.65, blink:true },
    coast:{ color:'#cfe8f2', n:80, size:[4, 9], v:[-.12, .02], sway:.4, add:false, a:.45 },
    frost:{ color:'#f4f8ff', n:130, size:[5, 11], v:[-.05, -.22], sway:.5, add:false, a:.8 },
    desert:{ color:'#e4c38c', n:120, size:[3, 7], v:[-.35, .01], sway:.3, add:false, a:.45 },
    ghost:{ color:'#b9c8ff', n:40, size:[16, 30], v:[.02, .05], sway:1.2, add:true, a:.28, blink:true },
    clock:{ color:'#e8d7a6', n:70, size:[3, 6], v:[0, .02], sway:.3, add:true, a:.5 },
    sky:{ color:'#ffffff', n:50, size:[20, 40], v:[.12, 0], sway:.2, add:false, a:.14 },
    sakura:{ color:'#f6b8c8', n:90, size:[10, 18], v:[.14, -.18], sway:.8, add:false, a:.7 },
    forge:{ color:'#ff9a4d', n:70, size:[4, 8], v:[.02, .3], sway:.5, add:true, a:.7 },
    boss:{ color:'#ff8a5c', n:60, size:[4, 8], v:[.03, .25], sway:.6, add:true, a:.55 },
    dungeon:{ color:'#d9c9a8', n:60, size:[3, 6], v:[0, .02], sway:.3, add:false, a:.35 },
    crypt:{ color:'#9fe0c0', n:50, size:[4, 8], v:[0, .05], sway:.6, add:true, a:.4, blink:true },
    archive:{ color:'#e8d7a6', n:60, size:[3, 6], v:[0, .02], sway:.3, add:false, a:.4 },
    abyss:{ color:'#b48cff', n:60, size:[5, 10], v:[0, .08], sway:.7, add:true, a:.45 },
    rift:{ color:'#b48cff', n:60, size:[5, 10], v:[0, .08], sway:.7, add:true, a:.45 }
  };
  // Luzes da capital (x, y em 1280×720 sobre assets/scenes/village-expanded; força 1–3): achadas nos pontos quentes
  // da própria arte (lanternas, janelas, balcões) + a fornalha da Forja e o portal do Salão feitos à mão.
  const CITY_LIGHTS = [[577,153,3],[203,292,3],[215,605,3],[288,655,3],[138,282,3],[177,404,3],[139,629,3],[371,645,3],[164,669,3],[255,143,3],[1048,427,3],[458,307,3],[381,471,3],[177,559,3],[461,662,3],[79,462,3],[61,633,3],[1090,402,3],[937,580,3],[1103,600,3],[17,464,3],[171,583,3],[398,604,3],[989,600,3],[384,140,3],[174,163,3],[435,256,3],[232,414,3],[72,415,3],[606,642,3],[826,386,3],[66,272,3],[1143,390,3],[238,593,3],[239,609,3],[137,610,3],[507,149,3],[283,195,3],[306,237,3],[98,299,3],[35,397,3],[315,439,3],[80,114,3],[174,258,3],[149,469,3],[963,483,3],[1238,600,3],[285,610,3],[518,678,3],[702,644,3],[1187,617,3],[560,275,2],[1000,434,2],[331,490,2],[628,630,2],[1194,643,2],[733,680,2],[323,275,2],[86,370,2],[985,376,2],[274,648,2],[779,657,2],[394,201,2],[308,297,2]];
  const CITY_FIRE = [[785,352,9,'#ff8a3d'],[548,78,8,'#9fc8ff'],[560,130,4,'#b8d4ff']];
  // Camada presa à arte da cidade (câmera ortográfica 1280×720): halos de luz aditivos que tremulam, névoa baixa
  // correndo sobre canais e cascatas, e vaga-lumes nos jardins. Some nas lutas.
  const CityLayer = {
    build(T, r) {
      const scene = new T.Scene(), cam = new T.PerspectiveCamera();  // não usado: os shaders projetam direto da arte (1280×720)
      const pts = [...CITY_LIGHTS.map(([x, y, s]) => [x, y, 10 + s * 7, '#ffc27a']), ...CITY_FIRE.map(([x, y, s, c]) => [x, y, 12 + s * 8, c])];
      const g = new T.BufferGeometry(), p = new Float32Array(pts.length * 3), sz = new Float32Array(pts.length), col = new Float32Array(pts.length * 3), seed = new Float32Array(pts.length);
      pts.forEach(([x, y, s, c], i) => { p.set([x, y, 0], i * 3); sz[i] = s; const cc = new T.Color(c); col.set([cc.r, cc.g, cc.b], i * 3); seed[i] = Math.random(); });
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('size', new T.BufferAttribute(sz, 1)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('seed', new T.BufferAttribute(seed, 1));
      const uni = { uTime:{ value:0 }, uScale:{ value:1 }, uView:{ value:new T.Vector2(0, 1280) } };
      // Pixel da arte -> tela, com o recorte do celular em pé (view.x, view.w).
      const CLIP = `uniform vec2 uView; vec4 toClip(vec3 p){ vec4 w = modelMatrix * vec4(p, 1.); return vec4((w.x - uView.x) / uView.y * 2. - 1., 1. - w.y / 360., 0., 1.); }`;
      const glow = new T.Points(g, new T.ShaderMaterial({ transparent:true, depthWrite:false, blending:T.NormalBlending, uniforms:uni,
        vertexShader:CLIP + `attribute float size, seed; attribute vec3 color; uniform float uTime, uScale; varying vec3 vC; varying float vA;
          void main(){ float f = .78 + .14 * sin(uTime * (2.3 + seed * 3.) + seed * 40.) + .08 * sin(uTime * 11. + seed * 90.);
            vC = color; vA = f; gl_PointSize = size * uScale * (.92 + .1 * f); gl_Position = toClip(position); }`,
        fragmentShader:`varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard;
          float core = exp(-d * d * 9.), halo = exp(-d * d * 2.2) * .45; gl_FragColor = vec4(mix(vC, vec3(1., .96, .86), core * .5), min(1., (core * .9 + halo) * vA * .6)); }` }));
      scene.add(glow);
      // Névoa: faixa baixa (canais, cascatas e o pé das escadas), ruído que corre devagar para a direita.
      const mist = new T.Mesh(new T.PlaneGeometry(1280, 300), new T.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:uni,
        vertexShader:CLIP + `varying vec2 vUv; void main(){ vUv = uv; gl_Position = toClip(position); }`,
        fragmentShader:`uniform float uTime; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p){ float v = 0., a = .5; for (int k = 0; k < 4; k++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }
          void main(){ vec2 q = vec2(vUv.x * 6. + uTime * .025, vUv.y * 2.2 - uTime * .01); float m = fbm(q + fbm(q * .7 + uTime * .02));
            float band = smoothstep(0., .45, vUv.y) * smoothstep(1., .55, vUv.y); gl_FragColor = vec4(.72, .78, .95, m * band * .2); }` }));
      mist.position.set(640, 590, -1); mist.scale.y = -1; scene.add(mist);
      // Vaga-lumes nos jardins e beiras de caminho: vagam em volta de um ponto e piscam.
      const FN = 46, fg = new T.BufferGeometry(), fp = new Float32Array(FN * 3), fs = new Float32Array(FN);
      for (let i = 0; i < FN; i++) { fp.set([40 + Math.random() * 1200, 230 + Math.random() * 470, 0], i * 3); fs[i] = Math.random(); }
      fg.setAttribute('position', new T.BufferAttribute(fp, 3)); fg.setAttribute('seed', new T.BufferAttribute(fs, 1));
      const flies = new T.Points(fg, new T.ShaderMaterial({ transparent:true, depthWrite:false, blending:T.NormalBlending, uniforms:uni,
        vertexShader:CLIP + `attribute float seed; uniform float uTime, uScale; varying float vA;
          void main(){ vec3 p = position; p.x += sin(uTime * (.3 + seed * .4) + seed * 20.) * 18.; p.y += cos(uTime * (.25 + seed * .3) + seed * 13.) * 10.;
            vA = pow(.5 + .5 * sin(uTime * (1. + seed * 1.8) + seed * 60.), 4.); gl_PointSize = (5. + seed * 4.) * uScale; gl_Position = toClip(p); }`,
        fragmentShader:`varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; gl_FragColor = vec4(.88, 1., .6, exp(-d * d * 4.) * vA); }` }));
      scene.add(flies);
      return { scene, cam, uni };
    },
    render(T, r, L, t, view) {
      const v = view || { x:0, w:1280 }; L.uni.uView.value.set(v.x, v.w);
      L.uni.uTime.value = t / 1000; L.uni.uScale.value = r.domElement.height / 720;
      r.autoClear = false; r.render(L.scene, L.cam); r.autoClear = true;
    }
  };
  const Atmos = {
    T:null, r:null, scene:null, cam:null, pts:null, canvas:null, host:null, theme:'', raf:0, lastT:0, mx:0, my:0, on:false,
    async mount(host) {
      this.host = host; if (!host || !enabled() || !webgl()) return;
      const T = this.T || await load(); if (!T) return; this.T = T;
      if (!this.r) {
        const c = this.canvas = document.createElement('canvas'); c.className = 'atmos-canvas'; c.setAttribute('aria-hidden', 'true');
        this.r = new T.WebGLRenderer({ canvas:c, alpha:true, antialias:false, powerPreference:'low-power', premultipliedAlpha:false });
        this.r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); this.r.setClearColor(0x000000, 0);
        this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(50, 16 / 9, .1, 50); this.cam.position.set(0, 0, 10);
        host.querySelector('#game-canvas')?.after(c);
        host.addEventListener('pointermove', e => { const b = host.getBoundingClientRect(); this.mx = (e.clientX - b.left) / b.width - .5; this.my = (e.clientY - b.top) / b.height - .5; });
        addEventListener('resize', () => this.resize()); this.resize();
      }
      this.on = true; this.canvas.hidden = false;
      if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t));
    },
    refresh() { if (!enabled()) { this.on = false; if (this.canvas) this.canvas.hidden = true; } else if (this.host) this.mount(this.host); },
    resize() { if (!this.r || !this.host) return; const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); },
    setTheme(id) {
      if (!this.T || id === this.theme) return; this.theme = id;
      const T = this.T, th = THEMES[id] || THEMES.dungeon;
      if (this.pts) { this.scene.remove(this.pts); this.pts.geometry.dispose(); this.pts.material.dispose(); }
      // Três camadas de profundidade (z de -6 a 4): as da frente são maiores, mais rápidas e desfocadas.
      const N = th.n, g = new T.BufferGeometry(), p = new Float32Array(N * 3), s = new Float32Array(N);
      for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - .5) * 22; p[i * 3 + 1] = (Math.random() - .5) * 12; p[i * 3 + 2] = -6 + Math.random() * 10; s[i] = Math.random(); }
      g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('seed', new T.BufferAttribute(s, 1));
      this.pts = new T.Points(g, new T.ShaderMaterial({ transparent:true, depthWrite:false, blending:th.add ? T.AdditiveBlending : T.NormalBlending,
        uniforms:{ uColor:{ value:new T.Color(th.color) }, uTime:{ value:0 }, uPx:{ value:this.r.getPixelRatio() }, uVel:{ value:new T.Vector2(th.v[0], th.v[1]) }, uSize:{ value:new T.Vector2(th.size[0], th.size[1]) }, uSway:{ value:th.sway }, uA:{ value:th.a }, uBlink:{ value:th.blink ? 1 : 0 } },
        vertexShader:`attribute float seed; uniform float uTime, uPx, uSway, uA, uBlink; uniform vec2 uVel, uSize; varying float vA;
          void main(){
            vec3 p = position; float depth = (p.z + 6.) / 10.; float sp = .5 + depth;
            p.x = mod(p.x + uVel.x * uTime * sp * 6. + sin(uTime * .7 + seed * 40.) * uSway * .4 + 11., 22.) - 11.;
            p.y = mod(p.y + uVel.y * uTime * sp * 6. + cos(uTime * .5 + seed * 30.) * uSway * .25 + 6., 12.) - 6.;
            float blink = uBlink > .5 ? .35 + .65 * pow(.5 + .5 * sin(uTime * (1.2 + seed * 2.) + seed * 50.), 3.) : 1.;
            vA = uA * blink * (.35 + .65 * depth);
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_PointSize = mix(uSize.x, uSize.y, seed) * (.6 + depth * .9) * uPx * 10. / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader:SOFT_FS }));
      this.scene.add(this.pts);
    },
    frame(t) {
      this.raf = 0; if (!this.on) return;
      if (!document.hidden) {
        const zone = KT.__zone?.() || {}, theme = zone.kind === 'village' ? 'village' : zone.theme || 'dungeon';
        if (theme !== this.theme) this.setTheme(theme);
        const dt = Math.min(.05, (t - (this.lastT || t)) / 1000); this.lastT = t;
        this.cam.position.x += (this.mx * .8 - this.cam.position.x) * Math.min(1, dt * 2); this.cam.position.y += (-this.my * .45 - this.cam.position.y) * Math.min(1, dt * 2); this.cam.lookAt(0, 0, 0);
        if (this.pts) this.pts.material.uniforms.uTime.value = t / 1000;
        this.r.render(this.scene, this.cam);
        if (zone.kind === 'village') { this.city ||= CityLayer.build(this.T, this.r); CityLayer.render(this.T, this.r, this.city, t, KT.__view?.()); }
      }
      this.raf = requestAnimationFrame(x => this.frame(x));
    }
  };
  Atmos.CityLayer = CityLayer;
  KT.Atmos = Atmos;
})();
