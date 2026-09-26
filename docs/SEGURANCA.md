# Segurança do Mythverse

## A regra principal: o servidor decide tudo

Um jogo que roda no navegador **sempre** entrega o código do cliente ao jogador: qualquer pessoa pode abrir o "Inspecionar", ler os arquivos `.js`, pausar a execução e mudar variáveis. Isso vale para qualquer site, e nenhuma ofuscação impede. Minificar ou embaralhar o código só atrasa a leitura; não protege nada.

Por isso a proteção do Mythverse não depende de esconder o cliente. Ela vem de o **cliente não ter poder nenhum**:

- O save mora no servidor. O navegador recebe uma cópia só para desenhar a tela.
- O navegador envia apenas **comandos**: começar uma luta, usar ultimate/poção/elixir, focar um alvo, escolher uma rota, e ações de menu (equipar, refinar, comprar…).
- Cada luta tem uma **semente sorteada pelo servidor**. No fim, o servidor **refaz a luta inteira** com a mesma semente, os mesmos comandos e o mesmo código do jogo (em sandbox). Só o resultado do servidor vale: ouro, EXP, itens, cartas e materiais.
- Ações de menu passam por uma **lista fechada de operações**, cada uma com validação de argumentos, executadas no estado do servidor com sorteio do servidor (refino, convocação, loja, baús, loot).

Mudar números no console, editar o `localStorage`, reenviar requisições ou usar um "trainer" não altera o save: na próxima sincronização o servidor devolve o estado verdadeiro.

## Camadas

### Jogo
- **Lutas refeitas no servidor** com semente própria; a mesma luta não paga duas vezes (`stale`).
- **Anti-aceleração**: uma luta não pode terminar mais rápido que o tempo real × velocidade máxima (3×). Se terminar, é anulada (`too_fast`).
- **Uma luta aberta por conta**.
- **Tempo do servidor** para AFK, eventos, Invasão Mundial, limites diários e expedições. Mudar o relógio do computador não faz nada.
- **Invasão Mundial**: 1 tentativa por dia verificada no servidor; o dano vem da luta refeita, não do cliente.
- **Validação do save** com o mesmo código do jogo: itens impossíveis para o progresso (nível acima do alcançável, raridade acima do teto da região) são sinalizados.
- **Contas suspeitas** saem do ranking e ficam impedidas de negociar até revisão.

### Mercado e dinheiro
- Itens anunciados ficam sob **custódia do servidor**. O item sai do save ao anunciar e só volta pelo Correio.
- **Proveniência**: o servidor registra quando viu cada item; só itens com origem conhecida e idade mínima podem ser vendidos.
- Tudo o que envolve Gemas acontece em **transação no banco**, com bloqueio de linha e **livro-caixa** (`wallet_ledger`). O saldo nunca fica negativo (restrição no banco).
- **Webhook de pagamento** com assinatura HMAC verificada em tempo constante, janela de tempo e **nova consulta à API do provedor** antes de creditar. Crédito idempotente.
- **Saques** exigem a senha e passam por revisão manual no painel `/admin/`.
- Vendas em Gemas ficam **retidas** (padrão 72 h) antes do saque; compras entre contas da **mesma rede** (IP público) são bloqueadas; preços fora da curva e pares que negociam demais geram **alertas** no painel.
- **Itens vinculados** (vindos de NPCs) não podem ser vendidos a outros jogadores.
- Em produção, o servidor **desliga o dinheiro real** sozinho se faltar configuração segura (provedor de pagamento real, `PUBLIC_ORIGIN` https, cookie seguro, `ADMIN_TOKEN` forte) e explica no log.

### Conta e site
- Senhas com **scrypt** e sal; código de recuperação também com hash.
- **Limites de tentativa** em login, cadastro, recuperação e consultas públicas.
- Sessões por **cookie HttpOnly, SameSite** (e `Secure` em produção); encerrar outras sessões.
- **CSRF**: toda requisição que muda algo exige cabeçalho próprio e a mesma origem.
- **Cabeçalhos**: CSP restrita (`script-src 'self'`, sem scripts externos, sem `eval`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS em produção.
- Só os arquivos do jogo são públicos. Código do servidor, `.env`, banco, backups, testes e ferramentas não são servidos (testado inclusive com tentativas de `../`).
- Nenhum segredo no cliente: tokens do provedor de pagamento e de administração ficam só em variáveis de ambiente do servidor.

## O que continua possível (e por que não importa)

- **Ler o código do cliente e ver a lógica do jogo**: é público por natureza. Saber a fórmula de dano não dá vantagem, porque o servidor refaz a luta.
- **Automatizar cliques** (bots de interface): o jogo já tem AUTO. Os limites de velocidade, a tentativa diária da Invasão e os limites diários impedem ganho acima de um jogador normal. O AUTO rende menos que jogar no manual.
- **Ataques de força bruta ou negação de serviço**: os limites de tentativa ajudam, mas para um servidor público use também um proxy/CDN com proteção (por exemplo, Cloudflare) na frente do Render.

## Checklist de produção

1. `NODE_ENV=production`, `SECURE_COOKIE=1`, `TRUST_PROXY=1` atrás do proxy, `PUBLIC_ORIGIN` com o domínio real.
2. `ADMIN_TOKEN` longo e aleatório; nunca no repositório.
3. `PAYMENT_PROVIDER=mercadopago` com `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`. O provedor `dev` é recusado em produção.
4. Banco Postgres gerenciado com backup, ou disco persistente para o SQLite.
5. HTTPS obrigatório (o Render já fornece) e, se possível, CDN com proteção contra DDoS.
6. Rodar `npm test` antes de cada publicação.
