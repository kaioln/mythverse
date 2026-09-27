# Modo Neon (GitHub Pages + Neon, sem servidor Node)

O site estático (GitHub Pages) fala direto com o Neon:

- **Neon Auth** (Better Auth gerenciado): cadastro e login por e-mail e senha. A sessão fica num cookie seguro do domínio do Neon (`HttpOnly; Secure; SameSite=None; Partitioned`).
- **Data API**: o save de cada conta fica em `public.mv_saves`, protegido por **RLS** (cada jogador só lê e grava a própria linha). O ranking lê a visão `public.mv_ranking`, que mostra só nome, poder e progresso.
- O jogo roda no navegador e salva na conta a cada 20 s e ao fechar a aba. Uma revisão por save impede que um aparelho antigo sobrescreva um progresso mais novo.

## Configuração (uma vez)

No [Console do Neon](https://console.neon.tech), no projeto:

1. **Auth**: ativar (já feito).
2. **Auth → Configuration → Domains**: adicionar `https://kaioln.github.io` (sem barra no final). Localhost já é liberado.
3. **Data API**: clicar em **Enable Data API** e escolher o **Neon Auth** como provedor.
4. Criar as tabelas e regras:

```bash
node --env-file=.env tools/neon_setup.js
```

5. Em `src/config.js`, `neon` aponta para o banco (URL sem usuário e senha). Commit e push para o GitHub Pages.

## Mercado de Jogadores (ouro)

Rodar `node --env-file=.env tools/neon_setup.js` também cria o mercado: `mv_listings` (anúncios), `mv_mail` (correio), as visões públicas `mv_market` e `mv_sales` e as funções `mv_market_list`, `mv_market_buy`, `mv_market_cancel` e `mv_mail_claim`. O banco garante que um anúncio só é vendido uma vez, que o correio só é resgatado uma vez, que o vendedor recebe o preço menos 5% de imposto e que cada conta tem no máximo 20 anúncios abertos. A vitrine nunca mostra o id da conta do vendedor. Teste local: `node tests/neon_market.test.js` (Postgres embutido).

## Arena, Guildas e Guerra

`tools/neon_social.sql` (aplicado pelo mesmo `neon_setup.js`) cria a Arena PvP, a Loja de Honra, as Guildas e a Guerra de Guildas. **Honra, MMR, ingressos diários, limites semanais, cargos e pontos de guerra vivem no banco** e só mudam por funções. Cada luta guarda a semente sorteada pelo banco e os comandos do jogador, para um servidor poder refazê-la no futuro. Teste local: `node tests/neon_social.test.js`.

## Limites deste modo

Sem servidor Node, o combate e as recompensas são calculados no navegador e o save é enviado pelo jogador. Isso serve para **testar contas, login, cadastro, saves e ranking**, mas não tem a proteção antitrapaça do servidor autoritativo: um jogador técnico consegue editar o próprio save e o ranking. Neste modo quem informa o resultado da luta PvP é o navegador (o banco recusa durações impossíveis e conta abandono como derrota, mas um jogador técnico ainda poderia forjar uma vitória). Para lançar, rode o servidor Node, que refaz cada luta. Gemas (dinheiro real), perfis públicos completos e a Invasão Mundial compartilhada dependem do servidor Node. No Mercado em ouro, o banco protege a troca (nada é vendido ou resgatado duas vezes), mas o ouro e os itens continuam no save do jogador, que ele consegue editar e ficam indisponíveis neste modo. Para lançar com dinheiro real, rode o servidor (`DEPLOY.md`) usando o mesmo Neon como banco (`DATABASE_URL`).

## Administração, relógio e segurança (`tools/neon_admin.sql`)

- `mv_now()`: hora oficial. O jogo sincroniza o relógio por ela; sem ela, o AFK não é concedido.
- Guarda do save: recusa relógio adiantado (mais de 15 min), herói acima do nível 100 ou 6★ e recursos negativos; saltos grandes (níveis, chaves, cristais) vão para `mv_audit` (só o dono do banco lê).
- Tabelas do servidor Node no mesmo banco (`users`, `saves`, `save_history`…) ficam fechadas para a Data API (antes qualquer conta logada lia e apagava, inclusive hashes de senha).
- Presentes: `node --env-file=.env tools/neon_gift.js <conta> keys 1000` ou `... hero kakashi legendary`. O presente vai para o correio e o jogo resgata sozinho ao abrir.
