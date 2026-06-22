# AGENTS.md

## Purpose

This project uses a VM-first development and validation workflow. The Mac is the host machine and Dropbox sync location. Development commands, package installation, runtime checks, validation, and local servers should run inside the Ubuntu Parallels VM. Vercel is the production-ready deployment environment.

## Project Context

- Project root on Mac: `/Users/haikalzamri/Library/CloudStorage/Dropbox/digital-estate-app`
- Shared storage model: project files are stored in Dropbox and synced between environments.
- Development environment: Ubuntu 24.04.3 ARM64 running in Parallels.
- VM SSH target: `parallels@10.211.55.3`
- Required Node.js runtime: Node.js 24 LTS (`>=24 <25`)
- Production URL: `https://digital-estate-app.vercel.app`
- Do not store passwords, tokens, API keys, or secrets in this repository.

## Framework Baseline

- The `main` branch contains the production Next.js App Router baseline.
- All four target module routes are migrated and share typed domain data layers.
- The root-level static files remain a parity and source-data reference.
- Do not delete the legacy static files without explicit approval.
- Target module routes:
  - `/management/work-program`
  - `/management/pmv`
  - `/input/work-program`
  - `/input/pmv`
- The Configuration view is retired and should not be migrated.
- Module pages do not include the legacy green sidebar. They use the shared module header and Back to Portal control.

## Environment Roles

| Environment | Role | Usage |
| --- | --- | --- |
| Mac local | Host and sync layer | Store Dropbox-synced files, review files, manage Git when needed, and open production or local URLs for review. |
| Parallels Ubuntu VM | Development and validation environment | Run dev servers, install dependencies, execute checks, test changes, and validate app behavior before Git push or production review. |
| Vercel | Production-ready environment | Serve the live app from GitHub deployment for business and user-facing review. |

## Core Workflow

1. Treat the Mac environment as a host and file-sync layer only.
2. Do not install development dependencies on macOS unless explicitly approved.
3. Do not run application tooling on macOS unless explicitly approved.
4. Run development and validation commands inside the Ubuntu VM.
5. Keep project source files in the Dropbox-synced project folder.
6. Verify that Dropbox sync is complete before assuming file changes are available in both environments.
7. Validate changes in the Ubuntu VM before pushing to GitHub.
8. Keep validated changes local until the user explicitly instructs a GitHub push.
9. Treat Vercel as the production-ready environment after deployment.

## Standard Development Pattern For New Modules

Apply this pattern to future modules unless the user explicitly approves a different approach:

- Supabase is the production source of truth after a module is integrated.
- Frontend code must call Next.js Route Handlers under `app/api/`; never expose Supabase service-role keys, passwords, tokens, or other secrets in browser code.
- Use localStorage only as a browser/device-specific offline queue for pending uploads and deletes.
- Pending offline changes should retry when the browser reconnects and when the user uses the Sync button.
- Excel/static JavaScript data files may remain as source references or seed inputs, but should not be the normal production data source after migration.
- Each module integration should include the relevant Supabase SQL setup script, optional seed script, Next.js Route Handler, typed browser data access, offline queue handling, documentation update, and VM validation.
- Keep UI changes separate from data/integration work unless the user explicitly approves UI changes.

## Deployment Workflow

1. Make approved file changes in the Dropbox-synced project folder.
2. Run development and validation checks inside the Ubuntu VM.
3. Confirm the app works as expected and report the completed local changes.
4. Do not push any branch to GitHub until the user explicitly instructs a push.
5. When explicitly instructed, commit any uncommitted approved work and push the release to `main`.
6. Vercel automatically deploys Production from `main`; no manual Vercel deployment action is normally required.
7. Skip Vercel Preview by default. Use a development branch and Preview deployment only when the user explicitly requests it.
8. Confirm production is live at `https://digital-estate-app.vercel.app` after an approved push.
9. Report what changed, validation performed, and any remaining risks or next steps.

## File Handling Rules

- Read and inspect files as needed before making changes.
- Do not modify, overwrite, rename, delete, or restructure existing files unless explicitly approved.
- For new work, ask where the file should be created and what filename should be used.
- If an existing file needs to change, explain what will change, why it is needed, and wait for confirmation.
- Avoid broad restructuring unless the user clearly asks for it.
- Keep changes focused and easy to review.

## Development Commands

Use SSH or Parallels VM execution for development tasks.

Example SSH access:

```bash
ssh parallels@10.211.55.3
```

Run project setup, dependency installation, app servers, build commands, tests, and checks from inside Ubuntu.

Confirm the VM runtime before installing or validating:

```bash
node --version
npm --version
```

Expected major versions:

```text
Node.js 24.x
npm 11.x
```

Next.js development commands:

```bash
cd /media/psf/Dropbox/digital-estate-app
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run smoke
```

Do not run commands like these on macOS unless the user explicitly approves:

```bash
npm install
npm run dev
python -m venv
pip install
brew install
```

## Project Structure Preference

- Use the Next.js App Router under `app/` for routes and API handlers.
- Use `components/` for reusable UI and domain components.
- Use `lib/` for server-only Supabase access, shared types, data transformations, and offline services.
- Keep secrets server-side and access Supabase through Next.js Route Handlers under `app/api/`.
- Keep `index.html`, `styles.css`, `app.js`, `work-program.js`, `pmv.js`, and related root data files as read-only parity references until production acceptance.
- Avoid duplicating domain logic between routes; Work Program management should share one data layer across Dashboard and Records.
- Keep PMV input lightweight: historical PMV data should load only in the management dashboard route.

## Verification Expectations

Before reporting completion:

1. Confirm the relevant files are in the expected location.
2. Run `npm run check` and `npm run smoke` in the Ubuntu VM.
3. Validate each affected route in the browser at desktop and mobile viewport sizes.
4. Confirm Supabase Route Handlers and offline queue behaviour remain compatible.
5. Summarise what changed, what was not changed, and any risks or next steps.

## Communication Style

- Be concise, structured, and practical.
- Use clear status updates.
- Highlight assumptions, risks, dependencies, and recommended next steps.
- Keep outputs suitable for project delivery and stakeholder review.
