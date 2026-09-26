# Colocando o Mythverse online

O servidor é **Node.js** e serve o jogo, as contas, o estado autoritativo (lutas refeitas no servidor), o ranking, a Invasão Mundial, o Mercado de Jogadores e o painel `/admin/`. O banco padrão é o **SQLite embutido do Node** (modo WAL, verificação de integridade e backups automáticos). Para mais de uma instância, use **PostgreSQL** com `DATABASE_URL`.

## Requisitos

- Node.js **22.13+** (recomendado **24 LTS**) e `npm ci` (dependência única: `pg`, usada só com PostgreSQL)
- Um **disco persistente** para `DATA_DIR` (banco + backups) ou um PostgreSQL gerenciado
- **HTTPS** na frente (Render, Fly, Railway e Cloudflare já entregam; em VPS use Caddy ou Nginx)

## Rodar localmente

```bash
npm ci
```

```bash
npm start
```

Abra http://localhost:8080. No Windows, `START_GAME.bat` faz isso sozinho. Testes (jogo, determinismo cliente = servidor e servidor em SQLite e Postgres):

```bash
npm test
```

## Opção 1: Render (mais simples)

1. Suba esta pasta para um repositório no GitHub.
2. No Render: **New → Blueprint** e selecione o repositório. O `render.yaml` cria o serviço Docker com disco de 1 GB em `/data`, gera o `ADMIN_TOKEN` e deixa o dinheiro real **desligado**.
3. Em **Environment**, preencha `PUBLIC_ORIGIN` com o endereço `https://` do serviço (ou do seu domínio).
4. Aponte seu domínio. O HTTPS é automático.
5. Abra `https://seu-endereço/admin/` e entre com o `ADMIN_TOKEN` (em Environment → Reveal).

## Banco no Neon (PostgreSQL gerenciado)

1. No Neon, copie a **connection string** do banco (a com `-pooler` no host funciona bem). Troque `sslmode=require` por `sslmode=verify-full`, que é a verificação de certificado mais forte.
2. Defina `DATABASE_URL` com ela: no `.env` para rodar local (`npm start`) ou em **Environment** no Render.
3. Não é preciso rodar SQL à mão: na primeira inicialização o servidor cria o schema `mythverse` com todas as tabelas e aplica as migrações novas sozinho a cada versão.
4. Com o Neon, o disco `/data` do Render deixa de ser necessário para o banco (continua útil só para backups do SQLite, que não são usados nesse modo). Os backups ficam por conta do Neon (histórico/branches).

## Opção 2: Docker em qualquer servidor (VPS)

```bash
docker compose up -d --build
```

O `docker-compose.yml` usa o volume `mythverse-data` para o banco. Coloque um proxy HTTPS na frente. Exemplo com Caddy (`Caddyfile`):

```
seujogo.com.br {
  reverse_proxy localhost:8080
}
```

## Opção 3: Fly.io / Railway

Use o `Dockerfile`. Com SQLite, monte um volume em `/data` e rode **uma única instância**. Com `DATABASE_URL` (PostgreSQL), pode escalar horizontalmente.

## Variáveis de ambiente

A lista completa, com comentários, está em `.env.example`. As principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 8080 | Porta HTTP |
| `DATA_DIR` | `./data` | Banco `mythverse.db` e `backups/` (disco persistente!) |
| `DATABASE_URL` | vazio | PostgreSQL (se definido, substitui o SQLite) |
| `NODE_ENV` | vazio | `production` ativa HSTS, cookie `Secure`, backup ao iniciar e a verificação de produção |
| `TRUST_PROXY` | vazio | `1` atrás de proxy/CDN (limites por IP e antifraude usam `X-Forwarded-For`) |
| `SECURE_COOKIE` | igual a produção | `1` exige HTTPS para o cookie de sessão |
| `PUBLIC_ORIGIN` | vazio | Endereço `https://` público (obrigatório para dinheiro real e webhook do Pix) |
| `ADMIN_TOKEN` | vazio | Acesso ao painel `/admin/` (32+ caracteres; mais curto desliga o painel) |
| `RMT_ENABLED` | 0 | Liga Gemas, depósitos, saques e o mercado em Gemas |
| `PAYMENT_PROVIDER` | vazio | `mercadopago` em produção (`dev` é recusado em produção) |
| `GOLD_MARKET_ENABLED` | 1 | Mercado de Jogadores em ouro (sem dinheiro real) |

**Verificação de produção:** com `NODE_ENV=production`, se `RMT_ENABLED=1` estiver sem Mercado Pago configurado, sem `PUBLIC_ORIGIN` https, sem cookie seguro ou sem `ADMIN_TOKEN`, o servidor **desliga só o dinheiro real** (o jogo continua no ar) e explica no log o que falta.

## Ligando o dinheiro real (Gemas)

1. Crie a aplicação no Mercado Pago e copie o **Access Token** de produção e o **segredo do webhook**.
2. Configure o webhook para `https://seu-endereço/api/payments/webhook` (eventos de pagamento).
3. Defina `RMT_ENABLED=1`, `PAYMENT_PROVIDER=mercadopago`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_ORIGIN`.
4. Reinicie e confira no log que não há aviso `[produção]`.
5. Faça um depósito real pequeno, uma venda entre duas contas e um saque de teste pelo `/admin/`.

## Segurança implementada

Detalhes em `docs/SEGURANCA.md`. Resumo:

- **Servidor autoritativo**: o save mora no servidor; cada luta é refeita no servidor com a mesma semente; loot, refino, convocação e loja são sorteados no servidor; lutas rápidas demais são anuladas.
- Senhas com **scrypt**; sessões com token de 256 bits (o banco guarda só o hash), cookie `HttpOnly` + `SameSite=Lax` (+ `Secure`).
- **CSRF** (cabeçalho próprio + mesma origem), **limites de tentativa**, CSP restritiva, HSTS, `X-Frame-Options`, `nosniff`.
- Só os arquivos do jogo são públicos; código do servidor, `.env`, banco, testes e ferramentas não são servidos.
- Mercado com custódia no servidor, transações no banco, livro-caixa, retenção de vendas antes do saque, bloqueio de compra na mesma rede e alertas no painel.

## Antes de lançar: checklist

- [ ] **Arte dos heróis**: nomes, mundos e kits já são originais, mas os retratos e sprites ainda lembram personagens de outras obras. Substitua seguindo `docs/ARTE_ORIGINAL.md` **antes de ligar o dinheiro real**.
- [ ] **Jurídico**: revise `legal/termos.html` e `legal/privacidade.html` com um advogado e preencha empresa, CNPJ, e-mails de suporte e jurídico e foro.
- [ ] **Dinheiro real**: confirme com contador e advogado as obrigações de um marketplace com custódia de valores (tributos, KYC para saques, prevenção à lavagem de dinheiro).
- [ ] `PUBLIC_ORIGIN`, `ADMIN_TOKEN`, backups do disco ou do PostgreSQL e monitoramento do `/api/health`.
- [ ] Proteção contra DDoS (Cloudflare na frente do Render é o mais simples).
- [ ] `npm test` verde no commit que vai para produção.

## Backups manuais (SQLite)

```bash
npm run backup
```

Cria `data/backups/mythverse-<data>.db`. Para restaurar: pare o servidor, copie o backup para `data/mythverse.db` e inicie de novo.
