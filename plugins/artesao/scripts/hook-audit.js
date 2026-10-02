#!/usr/bin/env node
'use strict';
// Hook PostToolUse (Edit|Write|MultiEdit): varre o arquivo recém-editado e devolve os achados como contexto.
// Nunca bloqueia; nunca falha (saída 0 sempre).
const path = require('node:path');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(input || '{}'), file = j.tool_input?.file_path || j.tool_input?.path || j.tool_response?.filePath;
    if (!file || !/\.(js|mjs|ts|css|html|md|json)$/i.test(file)) return;
    const { scanFile } = require(path.join(__dirname, 'audit.js'));
    const found = scanFile(file).filter(a => a.sev !== 'baixo').slice(0, 8);
    if (!found.length) return;
    const rel = path.relative(process.cwd(), file) || file;
    const text = `Artesão: ${found.length} sinal(is) de texto ou estilo gerado em ${rel}:\n` + found.map(a => `- linha ${a.line} [${a.sev}] ${a.msg}: "${a.snippet}" → ${a.fix}`).join('\n') + '\nCorrija antes de dar por pronto, ou diga por que fica assim.';
    process.stdout.write(JSON.stringify({ hookSpecificOutput:{ hookEventName:'PostToolUse', additionalContext:text } }));
  } catch {}
});
