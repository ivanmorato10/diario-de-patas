-- Horário da consulta (HH:MM, opcional), para consultas marcadas e o lembrete no calendário.
alter table public.visits add column if not exists time text not null default '' check (time = '' or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
