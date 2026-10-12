# Additional recognition references — 12 October 2026

The six supplied workbooks have been added to the built-in recognition catalogue. The original supplier workbooks, disposal dates, technician names, barcodes, asset numbers and financial columns are not bundled. Public references contain only serial, model, manufacturer and workbook source. This follows the previously authorised public reference-library approach. No items were inserted into the live equipment register or Firebase.

| Workbook | Rows with reference data | Usable facts before merging |
|---|---:|---:|
| February 2026 — Collected | 389 | 370 |
| May 2025 — Collected | 152 | 145 |
| June 2025 — Collected | 335 | 296 |
| July 2025 — Collected | 370 | 355 |
| May 2026 — Collected | 356 | 321 |
| Summer 2026 — Macs | 41 | 40 |

After merging duplicate facts, the catalogue contains **1,527 facts for 1,524 distinct serials**, up from 321 facts: **1,206 added facts**. The May 2026 sheet repeats the original 321 facts; these merge their provenance rather than inflate pattern support.

## Reviewed extraction

- May and June 2025 have manufacturer/model values beneath reversed headings. The catalogue build script explicitly corrects those two reviewed workbook layouts. The general spreadsheet parser continues to follow headings; correct those workbook headings before importing them separately through Settings.
- Obvious brand aliases are consolidated, including Hanns G/HaansG/Hanns-G, Edge/Edgeio, Lenovo AIO/Thinkcenter and Mac/Apple. Clear spelling variants such as Hitatchi and Panansonic are normalised. The Lenovo model label ThinkTIO24D is consolidated with TIO24D. Uncertain model names remain as recorded rather than being invented or forced into one model.
- Blank/N/A/incomplete reference rows, repeated facts and unbranded labels are excluded. Summary sheets without the three required headings are ignored.
- The July sheet has formatting extending to row 1,048,576. Reference extraction now iterates populated rows instead of constructing blank rows to the formatting tail.
- Three serials retain conflicting model facts: `MSCF090020L`, `1710005111` and `3ICT2DSC0002SN0851`. The existing recognition UI presents choices; it does not silently overwrite the conflict.
- The new Apple example `C17K3520DNCR` matches A1418 exactly; unseen family example `C17K3999DNCR` suggests Apple A1418 with the required physical-label confirmation. Existing Posiflex `001917BD354B` and Toshiba `8F020669H` manufacturer suggestions remain available.

The reproducible merge script is `scripts/build-reference-catalogue.mjs`. Supply these reviewed workbook paths as arguments from the repository directory. It writes only the four approved recognition fields into `src/reference-catalogue.json`; workbook files remain outside the repository. It reports extraction counts and writes a local conflict review under `/tmp`. Do not use its filename-specific column corrections as a general automatic-layout detector.

## Pattern limitations

A leave-one-serial-out check against recorded workbook labels produced 426 matching manufacturer/model suggestions, 649 matching manufacturer-only suggestions, 26 different model labels, 10 different manufacturers and 416 cases without a manufacturer suggestion. This tests inference for unseen serials, not exact retrieval. Some differences are model naming variants or contradictory spreadsheet labels; the workbooks are not physically verified ground truth. These results do not justify treating guessed models or manufacturers as certain. Pattern-based prefills continue to require a technician's physical-label confirmation. Generic four-character numeric endings such as -001 no longer create matches across unrelated devices; longer numeric suffix families remain supported.

Exact retrieval and manufacturer/model ambiguity are covered by new catalogue tests; the populated-row parser has a regression test using a formatting-only final Excel row. New references remain separate from the historical-equipment importer and register.

Final verification: **135 browser tests**, **54 unit tests**, and **four production-build recognition scenarios** passed. The production build succeeded. Checks cover corrected 2025 exact matches, the new Apple serial family, unchanged empty inventory after recognition, conflict choices, generic numeric counter rejection, existing Posiflex/Lenovo/Toshiba families, and the formatting-only final Excel row. No Firebase rules or live register changes are required for these bundled facts.
