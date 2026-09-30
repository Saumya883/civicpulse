create or replace function public.request_stats()
returns table(status text, total bigint)
language sql
security definer
set search_path = public
as $$
  select status, count(*) from citizen_requests group by status
$$;

revoke all on function public.request_stats() from public;
grant execute on function public.request_stats() to anon;