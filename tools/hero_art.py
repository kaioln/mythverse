"""Arte original dos heróis: design único por herói (rosto, corpo, roupa, arma) e o pedido de geração.

Cada herói é gerado sozinho numa folha de 8 poses (2 linhas × 4) com o gerador de imagens do Codex:
  linha 1: parado · respirando · correndo · levando dano
  linha 2: preparando o golpe · golpe · fim do golpe · poder especial
O tools/build_anim.py recorta as poses, alinha os pés e monta sprite, retrato e folha de animação.

Regras: nada de referência a personagens ou obras existentes; cada herói precisa de um rosto e uma silhueta
reconhecíveis por si só. Uso: python tools/hero_art.py <id> [<id> ...]   (gera em assets/original/poses/)
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'original', 'poses')

STYLE = (
    "PROPORTIONS (strict): chunky chibi, the head is about one third of the total height, short legs, big hands and feet; "
    "every pose keeps these proportions. "
    "ART DIRECTION (very important, it must look drawn by a human illustrator, not by AI): hand-inked illustration with "
    "confident brush lines of varied thickness like sumi ink, small wobbles and line breaks, a few loose sketch strokes; "
    "flat colors with 2-3 tone cel shading, light ink hatching in the shadows, a subtle washi-paper grain inside the colors; "
    "limited palette of 5 or 6 muted colors; restrained ornament (no filigree, no gold trim everywhere, no pile of belts and "
    "pouches, no glossy highlights). "
    "FACE: an individual face with texture: visible skin marks (freckles, pores, scars, wrinkles or blush as described), a "
    "specific nose shape and eyebrows. EYES: small and simple, drawn by hand as ink dots or narrow almond shapes with one "
    "line for the lid; NO big glossy anime eyes, NO multiple white highlights, NO gradient irises, NO sparkles; the eye shape "
    "follows the description. "
    "Must not resemble any existing anime, manga, comic, film or video game character. Transparent background, no text, "
    "no labels, no frame, no scenery, no ground shadow, no aura, no particles except where a pose asks for them."
)
LAYOUT = (
    "Create exactly one landscape image: an animation pose sheet of ONE original hero for a 2D side-view RPG. Eight poses "
    "in 2 rows of 4, all the SAME character with identical face, hair, outfit, colors and scale, every pose facing right, "
    "whole body visible with feet on the row's ground line, and wide empty space between poses so they never touch. "
    "Row 1: (1) idle ready stance, (2) the same idle stance breathing in (shoulders slightly raised), (3) running forward, "
    "(4) flinching from a hit. Row 2: (5) attack wind-up, (6) attack at full extension, (7) follow-through recovering, "
    "(8) special move."
)

# id: (nome, classe, elemento, design)
HEROES = {
    # ---- Picos de Aurum · Vila do Redemoinho · Arquipélago das Velas · Vale das Almas · Montanhas do Carvão ----
    'solen': ('Hinata Asahi', 'Arcanista', 'Luz', "Late teens, slim and a little short; round face with a small upturned nose, thick straight eyebrows, faint burn scar on the left cheek, warm amber eyes, easy grin with one chipped front tooth; short wavy pale-gold hair with an uneven self-cut fringe. Long off-white travel coat patched at the elbows with a sun disc sewn on the back, brown trousers, worn boots. Weapon: brass orrery staff with a small sun sphere. Special: raises the staff as the sphere flares."),
    'varyon': ('Shiden, o Príncipe Cinza', 'Executor', 'Raio', "Early twenties, tall and wiry, dark brown skin; long narrow face, high cheekbones, strong nose, heavy-lidded bored eyes, a thin mustache, small gold ring in one ear; short black locs tied back with a violet ribbon. Worn grey fencing jacket with one torn sleeve, dark trousers, tall riding boots. Weapon: a plain slim rapier with a violet spark along the blade. Special: a lunging thrust trailing violet lightning."),
    'hayato': ('Hayato Kazeno', 'Vanguarda', 'Vento', "Sixteen, stocky and broad for his age; square jaw, gap-toothed laugh, freckles across a sunburnt nose, bandage on the chin; short black hair shaved on the sides with a small feather tucked behind one ear. Quilted pale-green padded armor, rope belt, straw sandals. Weapon: a big round wooden shield rimmed with iron and a short club. Special: plants the shield and a gust of wind bursts from it."),
    'ren': ('Rai Kurogane', 'Arcanista', 'Raio', "Nineteen, lanky, quiet; long pale face, dark circles under narrow grey eyes, a mole under the right eye, thin lips; messy shoulder-length dark-blue hair hiding one ear, a silver ear cuff. High-collared charcoal scholar's robe with ink stains on the cuffs. Focus: a string of five paper thunder talismans. Special: the talismans fan out and crackle with yellow lightning."),
    'tobias': ('Tobimaru da Maré', 'Vanguarda', 'Fogo', "Thirties, very heavy and strong with a big belly; broad red-cheeked face, flattened boxer's nose, bushy auburn sideburns and a short beard, laugh lines; curly auburn hair tied with a knotted cloth. Sleeveless oilskin harbor vest, rolled trousers, tattoo of a wave on one forearm. Weapon: a heavy iron anchor on a chain. Special: swings the anchor in a flaming arc."),
    'kenji': ('Kenji Sanjin', 'Executor', 'Vento', "Late twenties, lean and sinewy, tan skin; long face with a crooked scar through the upper lip, stubble, a leather eyepatch over the left eye, calm expression; long black hair in a single braid down the back. Dark-red sleeveless jacket over grey wraps, bandaged hands. Weapons: one long curved blade and two short knives worn on the back. Special: a spinning cut with the long blade and a thrown knife."),
    'hiro': ('Hiro Kagetsu', 'Executor', 'Sombra', "Seventeen, thin and pale; sharp chin, tired half-closed dark eyes, a small cut on the nose, sullen mouth; straight black hair with a single white streak, cut blunt at the jaw. Layered dark purple coat with a crescent clasp, grey hakama. Weapon: a single-edged blade of smoky black glass. Special: a wide crescent slash leaving a dark trail."),
    'yuki': ('Yuki Shirasagi', 'Suporte', 'Gelo', "Fourteen, small and delicate; oval face, big calm grey eyes, rosy nose from the cold, a shy smile; short white hair with a blunt fringe and a heron-feather clip. Thick pale-blue quilted winter robe with mittens hanging from strings. Weapon: a small wooden staff topped with a bronze bell. Special: rings the bell and snowflakes gather into a shield."),
    'akira': ('Akira Minase', 'Executor', 'Água', "Fifteen, lean and quick; round determined face, big dark-teal eyes, thick eyebrows, sticking plaster on one cheek; short choppy brown hair with a plain blue cloth headband. Short indigo fisherman's jacket with a single white wave line on the hem, rolled trousers, straw sandals. Weapon: a straight river-guard blade. Special: a spinning slash that throws a ribbon of water."),
    'hana': ('Hana Minase', 'Vanguarda', 'Fogo', "Thirteen, small and fierce; heart-shaped face, freckles, a missing tooth, big angry orange eyes; wild copper hair in two short puffs. Oversized red lacquered shoulder guard over an orange work tunic, bandaged knees. Weapon: a spiked wooden war-club glowing like coals. Special: slams the club and a burst of embers rises."),
    # ---- Academia do Véu · Muralhas de Eldria · Cidade da Transmutação · Academia dos Dons ----
    'sora': ('Sora Hakuren', 'Arcanista', 'Luz', "Mid-twenties, tall and relaxed, olive skin; long face, round wire glasses, a sly half smile, stubble; neat dark hair parted in the middle and tucked behind the ears. Cream scholar's coat with ink-stained sleeves, satchel of scrolls. Focus: a floating open book. Special: pages fly out and form a ring of light squares."),
    'daichi': ('Daichi Kuroba', 'Vanguarda', 'Sombra', "Seventeen, short and very muscular; blocky face, scar through the left eyebrow, flat nose, fierce grin; buzzed dark-green hair. Grey sleeveless hoodie, cargo trousers, heavy boots. Weapons: two massive black iron gauntlets set with purple stones. Special: smashes both fists together releasing a purple shockwave."),
    'lucan': ('Genzō Asagiri', 'Executor', 'Vento', "Fifty, weathered but fit; long lined face, grey stubble, hawk nose, one ear notched, calm pale-green eyes; grey-blond hair in a short tail. Moss-green scale jerkin under a brown hooded travel cloak. Weapons: two short straight swords. Special: a double spinning cut with green wind trails."),
    'mira': ('Mirai Asagiri', 'Executor', 'Vento', "Twenty, athletic, dark brown skin; oval face, bold nose, strong jaw, determined eyes; short black hair shaved on one side with a hawk feather. Sage-green sleeveless tunic, leather bracers, soft boots. Weapons: a pair of curved sickles. Special: a leaping double sickle strike."),
    'erik': ('Iwao Hazama', 'Vanguarda', 'Terra', "Forties, a towering giant; wide square face, thick brown beard, broken nose, heavy brow, kind small eyes; short brown hair. Ochre plate armor with rough stone-like shoulder slabs, a patched cape. Weapon: a tower shield carved from grey rock and a hammer. Special: raises the shield and rock spikes burst from the ground."),
    'alden': ('Kōji Ibara', 'Suporte', 'Terra', "Twenties, plump and cheerful; round face, big dimples, freckles, thick curly black hair, round brass goggles on the forehead. Mustard alchemist apron coat covered in burns and vial loops, rolled sleeves. Weapon: a brass gear-staff with a green bubbling core. Special: throws a vial that bursts into a healing green cloud."),
    'ignis': ('Coronel Homura Kaga', 'Arcanista', 'Fogo', "Forties, tall and severe; long gaunt face, deep smile lines, neatly trimmed goatee, piercing red eyes; slicked-back black hair greying at the temples. Crimson officer's greatcoat with brass buttons over white shirt, black gloves. Weapon: an ornate flintlock wand. Special: fires a spiralling bolt of flame."),
    'toma': ('Toma Hikari', 'Vanguarda', 'Raio', "Fifteen, gangly and eager; long face, big ears, crooked nose, huge hopeful blue eyes, nervous grin; spiky sandy-brown hair. Patched yellow work overalls with blue padding at the joints. Weapon: an oversized mechanical right gauntlet leaking sparks. Special: a charged punch releasing a blue-yellow lightning burst."),
    'ryo': ('Ryo Kazan', 'Arcanista', 'Fogo', "Sixteen, compact and hot-headed; angular face, snarling mouth, deep scowl lines, burn marks on the knuckles; short spiky dark-red hair. Black and orange sleeveless robe with frayed edges. Focus: two small floating iron braziers. Special: claps his hands and an explosion of flame blooms forward."),
    'grant': ('Takeru Ōtaka', 'Vanguarda', 'Luz', "Thirties, enormous and cheerful; big square jaw, wide white smile, cleft chin, crow's feet, short golden hair. Scuffed white and brass plate armor with a sunburst on the round shield. Weapon: a huge two-handed warhammer. Special: slams the hammer and a ring of light radiates."),
    # ---- Metrópole Cinzenta · Terras Selvagens · Reino da Lua Prateada · Era das Brumas · Guildas de Valmar ----
    'kenta': ('Mestre Kenta', 'Vanguarda', 'Luz', "Forties, lean and relaxed; long horse-like face, sleepy droopy eyes, bushy mustache, big ears; long grey-black hair in a loose ponytail and a cloth headband. Faded beige monk robe with a white sash, bare feet. Weapon: bare hands wrapped in golden cloth. Special: a single calm palm strike that sends a shockwave of light."),
    'volt': ('Jōki-7', 'Atirador', 'Fogo', "Automaton with a slim humanoid frame; porcelain-white face mask with one round red lens eye and a painted smile line, visible rivets; no hair, a small smokestack on the back. Cream and rust-red riveted plates, exposed copper joints. Weapon: an arm-mounted boiler cannon. Special: fires a blast of superheated steam and flame."),
    'kai': ('Kai Morinaga', 'Vanguarda', 'Natureza', "Twelve, small and wild; round face, scraped knees, big toothy grin, green eyes, leaf stuck in the hair; shaggy brown hair. Vest made of layered bark and leaves, rope belt, barefoot. Weapon: a tree-branch club wrapped in vines. Special: slams the club and roots burst from the ground."),
    'riku': ('Riku Shiro', 'Executor', 'Raio', "Fourteen, slim and cat-like; narrow face, pointed chin, mischievous smirk, sharp narrow eyes; short spiky orange-red hair with a black streak. Navy cropped hooded jacket, bandaged forearms, soft shoes. Weapons: a pair of short hooked claws on the wrists. Special: dashes in a zigzag of blue lightning."),
    'elian': ('Seiran Ake', 'Suporte', 'Luz', "Twenties, serene and androgynous; long thin face, pale lashes, calm closed-lip smile, small scar on the chin; long straight blond hair tied low with a red cord. White priest robes with a red stole. Weapon: a golden chain with a small bell wrapped around one arm. Special: swings the chain in a circle of light that heals."),
    'aiko': ('Aiko Tsukishiro', 'Suporte', 'Luz', "Eighteen, soft-spoken; oval face, large gentle lavender eyes, beauty mark under the lip, small nose; very long silver hair in a single low braid. Lavender and white shrine robes with a crescent embroidered on the sleeve. Weapon: a tall wooden staff with a crescent at the top, a paper moon lantern. Special: raises the lantern and a soft moonlight wave spreads."),
    'kiba': ('Kiba, o Meio-Espírito', 'Vanguarda', 'Vento', "Twenties, big and feral; wide face, sharp canines, pointed ears, wolfish grin, golden eyes, three claw scars on the cheek; long unkempt mint-green hair with two small goat horns. Grey fur mantle over a sleeveless tunic, bare arms. Weapon: a wide curved cleaver. Special: a spinning cleaver slash with a howling gust."),
    'jin': ('Jin Hayate', 'Executor', 'Vento', "Thirties, calm wanderer; long narrow face, thin mustache and chin beard, crow's feet, half-closed eyes; teal-black hair in a tidy topknot. Light grey travel kimono with a green scarf, straw hat hanging on the back. Weapon: a straight blade in a plain wooden scabbard. Special: a lightning-fast draw cut leaving a green line."),
    'drake': ('Tatsuya Hibana', 'Arcanista', 'Fogo', "Nineteen, cocky; long face, crooked grin with a fang, scarred eyebrow, orange eyes; spiky dark hair with orange tips and two small flame-shaped horns. Black sleeveless coat with red scale patterns, bandaged arms. Focus: fire coiling around his arm like a small dragon. Special: roars as a flame dragon lunges from his fist."),
    'sienna': ('Kaede Tetsuyama', 'Vanguarda', 'Terra', "Thirties, tall and stern; strong jaw, straight nose, thin scar across the forehead, grey eyes; short dark-bronze hair swept back. Bronze and brown full plate with a stone-grey cape. Weapon: a long halberd and a kite shield. Special: plants the halberd and rock plates rise around her."),
    # ---- Torneio das Nações · Planeta Esmeralda · Ruínas Perdidas · Reinos Nórdicos · Frota de Órion · Portões do Abismo ----
    'daigo': ('Daigo Arashi', 'Vanguarda', 'Fogo', "Twenties, stocky monk-fighter; wide face, thick unibrow, flat nose, small determined eyes; blue-grey hair in a short topknot, no headband. Sleeveless ochre and dark-brown quilted vest, iron-studded forearm guards, charcoal trousers, straw sandals. Weapon: bare fists. Special: a rising punch wrapped in orange flame."),
    'mei': ('Mei Lan', 'Executor', 'Vento', "Twenties, long-legged and agile; oval face, sharp eyebrows, confident smile, small mole on the cheek; long black hair in a high ponytail with a teal ribbon. Teal sleeveless tunic with wide white trousers, paper charms hanging at the belt. Weapon: steel-tipped boots. Special: a spinning high kick with a wind trail."),
    'kael': ('Kaito Arata', 'Executor', 'Raio', "Late twenties, tired mercenary; long angular face, heavy stubble, bags under the eyes, a notch in one ear; short messy dark-brown hair. Blue quilted coat with a single steel pauldron. Weapon: a slim saber with a jagged edge that glows yellow. Special: an X-shaped double slash crackling with lightning."),
    'sael': ('Karasu, a Asa Negra', 'Arcanista', 'Sombra', "Ageless and cold; narrow pale face, sharp nose, thin unsmiling lips, dark violet eyes; short black hair with a long forelock. One large black raven wing from the back, high-collared violet robe. Focus: floating dark crystal shards. Special: the crystals spiral into a spear of shadow."),
    'rina': ('Rina Akemi', 'Suporte', 'Terra', "Twenties, cheerful brawler-medic; round face, button nose, big laugh, plaster on the forehead; brown hair in two buns. Ochre martial tunic with a white medic armband, wooden bead bracelets. Weapon: fists wrapped in healing wood beads. Special: a palm strike that sends a warm golden healing wave."),
    'nadia': ('Nanami Sunaga', 'Atirador', 'Terra', "Thirties, explorer; long freckled face, wide mouth, sunburnt nose, sharp hazel eyes; messy auburn hair in a bun with a pencil through it. Khaki field jacket, green scarf, map case. Weapon: a recurve bow. Special: fires an arrow that explodes in a burst of earth."),
    'thorn': ('Gorō Shimotsuki', 'Vanguarda', 'Gelo', "Around sixty, broad and slightly hunched; round red face with deep wrinkles, bulbous nose, twinkling small blue eyes, big bushy grey mustache and no beard; thick unruly grey hair tied in a short topknot. Heavy blue-grey wool coat with a white sheepskin collar, knitted scarf, mittens tucked in the belt. Weapon: a long iron war-pick with a frosted head. Special: drives the pick into the ground raising a wall of ice."),
    'bjorn': ('Botan Shimotsuki', 'Suporte', 'Natureza', "Twelve, earnest; round face, gap teeth, rosy cheeks, green eyes; shaggy straw-blond hair with a small braid. Green fur-lined tunic, rune-carved wooden amulet, a robin perched on the shoulder. Weapon: a gnarled staff carved with runes. Special: taps the staff and a circle of glowing runes heals allies."),
    'rook': ('Comandante Rokurō', 'Atirador', 'Raio', "Forties, veteran; square face, grey crew cut, scar across the chin, calm steady eyes, helmet under one arm replaced by a headset. Bulky rounded armor in dark blue and white with yellow stripes, visible welded repairs. Weapon: a long rail rifle. Special: kneels and fires a crackling rail shot."),
    'warden': ('Mumei, o Carrasco', 'Atirador', 'Fogo', "Tall and silent; face hidden by a soot-black hood and an iron half-mask with two round eye holes, only glowing ember eyes visible; ash on the shoulders. Rust-red leather coat with iron rivets. Weapon: a twin-barrel hand cannon with glowing coals in the chamber. Special: fires both barrels in a burst of flame."),
    # ---- Cidade Subterrânea · Bosque Espiritual · Planícies de Ionar · Esquadrão Aurora · Irmandade Oculta · Cidade Infectada · Fronteira ----
    'zara': ('Suzu Hanabi', 'Atirador', 'Fogo', "Seventeen, chaotic tinkerer; small face, wide manic grin, grease smudges, gap tooth; short spiky pink hair with welding goggles. Oversized orange work jacket covered in patches, shorts over leggings, big boots. Weapon: a homemade rocket launcher made of pipes and scrap. Special: launches a wobbling rocket that explodes."),
    'kira': ('Kira das Nove Caudas', 'Arcanista', 'Luz', "Appears twenty, fox spirit; long face, narrow amused golden eyes, sly smile, small fox ears; long cream hair, several short golden fox tails. White and red shrine robe with long sleeves. Focus: floating paper lantern orbs. Special: the lanterns circle her and flare with light."),
    'haru': ('Haru Kaze', 'Executor', 'Vento', "Twenties, drifting swordsman, light brown skin; round face, lazy smile, freckles, chipped front tooth, a scar across the nose bridge; messy red-brown hair to the shoulders under a torn headcloth. Faded light-blue haori over a black shirt, bamboo hat on the back. Weapon: a long curved blade. Special: a sweeping cut sending a wind crescent."),
    'ivy': ('Itsuki Tokiwa', 'Atirador', 'Raio', "Nineteen, energetic courier; small round face, huge grin, freckles, gap in the eyebrow; short spiky blue hair. Yellow flight vest with a glowing clock gauge on the chest, fingerless gloves, running shoes. Weapons: twin small blasters. Special: blinks forward leaving an afterimage and fires both blasters."),
    'nari': ('Nari Kōkaku', 'Vanguarda', 'Raio', "Fifteen, tiny pilot, tan skin; round face, headset, braces on the teeth, determined squint; black hair in two short tails. Yellow jumpsuit with navy patches. Weapon: rides a squat round walker machine in yellow and navy with a big shield arm (the pilot sits in an open hatch on top). Special: the walker raises its shield and a lightning barrier forms."),
    'aurelia': ('Akane Tsubasa', 'Suporte', 'Luz', "Thirties, field medic; long face, calm tired eyes, laugh lines, freckled nose; short blond hair pinned back. White and brass medic armor, a satchel with a red cross replaced by a golden leaf symbol, two small crystal wings. Weapon: a slender staff with a glowing leaf tip. Special: spreads the wings and a warm healing light pours down."),
    'dario': ('Daisuke Yane', 'Executor', 'Sombra', "Thirties, rooftop rogue; lean face half covered by a dark scarf, sharp eyebrows, scar across the left eye, dark eyes; short curly black hair under a short violet hood. Black and violet layered leather, soft boots. Weapons: a short curved dagger and a forearm spike. Special: a leaping dive attack from above."),
    'cole': ('Kōta Harada', 'Atirador', 'Fogo', "Twenty-five, rookie guard, dark brown skin; square face, cleft chin, earnest eyes, bandage on the cheek; short black hair in a tight fade. Reddish-brown leather patrol jacket, lantern on the belt. Weapon: a heavy revolver. Special: fans the hammer firing three fiery shots."),
    'dana': ('Nagi Kusano', 'Suporte', 'Natureza', "Thirties, tough survivor; angular face, tired sharp green eyes, scar on the lip; short dark hair under a green bandana. Green field vest with herb pouches, bandage roll on the arm. Weapon: a staff with a flask of green healing mist. Special: sprays a cloud of green healing mist."),
    'wade': ('Watari Kōya', 'Atirador', 'Terra', "Forties, frontier ranger; long sun-worn face, grey-streaked stubble, crinkled eyes, crooked smile; long brown hair under a wide ochre hat with a feather. Tan poncho, red neckerchief, spurred boots. Weapon: a lever rifle. Special: fires a spinning shot that kicks up dust."),
    # ---- Reinos do Norte · Guerra das Máquinas · Cidade dos Demônios · Terras das Máquinas · Torneio do Submundo ----
    'garrick': ('Gantetsu do Vale', 'Arcanista', 'Fogo', "Fifties, rune smith; broad face, thick red beard with grey streaks, burn scars on the hands, soot on the nose, bright eyes; wild red hair. Brown leather smith coat with glowing orange runes stitched in. Focus: an iron rune hammer. Special: strikes the air and a fiery rune appears."),
    'zira': ('Shiina Kagemi', 'Executor', 'Vento', "Eighteen, portal swordswoman, dark brown skin; heart-shaped face, sharp eyes, small scar under the eye, determined frown; short cropped white hair. Light grey long coat with a green sash. Weapon: a thin curved sword. Special: steps through a small green portal and strikes from behind."),
    'n9': ('Unidade Kū', 'Atirador', 'Sombra', "Android; smooth pale face with thin seam lines along the jaw, calm violet eyes, no mask; short lavender bob. Dark violet utility suit with silver panels, long coat. Weapon: a sleek pistol and a floating triangular drone. Special: the drone and pistol fire violet beams together."),
    'unit7': ('Unidade Tetsu', 'Vanguarda', 'Fogo', "Battle android; square jaw with metal plating on one cheek, fierce red eyes, a cracked face panel; long platinum hair tied back. Heavy red and black armor with an exposed orange core on the chest. Weapon: a huge chain-blade sword. Special: revs the chain-blade and swings it in a fiery arc."),
    'rex': ('Raizō Kurenai', 'Atirador', 'Fogo', "Late twenties, flashy gunslinger; lean face, cocky smirk, stubble, a scar through one eyebrow, amber eyes; messy dark-red hair. Black long coat with crimson lining, open collar. Weapons: two mismatched ornate pistols. Special: spins and fires both pistols in a crimson spiral."),
    'virel': ('Yūgen Kurenai', 'Executor', 'Sombra', "Late twenties, cold swordsman; long pale face, thin lips, sharp eyes, a neat scar on the chin; dark-violet hair combed back. Dark grey long coat with violet lining, gloves. Weapon: a straight ceremonial sword with a purple edge. Special: ghostly blades appear behind him and strike."),
    'selene': ('Tokiko Yoru', 'Arcanista', 'Sombra', "Thirties, theatrical witch; long face, heavy-lidded plum eyes, dark lipstick, beauty mark; long dark-violet curls under a wide-brimmed hat. Black and plum gown with lace. Focus: an ornate pocket watch. Special: raises the watch and clock-hand runes freeze the air."),
    'tessa': ('Tsubaki Morie', 'Atirador', 'Natureza', "Twenty, forest hunter, deep brown skin; strong face, sharp eyes, white face paint stripe on the chin; black hair in many small braids with wooden beads. Leaf-green hide armor. Weapon: a carved wooden bow with a glowing green string, a small mechanical owl on the shoulder. Special: fires three glowing arrows at once."),
    'kaji': ('Kaji, o Espectro', 'Executor', 'Fogo', "Tall haunted fighter; face hidden by a charcoal hood and an iron beak-like half mask, glowing ember eyes; ash-grey skin on the hands. Dark grey garb with red trim, torn cloak. Weapon: a burning chain-sickle. Special: whips the chain-sickle in a circle of fire."),
    'kori': ('Kori, o Gélido', 'Arcanista', 'Gelo', "Twenties, stoic ice mage, pale skin with a light blue tint on the fingertips; long pale face, frost on the eyelashes, thin mouth, calm eyes; black hair in a neat short bob with one frozen white lock. Long pale-blue coat with white fur collar and snowflake embroidery. Weapon: a crystal staff. Special: raises the staff and ice crystals spike up around him."),
}


def prompt(hid):
    name, cls, el, design = HEROES[hid]
    return (f"Use your built-in image generation tool to create the image and save it as {hid}.png in the current directory. "
            f"{LAYOUT}\nHero: {name} ({cls} class, {el} element). {design}\n{STYLE}")


def generate(hid):
    os.makedirs(OUT, exist_ok=True)
    if os.path.exists(os.path.join(OUT, f'{hid}.webp')) and '--force' not in sys.argv:
        print(f'{hid:10s} já existe', flush=True)
        return True
    path = os.path.join(OUT, f'{hid}.png')
    for attempt in range(3):
        extra = '' if not attempt else '\nIMPORTANT: the previous attempt came with an opaque background. The PNG background MUST be fully transparent (alpha 0), no grey, no vignette.'
        r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', OUT, '-'],
                           input=prompt(hid) + extra, text=True, encoding='utf-8', capture_output=True, timeout=1500)
        if 'usage limit' in (r.stdout + r.stderr):
            ok = api_generate(prompt_text(hid), path) and to_webp(path)
            print(f'{hid:10s} {"ok (API)" if ok else "COTA ESGOTADA"}', flush=True)
            return ok
        if os.path.exists(path) and transparent(path):
            to_webp(path)
            print(f'{hid:10s} ok', flush=True)
            return True
        if os.path.exists(path):
            os.replace(path, path.replace('.png', f'.opaco{attempt}.png'))
    print(f'{hid:10s} FALHOU', flush=True)
    return False


def transparent(path):
    """Fundo transparente de verdade: os quatro cantos e as bordas quase sem alfa."""
    from PIL import Image
    a = Image.open(path).convert('RGBA').getchannel('A')
    w, h = a.size
    edge = [a.getpixel((x, y)) for x in range(0, w, max(1, w // 40)) for y in (0, h - 1)] + [a.getpixel((x, y)) for y in range(0, h, max(1, h // 40)) for x in (0, w - 1)]
    return sum(v > 30 for v in edge) < len(edge) * .05




def prompt_text(hid):
    """O pedido sem a instrução de ferramenta (para a API de imagem)."""
    name, cls, el, design = HEROES[hid]
    return f"{LAYOUT}\nHero: {name} ({cls} class, {el} element). {design}\n{STYLE}"


def api_key():
    k = os.environ.get('OPENAI_API_KEY')
    if k:
        return k
    env = os.path.join(ROOT, '.env')
    if os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.startswith('OPENAI_API_KEY='):
                return line.split('=', 1)[1].strip()
    return None


def api_generate(text, path, size='1536x1024'):
    """Reserva quando a cota do Codex acaba: API de imagens da OpenAI (fundo transparente nativo). Chave em .env."""
    import base64
    import json as _json
    import urllib.request
    key = api_key()
    if not key:
        return False
    body = _json.dumps({'model': 'gpt-image-1', 'prompt': text[:32000], 'size': size, 'quality': 'high',
                        'background': 'transparent', 'output_format': 'png', 'n': 1}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=600) as res:
            data = _json.loads(res.read())
        open(path, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        return True
    except Exception as e:  # sem saldo, rede, etc.: registra e segue
        print('API falhou:', str(e)[:200], flush=True)
        return False


def to_webp(path):
    """Guarda a fonte em webp (qualidade 92, ~5x menor que o PNG) e apaga o PNG."""
    from PIL import Image
    Image.open(path).save(path[:-4] + '.webp', quality=92, method=6)
    os.remove(path)
    return True


# ---------------------------------------------------------------------------
# CHEFES: mesma folha de 8 poses, virados para a ESQUERDA (ficam do lado direito da arena). Id = sprite do chefe.
# Uso: python tools/hero_art.py --bosses
# ---------------------------------------------------------------------------
BOSS_LAYOUT = (
    "Create exactly one landscape image: an animation pose sheet of ONE original boss monster for a 2D side-view RPG. Eight poses "
    "in 2 rows of 4, all the SAME creature with identical design, colors and scale, every pose facing LEFT, whole body visible and "
    "grounded, wide empty space between poses so they never touch. Row 1: (1) idle menacing stance, (2) the same stance breathing "
    "(slightly raised), (3) advancing, (4) staggered by a hit. Row 2: (5) attack wind-up, (6) attack at full extension, (7) recovering, "
    "(8) signature special attack. Big, heavy, imposing silhouette."
)
BOSSES = {
    'eclipse': ('Shirogane, Rei do Eclipse', "a tall armored moon king with a black eclipse disc behind his head like a halo, pale silver mask with a thin crescent crack, long tattered indigo cloak, a curved silver moon glaive; the special attack raises the glaive as the eclipse disc darkens and spreads violet shadow."),
    'dragon': ('Mizuchi, Dragão Abissal', "a serpentine sea dragon with deep teal scales, pearl-white belly, barbels like whiskers, glowing seafoam eyes, fins like torn sails; the special attack coils and roars a tidal wave of water."),
    'lantern_kitsune': ('Kitsune das Lanternas', "a large festival fox spirit with ivory fur, nine flame-tipped tails, a red shrine ribbon collar and floating paper lanterns; the special attack spreads all nine tails into a fan of fox-fire."),
    'dragon_amber': ('Apep, Serpente do Tempo', "a colossal desert serpent of amber and gold scales with an hourglass-shaped crest, cracked stone ribs, sand pouring from its jaws; the special attack rears up as a broken hourglass of sand spins around it."),
    'raijin': ('Raijin, o Tambor do Trovão', "a muscular storm deity with dark blue skin, wild white hair, a ring of taiko drums on his back, tiger-skin loincloth, lightning sparking from drumsticks; the special attack strikes the drums releasing a thunder blast. Original design, not based on any existing character or statue."),
}


def boss_prompt(bid):
    name, design = BOSSES[bid]
    return (f"Use your built-in image generation tool to create the image and save it as {bid}.png in the current directory. "
            f"{BOSS_LAYOUT}\nBoss: {name}: {design}\n{STYLE.replace('PROPORTIONS (strict): chunky chibi, the head is about one third of the total height, short legs, big hands and feet; every pose keeps these proportions. ', 'PROPORTIONS: stylized and imposing, bigger than the heroes, same hand-inked style. ')}")


if __name__ == '__main__':
    if '--bosses' in sys.argv:
        prompt = boss_prompt  # generate() usa prompt(hid) e, na reserva pela API, prompt_text(hid)
        prompt_text = lambda b: boss_prompt(b).split('current directory. ', 1)[1]  # noqa: E731
        ids = [a for a in sys.argv[1:] if not a.startswith('-')] or list(BOSSES)
    else:
        ids = [a for a in sys.argv[1:] if not a.startswith('-')] or list(HEROES)
    with ThreadPoolExecutor(3) as ex:
        list(ex.map(generate, ids))
