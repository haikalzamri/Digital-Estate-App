# DEX — Reference and Scenario Data Guide

Prepared: 18 October 2026.

## Purpose

Provide recognisable reference information for the illustrative DEX workshop. The application should read these prepared files without reopening Excel or depending on OneDrive. The original workbook is unchanged.

## Supplied reference data

| File | Source sheet | Records |
|---|---|---:|
| employees.json | Employee Master List | 122 |
| harvesting-codes.json | Harvesting Master List | 14 |
| activities.json | Activity Master List | 632 |
| gangs.json | Gang Master List | 12 |
| machines.json | EVIT Master List | 45 |
| outturn-codes.json | Outturn Code Master | 41 |
| rates.json | Rate Master List | 42 |
| storage-locations.json | Store Location Master | 1322 |
| estates.json | Estate Master List | 177 |
| fields.json | Field Master List | 153 |
| materials-sample.json | Material Master List | 64 |

The estate/store catalogues are retained in full. Filter E063 for the initial workshop. E063 is Ldg Digital and has seven supplied storage locations. All 153 field records and all 45 active-flagged EVIT records belong to E063.

## Material sample

64 codes, eight per category:

| Category | Selected codes |
|---|---:|
| Fertiliser | 8 |
| Spraying chemicals | 8 |
| PPE | 8 |
| Machinery parts | 8 |
| Fuel and lubricants | 8 |
| Harvesting tools | 8 |
| Spraying equipment | 8 |
| General supplies | 8 |

The source material sheet contains 296,312 data rows across several languages. The sample uses manually selected English entries, retains exact codes/descriptions and excludes explicit deleted/do-not-use/obsolete/inactive/cancelled/scrap descriptions. Supply categories are workshop labels.

Some catalogue descriptions are generic, truncated or historically worded. Preserve source wording; do not infer current active status, E063 applicability, equipment compatibility or chemical suitability. This pack does not specify chemical application rates or safety procedures.

## File contract

Every JSON file contains schemaVersion, dataset, recordCount and records.

Reference datasets have dataKind reference. Their source metadata records the workbook, sheet, source hash and Excel-column to JSON-field mapping. Every record carries sourceRow for traceability.

- Identifiers are strings, including employee/field/material/rate/gang codes and leading-zero outturn codes.
- Blank source cells are null; zero source values remain zero.
- Only surrounding whitespace is trimmed. Names, case, spelling and all source columns are retained.
- Source numerical/date fields are preserved as strings with Source suffixes where appropriate, avoiding unsupported date or unit interpretation.
- rates.json additionally provides numeric rateValue, with rateValueSource preserved. Currency and employee/activity applicability are not supplied.
- The materials category field is derived solely for the workshop.

## Simulated resource data

The sibling scenarios folder contains:

| File | Content | Records |
|---|---|---:|
| machine-status.json | Illustrative condition/PMV result, planning availability and existing allocations for every EVIT. | 45 |
| material-stock.json | Illustrative on-hand/reserved/available stock for every selected material at two stores. | 128 |

The fixed resource snapshot is 17 October 2026 at 15:30 Malaysia time, for planning work on 18 October 2026. It does not represent actual machine condition or live inventory.

Both scenario files and their records are labelled simulated. They reference source identities; they do not change the reference masters. The existing machine bookings are standalone dummy allocations; their IDs do not claim that a real plan/ticket exists.

Machine condition and planning availability are distinct. A serviceable machine may already be allocated; an idle machine may be available or pending confirmation. Available, allocated, breakdown and pending examples are included.

Stock units (including KG, L, EA, PAIR, CAN, M and PACK), quantities, reservations, low-stock thresholds and store placement are assumptions. Each material uses one consistent assumed unit across stores. Do not convert pack sizes or imply master UoM accuracy. Available quantity equals on-hand minus reserved. A pre-plan request does not constitute physical issuance or reduce physical stock.

Stock is simulated at E063 SR01 Main Store and SR04 Division A. Out-of-stock, low, fully reserved and available examples are deliberately included.

## Source issues retained for review

- Employee source: 122 rows and 121 distinct employee IDs. ID 337146 has conflicting employeeName values on rows 53 and 56. Both records are preserved. Do not silently choose one identity; use other workers for the first examples.
- Field Master: no hectare, geometry, field-task or harvesting-history values are supplied. Missing information will use clearly identified scenario assumptions or compatible approved historical references later.
- Field 2018B: supplied division A differs from the historical map's B. Source masters remain intact pending presentation/mapping review.
- Existing Work Programme has 28 matching field codes; Digital Estate Harvesting Interval has 27. Matching identity does not validate dates, hectares, divisions or round logic.
- Historical harvesting actuals run through June 2026; an October workshop needs a labelled simulated opening position or historical date.
- The storage catalogue contains 47 rows for M171, M206 and M301, which are absent from the supplied estate catalogue. Preserve these reference rows; they do not affect E063 store mapping.
- The workbook's END to END UI FLOW sheet is empty and is not exported as a dataset.
- A material appears in this pack because its supplied code/description is useful for illustration, not because its current estate stock or suitability has been verified.

## Source and preparation

Source file: E063_DATA.xlsx, supplied by the user.

Original source location on the host:
 /Users/haikalzamri/Library/CloudStorage/OneDrive-SDGuthrie/Group Digital - Digital Estate/17) DEX (Digital Estate Extended)/Data Extraction/E063_DATA.xlsx

Workbook SHA-256: 427b21a7d16ceb53c6e793d1bb7f76e2a3d86f39007b2a7088ebd6ca3f33c188

Extraction and output creation ran in the Ubuntu VM using standard-library XML/ZIP parsing. Input was streamed in memory over SSH; no additional workbook copy was created. Prepared JSON is UTF-8 and readable as plain text.

The runtime also uses scenario files for work programmes, harvesting intervals, Muster Chit activities, Checkroll defaults, Warehouse and machine operations. These provide illustrative operating rules and starting values. User-entered plans, attendance and transactions remain in browser-local storage and are separate from these supplied reference files.

The DEX prototype is packaged at /dex in the parent application. It has no real SAP, SAFE, SSO or Supabase connection and no payroll engine. See ../../README.md for the current module scope and commands.
