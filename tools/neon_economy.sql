-- ===========================================================================
-- Economia viva do modo Neon: Tesouro Imperial, ordens de compra e histórico de preços.
-- Roda depois de neon_setup.sql (usa mv_saves, mv_listings, mv_mail e mv_econ).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- BANCO KOGANE (banco central de Tsukimori)
-- A cada 20 minutos (sob demanda) fotografa a economia. Cálculo (versão 2):
--  · cada jogador ativo (7 dias) tem uma "reserva saudável" = 6 horas da PRÓPRIA renda média
--    (ouro ganho na vida ÷ horas jogadas); a razão dele é ouro no bolso ÷ reserva saudável;
--  · o índice é a MEDIANA dessas razões (um jogador muito rico não distorce a comunidade)
--    e é suavizado (70% anterior + 30% nova medição) para o gráfico e os ajustes não darem tranco;
--  · acima de 1 (inflação) a torneira de ouro fecha até 3% por medição e preços/impostos sobem; abaixo, afrouxa.
-- Medições da versão 1 (média simples, meta pelo nível) ficam guardadas, mas saem do gráfico.
-- ---------------------------------------------------------------------------
ALTER TABLE public.mv_econ ADD COLUMN IF NOT EXISTS raw_idx numeric;
ALTER TABLE public.mv_econ ADD COLUMN IF NOT EXISTS income numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mv_econ ADD COLUMN IF NOT EXISTS calc integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.mv_econ_refresh() RETURNS public.mv_econ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last public.mv_econ; snap public.mv_econ; pl integer; mon numeric; med_gold numeric; lvl numeric; inc numeric; raw numeric; ix numeric; f numeric; vol numeric; trd integer;
BEGIN
  SELECT * INTO last FROM public.mv_econ WHERE calc = 2 ORDER BY id DESC LIMIT 1;
  IF last.id IS NOT NULL AND last.taken_at > now() - interval '20 minutes' THEN RETURN last; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('mv_econ_refresh')) THEN RETURN last; END IF;
  WITH p AS (
    SELECT greatest(0, coalesce((data->'player'->>'gold')::numeric, 0)) AS gold,
           greatest(1, coalesce((data->'player'->>'level')::numeric, 1)) AS plv,
           -- renda por hora de jogo; mínimo de 1 h para contas novas e piso de 2.000/h
           greatest(2000, coalesce((data->'stats'->>'goldEarned')::numeric, 0) / greatest(1, coalesce((data->>'totalPlaySeconds')::numeric, 0) / 3600)) AS inc_h
    FROM public.mv_saves WHERE updated_at > now() - interval '7 days'
  )
  SELECT count(*), coalesce(sum(p.gold), 0), coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.gold), 0), coalesce(avg(plv), 1),
         coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY inc_h), 2000), coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.gold / (6 * inc_h)), 1)
    INTO pl, mon, med_gold, lvl, inc, raw FROM p;
  mon := mon + coalesce((SELECT sum(bank) FROM public.mv_guilds), 0)
             + coalesce((SELECT sum((payload->>'amount')::numeric) FROM public.mv_mail WHERE kind = 'gold'), 0)
             + coalesce((SELECT sum(qty_left * price_each) FROM public.mv_orders WHERE status = 'open'), 0);
  IF pl = 0 THEN raw := 1; END IF;
  raw := least(20, greatest(0.01, raw));
  ix := CASE WHEN last.id IS NULL THEN raw ELSE 0.7 * last.idx + 0.3 * raw END;
  -- Ajuste proporcional ao log do índice (dobrar e cair pela metade pesam igual), no máximo 3% por medição.
  f := least(1.15, greatest(0.6, coalesce(last.faucet, 1) * (1 - 0.03 * least(1, greatest(-1, ln(ix) / ln(2))))));
  SELECT coalesce(sum(price), 0), count(*) INTO vol, trd FROM public.mv_listings WHERE status = 'sold' AND closed_at > now() - interval '1 day';
  INSERT INTO public.mv_econ (players, money, per_player, avg_level, target, idx, raw_idx, income, calc, faucet, price, tax_bps, volume24, trades24)
    VALUES (pl, mon, med_gold, lvl, 6 * inc, round(ix, 4), round(raw, 4), round(inc), 2, round(f, 4),
      round(least(1.6, greatest(1, 1 + greatest(0, ix - 1) * 0.15)), 4), least(1200, greatest(500, 500 + round(greatest(0, ix - 1) * 250)))::integer, vol, trd)
    RETURNING * INTO snap;
  DELETE FROM public.mv_econ WHERE taken_at < now() - interval '30 days';
  RETURN snap;
END $$;

-- Painel público do Banco: índice, ajustes vigentes, histórico e cotações (vendas, anúncios e ordens).
CREATE OR REPLACE FUNCTION public.mv_economy() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.mv_econ; d24 public.mv_econ;
BEGIN
  e := public.mv_econ_refresh();
  SELECT * INTO d24 FROM public.mv_econ WHERE calc = 2 AND taken_at <= now() - interval '20 hours' ORDER BY id DESC LIMIT 1;
  RETURN jsonb_build_object(
    'at', e.taken_at, 'players', e.players, 'money', round(e.money), 'perPlayer', round(e.per_player), 'target', round(e.target), 'income', round(e.income), 'avgLevel', round(e.avg_level, 1),
    'index', e.idx, 'rawIndex', e.raw_idx, 'faucet', e.faucet, 'price', e.price, 'taxBps', e.tax_bps, 'volume24', round(e.volume24), 'trades24', e.trades24,
    'growth24', CASE WHEN d24.id IS NULL OR d24.per_player = 0 THEN NULL ELSE round((e.per_player / d24.per_player - 1) * 100, 1) END,
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('at', h.taken_at, 'index', h.idx, 'raw', h.raw_idx, 'faucet', h.faucet, 'price', h.price, 'perPlayer', round(h.per_player), 'target', round(h.target)) ORDER BY h.id), '[]'::jsonb)
                FROM (SELECT * FROM public.mv_econ WHERE calc = 2 ORDER BY id DESC LIMIT 144) h),
    'prices', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
      SELECT item_key AS k, jsonb_build_object('median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price / greatest(1, coalesce((payload->>'qty')::numeric, 1)))), 'n', count(*)) AS v
      FROM public.mv_listings WHERE status = 'sold' AND closed_at > now() - interval '7 days' GROUP BY item_key ORDER BY count(*) DESC LIMIT 60) p),
    'asks', (SELECT coalesce(jsonb_object_agg(item_key, lo), '{}'::jsonb) FROM (
      SELECT item_key, round(min(price / greatest(1, coalesce((payload->>'qty')::numeric, 1)))) AS lo FROM public.mv_listings WHERE status = 'open' GROUP BY item_key) a),
    'bids', (SELECT coalesce(jsonb_object_agg(item_key, hi), '{}'::jsonb) FROM (
      SELECT item_key, max(price_each) AS hi FROM public.mv_orders WHERE status = 'open' AND qty_left > 0 GROUP BY item_key) o),
    'rarity', (SELECT coalesce(jsonb_object_agg(rarity, jsonb_build_object('median', med, 'n', n)), '{}'::jsonb) FROM (
      SELECT rarity, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price)) AS med, count(*) AS n FROM public.mv_listings WHERE kind = 'item' AND status = 'sold' AND closed_at > now() - interval '7 days' AND rarity <> '' GROUP BY rarity) r),
    'rarityAsk', (SELECT coalesce(jsonb_object_agg(rarity, lo), '{}'::jsonb) FROM (
      SELECT rarity, min(price) AS lo FROM public.mv_listings WHERE kind = 'item' AND status = 'open' AND rarity <> '' GROUP BY rarity) r),
    'orders', (SELECT count(*) FROM public.mv_orders WHERE status = 'open'), 'listings', (SELECT count(*) FROM public.mv_listings WHERE status = 'open'));
END $$;

-- Histórico diário (14 dias) de um item: mediana, mínimo, máximo e volume.
CREATE OR REPLACE FUNCTION public.mv_price_history(p_key text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'median', med, 'min', lo, 'max', hi, 'n', n) ORDER BY d), '[]'::jsonb) FROM (
    SELECT (closed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price / greatest(1, coalesce((payload->>'qty')::numeric, 1)))) AS med,
      min(price / greatest(1, coalesce((payload->>'qty')::numeric, 1))) AS lo, max(price / greatest(1, coalesce((payload->>'qty')::numeric, 1))) AS hi, count(*) AS n
    FROM public.mv_listings WHERE item_key = p_key AND status = 'sold' AND closed_at > now() - interval '14 days' GROUP BY 1) s $$;

-- ---------------------------------------------------------------------------
-- ORDENS DE COMPRA (materiais e cartas): o comprador deixa o ouro reservado no banco;
-- qualquer vendedor atende na hora. Cancelar devolve o ouro restante pelo correio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mv_orders (
  id          bigserial PRIMARY KEY,
  buyer       text NOT NULL,
  buyer_name  text NOT NULL DEFAULT 'Viajante',
  kind        text NOT NULL CHECK (kind IN ('mat', 'card')),
  item_key    text NOT NULL CHECK (length(item_key) <= 80),
  name        text NOT NULL CHECK (length(name) <= 80),
  payload     jsonb NOT NULL CHECK (pg_column_size(payload) < 2000),
  qty         integer NOT NULL CHECK (qty BETWEEN 1 AND 9999),
  qty_left    integer NOT NULL CHECK (qty_left >= 0),
  price_each  bigint NOT NULL CHECK (price_each BETWEEN 100 AND 1000000000),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS mv_orders_open_idx ON public.mv_orders (status, item_key, price_each DESC);
ALTER TABLE public.mv_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mv_orders FROM anonymous, authenticated;

CREATE OR REPLACE VIEW public.mv_orders_open AS
  SELECT id, md5(buyer) AS buyer_ref, buyer_name, kind, item_key, name, payload, qty, qty_left, price_each, created_at, (buyer = auth.user_id()) AS mine
  FROM public.mv_orders WHERE status = 'open' AND qty_left > 0;

-- Abre a ordem: o jogo já tirou o ouro (qty × preço) do save; ele fica reservado aqui.
CREATE OR REPLACE FUNCTION public.mv_order_place(p_kind text, p_key text, p_name text, p_payload jsonb, p_qty integer, p_price bigint, p_buyer_name text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); oid bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF (SELECT count(*) FROM public.mv_orders WHERE buyer = me AND status = 'open') >= 10 THEN RAISE EXCEPTION 'Limite de 10 ordens de compra abertas.'; END IF;
  INSERT INTO public.mv_orders (buyer, buyer_name, kind, item_key, name, payload, qty, qty_left, price_each)
    VALUES (me, left(coalesce(nullif(p_buyer_name, ''), 'Viajante'), 24), p_kind, left(p_key, 80), left(p_name, 80), p_payload, p_qty, p_qty, p_price) RETURNING id INTO oid;
  RETURN oid;
END $$;

-- Atende a ordem: a mercadoria vai para o correio do comprador e o ouro (menos o imposto vigente) para o vendedor.
CREATE OR REPLACE FUNCTION public.mv_order_fill(p_id bigint, p_qty integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); o public.mv_orders; gross bigint; tax bigint;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO o FROM public.mv_orders WHERE id = p_id AND status = 'open' FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Ordem indisponível.'; END IF;
  IF o.buyer = me THEN RAISE EXCEPTION 'Você não pode atender a própria ordem.'; END IF;
  IF p_qty IS NULL OR p_qty < 1 OR p_qty > o.qty_left THEN RAISE EXCEPTION 'Quantidade inválida (a ordem pede até %).', o.qty_left; END IF;
  gross := p_qty * o.price_each; tax := ceil(gross * public.mv_market_tax_bps() / 10000.0);
  UPDATE public.mv_orders SET qty_left = qty_left - p_qty, status = CASE WHEN qty_left - p_qty = 0 THEN 'filled' ELSE 'open' END, closed_at = CASE WHEN qty_left - p_qty = 0 THEN now() END WHERE id = o.id;
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (o.buyer, o.kind, o.payload || jsonb_build_object('qty', p_qty), 'Ordem atendida: ' || o.name || ' ×' || p_qty);
  INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (me, 'gold', jsonb_build_object('amount', gross - tax), 'Venda para ordem: ' || o.name || ' ×' || p_qty || ' (imposto ' || tax || ')');
  -- Registra como venda para o histórico de preços (preço total, quantidade no payload).
  INSERT INTO public.mv_listings (seller, seller_name, kind, item_key, name, payload, price, status, buyer, closed_at)
    VALUES (me, 'ordem', CASE WHEN o.kind = 'card' THEN 'card' ELSE 'mat' END, o.item_key, o.name, o.payload || jsonb_build_object('qty', p_qty), greatest(100, gross), 'sold', o.buyer, now());
  RETURN jsonb_build_object('gold', gross - tax, 'tax', tax, 'qty', p_qty);
END $$;

CREATE OR REPLACE FUNCTION public.mv_order_cancel(p_id bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.mv_orders;
BEGIN
  UPDATE public.mv_orders SET status = 'cancelled', closed_at = now() WHERE id = p_id AND buyer = auth.user_id() AND status = 'open' RETURNING * INTO o;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada.'; END IF;
  IF o.qty_left > 0 THEN INSERT INTO public.mv_mail (user_id, kind, payload, reason) VALUES (o.buyer, 'gold', jsonb_build_object('amount', o.qty_left * o.price_each), 'Ordem cancelada: ' || o.name); END IF;
  RETURN jsonb_build_object('refund', o.qty_left * o.price_each);
END $$;

REVOKE ALL ON public.mv_orders_open FROM anonymous, authenticated;
GRANT SELECT ON public.mv_orders_open TO authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['mv_economy()', 'mv_price_history(text)', 'mv_order_place(text, text, text, jsonb, integer, bigint, text)', 'mv_order_fill(bigint, integer)', 'mv_order_cancel(bigint)', 'mv_market_expire()', 'mv_market_tax_bps()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  EXECUTE 'REVOKE ALL ON FUNCTION public.mv_econ_refresh() FROM PUBLIC';
END $$;
