# Digital Estate App

Operational tracking application for estate field execution, PMV reporting, harvesting interval review, and prototype cost analysis.

Production: [https://digital-estate-app.vercel.app](https://digital-estate-app.vercel.app)

## Overview

Digital Estate App is a Next.js App Router application for plantation operation monitoring and field reporting. It supports management dashboards, user input forms, GIS map visualisation, offline submission queuing, and Supabase-backed operational records.

The current production modules are:

| Module | Audience | Route |
| --- | --- | --- |
| Work Program Monthly View and Daily View | Management | [`/management/work-program`](https://digital-estate-app.vercel.app/management/work-program) |
| Work Program Programme Plan | Management | [`/management/work-program/programmes`](https://digital-estate-app.vercel.app/management/work-program/programmes) |
| PMV Dashboard | Management | [`/management/pmv`](https://digital-estate-app.vercel.app/management/pmv) |
| Pre-Plan prototype | Management | [`/management/pre-plan`](https://digital-estate-app.vercel.app/management/pre-plan) |
| Harvesting Interval | Management | [`/management/harvesting-interval`](https://digital-estate-app.vercel.app/management/harvesting-interval) |
| Minamas Harvesting Interval prototype | Management | [`/management/minamas-harvesting-interval`](https://digital-estate-app.vercel.app/management/minamas-harvesting-interval) |
| Costbook prototype | Management | [`/management/costbook`](https://digital-estate-app.vercel.app/management/costbook) |
| Work Program Input | Field users | [`/input/work-program`](https://digital-estate-app.vercel.app/input/work-program) |
| PMV Input | Field users | [`/input/pmv`](https://digital-estate-app.vercel.app/input/pmv) |

The root route redirects to `/management/work-program`.

## Features

- Work Program completion capture by activity code, field, programme type, declared round, hectares, date, remarks, batch review, confirmation, and round coverage preview.
- Work Program management views with approval workflow, grouped Daily View records, monthly field tracking, monthly dashboard table/map monitoring, programme plan control, and CSV export.
- PMV daily machine status reporting for working, breakdown, and idle machines.
- PMV management dashboard for readiness, breakdown/idle visibility, repeat issue tracking, action queue, and export.
- Pre-Plan desktop prototype for next-day worker allocation: programme cards, field selection beside each worker, individual/group drag-and-drop, bulk field assignment, and browser-local draft saving and finalisation using fictional workers and activity codes.
- Harvesting Interval prototype with Harvesting Report and Field Status views, monthly production-vs-dispatch grid, metric filter, dispatch comparison, SEMUA activity overlays, field interval summary, map view, and CSV export.
- Separate Minamas Harvesting Interval prototype with a map-first dashboard, division filtering, fields-by-day report, expandable dispatch comparisons, estate/mill weight insights, daily trends, and CSV export.
- Costbook management prototype with required activity/month filters, multi-select EVIT filtering, collapsed daily summary rows, independent inline Labour/Supervision, Material and EVIT expansion rows, reconciled daily totals, month-to-date calculations, and CSV export.
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
| Styling | Global CSS and module-scoped CSS |
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
  costbook/
  harvesting-interval/
  minamas-harvesting-interval/
  maps/
  pmv/
  pre-plan/
  work-program/
lib/
  data/
  harvesting-interval/
  minamas-harvesting-interval/
  pmv/
  pre-plan/
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
| `scripts/` | Route smoke tests and targeted domain checks. |
| `supabase/` | Database setup and seed SQL scripts. |

## Data Model

### Production Source Of Truth

| Dataset | Source |
| --- | --- |
| Work Program records | Supabase table `public.work_program_records` |
| Work Program programme plans | Prototype browser-local plan state seeded from approved static defaults |
| PMV records | Supabase table `public.pmv_records` |
| Pre-Plan prototype | Fictional workers and activity codes with browser-local demo plans |
| Field boundaries | `public/data/field-map-data.geojson` |
| Harvesting Interval prototype | Static fallback data in `lib/data/harvesting-interval-source.json` |
| Minamas Harvesting Interval prototype | Independent static dataset in `lib/minamas-harvesting-interval/source.json` |
| Costbook prototype | Static dummy data in `lib/data/costbook-source.json` |

### Static Fallback Data

| File | Purpose |
| --- | --- |
| `lib/data/work-program-source.json` | Work Program historical fallback data. |
| `lib/data/pmv-source.json` | PMV historical fallback data. |
| `lib/pre-plan/dummy-workers.ts` | Fictional workers for the Pre-Plan prototype. |
| `lib/data/harvesting-interval-source.json` | Harvesting Interval prototype dataset. |
| `lib/minamas-harvesting-interval/source.json` | Aggregated Minamas production, dispatch, and weight data. |
| `lib/data/costbook-source.json` | Costbook prototype dummy activity, worker-level labour, supervision, material, and EVIT data. |

### Demo Data Handling

Static demo datasets and browser-served field map data may be masked or transformed before external hosting. Hosted demo values and map boundaries should not be treated as official operational records or actual company boundary data.

Pre-Plan is a workflow-review prototype with no SAP or Supabase integration. Its demo plans are saved only in the current browser; they are not shared between users or devices and can be lost if browser site data is cleared.

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
| `node scripts/check-pre-plan.mjs` | Check Pre-Plan allocation rules, finalisation, and saved-plan migration. |

## Supabase Setup

Database setup scripts are kept under `supabase/`.

| File | Purpose |
| --- | --- |
| `supabase/001_pmv_records.sql` | PMV table setup. |
| `supabase/002_seed_pmv_historical_records.sql` | PMV historical seed records. |
| `supabase/003_work_program_records.sql` | Work Program table setup. |
| `supabase/004_seed_work_program_records.sql` | Work Program seed records. |
| `supabase/005_add_work_program_activity_round.sql` | Work Program activity round migration for existing Supabase projects. |
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
- Work Program Programme Plan governance is currently a prototype UI/local-state control and is not yet backed by a production approval table.
- Pre-Plan uses fictional workers/activity codes and browser-local plans for desktop workflow review. It does not issue operational work assignments.
- Harvesting Interval is currently a static-data prototype and is not yet integrated with Supabase.
- Minamas Harvesting Interval is a separate static-data prototype with an illustrative map and no database integration.
- Costbook is currently a management-only static dummy-data prototype and is not yet connected to an approved source file.
- Rainfall data is shown as a placeholder until an approved rainfall source is integrated.

## License

Private project repository.
