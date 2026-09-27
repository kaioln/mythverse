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

-- ===========================================================================
-- Mercado de Jogadores (ouro) no modo Neon.
-- Anúncios e correio só mudam por funções atômicas (SECURITY DEFINER): um anúncio
-- só pode ser comprado uma vez, e o ouro da venda chega ao vendedor pelo correio.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.mv_listings (
  id          bigserial PRIMARY KEY,
  seller      text NOT NULL,
  seller_name text NOT NULL DEFAULT 'Viajante' CHECK (length(seller_name) <= 24),
  kind        text NOT NULL CHECK (kind IN ('item', 'card', 'mat')),
  item_key    text NOT NULL CHECK (length(item_key) <= 80),
  name        text NOT NULL CHECK (length(name) <= 80),
  rarity      text NOT NULL DEFAULT '',
  slot        text NOT NULL DEFAULT '',
  payload     jsonb NOT NULL CHECK (pg_column_size(payload) < 20000),
  price       bigint NOT NULL CHECK (price >= 100 AND price <= 1000000000000),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sold', 'cancelled')),
  buyer       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS mv_listings_open_idx ON public.mv_listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mv_listings_seller_idx ON public.mv_listings (seller, status);
CREATE INDEX IF NOT EXISTS mv_listings_key_idx ON public.mv_listings (item_key, status, closed_at DESC);
ALTER TABLE public.mv_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mv_listings FROM anonymous, authenticated;

CREATE TABLE IF NOT EXISTS public.mv_mail (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('gold', 'item', 'card', 'mat')),
  payload    jsonb NOT NULL,
  reason     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mv_mail_user_idx ON public.mv_mail (user_id);
ALTER TABLE public.mv_mail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mv_mail_select ON public.mv_mail;
CREATE POLICY mv_mail_select ON public.mv_mail FOR SELECT TO authenticated USING (user_id = auth.user_id());
REVOKE ALL ON public.mv_mail FROM anonymous, authenticated;
GRANT SELECT ON public.mv_mail TO authenticated;

-- Vitrine pública: nunca expõe o id da conta, só uma referência opaca do vendedor.
CREATE OR REPLACE VIEW public.mv_market AS
  SELECT id, md5(seller) AS seller_ref, seller_name, kind, item_key, name, rarity, slot, payload, price, created_at, (seller = auth.user_id()) AS mine
  FROM public.mv_listings WHERE status = 'open';
REVOKE ALL ON public.mv_market FROM anonymous, authenticated;
GRANT SELECT ON public.mv_market TO authenticated;
-- Histórico de preços (últimos 30 dias) para ajudar a precificar.
CREATE OR REPLACE VIEW public.mv_sales AS
  SELECT item_key, price, closed_at FROM public.mv_listings WHERE status = 'sold' AND closed_at > now() - interval '30 days';
REVOKE ALL ON public.mv_sales FROM anonymous, authenticated;
GRANT SELECT ON public.mv_sales TO authenticated;

-- Tesouro Imperial: cada fotografia da economia guarda os ajustes vigentes (ver tools/neon_economy.sql).
CREATE TABLE IF NOT EXISTS public.mv_econ (
  id         bigserial PRIMARY KEY,
  taken_at   timestamptz NOT NULL DEFAULT now(),
  players    integer NOT NULL DEFAULT 0,
  money      numeric NOT NULL DEFAULT 0,
  per_player numeric NOT NULL DEFAULT 0,
  avg_level  numeric NOT NULL DEFAULT 1,
  target     numeric NOT NULL DEFAULT 1,
  idx        numeric NOT NULL DEFAULT 1,
  faucet     numeric NOT NULL DEFAULT 1,
  price      numeric NOT NULL DEFAULT 1,
  tax_bps    integer NOT NULL DEFAULT 500,
  volume24   numeric NOT NULL DEFAULT 0,
  trades24   integer NOT NULL DEFAULT 0
);
ALTER TABLE public.mv_econ ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mv_econ FROM anonymous, authenticated;
-- Imposto de venda vigente (5% a 12%, sobe com a inflação).
CREATE OR REPLACE FUNCTION public.mv_market_tax_bps() RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN coalesce((SELECT tax_bps FROM public.mv_econ ORDER BY id DESC LIMIT 1), 500); END $$;

-- Anúncios com mais de 7 dias voltam ao correio do vendedor.
CREATE OR REPLACE FUNCTION public.mv_market_expire() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.mv_listings; n integer := 0;
BEGIN
  FOR l IN UPDATE public.mv_listings SET status = 'cancelled', closed_at = now() WHERE id IN (SELECT id FROM public.mv_listings WHERE status = 'open' AND created_at < now() - interval '7 days' LIMIT 200) RETURNING * LOOP
    INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (l.seller, l.kind, l.payload, 'Anúncio expirou (7 dias): ' || l.name);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.mv_market_list(p_kind text, p_key text, p_name text, p_rarity text, p_slot text, p_payload jsonb, p_price bigint, p_seller_name text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); new_id bigint; med numeric; n integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  PERFORM public.mv_market_expire();
  IF (SELECT count(*) FROM public.mv_listings WHERE seller = me AND status = 'open') >= 20 THEN RAISE EXCEPTION 'Limite de 20 anúncios abertos.'; END IF;
  IF (SELECT count(*) FROM public.mv_listings WHERE seller = me AND seller_name <> 'ordem' AND created_at > now() - interval '1 day') >= 60 THEN RAISE EXCEPTION 'Limite de 60 anúncios por dia.'; END IF;
  -- Contra manipulação: com histórico de vendas, o preço não pode passar de 15× a mediana.
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY price) INTO n, med FROM (SELECT price FROM public.mv_listings WHERE item_key = left(p_key, 80) AND status = 'sold' ORDER BY closed_at DESC LIMIT 15) s;
  IF n >= 3 AND p_price > med * 15 THEN RAISE EXCEPTION 'Preço muito acima do mercado (mediana %, teto %).', round(med), round(med * 15); END IF;
  INSERT INTO public.mv_listings (seller, seller_name, kind, item_key, name, rarity, slot, payload, price)
    VALUES (me, left(coalesce(nullif(p_seller_name, ''), 'Viajante'), 24), p_kind, left(p_key, 80), left(p_name, 80), left(coalesce(p_rarity, ''), 16), left(coalesce(p_slot, ''), 16), p_payload, p_price)
    RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Compra: fecha o anúncio só se ainda estiver aberto; a mercadoria vai para o correio do comprador
-- e o ouro (menos 5% de imposto) para o correio do vendedor.
CREATE OR REPLACE FUNCTION public.mv_market_buy(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); l public.mv_listings; tax bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  UPDATE public.mv_listings SET status = 'sold', buyer = me, closed_at = now()
    WHERE id = p_id AND status = 'open' AND seller <> me RETURNING * INTO l;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Anúncio indisponível (já vendido, cancelado ou é seu).'; END IF;
  -- Contra lavagem entre contas amigas: no máximo 5 compras por dia do mesmo vendedor.
  IF (SELECT count(*) FROM public.mv_listings WHERE buyer = me AND seller = l.seller AND status = 'sold' AND closed_at > now() - interval '1 day') > 5 THEN RAISE EXCEPTION 'Limite de 5 compras por dia do mesmo vendedor.'; END IF;
  tax := ceil(l.price * public.mv_market_tax_bps() / 10000.0);
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (me, l.kind, l.payload, 'Compra: ' || l.name);
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (l.seller, 'gold', jsonb_build_object('amount', l.price - tax, 'name', l.name), 'Venda: ' || l.name || ' (imposto ' || tax || ')');
  RETURN jsonb_build_object('id', l.id, 'price', l.price, 'kind', l.kind, 'name', l.name);
END $$;

CREATE OR REPLACE FUNCTION public.mv_market_cancel(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); l public.mv_listings;
BEGIN
  UPDATE public.mv_listings SET status = 'cancelled', closed_at = now() WHERE id = p_id AND status = 'open' AND seller = me RETURNING * INTO l;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Anúncio não encontrado.'; END IF;
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (me, l.kind, l.payload, 'Anúncio cancelado: ' || l.name);
  RETURN jsonb_build_object('id', l.id);
END $$;

-- Resgate do correio: apaga e devolve numa única operação (não resgata duas vezes).
CREATE OR REPLACE FUNCTION public.mv_mail_claim(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); m public.mv_mail;
BEGIN
  DELETE FROM public.mv_mail WHERE id = p_id AND user_id = me RETURNING * INTO m;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Nada para resgatar.'; END IF;
  RETURN jsonb_build_object('id', m.id, 'kind', m.kind, 'payload', m.payload);
END $$;

REVOKE ALL ON FUNCTION public.mv_market_list(text, text, text, text, text, jsonb, bigint, text), public.mv_market_buy(bigint), public.mv_market_cancel(bigint), public.mv_mail_claim(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mv_market_list(text, text, text, text, text, jsonb, bigint, text), public.mv_market_buy(bigint), public.mv_market_cancel(bigint), public.mv_mail_claim(bigint) TO authenticated;
