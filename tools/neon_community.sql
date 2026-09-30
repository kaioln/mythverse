-- Comunidade (modo Neon): chat global, filtro automático de racismo/ódio e perfil público com privacidade.
-- Tudo passa por funções SECURITY DEFINER: o cliente não escreve direto nas tabelas.
-- mv_chat_send devolve o id da mensagem, -1 (bloqueada por ódio) ou -2 (bloqueada e silenciado por 24 h).
-- Avatar = retrato de um herói do próprio jogador (sem upload de fotos: nenhuma imagem imprópria entra no jogo).

-- ---------------------------------------------------------------------------
-- FILTRO: normaliza (minúsculas, sem acento, números/símbolos trocados por letras, sem espaços e letras repetidas)
-- e procura termos racistas/de ódio. Pega "m4c4c0", "c r i o u l o", "crioooulo", "n1gg3r" etc.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mv_norm_text(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ013457@$!|',
      'aaaaaeeeeiiiiooooouuuucnoieastasii'),
    '[^a-z]', '', 'g'), '(.)\1+', '\1', 'g') $$;

CREATE TABLE IF NOT EXISTS public.mv_block_terms (term text PRIMARY KEY);
REVOKE ALL ON public.mv_block_terms FROM anonymous, authenticated;
-- Termos já normalizados (sem letras repetidas). Racismo, injúria racial e apologia ao nazismo (PT e EN).
INSERT INTO public.mv_block_terms (term) VALUES
  ('macaco'), ('macaca'), ('crioulo'), ('crioula'), ('tiziu'), ('senzala'), ('negrinho'), ('negrinha'), ('negofedido'), ('pretofedido'),
  ('pretoimundo'), ('negoimundo'), ('cabeloruim'), ('cabelodebombril'), ('picoledeasfalto'), ('servicodepreto'), ('coisadepreto'),
  ('volteprafrica'), ('voltaprafrica'), ('volteproafrica'), ('japaimundo'), ('olhopuxadoimundo'), ('bugreimundo'), ('judeuimundo'),
  ('niger'), ('nigger'), ('niga'), ('nigga'), ('chink'), ('kike'), ('gok'), ('wetback'), ('junglebunny'), ('porchmonkey'),
  ('heilhitler'), ('siegheil'), ('whitepower'), ('supremaciabranca'), ('racapura'), ('holocaustofake'), ('gasthejews')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.mv_is_offensive(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mv_block_terms b WHERE position(b.term IN public.mv_norm_text(p)) > 0)
      OR coalesce(p, '') ~ '(^|[^0-9])(1488|14/88)([^0-9]|$)' $$;
REVOKE ALL ON FUNCTION public.mv_is_offensive(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- CHAT GLOBAL
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mv_chat (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL,
  name       text NOT NULL,
  avatar     text NOT NULL DEFAULT '',
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mv_chat_user_idx ON public.mv_chat (user_id, created_at DESC);
REVOKE ALL ON public.mv_chat FROM anonymous, authenticated;

CREATE TABLE IF NOT EXISTS public.mv_chat_mutes (user_id text PRIMARY KEY, until timestamptz NOT NULL, reason text NOT NULL DEFAULT '');
REVOKE ALL ON public.mv_chat_mutes FROM anonymous, authenticated;

CREATE OR REPLACE FUNCTION public.mv_chat_send(p_text text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); body text := btrim(regexp_replace(coalesce(p_text, ''), '[<>]', '', 'g')); nm text; av text; hits int; nid bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Entre na conta para usar o chat.'; END IF;
  IF body = '' THEN RAISE EXCEPTION 'Mensagem vazia.'; END IF;
  body := left(body, 200);
  IF EXISTS (SELECT 1 FROM public.mv_chat_mutes WHERE user_id = me AND until > now()) THEN RAISE EXCEPTION 'Você está silenciado no chat por violar as regras.'; END IF;
  IF EXISTS (SELECT 1 FROM public.mv_chat WHERE user_id = me AND created_at > now() - interval '3 seconds') THEN RAISE EXCEPTION 'Calma: uma mensagem a cada 3 segundos.'; END IF;
  IF (SELECT count(*) FROM public.mv_chat WHERE user_id = me AND created_at > now() - interval '1 minute') >= 15 THEN RAISE EXCEPTION 'Muitas mensagens em pouco tempo. Espere um minuto.'; END IF;
  IF public.mv_is_offensive(body) THEN
    INSERT INTO public.mv_audit (user_id, kind, detail) VALUES (me, 'chat_blocked', jsonb_build_object('text', body));
    SELECT count(*) INTO hits FROM public.mv_audit WHERE user_id = me AND kind = 'chat_blocked' AND at > now() - interval '1 day';
    IF hits >= 3 THEN
      INSERT INTO public.mv_chat_mutes (user_id, until, reason) VALUES (me, now() + interval '24 hours', 'discurso de ódio')
        ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, reason = excluded.reason;
      RETURN -2;   -- bloqueada e silenciado por 24 h (sem exceção: o registro e o silêncio precisam ficar gravados)
    END IF;
    RETURN -1;     -- bloqueada
  END IF;
  SELECT coalesce(s.display_name, 'Viajante'), coalesce(p.avatar, '') INTO nm, av FROM public.mv_saves s LEFT JOIN public.mv_profiles p ON p.user_id = s.user_id WHERE s.user_id = me;
  IF nm IS NULL THEN nm := 'Viajante'; av := ''; END IF;
  IF public.mv_is_offensive(nm) THEN nm := 'Viajante'; END IF;
  INSERT INTO public.mv_chat (user_id, name, avatar, body) VALUES (me, nm, av, body) RETURNING id INTO nid;
  DELETE FROM public.mv_chat WHERE created_at < now() - interval '3 days';
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.mv_chat_recent(p_after bigint DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'id')::bigint), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', c.id, 'ref', md5(c.user_id), 'name', c.name, 'avatar', c.avatar, 'text', c.body, 'at', (extract(epoch FROM c.created_at) * 1000)::bigint, 'me', c.user_id = auth.user_id()) AS x
    FROM public.mv_chat c WHERE c.id > coalesce(p_after, 0) ORDER BY c.id DESC LIMIT 60) t $$;

-- ---------------------------------------------------------------------------
-- PERFIL PÚBLICO (com privacidade)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mv_profiles (
  user_id    text PRIMARY KEY,
  avatar     text NOT NULL DEFAULT '' CHECK (avatar ~ '^[a-z0-9_]{0,32}$'),
  title      text NOT NULL DEFAULT '' CHECK (length(title) <= 40),
  bio        text NOT NULL DEFAULT '' CHECK (length(bio) <= 240),
  show_team  boolean NOT NULL DEFAULT true,
  show_stats boolean NOT NULL DEFAULT true,
  show_guild boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.mv_profiles FROM anonymous, authenticated;

CREATE OR REPLACE FUNCTION public.mv_profile_set(p_avatar text, p_title text, p_bio text, p_show_team boolean, p_show_stats boolean, p_show_guild boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); b text := left(btrim(regexp_replace(coalesce(p_bio, ''), '[<>]', '', 'g')), 240); ti text := left(btrim(regexp_replace(coalesce(p_title, ''), '[<>]', '', 'g')), 40);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Entre na conta.'; END IF;
  IF public.mv_is_offensive(b) OR public.mv_is_offensive(ti) THEN
    INSERT INTO public.mv_audit (user_id, kind, detail) VALUES (me, 'profile_blocked', jsonb_build_object('bio', b, 'title', ti));
    RAISE EXCEPTION 'Texto bloqueado: racismo e discurso de ódio são proibidos no Mythverse.';
  END IF;
  -- Só heróis que o jogador tem no save podem ser avatar.
  IF coalesce(p_avatar, '') <> '' AND NOT EXISTS (SELECT 1 FROM public.mv_saves s, jsonb_array_elements(CASE WHEN jsonb_typeof(s.data->'collection') = 'array' THEN s.data->'collection' ELSE '[]'::jsonb END) h
                                                  WHERE s.user_id = me AND h->>'id' = p_avatar) THEN
    RAISE EXCEPTION 'Escolha como avatar um herói que você já tem.';
  END IF;
  INSERT INTO public.mv_profiles (user_id, avatar, title, bio, show_team, show_stats, show_guild, updated_at)
    VALUES (me, coalesce(p_avatar, ''), ti, b, coalesce(p_show_team, true), coalesce(p_show_stats, true), coalesce(p_show_guild, true), now())
    ON CONFLICT (user_id) DO UPDATE SET avatar = excluded.avatar, title = excluded.title, bio = excluded.bio, show_team = excluded.show_team,
      show_stats = excluded.show_stats, show_guild = excluded.show_guild, updated_at = now();
  RETURN true;
END $$;

-- p_ref: md5 do user_id (o mesmo "ref" usado no ranking, guildas e chat); vazio = o próprio perfil.
CREATE OR REPLACE FUNCTION public.mv_profile_get(p_ref text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid text; s record; p record; mine boolean; g record;
BEGIN
  IF coalesce(p_ref, '') = '' THEN uid := auth.user_id(); ELSE SELECT user_id INTO uid FROM public.mv_saves WHERE md5(user_id) = p_ref; END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'Jogador não encontrado.'; END IF;
  SELECT * INTO s FROM public.mv_saves WHERE user_id = uid;
  SELECT * INTO p FROM public.mv_profiles WHERE user_id = uid;
  mine := uid = auth.user_id();
  SELECT gg.name, gg.tag, m.role INTO g FROM public.mv_guild_members m JOIN public.mv_guilds gg ON gg.id = m.guild_id WHERE m.user_id = uid;
  RETURN jsonb_build_object(
    'ref', md5(uid), 'me', mine, 'name', CASE WHEN public.mv_is_offensive(s.display_name) THEN 'Viajante' ELSE s.display_name END,
    'avatar', coalesce(p.avatar, ''), 'title', coalesce(p.title, ''), 'bio', coalesce(p.bio, ''),
    'privacy', jsonb_build_object('team', coalesce(p.show_team, true), 'stats', coalesce(p.show_stats, true), 'guild', coalesce(p.show_guild, true)),
    'level', s.account_level,
    'stats', CASE WHEN mine OR coalesce(p.show_stats, true) THEN jsonb_build_object('power', s.power, 'boss_kills', s.boss_kills, 'best_stage', s.best_stage, 'rift_best', s.rift_best,
               'pvp', (SELECT jsonb_build_object('mmr', v.mmr, 'tier', public.mv_pvp_tier(v.mmr), 'wins', v.wins, 'losses', v.losses) FROM public.mv_pvp v WHERE v.user_id = uid)) END,
    'team', CASE WHEN mine OR coalesce(p.show_team, true) THEN s.team END,
    'guild', CASE WHEN (mine OR coalesce(p.show_guild, true)) AND g.name IS NOT NULL THEN jsonb_build_object('name', g.name, 'tag', g.tag, 'role', g.role) END,
    'since', (SELECT min(at) FROM public.mv_audit WHERE user_id = uid));
END $$;

REVOKE ALL ON FUNCTION public.mv_chat_send(text), public.mv_chat_recent(bigint), public.mv_profile_set(text, text, text, boolean, boolean, boolean), public.mv_profile_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mv_chat_send(text), public.mv_chat_recent(bigint), public.mv_profile_set(text, text, text, boolean, boolean, boolean), public.mv_profile_get(text) TO authenticated;
