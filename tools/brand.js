'use strict';
// Marca do Mythverse, feita à mão: círculo de tinta (ensō), letra de título e selo vermelho. Nada de chanfro dourado,
// orbe, faísca ou partícula. Gera assets/brand/*.svg, *.png e *.webp a partir de um só desenho.
//   node tools/brand.js            (precisa de Chrome: variável CHROME ou o caminho padrão do Windows; no Linux como root
//                                   acrescenta --no-sandbox sozinho; baixa as fontes do Google uma vez para a pasta temporária)
const { spawn, execFileSync } = require('node:child_process'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'assets', 'brand');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Carta de cor (theme-estampa.css)
const C = { sumi:'#1e1b2c', washi:'#eee5d0', shu:'#cb422c', kin:'#e2aa4e', nezumi:'#96a0ac' };

// Ensō: pincelada circular que começa grossa e termina num fio, com a falha do pincel no alto (a lua em eclipse).
function enso(cx, cy, r, { thick = r * .2, thin = r * .02, start = 300, sweep = 312, n = 160 } = {}) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = (start + sweep * s) * Math.PI / 180;
    const t = thin + (thick - thin) * Math.pow(1 - s, .75) * (1 + .12 * Math.sin(s * 7.3)) ;   // afina, com a mão não uniforme
    const wob = r * .012 * Math.sin(s * 11.1 + .4);                                            // o círculo não é de compasso
    outer.push([cx + (r + t / 2 + wob) * Math.cos(a), cy + (r + t / 2 + wob) * Math.sin(a)]);
    inner.push([cx + (r - t / 2 + wob) * Math.cos(a), cy + (r - t / 2 + wob) * Math.sin(a)]);
  }
  const f = p => p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`);
  const o = f(outer), q = f(inner.reverse());
  return `M${o[0]} L${o.slice(1).join(' L')} L${q.join(' L')} Z`;
}

const FONTS = `@font-face{font-family:"Shippori Mincho B1";font-weight:800;src:url(FONT_TITLE) format("woff2")}
@font-face{font-family:"Shippori Mincho";font-weight:700;src:url(FONT_KANJI) format("woff2")}
@font-face{font-family:"Zen Kaku Gothic New";font-weight:500;src:url(FONT_UI) format("woff2")}`;

// variante: full (900×490), horizontal (840×291), mark (256×256). ink/paper: tinta sobre papel (fundo claro) ou papel
// sobre transparente (o jogo, fundo escuro).
function svg(variant, paper = false) {
  const ink = paper ? C.sumi : C.washi, sub = paper ? C.sumi : C.kin;
  const seal = (x, y, s, rot = -3) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="0" y="0" width="${s}" height="${s}" rx="${s * .06}" fill="${C.shu}"/><text x="${s / 2}" y="${s * .77}" text-anchor="middle" font-family="'Shippori Mincho',serif" font-weight="700" font-size="${s * .74}" fill="${C.washi}">月</text></g>`;
  if (variant === 'full') {
    const W = 900, H = 490;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paper ? `<rect width="${W}" height="${H}" rx="10" fill="${C.washi}"/>` : ''}
<path d="${enso(450, 170, 112, { thick:24, thin:2.5 })}" fill="${ink}"/>
<text x="450" y="380" text-anchor="middle" textLength="660" lengthAdjust="spacing" font-family="'Shippori Mincho B1',serif" font-weight="800" font-size="92" fill="${ink}">MYTHVERSE</text>
<text x="450" y="436" text-anchor="middle" font-family="'Zen Kaku Gothic New',sans-serif" font-weight="500" font-size="19" letter-spacing="6.6" fill="${sub}">HERÓIS DE TODOS OS MUNDOS</text>
${seal(798, 340, 42)}</svg>`;
  }
  if (variant === 'horizontal') {
    const W = 840, H = 291;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paper ? `<rect width="${W}" height="${H}" rx="8" fill="${C.washi}"/>` : ''}
<path d="${enso(112, 146, 88, { thick:20, thin:2 })}" fill="${ink}"/>
<text x="236" y="174" textLength="536" lengthAdjust="spacing" font-family="'Shippori Mincho B1',serif" font-weight="800" font-size="74" fill="${ink}">MYTHVERSE</text>
${seal(788, 140, 36)}</svg>`;
  }
  // mark: fundo de tinta, ensō de papel e o selo no miolo. Lê-se em 16 px.
  const W = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${paper ? '' : `<rect width="${W}" height="${W}" rx="40" fill="${C.sumi}"/>`}
<path d="${enso(128, 128, 86, { thick:19, thin:2 })}" fill="${paper ? C.sumi : C.washi}"/>
${seal(104, 104, 48, -4)}</svg>`;
}

// Fontes do Google: baixa com curl (passa pelo proxy) só os pedaços que a marca usa (latim e o kanji 月).
function fonts() {
  const dir = path.join(os.tmpdir(), 'mythverse-brand-fonts'); fs.mkdirSync(dir, { recursive:true });
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
  const css = fam => execFileSync('curl', ['-sS', '--max-time', '30', '-A', ua, `https://fonts.googleapis.com/css2?family=${fam}&display=swap`], { encoding:'utf8' });
  const pick = (text, wantCp) => {
    const blocks = text.split('@font-face').slice(1);
    for (const b of blocks) {
      const url = (b.match(/url\(([^)]+\.woff2)\)/) || [])[1], range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1] || 'U+0-10FFFF';
      const ok = range.split(',').some(r => { const m = r.trim().match(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/i); if (!m) return false; const a = parseInt(m[1], 16), z = m[2] ? parseInt(m[2], 16) : a; return wantCp >= a && wantCp <= z; });
      if (url && ok) return url;
    }
    throw new Error('fonte sem o trecho pedido');
  };
  const get = (name, url) => { const f = path.join(dir, name); if (!fs.existsSync(f)) execFileSync('curl', ['-sS', '--max-time', '60', '-o', f, url]); return 'file://' + f.replace(/\\/g, '/'); };
  return {
    FONT_TITLE:get('shippori-b1-800.woff2', pick(css('Shippori+Mincho+B1:wght@800'), 0x41)),
    FONT_KANJI:get('shippori-700-tsuki.woff2', pick(css('Shippori+Mincho:wght@700'), 0x6708)),
    FONT_UI:get('zen-kaku-500.woff2', pick(css('Zen+Kaku+Gothic+New:wght@500'), 0x41)),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive:true });
  // SVG estático (o jogo e o README podem usar direto; as fontes vêm da página)
  fs.writeFileSync(path.join(OUT, 'logo.svg'), svg('full'));
  fs.writeFileSync(path.join(OUT, 'logo-paper.svg'), svg('full', true));
  fs.writeFileSync(path.join(OUT, 'logo-horizontal.svg'), svg('horizontal'));
  fs.writeFileSync(path.join(OUT, 'mark.svg'), svg('mark'));
  const f = fonts(), cssFonts = FONTS.replace('FONT_TITLE', f.FONT_TITLE).replace('FONT_KANJI', f.FONT_KANJI).replace('FONT_UI', f.FONT_UI);
  const page = path.join(os.tmpdir(), 'mythverse-brand.html');
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>${cssFonts}html,body{margin:0;background:transparent}#art{position:absolute;left:0;top:0}#art svg{display:block}</style><div id="art"></div>`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--hide-scrollbars', '--allow-file-access-from-files', '--window-size=1000,600', 'file://' + page.replace(/\\/g, '/')];
  if (process.getuid?.() === 0) args.unshift('--no-sandbox', '--disable-gpu');
  const proc = spawn(CHROME, args, { stdio:'ignore' });
  let port = ''; for (let i = 0; i < 150 && !port; i++) { try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {} if (!port) await sleep(100); }
  if (!port) throw new Error('Chrome não abriu');
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 0; const waiting = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { const { ok, no } = waiting.get(m.id); waiting.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); } };
  const send = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; waiting.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
  const evalJs = async js => { const r = await send('Runtime.evaluate', { expression:js, awaitPromise:true, returnByValue:true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDefaultBackgroundColorOverride', { color:{ r:0, g:0, b:0, a:0 } });
  await evalJs(`document.fonts.load("800 20px 'Shippori Mincho B1'").then(() => document.fonts.load("700 20px 'Shippori Mincho'")).then(() => document.fonts.load("500 20px 'Zen Kaku Gothic New'")).then(() => document.fonts.ready).then(() => true)`);
  const loaded = await evalJs(`[...document.fonts].map(f => f.family + ':' + f.status).join(', ')`); console.log('fontes:', loaded);
  // [arquivo, variante, papel?, largura final]
  const JOBS = [
    ['logo-full.png', 'full', true, 900], ['mv-full-440', 'full', false, 440], ['mv-full-720', 'full', false, 720],
    ['logo-horizontal.png', 'horizontal', true, 741], ['mv-horizontal-280', 'horizontal', false, 280], ['mv-horizontal-520', 'horizontal', false, 520],
    ['emblem.png', 'mark', false, 492], ['favicon-512.png', 'mark', false, 512], ['favicon-192.png', 'mark', false, 192], ['favicon-64.png', 'mark', false, 64],
  ];
  for (const [name, variant, paper, width] of JOBS) {
    const markup = svg(variant, paper), [, w, h] = markup.match(/width="(\d+)" height="(\d+)"/).map(Number), dpr = width / w;
    await evalJs(`document.querySelector('#art').innerHTML = ${JSON.stringify(markup)}; true`);
    await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:dpr, mobile:false }); await sleep(120);
    const formats = name.endsWith('.png') ? [['png', name]] : [['png', name + '.png'], ['webp', name + '.webp']];
    for (const [format, file] of formats) {
      const r = await send('Page.captureScreenshot', { format, quality:format === 'webp' ? 92 : undefined, clip:{ x:0, y:0, width:w, height:h, scale:1 }, captureBeyondViewport:true });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(r.data, 'base64')); console.log(file, `${Math.round(w * dpr)}×${Math.round(h * dpr)}`);
    }
  }
  try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch {}
  try { proc.kill(); } catch {} await sleep(300); try { fs.rmSync(dir, { recursive:true, force:true }); } catch {}
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
