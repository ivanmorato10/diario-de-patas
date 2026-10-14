-- Remédios com frequência e aviso: repetição (diária, semanal, mensal, trimestral, anual) e a última dose dada.
alter table public.medications
  add column if not exists repeat text not null default '' check (repeat in ('', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  add column if not exists last_given date;
