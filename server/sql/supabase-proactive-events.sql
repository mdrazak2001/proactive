-- Isolated demo source for the Supabase connector. Keep production secrets and
-- personal data out of this table. The Management API path uses the provider's
-- read-only role; the publishable-key fallback can read only occurred_at through
-- the anon role and RLS. Neither path should return event content to Proactive.
create table if not exists public.proactive_events (
  id text primary key,
  service text not null,
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  summary text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists proactive_events_occurred_at_idx
  on public.proactive_events (occurred_at desc);

alter table public.proactive_events enable row level security;
alter table public.proactive_events force row level security;

revoke all on table public.proactive_events from anon, authenticated, public;
grant select on table public.proactive_events to supabase_read_only_user;
grant usage on schema public to anon;
grant select (occurred_at) on table public.proactive_events to anon;

drop policy if exists proactive_events_read_only_select on public.proactive_events;
create policy proactive_events_read_only_select
  on public.proactive_events
  for select
  to supabase_read_only_user
  using (true);

drop policy if exists proactive_events_anon_timestamp_select on public.proactive_events;
create policy proactive_events_anon_timestamp_select
  on public.proactive_events
  for select
  to anon
  using (true);

insert into public.proactive_events (id, service, severity, summary, occurred_at)
values
  ('evt_demo_001', 'checkout', 'error', 'Checkout 5xx rate crossed the demo threshold.', now() - interval '4 minutes'),
  ('evt_demo_002', 'payments', 'warning', 'Payment latency increased after release R42.', now() - interval '7 minutes'),
  ('evt_demo_003', 'checkout', 'info', 'Release R42 reached all checkout instances.', now() - interval '12 minutes'),
  ('evt_demo_004', 'checkout', 'error', 'applyCoupon TypeError first seen after R42.', now() - interval '6 minutes'),
  ('evt_demo_005', 'payments', 'info', 'Stripe p95 stayed inside the prior 24-hour baseline.', now() - interval '5 minutes')
on conflict (id) do nothing;
