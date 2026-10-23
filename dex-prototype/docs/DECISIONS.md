# DEX — Decisions and Workshop Assumptions

Baseline: 18 October 2026. This records the current discussion, not a signed-off production design.

## Confirmed direction

| ID | Decision |
|---|---|
| D01 | DEX means Digital Estate Extended: extending the existing Digital Estate concept to other estates. |
| D02 | Build an illustrative workshop prototype to show the process and support communication. Detailed production completeness is unnecessary. |
| D03 | M1 and M2 are the first workshop focus. |
| D04 | M3 machine and M4 stock information must be visible in M2 Pre-Plan. Missing operational values may be dummy data. |
| D05 | Full M3/M4 execution, warehouse processing and downstream integrations are deferred. |
| D06 | Future eligible M3 actuals also update M1 progress. M2 is not M1's only possible source. |
| D07 | Next-day material requests connect to future M4 store-clerk preparation/issue tickets. A request is not physical issuance. |
| D08 | Use familiar Excel master records throughout. Create consistent dummy values wherever data is missing. |
| D09 | Keep all populated non-material master lists and curate around 60–80 materials spanning estate supply categories. |
| D10 | Free navigation is required. Optional scenarios initialise a situation and remain freely explorable. |
| D11 | Provide Web, Phone and built-in side-by-side Workshop views in one browser tab, preserving session progress. |
| D12 | Each Workshop panel can select its role independently while using the same records. |
| D13 | Use green, clean and minimalist design. The supplied older video helps understanding and alignment. |
| D14 | Current module numbering is M6 Harvesting, M7 Upkeep and M8 General Tools/GIS. |
| D15 | Reuse suitable historical screens and logic, preserving the original implementations and their earlier ideas. |
| D16 | Keep DEX inside the existing project/repository as a separate application subfolder. DEX is the sole intended future deployment. |
| D17 | All development and validation run in the Ubuntu VM. No Supabase or live external connections for this prototype. |
| D18 | Historical files and the supplied originals remain unchanged. The foundation approval covers only the agreed new files. |
| D19 | No Git push or deployment until explicitly instructed. |

## Workshop assumptions for the first implementation

These are simple illustrative behaviours to review, not approved business policy.

| ID | Assumption | Reason / review point |
|---|---|---|
| A01 | Use 17 October 2026 as preparation day and 18 October 2026 as execution day, with a workshop-controlled clock. | Keep pre-plan, muster and intraday changes coherent. Dates are simulated. |
| A02 | Demonstrate Manager approval of a daily plan and FO validation of labour productivity. | The final mandatory approval/delegation rules remain open. |
| A03 | One labour ticket can group a field, activity and responsible Mandor/team, with worker/task detail beneath it. | Keep the demonstration manageable; exact grouping can be changed after discussion. |
| A04 | FO/AM can demonstrate an intraday amendment with a reason and effective time. | Authority thresholds and emergency approvals are not final. |
| A05 | Use a single browser's shared session for the Web/Phone/Workshop views. | Physical-phone shared state is an optional later decision. |
| A06 | Machine condition and planning availability are separate values. | A serviceable machine can already be allocated; an idle one can still be available. |
| A07 | Dummy stock uses on-hand minus reserved quantity as available quantity. Units, stores, thresholds and reservations are scenario assumptions. | The material extract has no stock quantities or units of measure. No real inventory claim. |
| A08 | Pre-plan requests do not reduce physical stock. | Later reservations/issuance must remain distinguishable. |
| A09 | Equal worker hectare attribution is an editable illustration where contribution is equal. | Partial-day transfers need time/contribution-aware attribution; field hectares count once. |
| A10 | Morning attendance does not irrevocably fix a full-day outturn code. | Half-days, leave, holidays and changes may require another supplied code. |
| A11 | Demonstrated notifications are in-app simulation events. | No real messages, push delivery or operational assignments are sent. |
| A12 | Payment/cost values illustrate the process. | Rate applicability, currency and complete payroll rules are not supplied. |

## Source preparation decisions

- Preserve all 122 employee source rows. They contain 121 distinct employee IDs.
- Employee ID 337146 occurs on source rows 53 and 56 with conflicting name text. Preserve both rows and flag the conflict; do not silently merge them or invent the correct identity. Use unambiguous workers for initial examples.
- Preserve all reference source columns, including blank values, source spelling and code distinctions. Trim surrounding whitespace only. Identifiers remain strings.
- Storage source has 47 rows for M171, M206 and M301 without a matching supplied estate record. Retain them with dataQualityIssues metadata; E063 mappings are valid.
- Keep the full estate/storage catalogues in the reference pack. Filter E063 in the initial UI; seven supplied stores belong to E063.
- Select 64 English-language material rows, eight per category, with source row tracing. Exclude descriptions explicitly marked deleted, do not use, obsolete, inactive, cancelled or scrap.
- Material categories are workshop classifications. Catalogue inclusion does not prove current E063 use, SAP active status, suitability, formulation or machine compatibility.
- Machine statuses, assignments, stock quantities, units and availability thresholds are simulated separately from the source master.
- The Field Master contains no hectare or geometry column. Existing Work Programme and Harvesting Interval references may support later mapping; matching field codes do not establish agreement of every attribute.
- Field 2018B has a division mismatch: the supplied Field Master says A and the historical map says B. Preserve both historical sources; resolve presentation before mapping that field.
- Historical Work Programme source has 28 matching field codes; Digital Estate Harvesting Interval has 27. Reuse is feasible after field/round/date mapping.
- Historical harvesting actuals extend through June 2026. Do not present them as current October actuals; use a labelled simulated opening position or an appropriate historical scenario date.
- The workbook's END to END UI FLOW sheet is empty. The separate supplied flowchart supplies the workflow reference.

## Questions to explore during the workshop

1. Which daily plans and major amendments need Manager approval or delegated authority?
2. Who can reassign workers, and how should the receiving Mandor acknowledge a revision?
3. How should temporary work allocation differ from a permanent gang transfer?
4. What field/worker/task metrics are essential for each activity?
5. How should group output, partial-day jobs and secondary work be attributed without overlap?
6. Which corrections are permitted after validation or Checkroll preparation?
7. How should programme delay bands, round eligibility and over-target work be shown?
8. How should eligible labour/machine completion be reconciled when M3 is added?
9. Which field area/division source should be used where supplied references differ?
10. Is a physical-phone shared session needed beyond the built-in Workshop view?

## Current delivery boundary

The approved foundation contains four project documents, eleven reference JSON datasets, one reference data guide and two resource scenario JSON files. Application source files, runtime/deployment configuration and component copies are a later step with agreed filenames.

No application build or browser route validation applies until application files exist.

## Foundation verification completed — 18 October 2026

- Created the 18 approved files through the Ubuntu VM using Node.js 24.17.0, npm 11.13.0 and Python 3.12.3.
- Validated all eleven reference JSON datasets: 2,624 records, including 64 materials in eight categories.
- Independently compared 9,774 source cells with the saved JSON; all matched after the documented whitespace/null handling.
- Verified all 45 machine scenarios and 128 stock scenarios, references, simulated labels and stock arithmetic.
- Preserved the supplied README verbatim in the blueprint appendix.
- Matched all new file checksums between VM and Mac.
- Confirmed the checksum baseline of all 102 existing project files outside DEX was unchanged; supplied workbook, flowchart, README and video were unchanged.
- Application build, route smoke checks and browser review are not applicable to this foundation-only delivery. No runtime files exist yet.
- No Git commit, push, deployment or deployment-setting change was performed.
