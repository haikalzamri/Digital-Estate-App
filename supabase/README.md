# Supabase Setup

This folder contains the database setup scripts for the Digital Estate App.

## Step 1: Confirm Vercel Environment Variables

In Vercel, open the project settings and confirm these server variables are configured for both **Preview** and **Production**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The PMV and Work Program Next.js Route Handlers use these variables on the server side only. The current application does not require `SUPABASE_ANON_KEY` in browser code.

Do not expose or paste `SUPABASE_SERVICE_ROLE_KEY` into frontend JavaScript.

After adding or changing an environment variable, redeploy the relevant Vercel environment. Preview and Production deployments do not automatically inherit variables added only to the other environment.

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

## Step 6: Deploy And Validate Preview

Push an approved development branch to GitHub and use its Vercel Preview deployment for acceptance testing.

The browser app will then call:

```text
/api/pmv-records
/api/work-program-records
```

The Next.js Route Handlers under `app/api/` will read and write PMV and Work Program records in Supabase.

## Step 7: Deploy Production

After Preview acceptance testing passes, merge or fast-forward the validated branch into `main`. Vercel will deploy the Production environment automatically.

Production modules:

- [Work Program Dashboard and Records](https://digital-estate-app.vercel.app/management/work-program)
- [PMV Dashboard](https://digital-estate-app.vercel.app/management/pmv)
- [Program Tracker](https://digital-estate-app.vercel.app/input/work-program)
- [PMV Tracker](https://digital-estate-app.vercel.app/input/pmv)

## Step 8: Production Validation

After deployment:

1. Open the production app.
2. Submit one PMV Tracker record and confirm it appears in `pmv_records`.
3. Submit one Work Program record and confirm it appears in `work_program_records`.
4. Delete one Work Program test record from the web and confirm it is deleted in Supabase.
5. Test offline queue behaviour:
   - Turn browser network offline.
   - Submit one PMV or Work Program test record.
   - Turn browser network online again.
   - Confirm the record syncs into the correct Supabase table.
6. Refresh the production app and confirm dashboards still load from Supabase.
7. Confirm both API endpoints return HTTP 200 without exposing any service-role credentials.

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
- Browser localStorage is a temporary offline queue if the browser is offline or the API is unavailable.
- Pending PMV and Work Program uploads/deletes automatically retry when the browser reconnects or the Sync button is used.
- Offline queue data is device/browser-specific and depends on the user not clearing site data.
- `pmv-data.js` and `work-program-data.js` remain as source/reference backups for now.

Production verification on 22 June 2026 returned 78 Work Program records and 514 PMV records.

## Next Phase

- Prioritise authentication and manager/driver permissions before broad production distribution. The service-role key is server-only, but the current API endpoints do not yet enforce user identity or role-based access.
- Consider Supabase Realtime if live cross-user updates are required without refresh.
