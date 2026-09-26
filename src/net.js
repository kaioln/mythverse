(() => {
'use strict';

const KT = globalThis.KT;

const DATABASE_URL =
  'postgresql://neondb_owner:npg_9Mset6ZVlNRQ@ep-holy-math-b5qnavg7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const SESSION_KEY = 'mv_neon_session';

let SQL = null;

// ---------------------------------------------------------------------------
// Neon
// ---------------------------------------------------------------------------

async function getDb() {
  if (SQL) return SQL;

  const { neon } = await import(
    'https://esm.sh/@neondatabase/serverless@1'
  );

  SQL = neon(DATABASE_URL);
  return SQL;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function success(data = {}, status = 200) {
  return {
    ok: true,
    status,
    error: null,
    ...data
  };
}

function failure(status, error, extra = {}) {
  return {
    ok: false,
    status,
    error,
    ...extra
  };
}

function currentUserId() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return 0;

    const data = JSON.parse(raw);
    return Number(data.id) || 0;
  } catch (_) {
    return 0;
  }
}

function saveSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: Number(user.id),
      username: user.username
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function publicUser(user) {
  return {
    id: Number(user.id),
    username: user.username,

    email: user.email
      ? String(user.email).replace(
          /^(.).*(@.*)$/,
          '$1***$2'
        )
      : null,

    createdAt: Number(user.created_at)
  };
}

function bytesToBase64(bytes) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);

  return Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

async function hashSecret(secret) {
  const salt = crypto.getRandomValues(
    new Uint8Array(16)
  );

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const iterations = 210000;

  const result = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations
    },
    key,
    256
  );

  return [
    'pbkdf2',
    'sha256',
    iterations,
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(result))
  ].join('$');
}

async function verifySecret(secret, stored) {
  try {
    const parts = String(stored || '').split('$');

    if (
      parts.length !== 5 ||
      parts[0] !== 'pbkdf2' ||
      parts[1] !== 'sha256'
    ) {
      return false;
    }

    const iterations = Number(parts[2]);
    const salt = base64ToBytes(parts[3]);
    const expected = parts[4];

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(secret)),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const result = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations
      },
      key,
      256
    );

    return (
      bytesToBase64(new Uint8Array(result)) ===
      expected
    );
  } catch (_) {
    return false;
  }
}

function passwordProblem(password, username = '') {
  const value = String(password || '');

  if (value.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }

  if (value.length > 128) {
    return 'A senha é longa demais.';
  }

  if (
    username &&
    value.toLowerCase() ===
      String(username).toLowerCase()
  ) {
    return 'A senha não pode ser igual ao nome de usuário.';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

function createRecoveryCode() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const bytes = crypto.getRandomValues(
    new Uint8Array(20)
  );

  let result = '';

  for (let i = 0; i < 20; i++) {
    if (i && i % 4 === 0) {
      result += '-';
    }

    result +=
      alphabet[bytes[i] % alphabet.length];
  }

  return result;
}

function normalizeRecoveryCode(value) {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return clean.replace(
    /(.{4})(?=.)/g,
    '$1-'
  );
}

// ---------------------------------------------------------------------------
// Save summary
// ---------------------------------------------------------------------------

function numberValue(...values) {
  for (const value of values) {
    const n = Number(value);

    if (Number.isFinite(n)) {
      return n;
    }
  }

  return 0;
}

function extractSummary(save) {
  const playSeconds = Math.max(
    0,
    numberValue(
      save?.totalPlaySeconds,
      save?.playSeconds,
      save?.stats?.playSeconds,
      save?.account?.playSeconds
    )
  );

  const power = Math.max(
    0,
    Math.floor(
      numberValue(
        save?.power,
        save?.totalPower,
        save?.stats?.power,
        save?.account?.power
      )
    )
  );

  const bossKills = Math.max(
    0,
    Math.floor(
      numberValue(
        save?.bossKills,
        save?.boss_kills,
        save?.stats?.bossKills,
        save?.progress?.bossKills
      )
    )
  );

  const bestStage = Math.max(
    0,
    Math.floor(
      numberValue(
        save?.bestStage,
        save?.best_stage,
        save?.progress?.bestStage,
        save?.stage
      )
    )
  );

  const accountLevel = Math.max(
    1,
    Math.floor(
      numberValue(
        save?.accountLevel,
        save?.account?.level,
        save?.level,
        1
      )
    )
  );

  const name = String(
    save?.displayName ??
    save?.playerName ??
    save?.name ??
    save?.account?.name ??
    ''
  ).slice(0, 50);

  return {
    playSeconds,
    power,
    bossKills,
    bestStage,
    accountLevel,
    name
  };
}

// ---------------------------------------------------------------------------
// Cliente Neon
// ---------------------------------------------------------------------------

const Net = {
  online: false,
  user: null,

  async detect() {
    try {
      const sql = await getDb();

      await sql`
        SELECT 1 AS connected
      `;

      this.online = true;
    } catch (error) {
      console.error('[Neon]', error);
      this.online = false;
    }

    return this.online;
  },

  async me() {
    const id = currentUserId();

    if (!id) {
      this.user = null;
      return null;
    }

    try {
      const sql = await getDb();

      const rows = await sql`
        SELECT
          id,
          username,
          email,
          created_at,
          banned
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;

      const user = rows[0];

      if (!user || Number(user.banned)) {
        clearSession();
        this.user = null;
        return null;
      }

      this.user = publicUser(user);

      return this.user;

    } catch (error) {
      console.error('[Neon/me]', error);
      return null;
    }
  },

  async register(data) {
    try {
      const sql = await getDb();

      const username = String(
        data.username || ''
      )
        .normalize('NFKC')
        .trim();

      const email = String(
        data.email || ''
      )
        .normalize('NFKC')
        .trim()
        .toLowerCase();

      if (
        !/^[A-Za-z0-9._-]{3,20}$/.test(
          username
        )
      ) {
        return failure(
          400,
          'Nome de usuário: 3 a 20 letras, números, ponto, hífen ou sublinhado.'
        );
      }

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return failure(
          400,
          'E-mail inválido.'
        );
      }

      const passwordError =
        passwordProblem(
          data.password,
          username
        );

      if (passwordError) {
        return failure(
          400,
          passwordError
        );
      }

      if (
        data.password !== data.confirm
      ) {
        return failure(
          400,
          'As senhas não conferem.'
        );
      }

      if (!data.acceptTerms) {
        return failure(
          400,
          'É preciso aceitar os Termos de Uso e a Política de Privacidade.'
        );
      }

      const duplicate = await sql`
        SELECT id
        FROM users
        WHERE
          LOWER(username) =
            LOWER(${username})
          OR (
            ${email || null}::text
              IS NOT NULL
            AND LOWER(email) =
              LOWER(${email || null})
          )
        LIMIT 1
      `;

      if (duplicate.length) {
        return failure(
          409,
          'Usuário ou e-mail já cadastrado.'
        );
      }

      const recovery =
        createRecoveryCode();

      const passHash =
        await hashSecret(
          data.password
        );

      const recoveryHash =
        await hashSecret(
          recovery
        );

      const now = Date.now();

      const rows = await sql`
        INSERT INTO users (
          username,
          email,
          pass_hash,
          recovery_hash,
          created_at,
          last_login
        )
        VALUES (
          ${username},
          ${email || null},
          ${passHash},
          ${recoveryHash},
          ${now},
          ${now}
        )
        RETURNING
          id,
          username,
          email,
          created_at
      `;

      const user =
        publicUser(rows[0]);

      saveSession(user);

      this.user = user;
      this.online = true;

      return success(
        {
          user,
          recoveryCode:
            recovery
        },
        201
      );

    } catch (error) {
      console.error(
        '[Neon/register]',
        error
      );

      if (
        String(error).includes(
          'unique'
        )
      ) {
        return failure(
          409,
          'Usuário ou e-mail já cadastrado.'
        );
      }

      return failure(
        500,
        'Erro ao criar conta.'
      );
    }
  },

  async login(data) {
    try {
      const sql = await getDb();

      const login = String(
        data.login || ''
      )
        .normalize('NFKC')
        .trim();

      const rows = await sql`
        SELECT *
        FROM users
        WHERE
          LOWER(username) =
            LOWER(${login})
          OR LOWER(email) =
            LOWER(${login})
        LIMIT 1
      `;

      const user = rows[0];

      if (
        !user ||
        !(await verifySecret(
          data.password,
          user.pass_hash
        ))
      ) {
        return failure(
          401,
          'Usuário ou senha incorretos.'
        );
      }

      if (Number(user.banned)) {
        return failure(
          403,
          'Conta suspensa. Entre em contato com o suporte.'
        );
      }

      await sql`
        UPDATE users
        SET last_login =
          ${Date.now()}
        WHERE id = ${user.id}
      `;

      const publicData =
        publicUser(user);

      saveSession(publicData);

      this.user =
        publicData;

      this.online = true;

      return success({
        user: publicData
      });

    } catch (error) {
      console.error(
        '[Neon/login]',
        error
      );

      return failure(
        500,
        'Erro ao entrar.'
      );
    }
  },

  async logout() {
    clearSession();

    this.user = null;

    return success();
  },

  async logoutAll() {
    return this.logout();
  },

  async recover(data) {
    try {
      const sql = await getDb();

      const username = String(
        data.username || ''
      )
        .normalize('NFKC')
        .trim();

      const rows = await sql`
        SELECT *
        FROM users
        WHERE
          LOWER(username) =
          LOWER(${username})
        LIMIT 1
      `;

      const user = rows[0];

      const recovery =
        normalizeRecoveryCode(
          data.recoveryCode
        );

      if (
        !user ||
        !(await verifySecret(
          recovery,
          user.recovery_hash
        ))
      ) {
        return failure(
          401,
          'Usuário ou código de recuperação incorretos.'
        );
      }

      const problem =
        passwordProblem(
          data.newPassword,
          user.username
        );

      if (problem) {
        return failure(
          400,
          problem
        );
      }

      const newRecovery =
        createRecoveryCode();

      const passHash =
        await hashSecret(
          data.newPassword
        );

      const recoveryHash =
        await hashSecret(
          newRecovery
        );

      await sql`
        UPDATE users
        SET
          pass_hash =
            ${passHash},
          recovery_hash =
            ${recoveryHash}
        WHERE id = ${user.id}
      `;

      const publicData =
        publicUser(user);

      saveSession(publicData);

      this.user =
        publicData;

      return success({
        recoveryCode:
          newRecovery
      });

    } catch (error) {
      console.error(
        '[Neon/recover]',
        error
      );

      return failure(
        500,
        'Erro ao recuperar conta.'
      );
    }
  },

  async changePassword(data) {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const rows = await sql`
        SELECT *
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;

      const user =
        rows[0];

      if (
        !user ||
        !(await verifySecret(
          data.current,
          user.pass_hash
        ))
      ) {
        return failure(
          401,
          'Senha atual incorreta.'
        );
      }

      const problem =
        passwordProblem(
          data.next,
          user.username
        );

      if (problem) {
        return failure(
          400,
          problem
        );
      }

      const passHash =
        await hashSecret(
          data.next
        );

      await sql`
        UPDATE users
        SET pass_hash =
          ${passHash}
        WHERE id = ${id}
      `;

      return success();

    } catch (error) {
      console.error(
        '[Neon/password]',
        error
      );

      return failure(
        500,
        'Erro ao alterar senha.'
      );
    }
  },

  async newRecovery(password) {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const rows = await sql`
        SELECT *
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;

      const user =
        rows[0];

      if (
        !user ||
        !(await verifySecret(
          password,
          user.pass_hash
        ))
      ) {
        return failure(
          401,
          'Senha incorreta.'
        );
      }

      const recovery =
        createRecoveryCode();

      const hash =
        await hashSecret(
          recovery
        );

      await sql`
        UPDATE users
        SET recovery_hash =
          ${hash}
        WHERE id = ${id}
      `;

      return success({
        recoveryCode:
          recovery
      });

    } catch (error) {
      console.error(
        '[Neon/recovery]',
        error
      );

      return failure(
        500,
        'Erro ao gerar código.'
      );
    }
  },

  async deleteAccount(data) {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const rows = await sql`
        SELECT *
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `;

      const user =
        rows[0];

      if (
        !user ||
        !(await verifySecret(
          data.password,
          user.pass_hash
        ))
      ) {
        return failure(
          401,
          'Senha incorreta.'
        );
      }

      if (
        data.confirm !==
        user.username
      ) {
        return failure(
          400,
          'Digite o nome de usuário para confirmar.'
        );
      }

      await sql`
        DELETE FROM users
        WHERE id = ${id}
      `;

      clearSession();

      this.user = null;

      return success();

    } catch (error) {
      console.error(
        '[Neon/delete]',
        error
      );

      return failure(
        500,
        'Erro ao excluir conta.'
      );
    }
  },

  async getSave() {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const rows = await sql`
        SELECT *
        FROM saves
        WHERE user_id = ${id}
        LIMIT 1
      `;

      if (!rows.length) {
        return success({
          save: null,
          revision: 0
        });
      }

      const row = rows[0];

      return success({
        save:
          JSON.parse(row.data),

        revision:
          Number(row.revision),

        updatedAt:
          Number(row.updated_at)
      });

    } catch (error) {
      console.error(
        '[Neon/getSave]',
        error
      );

      return failure(
        500,
        'Erro ao carregar save.'
      );
    }
  },

  async putSave(
    save,
    revision,
    force = false
  ) {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const current =
        await sql`
          SELECT *
          FROM saves
          WHERE user_id = ${id}
          LIMIT 1
        `;

      const cur =
        current[0];

      const now =
        Date.now();

      const summary =
        extractSummary(save);

      const json =
        JSON.stringify(save);

      if (!cur) {
        const inserted =
          await sql`
            INSERT INTO saves (
              user_id,
              data,
              revision,
              updated_at,
              play_seconds,
              display_name,
              power,
              boss_kills,
              best_stage,
              account_level
            )
            VALUES (
              ${id},
              ${json},
              1,
              ${now},
              ${summary.playSeconds},
              ${summary.name},
              ${summary.power},
              ${summary.bossKills},
              ${summary.bestStage},
              ${summary.accountLevel}
            )
            RETURNING revision
          `;

        return success({
          revision:
            Number(
              inserted[0].revision
            ),

          updatedAt: now,
          power:
            summary.power
        });
      }

      if (
        !force &&
        Number(revision) !==
          Number(cur.revision)
      ) {
        return failure(
          409,
          'Outro dispositivo salvou um progresso diferente.',
          {
            revision:
              Number(
                cur.revision
              ),

            updatedAt:
              Number(
                cur.updated_at
              ),

            playSeconds:
              Number(
                cur.play_seconds
              ),

            save:
              JSON.parse(
                cur.data
              )
          }
        );
      }

      const lastHistory =
        await sql`
          SELECT created_at
          FROM save_history
          WHERE user_id = ${id}
          ORDER BY id DESC
          LIMIT 1
        `;

      if (
        !lastHistory.length ||
        now -
          Number(
            lastHistory[0]
              .created_at
          ) >
          600000
      ) {
        await sql`
          INSERT INTO save_history (
            user_id,
            data,
            revision,
            created_at
          )
          VALUES (
            ${id},
            ${cur.data},
            ${cur.revision},
            ${now}
          )
        `;
      }

      let updated;

      if (force) {
        updated = await sql`
          UPDATE saves
          SET
            data =
              ${json},

            revision =
              revision + 1,

            updated_at =
              ${now},

            play_seconds =
              ${summary.playSeconds},

            display_name =
              ${summary.name},

            power =
              ${summary.power},

            boss_kills =
              ${summary.bossKills},

            best_stage =
              ${summary.bestStage},

            account_level =
              ${summary.accountLevel}

          WHERE user_id =
            ${id}

          RETURNING
            revision
        `;
      } else {
        updated = await sql`
          UPDATE saves
          SET
            data =
              ${json},

            revision =
              revision + 1,

            updated_at =
              ${now},

            play_seconds =
              ${summary.playSeconds},

            display_name =
              ${summary.name},

            power =
              ${summary.power},

            boss_kills =
              ${summary.bossKills},

            best_stage =
              ${summary.bestStage},

            account_level =
              ${summary.accountLevel}

          WHERE
            user_id = ${id}
            AND revision =
              ${Number(revision)}

          RETURNING
            revision
        `;
      }

      if (!updated.length) {
        const newest =
          await sql`
            SELECT *
            FROM saves
            WHERE user_id =
              ${id}
          `;

        const remote =
          newest[0];

        return failure(
          409,
          'Outro dispositivo salvou um progresso diferente.',
          {
            revision:
              Number(
                remote.revision
              ),

            updatedAt:
              Number(
                remote.updated_at
              ),

            playSeconds:
              Number(
                remote.play_seconds
              ),

            save:
              JSON.parse(
                remote.data
              )
          }
        );
      }

      await sql`
        DELETE FROM save_history
        WHERE
          user_id = ${id}
          AND id NOT IN (
            SELECT id
            FROM save_history
            WHERE user_id =
              ${id}
            ORDER BY id DESC
            LIMIT 20
          )
      `;

      return success({
        revision:
          Number(
            updated[0].revision
          ),

        updatedAt: now,

        power:
          summary.power
      });

    } catch (error) {
      console.error(
        '[Neon/putSave]',
        error
      );

      return failure(
        500,
        'Erro ao salvar progresso.'
      );
    }
  },

  async history() {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const history =
        await sql`
          SELECT
            id,
            revision,
            created_at
          FROM save_history
          WHERE user_id =
            ${id}
          ORDER BY id DESC
        `;

      return success({
        history
      });

    } catch (error) {
      console.error(
        '[Neon/history]',
        error
      );

      return failure(
        500,
        'Erro ao carregar histórico.'
      );
    }
  },

  async restore(historyId) {
    try {
      const id =
        currentUserId();

      if (!id) {
        return failure(
          401,
          'Não autenticado.'
        );
      }

      const sql =
        await getDb();

      const rows =
        await sql`
          SELECT *
          FROM save_history
          WHERE
            id =
              ${Number(historyId)}
            AND user_id =
              ${id}
          LIMIT 1
        `;

      if (!rows.length) {
        return failure(
          404,
          'Cópia não encontrada.'
        );
      }

      const current =
        await this.getSave();

      if (!current.ok) {
        return current;
      }

      return this.putSave(
        JSON.parse(
          rows[0].data
        ),
        current.revision,
        true
      );

    } catch (error) {
      console.error(
        '[Neon/restore]',
        error
      );

      return failure(
        500,
        'Erro ao restaurar save.'
      );
    }
  },

  async leaderboard(
    type = 'power'
  ) {
    try {
      const sql =
        await getDb();

      let rows;

      if (type === 'bosses') {
        rows = await sql`
          SELECT
            s.display_name
              AS name,
            s.power,
            s.boss_kills,
            s.best_stage,
            s.account_level
          FROM saves s
          JOIN users u
            ON u.id =
              s.user_id
          WHERE
            u.banned = 0
            AND
            u.suspicious < 3
          ORDER BY
            s.boss_kills DESC,
            s.power DESC
          LIMIT 50
        `;
      }

      else if (
        type === 'stage'
      ) {
        rows = await sql`
          SELECT
            s.display_name
              AS name,
            s.power,
            s.boss_kills,
            s.best_stage,
            s.account_level
          FROM saves s
          JOIN users u
            ON u.id =
              s.user_id
          WHERE
            u.banned = 0
            AND
            u.suspicious < 3
          ORDER BY
            s.best_stage DESC,
            s.power DESC
          LIMIT 50
        `;
      }

      else {
        type = 'power';

        rows = await sql`
          SELECT
            s.display_name
              AS name,
            s.power,
            s.boss_kills,
            s.best_stage,
            s.account_level
          FROM saves s
          JOIN users u
            ON u.id =
              s.user_id
          WHERE
            u.banned = 0
            AND
            u.suspicious < 3
          ORDER BY
            s.power DESC
          LIMIT 50
        `;
      }

      let me = null;

      const id =
        currentUserId();

      if (id) {
        const mine =
          await sql`
            SELECT *
            FROM saves
            WHERE user_id =
              ${id}
            LIMIT 1
          `;

        if (mine.length) {
          const own =
            mine[0];

          const ranking =
            await sql`
              SELECT
                COUNT(*) + 1
                  AS rank
              FROM saves s
              JOIN users u
                ON u.id =
                  s.user_id
              WHERE
                u.banned = 0
                AND
                u.suspicious < 3
                AND
                s.power >
                  ${own.power}
            `;

          me = {
            name:
              own.display_name,

            power:
              Number(
                own.power
              ),

            boss_kills:
              Number(
                own.boss_kills
              ),

            best_stage:
              Number(
                own.best_stage
              ),

            rank:
              Number(
                ranking[0].rank
              )
          };
        }
      }

      return success({
        type,
        rows,
        me
      });

    } catch (error) {
      console.error(
        '[Neon/leaderboard]',
        error
      );

      return failure(
        500,
        'Erro ao carregar ranking.'
      );
    }
  },

  // Compatibilidade com chamadas antigas Net.api(...)
  async api(
    method,
    url,
    body
  ) {
    const path =
      String(url).split('?')[0];

    if (
      path === '/api/health'
    ) {
      const connected =
        await this.detect();

      return connected
        ? success()
        : failure(
            0,
            'Sem conexão com o banco.'
          );
    }

    if (
      path ===
      '/api/auth/me'
    ) {
      const user =
        await this.me();

      return user
        ? success({ user })
        : failure(
            401,
            'Não autenticado.'
          );
    }

    if (
      path ===
      '/api/auth/register'
    ) {
      return this.register(
        body || {}
      );
    }

    if (
      path ===
      '/api/auth/login'
    ) {
      return this.login(
        body || {}
      );
    }

    if (
      path ===
      '/api/auth/logout'
    ) {
      return this.logout();
    }

    if (
      path ===
      '/api/auth/recover'
    ) {
      return this.recover(
        body || {}
      );
    }

    if (
      path ===
      '/api/auth/password'
    ) {
      return this.changePassword(
        body || {}
      );
    }

    if (
      path ===
      '/api/auth/recovery-code'
    ) {
      return this.newRecovery(
        body?.password
      );
    }

    if (
      path ===
      '/api/auth/logout-all'
    ) {
      return this.logoutAll();
    }

    if (
      path ===
      '/api/account/delete'
    ) {
      return this.deleteAccount(
        body || {}
      );
    }

    if (
      path ===
      '/api/save' &&
      method === 'GET'
    ) {
      return this.getSave();
    }

    if (
      path ===
      '/api/save' &&
      method === 'PUT'
    ) {
      return this.putSave(
        body?.save,
        body?.revision,
        body?.force
      );
    }

    if (
      path ===
      '/api/save/history'
    ) {
      return this.history();
    }

    if (
      path ===
      '/api/save/restore'
    ) {
      return this.restore(
        body?.id
      );
    }

    if (
      path ===
      '/api/leaderboard'
    ) {
      const query =
        new URLSearchParams(
          String(url).split('?')[1] ||
          ''
        );

      return this.leaderboard(
        query.get('type') ||
        'power'
      );
    }

    return failure(
      404,
      'Operação não encontrada.'
    );
  }
};

// ---------------------------------------------------------------------------
// Sincronização do save
// ---------------------------------------------------------------------------

class CloudSync {
  constructor() {
    this.revision = 0;
    this.dirty = false;
    this.lastJson = null;
    this.pushing = false;
    this.lastSync = 0;
    this.status = 'idle';
    this.error = null;
    this.ui = null;
    this.enabled = false;
  }

  start(revision, ui) {
    this.revision =
      revision || 0;

    this.ui = ui;
    this.enabled = true;

    setInterval(
      () => this.push(),
      30000
    );

    addEventListener(
      'online',
      () => this.push(true)
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (
          document.hidden
        ) {
          this.push(true);
        }
      }
    );
  }

  onLocalSave(
    state,
    json
  ) {
    if (!this.enabled) {
      return;
    }

    this.dirty = true;
    this.lastJson = json;
    this.state = state;
  }

  async push(
    forceNow = false,
    force = false
  ) {
    if (
      !this.enabled ||
      this.pushing ||
      (
        !this.dirty &&
        !forceNow &&
        !force
      ) ||
      !this.lastJson
    ) {
      return;
    }

    this.pushing = true;
    this.status = 'saving';

    const payload =
      JSON.parse(
        this.lastJson
      );

    this.dirty = false;

    const result =
      await Net.putSave(
        payload,
        this.revision,
        force
      );

    this.pushing = false;

    if (result.ok) {
      this.revision =
        result.revision;

      this.lastSync =
        Date.now();

      this.status = 'ok';
      this.error = null;
    }

    else if (
      result.status === 409
    ) {
      this.status =
        'conflict';

      await this.resolveConflict(
        result
      );
    }

    else if (
      result.status === 401
    ) {
      this.status =
        'auth';

      this.error =
        'Sessão expirada. Entre novamente.';

      this.ui?.toast(
        'Sua sessão expirou — faça login de novo para salvar na nuvem.'
      );
    }

    else {
      this.dirty = true;
      this.status = 'error';
      this.error =
        result.error;
    }

    this.ui?.renderCloud?.();
  }

  async resolveConflict(
    result
  ) {
    const localPlay =
      this.state
        ?.totalPlaySeconds ||
      0;

    const remotePlay =
      result.playSeconds ||
      0;

    const formatTime =
      seconds =>
        `${
          Math.floor(
            seconds / 3600
          )
        }h ${
          Math.floor(
            (
              seconds % 3600
            ) / 60
          )
        }min`;

    const choice =
      await this.ui.ask(
        'Progresso em outro dispositivo',

        `A nuvem tem um save diferente (${formatTime(remotePlay)} de jogo, salvo ${new Date(result.updatedAt).toLocaleString('pt-BR')}). Este dispositivo tem ${formatTime(localPlay)}. Qual deseja manter?`,

        [
          {
            id: 'remote',
            label:
              'Usar o da nuvem',
            primary:
              remotePlay >=
              localPlay
          },

          {
            id: 'local',
            label:
              'Manter este',
            primary:
              localPlay >
              remotePlay
          }
        ]
      );

    if (
      choice === 'remote'
    ) {
      KT.Utils.safeStorage.set(
        this.storageKey,
        JSON.stringify(
          result.save
        )
      );

      this.enabled = false;

      location.reload();

      return;
    }

    this.revision =
      result.revision;

    this.dirty = true;

    await this.push(
      true,
      true
    );
  }

  beacon() {
    this.push(true);
  }
}

KT.Net = Net;
KT.Cloud =
  new CloudSync();

})();
