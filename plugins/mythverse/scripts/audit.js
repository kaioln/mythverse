#!/usr/bin/env node
'use strict';
// Varredura de "cara de IA" em texto, CSS e HTML. Sem dependências.
//   node audit.js [--json] [--strict] [--min=médio|alto] [caminho ...]      (sem caminho: pasta atual)
// Sai com 1 em --strict quando há achado alto. Ignora node_modules, .git, vendor, dist, build, data.
const fs = require('node:fs'), path = require('node:path');

const SKIP = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', 'data', '.claude', 'coverage']);
const EXT = new Set(['.js', '.mjs', '.ts', '.css', '.html', '.md', '.json']);
const TEXT = ['.js', '.mjs', '.ts', '.html', '.json', '.md'], STYLE = ['.css', '.html', '.js'];

// id, gravidade, extensões, regex, mensagem, correção
const RULES = [
  ['plural-s', 'alto', TEXT, /(?<![.\w$\p{L}])\p{L}{3,}\((?:s|es|ões|a|as|is)\)(?=\s+\p{L}|[<$"'`]|\.(?=\s|$|<)|$)/u, '"(s)" no lugar do plural', 'use a função de plural do projeto (ex.: KT.Utils.count(n, "ponto"))'],
  ['emoji', 'alto', [...TEXT, '.css'], /(?![♥♦♠♣☆★⛶↩↪⬇⬆▶◀♪♫])\p{Extended_Pictographic}/u, 'emoji como ícone ou enfeite (★ ✓ ✕ ✦ ▶ ♪ são tipografia e não contam)', 'ícone desenhado no mesmo traço dos outros'],
  ['clique-aqui', 'médio', TEXT, /\b(clique|toque|click)\s+(aqui|here)\b|clique para (continuar|fechar|começar|ver mais)|click to continue/i, '"Clique aqui" e variantes', 'verbo da ação no botão; cursor ▼ no diálogo'],
  ['travessao', 'médio', TEXT, /(["'`>]|^)[^"'`<\n]{0,160}\s[—–]\s/m, 'travessão em texto de interface', 'ponto, dois-pontos ou vírgula'],
  ['clichê', 'alto', TEXT, /\b(jornada épica|mergulhe|desvende|experiência (única|imersiva|inesquecível)|(leve|levar|eleve|elevar) [^.]{0,30}(ao|para o) próximo nível|prepare-se para|desbloqueie (todo )?o (seu )?potencial|bem-vindo\(a\)|lorem ipsum|descubra o poder|epic journey|immersive experience)\b/i, 'clichê de texto gerado', 'frase concreta com o nome do lugar ou do objeto'],
  ['obra', 'médio', TEXT, /\b(em breve|coming soon|work in progress)\b/i, 'aviso de obra ("em breve")', 'ou a função existe, ou não aparece; se precisar, data e o que vai ter'],
  ['nao-e-apenas', 'médio', TEXT, /\bnão (é|são) apenas\b|\bmais do que (um|uma) (simples )?\b|\bnot just a\b/i, '"não é apenas X, é Y"', 'diga o que é, em uma frase'],
  ['exclamacao-serie', 'baixo', TEXT, /!(?!=)[^!\n]{0,60}!(?!=)[^!\n]{0,60}!(?!=)/, 'três exclamações no mesmo trecho', 'uma por tela, quando alguém grita de verdade'],
  ['reticencias-ascii', 'baixo', TEXT, /[^.]\.\.\.(?!\.)/, '"..." em vez de "…"', 'use o caractere "…" (ou tire)'],
  ['preparando-jornada', 'médio', TEXT, /preparando (a |sua )?(jornada|aventura)|carregando a aventura|loading your adventure/i, 'texto de abertura genérico', 'algo do mundo do jogo ("Acendendo as lanternas…")'],
  ['selecione-para', 'baixo', TEXT, /selecione (um|uma) [\p{L} ]{2,30} (à|a) (esquerda|direita) para/iu, 'tela vazia que explica a tela', 'o vazio aponta o próximo passo com verbo'],
  ['fonte-generica', 'médio', STYLE, /font-family[^;]*\b(Inter|Outfit|Poppins|Montserrat|Roboto|Open Sans|Lato|Nunito|Raleway|Space Grotesk|Sora|Plus Jakarta Sans|DM Sans|Manrope|Urbanist|Figtree)\b|fonts\.googleapis\.com[^"']*family=(Inter|Outfit|Poppins|Montserrat|Roboto|Sora|DM\+Sans|Plus\+Jakarta|Manrope|Space\+Grotesk)\b/, 'fonte de template (a mesma de todo site gerado)', 'fonte com origem no mundo do jogo; serifa de título + sem-serifa com caráter'],
  ['tailwind-cores', 'médio', STYLE, /#(7c3aed|8b5cf6|a855f7|6366f1|3b82f6|2563eb|06b6d4|22d3ee|ec4899|f472b6|10b981|22c55e|f59e0b|ef4444|0ea5e9|14b8a6)\b/i, 'cor padrão do Tailwind', 'carta de cor do projeto, com nome'],
  ['degrade-135', 'baixo', STYLE, /linear-gradient\(\s*135deg/i, 'degradê a 135deg (o de todo botão gerado)', 'cor chapada; luz é contraste de valor'],
  ['vidro-fosco', 'baixo', STYLE, /backdrop-filter\s*:\s*blur/i, 'vidro fosco (glassmorphism)', 'superfície chapada com fio de tinta'],
  ['glow', 'baixo', STYLE, /(text-shadow|box-shadow)\s*:[^;]*\b0\s+0\s+(1[2-9]|[2-9]\d)px\s+(#|rgba?\(|hsla?\(|var\()/i, 'brilho (glow) largo', 'sombra preta curta ou nenhuma'],
  ['raio-grande', 'baixo', STYLE, /border-radius\s*:\s*(1[6-9]|[2-9]\d|\d{3})px\b|border-radius\s*:\s*9{3,}px/i, 'raio grande (pílula de aplicativo)', 'canto quase reto (2 a 4 px)'],
];

function walk(p, out) {
  let st; try { st = fs.statSync(p); } catch { return out; }
  if (st.isDirectory()) { if (SKIP.has(path.basename(p))) return out; for (const f of fs.readdirSync(p)) walk(path.join(p, f), out); }
  else if (EXT.has(path.extname(p).toLowerCase()) && st.size < 4e6) out.push(p);
  return out;
}

// Em código (.js/.ts) só o que está dentro de string (aspas simples, duplas ou crase) é texto do jogador.
function segments(src, ext) {
  if (!['.js', '.mjs', '.ts'].includes(ext)) return src.split('\n').map((text, i) => ({ line:i + 1, text }));
  // comentários saem antes (mantendo as quebras de linha, para o número da linha bater)
  src = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^[ \t]*\/\/.*$/gm, '');
  const out = [], re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g; let m;
  while ((m = re.exec(src))) { const line = src.slice(0, m.index).split('\n').length; for (const [k, part] of m[0].slice(1, -1).split('\n').entries()) out.push({ line:line + k, text:part }); }
  return out;
}

function scanFile(file) {
  const ext = path.extname(file).toLowerCase(), src = fs.readFileSync(file, 'utf8'), found = [], segs = segments(src, ext);
  for (const [id, sev, exts, re, msg, fix] of RULES) {
    if (!exts.includes(ext)) continue;
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g', rg = new RegExp(re.source, flags);
    for (const { line, text } of segs) {
      if (ext !== '.css' && ext !== '.md' && /^\s*(\/\/|\*|\/\*|#)/.test(text)) continue;   // comentário não é texto do jogador
      rg.lastIndex = 0; const m = rg.exec(text); if (!m) continue;
      const col = m.index, snippet = text.slice(Math.max(0, col - 50), col + Math.min(90, m[0].length + 40)).trim();
      if (!found.some(f => f.id === id && f.line === line)) found.push({ file, line, id, sev, msg, fix, snippet });
    }
  }
  return found;
}

function main() {
  const args = process.argv.slice(2), json = args.includes('--json'), strict = args.includes('--strict');
  const min = (args.find(a => a.startsWith('--min=')) || '--min=baixo').slice(6);
  const paths = args.filter(a => !a.startsWith('--')); if (!paths.length) paths.push('.');
  const files = paths.flatMap(p => walk(path.resolve(p), []));
  const order = { alto:0, 'médio':1, baixo:2 };
  const all = files.flatMap(scanFile).filter(a => order[a.sev] <= (order[min] ?? 2));
  all.sort((a, b) => order[a.sev] - order[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);
  const rel = f => path.relative(process.cwd(), f) || f;
  if (json) { console.log(JSON.stringify(all.map(a => ({ ...a, file:rel(a.file) })), null, 1)); }
  else {
    for (const a of all) console.log(`${a.sev.padEnd(5)} ${rel(a.file)}:${a.line}  [${a.id}] ${a.msg}\n      ${a.snippet}\n      → ${a.fix}`);
    const c = s => all.filter(a => a.sev === s).length;
    console.log(`\n${files.length} arquivos · ${all.length} achados (alto ${c('alto')}, médio ${c('médio')}, baixo ${c('baixo')})`);
    if (!all.length) console.log('Nada com cara de gerado por aqui.');
  }
  if (strict && all.some(a => a.sev === 'alto')) process.exit(1);
}
if (require.main === module) main();
module.exports = { scanFile, RULES };
