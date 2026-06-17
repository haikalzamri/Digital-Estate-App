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

## Step 3: Deploy

Push the code to GitHub so Vercel redeploys.

The browser app will then call:

```text
/api/pmv-records
```

The Vercel API route will read/write PMV records in Supabase.

## Step 4: Validation

After deployment:

1. Open the production app.
2. Submit one PMV Tracker record.
3. Confirm it appears in Supabase table `pmv_records`.
4. Confirm PMV Dashboard updates after refresh.

## Current MVP Behaviour

- If Supabase API is available, PMV submissions are saved to Supabase.
- If Supabase API is unavailable, the app falls back to localStorage.
- Historical PMV data remains in `pmv-data.js` until a formal migration/seed step is run.

## Next Phase

- Add a one-time PMV historical seed process.
- Add Work Program Supabase tables and API routes.
- Add authentication and manager/driver permissions.
