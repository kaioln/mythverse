# Arte nova dos heróis: pedidos prontos

Os sprites atuais foram gerados a partir de personagens reais (Goku, Tanjiro, Mercy…) e continuam reconhecíveis. Trocar
cor ou detalhe não resolve: a lei protege o personagem, e silhueta, roupa e acessórios icônicos seguem lá. O caminho seguro
é **desenhar personagens novos no mesmo estilo**. Este arquivo tem tudo para isso: seis pedidos, um por folha de 10 heróis,
no mesmo formato das folhas atuais. O script do projeto recorta, contorna, gera retratos, formas despertadas e webp sozinho.

## Como usar

1. Abra o gerador de imagens (o mesmo tipo de ferramenta que fez as folhas atuais).
2. **Referência de estilo:** anexe `assets/original/enemies-atlas.png` (arte original do jogo, mesmo traço) e diga que é
   só referência de estilo. **Nunca** anexe as folhas de `assets/crossover/` nem cite nomes de personagens ou obras.
3. Cole o **pedido-base** abaixo seguido da lista de UMA folha. Gere a folha. Se algum herói sair parecido com um personagem
   conhecido, peça para refazer só aquele quadro mudando cabelo, roupa e arma.
4. Salve como `assets/original/heroes-1.png` … `heroes-6.png` (PNG com transparência, grade 5 × 2, na ordem da lista).
5. Rode:

   ```
   python tools/build_sprites.py --heroes
   python tools/build_sprites_web.py
   ```

   Folhas que ainda não existirem continuam usando as antigas, então dá para trocar uma folha por vez.
6. Quando as seis estiverem prontas, apague `assets/crossover/`. O repositório ainda guarda as imagens antigas no
   histórico do git; antes de lançar com dinheiro real, crie um repositório novo sem esse histórico.
7. Guarde os termos de uso do gerador (ou o contrato do artista) e revise o elenco com um advogado antes do lançamento.

## Pedido-base (cole antes da lista)

> A 2D sprite sheet of ten ORIGINAL characters for a fantasy RPG, in a strict grid of 5 columns by 2 rows, read left to
> right, top to bottom, one character alone in each cell. Match the attached image's art style only: chibi proportions
> (about 2.5 heads tall), clean dark outline, soft cel shading with painted highlights, rich but calm colors, full body,
> dynamic combat pose facing three-quarters to the right, feet visible. Transparent background, no text, no frame, no
> scenery, no logos, no emblems. Every character must be an original design that does not resemble any existing anime,
> manga, comic, film or video game character. Characters, in order:

## Folha 1 · `assets/original/heroes-1.png`

1. **Solen Kairos** (Arcanista, Luz): young sun-mage; short wavy white-gold hair with a small low ponytail; long white coat
   with amber star embroidery and a hood down; brass orrery staff with a glowing sun sphere; calm confident smile.
2. **Varyon, o Príncipe Cinza** (Executor, Raio): slender noble duelist; ash-grey hair swept back into a short braid; high
   collar grey-and-violet tailcoat with silver buttons; thin rapier crackling with violet lightning; proud raised chin.
3. **Hayato Kazeno** (Vanguarda, Vento): broad cheerful youth; messy teal hair with a wind-feather clip; pale green
   quilted armor vest over a white tunic; huge fan-shaped iron shield; wind ribbons around the arms.
4. **Rai Kurogane** (Arcanista, Raio): quiet storm caster; long straight dark-blue hair tied high; long charcoal robe with
   yellow lightning-bolt trim; a floating ring of five small thunder talismans; one gloved hand raised.
5. **Tobias Maré** (Vanguarda, Fogo): stocky harbor brawler; curly auburn hair with a knotted orange headscarf; sleeveless
   sailor coat in navy with red rope belt; big iron anchor-hammer; bandaged forearms; wide grin.
6. **Kenji Tríplice** (Executor, Vento): lean mercenary; silver-blue hair in a long braid; sleeveless deep-red kimono jacket
   over grey trousers; one long nodachi held high and two short daggers on the hips; scar across the chin.
7. **Hiro Kagetsu** (Executor, Sombra): moon swordsman; shaggy silver hair with a black streak; dark purple layered
   hakama with a crescent-moon clasp; wide curved blade made of dark glass; faint violet mist at the feet.
8. **Yuki Shirasagi** (Suporte, Gelo): gentle healer; short white bob with a heron-feather pin; pale blue robe with frost
   lace; small bell-topped ice staff; snowflakes drifting around her hands.
9. **Akira Minase** (Executor, Água): young river swordsman; spiky dark-teal hair with a white wave-shaped headband; plain
   indigo jacket with a single white wave line (no checkered pattern); straight blade trailing water; straw sandals.
10. **Hana Minase** (Vanguarda, Fogo): fierce girl with short copper hair and two ember hairpins; red lacquered shoulder
    armor over an orange tunic; spiked war-club glowing like coal; bare determined stance.

## Folha 2 · `assets/original/heroes-2.png`

1. **Sora Hakuren** (Arcanista, Luz): tall calm mage; neat light-brown hair; round golden glasses; cream high-collar coat
   with long sleeves; a floating white book and a small halo of light squares.
2. **Daichi Kuroba** (Vanguarda, Sombra): muscular teenage fighter; short dark-green hair with shaved sides; heavy black
   leather gauntlets with purple rune stones; grey hooded vest; cursed purple sigil on one gauntlet.
3. **Lucan Voss** (Executor, Vento): veteran ranger; greying blond hair in a short tail; light green scale armor and a
   brown travel cloak; twin short swords; wind-carved wooden bracer.
4. **Mira Voss** (Executor, Vento): agile scout; long auburn hair in a side braid; sage-green tunic with leather straps;
   a pair of curved sickles; a small hawk feather on the ear.
5. **Erik Hallen** (Vanguarda, Terra): towering stone knight; short brown hair with a thick beard; ochre plate armor with
   rock-like shoulder plates; great tower shield carved like a cliff; heavy stance.
6. **Alden Ferro** (Suporte, Terra): kind alchemist; curly dark hair and freckles; ochre apron coat full of vial pouches;
   brass gear staff with a green potion core; round goggles on the forehead.
7. **Coronel Ignis Varra** (Arcanista, Fogo): elegant fire officer; slicked black hair with a red streak; long crimson
   military cape over a white uniform with gold cords; ornate flintlock-shaped wand shooting flame.
8. **Toma Hikari** (Vanguarda, Raio): earnest youth; spiky blond hair; bright yellow armored suit with blue joints and a
   lightning visor pushed up; oversized mechanical gauntlet; sparks on the boots.
9. **Ryo Kazan** (Arcanista, Fogo): hot-headed mage; short dark-red hair; black and orange flame robe; two small floating
   braziers; clenched fists wreathed in fire.
10. **Grant Valor** (Vanguarda, Luz): cheerful giant paladin; short golden hair, broad shoulders; white and gold plate
    armor with a sunburst on the shield; huge warhammer; heroic stance.

## Folha 3 · `assets/original/heroes-3.png`

1. **Mestre Kenta** (Vanguarda, Luz): relaxed monk; long dark ponytail and headband; plain beige gi with gold trim and a
   white sash; bare hands with golden knuckle wraps; sleepy expression.
2. **Volt-7** (Atirador, Fogo): android gunner; short silver hair; matte white and red armor plates with glowing orange
   seams; arm-mounted heat cannon; visor over one eye.
3. **Kai Morinaga** (Vanguarda, Natureza): wild forest boy; shaggy brown hair with leaves; green bark-plated vest; big
   wooden club with vines; bare feet; energetic grin.
4. **Riku Shiro** (Executor, Raio): quick young assassin; short black hair; navy hooded cropped jacket; dual yellow
   energy claws; blue lightning trailing from the heels.
5. **Elian Rubra** (Suporte, Luz): serene chain-priest; long blond hair tied loosely; white and gold priest robes; a
   golden chain with a small bell wrapped around one arm; open palm healing gesture.
6. **Aiko Lunaris** (Suporte, Luz): gentle moon priestess; long silver hair in a single low braid; lavender and white
   robe with crescent embroidery; tall crescent staff; floating lantern of moonlight.
7. **Kiba, o Meio-Espírito** (Vanguarda, Vento): half-spirit warrior; long pale-green hair; small horns; grey fur mantle;
   heavy curved cleaver; claw-like gauntlets; bold stance.
8. **Jin Hayate** (Executor, Vento): calm wandering swordsman; dark-teal hair in a tidy bun; light grey travel kimono
   with a green scarf; straight katana drawn low; wind lines.
9. **Drake Ember** (Arcanista, Fogo): cocky dragon mage; short dark hair with orange tips; black sleeveless coat with red
   scale patterns; small draconic horns of flame; fire coiled like a dragon around one arm.
10. **Sienna Valmar** (Vanguarda, Terra): stern knight-commander; short dark-bronze hair; bronze and brown full plate
    with a stone-grey cape; long halberd; shield on the back.

## Folha 4 · `assets/original/heroes-4.png`

1. **Daigo Arashi** (Vanguarda, Fogo): stocky martial artist; short black hair with a red bandana tied at the back; dark
   red sleeveless gi; heavy iron arm guards; flame aura around the fist.
2. **Mei Lan** (Executor, Vento): agile kicker; long black hair in a single high ponytail; teal sleeveless tunic with
   wide trousers; steel-tipped boots; paper wind charms at the belt.
3. **Kael Arden** (Executor, Raio): tired mercenary; short dark-brown hair; blue quilted coat; a slim jagged saber with
   segmented yellow glow; single shoulder pauldron.
4. **Sael, a Asa Negra** (Arcanista, Sombra): cold dark mage; short black hair; one black raven wing; violet high-collar
   robe; floating dark crystal shards instead of a weapon.
5. **Rina Akemi** (Suporte, Terra): cheerful brawler-healer; brown hair in two buns; ochre martial tunic with a medic
   armband; wooden healing bracelets; fist bumping forward.
6. **Nádia Crane** (Atirador, Terra): explorer archer; auburn hair in a messy bun; khaki field jacket and scarf; recurve
   bow and quiver of feathered arrows; compass on the belt.
7. **Thorn Varg** (Vanguarda, Gelo): old northern warrior; long white beard braided; blue fur cloak; frost-covered
   two-handed axe; blue face paint in a simple line.
8. **Bjorn Varg** (Suporte, Natureza): young rune shaman; shaggy blond hair; green fur-lined tunic; wooden staff with
   carved runes and a small bird perched on top.
9. **Comandante Rook** (Atirador, Raio): space marine; bulky rounded armor in dark blue and white with yellow stripes;
   open helmet showing a determined face; long rail rifle.
10. **O Carrasco** (Atirador, Fogo): grim fire hunter; soot-black hooded cloak over rust-red leather armor; iron mask
    covering the lower face; twin-barrel hand cannon with glowing coals.

## Folha 5 · `assets/original/heroes-5.png`

1. **Zara Fagulha** (Atirador, Fogo): chaotic tinkerer girl; short spiky pink hair; oversized orange engineer jacket
   with patches; goggles; homemade rocket launcher made of scrap.
2. **Kira das Nove Caudas** (Arcanista, Luz): fox spirit mage; long cream hair; small fox ears; many short golden
   tails; white shrine robe with gold; floating paper lantern orbs.
3. **Haru Kaze** (Executor, Vento): drifting swordsman; short messy grey hair; light blue haori over a black shirt;
   curved katana with wind trails; bamboo hat on the back.
4. **Ivy Tempo** (Atirador, Raio): energetic courier; short blue hair; yellow flight vest with a glowing clock gauge on
   the chest; twin small blasters; motion streaks.
5. **Nari Mecha** (Vanguarda, Raio): small pilot girl; brown twin tails; yellow jumpsuit; standing beside her own
   compact yellow-and-navy walker with a round shield arm.
6. **Aurélia Asas** (Suporte, Luz): kind field medic; short blond hair; white and gold medic armor; two small crystalline
   wings; slender healing staff with a glowing leaf tip.
7. **Dario Venturi** (Executor, Sombra): rooftop rogue; dark hooded short cloak in violet and black; masked lower face;
   short curved dagger and a hidden forearm spike; crouching pose.
8. **Cole Harper** (Atirador, Fogo): rookie guard; short brown hair; reddish-brown leather patrol jacket; lantern on the
   belt; heavy revolver; confident stance.
9. **Dana Reyes** (Suporte, Natureza): field survivor; short dark hair; green combat vest with herb pouches; spray-bottle
   staff of healing mist; bandage roll on the arm.
10. **Wade Callahan** (Atirador, Terra): frontier ranger; wide-brim ochre hat; tan poncho; lever rifle; cheerful scarf;
    sun-worn face with stubble.

## Folha 6 · `assets/original/heroes-6.png`

1. **Garrick do Vale** (Arcanista, Fogo): rune smith mage; short dark-red hair and trimmed beard; brown leather coat
   with glowing orange runes; iron rune hammer used as a focus; ember sparks.
2. **Zira** (Executor, Vento): young portal swordswoman; short silver-teal hair; light grey coat with a green sash; thin
   curved sword; small portal ripples at her feet.
3. **Unidade Ômega** (Atirador, Sombra): elegant android; short lavender hair; dark violet bodysuit with silver lines;
   floating triangular drone beside her; no blindfold, bright violet eyes.
4. **Unidade Sigma** (Vanguarda, Fogo): battle android; long copper hair tied back; red and black armored plates; huge
   chain-blade sword; exposed orange core on the chest.
5. **Rex Sable** (Atirador, Fogo): flashy gunslinger; spiky dark-red hair; black coat with crimson lining; two ornate
   pistols of different design; crimson pact mark glowing on one hand.
6. **Virel Sable** (Executor, Sombra): cold swordsman; neat dark-violet hair; long dark grey coat with violet lining;
   straight ceremonial sword with a purple edge; spectral blades floating behind.
7. **Selene Noir** (Arcanista, Sombra): theatrical witch; long dark-violet hair in loose curls; black and plum gown
   with lace; ornate pocket-watch focus; clock-hand runes floating around.
8. **Tessa Rubra** (Atirador, Natureza): forest hunter; auburn hair in many small braids with wooden beads; leaf-green
   hide armor; carved bow with glowing green string; small mechanical owl on the shoulder.
9. **Kaji, o Espectro** (Executor, Fogo): haunted fighter; dark grey hooded garb with red trim; half mask of charcoal
   iron; burning chain-sickle; ember eyes.
10. **Kori, o Gélido** (Arcanista, Gelo): stoic ice mage; short icy-white hair; long pale blue coat with snowflake
    patterns; crystal staff; breath visible in the cold.

## Checklist por quadro (antes de aceitar a folha)

- Nenhum herói lembra um personagem existente pela silhueta, cabelo, roupa, arma ou cores.
- Nada de símbolos, logos, kanji no peito, bandanas de vila, chapéus e capas famosas.
- O herói bate com a classe (arma) e o elemento (cor) da lista.
- Fundo transparente e personagem inteiro dentro do quadro.
