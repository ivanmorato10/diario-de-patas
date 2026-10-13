-- Desempenho das políticas (db advisors: auth_rls_initplan): auth.uid() vira (select auth.uid()),
-- avaliado uma vez por consulta em vez de uma vez por linha. A regra de acesso não muda.
do $$
declare p record; q text; c text; stmt text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := replace(p.qual, 'auth.uid()', '(select auth.uid())');
    c := replace(p.with_check, 'auth.uid()', '(select auth.uid())');
    if q is distinct from p.qual or c is distinct from p.with_check then
      stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if p.qual is not null then stmt := stmt || format(' using (%s)', q); end if;
      if p.with_check is not null then stmt := stmt || format(' with check (%s)', c); end if;
      execute stmt;
    end if;
  end loop;
end $$;
