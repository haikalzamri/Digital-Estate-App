-- Add declared activity round for Work Program records.
-- Existing records are treated as Round 1.

alter table public.work_program_records
add column if not exists activity_round integer not null default 1
check (activity_round > 0);

create index if not exists work_program_records_activity_round_idx
on public.work_program_records (activity_round);
