# Supabase Setup

This folder contains the database setup scripts for the Digital Estate App.

## Step 1: Confirm Vercel Environment Variables

In Vercel, open the project settings and confirm the Supabase integration has added:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

The current PMV API route uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server side only.

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

## Step 4: Deploy

Push the code to GitHub so Vercel redeploys.

The browser app will then call:

```text
/api/pmv-records
```

The Vercel API route will read/write PMV records in Supabase.

## Step 5: Validation

After deployment:

1. Open the production app.
2. Submit one PMV Tracker record.
3. Confirm it appears in Supabase table `pmv_records`.
4. Confirm PMV Dashboard updates after refresh.

Useful SQL checks:

```sql
select count(*) as total_records from public.pmv_records;
select count(*) as historical_pmv_records from public.pmv_records where source = 'Excel PMV historical';
```

## Current PMV Behaviour

- Supabase is the PMV source of truth when the API is available.
- New PMV submissions are saved to Supabase through `/api/pmv-records`.
- Browser localStorage is only a temporary fallback if the API is unavailable.
- Historical PMV data remains in `pmv-data.js` as a source/reference backup for now.

## Next Phase

- Add Work Program Supabase tables and API routes.
- Add authentication and manager/driver permissions.
