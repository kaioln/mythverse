# Colocando o Mythverse online

O servidor é **Node.js puro** (sem `npm install`): serve o jogo, cuida das contas, sessões, saves na nuvem e ranking. O banco é **SQLite embutido do Node**, em modo WAL, com verificação de integridade na inicialização e backups automáticos.

## Requisitos

- Node.js **22.13+** (recomendado **24 LTS**)
- Um **disco persistente** para a pasta `DATA_DIR` (banco + backups)
- **HTTPS** na frente (Render, Fly, Railway e Cloudflare já entregam; em VPS use Caddy ou Nginx)

## Rodar localmente

```bash
npm start
```

Depois abra http://localhost:8080. No Windows, `START_GAME.bat` faz isso sozinho. Em ambiente de desenvolvimento o cookie de sessão não exige HTTPS.

Testes:

```bash
npm test
```

## Opção 1 — Render (mais simples)

1. Suba esta pasta para um repositório no GitHub.
2. No Render: **New → Blueprint** e selecione o repositório. O `render.yaml` cria o serviço Docker com um disco de 1 GB em `/data`.
3. Aponte seu domínio nas configurações do serviço. O HTTPS é automático.

## Opção 2 — Docker em qualquer servidor (VPS)

```bash
docker compose up -d --build
```

O `docker-compose.yml` já usa um volume `mythverse-data` para o banco. Coloque um proxy HTTPS na frente. Exemplo com Caddy (`Caddyfile`):

```
seujogo.com.br {
  reverse_proxy localhost:8080
}
```

## Opção 3 — Fly.io / Railway

Use o `Dockerfile`. Crie um volume persistente montado em `/data` e defina as variáveis abaixo. Rode **uma única instância**, porque o SQLite fica num disco local.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 8080 | Porta HTTP |
| `DATA_DIR` | `./data` | Banco `mythverse.db` e pasta `backups/` (disco persistente!) |
| `NODE_ENV` | — | `production` ativa o cookie `Secure` e faz um backup ao iniciar |
| `TRUST_PROXY` | — | `1` atrás de proxy/CDN (usa `X-Forwarded-For` para os limites por IP) |
| `SECURE_COOKIE` | igual a produção | `1` exige HTTPS para o cookie de sessão |
| `SESSION_DAYS` | 30 | Validade da sessão |
| `BACKUP_HOURS` | 6 | Intervalo dos backups (`VACUUM INTO`, mantém os 14 mais recentes) |
| `PUBLIC_ORIGIN` | — | Origem pública, se o proxy mudar o cabeçalho Host |

## Segurança implementada

- Senhas com **scrypt** (salt por usuário) e comparação em tempo constante, inclusive quando o usuário não existe.
- Sessões com token aleatório de 256 bits. O banco guarda **só o hash** do token, e o cookie é `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- **CSRF**: toda alteração exige o cabeçalho `X-MV-Request` e a mesma origem.
- **Limites de tentativa**: login (8 por usuário e 20 por IP a cada 15 min), cadastro, recuperação, saves e API geral.
- Cabeçalhos de segurança: CSP restritiva, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- Recuperação de conta por **código de recuperação**, mostrado uma única vez no cadastro (funciona sem servidor de e-mail).
- Troca de senha e recuperação encerram as outras sessões.
- LGPD: exportação dos dados e exclusão da conta pelo próprio jogador.

## Integridade dos saves

- O servidor **valida** cada save (estrutura, limites numéricos, heróis conhecidos) usando o próprio código do jogo.
- O **poder do ranking é recalculado no servidor**; o número enviado pelo navegador é ignorado.
- Cada save tem uma **revisão**. Dois dispositivos salvando ao mesmo tempo geram um conflito, e o jogador escolhe qual versão manter, sem sobrescrita silenciosa.
- **Histórico**: até 20 versões anteriores por conta (no máximo 1 a cada 10 min), restauráveis pelo jogador.
- Uma heurística de plausibilidade marca contas suspeitas (tempo de jogo ou poder crescendo rápido demais). Com 3 marcas, a conta sai do ranking.

## Antes de vender: o que ainda falta

- **Anti-trapaça completo**: o combate roda no navegador, e o servidor valida e sinaliza, mas não simula as lutas. Para ranking competitivo com prêmios, o próximo passo é mover a simulação (o `engine.js` já roda no servidor) para ser autoritativa.
- **Pagamentos**: a loja de Gemas está desativada. Para ativar, integre um provedor (Mercado Pago, Stripe, Pagar.me) **no servidor**, com webhooks assinados, e conceda os itens só após a confirmação do pagamento.
- **E-mail** (opcional): verificação de e-mail e recuperação por link exigem um provedor SMTP.
- **Escala**: o SQLite atende bem uma instância (milhares de jogadores). Para várias instâncias, migre `server/db.js` para PostgreSQL.
- **Jurídico**: os modelos em `legal/` precisam de revisão por advogado. Os personagens de franquias exigem licenças para uso comercial.

## Backups manuais

```bash
npm run backup            # cria data/backups/mythverse-<data>.db
```

Para restaurar: pare o servidor, copie o backup para `data/mythverse.db` e inicie de novo.
