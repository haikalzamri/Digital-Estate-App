# Digital Estate App

Digital Estate operational tracking prototype for Work Program and PMV reporting. The app is currently a static browser-based MVP designed for field capture, approval review, dashboard monitoring, GIS map visualisation, and CSV export.

## Main Features

- Work Program Tracker for field-level programme completion capture.
- Records tab for review, approval, monthly field tracking, and map output.
- Work Program Dashboard with table and GIS map views.
- PMV Tracker for driver daily machine status submission.
- PMV Dashboard for machine readiness, breakdown/idle visibility, repeat issue tracking, action queue, and export.
- Leaflet/OpenStreetMap map view with KMZ-derived field polygons.

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html` | App layout and script loading order. |
| `styles.css` | Shared styling for Work Program, PMV, dashboard, records, and mobile views. |
| `app.js` | Shared app shell, navigation, state handling, localStorage, and common utilities. |
| `work-program-data.js` | Static Work Program seed/template data. |
| `work-program.js` | Work Program dashboard, records, map, monthly tracking, and Program Tracker logic. |
| `pmv-data.js` | Historical PMV Excel-imported records. |
| `pmv.js` | PMV Tracker, PMV Dashboard, popup, and export logic. |
| `supabase-api.js` | Browser adapter that calls Vercel API routes. |
| `api/pmv-records.js` | Vercel serverless API route for PMV Supabase read/write. |
| `api/work-program-records.js` | Vercel serverless API route for Work Program Supabase read/write. |
| `supabase/` | Supabase SQL setup scripts and setup guide. |
| `field-map-data.js` | KMZ/GIS-derived field boundary data. |

## Data Storage

- PMV production data is stored in Supabase table `public.pmv_records`.
- Historical PMV Excel data was seeded into Supabase using `supabase/002_seed_pmv_historical_records.sql`.
- Work Program production data is stored in Supabase table `public.work_program_records`.
- Work Program baseline data was seeded into Supabase using `supabase/004_seed_work_program_records.sql`.
- `pmv-data.js` and `work-program-data.js` remain in the repository as source/reference backups for now.
- Field boundary data is stored in `field-map-data.js`.
- Browser localStorage remains available as a temporary offline fallback under:

```text
sdg-work-program-tracker-v1
```

Current Supabase behaviour:

- PMV uses Supabase as the source of truth when `/api/pmv-records` responds successfully.
- Work Program uses Supabase as the source of truth when `/api/work-program-records` responds successfully.
- New PMV and Work Program submissions are saved to Supabase through Vercel API routes.
- If the browser is offline or the API is temporarily unavailable, new PMV and Work Program changes are queued in localStorage.
- Pending offline uploads and deletes automatically retry when the browser reconnects, or when the Sync button is used.
- Offline queue data stays on the same browser/device only and will be lost if the user clears site data.

Supabase setup and seed scripts are in `supabase/`.

## Running The App

Serve the project root with a static web server and open `index.html`.

Example from the Ubuntu Parallels VM:

```bash
cd /media/psf/Dropbox/digital-estate-app
python3 -m http.server 4177 --bind 0.0.0.0
```

Then open:

```text
http://10.211.55.3:4177/
```

## Environment Workflow

- Mac is the Dropbox sync and Git host layer.
- Ubuntu Parallels VM is the preferred validation environment.
- Vercel is the production-ready deployment environment.
- Do not store passwords, tokens, API keys, or secrets in this repository.

## Validation Checklist

- Confirm root-level files load in this order:
  `field-map-data.js`, `work-program-data.js`, `pmv-data.js`, `supabase-api.js`, `work-program.js`, `pmv.js`, `app.js`.
- Confirm Work Program Dashboard renders.
- Confirm Records monthly tracking and map output render.
- Confirm PMV Dashboard renders.
- Confirm PMV summary popups list machine and reporter names.
- Confirm an offline test submission queues locally, then syncs to Supabase when the browser reconnects.
- Confirm browser console has no errors.
