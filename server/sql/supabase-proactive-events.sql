-- Optional demo source for the Supabase connector. Keep production secrets and
-- personal data out of this table; the broker intentionally returns five fields.
create table if not exists public.proactive_events (
  id text primary key,
  service text not null,
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  summary text not null,
  occurred_at timestamptz not null default now()
);

insert into public.proactive_events (id, service, severity, summary, occurred_at)
values
  ('evt_demo_001', 'checkout', 'error', 'Checkout 5xx rate crossed the demo threshold.', now() - interval '4 minutes'),
  ('evt_demo_002', 'payments', 'warning', 'Payment latency increased after release R42.', now() - interval '7 minutes'),
  ('evt_demo_003', 'checkout', 'info', 'Release R42 reached all checkout instances.', now() - interval '12 minutes')
on conflict (id) do nothing;
