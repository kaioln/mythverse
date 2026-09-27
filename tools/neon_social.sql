-- ===========================================================================
-- Social do modo Neon: Guildas, Arena PvP (MMR), Loja de Honra e Guerra de Guildas.
-- Honra, MMR, limites diários/semanais e compras vivem AQUI (não no save do jogador).
-- Cada luta guarda semente e comandos para poder ser refeita por um servidor no futuro.
-- Idempotente: roda junto com tools/neon_setup.js.
-- ===========================================================================

-- Dia e semana no horário de Brasília.
CREATE OR REPLACE FUNCTION public.mv_brt_day() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;
CREATE OR REPLACE FUNCTION public.mv_brt_week() RETURNS text LANGUAGE sql STABLE AS $$ SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'IYYY-"S"IW') $$;
CREATE OR REPLACE FUNCTION public.mv_clean_name(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT left(coalesce(nullif(btrim(regexp_replace(coalesce(p, ''), '[<>"&]', '', 'g')), ''), 'Viajante'), 24) $$;

-- ---------------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mv_pvp (
  user_id      text PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Viajante',
  mmr          integer NOT NULL DEFAULT 1000 CHECK (mmr >= 0),
  wins         integer NOT NULL DEFAULT 0,
  losses       integer NOT NULL DEFAULT 0,
  streak       integer NOT NULL DEFAULT 0,
  honor        bigint NOT NULL DEFAULT 0 CHECK (honor >= 0),
  power        bigint NOT NULL DEFAULT 0,
  defense      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (pg_column_size(defense) < 60000),
  day          date NOT NULL DEFAULT '2000-01-01',
  attacks      integer NOT NULL DEFAULT 0,
  week_claim   text NOT NULL DEFAULT '',
  shop_week    text NOT NULL DEFAULT '',
  shop_bought  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mv_pvp_mmr_idx ON public.mv_pvp (mmr);

CREATE TABLE IF NOT EXISTS public.mv_pvp_matches (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'arena' CHECK (kind IN ('arena', 'gvg')),
  war_id      text,
  attacker    text NOT NULL,
  defender    text NOT NULL,
  seed        bigint NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'void')),
  won         boolean,
  mmr_delta   integer,
  honor       integer,
  points      integer,
  inputs      jsonb,
  end_tick    integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS mv_pvp_matches_att_idx ON public.mv_pvp_matches (attacker, created_at DESC);
CREATE INDEX IF NOT EXISTS mv_pvp_matches_war_idx ON public.mv_pvp_matches (war_id, defender);

CREATE TABLE IF NOT EXISTS public.mv_guilds (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE CHECK (length(name) BETWEEN 3 AND 22),
  tag        text NOT NULL UNIQUE CHECK (tag ~ '^[A-Z0-9]{2,4}$'),
  emblem     text NOT NULL DEFAULT '⚔' CHECK (length(emblem) <= 4),
  motto      text NOT NULL DEFAULT '' CHECK (length(motto) <= 120),
  leader     text NOT NULL,
  open       boolean NOT NULL DEFAULT true,
  level      integer NOT NULL DEFAULT 1,
  xp         bigint NOT NULL DEFAULT 0,
  bank       bigint NOT NULL DEFAULT 0,
  rating     integer NOT NULL DEFAULT 1000,
  wars_won   integer NOT NULL DEFAULT 0,
  wars_lost  integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mv_guild_members (
  user_id      text PRIMARY KEY,
  guild_id     bigint NOT NULL REFERENCES public.mv_guilds(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  display_name text NOT NULL DEFAULT 'Viajante',
  power        bigint NOT NULL DEFAULT 0,
  contributed  bigint NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  seen_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mv_guild_members_g_idx ON public.mv_guild_members (guild_id);
CREATE TABLE IF NOT EXISTS public.mv_guild_requests (
  guild_id     bigint NOT NULL REFERENCES public.mv_guilds(id) ON DELETE CASCADE,
  user_id      text NOT NULL,
  display_name text NOT NULL,
  power        bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.mv_guild_feed (
  id         bigserial PRIMARY KEY,
  guild_id   bigint NOT NULL REFERENCES public.mv_guilds(id) ON DELETE CASCADE,
  author     text NOT NULL DEFAULT '',
  kind       text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat', 'event')),
  text       text NOT NULL CHECK (length(text) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mv_guild_feed_idx ON public.mv_guild_feed (guild_id, id DESC);
CREATE TABLE IF NOT EXISTS public.mv_gvg (
  war_id   text NOT NULL,
  guild_id bigint NOT NULL REFERENCES public.mv_guilds(id) ON DELETE CASCADE,
  opponent bigint,
  points   integer NOT NULL DEFAULT 0,
  wins     integer NOT NULL DEFAULT 0,
  attacks  integer NOT NULL DEFAULT 0,
  settled  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (war_id, guild_id)
);
CREATE TABLE IF NOT EXISTS public.mv_gvg_claims (war_id text NOT NULL, user_id text NOT NULL, PRIMARY KEY (war_id, user_id));

-- Nada disso é lido ou escrito direto pela API: só por funções e visões.
ALTER TABLE public.mv_pvp ENABLE ROW LEVEL SECURITY; ALTER TABLE public.mv_pvp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mv_guilds ENABLE ROW LEVEL SECURITY; ALTER TABLE public.mv_guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mv_guild_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.mv_guild_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mv_gvg ENABLE ROW LEVEL SECURITY; ALTER TABLE public.mv_gvg_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mv_pvp, public.mv_pvp_matches, public.mv_guilds, public.mv_guild_members, public.mv_guild_requests, public.mv_guild_feed, public.mv_gvg, public.mv_gvg_claims FROM anonymous, authenticated;

-- ---------------------------------------------------------------------------
-- ARENA PvP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mv_pvp_tier(p_mmr integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_mmr >= 1700 THEN 'lenda' WHEN p_mmr >= 1550 THEN 'diamante' WHEN p_mmr >= 1400 THEN 'platina' WHEN p_mmr >= 1250 THEN 'ouro' WHEN p_mmr >= 1100 THEN 'prata' ELSE 'bronze' END $$;

-- Meu registro (cria na primeira vez) com o dia já renovado.
CREATE OR REPLACE FUNCTION public.mv_pvp_me() RETURNS public.mv_pvp LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); r public.mv_pvp;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  INSERT INTO public.mv_pvp (user_id) VALUES (me) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.mv_pvp SET day = public.mv_brt_day(), attacks = 0 WHERE user_id = me AND day <> public.mv_brt_day();
  SELECT * INTO r FROM public.mv_pvp WHERE user_id = me;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.mv_pvp_week_matches(p_user text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.mv_pvp_matches WHERE attacker = p_user AND status = 'done' AND to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'IYYY-"S"IW') = public.mv_brt_week() $$;

CREATE OR REPLACE FUNCTION public.mv_pvp_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mv_pvp; rk integer;
BEGIN
  r := public.mv_pvp_me();
  IF EXISTS (SELECT 1 FROM public.mv_pvp_matches WHERE attacker = r.user_id AND status = 'open' AND created_at < now() - interval '15 minutes') THEN PERFORM public.mv_pvp_forfeit_open(r.user_id); r := public.mv_pvp_me(); END IF;
  SELECT count(*) + 1 INTO rk FROM public.mv_pvp WHERE mmr > r.mmr AND jsonb_array_length(defense) > 0;
  RETURN jsonb_build_object('mmr', r.mmr, 'tier', public.mv_pvp_tier(r.mmr), 'wins', r.wins, 'losses', r.losses, 'streak', r.streak, 'honor', r.honor,
    'attacks', r.attacks, 'attacksMax', 10, 'rank', rk, 'week', public.mv_brt_week(), 'weekMatches', public.mv_pvp_week_matches(r.user_id), 'weekClaimed', r.week_claim = public.mv_brt_week(),
    'shopWeek', CASE WHEN r.shop_week = public.mv_brt_week() THEN r.shop_bought ELSE '{}'::jsonb END, 'hasDefense', jsonb_array_length(r.defense) > 0);
END $$;

-- Equipe de defesa: instantâneo dos atributos calculados pelo jogo.
CREATE OR REPLACE FUNCTION public.mv_pvp_defense(p_name text, p_power bigint, p_defense jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id();
BEGIN
  PERFORM public.mv_pvp_me();
  IF jsonb_typeof(p_defense) <> 'array' OR jsonb_array_length(p_defense) < 1 OR jsonb_array_length(p_defense) > 4 THEN RAISE EXCEPTION 'Equipe de defesa inválida.'; END IF;
  UPDATE public.mv_pvp SET display_name = public.mv_clean_name(p_name), power = greatest(0, p_power), defense = p_defense, updated_at = now() WHERE user_id = me;
  UPDATE public.mv_guild_members SET display_name = public.mv_clean_name(p_name), power = greatest(0, p_power) WHERE user_id = me;
  RETURN true;
END $$;

-- Três oponentes com MMR mais próximo que têm defesa salva (nunca você mesmo).
CREATE OR REPLACE FUNCTION public.mv_pvp_find() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mv_pvp;
BEGIN
  r := public.mv_pvp_me();
  RETURN (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('ref', md5(user_id), 'name', display_name, 'mmr', mmr, 'tier', public.mv_pvp_tier(mmr), 'power', power, 'wins', wins, 'losses', losses,
      'team', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', h->>'id', 'stars', h->'stars', 'level', h->'level')), '[]'::jsonb) FROM jsonb_array_elements(defense) h)) AS x
    FROM public.mv_pvp WHERE user_id <> r.user_id AND jsonb_array_length(defense) > 0
    ORDER BY abs(mmr - r.mmr), random() LIMIT 3) s);
END $$;

-- Começa a luta: gasta 1 dos 10 ingressos do dia; a semente é sorteada pelo banco.
CREATE OR REPLACE FUNCTION public.mv_pvp_start(p_ref text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mv_pvp; d public.mv_pvp; mid bigint; s bigint := floor(random() * 2147483000)::bigint + 1;
BEGIN
  r := public.mv_pvp_me();
  IF r.attacks >= 10 THEN RAISE EXCEPTION 'Você já usou os 10 ingressos da Arena hoje. Renovam à meia-noite (Brasília).'; END IF;
  SELECT * INTO d FROM public.mv_pvp WHERE md5(user_id) = p_ref AND user_id <> r.user_id AND jsonb_array_length(defense) > 0;
  IF d.user_id IS NULL THEN RAISE EXCEPTION 'Oponente indisponível.'; END IF;
  PERFORM public.mv_pvp_forfeit_open(r.user_id);
  UPDATE public.mv_pvp SET attacks = attacks + 1 WHERE user_id = r.user_id;
  INSERT INTO public.mv_pvp_matches (kind, attacker, defender, seed) VALUES ('arena', r.user_id, d.user_id, s) RETURNING id INTO mid;
  RETURN jsonb_build_object('match', mid, 'seed', s, 'name', d.display_name, 'mmr', d.mmr, 'tier', public.mv_pvp_tier(d.mmr), 'defense', d.defense);
END $$;

-- Rejeita lutas com duração impossível (rápidas demais para a velocidade máxima 3x, ou velhas).
CREATE OR REPLACE FUNCTION public.mv_match_sane(m public.mv_pvp_matches, p_end_tick integer) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT extract(epoch FROM now() - m.created_at) BETWEEN 8 AND 900 AND p_end_tick IS NOT NULL AND p_end_tick >= 0 AND p_end_tick * 0.05 <= extract(epoch FROM now() - m.created_at) * 3 + 5 $$;

-- Liquida uma luta de arena: MMR (Elo, K=32), honra e sequência. Abandono e duração impossível contam como derrota.
CREATE OR REPLACE FUNCTION public.mv_pvp_settle(p_match bigint, p_won boolean, p_inputs jsonb, p_end_tick integer, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_pvp_matches; a public.mv_pvp; d public.mv_pvp; expct numeric; delta integer; hon integer; dh integer := 0; me text;
BEGIN
  SELECT * INTO m FROM public.mv_pvp_matches WHERE id = p_match AND status = 'open' AND kind = 'arena' FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Luta não encontrada ou já encerrada.'; END IF;
  me := m.attacker;
  SELECT * INTO a FROM public.mv_pvp WHERE user_id = me FOR UPDATE;
  SELECT * INTO d FROM public.mv_pvp WHERE user_id = m.defender FOR UPDATE;
  expct := 1 / (1 + power(10, (d.mmr - a.mmr) / 400.0));
  delta := round(32 * ((CASE WHEN p_won THEN 1 ELSE 0 END) - expct));
  IF p_won THEN hon := least(40, 20 + 4 * a.streak); ELSE hon := CASE WHEN p_note IS NULL THEN 4 ELSE 0 END; dh := 6; END IF;
  UPDATE public.mv_pvp SET mmr = greatest(0, mmr + delta), honor = honor + hon, wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END), losses = losses + (CASE WHEN p_won THEN 0 ELSE 1 END),
    streak = CASE WHEN p_won THEN streak + 1 ELSE 0 END WHERE user_id = me;
  UPDATE public.mv_pvp SET mmr = greatest(0, mmr - round(delta * 0.6)::integer), honor = honor + dh WHERE user_id = m.defender;
  UPDATE public.mv_pvp_matches SET status = 'done', won = p_won, mmr_delta = delta, honor = hon, inputs = CASE WHEN pg_column_size(p_inputs) < 60000 THEN p_inputs END, end_tick = p_end_tick, finished_at = now() WHERE id = m.id;
  IF p_won THEN UPDATE public.mv_guilds g SET xp = g.xp + 15, level = public.mv_guild_level(g.xp + 15) FROM public.mv_guild_members gm WHERE gm.user_id = me AND g.id = gm.guild_id; END IF;
  RETURN jsonb_build_object('won', p_won, 'delta', delta, 'honor', hon, 'mmr', greatest(0, a.mmr + delta), 'tier', public.mv_pvp_tier(greatest(0, a.mmr + delta)), 'note', p_note);
END $$;

CREATE OR REPLACE FUNCTION public.mv_pvp_finish(p_match bigint, p_won boolean, p_inputs jsonb, p_end_tick integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_pvp_matches;
BEGIN
  SELECT * INTO m FROM public.mv_pvp_matches WHERE id = p_match AND attacker = auth.user_id() AND status = 'open' AND kind = 'arena';
  IF m.id IS NULL THEN RAISE EXCEPTION 'Luta não encontrada ou já encerrada.'; END IF;
  IF NOT public.mv_match_sane(m, p_end_tick) THEN RETURN public.mv_pvp_settle(m.id, false, p_inputs, p_end_tick, 'Duração impossível: contada como derrota.'); END IF;
  RETURN public.mv_pvp_settle(m.id, p_won, p_inputs, p_end_tick, NULL);
END $$;

-- Lutas deixadas em aberto (aba fechada, recarregar para fugir da derrota) viram derrota.
CREATE OR REPLACE FUNCTION public.mv_pvp_forfeit_open(p_user text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x record;
BEGIN
  FOR x IN SELECT id, kind, war_id FROM public.mv_pvp_matches WHERE attacker = p_user AND status = 'open' LOOP
    IF x.kind = 'arena' THEN PERFORM public.mv_pvp_settle(x.id, false, NULL, NULL, 'Luta abandonada: contada como derrota.');
    ELSE
      UPDATE public.mv_pvp_matches SET status = 'done', won = false, points = 0, finished_at = now() WHERE id = x.id;
      UPDATE public.mv_gvg SET attacks = attacks + 1 WHERE war_id = x.war_id AND guild_id = (SELECT guild_id FROM public.mv_guild_members WHERE user_id = p_user);
    END IF;
  END LOOP;
END $$;

-- Recompensa semanal pela liga (mínimo de 5 lutas na semana).
CREATE OR REPLACE FUNCTION public.mv_pvp_claim_week() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mv_pvp; wk integer; hon integer;
BEGIN
  r := public.mv_pvp_me();
  IF r.week_claim = public.mv_brt_week() THEN RAISE EXCEPTION 'Recompensa desta semana já resgatada.'; END IF;
  wk := public.mv_pvp_week_matches(r.user_id);
  IF wk < 5 THEN RAISE EXCEPTION 'Lute ao menos 5 vezes nesta semana (%/5).', wk; END IF;
  hon := CASE public.mv_pvp_tier(r.mmr) WHEN 'lenda' THEN 600 WHEN 'diamante' THEN 420 WHEN 'platina' THEN 300 WHEN 'ouro' THEN 200 WHEN 'prata' THEN 120 ELSE 70 END;
  UPDATE public.mv_pvp SET honor = honor + hon, week_claim = public.mv_brt_week() WHERE user_id = r.user_id;
  RETURN jsonb_build_object('honor', hon, 'tier', public.mv_pvp_tier(r.mmr));
END $$;

-- Loja de Honra: preço e limite semanal definidos no banco. O jogo entrega a mercadoria.
CREATE OR REPLACE FUNCTION public.mv_pvp_buy(p_item text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mv_pvp; price integer; lim integer; bought jsonb; n integer;
BEGIN
  r := public.mv_pvp_me();
  SELECT x.price, x.lim INTO price, lim FROM (VALUES ('star', 60, 5), ('ori', 400, 1), ('glad_box', 300, 2), ('elixir', 40, 5), ('key', 180, 2),
    ('glad_weapon', 700, 1), ('glad_focus', 550, 1), ('glad_seal', 550, 1), ('glad_charm', 550, 1)) AS x(id, price, lim) WHERE x.id = p_item;
  IF price IS NULL THEN RAISE EXCEPTION 'Item inexistente na Loja de Honra.'; END IF;
  bought := CASE WHEN r.shop_week = public.mv_brt_week() THEN r.shop_bought ELSE '{}'::jsonb END;
  n := coalesce((bought->>p_item)::integer, 0);
  IF n >= lim THEN RAISE EXCEPTION 'Limite semanal atingido (%/%).', n, lim; END IF;
  IF r.honor < price THEN RAISE EXCEPTION 'Honra insuficiente (% de %).', r.honor, price; END IF;
  UPDATE public.mv_pvp SET honor = honor - price, shop_week = public.mv_brt_week(), shop_bought = jsonb_set(bought, ARRAY[p_item], to_jsonb(n + 1)) WHERE user_id = r.user_id;
  RETURN jsonb_build_object('item', p_item, 'price', price, 'honor', r.honor - price);
END $$;

-- Histórico recente (ataques e defesas).
CREATE OR REPLACE FUNCTION public.mv_pvp_history() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('at', m.finished_at, 'attack', m.attacker = auth.user_id(), 'won', CASE WHEN m.attacker = auth.user_id() THEN m.won ELSE NOT m.won END,
      'foe', (SELECT display_name FROM public.mv_pvp WHERE user_id = CASE WHEN m.attacker = auth.user_id() THEN m.defender ELSE m.attacker END),
      'delta', CASE WHEN m.kind = 'gvg' THEN 0 WHEN m.attacker = auth.user_id() THEN m.mmr_delta ELSE -round(m.mmr_delta * 0.6) END, 'kind', m.kind) AS x
    FROM public.mv_pvp_matches m WHERE m.status = 'done' AND (m.attacker = auth.user_id() OR m.defender = auth.user_id()) ORDER BY m.finished_at DESC LIMIT 20) s $$;

CREATE OR REPLACE VIEW public.mv_pvp_ranking AS
  SELECT p.display_name, p.mmr, public.mv_pvp_tier(p.mmr) AS tier, p.wins, p.losses, p.power, (p.user_id = auth.user_id()) AS me,
    (SELECT g.tag FROM public.mv_guild_members gm JOIN public.mv_guilds g ON g.id = gm.guild_id WHERE gm.user_id = p.user_id) AS guild_tag
  FROM public.mv_pvp p WHERE jsonb_array_length(p.defense) > 0;

-- ---------------------------------------------------------------------------
-- GUILDAS
-- ---------------------------------------------------------------------------
-- Nível pela EXP acumulada: cada nível pede 1,6× o anterior (1.000 no primeiro), até 20.
CREATE OR REPLACE FUNCTION public.mv_guild_level(p_xp bigint) RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE lv integer := 1; need numeric := 1000; rest numeric := p_xp;
BEGIN
  WHILE lv < 20 AND rest >= need LOOP rest := rest - need; lv := lv + 1; need := need * 1.6; END LOOP;
  RETURN lv;
END $$;
CREATE OR REPLACE FUNCTION public.mv_guild_cap(p_level integer) RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT least(30, 10 + 2 * p_level) $$;
CREATE OR REPLACE FUNCTION public.mv_my_member() RETURNS public.mv_guild_members LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT * FROM public.mv_guild_members WHERE user_id = auth.user_id() $$;
CREATE OR REPLACE FUNCTION public.mv_guild_event(p_gid bigint, p_text text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ INSERT INTO public.mv_guild_feed (guild_id, kind, text) VALUES (p_gid, 'event', left(p_text, 200)) $$;

CREATE OR REPLACE VIEW public.mv_guild_list AS
  SELECT g.id, g.name, g.tag, g.emblem, g.motto, g.open, g.level, g.rating, g.wars_won, g.wars_lost,
    (SELECT count(*) FROM public.mv_guild_members m WHERE m.guild_id = g.id)::integer AS members, public.mv_guild_cap(g.level) AS cap,
    (SELECT coalesce(sum(power), 0) FROM public.mv_guild_members m WHERE m.guild_id = g.id)::bigint AS power
  FROM public.mv_guilds g;

-- Tudo da minha guilda: dados, membros, pedidos (para oficiais) e mural.
CREATE OR REPLACE FUNCTION public.mv_guild_mine() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; g public.mv_guilds;
BEGIN
  m := public.mv_my_member();
  IF m.user_id IS NULL THEN
    RETURN jsonb_build_object('guild', NULL, 'requests', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.guild_id, 'name', gg.name)), '[]'::jsonb) FROM public.mv_guild_requests r JOIN public.mv_guilds gg ON gg.id = r.guild_id WHERE r.user_id = auth.user_id()));
  END IF;
  UPDATE public.mv_guild_members SET seen_at = now() WHERE user_id = m.user_id;
  SELECT * INTO g FROM public.mv_guilds WHERE id = m.guild_id;
  RETURN jsonb_build_object(
    'guild', jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'emblem', g.emblem, 'motto', g.motto, 'open', g.open, 'level', g.level, 'xp', g.xp, 'bank', g.bank, 'rating', g.rating, 'warsWon', g.wars_won, 'warsLost', g.wars_lost, 'cap', public.mv_guild_cap(g.level)),
    'me', jsonb_build_object('role', m.role, 'ref', md5(m.user_id), 'contributed', m.contributed),
    'members', (SELECT jsonb_agg(jsonb_build_object('ref', md5(x.user_id), 'name', x.display_name, 'role', x.role, 'power', x.power, 'contributed', x.contributed, 'seen', x.seen_at, 'mmr', (SELECT mmr FROM public.mv_pvp p WHERE p.user_id = x.user_id))
      ORDER BY CASE x.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, x.power DESC) FROM public.mv_guild_members x WHERE x.guild_id = g.id),
    'requests', CASE WHEN m.role IN ('leader', 'officer') THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('ref', md5(r.user_id), 'name', r.display_name, 'power', r.power)), '[]'::jsonb) FROM public.mv_guild_requests r WHERE r.guild_id = g.id) ELSE '[]'::jsonb END,
    'feed', (SELECT coalesce(jsonb_agg(jsonb_build_object('author', f.author, 'kind', f.kind, 'text', f.text, 'at', f.created_at) ORDER BY f.id DESC), '[]'::jsonb) FROM (SELECT * FROM public.mv_guild_feed WHERE guild_id = g.id ORDER BY id DESC LIMIT 40) f));
END $$;

CREATE OR REPLACE FUNCTION public.mv_guild_create(p_name text, p_tag text, p_emblem text, p_motto text, p_open boolean, p_display text, p_power bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); gid bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF (public.mv_my_member()).user_id IS NOT NULL THEN RAISE EXCEPTION 'Saia da sua guilda atual antes de fundar outra.'; END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 3 AND 22 OR btrim(p_name) ~ '[<>"&]' THEN RAISE EXCEPTION 'Nome da guilda: de 3 a 22 caracteres.'; END IF;
  IF upper(btrim(coalesce(p_tag, ''))) !~ '^[A-Z0-9]{2,4}$' THEN RAISE EXCEPTION 'Sigla: 2 a 4 letras ou números.'; END IF;
  IF EXISTS (SELECT 1 FROM public.mv_guilds WHERE lower(name) = lower(btrim(p_name)) OR tag = upper(btrim(p_tag))) THEN RAISE EXCEPTION 'Já existe uma guilda com esse nome ou sigla.'; END IF;
  INSERT INTO public.mv_guilds (name, tag, emblem, motto, leader, open) VALUES (btrim(p_name), upper(btrim(p_tag)), left(coalesce(nullif(p_emblem, ''), '⚔'), 4), left(regexp_replace(coalesce(p_motto, ''), '[<>]', '', 'g'), 120), me, coalesce(p_open, true)) RETURNING id INTO gid;
  INSERT INTO public.mv_guild_members (user_id, guild_id, role, display_name, power) VALUES (me, gid, 'leader', public.mv_clean_name(p_display), greatest(0, p_power));
  DELETE FROM public.mv_guild_requests WHERE user_id = me;
  PERFORM public.mv_guild_event(gid, public.mv_clean_name(p_display) || ' fundou a guilda.');
  RETURN gid;
END $$;

CREATE OR REPLACE FUNCTION public.mv_guild_join(p_gid bigint, p_display text, p_power bigint) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); g public.mv_guilds; n integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF (public.mv_my_member()).user_id IS NOT NULL THEN RAISE EXCEPTION 'Você já está numa guilda.'; END IF;
  SELECT * INTO g FROM public.mv_guilds WHERE id = p_gid FOR UPDATE; IF g.id IS NULL THEN RAISE EXCEPTION 'Guilda não encontrada.'; END IF;
  SELECT count(*) INTO n FROM public.mv_guild_members WHERE guild_id = g.id;
  IF n >= public.mv_guild_cap(g.level) THEN RAISE EXCEPTION 'A guilda está cheia (%).', n; END IF;
  IF NOT g.open THEN
    INSERT INTO public.mv_guild_requests (guild_id, user_id, display_name, power) VALUES (g.id, me, public.mv_clean_name(p_display), greatest(0, p_power)) ON CONFLICT (guild_id, user_id) DO NOTHING;
    RETURN 'requested';
  END IF;
  INSERT INTO public.mv_guild_members (user_id, guild_id, display_name, power) VALUES (me, g.id, public.mv_clean_name(p_display), greatest(0, p_power));
  DELETE FROM public.mv_guild_requests WHERE user_id = me;
  PERFORM public.mv_guild_event(g.id, public.mv_clean_name(p_display) || ' entrou na guilda.');
  RETURN 'joined';
END $$;

-- Oficiais: aceitar/recusar pedidos e expulsar. Líder: promover, rebaixar e transferir a liderança.
CREATE OR REPLACE FUNCTION public.mv_guild_manage(p_action text, p_ref text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; t public.mv_guild_members; rq public.mv_guild_requests; g public.mv_guilds; n integer;
BEGIN
  m := public.mv_my_member();
  IF m.user_id IS NULL OR m.role = 'member' THEN RAISE EXCEPTION 'Só líder e oficiais podem fazer isso.'; END IF;
  SELECT * INTO g FROM public.mv_guilds WHERE id = m.guild_id FOR UPDATE;
  IF p_action IN ('accept', 'reject') THEN
    SELECT * INTO rq FROM public.mv_guild_requests WHERE guild_id = g.id AND md5(user_id) = p_ref; IF rq.user_id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
    DELETE FROM public.mv_guild_requests WHERE guild_id = g.id AND user_id = rq.user_id;
    IF p_action = 'reject' THEN RETURN 'rejected'; END IF;
    IF EXISTS (SELECT 1 FROM public.mv_guild_members WHERE user_id = rq.user_id) THEN RAISE EXCEPTION 'Esse jogador já entrou em outra guilda.'; END IF;
    SELECT count(*) INTO n FROM public.mv_guild_members WHERE guild_id = g.id;
    IF n >= public.mv_guild_cap(g.level) THEN RAISE EXCEPTION 'A guilda está cheia.'; END IF;
    INSERT INTO public.mv_guild_members (user_id, guild_id, display_name, power) VALUES (rq.user_id, g.id, rq.display_name, rq.power);
    DELETE FROM public.mv_guild_requests WHERE user_id = rq.user_id;
    PERFORM public.mv_guild_event(g.id, rq.display_name || ' foi aceito por ' || m.display_name || '.');
    RETURN 'accepted';
  END IF;
  SELECT * INTO t FROM public.mv_guild_members WHERE guild_id = g.id AND md5(user_id) = p_ref;
  IF t.user_id IS NULL OR t.user_id = m.user_id THEN RAISE EXCEPTION 'Membro inválido.'; END IF;
  IF t.role = 'leader' OR (m.role = 'officer' AND t.role = 'officer') THEN RAISE EXCEPTION 'Você não tem autoridade sobre esse membro.'; END IF;
  IF p_action = 'kick' THEN DELETE FROM public.mv_guild_members WHERE user_id = t.user_id; PERFORM public.mv_guild_event(g.id, t.display_name || ' foi removido da guilda.'); RETURN 'kicked'; END IF;
  IF m.role <> 'leader' THEN RAISE EXCEPTION 'Só o líder pode mudar cargos.'; END IF;
  IF p_action = 'promote' THEN UPDATE public.mv_guild_members SET role = 'officer' WHERE user_id = t.user_id; PERFORM public.mv_guild_event(g.id, t.display_name || ' agora é oficial.'); RETURN 'promoted'; END IF;
  IF p_action = 'demote' THEN UPDATE public.mv_guild_members SET role = 'member' WHERE user_id = t.user_id; RETURN 'demoted'; END IF;
  IF p_action = 'transfer' THEN
    UPDATE public.mv_guild_members SET role = 'officer' WHERE user_id = m.user_id;
    UPDATE public.mv_guild_members SET role = 'leader' WHERE user_id = t.user_id;
    UPDATE public.mv_guilds SET leader = t.user_id WHERE id = g.id;
    PERFORM public.mv_guild_event(g.id, t.display_name || ' é o novo líder.'); RETURN 'transferred';
  END IF;
  RAISE EXCEPTION 'Ação inválida.';
END $$;

-- Sair: se o líder sair, o oficial (ou membro) mais antigo assume; guilda vazia é desfeita.
CREATE OR REPLACE FUNCTION public.mv_guild_leave() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; heir public.mv_guild_members;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RAISE EXCEPTION 'Você não está numa guilda.'; END IF;
  DELETE FROM public.mv_guild_members WHERE user_id = m.user_id;
  IF NOT EXISTS (SELECT 1 FROM public.mv_guild_members WHERE guild_id = m.guild_id) THEN DELETE FROM public.mv_guilds WHERE id = m.guild_id; RETURN 'disbanded'; END IF;
  IF m.role = 'leader' THEN
    SELECT * INTO heir FROM public.mv_guild_members WHERE guild_id = m.guild_id ORDER BY CASE role WHEN 'officer' THEN 0 ELSE 1 END, joined_at LIMIT 1;
    UPDATE public.mv_guild_members SET role = 'leader' WHERE user_id = heir.user_id;
    UPDATE public.mv_guilds SET leader = heir.user_id WHERE id = m.guild_id;
    PERFORM public.mv_guild_event(m.guild_id, heir.display_name || ' assumiu a liderança.');
  END IF;
  PERFORM public.mv_guild_event(m.guild_id, m.display_name || ' saiu da guilda.');
  RETURN 'left';
END $$;

-- Doação de ouro: 1 EXP da guilda a cada 1.000 de ouro; tudo vai para o cofre.
CREATE OR REPLACE FUNCTION public.mv_guild_donate(p_gold bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; g public.mv_guilds; add_xp bigint;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RAISE EXCEPTION 'Você não está numa guilda.'; END IF;
  IF p_gold < 1000 OR p_gold > 5000000 THEN RAISE EXCEPTION 'Doe entre 1.000 e 5.000.000 de ouro.'; END IF;
  add_xp := greatest(1, p_gold / 1000);
  UPDATE public.mv_guilds SET xp = xp + add_xp, bank = bank + p_gold, level = public.mv_guild_level(xp + add_xp) WHERE id = m.guild_id RETURNING * INTO g;
  UPDATE public.mv_guild_members SET contributed = contributed + p_gold WHERE user_id = m.user_id;
  PERFORM public.mv_guild_event(g.id, m.display_name || ' doou ' || p_gold || ' de ouro.');
  RETURN jsonb_build_object('level', g.level, 'xp', g.xp, 'bank', g.bank);
END $$;

CREATE OR REPLACE FUNCTION public.mv_guild_post(p_text text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; t text := left(btrim(regexp_replace(coalesce(p_text, ''), '[<>]', '', 'g')), 200);
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RAISE EXCEPTION 'Você não está numa guilda.'; END IF;
  IF t = '' THEN RAISE EXCEPTION 'Mensagem vazia.'; END IF;
  IF (SELECT count(*) FROM public.mv_guild_feed WHERE guild_id = m.guild_id AND author = m.display_name AND created_at > now() - interval '1 minute') >= 6 THEN RAISE EXCEPTION 'Calma: muitas mensagens seguidas.'; END IF;
  INSERT INTO public.mv_guild_feed (guild_id, author, kind, text) VALUES (m.guild_id, m.display_name, 'chat', t);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mv_guild_settings(p_motto text, p_open boolean, p_emblem text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL OR m.role = 'member' THEN RAISE EXCEPTION 'Só líder e oficiais podem mudar a guilda.'; END IF;
  UPDATE public.mv_guilds SET motto = left(regexp_replace(coalesce(p_motto, ''), '[<>]', '', 'g'), 120), open = coalesce(p_open, open), emblem = left(coalesce(nullif(p_emblem, ''), emblem), 4) WHERE id = m.guild_id;
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- GUERRA DE GUILDAS (quarta e sábado, 20h às 22h de Brasília)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mv_gvg_current() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN extract(isodow FROM now() AT TIME ZONE 'America/Sao_Paulo') IN (3, 6) AND extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo') >= 20 AND extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo') < 22
    THEN 'G' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') END $$;

-- Placar ao vivo da minha guerra (a atual ou a última).
CREATE OR REPLACE FUNCTION public.mv_gvg_board() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; w text := public.mv_gvg_current(); mine public.mv_gvg; foe public.mv_gvg; last text;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RETURN jsonb_build_object('active', w IS NOT NULL, 'guild', false); END IF;
  SELECT war_id INTO last FROM public.mv_gvg WHERE guild_id = m.guild_id ORDER BY war_id DESC LIMIT 1;
  SELECT * INTO mine FROM public.mv_gvg WHERE war_id = coalesce(w, last) AND guild_id = m.guild_id;
  IF mine.guild_id IS NOT NULL AND mine.opponent IS NOT NULL THEN SELECT * INTO foe FROM public.mv_gvg WHERE war_id = mine.war_id AND guild_id = mine.opponent; END IF;
  RETURN jsonb_build_object('active', w IS NOT NULL, 'guild', true, 'war', mine.war_id, 'current', w, 'entered', mine.guild_id IS NOT NULL AND mine.war_id = w,
    'us', CASE WHEN mine.guild_id IS NULL THEN NULL ELSE jsonb_build_object('name', (SELECT name FROM public.mv_guilds WHERE id = mine.guild_id), 'points', mine.points, 'wins', mine.wins, 'attacks', mine.attacks) END,
    'them', CASE WHEN mine.guild_id IS NULL THEN NULL WHEN foe.guild_id IS NULL THEN jsonb_build_object('name', 'Legião da Fenda', 'npc', true, 'points', 12) ELSE jsonb_build_object('name', (SELECT name FROM public.mv_guilds WHERE id = foe.guild_id), 'points', foe.points, 'wins', foe.wins, 'attacks', foe.attacks) END,
    'myAttacks', (SELECT count(*) FROM public.mv_pvp_matches WHERE kind = 'gvg' AND war_id = mine.war_id AND attacker = m.user_id),
    'claimed', EXISTS (SELECT 1 FROM public.mv_gvg_claims c WHERE c.war_id = mine.war_id AND c.user_id = m.user_id),
    'feed', (SELECT coalesce(jsonb_agg(jsonb_build_object('text', f.text, 'at', f.created_at) ORDER BY f.id DESC), '[]'::jsonb) FROM (SELECT * FROM public.mv_guild_feed WHERE guild_id = m.guild_id AND kind = 'event' AND text LIKE '⚔%' ORDER BY id DESC LIMIT 12) f));
END $$;

-- Inscreve a guilda e pareia com a inscrita de rating mais próximo. Sem par: Legião da Fenda (meta de 12 pontos).
CREATE OR REPLACE FUNCTION public.mv_gvg_enter() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; w text := public.mv_gvg_current(); mine public.mv_gvg; foe bigint;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RAISE EXCEPTION 'Entre numa guilda para lutar na guerra.'; END IF;
  IF w IS NULL THEN RAISE EXCEPTION 'A Guerra de Guildas acontece quarta e sábado, das 20h às 22h (Brasília).'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(w));
  INSERT INTO public.mv_gvg (war_id, guild_id) VALUES (w, m.guild_id) ON CONFLICT DO NOTHING;
  SELECT * INTO mine FROM public.mv_gvg WHERE war_id = w AND guild_id = m.guild_id;
  IF mine.opponent IS NULL THEN
    SELECT v.guild_id INTO foe FROM public.mv_gvg v JOIN public.mv_guilds g ON g.id = v.guild_id
      WHERE v.war_id = w AND v.guild_id <> m.guild_id AND v.opponent IS NULL
      ORDER BY abs(g.rating - (SELECT rating FROM public.mv_guilds WHERE id = m.guild_id)) LIMIT 1;
    IF foe IS NOT NULL THEN
      UPDATE public.mv_gvg SET opponent = foe WHERE war_id = w AND guild_id = m.guild_id;
      UPDATE public.mv_gvg SET opponent = m.guild_id WHERE war_id = w AND guild_id = foe;
    END IF;
  END IF;
  RETURN public.mv_gvg_board();
END $$;

-- Alvos: defensores da guilda inimiga (contra a Legião: qualquer jogador de fora da sua guilda).
CREATE OR REPLACE FUNCTION public.mv_gvg_targets() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; w text := public.mv_gvg_current(); mine public.mv_gvg;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL OR w IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO mine FROM public.mv_gvg WHERE war_id = w AND guild_id = m.guild_id; IF mine.guild_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('ref', md5(p.user_id), 'name', p.display_name, 'mmr', p.mmr, 'power', p.power,
      'team', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', h->>'id', 'stars', h->'stars')), '[]'::jsonb) FROM jsonb_array_elements(p.defense) h),
      'beaten', EXISTS (SELECT 1 FROM public.mv_pvp_matches x WHERE x.kind = 'gvg' AND x.war_id = w AND x.defender = p.user_id AND x.won AND x.attacker IN (SELECT user_id FROM public.mv_guild_members WHERE guild_id = m.guild_id)))), '[]'::jsonb)
    FROM public.mv_pvp p WHERE jsonb_array_length(p.defense) > 0 AND p.user_id <> m.user_id AND (
      (mine.opponent IS NOT NULL AND p.user_id IN (SELECT user_id FROM public.mv_guild_members WHERE guild_id = mine.opponent)) OR
      (mine.opponent IS NULL AND p.user_id NOT IN (SELECT user_id FROM public.mv_guild_members WHERE guild_id = m.guild_id))));
END $$;

-- 3 investidas por membro em cada guerra; o alvo precisa ser válido para a guerra atual.
CREATE OR REPLACE FUNCTION public.mv_gvg_start(p_ref text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; w text := public.mv_gvg_current(); d public.mv_pvp; mid bigint; s bigint := floor(random() * 2147483000)::bigint + 1; used integer;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL OR w IS NULL THEN RAISE EXCEPTION 'Fora da janela da Guerra de Guildas.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mv_gvg WHERE war_id = w AND guild_id = m.guild_id) THEN RAISE EXCEPTION 'Inscreva a guilda primeiro.'; END IF;
  SELECT count(*) INTO used FROM public.mv_pvp_matches WHERE kind = 'gvg' AND war_id = w AND attacker = m.user_id;
  IF used >= 3 THEN RAISE EXCEPTION 'Você já usou as 3 investidas desta guerra.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.mv_gvg_targets()) t WHERE t->>'ref' = p_ref) THEN RAISE EXCEPTION 'Alvo inválido para esta guerra.'; END IF;
  SELECT * INTO d FROM public.mv_pvp WHERE md5(user_id) = p_ref;
  PERFORM public.mv_pvp_forfeit_open(m.user_id);
  INSERT INTO public.mv_pvp_matches (kind, war_id, attacker, defender, seed) VALUES ('gvg', w, m.user_id, d.user_id, s) RETURNING id INTO mid;
  RETURN jsonb_build_object('match', mid, 'seed', s, 'name', d.display_name, 'mmr', d.mmr, 'defense', d.defense);
END $$;

-- Primeira vitória sobre cada defensor vale 3 pontos; repetir vale 1.
CREATE OR REPLACE FUNCTION public.mv_gvg_finish(p_match bigint, p_won boolean, p_inputs jsonb, p_end_tick integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; x public.mv_pvp_matches; pts integer := 0; first_win boolean;
BEGIN
  m := public.mv_my_member();
  SELECT * INTO x FROM public.mv_pvp_matches WHERE id = p_match AND attacker = auth.user_id() AND status = 'open' AND kind = 'gvg' FOR UPDATE;
  IF x.id IS NULL OR m.user_id IS NULL THEN RAISE EXCEPTION 'Investida não encontrada.'; END IF;
  IF NOT public.mv_match_sane(x, p_end_tick) THEN p_won := false; END IF;
  IF p_won THEN
    first_win := NOT EXISTS (SELECT 1 FROM public.mv_pvp_matches y WHERE y.kind = 'gvg' AND y.war_id = x.war_id AND y.defender = x.defender AND y.won AND y.attacker IN (SELECT user_id FROM public.mv_guild_members WHERE guild_id = m.guild_id));
    pts := CASE WHEN first_win THEN 3 ELSE 1 END;
  END IF;
  UPDATE public.mv_pvp_matches SET status = 'done', won = p_won, points = pts, inputs = CASE WHEN pg_column_size(p_inputs) < 60000 THEN p_inputs END, end_tick = p_end_tick, finished_at = now() WHERE id = x.id;
  UPDATE public.mv_gvg SET points = points + pts, wins = wins + (CASE WHEN p_won THEN 1 ELSE 0 END), attacks = attacks + 1 WHERE war_id = x.war_id AND guild_id = m.guild_id;
  PERFORM public.mv_guild_event(m.guild_id, '⚔ ' || m.display_name || CASE WHEN p_won THEN ' derrotou ' ELSE ' caiu diante de ' END || (SELECT display_name FROM public.mv_pvp WHERE user_id = x.defender) || CASE WHEN pts > 0 THEN ' (+' || pts || ')' ELSE '' END);
  RETURN jsonb_build_object('won', p_won, 'points', pts);
END $$;

-- Depois da janela: quem lutou resgata. Vencedora ganha mais honra, rating e EXP de guilda.
CREATE OR REPLACE FUNCTION public.mv_gvg_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.mv_guild_members; mine public.mv_gvg; foe public.mv_gvg; won boolean; hon integer; fought integer;
BEGIN
  m := public.mv_my_member(); IF m.user_id IS NULL THEN RAISE EXCEPTION 'Você não está numa guilda.'; END IF;
  SELECT * INTO mine FROM public.mv_gvg WHERE guild_id = m.guild_id AND war_id IS DISTINCT FROM public.mv_gvg_current() ORDER BY war_id DESC LIMIT 1 FOR UPDATE;
  IF mine.guild_id IS NULL THEN RAISE EXCEPTION 'Nenhuma guerra encerrada para resgatar.'; END IF;
  SELECT count(*) INTO fought FROM public.mv_pvp_matches WHERE kind = 'gvg' AND war_id = mine.war_id AND attacker = m.user_id AND status = 'done';
  IF fought = 0 THEN RAISE EXCEPTION 'Só quem lutou nesta guerra recebe a recompensa.'; END IF;
  INSERT INTO public.mv_gvg_claims (war_id, user_id) VALUES (mine.war_id, m.user_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recompensa desta guerra já resgatada.'; END IF;
  IF mine.opponent IS NOT NULL THEN SELECT * INTO foe FROM public.mv_gvg WHERE war_id = mine.war_id AND guild_id = mine.opponent; END IF;
  won := CASE WHEN foe.guild_id IS NULL THEN mine.points >= 12 ELSE mine.points > foe.points END;
  IF NOT mine.settled THEN
    UPDATE public.mv_gvg SET settled = true WHERE war_id = mine.war_id AND guild_id = mine.guild_id;
    UPDATE public.mv_guilds SET rating = greatest(0, rating + CASE WHEN won THEN 25 ELSE -15 END), wars_won = wars_won + (CASE WHEN won THEN 1 ELSE 0 END), wars_lost = wars_lost + (CASE WHEN won THEN 0 ELSE 1 END),
      xp = xp + CASE WHEN won THEN 400 ELSE 120 END, level = public.mv_guild_level(xp + CASE WHEN won THEN 400 ELSE 120 END) WHERE id = mine.guild_id;
  END IF;
  hon := CASE WHEN won THEN 120 ELSE 40 END + 10 * fought;
  PERFORM public.mv_pvp_me();
  UPDATE public.mv_pvp SET honor = honor + hon WHERE user_id = m.user_id;
  RETURN jsonb_build_object('won', won, 'honor', hon, 'war', mine.war_id);
END $$;

-- ---------------------------------------------------------------------------
-- PERMISSÕES: a API só enxerga visões públicas e funções.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.mv_pvp_ranking, public.mv_guild_list FROM anonymous, authenticated;
GRANT SELECT ON public.mv_pvp_ranking, public.mv_guild_list TO authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['mv_pvp_status()', 'mv_pvp_defense(text, bigint, jsonb)', 'mv_pvp_find()', 'mv_pvp_start(text)', 'mv_pvp_finish(bigint, boolean, jsonb, integer)', 'mv_pvp_claim_week()', 'mv_pvp_buy(text)', 'mv_pvp_history()',
    'mv_guild_mine()', 'mv_guild_create(text, text, text, text, boolean, text, bigint)', 'mv_guild_join(bigint, text, bigint)', 'mv_guild_manage(text, text)', 'mv_guild_leave()', 'mv_guild_donate(bigint)', 'mv_guild_post(text)', 'mv_guild_settings(text, boolean, text)',
    'mv_gvg_enter()', 'mv_gvg_board()', 'mv_gvg_targets()', 'mv_gvg_start(text)', 'mv_gvg_finish(bigint, boolean, jsonb, integer)', 'mv_gvg_claim()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['mv_pvp_me()', 'mv_my_member()', 'mv_guild_event(bigint, text)', 'mv_pvp_week_matches(text)', 'mv_pvp_settle(bigint, boolean, jsonb, integer, text)', 'mv_pvp_forfeit_open(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
  END LOOP;
END $$;
