-- Work Program records table for Digital Estate App.
-- Run this in Supabase SQL Editor before enabling Work Program API integration.

create table if not exists public.work_program_records (
  id text primary key,
  source text not null default 'Work Program Tracker',
  reporter_name text not null,
  program_type text not null,
  block_field text not null,
  task_name text not null default 'Completion',
  scheduler_stage text not null default 'Completed',
  hectares numeric not null check (hectares > 0),
  actual_completion_date date not null,
  deadline date,
  priority text,
  approval_status text not null default 'Pending Approval' check (approval_status in ('Pending Approval', 'Approved')),
  remarks text,
  latitude numeric,
  longitude numeric,
  gps_accuracy text,
  photo_data text,
  sync_status text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_program_records_program_type_idx on public.work_program_records (program_type);
create index if not exists work_program_records_block_field_idx on public.work_program_records (block_field);
create index if not exists work_program_records_actual_completion_date_idx on public.work_program_records (actual_completion_date desc);
create index if not exists work_program_records_approval_status_idx on public.work_program_records (approval_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists work_program_records_set_updated_at on public.work_program_records;
create trigger work_program_records_set_updated_at
before update on public.work_program_records
for each row
execute function public.set_updated_at();

alter table public.work_program_records enable row level security;

-- No public anon policies are added here.
-- The app writes through Vercel API routes using SUPABASE_SERVICE_ROLE_KEY server-side.
-- Add Supabase Auth and role-based policies later when manager/driver login is introduced.
