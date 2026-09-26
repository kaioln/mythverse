# Colocando o Mythverse online

Este guia tem duas partes:

- **[Parte 1 — Online de graça com Neon + Render](#parte-1--online-de-graça-com-neon--render)**: passo a passo, sem precisar programar. Serve para testar com amigos.
- **[Parte 2 — Referência técnica](#parte-2--referência-técnica)**: Docker, VPS, variáveis de ambiente, segurança e o que falta antes de lançar.

---

## Parte 1 — Online de graça com Neon + Render

### Como as peças se encaixam

```
  Jogador (navegador)
        │  https://mythverse-xxxx.onrender.com
        ▼
  ┌────────────────────────┐        DATABASE_URL        ┌──────────────────────────┐
  │ Render (plano Free)    │ ─────────────────────────▶ │ Neon (plano Free)        │
  │ servidor do jogo:      │                            │ banco PostgreSQL:        │
  │ páginas, login, saves, │ ◀───────────────────────── │ contas, sessões, saves,  │
  │ ranking                │                            │ histórico e ranking      │
  └────────────────────────┘                            └──────────────────────────┘
```

- O **Render** liga o servidor do jogo (a pasta `server/`) e entrega o site com HTTPS.
- O **Neon** guarda os dados. Precisamos dele porque o plano grátis do Render **não tem disco permanente**: tudo que o servidor grava no próprio disco some quando ele reinicia. No Neon, as contas e os saves ficam guardados mesmo com o servidor desligado.
- A ligação entre os dois é **uma única variável**, a `DATABASE_URL`: o endereço do banco, com usuário e senha, que você copia do Neon e cola no Render.

### O que você precisa

| Item | Para quê | Custo |
|---|---|---|
| Conta no **GitHub** com o repositório `mythverse` | O Render lê o código de lá | Grátis |
| Conta no **[Neon](https://neon.com)** | Banco de dados | Grátis, sem cartão |
| Conta no **[Render](https://render.com)** | Servidor do jogo | Grátis (o Render às vezes pede um cartão só para verificar a conta; o plano Free não é cobrado) |
| Uns **15 minutos** | | |

### Passo 1 — Conferir o código no GitHub

O Render monta o servidor a partir do GitHub, então o código precisa estar lá.

1. Abra o repositório no GitHub e escolha a **branch** com a versão grátis (hoje é `claude/charming-goldberg-975nzq`; se ela já foi juntada à `main`, use a `main`).
2. Confira que nessa branch existem estes arquivos:
   - `render.yaml`: a receita que diz ao Render como montar o servidor (plano Free, Node 24, comandos de build e início);
   - `package.json` e `package-lock.json`: a lista de dependências (só o `pg`, que conversa com o PostgreSQL);
   - `server/db.js`: o código que usa o Neon quando existe `DATABASE_URL`.

> Se você editar o jogo no computador, envie as mudanças para essa mesma branch (no GitHub Desktop: **Commit** e depois **Push origin**).

### Passo 2 — Criar o banco no Neon

1. Acesse [neon.com](https://neon.com) e clique em **Sign up**. Dá para entrar com a conta do GitHub ou do Google.
2. Crie um projeto (**Create project** ou **New project**):
   - **Project name:** `mythverse`
   - **Postgres version:** deixe a sugerida
   - **Cloud provider:** AWS
   - **Region:** **AWS US East 1 (N. Virginia)**. Isso importa: o servidor do Render fica na Virgínia (`region: virginia` no `render.yaml`), e banco e servidor perto um do outro deixam o jogo mais rápido.
   - Clique em **Create project**.
3. Na página do projeto, clique em **Connect**. Vai abrir a janela **Connect to your branch**:
   - **Branch**, **Compute**, **Database** (`neondb`) e **Role** (`neondb_owner`): deixe como estão.
   - **Connection pooling:** deixe **ligado**. Assim o endereço tem `-pooler` no nome, o que aguenta melhor muitas conexões.
   - Se a senha aparecer escondida (`****`), clique para mostrá-la.
4. Copie **só a connection string**, que se parece com isto:

   ```
   postgresql://neondb_owner:SENHA@ep-nome-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   | Pedaço | O que é |
   |---|---|
   | `neondb_owner` | usuário do banco |
   | `SENHA` | senha do banco (é secreta!) |
   | `ep-…-pooler.us-east-1.aws.neon.tech` | endereço do servidor do Neon |
   | `neondb` | nome do banco |
   | `sslmode=require…` | conexão criptografada (o servidor do jogo sempre verifica o certificado) |

   > ⚠️ O Neon também mostra exemplos para outras ferramentas, como `psql 'postgresql://…'` ou `DATABASE_URL=postgresql://…`. Copie **apenas** a parte que começa em `postgresql://`, sem aspas e sem nada antes.

5. Guarde essa string como se fosse uma senha: ela dá acesso total ao banco. **Nunca** coloque a string num arquivo do repositório nem mande em grupos. (O arquivo `.env` já fica fora do Git pelo `.gitignore`.)

Não precisa criar tabelas: o servidor do jogo cria tudo sozinho na primeira vez que liga.

### Passo 3 — Criar o servidor no Render

1. Acesse [render.com](https://render.com), clique em **Get Started** e escolha **GitHub** para entrar. Autorize o Render a ver o repositório `mythverse` (se ele não aparecer na lista depois, clique em **Configure account** e libere o acesso).
2. No painel, clique em **New +** → **Blueprint**.
3. Na lista de repositórios, clique em **Connect** ao lado de `mythverse`.
4. Preencha:
   - **Blueprint Name:** `mythverse`
   - **Branch:** a branch do Passo 1
   - **Blueprint Path:** deixe `render.yaml`
5. O Render lê o `render.yaml` e mostra o que vai criar: um **Web Service** chamado `mythverse`, plano **Free**. Logo abaixo aparece o campo **`DATABASE_URL`**: cole a connection string do Neon.
6. Clique em **Deploy Blueprint** (em algumas telas o botão se chama **Apply**).
7. Acompanhe na aba **Logs** do serviço. Leva de 3 a 5 minutos. Um deploy que deu certo mostra linhas parecidas com estas:

   ```
   ==> Running build command 'npm ci --omit=dev'...
   added 14 packages ...
   ==> Running 'node server/index.js'
   Mythverse rodando em http://localhost:10000 (dados: PostgreSQL em ep-nome-123456-pooler.us-east-1.aws.neon.tech, produção)
   ==> Your service is live 🎉
   ```

   O `localhost:10000` é o endereço **interno** do Render; o público é o do passo seguinte. O importante é aparecer **PostgreSQL em …neon.tech**.

O que o `render.yaml` configura por você (fica em **Environment**, na página do serviço):

| Variável | Valor | Para quê |
|---|---|---|
| `NODE_VERSION` | `24` | versão do Node.js |
| `NODE_ENV` | `production` | liga o modo de produção (cookie seguro etc.) |
| `TRUST_PROXY` | `1` | o Render fica na frente do servidor; assim os limites de tentativa usam o IP real do jogador |
| `SECURE_COOKIE` | `1` | o login só funciona em HTTPS |
| `DATABASE_URL` | a string do Neon | onde ficam os dados |

### Passo 4 — Testar

1. No topo da página do serviço no Render, copie o link público. Ele se parece com `https://mythverse.onrender.com` ou `https://mythverse-xxxx.onrender.com`.
2. Abra `https://SEU-LINK.onrender.com/api/health`. Deve aparecer algo assim:

   ```json
   {"ok":true,"name":"Mythverse","time":1790397414546,"db":"postgres","users":0,"sessions":0,"saves":0}
   ```

   **`"db":"postgres"` é o que importa.** Se aparecer `"db":"sqlite"`, a `DATABASE_URL` não chegou ao servidor, e os dados **vão sumir** no próximo reinício (veja [Deu problema?](#deu-problema)).
3. Abra o link principal, clique em **Criar conta** e jogue um pouco. **Anote o código de recuperação** que aparece no cadastro.
4. Espere uns 30 segundos (o jogo salva sozinho a cada 30 s) e recarregue a página. O progresso tem que continuar lá.
5. Opcional: no Neon, abra **Tables** no menu do projeto. A tabela `users` terá a sua conta.

Pronto: mande o link para os amigos. 🎉

### Como o plano grátis se comporta

- **O servidor dorme.** Depois de **15 minutos sem nenhum acesso**, o Render desliga o servidor. O próximo acesso acorda o servidor e demora **cerca de 1 minuto** (a página fica carregando). Depois disso volta a ficar rápido. Enquanto alguém está jogando, o save automático mantém o servidor acordado.
- **O banco também dorme.** O Neon suspende o banco depois de **5 minutos parado** e o acorda sozinho na próxima consulta. O servidor do jogo reconecta sem você fazer nada.
- **Limites do Render Free:** 750 horas de servidor por mês na conta (dá para um serviço ligado o mês inteiro), 512 MB de memória e processador pequeno.
- **Limites do Neon Free:** **0,5 GB** de dados por projeto e **100 CU-horas** de processamento por mês (no tamanho mínimo de 0,25 CU, isso dá cerca de 400 horas de banco acordado).
- **Quantos jogadores cabem?** Um save com 6 horas de jogo tem uns 46 KB. Cada conta guarda o save atual e até 20 cópias de segurança, então uma conta muito ativa ocupa perto de 1 MB. Com 0,5 GB cabem **algumas centenas de jogadores**, o que é bastante para testes.
- Os limites e preços mudam de tempos em tempos: confira em [render.com/pricing](https://render.com/pricing) e [neon.com/pricing](https://neon.com/pricing).

### Atualizar o jogo

1. Faça as mudanças e envie para a **mesma branch** (GitHub Desktop: **Commit** → **Push origin**).
2. O Render percebe o envio e faz um novo deploy sozinho em poucos minutos (acompanhe em **Events/Logs**).
3. **As contas e os saves continuam no Neon.** Se uma atualização mudar a estrutura do banco, o servidor aplica a mudança sozinho ao iniciar.

### Trocar a `DATABASE_URL` (ou a senha do banco)

O Render só pede a `DATABASE_URL` na criação do Blueprint. Para trocar depois:

1. Render → serviço **mythverse** → **Environment**.
2. Clique em **Edit**, cole o novo valor em `DATABASE_URL` e salve escolhendo a opção que faz um novo deploy (por exemplo, **Save, rebuild, and deploy**).

Se a string vazou (por exemplo, foi parar num print ou no GitHub), troque a senha no Neon: na página da branch, em **Roles**, use **Reset password** no `neondb_owner`. Depois pegue a nova connection string em **Connect** e atualize o Render como acima.

### Backups

- **Neon:** o plano Free permite restaurar o banco para qualquer momento das **últimas 6 horas** (menu **Backup & Restore** do projeto). Para algo mais antigo, faça cópias manuais.
- **Cópia manual (opcional):** com o [PostgreSQL](https://www.postgresql.org/download/) instalado no computador, rode `pg_dump` usando a connection string **sem pooling** (desligue **Connection pooling** na janela **Connect**):

  ```bash
  pg_dump "postgresql://neondb_owner:SENHA@ep-nome-123456.us-east-1.aws.neon.tech/neondb?sslmode=require" > mythverse-backup.sql
  ```

  Para restaurar num banco vazio: `psql "CONNECTION_STRING" < mythverse-backup.sql`. O `pg_dump` precisa ser da mesma versão do Postgres do Neon ou mais nova.
- **Jogadores:** cada conta guarda 20 cópias do próprio save (restauráveis em **Perfil → Conta**) e pode exportar os próprios dados.

### Jogar com o Neon no próprio computador (opcional)

1. Instale o [Node.js 24](https://nodejs.org).
2. Na pasta do jogo, crie um arquivo `.env` com a linha `DATABASE_URL=postgresql://…` (a mesma string do Neon).
3. Rode `npm install` (uma vez) e depois `npm start`. Abra http://localhost:8080.

Assim o computador usa o **mesmo banco** do site: as contas criadas lá funcionam aqui. Sem o `.env`, o `npm start` volta a usar o SQLite local (pasta `data/`).

### Deu problema?

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| Deploy falha no build com erro do `npm ci` (ex.: falta `package-lock.json`) | Branch errada ou arquivos não enviados | Confira o Passo 1 e a **Branch** do Blueprint |
| Render diz que não encontrou o `render.yaml` | Branch errada ou **Blueprint Path** alterado | Use a branch do Passo 1 e o caminho `render.yaml` |
| Log: `DATABASE_URL inválida: copie a "connection string" completa do Neon` | Colou algo que não é a string (ex.: `psql '…'`, `DATABASE_URL=…`, aspas ou só um pedaço) | Copie de novo só o `postgresql://…` e atualize em **Environment** |
| Log: `Não foi possível abrir o banco (…): password authentication failed` | Senha errada ou string antiga | Pegue a string de novo em **Connect** no Neon (se trocou a senha, use a nova) |
| Log: `Não foi possível abrir o banco (…): getaddrinfo ENOTFOUND …` | Endereço digitado errado | Copie a string inteira de novo, sem editar |
| Log: `Não foi possível abrir o banco (…)` com `timeout` | Neon fora do ar ou projeto suspenso por limite do plano | Veja o painel do Neon (avisos de limite ou de uso) |
| `/api/health` mostra `"db":"sqlite"` | `DATABASE_URL` vazia no Render | Preencha em **Environment** e faça novo deploy. **Até lá, os dados não ficam salvos** |
| O site demora cerca de 1 minuto para abrir | O servidor estava dormindo | Normal no plano Free |
| O site abre, mas o login não funciona | Endereço aberto com `http://` | Use sempre `https://` |
| Aviso do Neon sobre limite de uso (compute ou armazenamento) | Muito uso no mês ou banco cheio | Espere o mês virar, apague contas de teste ou mude para um plano pago |

Nos logs do Render, a primeira linha com `Error` ou `Não foi possível` costuma dizer exatamente o que houve.

### Quando sair do teste

- **Para o servidor não dormir:** no Render, serviço → **Settings** → **Instance Type** → um plano pago (ex.: Starter). O Neon continua sendo o banco, sem mudar nada.
- **Para ter mais espaço e histórico de backup:** mude o Neon para um plano pago.
- **Alternativa sem Neon:** o `render.starter.yaml` usa o plano pago do Render com um disco e o SQLite (veja a [Opção 1](#opção-1--render-pago-com-disco) abaixo). Atenção: os dados do Neon **não** passam sozinhos para o SQLite.
- Antes de lançar de verdade, leia [Antes de vender: o que ainda falta](#antes-de-vender-o-que-ainda-falta).

---

## Parte 2 — Referência técnica

O servidor é **Node.js puro**: serve o jogo, cuida das contas, sessões, saves na nuvem e ranking. O banco padrão é o **SQLite embutido do Node** (sem `npm install`), em modo WAL, com verificação de integridade na inicialização e backups automáticos. Com a variável `DATABASE_URL`, o servidor usa **PostgreSQL** (ex.: Neon) pelo pacote `pg` (`npm install`), e aí não precisa de disco.

### Requisitos

- Node.js **22.13+** (recomendado **24 LTS**)
- Um **disco persistente** para a pasta `DATA_DIR` (banco + backups) **ou** um PostgreSQL em `DATABASE_URL`
- **HTTPS** na frente (Render, Fly, Railway e Cloudflare já entregam; em VPS use Caddy ou Nginx)

### Rodar localmente

```bash
npm start
```

Depois abra http://localhost:8080. No Windows, `START_GAME.bat` faz isso sozinho. Em ambiente de desenvolvimento o cookie de sessão não exige HTTPS.

Testes:

```bash
npm test
```

### Opção 1 — Render pago com disco

1. Suba esta pasta para um repositório no GitHub.
2. No Render: **New → Blueprint**, selecione o repositório e troque o caminho do Blueprint para `render.starter.yaml`. Ele cria o serviço Docker (plano Starter) com um disco de 1 GB em `/data`.
3. Aponte seu domínio nas configurações do serviço. O HTTPS é automático.

### Opção 2 — Docker em qualquer servidor (VPS)

```bash
docker compose up -d --build
```

O `docker-compose.yml` já usa um volume `mythverse-data` para o banco. Coloque um proxy HTTPS na frente. Exemplo com Caddy (`Caddyfile`):

```
seujogo.com.br {
  reverse_proxy localhost:8080
}
```

### Opção 3 — Fly.io / Railway

Use o `Dockerfile`. Crie um volume persistente montado em `/data` e defina as variáveis abaixo. Rode **uma única instância**, porque o SQLite fica num disco local.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 8080 | Porta HTTP |
| `DATA_DIR` | `./data` | Banco `mythverse.db` e pasta `backups/` (disco persistente!) |
| `DATABASE_URL` | — | PostgreSQL (ex.: Neon). Quando definida, substitui o SQLite e os backups locais |
| `NODE_ENV` | — | `production` ativa o cookie `Secure` e faz um backup ao iniciar |
| `TRUST_PROXY` | — | `1` atrás de proxy/CDN (usa `X-Forwarded-For` para os limites por IP) |
| `SECURE_COOKIE` | igual a produção | `1` exige HTTPS para o cookie de sessão |
| `SESSION_DAYS` | 30 | Validade da sessão |
| `BACKUP_HOURS` | 6 | Intervalo dos backups do SQLite (`VACUUM INTO`, mantém os 14 mais recentes) |
| `PUBLIC_ORIGIN` | — | Origem pública, se o proxy mudar o cabeçalho Host |

### Segurança implementada

- Senhas com **scrypt** (salt por usuário) e comparação em tempo constante, inclusive quando o usuário não existe.
- Sessões com token aleatório de 256 bits. O banco guarda **só o hash** do token, e o cookie é `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- **CSRF**: toda alteração exige o cabeçalho `X-MV-Request` e a mesma origem.
- **Limites de tentativa**: login (8 por usuário e 20 por IP a cada 15 min), cadastro, recuperação, saves e API geral.
- Cabeçalhos de segurança: CSP restritiva, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- Recuperação de conta por **código de recuperação**, mostrado uma única vez no cadastro (funciona sem servidor de e-mail).
- Troca de senha e recuperação encerram as outras sessões.
- LGPD: exportação dos dados e exclusão da conta pelo próprio jogador.

### Integridade dos saves

- O servidor **valida** cada save (estrutura, limites numéricos, heróis conhecidos) usando o próprio código do jogo.
- O **poder do ranking é recalculado no servidor**; o número enviado pelo navegador é ignorado.
- Cada save tem uma **revisão**. Dois dispositivos salvando ao mesmo tempo geram um conflito, e o jogador escolhe qual versão manter, sem sobrescrita silenciosa.
- **Histórico**: até 20 versões anteriores por conta (no máximo 1 a cada 10 min), restauráveis pelo jogador.
- Uma heurística de plausibilidade marca contas suspeitas (tempo de jogo ou poder crescendo rápido demais). Com 3 marcas, a conta sai do ranking.

### Antes de vender: o que ainda falta

- **Anti-trapaça completo**: o combate roda no navegador, e o servidor valida e sinaliza, mas não simula as lutas. Para ranking competitivo com prêmios, o próximo passo é mover a simulação (o `engine.js` já roda no servidor) para ser autoritativa.
- **Pagamentos**: a loja de Gemas está desativada. Para ativar, integre um provedor (Mercado Pago, Stripe, Pagar.me) **no servidor**, com webhooks assinados, e conceda os itens só após a confirmação do pagamento.
- **E-mail** (opcional): verificação de e-mail e recuperação por link exigem um provedor SMTP.
- **Escala**: o SQLite atende bem uma instância (milhares de jogadores). Para várias instâncias, use `DATABASE_URL` (PostgreSQL). Os limites de tentativa ainda ficam na memória de cada instância.
- **Jurídico**: os modelos em `legal/` precisam de revisão por advogado. Os personagens de franquias exigem licenças para uso comercial.

### Backups manuais

```bash
npm run backup            # cria data/backups/mythverse-<data>.db
```

Para restaurar: pare o servidor, copie o backup para `data/mythverse.db` e inicie de novo. No PostgreSQL, use as ferramentas do provedor (no Neon: **Backup & Restore**) ou `pg_dump`.
