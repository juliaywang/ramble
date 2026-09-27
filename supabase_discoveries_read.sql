-- Run only if the browser cannot read the synced feed (permission error or empty feed).
-- Public NYC data is readable; syncing continues to use the Edge Function service role.
alter table public.discoveries enable row level security;
grant select on public.discoveries to anon, authenticated;
drop policy if exists "Read synced NYC discoveries" on public.discoveries;
create policy "Read synced NYC discoveries"
on public.discoveries for select to anon, authenticated
using (source in (
  'NYC Parks', 'NYC Public Art', 'NYC GreenThumb Gardens',
  'NYC Cultural Organizations', 'NYC Libraries', 'NYC Farmers Markets',
  'NYC Restaurants', 'NYC POPS'
));
