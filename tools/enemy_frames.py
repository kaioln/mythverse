"""Poses de luta dos monstros e chefes pela API de imagens da OpenAI. Cada criatura do jogo tem arte própria.

Duas folhas por criatura (2 linhas × 4 poses, fundo transparente, tudo virado para a ESQUERDA):
  a   parado · respirando · avançando · levando dano · preparando · golpe · recuperando · especial   → assets/original/poses/<id>.webp
  b   atordoado · salto para trás · derrotado · rugido · início e disparo de conjuração ·
      meio do golpe · segundo golpe                                                                → assets/original/poses2/<id>.webp

De onde vem a referência de cada folha "a":
  BASES    os 6 monstros do atlas original: a própria arte do atlas (mesmo desenho, agora com poses).
  UNIQUE   todas as outras criaturas: desenho NOVO, descrito aqui. A folha de um monstro já pronto vai só como
           referência de traço e de organização da folha (não de desenho): nenhuma criatura é recolorida de outra.
  BOSSES   os chefes de região já têm a folha "a" (tools/hero_art.py --bosses).
A folha "b" sempre usa a folha "a" da própria criatura como referência (mesmo desenho, poses novas).

Uso: python tools/enemy_frames.py [a|b|ab] [<id> ...] [--force] [--reverse] [--model M] [--quality low|medium|high]
     (sem ids: todas as criaturas que ainda não têm a folha pedida)
Depois: python tools/build_anim.py && python tools/build_sprites_web.py
"""
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_art import ROOT, api_key, transparent  # noqa: E402
from hero_frames import cost_of, log_cost, multipart  # noqa: E402

POSES = os.path.join(ROOT, 'assets', 'original', 'poses')
POSES2 = os.path.join(ROOT, 'assets', 'original', 'poses2')
ATLAS = os.path.join(ROOT, 'assets', 'original', 'enemies-atlas.png')
ATLAS_ORDER = ['fox', 'oni', 'golem', 'spider', 'wisp', 'revenant']   # 3 colunas × 2 linhas (tools/build_sprites.py cells())

# id (o "sprite" da criatura em src/data.js) → (nome, descrição).
BASES = {
    'fox': ('Raposa do Crepúsculo', "a twilight fox spirit with purple fur, a huge flame-like violet tail with glowing swirl marks, golden eyes, a white chest ruff and small gold tassel earrings; it attacks by biting and whipping its burning tail."),
    'oni': ('Oni da Névoa', "a hulking red-skinned oni brute with a wild white mane, a horned white mask, fur and bone armor and a huge spiked iron club (kanabo); it attacks with heavy club swings and ground slams."),
    'golem': ('Sentinela de Musgo', "a massive moss-covered stone golem with glowing green rune carvings and boulder fists; slow and heavy, it attacks with crushing punches and stomps that shake the ground."),
    'spider': ('Aranha de Cristal', "a giant dark violet spider with amethyst crystal spikes on its back and legs and many glowing magenta eyes; it attacks by stabbing with its crystal front legs and spitting crystal shards."),
    'wisp': ('Luz Errante', "a floating cyan-teal flame spirit (hitodama) with a mask-like face and dark eye markings, trailing fire wisps; it always hovers above the ground and attacks by flaring up and shooting spirit flames."),
    'revenant': ('Espectro das Marés', "a drowned skeletal warlord ghost in corroded teal armor with a horned helmet, a long trident and a tattered spectral cloak that fades into mist instead of legs; it hovers just above the ground and attacks with trident thrusts and ghostly waves."),
}
BOSSES = {
    'eclipse': ('Shirogane, Rei do Eclipse', "a tall armored moon king with a black eclipse disc behind his head, a pale silver mask, a long tattered indigo cloak and a curved silver moon glaive."),
    'dragon': ('Mizuchi, Dragão Abissal', "a serpentine sea dragon with deep teal scales, a pearl-white belly, whisker barbels, glowing seafoam eyes and fins like torn sails."),
    'lantern_kitsune': ('Kitsune das Lanternas', "a large festival fox spirit with ivory fur, nine flame-tipped tails, a red shrine ribbon collar and floating paper lanterns."),
    'dragon_amber': ('Apep, Serpente do Tempo', "a colossal desert serpent of amber and gold scales with an hourglass-shaped crest, cracked stone ribs and sand pouring from its jaws."),
    'raijin': ('Raijin, o Tambor do Trovão', "a muscular storm deity with dark blue skin, wild white hair, a ring of taiko drums on his back, a tiger-skin loincloth and lightning sparking from his drumsticks."),
}
# id → (nome, desenho próprio, folha de referência de traço).
UNIQUE = {
    # Bosque das Lanternas
    'spider_jade': ('Aranha de Jade', "a forest spider with a carapace of polished green jade plates, a moss-covered abdomen sprouting small ferns, slender bamboo-jointed legs and glowing lime eyes; it drips green venom.", 'spider'),
    'golem_elder': ('Ancião de Musgo', "an ancient hunched treant-golem: a mossy boulder torso with a gnarled old tree growing from its back, long wooden arms, a beard of hanging moss and vines, small glowing amber eyes and a sacred shimenawa rope with paper charms around its waist; larger and older than a normal golem.", 'golem'),
    'fox_nine': ('Raposa de Nove Sombras', "a large black-indigo nine-tailed fox whose nine tails are made of living shadow smoke, with a silver crescent-moon mark on its forehead, silver eyes, a thin elegant body and a torn red sash.", 'fox'),
    # Templo do Véu
    'oni_ash': ('Oni de Cinzas', "a grey ash-skinned oni with cracked ember-veined skin, one broken horn, a charred wooden mask and burnt rope belts, wielding a cracked stone pillar as a club while ash falls from its shoulders.", 'oni'),
    'wisp_void': ('Chama do Vazio', "a floating orb of violet-black void flame with a single white ringed eye in its center, a halo of dark shards orbiting it and long trailing ribbons of purple fire.", 'wisp'),
    'golem_obsidian': ('Golem de Obsidiana', "a sharp angular golem of glossy black obsidian with knife-edged shoulders, mirror-like facets, glowing orange cracks and blade-like forearms; no moss at all.", 'golem'),
    'oni_crimson': ('Oni Carmesim', "a tall lean crimson oni with a long black mane tied in a topknot, two long curved horns, a red-lacquered samurai chest plate and flame tattoos on his arms, dual-wielding two short burning iron clubs.", 'oni'),
    'fox_specter': ('Kitsune Espectral', "a translucent white-gold ghost kitsune with three wispy tails that fade into light, a paper talisman on its forehead, closed serene eyes and prayer beads around its neck, hovering slightly.", 'fox'),
    'golem_lava': ('Guardião Ígneo', "a massive volcanic golem of black basalt with rivers of glowing lava in its joints, a furnace mouth in its chest, molten fists and a crown of smoking rock; a huge imposing floor boss.", 'golem'),
    # Costa das Marés
    'fox_foam': ('Raposa da Espuma', "a sleek sea-fox with pale aqua fur, a tail shaped like a breaking wave of white foam and ice crystals, fin-like ears, small pearls on its collar and frosty breath.", 'fox'),
    'spider_coral': ('Aranha de Coral', "a bulky crab-like spider with a carapace of pink and orange branching coral, barnacles on its thick armored legs, small black bead eyes and two large claw-like front limbs.", 'spider'),
    'oni_tide': ('Oni Abissal', "a deep-sea oni with dark blue skin, an anglerfish lure hanging from his forehead, fins on his forearms, a seaweed loincloth and barnacle-covered shoulders, wielding a huge ship anchor.", 'oni'),
    'revenant_captain': ('Capitão Afogado', "a drowned ghost ship captain: a skeletal admiral with a rotting captain's kabuto helmet, a long tattered naval coat with gold epaulettes, a ghostly lantern in one hand and a rusted cutlass in the other, seawater pouring from his sleeves.", 'revenant'),
    'golem_coral': ('Colosso de Coral', "a towering colossus built from a reef: a body of white limestone covered in colorful corals and sea anemones, giant clam-shell shoulder plates, starfish on its chest and long spiny coral arms.", 'golem'),
    # Arquivo Submerso
    'revenant_scribe': ('Escriba Afogado', "a thin drowned scholar ghost in a soaked dark robe with ink dripping from his long sleeves, a tall scholar hat, hollow eye sockets glowing teal, a giant calligraphy brush in his hand and waterlogged scrolls and runes floating around him.", 'revenant'),
    'wisp_arc': ('Faísca Arcana', "a crackling ball of blue-white lightning with a jagged angry face, orbited by golden rune rings, with electric arcs jumping between small floating crystal shards.", 'wisp'),
    'spider_ink': ('Aranha de Tinta', "a spider made of living black ink: a glossy dripping body, long calligraphy-brush legs that leave ink strokes, white brush marks on its abdomen and a single red seal-stamp eye.", 'spider'),
    'golem_crystal': ('Autômato de Jade', "a carved jade automaton: a smooth geometric guardian statue of green jade with gold inlays, a round lantern head with one glowing eye, segmented arms and a prayer wheel in its chest.", 'golem'),
    'fox_storm': ('Raposa-Trovão', "a lean yellow and white fox crackling with lightning, with spiky fur standing on end, a zigzag lightning-bolt tail, glowing blue eyes and small storm clouds under its paws.", 'fox'),
    'revenant_crimson': ('Arquivista Carmesim', "a tall crimson-robed spectral archivist with a faceless white porcelain mask, a forbidden tome chained to his wrist, long red ribbons covered in written curses swirling around him and keys hanging from his belt.", 'revenant'),
    'oni_storm': ('Guardião da Tempestade', "a giant storm oni with dark blue-grey skin, a mane of white lightning, storm-cloud shoulder guards and golden bracers, wielding a massive thunder hammer wrapped in sacred rope; a floor boss.", 'oni'),
    'archive_sentinel': ('Bibliotecária Espectral', "a spectral librarian: a ghostly woman with round glasses, her hair in a bun with a brush pin, a long pale-blue robe, a finger raised to her lips, a floating lantern and books orbiting her; ghostly lower body.", 'revenant'),
    # Pântano dos Vaga-lumes
    'fox_bog': ('Raposa do Lodo', "a scruffy swamp fox covered in dripping mud and duckweed, with reeds and cattails growing on its back, a tail like a clump of wet moss, yellow eyes and a firefly on its nose.", 'fox'),
    'spider_bog': ('Aranha do Brejo', "a long-legged water-strider spider with a bloated translucent green abdomen full of swamp water, lily pads on its back, thin stilt-like legs and dripping toxic webs.", 'spider'),
    'wisp_bog': ('Vaga-lume Errante', "a giant firefly spirit: a small round insect body with a huge glowing yellow-green lantern abdomen, delicate transparent wings, hypnotic spiral eyes and drifting sparkles.", 'wisp'),
    'oni_moss': ('Oni do Musgo', "a fat green oni overgrown with moss, mushrooms and small flowers, with tusks, sleepy eyes, a straw rain cape and a wooden log club with fresh leaves sprouting from it.", 'oni'),
    'golem_bog': ('Colosso do Pântano', "a hulking mud and root colossus rising from a swamp: a dripping body of dark peat, tangled mangrove roots as limbs, a sunken rowboat embedded in its shoulder and glowing swamp-gas lanterns in its chest.", 'golem'),
    'revenant_bog': ('Bruxa do Brejo', "an old swamp witch spirit with a wide straw hat covered in moss, a crooked nose, long stringy grey hair, a patched dark green cloak, a gnarled staff with hanging frog charms and a bubbling gourd, floating just above the mud.", 'revenant'),
    # Cripta de Jade
    'spider_bone': ('Aranha de Ossos', "a skeletal spider assembled from bleached bones: a rib-cage body, a skull as its head with green fire in the eye sockets and sharp bone-splinter legs.", 'spider'),
    'wisp_jade': ('Chama de Jade', "an emerald ghost flame burning inside a floating cracked jade burial mask, green fire leaking from the eyes and mouth of the mask, with small jade beads orbiting it.", 'wisp'),
    'fox_jade': ('Raposa de Jade', "a statue-like fox carved from pale green jade with gold-filled cracks, a red tasseled collar and glowing green eyes, moving stiffly like a living grave guardian statue.", 'fox'),
    'golem_emerald': ('Guardião Esmeralda', "a broad tomb guardian golem shaped like a terracotta warrior of emerald-green stone, with a flat helmet, carved armor plates and a huge jade tower shield in one hand.", 'golem'),
    'revenant_jade': ('Sacerdote de Jade', "an undead priest in a jade burial suit made of small jade tiles sewn with gold thread, a paper talisman on his forehead and a tall ceremonial hat, holding a bone staff with a spirit bell.", 'revenant'),
    'oni_jade': ('Oni Carcereiro', "a heavyset jailer oni with stone-grey skin, an iron mask with a barred visor, heavy chains wrapped around his arms and a ring of big keys, dragging a spiked iron ball on a chain.", 'oni'),
    'revenant_king': ('Rei Sem Túmulo', "a towering skeletal king in tarnished black and gold royal armor with a crown of ghostly blue soul-flames, a long tattered purple cape and a huge cracked greatsword, souls swirling around him; a floor boss.", 'revenant'),
    # Planalto Congelado
    'fox_snow': ('Raposa da Nevasca', "a fluffy white arctic fox with icicle whiskers, a huge snowdrift tail tipped with frost crystals, pale blue eyes and small ice shards on its back.", 'fox'),
    'spider_ice': ('Aranha de Geada', "a translucent spider sculpted of clear blue ice with a snowflake pattern on its abdomen, legs like icicles and frozen web strands hanging from its body.", 'spider'),
    'wisp_ice': ('Espírito Boreal', "an aurora spirit: a small pale face inside a flowing ribbon-like veil of green and violet northern lights with drifting snow sparkles; no flames.", 'wisp'),
    'golem_ice': ('Golem Glacial', "a glacier golem of layered blue-white ice blocks with a tusked mammoth-like head, snow on its shoulders, huge fists of packed ice and frozen spikes on its back.", 'golem'),
    'oni_frost': ('Oni da Avalanche', "a huge white-furred yeti-like oni with blue skin on its face and hands, icy horns and a snow-covered straw cape, carrying a giant boulder of packed snow and ice.", 'oni'),
    'revenant_frost': ('Rainha do Inverno', "a winter queen spirit (yuki-onna): a tall pale ghostly woman in a long white and ice-blue kimono, long black hair dusted with frost, a crown of icicles and blue lips, trailing snowflakes; floating, elegant and cold.", 'revenant'),
    # Forja Abissal
    'spider_lava': ('Aranha de Magma', "a spider of black volcanic rock with a glowing magma-filled abdomen like a furnace, molten orange joints, dripping lava fangs and smoke rising from its back.", 'spider'),
    'wisp_lava': ('Faísca da Forja', "a living forge spark: a white-hot ember core with a grinning face inside a floating broken iron crucible, sparks and molten metal droplets flying around it.", 'wisp'),
    'fox_fire': ('Raposa Brasa', "a small fox with smoldering charcoal-black fur and glowing ember cracks, a blazing orange flame tail, burning paw prints and bright orange eyes.", 'fox'),
    'revenant_ash': ('Ferreiro de Cinzas', "a burnt ghost blacksmith: a broad skeletal smith with a leather apron, soot-black bones and ember eyes, a huge glowing-hot hammer and tongs, ash and smoke instead of legs.", 'revenant'),
    'oni_lava': ('Oni Fundidor', "a muscular orange-red oni foundry worker with an iron face plate like a welding mask, heavy leather gloves and apron, carrying a giant ladle crucible overflowing with molten metal.", 'oni'),
    'golem_iron': ('Autômato de Ferro', "a riveted iron automaton: a barrel-chested mechanical guardian of dark iron plates with brass pipes, a furnace grille in its belly, piston arms, a single round lens eye and steam vents.", 'golem'),
    'golem_forge': ('Coração da Forja', "a colossal living furnace: an anvil-shaped iron golem with a blazing white-hot heart visible through chest bars, chimney stacks on its shoulders pouring smoke, molten chains and hammer fists; a floor boss.", 'golem'),
    # Areias do Tempo
    'fox_sand': ('Chacal das Dunas', "a slim desert jackal with sandy-gold fur, tall pointed ears, dark eye markings, a blue and gold collar and a tail dissolving into blowing sand.", 'fox'),
    'spider_sand': ('Escorpião Dourado', "a giant golden scorpion with polished gold armor plates, turquoise gem inlays, big pincers and a raised curved stinger tail dripping green venom.", 'spider'),
    'wisp_sand': ('Miragem', "a mirage spirit: a wavering translucent figure of heat haze shaped like a veiled dancer made of swirling sand and shimmering air, with two glowing golden eyes and no legs.", 'wisp'),
    'oni_sand': ('Guerreiro de Areia', "a warrior made of packed sand and sandstone with a curved khopesh sword and a round bronze shield, a striped headcloth, sand constantly trickling from his body.", 'oni'),
    'golem_sand': ('Esfinge de Pedra', "a stone sphinx: a lion body with a serene human face carved from sandstone, a pharaoh headdress with faded blue stripes, carvings on its flanks and cracked folded wings.", 'golem'),
    'revenant_mummy': ('Múmia Real', "a royal mummy: a tall pharaoh wrapped in aged bandages with a golden death mask, a jeweled collar, a crossed crook and flail, loose bandages floating like tentacles and glowing purple eyes.", 'revenant'),
    'sand_servant': ('Servo de Âmbar', "an amber servant: a warrior sculpted from golden translucent amber with an hourglass embedded in his chest, sand flowing inside his body, and a curved bronze blade.", 'oni'),
    # Cidade Fantasma
    'fox_ghost': ('Raposa Fantasma', "a ghost fox: a pale grey translucent fox with hollow black eyes, a body fading into mist at the hind legs, a broken red shrine collar and small blue ghost flames following it.", 'fox'),
    'wisp_ghost': ('Lamento', "a wailing ghost: a floating white funeral shroud with a long screaming face, hollow eyes and mouth, long thin arms reaching forward and tear-like drips.", 'wisp'),
    'spider_ghost': ('Aranha Etérea', "an ethereal spider made of pale blue spirit light and cobwebs, with a white theater mask as its face, thin glowing legs and soul orbs caught in its web strands.", 'spider'),
    'oni_ghost': ('Oni Espectral', "a headless spectral oni in rusted samurai armor carrying its own horned glowing skull like a lantern in one hand and a ghostly naginata in the other, with blue ghost fire where the head should be.", 'oni'),
    'golem_ghost': ('Sentinela Assombrada', "a haunted guardian lion-dog statue (komainu) of cracked grey stone with one broken ear, glowing violet eyes, moss and paper talismans stuck on it and chains around its paws.", 'golem'),
    'revenant_ghost': ('Noiva Espectral', "a ghost bride in a white wedding kimono with a large white hood, a pale beautiful sad face, long floating sleeves, a wilted red camellia in her hands and a faint golden glow; ghostly lower body.", 'revenant'),
    # Torre do Relógio
    'fox_time': ('Raposa Temporal', "a fox with brass gear patterns on its copper fur, a pocket-watch pendant, a tail made of fading afterimages of itself and glowing cyan eyes.", 'fox'),
    'wisp_time': ('Engrenagem Viva', "a living gear: a floating cluster of brass cogwheels rotating around a glowing blue core eye, with small sparks and a wind-up key on its back.", 'wisp'),
    'spider_clock': ('Aranha de Corda', "a wind-up toy spider of brass and copper with a big wind-up key on its back, clock-hand legs and a glass dome abdomen showing the gears inside.", 'spider'),
    'oni_time': ('Oni do Pêndulo', "a bronze-skinned oni clock keeper with a clock-face shield on his back and a monocle, swinging a gigantic pendulum blade on a long rod.", 'oni'),
    'revenant_time': ('Relojoeiro Louco', "a mad ghost clockmaker: a hunched thin old man spirit with wild white hair, magnifier goggles and a coat full of tiny clocks and tools, holding oversized tweezers and a big ticking alarm clock.", 'revenant'),
    'revenant_chrono': ('Guardião do Tempo', "a hooded time guardian in a long sand-colored robe with an hourglass for a head, holding a tall staff topped with a sundial ring, with small frozen clock hands floating around him.", 'revenant'),
    'golem_clock': ('Colosso do Relógio', "a colossal clock tower golem: a body made of a brick and brass tower with a huge clock face on its chest showing midnight, bell hammers as fists and gears turning in its open joints; a floor boss.", 'golem'),
    # Ilhas Flutuantes
    'fox_cloud': ('Raposa das Nuvens', "a fluffy white cloud fox with a body partly made of cumulus clouds, small feathered wings on its ankles, a long cloud-trail tail and sky-blue eyes.", 'fox'),
    'wisp_storm': ('Centelha Celeste', "a small thundercloud spirit: a dark grey puffy cloud with angry yellow eyes, lightning bolts shooting downward and falling rain drops.", 'wisp'),
    'spider_wind': ('Aranha dos Ventos', "a kite-like spider with paper and bamboo fan wings between its long legs, a pale turquoise body and silk threads streaming in the wind, floating slightly.", 'spider'),
    'oni_thunder': ('Oni do Trovão', "a blue-green oni drummer with a small taiko drum strapped to his belly, two drumsticks crackling with lightning, wild yellow hair and tiger-stripe armbands.", 'oni'),
    'golem_sky': ('Colosso Alado', "a winged stone colossus: a gargoyle-like granite golem with wide stone feather wings, a beaked helmet-like head, rock fragments floating around its feet and cloud wisps.", 'golem'),
    'revenant_sky': ('Tengu Ancião', "an elder tengu: a tall red-faced long-nosed mountain spirit with black crow wings, a white beard, a small black cap, a monk robe with pom-poms, a large feather fan and tall wooden sandals.", 'revenant'),
    'storm_servant': ('Arauto do Tambor', "a drum herald: a small blue oni acolyte carrying a large taiko drum on his back, sparks jumping between two raised drumsticks, with a tiger-skin sash.", 'oni'),
    # Vale das Cerejeiras Eternas
    'fox_sakura': ('Kitsune Rosada', "a graceful pink and white kitsune with cherry blossoms growing along its back, three petal-shaped tails and a small bell collar with a pink ribbon, petals falling around it.", 'fox'),
    'wisp_petal': ('Espírito da Pétala', "a petal spirit: a tiny smiling face in the middle of a swirling whirl of pink cherry petals shaped like a flower.", 'wisp'),
    'spider_silk': ('Tecelã de Seda', "an elegant white silk-weaver spider with a kimono-patterned abdomen in pink and gold, long slender legs holding a spindle of silk thread and small cocoons hanging from it.", 'spider'),
    'oni_blossom': ('Oni Florido', "a pink-skinned oni with blooming cherry branches growing from his shoulders and horns, a sake gourd at his hip, a flowering tree trunk as a club and a cheerful fierce grin.", 'oni'),
    'golem_root': ('Guardião de Raízes', "a guardian made entirely of twisted living tree roots and bark with a hollow glowing-green knot for a face, cherry blossoms on its antler-like branches and a sacred rope around its trunk body.", 'golem'),
    'revenant_geisha': ('Dama das Flores', "a spectral dancer in a pink and gold flower kimono with a tall elaborate hairstyle full of blossom pins, a white painted face, two folding fans, long floating sleeves and ribbons; ghostly lower body.", 'revenant'),
    # Santuário das Nuvens
    'fox_lightning': ('Raiju', "the thunder beast Raiju: a wolf-like blue and white beast with six legs, a mane of crackling lightning, sharp claws, a long forked tail of electricity and fierce white eyes.", 'fox'),
    'wisp_cloud': ('Névoa Sagrada', "a sacred mist spirit: a soft white-gold cloud with a calm sleeping face, a small golden halo and zigzag paper streamers hanging beneath it.", 'wisp'),
    'spider_thunder': ('Aranha Trovejante', "a storm spider with a dark navy body, a glowing yellow lightning-bolt marking, metal-rod leg tips sparking with electricity and an electric web between its front legs.", 'spider'),
    'oni_wind': ('Oni do Vendaval', "a green-skinned wind oni with huge puffed cheeks blowing a gust, wild white hair blown back and a billowing cloth held over his shoulders like a sail, fighting bare-fisted.", 'oni'),
    'revenant_monk': ('Monge da Tempestade', "a ghostly warrior monk floating in a lotus position, wearing a straw basket hat that hides his face, saffron robes, prayer beads crackling with lightning and a ringed staff.", 'revenant'),
    'golem_bell': ('Sino Colossal', "a living giant bronze temple bell with short stone legs and long arms, holding its rope-and-log striker like a club, with carved inscriptions and two glowing eyes in the dark under its rim.", 'golem'),
    'golem_fujin': ('Fujin, Senhor dos Ventos', "the wind god: a huge green-skinned demon god with wild red hair, a leopard-skin loincloth and golden arm rings, carrying a great billowing white bag of winds across his shoulders; a floor boss, original design.", 'oni'),
    # Fenda Abissal
    'rift_hound': ('Cão do Vazio', "a void hound: a skeletal black hound with a body of cracked dark glass leaking magenta light, three glowing pink eyes, a jaw split too wide and crystal spikes on its back.", 'fox'),
    'rift_weaver': ('Tecelã do Abismo', "an abyss weaver: a spider with a hole of starry void in its abdomen, long needle legs, threads of magenta light and a crown of eyes.", 'spider'),
    'rift_eye': ('Olho da Fenda', "a giant floating eyeball with a magenta iris shaped like a crack, surrounded by rotating golden rings and smaller eyes on stalks.", 'wisp'),
    'rift_devourer': ('Devorador de Mundos', "a hulking void beast whose round body is mostly a gaping mouth full of spiral teeth with a starry void inside, small arms, short legs and a purple-black hide with magenta cracks.", 'oni'),
    'rift_colossus': ('Colosso Estilhaçado', "a shattered colossus: floating fragments of ruined buildings, pillars and rocks loosely assembled into a giant humanoid held together by magenta energy, pieces of different worlds (a shrine gate fragment, a clock, a ship bow).", 'golem'),
    'rift_herald': ('Arauto do Vazio', "a void herald: a tall thin robed figure with a blank mirror mask and a long war horn, a tattered banner on his back, floating shards and a magenta glow from under the robe.", 'revenant'),
    'rift_wyrm': ('Wyrm da Fenda', "a rift wyrm: a long limbless serpent-dragon of dark violet scales with a body partly torn open into glowing magenta rifts, a crown of crystal horns and four eyes; a floor boss.", 'dragon'),
    # Servos dos chefes, tesouros e armadilhas
    'eclipse_shade': ('Sombra Lunar', "a moon shade: a small beast of black mist shaped like a fox wearing a glowing crescent-moon mask, with a thin silver outline, glowing white eyes and a torn indigo ribbon.", 'fox'),
    'mizuchi_spawn': ('Cria de Mizuchi', "a baby sea dragon: a small chubby teal serpent hatchling with big seafoam eyes, tiny fins, a pearl-white belly and a piece of eggshell on its head.", 'dragon'),
    'wisp_ember': ('Fogo-Fátuo do Festival', "a living festival lantern: a round red paper lantern with a mischievous face and a tongue of flame, a small flame floating above it.", 'wisp'),
    'fox_gold': ('Raposa Dourada', "a small chubby golden fox with shining coin-gold fur, a tail like a money pouch tied with red cord, a tiny treasure sack on its back and sparkles.", 'fox'),
    'mimic': ('Baú Mímico', "a mimic treasure chest: a wooden and iron treasure chest with sharp teeth along its lid, a long purple tongue, one glowing eye inside, small clawed feet and gold coins spilling out.", 'golem'),
    # Chefes mundiais
    'wb_titan': ('Titã de Obsidiana', "the Obsidian Titan: a mountain-sized titan of black volcanic glass and stone with a small ruined castle and pine trees on its shoulders, glowing golden veins, a face like a carved cliff and gigantic fists; a colossal world boss.", 'golem'),
    'wb_frost_dragon': ('Glacius, o Dragão Invernal', "the winter dragon: a majestic four-legged ice dragon with white-blue crystalline scales, wings of frozen membranes, icicle horns and beard, and frost breath; a world boss.", 'dragon'),
    'wb_storm_kitsune': ('Raijin-Kitsune', "the thunder kitsune: a huge nine-tailed fox with dark storm-blue fur, tails ending in lightning bolts, a ring of small thunder drums floating behind it and golden eyes; a world boss.", 'lantern_kitsune'),
    'wb_blood_moon': ('Lua Sangrenta, Rainha do Eclipse', "the Blood Moon Queen: a tall regal armored queen with a blood-red eclipse disc behind her head, a crimson and black gown-armor, a pale mask, a long crescent scythe and floating red ribbons; a world boss.", 'eclipse'),
}
FACING = {}   # exceções: id → 'RIGHT' (hoje todas as folhas olham para a esquerda)

KEEP = (
    "The attached image is the official artwork of this creature. Draw the SAME creature: identical design, colors, markings, "
    "weapon and proportions, in the same hand-inked brush-line style with flat colors, 2-3 tone cel shading and washi-paper "
    "grain. Same scale in every pose. Transparent background, no text, no labels, no numbers, no frame, no scenery, no ground "
    "shadow, no motion lines, no dust."
)
# Criatura nova: a folha anexa é de OUTRO monstro e vale só pelo traço e pela organização.
NEW = (
    "STYLE REFERENCE: the attached image is the pose sheet of ANOTHER monster of this same game. Use it only for the art style "
    "(hand-inked brush-line outlines, flat colors with 2-3 tone cel shading, washi-paper grain, the same level of detail) and "
    "for the sheet layout. The monster you draw is a NEW and DIFFERENT creature: do not copy the reference's design, anatomy, "
    "silhouette or colors. The same creature with identical design, colors and scale in all eight poses. Transparent "
    "background, no text, no labels, no numbers, no frame, no scenery, no ground shadow, no motion lines, no dust."
)
LAYOUT = {
    'a': (
        "Create exactly one landscape image: an animation pose sheet of this ONE monster for a 2D side-view RPG. Eight poses in 2 "
        "rows of 4, read left to right, top to bottom, every pose facing {facing}, whole body visible, standing on the row's ground "
        "line (a floating creature hovers at the same height in every pose), wide empty space between poses so they never touch. "
        "Row 1: (1) IDLE: menacing ready stance; (2) IDLE BREATH: the same stance with the body slightly raised and expanded; "
        "(3) ADVANCE: moving forward aggressively; (4) HURT: flinching, recoiling backwards from a hit. Row 2: (5) WIND-UP: coiled "
        "back, gathering strength before an attack; (6) STRIKE: its basic attack at full extension, lunging forward; "
        "(7) RECOVER: pulling back after the strike, off balance; (8) SPECIAL: its signature power attack with a burst of its own "
        "element close to the body."
    ),
    'b': (
        "Create exactly one landscape image: an extra COMBAT pose sheet of this ONE creature for a 2D side-view RPG. Eight poses in "
        "2 rows of 4, read left to right, top to bottom, every pose facing {facing}, whole body visible, on the row's ground line (a "
        "floating creature hovers at the same height), wide empty space between poses so they never touch. Row 1: (1) STUNNED: "
        "dazed with its guard broken, slumped and wobbling, head hanging; (2) LEAP BACK: a quick evasive hop backwards; "
        "(3) DEFEATED: collapsed lifeless on the ground, eyes closed (a spirit creature: shrinking and dissipating); (4) ROAR: a "
        "threatening roar, body raised and mouth or arms wide open. Row 2: (5) CAST START: gathering dark energy close to the "
        "body, coiled; (6) CAST RELEASE: releasing a blast forward with a small burst of its own element at the tip only; "
        "(7) MID-ATTACK: halfway through a fast attack, between a wind-up and a full extension; (8) SECOND ATTACK: a different "
        "attack from the attached sheet (a sweep, slam, stomp or thrust) at full reach."
    ),
}
ALL = {**BASES, **{k: v[:2] for k, v in UNIQUE.items()}, **BOSSES}


def reference(cid, sheet):
    """PNG de referência: célula do atlas (folha a dos 6 monstros-base), folha de traço (folha a das criaturas novas)
    ou a folha de poses já pronta da própria criatura (folha b)."""
    if sheet == 'a' and cid in BASES:
        atlas = Image.open(ATLAS).convert('RGBA')
        i = ATLAS_ORDER.index(cid)
        cw, ch = atlas.width / 3, atlas.height / 2
        im = atlas.crop((round((i % 3) * cw), round((i // 3) * ch), round((i % 3 + 1) * cw), round((i // 3 + 1) * ch)))
    else:
        im = Image.open(os.path.join(POSES, f'{UNIQUE[cid][2] if sheet == "a" else cid}.webp')).convert('RGBA')
        im.thumbnail((1536, 1536), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return buf.getvalue()


def prompt_for(cid, sheet):
    name, design = ALL[cid]
    kind = 'Boss' if cid in BOSSES or cid.startswith('wb_') else 'Monster'
    rules = NEW if sheet == 'a' and cid in UNIQUE else KEEP
    return f"{LAYOUT[sheet].format(facing=FACING.get(cid, 'LEFT'))}\n{rules}\n{kind}: {name}: {design}"


def generate(cid, sheet, model, quality, force=False):
    out_dir = POSES if sheet == 'a' else POSES2
    os.makedirs(out_dir, exist_ok=True)
    target = os.path.join(out_dir, f'{cid}.webp')
    if os.path.exists(target) and not force:
        return True
    if sheet == 'b' and not os.path.exists(os.path.join(POSES, f'{cid}.webp')):
        print(f'{cid:18s} b sem a folha a', flush=True)
        return False
    key = api_key()
    if not key:
        print('Sem OPENAI_API_KEY.', flush=True)
        return False
    opaque = 0
    for attempt in range(8):
        extra = '' if not opaque else ' IMPORTANT: the background MUST be fully transparent (alpha 0).'
        body, ctype = multipart({'model': model, 'prompt': (prompt_for(cid, sheet) + extra)[:32000], 'size': '1536x1024', 'quality': quality,
                                 'background': 'transparent', 'output_format': 'png', 'n': '1'},
                                {'image[]': (f'{cid}.png', reference(cid, sheet), 'image/png')})
        req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization': f'Bearer {key}', 'Content-Type': ctype})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=900) as res:
                data = json.loads(res.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            print(f'{cid:18s} {sheet} API {e.code}: {msg}', flush=True)
            if e.code in (429, 500, 502, 503) and attempt < 7:
                time.sleep(20 + attempt * 10); continue
            return False
        except Exception as e:  # rede
            print(f'{cid:18s} {sheet} falhou: {str(e)[:200]}', flush=True)
            if attempt < 3:
                time.sleep(10); continue
            return False
        usd = cost_of(model, data.get('usage') or {})
        total = log_cost({'hero': cid, 'kind': f'enemy-{sheet}', 'model': model, 'quality': quality, 'usd': round(usd, 4), 'usage': data.get('usage'), 'at': time.strftime('%Y-%m-%d %H:%M:%S')})
        png = os.path.join(out_dir, f'{cid}.png')
        open(png, 'wb').write(base64.b64decode(data['data'][0]['b64_json']))
        if transparent(png):
            Image.open(png).save(target, quality=94, method=6); os.remove(png)
            print(f'{cid:18s} {sheet} ok  US$ {usd:.3f} (total {total:.2f})  {time.time() - t0:.0f}s', flush=True)
            return True
        os.replace(png, png.replace('.png', f'.opaco{opaque}.png')); opaque += 1
        print(f'{cid:18s} {sheet} fundo opaco, tentando de novo (US$ {usd:.3f})', flush=True)
        if opaque >= 2:
            return False
    return False


def main():
    valued = ('--model', '--quality')
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in valued]
    opt = lambda name, default: (sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default)  # noqa: E731
    sheets = args[0] if args and args[0] in ('a', 'b', 'ab') else 'ab'
    ids = [a for a in args if a in ALL] or list(ALL)
    if '--reverse' in sys.argv:   # dois processos ao mesmo tempo: um do começo, outro do fim da lista
        ids.reverse()
    model, quality, force = opt('--model', 'gpt-image-2.5-sunburst'), opt('--quality', 'medium'), '--force' in sys.argv
    ok = n = 0
    for cid in ids:   # em sequência: a folha b precisa da a, e a API limita imagens por minuto
        for sheet in sheets:
            if sheet == 'a' and cid in BOSSES:
                continue
            n += 1; ok += bool(generate(cid, sheet, model, quality, force))
    print(f'{ok}/{n} folhas', flush=True)


if __name__ == '__main__':
    main()
