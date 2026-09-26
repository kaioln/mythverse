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

## Limites deste modo

Sem servidor Node, o combate e as recompensas são calculados no navegador e o save é enviado pelo jogador. Isso serve para **testar contas, login, cadastro, saves e ranking**, mas não tem a proteção antitrapaça do servidor autoritativo: um jogador técnico consegue editar o próprio save e o ranking. Mercado de Jogadores, Gemas, perfis públicos e a Invasão Mundial compartilhada dependem do servidor Node e ficam indisponíveis neste modo. Para lançar com dinheiro real, rode o servidor (`DEPLOY.md`) usando o mesmo Neon como banco (`DATABASE_URL`).
