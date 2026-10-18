-- Email "pagamento confirmado": enviado uma única vez por compra (quem marca primeiro, envia).
alter table public.credit_purchases add column if not exists receipt_sent_at timestamptz;
