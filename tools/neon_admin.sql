-- ===========================================================================
-- Modo Neon: relógio do servidor, presentes da administração e fechamento de tabelas legadas.
-- Roda depois de neon_setup.sql, neon_social.sql e neon_economy.sql (node tools/neon_setup.js).
-- ===========================================================================

-- Hora oficial do jogo. O navegador sincroniza o relógio por aqui: limites diários, expedições,
-- login diário e o AFK deixam de depender do relógio do aparelho (que o jogador pode adiantar).
CREATE OR REPLACE FUNCTION public.mv_now() RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint $$;
REVOKE ALL ON FUNCTION public.mv_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mv_now() TO authenticated, anonymous;

-- Presente da administração: chaves ou herói vão para o correio da conta (pelo nome no ranking
-- ou pelo id). Só o dono do banco executa (tools/neon_gift.js); jogadores não têm acesso.
CREATE OR REPLACE FUNCTION public.mv_gift(p_who text, p_kind text, p_payload jsonb, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target text;
BEGIN
  IF p_kind NOT IN ('keys', 'hero', 'gold', 'item', 'card', 'mat') THEN RAISE EXCEPTION 'tipo de presente inválido'; END IF;
  SELECT user_id INTO target FROM public.mv_saves WHERE user_id = p_who OR lower(display_name) = lower(p_who) ORDER BY (user_id = p_who) DESC LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'conta % não encontrada', p_who; END IF;
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (target, p_kind, p_payload, left(coalesce(p_reason, 'Presente'), 120));
  RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.mv_gift(text, text, jsonb, text) FROM PUBLIC;

-- Tabelas do servidor Node (users, saves, save_history…) no mesmo banco: a Data API liberava
-- leitura e escrita delas para qualquer conta logada (inclusive hashes de senha). Tudo o que não é
-- mv_* fica fechado para os papéis da API; o servidor Node usa o dono do banco e não é afetado.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname NOT LIKE 'mv\_%' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anonymous, authenticated', t.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname NOT LIKE 'mv\_%' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anonymous, authenticated', t.relname);
  END LOOP;
END $$;
-- Tabelas novas criadas pelo dono não nascem abertas para a API (as mv_* dão só o acesso que precisam).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anonymous, authenticated;
