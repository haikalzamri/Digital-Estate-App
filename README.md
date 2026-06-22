# Digital Estate App

Digital Estate operational tracking application for Work Program and PMV reporting. The active application uses Next.js App Router and provides separate management and user-input routes for field capture, approval review, dashboard monitoring, GIS map visualisation, offline queuing, and CSV export.

Production: [https://digital-estate-app.vercel.app](https://digital-estate-app.vercel.app)

## Production Status

The functional Next.js application is deployed from `main` through Vercel. All four modules and both Supabase-backed API routes were production-verified on 22 June 2026. The legacy static app remains in the repository only as a parity and source-data reference.

| Audience | Module | Production link |
| --- | --- | --- |
| Management | Work Program Dashboard and Records | [Open module](https://digital-estate-app.vercel.app/management/work-program) |
| Management | PMV Dashboard | [Open module](https://digital-estate-app.vercel.app/management/pmv) |
| User input | Program Tracker | [Open module](https://digital-estate-app.vercel.app/input/work-program) |
| User input | PMV Tracker | [Open module](https://digital-estate-app.vercel.app/input/pmv) |

The root route redirects to `/management/work-program` for backward compatibility. The Configuration view is not included in the migration.

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
| `app/` | Next.js App Router pages, layouts, styles, and Supabase-backed Route Handlers. |
| `components/work-program/` | Work Program dashboard, records, editor, tracker, and shared data hook. |
| `components/pmv/` | PMV dashboard, tracker, and shared data hook. |
| `components/maps/` | Leaflet map components for field status and record pins. |
| `lib/server/` | Server-only Supabase REST utilities. |
| `lib/types/` | Shared TypeScript record contracts. |
| `lib/work-program/` | Work Program configuration and approved-record analytics. |
| `lib/pmv/` | PMV configuration, record normalisation, management analytics, and export helpers. |
| `lib/data/` | JSON extracted from the approved Work Program and PMV source files. |
| `public/data/` | Browser-served KMZ-derived field GeoJSON. |
| `scripts/` | Source extraction and route smoke-test scripts. |
| `package.json` | Next.js scripts, dependencies, and Node.js runtime requirement. |
| `index.html`, `app.js`, `work-program.js`, `pmv.js` | Legacy static parity reference; not the active Next.js runtime. |
| `work-program-data.js`, `pmv-data.js` | Original source/reference data used by extraction scripts. |
| `supabase/` | Supabase SQL setup scripts and setup guide. |
| `field-map-data.js` | Original KMZ/GIS-derived field boundary reference. |

## Data Storage

- PMV production data is stored in Supabase table `public.pmv_records`.
- Historical PMV Excel data was seeded into Supabase using `supabase/002_seed_pmv_historical_records.sql`.
- Work Program production data is stored in Supabase table `public.work_program_records`.
- Work Program baseline data was seeded into Supabase using `supabase/004_seed_work_program_records.sql`.
- `lib/data/pmv-source.json` and `lib/data/work-program-source.json` provide the Next.js historical fallback datasets.
- Field boundary data is served from `public/data/field-map-data.geojson`.
- Browser localStorage remains available as a device-specific offline queue under:

```text
dge-work-program-next-v1
dge-pmv-next-v1
sdg-work-program-tracker-v1 (legacy import compatibility)
```

Current Supabase behaviour:

- PMV uses Supabase as the source of truth when `/api/pmv-records` responds successfully.
- Work Program uses Supabase as the source of truth when `/api/work-program-records` responds successfully.
- New PMV and Work Program submissions are saved to Supabase through Vercel API routes.
- If the browser is offline or the API is temporarily unavailable, new PMV and Work Program changes are queued in localStorage.
- Pending offline uploads and deletes automatically retry when the browser reconnects, or when the Sync button is used.
- Offline queue data stays on the same browser/device only and will be lost if the user clears site data.

Supabase setup and seed scripts are in `supabase/`.

## Standard Development Pattern For New Modules

Use this pattern for future modules unless a different design is explicitly approved.

| Area | Standard |
| --- | --- |
| Production data | Supabase is the production source of truth. |
| Backend access | Browser code calls Next.js Route Handlers under `app/api/`; frontend code must not contain Supabase service keys or other secrets. |
| Offline behaviour | localStorage is used as a browser/device-specific offline queue for pending uploads and deletes. |
| Sync behaviour | Pending offline changes retry when the browser reconnects or when the Sync button is used. |
| Seed data | Excel/static JavaScript data files are source references or seed inputs, not the normal production data source after Supabase migration. |
| Validation | Development checks, runtime checks, and local servers should run in the Ubuntu Parallels VM. |
| Git/deployment | Keep validated changes local until the user explicitly instructs a push to `main`; Vercel then deploys Production automatically. |

Recommended module setup:

1. Create the Supabase table and indexes with an idempotent SQL script in `supabase/`.
2. Add any approved seed/import SQL script in `supabase/`.
3. Add a Next.js Route Handler under `app/api/` for list, upsert, and delete operations.
4. Add typed browser data-access methods and shared record contracts under `lib/` and the relevant module components.
5. Update the module logic to use Supabase through the Route Handler.
6. Add localStorage offline queue handling for failed uploads/deletes.
7. Update documentation, validate from the Ubuntu VM, report the result, and wait for an explicit GitHub push instruction.

## Running The App

### Production

Use the production links listed under [Production Status](#production-status). The production root redirects to the Work Program management module.

### Next.js Application

Run all setup and validation commands inside the Ubuntu Parallels VM:

```bash
cd /media/psf/Dropbox/digital-estate-app
node --version
npm install
npm run dev
```

Open the four modules:

```text
http://10.211.55.3:3000/management/work-program
http://10.211.55.3:3000/management/pmv
http://10.211.55.3:3000/input/work-program
http://10.211.55.3:3000/input/pmv
```

Required runtime:

```text
Node.js 24.x
npm 11.x
```

Validation commands:

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke
```

### Legacy Static Reference

The root-level static files are retained for parity and historical reference. They are not the active Vercel application.

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

Required Vercel server variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Default Back to Portal destinations:

| Module audience | Destination |
| --- | --- |
| Management modules | `https://palm-digital.vercel.app/hub/manager/` |
| User-input modules | `https://palm-digital.vercel.app/hub/worker` |

Optional Vercel variables can override these defaults without changing the code:

```text
NEXT_PUBLIC_MANAGEMENT_PORTAL_URL
NEXT_PUBLIC_INPUT_PORTAL_URL
```

Apply the two required Supabase variables to **Production** in Vercel. Also apply them to **Preview** only when a Preview deployment is specifically requested. Environment-variable changes require a new deployment before they become available to the application.

## Deployment Workflow

1. Make approved changes in the Dropbox-synced project and validate typecheck, lint, build, smoke tests, and key workflows inside the Ubuntu VM.
2. Report the completed local changes and validation results. Do not push to GitHub yet.
3. Wait until the user explicitly instructs a GitHub push.
4. Commit any uncommitted approved work and push the release to `main`.
5. Vercel automatically deploys Production from `main`; no manual Vercel deployment action is normally required.
6. Verify all four production routes and both API endpoints after deployment.
7. Use a development branch and Vercel Preview only when the user explicitly requests that workflow.

## Known Production Risk

- Supabase service-role credentials remain server-side and are not exposed to browser code.
- User authentication and role-based permissions are not yet implemented for the API endpoints.
- Authentication and manager/driver access control should be prioritised before distributing the modules broadly.

## Validation Checklist

- Confirm the four Next.js module routes load directly and after browser refresh.
- Confirm the root route redirects to `/management/work-program`.
- Confirm Next.js Route Handlers preserve `/api/pmv-records` and `/api/work-program-records`.
- Confirm `npm run typecheck`, `npm run lint`, and `npm run build` pass in the Ubuntu VM.
- Confirm mobile pages use full-width responsive layouts without the legacy sidebar.
- Confirm wide Work Program tables preserve readable sizing inside horizontal scroll containers.
- Confirm Program Tracker submission appears under Not approved, then reaches the approved dashboard after approval.
- Confirm Work Program interval `0` remains visible and maps to green.
- Confirm Records monthly tracking, exact decimals, totals, edit actions, filters, and map output work.
- Confirm PMV Working, Breakdown, and Idle submissions reach the PMV Dashboard.
- Confirm PMV metric popups list machine and reporter names.
- Confirm Work Program and PMV CSV exports preserve one record per data row.
- Confirm an offline test submission queues locally, then syncs to Supabase when the browser reconnects.
- Confirm browser console has no errors.

Last production API verification on 22 June 2026:

```text
/api/work-program-records: HTTP 200, 78 records
/api/pmv-records: HTTP 200, 514 records
```
