# DEX — Digital Estate Extended

DEX is an interactive estate operations prototype for workflow review and workshops. Web, Phone and side-by-side Workshop views share one simulated session in the current browser.

Live module: [digital-estate-app.vercel.app/dex](https://digital-estate-app.vercel.app/dex)

## Modules

| Module | Scope |
| --- | --- |
| M1 Work Programme | Upkeep schedules, harvesting intervals, field maps and approved Activity Ha progress. |
| M2 Attendance and Productivity | Daily pre-plan, materials, attendance, work acceptance, Mandore tickets, productivity approval and Checkroll allocation. |
| M3 Machine System | Driver/EVIT assignment, machine tickets, checklists, fuel, material pickup references, simulated routes, issues, downtime and Machine Ha. |
| M4 Warehouse | PR/PO approvals, simulated delivery orders and goods receipt, stock, issue out, store transfers and inter-estate transfers. |
| M5–M8 | Visible placeholders for Costbook, Harvesting, Upkeep and General Tools. |

Machine Ha stays separate from Activity Ha. Only approved Activity Ha contributes to Work Programme completion. Machine productivity is reviewed in M2; M3 Productivity is a read-only reference.

Role selectors demonstrate management, Store Clerk, Mandore and machine-operator permissions. They are prototype controls, not authenticated accounts. PO creation is restricted to Store Clerk on Web.

## Data and local saving

- Every visitor receives the same prepared reference data and illustrative starting balances, including the supplied employee identities, fields, EVITs, materials and programme schedules.
- Days, attendance, tickets, productivity and Warehouse transactions are saved only in that browser's localStorage under `dex-workshop-screen-v1`.
- Refreshing restores that browser's entries. Other browsers and devices have separate sessions; changing the simulated role shares the current session.
- **Workshop tools → Start a blank plan** clears local entries after confirmation and retains the sample reference data and starting balances.
- **Load sample day** restores the original sample draft; **Load morning muster** provides an alternative starting scenario.
- Browser site-data clearing removes local progress. There is no central transaction store, cross-device sync, live purchasing, payroll, SAP, SAFE, SSO or real GPS integration.

See the [reference data guide](data/reference/README.md). Suppliers, prices, application rates, stock and route movements are illustrative and do not represent operational recommendations.

## Development

Use Node.js 24 LTS and npm 11.x in the Ubuntu development VM.

Standalone DEX:

```bash
cd /media/psf/Dropbox/digital-estate-app/dex-prototype
npm ci
npm run dev
```

Open `http://10.211.55.3:3060`. Standalone builds use the normal root path.

```bash
npm run check
node scripts/machine-check.mjs
node scripts/warehouse-check.mjs
npm run start
npm run smoke
```

## Same-project deployment

The parent application retains its existing routes and serves the isolated DEX export at `/dex`.

From the repository root:

```bash
npm run build
npm run start
npm run smoke
```

`scripts/build-dex.mjs` installs the DEX locked dependencies when needed, builds with `DEX_MODULE_BUILD=1` and `NEXT_PUBLIC_DEX_BASE_PATH=/dex`, and copies the export to ignored `public/dex-runtime/`. The parent then builds normally. The DEX and parent builds use separate TypeScript and CSS boundaries.

Keep the Vercel project rooted at the repository root with `npm run build`; no separate project is required. The export build uses the standalone DEX build cache, so stop a running standalone server before building the combined release. Rebuild standalone DEX normally before restarting its server.

## Design references

- [Initial workshop blueprint](docs/DEX_BLUEPRINT.md)
- [Initial decisions and assumptions](docs/DECISIONS.md)
- [Reference data guide](data/reference/README.md)

The initial planning documents record the foundation scope; the module table above describes the implemented prototype.
