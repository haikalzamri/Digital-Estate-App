# Supabase Setup

This folder contains the database setup scripts for the Digital Estate App.

## Step 1: Confirm Vercel Environment Variables

In Vercel, open the project settings and confirm the Supabase integration has added:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

The PMV and Work Program API routes use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server side only.

Do not expose or paste `SUPABASE_SERVICE_ROLE_KEY` into frontend JavaScript.

## Step 2: Create PMV Table

Open Supabase SQL Editor and run:

```text
supabase/001_pmv_records.sql
```

This creates `public.pmv_records`, indexes, an `updated_at` trigger, and enables Row Level Security.

## Step 3: Seed Historical PMV Records

After the table exists, open Supabase SQL Editor and run:

```text
supabase/002_seed_pmv_historical_records.sql
```

This imports the Excel-derived historical PMV records into `public.pmv_records`.

Expected result:

```text
historical_pmv_records = 514
```

The seed script is idempotent and upserts by `id`, so it can be rerun if needed.

## Step 4: Create Work Program Table

Open Supabase SQL Editor and run:

```text
supabase/003_work_program_records.sql
```

This creates `public.work_program_records`, indexes, an `updated_at` trigger, and enables Row Level Security.

## Step 5: Seed Work Program Records

After the table exists, open Supabase SQL Editor and run:

```text
supabase/004_seed_work_program_records.sql
```

This imports the Excel-derived baseline Work Program records into `public.work_program_records`.

Expected result:

```text
work_program_seed_records = 78
```

The seed script is idempotent and upserts by `id`, so it can be rerun if needed.

## Step 6: Deploy

Push the code to GitHub so Vercel redeploys.

The browser app will then call:

```text
/api/pmv-records
/api/work-program-records
```

The Vercel API routes will read/write PMV and Work Program records in Supabase.

## Step 7: Validation

After deployment:

1. Open the production app.
2. Submit one PMV Tracker record and confirm it appears in `pmv_records`.
3. Submit one Work Program record and confirm it appears in `work_program_records`.
4. Delete one Work Program test record from the web and confirm it is deleted in Supabase.
5. Refresh the production app and confirm dashboards still load from Supabase.

Useful SQL checks:

```sql
select count(*) as total_records from public.pmv_records;
select count(*) as historical_pmv_records from public.pmv_records where source = 'Excel PMV historical';
select count(*) as total_work_program_records from public.work_program_records;
select count(*) as work_program_seed_records from public.work_program_records where source = 'Excel Main actual';
```

## Current Supabase Behaviour

- Supabase is the PMV source of truth when `/api/pmv-records` is available.
- Supabase is the Work Program source of truth when `/api/work-program-records` is available.
- New PMV and Work Program submissions are saved to Supabase through Vercel API routes.
- Work Program approve/delete actions update Supabase.
- Browser localStorage is only a temporary fallback if the API is unavailable.
- `pmv-data.js` and `work-program-data.js` remain as source/reference backups for now.

## Next Phase

- Add authentication and manager/driver permissions.
- Consider Supabase Realtime if live cross-user updates are required without refresh.
