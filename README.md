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
| `supabase/` | Supabase SQL setup scripts and setup guide. |
| `field-map-data.js` | KMZ/GIS-derived field boundary data. |

## Data Storage

- Historical PMV data is stored in `pmv-data.js`.
- Work Program seed/template data is stored in `work-program-data.js`.
- Field boundary data is stored in `field-map-data.js`.
- New browser submissions are stored in localStorage under:

```text
sdg-work-program-tracker-v1
```

Current PMV behaviour:

- If Vercel Supabase API is configured, PMV submissions are saved to Supabase through `/api/pmv-records`.
- If the API is unavailable, PMV submissions fall back to localStorage.
- Work Program submissions are still localStorage-backed until the next Supabase integration phase.

Supabase setup scripts are in `supabase/`.

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
- Confirm browser console has no errors.
