# Digital Estate App

Operational tracking application for estate field execution, PMV reporting, and harvesting interval review.

Production: [https://digital-estate-app.vercel.app](https://digital-estate-app.vercel.app)

## Overview

Digital Estate App is a Next.js App Router application for plantation operation monitoring and field reporting. It supports management dashboards, user input forms, GIS map visualisation, offline submission queuing, and Supabase-backed operational records.

The current production modules are:

| Module | Audience | Route |
| --- | --- | --- |
| Work Program Dashboard and Records | Management | [`/management/work-program`](https://digital-estate-app.vercel.app/management/work-program) |
| PMV Dashboard | Management | [`/management/pmv`](https://digital-estate-app.vercel.app/management/pmv) |
| Harvesting Interval | Management | [`/management/harvesting-interval`](https://digital-estate-app.vercel.app/management/harvesting-interval) |
| Work Program Input | Field users | [`/input/work-program`](https://digital-estate-app.vercel.app/input/work-program) |
| PMV Input | Field users | [`/input/pmv`](https://digital-estate-app.vercel.app/input/pmv) |

The root route redirects to `/management/work-program`.

## Features

- Work Program completion capture by field, programme type, hectares, date, remarks, GPS, and photo.
- Work Program management dashboard with approval workflow, records view, monthly tracking, GIS map output, and CSV export.
- PMV daily machine status reporting for working, breakdown, and idle machines.
- PMV management dashboard for readiness, breakdown/idle visibility, repeat issue tracking, action queue, and export.
- Harvesting Interval prototype with monthly grid, metric toggles, dispatch comparison, activity overlays, field interval summary, map view, and CSV export.
- Leaflet/OpenStreetMap field boundary map using KMZ-derived GeoJSON.
- Browser localStorage offline queue for pending Work Program and PMV uploads/deletes.
- Supabase-backed API routes for production Work Program and PMV records.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js App Router |
| UI | React, TypeScript |
| Maps | Leaflet, OpenStreetMap |
| Data API | Next.js Route Handlers |
| Database | Supabase |
| Styling | Global CSS under `app/globals.css` |
| Deployment | Vercel |
| Runtime | Node.js `>=24 <25`, npm 11.x |

## Project Structure

```text
app/
  api/
  input/
  management/
  globals.css
  layout.tsx
  page.tsx
components/
  harvesting-interval/
  maps/
  pmv/
  work-program/
lib/
  data/
  harvesting-interval/
  pmv/
  server/
  types/
  work-program/
public/
  data/
scripts/
supabase/
```

| Path | Purpose |
| --- | --- |
| `app/` | Next.js pages, layouts, styles, and API route handlers. |
| `components/` | Module UI, dashboards, trackers, maps, and shared shells. |
| `lib/` | Domain logic, static fallback data, shared types, and server utilities. |
| `public/data/` | Browser-served field boundary GeoJSON. |
| `scripts/` | Route smoke-test script. |
| `supabase/` | Database setup and seed SQL scripts. |

## Data Model

### Production Source Of Truth

| Dataset | Source |
| --- | --- |
| Work Program records | Supabase table `public.work_program_records` |
| PMV records | Supabase table `public.pmv_records` |
| Field boundaries | `public/data/field-map-data.geojson` |
| Harvesting Interval prototype | Static fallback data in `lib/data/harvesting-interval-source.json` |

### Static Fallback Data

| File | Purpose |
| --- | --- |
| `lib/data/work-program-source.json` | Work Program historical fallback data. |
| `lib/data/pmv-source.json` | PMV historical fallback data. |
| `lib/data/harvesting-interval-source.json` | Harvesting Interval prototype dataset. |

### Offline Behaviour

The browser uses localStorage as a device-specific offline queue:

```text
dge-work-program-next-v1
dge-pmv-next-v1
sdg-work-program-tracker-v1
```

Pending uploads/deletes retry when the browser reconnects or when the user triggers sync. Offline queue data is local to the browser/device and can be lost if site data is cleared.

## Getting Started

### Prerequisites

- Node.js 24.x
- npm 11.x
- Supabase project for production API usage

### Install

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Required server-side variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optional public portal overrides:

```text
NEXT_PUBLIC_MANAGEMENT_PORTAL_URL
NEXT_PUBLIC_INPUT_PORTAL_URL
```

Default portal destinations:

| Audience | Default destination |
| --- | --- |
| Management modules | `https://palm-digital.vercel.app/hub/manager/` |
| User-input modules | `https://palm-digital.vercel.app/hub/worker/` |

Do not commit passwords, tokens, API keys, service-role keys, or `.env` files.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the production application. |
| `npm run start` | Start the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run smoke` | Run route smoke checks against `APP_BASE_URL` or `http://127.0.0.1:3000`. |
| `npm run check` | Run typecheck, lint, and build. |

## Supabase Setup

Database setup scripts are kept under `supabase/`.

| File | Purpose |
| --- | --- |
| `supabase/001_pmv_records.sql` | PMV table setup. |
| `supabase/002_seed_pmv_historical_records.sql` | PMV historical seed records. |
| `supabase/003_work_program_records.sql` | Work Program table setup. |
| `supabase/004_seed_work_program_records.sql` | Work Program seed records. |
| `supabase/README.md` | Supabase setup guide. |

Frontend code must call Next.js API routes under `app/api/`; Supabase service-role access must remain server-side only.

## Deployment

Production is deployed by Vercel from the `main` branch.

Recommended release flow:

1. Make changes on a feature branch.
2. Run `npm run check`.
3. Start the app and run `npm run smoke`.
4. Merge or push to `main` after validation.
5. Confirm production routes after Vercel deployment.

## Production Risks And Gaps

- PMV and Work Program APIs use server-side Supabase service-role credentials.
- User authentication and role-based permissions are not yet implemented for API endpoints.
- Harvesting Interval is currently a static-data prototype and is not yet integrated with Supabase.
- Rainfall data is shown as a placeholder until an approved rainfall source is integrated.

## License

Private project repository.
