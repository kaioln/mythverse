-- Modo Neon (site só de arquivos): saves e ranking acessados pela Data API.
-- Pré-requisitos no Console do Neon: Neon Auth ativado e Data API ativada (ela instala auth.user_id()).
-- Pode rodar quantas vezes quiser: node tools/neon_setup.js

-- Um save por conta. user_id vem do JWT do Neon Auth (claim sub).
CREATE TABLE IF NOT EXISTS public.mv_saves (
  user_id       text PRIMARY KEY DEFAULT auth.user_id(),
  data          jsonb NOT NULL,
  revision      integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  display_name  text NOT NULL DEFAULT 'Viajante' CHECK (length(display_name) <= 24),
  power         bigint NOT NULL DEFAULT 0 CHECK (power >= 0),
  boss_kills    integer NOT NULL DEFAULT 0 CHECK (boss_kills >= 0),
  best_stage    integer NOT NULL DEFAULT 0 CHECK (best_stage >= 0),
  rift_best     integer NOT NULL DEFAULT 0 CHECK (rift_best >= 0),
  account_level integer NOT NULL DEFAULT 1 CHECK (account_level >= 1),
  team          jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT mv_saves_size CHECK (pg_column_size(data) < 3000000)
);
CREATE INDEX IF NOT EXISTS mv_saves_power_idx ON public.mv_saves (power DESC);

-- RLS: cada jogador lê, cria e atualiza só a própria linha. Sem DELETE pela API.
ALTER TABLE public.mv_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mv_saves_select ON public.mv_saves;
DROP POLICY IF EXISTS mv_saves_insert ON public.mv_saves;
DROP POLICY IF EXISTS mv_saves_update ON public.mv_saves;
CREATE POLICY mv_saves_select ON public.mv_saves FOR SELECT TO authenticated USING (user_id = auth.user_id());
CREATE POLICY mv_saves_insert ON public.mv_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.user_id());
CREATE POLICY mv_saves_update ON public.mv_saves FOR UPDATE TO authenticated USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());
REVOKE ALL ON public.mv_saves FROM anonymous, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mv_saves TO authenticated;

-- A revisão só pode subir de 1 em 1 (evita que um aparelho antigo sobrescreva um save mais novo).
CREATE OR REPLACE FUNCTION public.mv_saves_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.revision := 1;
  ELSIF NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'revisão inválida';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mv_saves_guard ON public.mv_saves;
CREATE TRIGGER mv_saves_guard BEFORE INSERT OR UPDATE ON public.mv_saves FOR EACH ROW EXECUTE FUNCTION public.mv_saves_guard();

-- Ranking público: só colunas de vitrine (nunca o save completo nem o id da conta).
CREATE OR REPLACE VIEW public.mv_ranking AS
  SELECT display_name, power, boss_kills, best_stage, rift_best, account_level, team, (user_id = auth.user_id()) AS me
  FROM public.mv_saves;
REVOKE ALL ON public.mv_ranking FROM anonymous, authenticated;
GRANT SELECT ON public.mv_ranking TO authenticated;
