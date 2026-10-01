'use strict';
// Geração local de falas de combate. A credencial existe só no processo.
const fs = require('node:fs/promises'), path = require('node:path'), vm = require('node:vm');
async function main() {
  if (!process.argv.includes('--allow-paid')) throw new Error('Geração paga desativada. Requer autorização explícita e --allow-paid.');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Configure OPENAI_API_KEY apenas no processo de geração.');
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'assets/audio/voices');
  const sandbox = { KT:{} }; sandbox.globalThis = sandbox;
  for (const file of ['data.js','roster.js']) vm.runInNewContext(await fs.readFile(path.join(root, 'src', file), 'utf8'), sandbox);
  const D = sandbox.KT.Data, voices = ['cedar','ash','ballad','echo','fable','onyx','marin','sage','coral','nova','shimmer','verse'];
  const presets = { erik:'onyx', akira:'ballad', mercy_valkyrie:'marin', warden:'ash', aurelia:'marin' };
  const clips = D.roster.flatMap((h, i) => ['skill','ult'].map(kind => ({ id:`hero-${h.sprite}-${kind}`, input:`${h[kind].name}!`, voice:presets[h.sprite] || voices[i % voices.length], style:`${h.name}, ${h.cls} de ${h.world}, elemento ${h.el}. Voz original consistente entre as habilidades. ${kind === 'ult' ? 'Determinação intensa, ataque decisivo.' : 'Chamada rápida, concentrada.'} Sem gritar de modo estridente.` })));
  for (const boss of Object.values(D.enemies).filter(e => e.boss)) clips.push({ id:`boss-${boss.sprite}`, input:`${boss.phases?.[0]?.specials?.[0]?.name || boss.skill?.name || boss.name}!`, voice:boss.el === 'Luz' || boss.el === 'Gelo' ? 'sage' : 'onyx', style:`${boss.name}. Antagonista ancestral de fantasia, elemento ${boss.el}. Ameaça solene, personalidade própria, voz grave sem imitar pessoas reais.` });
  await fs.mkdir(out, { recursive:true });
  // Só estes ids são admitidos pelo cliente; nenhum diálogo de morador.
  const index = [];
  for (const clip of clips) {
    const file = path.join(out, `${clip.id}.mp3`);
    if ((await fs.stat(file).catch(() => null))?.size > 1000) { index.push(clip.id); continue; }
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method:'POST', headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:'gpt-4o-mini-tts-2025-12-15', voice:clip.voice, input:clip.input,
        instructions:`Português brasileiro. Dublagem original de RPG de fantasia. ${clip.style} Fale somente a chamada, sem comentários, sem música nem efeitos de fundo.`, response_format:'mp3' }),
      signal:AbortSignal.timeout(90000)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`OpenAI ${res.status}: ${err.error?.code || err.error?.type || 'generation_failed'} (${clip.id}). Sem repetição automática.`); }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`Áudio incompleto: ${clip.id}.`);
    await fs.writeFile(file, bytes); index.push(clip.id);
    await fs.writeFile(path.join(out, 'index.json'), JSON.stringify(index));
    console.log(`GENERATED ${clip.id}`);
  }
  await fs.writeFile(path.join(out, 'index.json'), JSON.stringify(index));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
