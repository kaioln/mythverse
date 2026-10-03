(() => {
  const KT = globalThis.KT;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  // Tela de entrada: Entrar · Criar conta · Recuperar acesso.
  const Auth = {
    el:null, mode:'login', resolve:null, loginSound:null, soundEnabled:true,
    show(mode = 'login', provider = 'server') {
      this.el = document.querySelector('#auth');
      this.soundEnabled = KT.Utils.safeStorage.get('mythverse-sound') !== 'off';
      this.mode = mode; this.provider = provider;
      this.render();
      this.el.hidden = false;
      document.querySelector('#boot')?.classList.add('done');
      return new Promise(resolve => { this.resolve = resolve; });
    },
    // Ao sair da tela de entrada, a tela de carregamento volta até o jogo estar pronto (nunca a interface vazia).
    hide(label = 'Abrindo a Fenda…') { if (this.el) this.el.hidden = true; KT.bootLabel?.(label); },
    sessionKey:'mythverse-tab-login',
    forgetSession() { try { sessionStorage.removeItem(this.sessionKey); } catch (_) {} },
    async requireUser(provider = 'server') {
      // Só um reload da mesma aba pode retomar uma sessão já validada. Nova abertura exige login.
      let previous = null;
      try { if (performance.getEntriesByType('navigation')[0]?.type === 'reload') previous = sessionStorage.getItem(this.sessionKey); } catch (_) {}
      if (previous?.startsWith(provider + ':')) {
        const user = provider === 'neon' ? await KT.Neon.currentUser() : await KT.Net.me();
        if (user && previous === `${provider}:${user.id}`) return user;
      }
      this.forgetSession();
      const user = await this.show('login', provider);
      try { sessionStorage.setItem(this.sessionKey, `${provider}:${user.id}`); } catch (_) {}
      return user;
    },
    // Sem servidor: explica e deixa o jogador escolher entre tentar de novo e jogar offline (sem conta).
    unavailable() {
      this.el = document.querySelector('#auth'); this.el.hidden = false;
      document.querySelector('#boot')?.classList.add('done');
      this.el.innerHTML = `<div class="auth-bg"></div><section class="auth-card" role="alertdialog" aria-labelledby="auth-off-title">
        <div class="auth-brand"><picture><source type="image/webp" srcset="assets/brand/mv-full-440.webp 440w, assets/brand/mv-full-720.webp 720w" sizes="(max-width:600px) 86vw, 440px"><img class="auth-logo" src="assets/brand/mv-full-440.png" srcset="assets/brand/mv-full-440.png 440w, assets/brand/mv-full-720.png 720w" sizes="(max-width:600px) 86vw, 440px" width="440" height="240" alt="Mythverse: Heróis de todos os mundos"></picture></div>
        <h2 id="auth-off-title" class="auth-off-title">Servidor indisponível</h2>
        <p class="auth-note">O servidor do jogo não respondeu. Sem ele não dá para entrar, criar conta nem salvar na nuvem. Tente de novo daqui a pouco.</p>
        <button class="action primary big" type="button" data-off="retry">Tentar de novo</button>
        <p class="auth-alt">Ou <button type="button" class="link" data-off="offline">jogar offline neste navegador</button>. Sem conta, o progresso fica só neste aparelho.</p>
      </section>`;
      return new Promise(resolve => this.el.querySelectorAll('[data-off]').forEach(b => b.addEventListener('click', () => { if (b.dataset.off === 'offline') this.hide(); resolve(b.dataset.off); })));
    },
    render(message = '') {
      const m = this.mode;
      const tab = (id, label) => `<button type="button" class="auth-tab ${m === id ? 'active' : ''}" data-auth-mode="${id}">${label}</button>`;
      const pw = (name, label, auto, hint = '') => `<label class="field"><span>${label}</span><div class="pw-wrap"><input name="${name}" type="password" autocomplete="${auto}" required maxlength="128"><button type="button" class="pw-toggle" data-pw-toggle aria-label="Mostrar senha">ver</button></div>${hint ? `<small>${hint}</small>` : ''}</label>`;
      let form = '';
      const neon = this.provider === 'neon';
      if (m === 'login') form = `<form data-auth-form="login" novalidate>
          <label class="field"><span>${neon ? 'E-mail' : 'Usuário ou e-mail'}</span><input name="login" ${neon ? 'type="email" autocomplete="email"' : 'autocomplete="username"'} required maxlength="254" autofocus></label>
          ${pw('password', 'Senha', 'current-password')}
          <button class="action primary big" type="submit">Entrar</button>
          ${neon ? '' : '<p class="auth-alt">Esqueceu a senha? <button type="button" class="link" data-auth-mode="recover">Recuperar acesso</button></p>'}
        </form>`;
      if (m === 'register') form = `<form data-auth-form="register" novalidate>
          <label class="field"><span>Nome de usuário</span><input name="username" autocomplete="username" required minlength="3" maxlength="20"><small>3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado. Aparece no ranking.</small></label>
          <label class="field"><span>E-mail ${neon ? '' : '<em>(opcional)</em>'}</span><input name="email" type="email" autocomplete="email" maxlength="254" ${neon ? 'required' : ''}><small>${neon ? 'Você entra com o e-mail.' : 'Também serve para entrar.'}</small></label>
          ${pw('password', 'Senha', 'new-password', 'Mínimo de 8 caracteres, com letras e números.')}
          ${pw('confirm', 'Confirmar senha', 'new-password')}
          <label class="check"><input type="checkbox" name="acceptTerms" required> <span>Li e aceito os <a href="legal/termos.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="legal/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
          <button class="action pink big" type="submit">Criar conta e jogar</button>
        </form>`;
      if (m === 'recover') form = `<form data-auth-form="recover" novalidate>
          <p class="auth-note">Use o <b>código de recuperação</b> mostrado quando você criou a conta.</p>
          <label class="field"><span>Nome de usuário</span><input name="username" autocomplete="username" required maxlength="20"></label>
          <label class="field"><span>Código de recuperação</span><input name="recoveryCode" required placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="24" autocomplete="one-time-code" spellcheck="false"></label>
          ${pw('newPassword', 'Nova senha', 'new-password', 'Mínimo de 8 caracteres, com letras e números.')}
          <button class="action primary big" type="submit">Redefinir senha</button>
        </form>`;
      this.el.innerHTML = `<div class="auth-bg"></div>
        <button type="button" class="icon-btn auth-sound ${this.soundEnabled ? 'on' : ''}" data-login-sound aria-pressed="${this.soundEnabled}" aria-label="${this.soundEnabled ? 'Desligar som' : 'Ligar som'}" title="${this.soundEnabled ? 'Desligar som' : 'Ligar som'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="sound-wave" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="sound-off" d="M16 9l5 6M21 9l-5 6"/></svg></button>
        <section class="auth-card" role="dialog" aria-labelledby="auth-title">
        <div class="auth-brand"><picture><source type="image/webp" srcset="assets/brand/mv-full-440.webp 440w, assets/brand/mv-full-720.webp 720w" sizes="(max-width:600px) 86vw, 440px"><img class="auth-logo" src="assets/brand/mv-full-440.png" srcset="assets/brand/mv-full-440.png 440w, assets/brand/mv-full-720.png 720w" sizes="(max-width:600px) 86vw, 440px" width="440" height="240" alt="Mythverse: Heróis de todos os mundos"></picture><h1 id="auth-title" class="sr-only">Mythverse</h1></div>
        <div class="auth-tabs">${tab('login', 'Entrar')}${tab('register', 'Criar conta')}</div>
        <div class="auth-msg ${message ? 'show' : ''}" role="alert">${message}</div>
        ${form}
      </section>`;
      this.bind();
    },
    bind() {
      this.el.querySelectorAll('[data-auth-mode]').forEach(b => b.addEventListener('click', () => { this.mode = b.dataset.authMode; this.render(); }));
      this.el.querySelectorAll('[data-pw-toggle]').forEach(b => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; }));
      this.el.querySelector('[data-login-sound]')?.addEventListener('click', e => {
        this.soundEnabled = !this.soundEnabled;
        KT.Utils.safeStorage.set('mythverse-sound', this.soundEnabled ? 'on' : 'off');
        if (!this.soundEnabled) this.loginSound?.pause();
        const button = e.currentTarget, label = this.soundEnabled ? 'Desligar som' : 'Ligar som';
        button.classList.toggle('on', this.soundEnabled);
        button.setAttribute('aria-pressed', String(this.soundEnabled));
        button.setAttribute('aria-label', label); button.title = label;
      });
      const form = this.el.querySelector('form');
      form?.addEventListener('submit', e => { e.preventDefault(); this.submit(form); });
      setTimeout(() => form?.querySelector('input')?.focus(), 50);
    },
    error(msg) { const el = this.el.querySelector('.auth-msg'); el.textContent = msg; el.classList.add('show'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); },
    async submit(form) {
      if (form.querySelector('button[type=submit]').disabled) return;
      const d = Object.fromEntries(new FormData(form).entries()); d.acceptTerms = !!d.acceptTerms;
      const btn = form.querySelector('button[type=submit]'); const label = btn.textContent;
      const kind = form.dataset.authForm;
      if (kind === 'login' && this.soundEnabled) {
        this.loginSound?.pause();
        this.loginSound = new Audio('assets/audio/sfx/login.mp3' + (KT.VERSION ? '?v=' + KT.VERSION : ''));
        this.loginSound.volume = .35;
        this.loginSound.play().catch(() => {});
      }
      if (kind === 'register') {
        if (!d.username || d.username.length < 3) return this.error('Escolha um nome de usuário com pelo menos 3 caracteres.');
        if ((d.password || '').length < 8) return this.error('A senha precisa ter pelo menos 8 caracteres.');
        if (d.password !== d.confirm) return this.error('As senhas não conferem.');
        if (!d.acceptTerms) return this.error('Aceite os Termos de Uso e a Política de Privacidade.');
        if (this.provider === 'neon' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return this.error('Informe um e-mail válido.');
      }
      if (this.provider === 'neon') {
        btn.disabled = true; btn.classList.add('busy'); btn.textContent = kind === 'login' ? 'Entrando' : 'Criando conta';
        const rn = kind === 'login' ? await KT.Neon.signIn(d) : await KT.Neon.signUp(d);
        btn.disabled = false; btn.classList.remove('busy'); btn.textContent = label;
        if (!rn.ok || !rn.user) return this.error(rn.error || (kind === 'register' ? 'Conta criada: confirme o e-mail e depois entre.' : 'Não foi possível entrar.'));
        this.hide('Carregando seu progresso…'); this.resolve?.(rn.user); return;
      }
      btn.disabled = true; btn.classList.add('busy'); btn.textContent = kind === 'login' ? 'Entrando' : kind === 'register' ? 'Criando conta' : 'Redefinindo';
      const r = kind === 'login' ? await KT.Net.login(d) : kind === 'register' ? await KT.Net.register(d) : await KT.Net.recover(d);
      btn.disabled = false; btn.classList.remove('busy'); btn.textContent = label;
      if (!r.ok) return this.error(r.error || 'Não deu certo. Tente de novo.');
      KT.Net.user = r.user || await KT.Net.me();
      if (r.recoveryCode) await this.showRecovery(r.recoveryCode, kind === 'register');
      this.hide('Carregando seu progresso…'); this.resolve?.(KT.Net.user);
    },
    showRecovery(code, isNew) {
      return new Promise(resolve => {
        this.el.innerHTML = `<div class="auth-bg"></div><section class="auth-card">
          <div class="auth-brand"><img class="auth-logo small" src="assets/brand/emblem.png" alt=""><div class="auth-title"><h1>${isNew ? 'Conta criada' : 'Senha redefinida'}</h1><p>Guarde seu código de recuperação.</p></div></div>
          <p class="auth-note">Este código é a <b>única forma</b> de recuperar a conta se você esquecer a senha. Ele não aparece de novo.</p>
          <div class="recovery-code"><code>${esc(code)}</code><button type="button" class="action small" data-copy>Copiar</button></div>
          <label class="check"><input type="checkbox" data-saved> <span>Guardei meu código em um lugar seguro.</span></label>
          <button class="action primary big" type="button" data-continue disabled>Jogar</button></section>`;
        const btn = this.el.querySelector('[data-continue]');
        this.el.querySelector('[data-saved]').addEventListener('change', e => { btn.disabled = !e.target.checked; });
        this.el.querySelector('[data-copy]').addEventListener('click', async e => { try { await navigator.clipboard.writeText(code); e.target.textContent = 'Copiado'; } catch (_) { e.target.textContent = 'Selecione e copie'; } });
        btn.addEventListener('click', resolve);
      });
    }
  };
  KT.Auth = Auth;
})();
