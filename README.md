# MYTHVERSE: Heróis de todos os mundos

<p align="center"><img src="assets/brand/logo-full.png" alt="Mythverse: Heróis de todos os mundos" width="560"></p>

RPG de equipe com combate automático e decisões estratégicas. Sessenta heróis de animes e jogos atravessam a **Fenda** para salvar Tsukimori do eclipse. Convoque, forme laços, monte builds e derrube chefes que exigem preparo de verdade.

---

## 🌐 Como colocar o jogo online (passo a passo no Render)

Siga na ordem. Não precisa saber programar. Leva uns **20 minutos** na primeira vez.

### Antes de começar: o que você vai usar

| Serviço | Para quê | Custo |
|---|---|---|
| **GitHub** | Guardar os arquivos do jogo na internet | Grátis |
| **GitHub Desktop** | Programa que envia os arquivos para o GitHub | Grátis |
| **Render** | O servidor onde o jogo fica ligado 24h | Plano **Starter** (cerca de US$ 7/mês) + disco (cerca de US$ 0,25 por GB/mês) |

> ⚠️ **Por que não usar o plano grátis do Render?** O plano grátis **não tem disco permanente**: toda vez que o servidor reinicia, **todas as contas e saves são apagados**. Para um jogo com contas de verdade, use o plano Starter com disco. Os preços podem mudar; confira em [render.com/pricing](https://render.com/pricing).

### Passo 1: Criar a conta no GitHub

1. Acesse [github.com](https://github.com) e clique em **Sign up**.
2. Crie a conta com seu e-mail e confirme o código que chegar.

### Passo 2: Enviar o jogo para o GitHub

1. Baixe e instale o **GitHub Desktop**: [desktop.github.com](https://desktop.github.com).
2. Abra o programa e entre com a conta do GitHub (**Sign in to GitHub.com**).
3. Clique em **File → Add local repository…** e escolha **esta pasta** (a que tem este arquivo `README.md`).
4. O programa vai dizer que a pasta ainda não é um repositório. Clique em **create a repository**.
   - **Name:** `mythverse`
   - Clique em **Create repository**.
5. Clique em **Publish repository** (botão azul no topo).
   - Deixe marcado **Keep this code private** se não quiser que outras pessoas vejam o código.
   - Clique em **Publish repository**.

✅ Pronto: o jogo está no seu GitHub.

### Passo 3: Criar a conta no Render

1. Acesse [render.com](https://render.com) e clique em **Get Started**.
2. Escolha **Sign in with GitHub**. Assim o Render já enxerga seus repositórios.
3. Cadastre um cartão de crédito em **Billing**, porque o plano Starter é pago.

### Passo 4: Ligar o servidor

1. No painel do Render, clique em **New +** → **Blueprint**.
2. Escolha o repositório **mythverse** (se ele não aparecer, clique em **Configure account** e libere o acesso a ele).
3. O Render lê sozinho o arquivo `render.yaml` que já vem no projeto e mostra:
   - um **Web Service** chamado `mythverse`;
   - um **Disk** chamado `mythverse-data` (é onde ficam as contas e os saves).
4. Clique em **Apply** (ou **Deploy Blueprint**).
5. Aguarde de **3 a 5 minutos**. Acompanhe em **Events/Logs**. Quando aparecer **Live** em verde, está no ar.

### Passo 5: Jogar

1. No topo da página do serviço há um link parecido com **`https://mythverse-xxxx.onrender.com`**.
2. Abra, clique em **Criar conta** e jogue. Mande o link para seus amigos!

### Passo 6 (opcional): Usar um domínio próprio (ex.: `mythverse.com.br`)

1. Compre o domínio (no [registro.br](https://registro.br) para `.com.br`).
2. No Render: serviço **mythverse** → **Settings** → **Custom Domains** → **Add Custom Domain** e digite o domínio.
3. O Render mostra um registro **CNAME** (ou A). Copie-o para a área de **DNS** do registro.br.
4. Em até algumas horas o domínio passa a funcionar, com **HTTPS (cadeado) automático**.

### Como atualizar o jogo depois

1. Altere os arquivos na pasta.
2. No GitHub Desktop, escreva um resumo em **Summary** (ex.: "novos heróis"), clique em **Commit to main** e depois em **Push origin**.
3. O Render detecta a mudança e publica sozinho em poucos minutos. **As contas e os saves continuam salvos** (ficam no disco).

### Backups

- O servidor faz um **backup automático do banco a cada 6 horas** e guarda os 14 mais recentes no disco.
- Cada jogador também tem **20 cópias do próprio save**, que ele mesmo pode restaurar em **Perfil → Conta**.
- O Render também oferece **snapshots do disco** (menu **Disks** do serviço).

### Deu problema?

| O que aconteceu | O que fazer |
|---|---|
| O deploy falhou (vermelho) | Abra **Logs** e procure a primeira linha com "Error". Confira se todos os arquivos foram enviados no Passo 2. |
| "Disk requires a paid plan" | Mude o serviço para o plano **Starter** em **Settings → Instance Type**. |
| O site abre, mas não consigo entrar | Use o endereço **https://** (com cadeado). O login só funciona em HTTPS no servidor. |
| As contas sumiram depois de atualizar | O disco não foi criado. Confira em **Disks** se o `mythverse-data` existe e está montado em `/data`. |

Guia técnico completo (Docker, VPS, Fly.io, variáveis e segurança): [DEPLOY.md](DEPLOY.md).

---

## 💻 Jogar no próprio computador

- **Com contas e save na nuvem:** instale o [Node.js 24](https://nodejs.org), dê duplo clique em `START_GAME.bat` (Windows) ou rode `npm start`, e abra http://localhost:8080.
- **Modo offline:** abrir `index.html` direto no navegador também funciona, mas o progresso fica só nesse navegador, sem conta e sem ranking.

Saves da versão antiga (Hoshikage) não são compatíveis: a nova jornada começa do zero.

## Online

- **Tela de entrada** com login, criação de conta (com aceite dos Termos e da Política de Privacidade) e recuperação de acesso por **código de recuperação**.
- **Servidor autoritativo**: o save mora no servidor. O navegador só envia comandos (ultimate, poção, foco, escolhas) e o servidor **refaz cada luta** com a mesma semente e o mesmo código do jogo antes de pagar ouro, EXP, itens, cartas ou materiais. Loot, refino, convocação e loja são sorteados no servidor. Há **20 cópias de segurança** restauráveis.
- **Ranking** por poder, chefes derrotados, progresso e Fenda Abissal. O poder é recalculado pelo servidor. Clicar num nome abre o **perfil público** (nível, poder, equipe e anúncios).
- **Conta**: trocar senha, gerar novo código de recuperação, encerrar outras sessões, exportar dados e excluir a conta (LGPD).
- **Servidor** sem dependências (Node + SQLite embutido): WAL, migrações, verificação de integridade, backups automáticos, scrypt, sessões HttpOnly, CSRF, limites de tentativa e CSP.

## O que existe no jogo

### Equipe e heróis
- **60 heróis originais** de 30 mundos da Fenda, cada um com kit próprio: **passiva**, **habilidade automática** e **ultimate** (100 de energia; Q/W/E/R ou AUTO). As descrições são geradas a partir dos efeitos reais.
- **5 classes**: Vanguarda, Executor, Arcanista, Atirador e Suporte. Cada uma tem traço próprio, sinergia de equipe e posição ideal.
- **Formação**: as vagas 1 e 2 são a linha de frente, e os inimigos atacam a frente 3× mais que a retaguarda.
- **9 elementos**, com vantagens de +30% e desvantagens de −20%, e **sinergia de elemento** (2, 3 ou 4 heróis iguais).
- **30 laços** entre personagens do mesmo mundo de origem (ex.: Solen + Varyon, Lucan + Mira + Erik, Kael + Rina + Sael).
- **Atributos clássicos** por herói: FOR, AGI, VIT, INT, DES e SOR, com 3 pontos por nível.
- **Árvore de talentos própria de cada herói**, baseada na classe: 3 círculos, nós com ícones e ranks, Notáveis, Pedras-chave e três nós exclusivos, a **Essência** (um traço único por herói, nenhum se repete) e os nós que fortalecem a habilidade e a ultimate daquele herói. Rende 1 ponto por nível.
- **Build recomendada** para cada um dos 60 heróis: proporção de atributos, ordem de talentos, tipo de arma, conjuntos e afixos, com botão para aplicar.
- **As 10 convocações iniciais** nunca repetem herói e garantem pelo menos 1 de cada classe.
- **Mudança de Classe** no nível 30, como os jobs do Ragnarok: Paladino, Mestre das Lâminas, Sábio Arcano, Franco-Atirador e Sumo Sacerdote (+10% nos atributos, +5 pontos e acesso ao Círculo III).
- **Raridade, estrelas e Despertar**: heróis repetidos viram fragmentos, e cada ★ dá +12% nos atributos e +8 níveis máximos.

### Progressão da conta
- **Treino da equipe** no Dojo: ATK, HP, DEF e Crítico para todos os heróis. Só os heróis da equipe ganham EXP em combate; os do banco evoluem em Expedições.
- **Casa do Time**: Galeria com até 6 cartas expostas (25% dos atributos de cada carta para a equipe inteira) e **Álbum de cartas** com 7 marcos de bônus permanentes, no estilo do livro de cartas do Ragnarok.
- **Paragão** (estilo Diablo): EXP de heróis no nível máximo vira níveis de conta, +0,4% de ATK/HP/DEF para a equipe por nível (até 300).
- **Construções**: Forja, Dojo, Santuário, Oficina, Guilda, Mercado e Casa do Time. O nível máximo acompanha o nível da conta.

### Itens e builds
- **4 espaços** de equipamento: Arma, Foco, Selo e Omamori.
- **Armas por classe**: Espadas (Executor/Vanguarda), Armas pesadas e manoplas (Vanguarda), Arcos (Atirador), Cajados arcanos (Arcanista/Suporte) e Relíquias sagradas (Suporte), cada tipo com atributo implícito e afixos próprios. Armas de conjunto servem a qualquer classe e há exceções pela história (Bjorn e Dana usam arco, Alden e Yuki usam lâminas, lutadores de punho usam manoplas…).
- **111 bases** de item, **19 afixos** e raridades Comum, Raro, Épico, Lendário, Mítico e Conjunto. Chances muito baixas de propósito: nos mapas iniciais o máximo é Épico; lendários vêm quase só de chefes, Invasões Mundiais e eventos.
- **Requisitos para equipar**: nível mínimo do herói (pelo nível e raridade do item) e atributo mínimo nas armas; cada classe usa os seus tipos de arma, foco e selo.
- **15 conjuntos** com bônus de 2 e 4 peças, cada um vindo de uma região específica.
- **29 itens míticos únicos** com efeitos especiais.
- **Cartas** no estilo Ragnarok: cada uma das 94 criaturas tem a sua, em 4 raridades (Comum 1 em 60.000 abates, Rara 1 em 22.000, Épica 1 em 6.000, MVP 1 em 1.500 nos chefes). Cartas são muito fortes, as épicas e MVP têm efeito especial, e valem Gemas no Mercado de Jogadores.
- **Refino** de +1 a +15 com 4 materiais: Tamahagane (até +10; de +5 a +8 a falha tira 1 nível, depois disso quebra), Aço Estelar (até +8 sem perder nível, +9 e +10 podem quebrar), Oricalco (até +15; de +11 em diante a falha tira 1 nível) e Adamantina (+10 a +15 sem regredir, mas pode falhar). Em +15 o atributo principal fica ×4,25.
- **Oficina**: encantamentos que re-sorteiam afixos, culinária (buffs de ouro, EXP e sorte) e transmutação de materiais, com limite diário.
- **Bolsa** com 150 espaços (até 400 pela Loja), barra de heróis para equipar qualquer um sem sair da tela, filtros, comparação, trava, abas de Cartas, Materiais e Consumíveis. Com a bolsa cheia nada some: os itens vão para o **Excedente**.

### Mundo
- **Capítulo I**: Bosque das Lanternas → Templo do Véu → **Shirogane**, com rotas secundárias: **Pântano dos Vaga-lumes** (caçada) e **Cripta de Jade** (dungeon).
- **Capítulo II**: Costa das Marés → Arquivo Submerso → **Mizuchi**, com **Planalto Congelado** e **Forja Abissal**.
- **Capítulo III**: Areias do Tempo → Torre do Relógio → **Apep, Serpente do Tempo**, com a **Cidade Fantasma**.
- **Capítulo IV · O Céu Partido**: Ilhas Flutuantes → Santuário das Nuvens (Fujin, Senhor dos Ventos) → **Raijin, o Tambor do Trovão**, com o **Vale das Cerejeiras Eternas**. 21 criaturas novas, conjuntos Tambores da Tempestade e Hanami Eterno e dois míticos.
- **Fenda Abissal**: andares infinitos com monstros próprios e uma **mutação** por andar (Fúria, Carapaça, Pressa, Sangria…), com recorde no ranking.
- **Invasão Mundial**: um chefe mundial por dia, em duas janelas (12h30 às 14h e 20h30 às 22h de Brasília), 1 tentativa por dia, dano somado por todo o servidor e dificuldades Heroica e Mítica cooperativas.
- **Expedições** (correm no servidor, mesmo com o PC desligado) e **Quadro de Recompensas** com loja de Marcas de Caçador.
- **Evento**: Kitsune das Lanternas, disponível durante o Festival.
- **94 criaturas**, cada uma com habilidade própria e exclusiva da sua região (inclusive os lacaios invocados pelos chefes). As ondas variam de formato (matilhas, pares, mistos) e há variantes **Alfa** raras com loot garantido.
- **Bestiário**: abates liberam níveis de pesquisa (+dano e +chance de carta contra aquela criatura).
- **Chefes** com 3 fases, ataques preparados (⚠ e zona de perigo), invocações, cura e **Fúria** por tempo. Dificuldades Normal, Pesadelo e Inferno.
- **Eventos mundiais por calendário fixo** (data e hora de Brasília, relógio do servidor): Maré Dourada, Festival das Cerejeiras, Noite dos Oni, Maré de Éter, Lua de Sangue, Festival das Lanternas e Chuva de Estrelas. A agenda aparece no painel lateral e na Wiki.
- **Escolhas de rota e encontros**: com AUTO ligado a equipe decide sozinha; com AUTO desligado a opção recomendada vem marcada e é escolhida sozinha após 2 minutos sem resposta.
- **Encontros aleatórios** nas caçadas: Raposa Dourada, Mercador Errante, Santuário (bênçãos), Emboscada e Baú Misterioso (pode ser um Mímico).
- **História** contada por Sayo, a Guardiã do Véu, com falas dos chefes.

### Ritmo e dificuldade
- Os inimigos ficam **20% mais fortes a cada estágio**, e o poder recomendado de cada região aparece na tela.
- **Derrota não te tira da luta**: na caçada e na Fenda, a equipe recua um estágio/andar e continua treinando. Em dungeons e chefes, a equipe volta a treinar automaticamente.
- **Conselheiro**: duas derrotas seguidas no mesmo desafio abrem um plano com o que falta (pontos, itens melhores, formação, elemento, onde treinar), com botões para resolver na hora.
- **Modo AFK no servidor**: até 12 horas de caça calculadas com o relógio do servidor, mesmo com o PC desligado. Rende menos que jogar ativo.
- **Manual rende mais que AUTO**: ultimates usadas à mão dão +25% de dano e escudo e +20% de cura.
- **Quebra de postura**: golpes em elites e chefes enchem uma barra; cheia, o inimigo fica atordoado 4 s, **perde o ataque que estava preparando** e recebe +35% de dano (cada quebra seguinte exige 30% mais).
- **Elo Kizuna**: ultimates de heróis diferentes em até 4 s formam uma corrente (+15% por elo); com 4 elos a equipe inteira golpeia junta.

### PvP, guildas e guerra
- **Arena da Fenda (PvP assíncrono manual)**: você controla ultimates, poções e foco contra a defesa salva de outro jogador (a IA dele telegrafa as ultimates). Matchmaking por **MMR (Elo)**, ligas Bronze→Lenda, 10 ingressos por dia, recompensa semanal por liga, ranking e histórico. Fechar a aba ou abandonar conta como derrota.
- **Loja de Honra**: Aço Estelar, Oricalco, Baú do Gladiador, peças do conjunto **Gladiador da Fenda** (negociáveis no Mercado), com limite semanal. A Honra fica no banco: não se compra com dinheiro nem se edita.
- **Guildas completas**: fundar, entrar (aberta ou por pedido), cargos (líder, oficial, membro), expulsar, transferir liderança, doações que sobem o nível (até 30 membros), bônus de ouro/EXP/itens por nível, mural e registro de eventos.
- **Guerra de Guildas** (quarta e sábado, 20h às 22h de Brasília): pareamento por rating, 3 investidas manuais por membro, pontos por defensor derrotado, placar ao vivo e recompensas de Honra, EXP e rating.

### Economia viva e profissões
- **Banco Central da Fenda**: a cada 20 min mede o ouro em circulação por jogador ativo (bolsos, cofres de guilda, correio e ordens) contra a meta do nível médio. Com inflação, a torneira de ouro fecha aos poucos (até 60%), preços de NPC e obras sobem (até ×1,6) e o imposto do mercado sobe (5% a 12%); com deflação, tudo afrouxa. Painel em **Loja → Economia** com índice, histórico e preços de referência.
- **Mercado de Jogadores completo**: anúncios, **ordens de compra** (materiais e cartas, ouro reservado no banco), histórico diário de preços, expiração em 7 dias, teto de 15× a mediana contra manipulação e limite de 5 compras por dia do mesmo vendedor contra lavagem.
- **Profissões** (coleta e criação): Mineração, Herbalismo e Extração de Essências coletam entre as ondas; Alquimia (frascos de batalha) e Artesania (equipamentos assinados e negociáveis) transformam isso em produtos para o Mercado. Nível até 50.
- **Ouro mais escasso**: todas as fontes passam por uma torneira única; fundar guilda custa 1,5 milhão.

### Guia, missões e loja
- **Guia do Viajante** com 27 passos e recompensas, e o menu **Aventuras**, que mostra tudo o que dá para fazer agora (invasão, expedições, recompensas, eventos, Fenda, chefes).
- **Contratos da Guilda** com **Rank da Guilda** sem limite, **missões diárias** (meia-noite de Brasília), **login diário** em ciclo de 7 dias, **Crônicas** infinitas depois do Guia e 43 conquistas.
- **Loja** em ouro (poções, elixires, pergaminhos de EXP, materiais) e em cristais (chaves, expansão da bolsa, incenso de EXP/ouro, redefinição de talentos), além do **Mercado** com ofertas a cada 2 horas.
- **Gemas (dinheiro real) e Mercado de Jogadores**: 100 Gemas = R$ 1,00, depósito via Pix (Mercado Pago), saque com revisão manual e taxas configuráveis (padrão: 5% na venda, 2% no saque). Itens e cartas anunciados ficam sob custódia do servidor; compras chegam pelo Correio. Tudo fica **desligado** até você configurar `RMT_ENABLED=1` e o provedor (veja `.env.example`).
- **Mercado de Jogadores em ouro** (para todos, sem dinheiro real, com taxa de anúncio e imposto que seguram a inflação) e **em Gemas** (dinheiro real, opcional), com filtros por tipo, espaço, raridade e preço, venda de itens, cartas e materiais raros, histórico de preço por moeda e perfil clicável de cada vendedor. Itens vindos de NPCs são **vinculados**. Também funciona no **modo Neon** (GitHub Pages): anúncios, compra e correio ficam em funções atômicas do banco (veja docs/NEON.md).
- **Painel `/admin/`** com a saúde da economia (ouro em circulação, Gemas, volume do mercado, itens mais negociados, alertas antifraude) e a fila de saques.
- **Ranking** com pódio, retrato do herói líder, equipe de cada jogador e barra de comparação com o primeiro colocado.
- **Ícones vetoriais autorais** para recursos, atividades e golpes (`python tools/build_icons.py`), e efeitos de combate com textura (brilho suave, cortes em crescente, estrelas de impacto, raios com núcleo).
- **Wiki completa** dentro do jogo, gerada a partir dos dados reais: combate, classes, elementos, laços, os 60 kits, builds, armas, itens, cartas, monstros, mundo, eventos, progressão, refino, atividades, economia, mercado e segurança.

## Controles

| Tecla | Ação |
|---|---|
| Q W E R | Ultimate dos heróis 1 a 4 |
| 1 / 2 | Poção de Cura / Elixir de Energia |
| A | Liga/desliga ultimates automáticas |
| M · I · T | Mapa · Bolsa · Talentos do herói |
| Clique no inimigo | A equipe foca nesse alvo |
| ESC | Fecha painel ou diálogo |

## Arquitetura

Sem frameworks nem dependências de runtime. Os scripts são clássicos, carregados em ordem:

- `src/data.js`: elementos, classes, sinergias, laços, monstros, regiões, eventos, encontros, história, guia, contratos, conquistas e construções.
- `src/items.js`: bases, afixos, conjuntos, únicos, drops, aprimoramento e desmontagem.
- `src/progression.js`: atributos, árvore de talentos, treino e loja.
- `src/roster.js`: os 60 kits (linguagem de efeitos) e o gerador de descrições.
- `src/engine.js`: estado, cálculo de atributos, combate com efeitos e status, estágios, chefes, talentos, cartas, economia e offline.
- `src/net.js` e `src/auth.js`: cliente da API, sincronização na nuvem e tela de entrada.
- `server/`: servidor HTTP (`index.js`), banco (`db.js`), segurança (`security.js`) e validação de saves com o mesmo código do jogo (`game.js`).
- `src/renderer.js`: palco em Canvas (câmera, auras em silhueta, VFX, telegraph, cut-ins).
- `src/ui.js` e `src/panels.js`: HUD, diálogos, resultados e todas as telas.
- `src/main.js`: boot, loop, sons sintetizados e sincronização com o servidor.
- `server/authority.js`: servidor autoritativo (lutas refeitas, operações validadas, AFK, Invasão Mundial). `server/economy.js`: carteira, Pix, mercado e perfis.
- Documentos: `docs/ECONOMIA.md` (fontes, sumidouros e números do simulador) e `docs/SEGURANCA.md` (camadas de proteção e checklist de produção).

## Ferramentas

```bash
npm test                    # ~1.370 verificações do jogo, 29 de determinismo (cliente = servidor) e 223 do servidor em SQLite e Postgres
node tools/sim.js 10 7      # simula 10h de um jogador automático: marcos, ouro por hora, loot por raridade, cartas e materiais
python tools/build_sprites.py  # regenera sprites, retratos, ícones e variantes a partir dos atlas
python tools/build_icons.py    # regenera os ícones vetoriais da interface (assets/ui)
```

O simulador serviu para calibrar o balanceamento (detalhes em `docs/ECONOMIA.md`). Um jogador atento chega ao estágio 12 do Bosque em cerca de 1h, ao Templo III em cerca de 2h40 e derrota o chefe do Capítulo I perto das 6h. O ouro por hora sobe de ~55 mil no início para ~700 mil no Capítulo II.

## Arte e licenças

Nomes, mundos, habilidades, laços e textos dos 60 heróis são **originais**. Monstros, chefes, cenários, itens e ícones também são autorais (gerados para o projeto e processados pelos scripts em `tools/`).

**Atenção antes de cobrar dinheiro:** os retratos e sprites dos heróis ainda são os do protótipo e lembram personagens de outras obras. Trocar só o nome não resolve: o visual de um personagem também é protegido (Lei 9.610/98). Antes de ativar o mercado com dinheiro real, substitua essas 60 artes por desenhos originais seguindo `docs/ARTE_ORIGINAL.md` (briefing de cada herói e o passo a passo para trocar os arquivos). Proveniência das artes atuais em `docs/CROSSOVER_ASSETS.md`.
