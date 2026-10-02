'use strict';
// Conferência de tela em Chrome headless pelo protocolo DevTools, sem dependências (Node 22+: fetch e WebSocket nativos).
// Os testes de `npm test` não abrem a interface; isto abre: tamanho de tela, toque, cursor, tempo e recortes ampliados.
//
//   node tools/ui/cdp.js tools/ui/hud.js d657:1366:657 m375:375:812:2:1     console de batalha em vários tamanhos
//   node tools/ui/cdp.js tools/ui/play.js nome 1366 657                    uso: cursor, golpe cronometrado, efeitos, AUTO
//   node tools/ui/cdp.js tools/ui/overflow.js 1366:657 375:812:2:1         nada passa da borda do painel nem da tela
//   node tools/ui/cdp.js tools/ui/panels.js                                abre cada painel e cada aba e acusa exceção
//
// O cenário exporta `async (p, args) => { ... }`:
//   p.base                    endereço do jogo (servidor próprio, só de leitura; UI_BASE aponta para outro)
//   p.out(arquivo)            caminho na pasta de saída (UI_OUT; padrão: pasta temporária do sistema / mythverse-ui)
//   p.open(url, { w, h, dpr, mobile })   p.until(js, ms)   p.wait(ms)   p.eval(js)
//   p.shot(arquivo, { clip:[x,y,w,h], scale })   p.rect(seletor)   p.click(seletor)   p.tap(x, y)   p.hover(x, y)
//   p.key('Space')            p.errors()  → exceções e arquivos do jogo que faltam (erros); console e serviços de fora (avisos)
// Chrome: variável CHROME, ou o caminho padrão do Windows.
const { spawn } = require('node:child_process'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const ROOT = path.resolve(__dirname, '../..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Servidor de arquivos só de leitura na raiz do jogo.
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(data); });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const [file, ...args] = process.argv.slice(2);
  if (!file) { console.error('uso: node tools/ui/cdp.js <cenário.js> [argumentos]'); process.exit(1); }
  const scenario = require(path.resolve(file));
  const server = process.env.UI_BASE ? null : await serve(), base = process.env.UI_BASE || `http://127.0.0.1:${server.address().port}`;
  const outDir = process.env.UI_OUT || path.join(os.tmpdir(), 'mythverse-ui'); fs.mkdirSync(outDir, { recursive:true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1400,900', 'about:blank'], { stdio:'ignore' });
  const guard = setTimeout(() => { console.error('TEMPO ESGOTADO'); try { proc.kill(); } catch {} process.exit(2); }, Number(process.env.CDP_TIMEOUT || 170000));
  let port = '';
  for (let i = 0; i < 150 && !port; i++) { try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {} if (!port) await sleep(100); }
  if (!port) throw new Error('Chrome não abriu a porta de depuração');
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let seq = 0; const waiting = new Map(), errors = [], logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const { ok, no } = waiting.get(m.id); waiting.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`${m.params.type}: ${m.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`.slice(0, 300));
    // Arquivo do próprio jogo que falta é erro; resposta de serviço de fora (conta não logada no teste, por exemplo) é só aviso.
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) (m.params.response.url.startsWith(base) ? errors : logs).push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  };
  const send = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; waiting.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const p = {
    args, base, send, wait:sleep, out:f => path.join(outDir, f),
    async open(url, { w = 1366, h = 768, dpr = 1, mobile = false } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width:w, height:h, deviceScaleFactor:dpr, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled:mobile, maxTouchPoints:mobile ? 5 : 1 });
      p.mobile = mobile;
      await send('Page.navigate', { url:/^https?:/.test(url) ? url : base + url });
    },
    async eval(js) {
      const r = await send('Runtime.evaluate', { expression:js, awaitPromise:true, returnByValue:true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async until(js, ms = 25000) { const t0 = Date.now(); for (;;) { let ok = false; try { ok = await p.eval(js); } catch {} if (ok) return true; if (Date.now() - t0 > ms) throw new Error(`não chegou: ${js}`); await sleep(250); } },
    // JPEG: resposta grande (PNG de tela cheia) trava o WebSocket do Node sem avisar.
    async shot(name, { clip, scale = 1, quality = 93 } = {}) {
      const params = { format:'jpeg', quality, captureBeyondViewport:false };
      if (clip) params.clip = { x:clip[0], y:clip[1], width:clip[2], height:clip[3], scale };
      const r = await send('Page.captureScreenshot', params), file = path.isAbsolute(name) ? name : p.out(name);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    rect(sel) { return p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || !el.offsetWidth) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; })()`); },
    async tap(x, y) {
      if (p.mobile) { await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x, y }] }); await sleep(40); await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] }); }
      else { await send('Input.dispatchMouseEvent', { type:'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', clickCount:1 }); await send('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', clickCount:1 }); }
    },
    async hover(x, y) { await send('Input.dispatchMouseEvent', { type:'mouseMoved', x, y }); },
    async click(sel) { const r = await p.rect(sel); if (!r) throw new Error(`sem elemento: ${sel}`); await p.tap(r[0] + r[2] / 2, r[1] + r[3] / 2); return r; },
    async key(code, key = code) { await send('Input.dispatchKeyEvent', { type:'keyDown', code, key, windowsVirtualKeyCode:{ Space:32, Enter:13 }[code] || (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0) }); await send('Input.dispatchKeyEvent', { type:'keyUp', code, key }); },
    errors() { return { errors:[...errors], logs:[...logs] }; },
    // Luta de teste (save local, equipe de nível 30). zona: hunt, boss, dungeon… (ver devfight em src/main.js)
    fightUrl({ zone = 'hunt', stage = 6, mode = 'manual' } = {}) { return `/index.html?devoffline&devseed=erik,akira,warden,aurelia&devlvl=30&devfight=${zone}&devstage=${stage}&devmode=${mode}&v=${Date.now()}`; },
    inFight() { return p.until(`!!(globalThis.KT && KT.dev && KT.dev.engine.active && KT.dev.engine.phase === 'fight' && document.querySelector('.bh-unit'))`); }
  };
  let code = 0;
  try { await scenario(p, args); } catch (e) { console.error('ERRO', e.stack || e); code = 1; }
  const bad = p.errors(); console.log(JSON.stringify(bad)); if (bad.errors.length) code = code || 3;
  try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch {}
  clearTimeout(guard); try { proc.kill(); } catch {} server?.close();
  await sleep(300); try { fs.rmSync(dir, { recursive:true, force:true }); } catch {}
  console.log(`saída: ${outDir}`);
  process.exit(code);
}
main().catch(e => { console.error(e); process.exit(1); });
