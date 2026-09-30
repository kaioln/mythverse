-- ANTI-RMT (comércio por dinheiro real fora do jogo). Aplicado depois dos outros SQL do Neon.
-- O que os MMOs aprenderam (Lost Ark, FFXI, Albion) e a resposta de cada ponto aqui:
--   · pay-to-win e fraude com cartão/estorno ....... o jogo não vende ouro nem tem saque: não há dinheiro real na economia
--   · contas-mula de bots recebendo ouro ............ só troca quem tem conta nível 12 e 48 h de vida
--   · ouro entregue comprando lixo caríssimo ........ faixa de preço: 0,25× a 5× a mediana (sem histórico, teto por raridade)
--   · o mesmo pelo lado das ordens de compra ........ a mesma faixa vale para o preço de cada ordem
--   · item passado de mula em mula .................. item comprado só volta ao mercado depois de 72 h
--   · duas contas trocando ouro entre si ............ no máximo 3 compras por semana do mesmo vendedor
--   · conta roubada esvaziada em minutos ............ vendas acima de 2 milhões ficam 12 h no correio antes do resgate
--   · volume anormal ............................... vendedor com mais de 50 milhões em 7 dias vai para a auditoria
-- Tudo em gatilhos: vale para anúncio, compra, ordem de compra e atendimento de ordem, sem depender do cliente.

ALTER TABLE public.mv_saves ADD COLUMN IF NOT EXISTS created_at timestamptz;
-- Contas que já existiam não esperam 48 h.
UPDATE public.mv_saves SET created_at = now() - interval '30 days' WHERE created_at IS NULL;
ALTER TABLE public.mv_saves ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.mv_mail ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();

-- Quem pode negociar.
CREATE OR REPLACE FUNCTION public.mv_trade_gate(p_user text) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  SELECT account_level, created_at INTO s FROM public.mv_saves WHERE user_id = p_user;
  IF s IS NULL THEN RAISE EXCEPTION 'Jogue um pouco antes de negociar: o Mercado abre no nível 12 da conta.'; END IF;
  IF coalesce(s.account_level, 1) < 12 THEN RAISE EXCEPTION 'O Mercado de Jogadores abre no nível 12 da conta (você está no %).', s.account_level; END IF;
  IF s.created_at > now() - interval '48 hours' THEN RAISE EXCEPTION 'Contas novas negociam depois de 48 horas de jogo. Isso protege a economia contra bots.'; END IF;
END $$;

-- Teto por unidade quando a peça ainda não tem histórico de vendas.
CREATE OR REPLACE FUNCTION public.mv_price_cap(p_kind text, p_key text, p_rarity text, p_payload jsonb) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_kind = 'card' THEN 30000000
    WHEN p_kind = 'mat' THEN CASE WHEN p_key LIKE '%adam%' THEN 10000000 WHEN p_key LIKE '%ori%' THEN 2000000 WHEN p_key LIKE '%star%' THEN 200000 ELSE 50000 END
    ELSE (CASE coalesce(nullif(p_rarity, ''), p_payload->>'rarity') WHEN 'common' THEN 20000 WHEN 'rare' THEN 100000 WHEN 'epic' THEN 1000000
            WHEN 'legendary' THEN 10000000 WHEN 'mythic' THEN 30000000 WHEN 'set' THEN 30000000 ELSE 1000000 END)
         * (1 + power(coalesce((p_payload->>'plus')::numeric, 0), 2) * 0.2)
  END $$;

-- Faixa de preço (por unidade): com 3+ vendas, entre 0,25× e 5× a mediana das últimas 15; sem histórico, até o teto.
CREATE OR REPLACE FUNCTION public.mv_price_band(p_kind text, p_key text, p_rarity text, p_payload jsonb, p_unit numeric) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; med numeric; cap numeric;
BEGIN
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY u) INTO n, med FROM (
    SELECT price / greatest(1, coalesce((payload->>'qty')::numeric, 1)) u FROM public.mv_listings WHERE item_key = left(p_key, 80) AND status = 'sold' ORDER BY closed_at DESC LIMIT 15) s;
  IF n >= 3 THEN
    IF p_unit > med * 5 THEN RAISE EXCEPTION 'Preço acima do mercado: no máximo 5× a mediana (%).', round(med * 5); END IF;
    IF p_unit < med * 0.25 THEN RAISE EXCEPTION 'Preço abaixo do mercado: no mínimo 1/4 da mediana (%).', round(med * 0.25); END IF;
  ELSE
    cap := public.mv_price_cap(p_kind, p_key, p_rarity, p_payload);
    IF p_unit > cap THEN RAISE EXCEPTION 'Preço acima do teto desta peça enquanto ela não tem histórico de vendas (%).', round(cap); END IF;
  END IF;
END $$;

-- Anúncios e vendas.
CREATE OR REPLACE FUNCTION public.mv_listings_antirmt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qty numeric; wk numeric;
BEGIN
  qty := greatest(1, coalesce((NEW.payload->>'qty')::numeric, 1));
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    PERFORM public.mv_trade_gate(NEW.seller);
    PERFORM public.mv_price_band(NEW.kind, NEW.item_key, NEW.rarity, NEW.payload, NEW.price / qty);
    IF NEW.kind = 'item' AND coalesce(NEW.payload->>'uid', '') <> '' AND EXISTS (SELECT 1 FROM public.mv_listings WHERE buyer = NEW.seller AND status = 'sold'
         AND payload->>'uid' = NEW.payload->>'uid' AND closed_at > now() - interval '72 hours') THEN
      RAISE EXCEPTION 'Item comprado no Mercado só pode ser anunciado de novo depois de 72 horas.';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'sold' THEN          -- atendimento de ordem de compra
    PERFORM public.mv_trade_gate(NEW.seller);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'sold' AND OLD.status = 'open' THEN
    PERFORM public.mv_trade_gate(NEW.buyer);
    IF (SELECT count(*) FROM public.mv_listings WHERE buyer = NEW.buyer AND seller = NEW.seller AND status = 'sold' AND closed_at > now() - interval '7 days') >= 3 THEN
      RAISE EXCEPTION 'Limite de 3 compras por semana do mesmo vendedor.';
    END IF;
    SELECT coalesce(sum(price), 0) INTO wk FROM public.mv_listings WHERE seller = NEW.seller AND status = 'sold' AND closed_at > now() - interval '7 days';
    IF wk + NEW.price > 50000000 THEN INSERT INTO public.mv_audit (user_id, kind, detail) VALUES (NEW.seller, 'rmt_velocity', jsonb_build_object('week_gold', wk + NEW.price, 'buyer', md5(NEW.buyer), 'listing', NEW.id)); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mv_listings_antirmt ON public.mv_listings;
CREATE TRIGGER mv_listings_antirmt BEFORE INSERT OR UPDATE ON public.mv_listings FOR EACH ROW EXECUTE FUNCTION public.mv_listings_antirmt();

-- Ordens de compra: quem pede e a faixa de preço de cada unidade.
CREATE OR REPLACE FUNCTION public.mv_orders_antirmt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mv_trade_gate(NEW.buyer);
  PERFORM public.mv_price_band(NEW.kind, NEW.item_key, '', NEW.payload, NEW.price_each);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mv_orders_antirmt ON public.mv_orders;
CREATE TRIGGER mv_orders_antirmt BEFORE INSERT ON public.mv_orders FOR EACH ROW EXECUTE FUNCTION public.mv_orders_antirmt();

-- Vendas grandes ficam 12 h no correio (conta roubada não é esvaziada na hora; dá tempo de recuperar).
CREATE OR REPLACE FUNCTION public.mv_mail_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'gold' AND NEW.reason LIKE 'Venda%' AND coalesce((NEW.payload->>'amount')::numeric, 0) > 2000000 THEN
    NEW.available_at := now() + interval '12 hours';
    NEW.reason := NEW.reason || ' · disponível em 12 h';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mv_mail_hold ON public.mv_mail;
CREATE TRIGGER mv_mail_hold BEFORE INSERT ON public.mv_mail FOR EACH ROW EXECUTE FUNCTION public.mv_mail_hold();

CREATE OR REPLACE FUNCTION public.mv_mail_claim(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := auth.user_id(); m public.mv_mail; wait timestamptz;
BEGIN
  SELECT available_at INTO wait FROM public.mv_mail WHERE id = p_id AND user_id = me;
  IF wait > now() THEN RAISE EXCEPTION 'Venda grande: o ouro fica disponível às % (proteção contra contas roubadas).', to_char(wait AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI DD/MM'); END IF;
  DELETE FROM public.mv_mail WHERE id = p_id AND user_id = me AND available_at <= now() RETURNING * INTO m;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Nada para resgatar.'; END IF;
  RETURN jsonb_build_object('id', m.id, 'kind', m.kind, 'payload', m.payload);
END $$;
REVOKE ALL ON FUNCTION public.mv_mail_claim(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mv_mail_claim(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.mv_trade_gate(text), public.mv_price_band(text, text, text, jsonb, numeric) FROM PUBLIC;
