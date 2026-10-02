"""Vozes de combate pela API de fala da OpenAI: esforços dos heróis (sem palavras), chamadas de ultimate e as vozes
cruas dos monstros e chefes, que tools/sfx_lab.py transforma (grave, distorção, eco) antes de irem para o jogo.

Saída (cache local, fora do repositório): data/voice-raw/<id>.wav, 24 kHz mono.
  hero-<id>-a   esforço curto de ataque       hero-<id>-b   grito de habilidade       hero-<id>-h   gemido ao levar dano
  hero-<id>-u   chamada da ultimate (o nome do golpe)
  fam-<família>-atk|hurt|die      monstros (raposa, oni, golem, aranha, espírito, espectro, dragão, serpente, baú)
  boss-<id>-roar|hurt|die         chefes de região e chefes mundiais

Uso: python tools/voice_gen.py [heroes|creatures|all] [<id> ...] [--force] [--jobs N]
A chave vem de OPENAI_API_KEY (ambiente) ou do .env. Custo: frações de centavo por clipe (anotado em frames-ledger.json).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_art import HEROES, ROOT, api_key  # noqa: E402
from hero_frames import log_cost  # noqa: E402

RAW = os.path.join(ROOT, 'data', 'voice-raw')
MODEL = 'gpt-4o-mini-tts'
# id → (voz, descrição curta de quem fala). Vozes femininas: coral, nova, shimmer, sage, marin; masculinas: ash, ballad,
# echo, onyx, verse, cedar, fable.
CAST = {
    'solen': ('verse', 'rapaz de dezoito anos, mago do sol, animado'), 'varyon': ('ash', 'príncipe de vinte e poucos anos, orgulhoso e frio'),
    'hayato': ('ballad', 'garoto de dezesseis anos, forte e risonho'), 'ren': ('echo', 'rapaz de dezenove anos, calado e sério'),
    'tobias': ('onyx', 'homem grande de trinta e poucos anos, bonachão, voz grossa'), 'kenji': ('cedar', 'espadachim de quase trinta anos, seco e confiante'),
    'hiro': ('echo', 'rapaz de dezessete anos, cansado e sombrio'), 'yuki': ('shimmer', 'menina de catorze anos, delicada e calma'),
    'akira': ('ballad', 'garoto de quinze anos, determinado e ágil'), 'hana': ('coral', 'menina de treze anos, brava e barulhenta'),
    'sora': ('verse', 'estudioso de vinte e poucos anos, tranquilo'), 'daichi': ('ash', 'rapaz de dezessete anos, baixo e muito forte, bruto'),
    'lucan': ('cedar', 'veterano de cinquenta anos, voz rouca e firme'), 'mira': ('nova', 'mulher de vinte anos, atlética e decidida'),
    'erik': ('onyx', 'gigante de quarenta anos, voz muito grave'), 'alden': ('fable', 'rapaz gordinho e alegre de vinte e poucos anos'),
    'ignis': ('cedar', 'coronel de quarenta anos, severo'), 'toma': ('ballad', 'garoto de quinze anos, empolgado'),
    'ryo': ('ash', 'garoto de dezesseis anos, esquentado'), 'grant': ('onyx', 'paladino enorme e alegre de trinta anos'),
    'kenta': ('cedar', 'mestre de quarenta anos, calmo e preguiçoso'), 'volt': ('echo', 'autômato de voz metálica e sem emoção'),
    'kai': ('coral', 'menino de doze anos, selvagem e risonho'), 'riku': ('ballad', 'garoto de catorze anos, travesso'),
    'elian': ('sage', 'sacerdote sereno e andrógino de vinte e poucos anos'), 'aiko': ('shimmer', 'moça de dezoito anos, de fala mansa'),
    'kiba': ('ash', 'homem feroz de vinte e poucos anos, meio lobo, voz áspera'), 'jin': ('cedar', 'andarilho calmo de trinta anos'),
    'drake': ('verse', 'rapaz convencido de dezenove anos'), 'sienna': ('marin', 'guerreira de trinta anos, severa'),
    'daigo': ('onyx', 'monge lutador de vinte e poucos anos, voz forte'), 'mei': ('nova', 'lutadora ágil e confiante de vinte e poucos anos'),
    'kael': ('ash', 'mercenário cansado de quase trinta anos'), 'sael': ('sage', 'mulher fria e sem idade, voz baixa'),
    'rina': ('coral', 'lutadora alegre de vinte e poucos anos'), 'nadia': ('marin', 'exploradora de trinta anos, despachada'),
    'thorn': ('cedar', 'velho de sessenta anos, voz rouca e teimosa'), 'bjorn': ('coral', 'criança de doze anos, séria'),
    'rook': ('onyx', 'comandante veterano de quarenta anos'), 'warden': ('onyx', 'carrasco calado, voz muito grave e abafada por uma máscara'),
    'zara': ('nova', 'garota de dezessete anos, caótica e risonha'), 'kira': ('shimmer', 'espírito raposa de voz sedosa e debochada'),
    'haru': ('verse', 'espadachim andarilho de vinte e poucos anos, relaxado'), 'ivy': ('nova', 'mensageira de dezenove anos, cheia de energia'),
    'nari': ('coral', 'menina piloto de quinze anos'), 'aurelia': ('marin', 'médica de campo de trinta anos, calma'),
    'dario': ('ash', 'ladrão de trinta anos, voz baixa'), 'cole': ('ballad', 'guarda novato de vinte e cinco anos'),
    'dana': ('marin', 'sobrevivente de trinta anos, dura'), 'wade': ('cedar', 'patrulheiro de quarenta anos, voz seca'),
    'garrick': ('onyx', 'ferreiro de cinquenta anos, voz grossa'), 'zira': ('nova', 'espadachim de dezoito anos, afiada'),
    'n9': ('sage', 'androide de voz calma e artificial'), 'unit7': ('echo', 'androide de combate, voz dura e metálica'),
    'rex': ('verse', 'pistoleiro exibido de quase trinta anos'), 'virel': ('ash', 'espadachim frio de quase trinta anos'),
    'selene': ('sage', 'bruxa teatral de trinta anos'), 'tessa': ('nova', 'caçadora de vinte anos, firme'),
    'kaji': ('onyx', 'lutador assombrado, voz abafada por uma máscara'), 'kori': ('echo', 'mago do gelo de vinte e poucos anos, contido'),
}
EFFORT = "Dublagem de jogo de luta, em português brasileiro. Personagem: {who}. {what} Sem palavras, sem frases, sem comentários, sem música: só a voz do personagem, uma única vez."
HERO_CLIPS = {
    'a': ('Há!', 'Solte um único grito curto e seco de esforço ao dar um golpe (um kiai).'),
    'b': ('Haaaaaah!', 'Solte um único grito forte e mais longo, de quem solta uma técnica com tudo.'),
    'h': ('Ugh!', 'Solte um único gemido curto de dor, de quem acabou de levar um golpe.'),
}
ULT = "Dublagem original de RPG de fantasia, em português brasileiro. Personagem: {who}. Grite o nome do golpe final com determinação, uma única vez, sem comentários, sem música."
# Monstros: uma voz crua por família; o jogo muda o tom de cada criatura.
BEAST = "Efeito de voz para jogo. Você é {who}. {what} Nenhuma palavra, nenhuma fala humana, nenhum comentário: só o som da criatura, uma única vez."
FAMILIES = {
    'fox': ('onyx', 'uma raposa espiritual feroz', {'atk': ('Grrraaf!', 'Um rosnado curto e agressivo seguido de uma mordida.'), 'hurt': ('Kaiiin!', 'Um ganido curto e agudo de dor.'), 'die': ('Auuuuuuhhh…', 'Um uivo fraco e triste que vai morrendo.')}),
    'oni': ('onyx', 'um ogro demoníaco enorme e bruto', {'atk': ('GRAAAAH!', 'Um urro grave e curto de quem desce uma clava.'), 'hurt': ('Urrgh!', 'Um grunhido grave de dor.'), 'die': ('Grrraaaaaauuhh…', 'Um urro longo e grave que perde a força e cai.')}),
    'golem': ('onyx', 'um golem de pedra gigante e lento', {'atk': ('Rrrrrmmm!', 'Um ronco grave e arrastado, como pedra raspando em pedra.'), 'hurt': ('Mmmrgh.', 'Um gemido grave e oco.'), 'die': ('Rrrrmmmmmmmm…', 'Um ronco grave e longo que vai se apagando.')}),
    'spider': ('sage', 'uma aranha gigante', {'atk': ('Ksssshh-tk-tk-tk!', 'Um sibilo agudo e seco com estalos da boca.'), 'hurt': ('Skriii!', 'Um guincho agudo e curto.'), 'die': ('Skriiiiiiiiih…', 'Um guincho longo e agudo que vai sumindo.')}),
    'wisp': ('sage', 'um espírito de fogo-fátuo', {'atk': ('Fwoooosh-haaa!', 'Um sopro etéreo e rápido, quase um suspiro com eco.'), 'hurt': ('Hiiih!', 'Um suspiro agudo e assustado.'), 'die': ('Haaaaaaaaaaah…', 'Um suspiro longo e triste que se desfaz no ar.')}),
    'revenant': ('ash', 'um espectro morto-vivo de armadura', {'atk': ('Hrraaahh!', 'Um gemido rouco e ameaçador de fantasma atacando.'), 'hurt': ('Aaargh…', 'Um lamento rouco de dor.'), 'die': ('Aaaaaaaaaahhhh…', 'Um lamento longo e fantasmagórico que desaparece.')}),
    'dragon': ('onyx', 'um dragão colossal', {'atk': ('ROOOAAAAAR!', 'Um rugido enorme, grave e poderoso.'), 'hurt': ('Grrraaoww!', 'Um rugido curto de dor e raiva.'), 'die': ('Rooooooaaaaaarrrhhh…', 'Um rugido longo que enfraquece até o silêncio.')}),
    'serpent': ('ash', 'uma serpente gigante do deserto', {'atk': ('Ssssssshhhaaaa!', 'Um silvo longo e ameaçador de cobra gigante dando o bote.'), 'hurt': ('Hssssk!', 'Um silvo curto e raivoso de dor.'), 'die': ('Ssssssssssshhhh…', 'Um silvo longo que vai morrendo.')}),
    'mimic': ('fable', 'um baú mímico faminto', {'atk': ('Nhac! Nhac!', 'Duas mordidas rápidas e famintas, com a boca.'), 'hurt': ('Bleurgh!', 'Um arroto de dor.'), 'die': ('Bluuuuuurgh…', 'Um gemido molhado que desmorona.')}),
}
BOSSES = {
    'eclipse': ('onyx', 'Shirogane, o Rei do Eclipse, um rei de armadura, frio e antigo'),
    'dragon': ('onyx', 'Mizuchi, um dragão do mar colossal'),
    'lantern_kitsune': ('shimmer', 'uma raposa de nove caudas, espírito do festival, de voz feminina e sobrenatural'),
    'dragon_amber': ('ash', 'Apep, uma serpente colossal do deserto'),
    'raijin': ('onyx', 'Raijin, o deus do trovão, enlouquecido'),
    'wb_titan': ('onyx', 'um titã de pedra do tamanho de uma montanha'),
    'wb_frost_dragon': ('onyx', 'Glacius, um dragão de gelo majestoso'),
    'wb_storm_kitsune': ('shimmer', 'uma raposa de nove caudas do trovão, de voz feminina e feroz'),
    'wb_blood_moon': ('sage', 'a Rainha da Lua Sangrenta, uma rainha guerreira cruel'),
}
BOSS_CLIPS = {
    'roar': ('GRRRRAAAAAAAAAHHH!', 'Um brado de guerra longo e ameaçador, de quem prepara um golpe devastador.'),
    'hurt': ('Urrrgh!', 'Um grunhido de dor e raiva ao ser ferido.'),
    'die': ('Aaaaaarrrrgggghhh…', 'Um grito final longo, de derrota, que enfraquece até o silêncio.'),
}


def clips(which):
    out = []
    data = {}
    if which in ('heroes', 'all'):
        sys.path.insert(0, ROOT)
        for hid, (voice, who) in CAST.items():
            for k, (text, what) in HERO_CLIPS.items():
                out.append((f'hero-{hid}-{k}', voice, text, EFFORT.format(who=who, what=what)))
        # A chamada da ultimate é de cada forma (as despertadas têm golpe próprio), na voz do herói de origem.
        for hid, (base, name) in ult_names().items():
            if base in CAST:
                out.append((f'hero-{hid}-u', CAST[base][0], f'{name}!', ULT.format(who=CAST[base][1])))
    if which in ('creatures', 'all'):
        for fam, (voice, who, cl) in FAMILIES.items():
            for k, (text, what) in cl.items():
                out.append((f'fam-{fam}-{k}', voice, text, BEAST.format(who=who, what=what)))
        for bid, (voice, who) in BOSSES.items():
            for k, (text, what) in BOSS_CLIPS.items():
                out.append((f'boss-{bid}-{k}', voice, text, BEAST.format(who=who, what=what)))
    return out


def ult_names():
    """id → (herói de origem, nome da ultimate), lido de src/roster.js com o Node para não repetir os dados aqui."""
    import subprocess
    js = "global.KT={};require('./src/data.js');require('./src/roster.js');console.log(JSON.stringify(Object.fromEntries(KT.Data.roster.map(h=>[h.id,[h.base||h.id,h.ult.name]]))))"
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=60, check=True).stdout)


def generate(clip, force=False):
    cid, voice, text, instr = clip
    target = os.path.join(RAW, f'{cid}.wav')
    if os.path.exists(target) and os.path.getsize(target) > 2000 and not force:
        return True
    key = api_key()
    body = json.dumps({'model': MODEL, 'voice': voice, 'input': text, 'instructions': instr, 'response_format': 'wav'}).encode()
    for attempt in range(5):
        req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                data = res.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:200]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(4 + attempt * 6); continue
            print(f'{cid:28s} API {e.code}: {msg}', flush=True)
            return False
        except Exception as e:  # rede
            if attempt < 4:
                time.sleep(3); continue
            print(f'{cid:28s} falhou: {str(e)[:120]}', flush=True)
            return False
        if len(data) < 2000:
            print(f'{cid:28s} áudio vazio', flush=True)
            return False
        open(target, 'wb').write(data)
        secs = max(0, len(data) - 44) / 48000   # 24 kHz, 16 bits, mono
        # gpt-4o-mini-tts: cerca de US$ 0,015 por minuto de áudio gerado.
        log_cost({'hero': cid, 'kind': 'voice', 'model': MODEL, 'usd': round(secs / 60 * .015 + .0002, 5), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        print(f'{cid:28s} ok {secs:.1f}s', flush=True)
        return True
    return False


def main():
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--jobs']
    which = args[0] if args and args[0] in ('heroes', 'creatures', 'all') else 'all'
    only = [a for a in args if a not in ('heroes', 'creatures', 'all')]
    jobs = int(sys.argv[sys.argv.index('--jobs') + 1]) if '--jobs' in sys.argv else 4
    os.makedirs(RAW, exist_ok=True)
    todo = [c for c in clips(which) if not only or any(o in c[0].split('-') for o in only)]
    with ThreadPoolExecutor(jobs) as pool:
        ok = list(pool.map(lambda c: generate(c, '--force' in sys.argv), todo))
    print(f'{sum(ok)}/{len(todo)} vozes', flush=True)


if __name__ == '__main__':
    main()
