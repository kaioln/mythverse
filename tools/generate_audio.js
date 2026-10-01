'use strict';
// Demonstração oficial gratuita. Assets são produzidos uma vez, nunca durante o jogo.
const fs = require('node:fs/promises'), path = require('node:path');
const host = 'https://stabilityai-stable-audio-3.hf.space';
const tracks = [
  ['city',90,'small-music','Instrumental fantasy MMORPG village soundtrack, 84 BPM, D major. Cherry blossom lantern festival in a Japanese mountain town at dusk. Memorable warm pentatonic bamboo flute melody, koto arpeggios, soft pizzicato strings, felt piano, delicate hand percussion, acoustic bass. Cozy nostalgic inviting adventure. Original composition, clean stereo acoustic orchestration, main theme with contrasting bridge and reprise. No vocals, chanting or speech.'],
  ['battle',90,'small-music','Original instrumental fantasy MMORPG battle soundtrack, 132 BPM, D minor. Melodic Japanese folk orchestral adventure. Driving taiko and acoustic drums, rhythmic koto, energetic string ostinato, soaring flute main melody, warm French horns. Brave exciting tactical battle, clear themes and tension-release sections, never harsh or chaotic, clean balanced game soundtrack. No voices, no choir, no existing songs.'],
  ['boss',90,'small-music','Original instrumental fantasy MMORPG boss battle score, 144 BPM, D minor. An eclipsed moon over a cherry blossom kingdom, ancient guardians awaken. Heavy ceremonial taiko, dramatic low strings, powerful brass, fast koto ostinato, haunting bamboo flute melody, shimmering bells, heroic contrasting bridge. Epic danger and hope, memorable musical themes, clean cinematic stereo mix. No vocals, no choir, no speech.'],
  ['blade',3,'small-sfx','Single swift katana slash, airy swoosh followed by crisp steel impact and a very short metallic ring. Dry isolated polished fantasy RPG sound effect. No voice, no music.'],
  ['stone',3,'small-sfx','Single heavy stone guardian fist impact, deep compact thud, crunching rock fragments, brief gravel fall. Powerful weight, no long rumble. Isolated fantasy game effect, no music, no speech.'],
  ['fire',3,'small-sfx','Single magical fire attack, quick hot air ignition whoosh, sharp explosive flame impact, fading sparks and crackle. Polished isolated fantasy game effect, no speech, no music.'],
  ['frost',3,'small-sfx','Single ice lance attack, rapid crystalline shimmer sweep, sharp frozen glass-like impact, delicate ice fragments falling. Clean isolated fantasy game effect, no voice, no music.'],
  ['storm',3,'small-sfx','Single magical lightning bolt, tense electrical charging chirp, immediate crackling thunder snap, brief electric sparks fading. Crisp isolated fantasy game effect, not an ambient storm. No voice or music.'],
  ['water',3,'small-sfx','Single concentrated magical water spear, fast rushing liquid sweep, dense splash impact, tiny droplets falling. Isolated clear fantasy battle sound, no music, no speech.'],
  ['light',3,'small-sfx','Single celestial healing spell, luminous soft rising crystal chimes, warm magical pulse, brief airy sparkling tail. Gentle clean isolated fantasy RPG sound effect, no music, no speech.'],
  ['shadow',3,'small-sfx','Single shadow assassin spell, swift whispered air suction, deep hollow magical strike and a short dark resonant decay. Isolated fantasy game sound, no actual whispers or voices, no music.'],
  ['nature',3,'small-sfx','Single magical root strike, fast wooden creak sweep, firm bark impact, brief leaves rustling. Clean isolated fantasy battle sound effect, no voice, no music.'],
  ['wind',3,'small-sfx','Single fast magical wind blade attack, focused airy cutting sweep, crisp air burst impact, short fluttering tail. Isolated professional game effect, no speech, no music.'],
  ['arrow',3,'small-sfx','Single bow attack, taut bowstring pluck, fast arrow flight whistle, short solid wooden target impact. Clean close isolated fantasy RPG sound effect, no music, no speech.'],
  ['eclipse',5,'small-sfx','Ancient eclipse king unleashes a dark magical blast. Brief ominous deep charging resonance, massive but controlled shadow impact, fading ethereal glass particles. Distinct cinematic fantasy boss sound effect, no speech or music.'],
  ['mizuchi',5,'small-sfx','Ancient sea dragon attack, huge rushing wave charges then strikes with a deep watery impact and short bubbling spray tail. Powerful unique isolated fantasy boss effect, no voice, no music.'],
  ['apep',5,'small-sfx','Ancient time serpent attack, sand rapidly swirls around a ticking crystalline hourglass then shatters with a powerful deep impact and raining golden shards. Unique fantasy boss sound effect, no voice or music.']
];
async function generate(t, seed) {
  const [id,duration,variant_key,prompt] = t;
  const dir = path.resolve(__dirname, '../assets/audio', variant_key === 'small-music' ? 'music' : 'sfx');
  const file = path.join(dir, `${id}.wav`);
  if ((await fs.stat(file).catch(() => null))?.size > 1000 || (await fs.stat(path.join(dir, `${id}.mp3`)).catch(() => null))?.size > 1000) { console.log(`EXISTS ${id}`); return; }
  await fs.mkdir(dir, { recursive:true });
  const res = await fetch(`${host}/gradio_api/call/v2/infer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ variant_key,prompt,duration,steps:8,cfg_scale:1,sampler_type:'pingpong',seed }) });
  if (!res.ok) throw new Error(`${id}: geração rejeitada (${res.status}).`);
  const { event_id } = await res.json(); if (!event_id) throw new Error(`${id}: sem id de geração.`);
  console.log(`QUEUED ${id} ${event_id}`);
  const events = await fetch(`${host}/gradio_api/call/infer/${event_id}`, { signal:AbortSignal.timeout(300000) });
  let pending = '', output;
  for await (const chunk of events.body) {
    pending += Buffer.from(chunk).toString();
    let n;
    while ((n = pending.indexOf('\n\n')) >= 0) {
      const message = pending.slice(0,n); pending = pending.slice(n+2);
      const data = message.split('\n').find(s => s.startsWith('data:'))?.slice(5).trim();
      if (message.includes('event: error')) throw new Error(`${id}: ${data || 'fila gratuita indisponível'}. Sem repetição automática.`);
      if (message.includes('event: complete')) output = JSON.parse(data)?.[0];
    }
  }
  if (!output?.url || new URL(output.url).origin !== host) throw new Error(`${id}: resultado ausente ou inválido.`);
  const audio = await fetch(output.url); if (!audio.ok) throw new Error(`${id}: download falhou (${audio.status}).`);
  const bytes = Buffer.from(await audio.arrayBuffer());
  if (bytes.toString('ascii',0,4) !== 'RIFF') throw new Error(`${id}: formato inesperado.`);
  await fs.writeFile(file, bytes); console.log(`GENERATED ${id} ${bytes.length} bytes`);
}
(async()=>{ const selected = process.argv[2]; for (let i=0; i<tracks.length; i++) if (!selected || tracks[i][0] === selected) await generate(tracks[i],309300+i); })().catch(e=>{ console.error(e.message); process.exitCode=1; });
