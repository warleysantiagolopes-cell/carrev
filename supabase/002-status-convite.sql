begin;

create or replace function public.carrev_convite_pendente(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.carrev_convites c
      join public.carrev_garagens g on g.id = c.garagem_id
      where c.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'))
        and c.aceito_em is null
        and not c.revogado
        and c.expira_em > now()
        and g.dono <> (select auth.uid())
    );
$$;

revoke all on function public.carrev_convite_pendente(text) from public, anon, authenticated;
grant execute on function public.carrev_convite_pendente(text) to authenticated;

commit;
