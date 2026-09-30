// Configuração do cliente.
// server: endereço do servidor do jogo (onde rodam contas, login e saves), ex.: 'https://mythverse.onrender.com'.
// Quando o jogo é aberto num site só de arquivos (GitHub Pages) e o servidor está configurado aqui, o jogador é
// levado para lá; sem servidor, aparece a tela de "servidor indisponível" em vez de entrar sem conta.
// neon: URL do banco Neon SEM usuário/senha (ex.: 'https://ep-xxx.c-7.us-east-2.aws.neon.tech/neondb'). Com ela, o site
// só de arquivos usa contas e saves direto no Neon (Neon Auth + Data API). Veja docs/NEON.md.
(() => {
  const KT = globalThis.KT = globalThis.KT || {};
  // Versão publicada: igual a version.json. O jogo aberto confere a cada 3 min e recarrega sozinho quando muda.
  KT.VERSION = '20260930f';
  KT.CONFIG = { server:'', neon:'https://ep-holy-math-b5qnavg7.c-7.us-east-2.aws.neon.tech/neondb' };
})();
