-- PMV Tracker table for Digital Estate App.
-- Run this in Supabase SQL Editor before enabling the Vercel API integration.

create table if not exists public.pmv_records (
  id text primary key,
  source text not null default 'PMV Tracker',
  original_id text,
  start_time timestamptz,
  completion_time timestamptz,
  email text,
  form_name text,
  last_modified_time timestamptz,
  reporter_name text not null,
  report_date date not null,
  machine_type text,
  machine_number text not null,
  machine_status text not null check (machine_status in ('working', 'breakdown', 'idle')),
  ips_battery text,
  checklist jsonb not null default '{}'::jsonb,
  damaged_components jsonb not null default '[]'::jsonb,
  idle_reason text,
  assistant_notes text,
  sync_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pmv_records_report_date_idx on public.pmv_records (report_date desc);
create index if not exists pmv_records_machine_number_idx on public.pmv_records (machine_number);
create index if not exists pmv_records_machine_status_idx on public.pmv_records (machine_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pmv_records_set_updated_at on public.pmv_records;
create trigger pmv_records_set_updated_at
before update on public.pmv_records
for each row
execute function public.set_updated_at();

alter table public.pmv_records enable row level security;

-- No public anon policies are added here.
-- The app writes through Vercel API routes using SUPABASE_SERVICE_ROLE_KEY server-side.
-- Add Supabase Auth and role-based policies later when manager/driver login is introduced.
