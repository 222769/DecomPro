# Summer 2026 serial pattern analysis

Analysed `Decom 2026 - Summer.xlsx`, Sheet1, on 11 October 2026. The workbook contains 356 nonempty serial/model/manufacturer rows. After excluding unusable reference facts and collapsing duplicate facts, it supplies 321 labelled facts for 320 distinct serials. Original model/manufacturer labels were preserved; spelling variants were not silently corrected.

## Useful families

| Pattern | Distinct references | What the workbook supports |
| --- | ---: | --- |
| Prefix `10LL` | 13 | Lenovo / TIO24D |
| Prefix `10DQ` | 10 | Lenovo; several recorded models, so ask for the model |
| Prefix `TG12` | 5 | Edgeio / GB19X1 |
| Prefix `TG22` | 4 | Edgeio; mixed models |
| Prefix `S26C` | 9 | Samsung / HD253GJ |
| Prefix `6V` | 30 | Seagate; recorded drive models vary substantially |
| Prefix `3NM` | 12 | HP; several drive models |
| Prefix `CN00` | 12 | Linx; many model labels |
| Prefix `WCC2` | 4 | Western Digital / WD5000AAKX |
| Prefix `V9-0` | 8 | Lenovo; both 23- and 24-inch labels occur |
| Ending `ENB`, starting `I`, exactly 24 characters | 7 | Toshiba / Satellite Pro, even when the middle changes format |
| Ending `QMPB` | 4 | Toshiba / Satellite Pro |
| Ending `TZW4` | 3 | Toshiba / MQ01ABF050 |
| Ending `TCN3` | 2 | Toshiba; manufacturer suggestion with matching format or anchored start/length; MK1652GSX offered for review |
| Ending `SR56` | 2 | Toshiba; smaller suffix families can suggest the manufacturer while leaving the model open |
| Format digit–letter–six digits–letter, ending `H` | 36 | Toshiba; Satellite Pro, PROTÉGÉ and Ultrabook labels, so manufacturer only |

These are observed families in one workbook, not universal manufacturer specifications. Recognition still requires a physical label check. Exact serial lookup takes priority; conflicting reference labels remain uncertain.

## Patterns to avoid and data to review

- Ending `H` alone spans Toshiba, Seagate, Hitachi, HP and Lenovo. Ending `L` alone also spans several brands. Neither is a universal manufacturer code.
- Prefix `ST` mixes Stone and Zoostorm. Even `ST34` includes both. The app now consults the broader three-character family before trusting a manufacturer-only four-character match whose models already disagree.
- Pure numeric prefixes such as `59` and `11` mix brands. Numeric length alone is insufficient to identify Iiyama.
- The Hanns/HaansG-style monitor format also includes I-INC; a format-wide majority must not overwrite minority manufacturers.
- `MSCF090020L` has two different Epson model labels (`EB-460Wi` and `h343b`). Review the physical device before resolving this conflict in the reference library.
- Labels such as `PB1704S`, `prolite pb1704s`, `prolitepb1704s`, and `HL190APB` versus `HL190APBEE4V3` may be aliases or different levels of model detail. These need technician review rather than automatic merging.

## Improvements implemented

1. Fixed-length families with a leading letter and a three-letter terminal code tolerate changing middle character layouts. At least four distinct supporting serials and two different starts are required. This makes the `I…ENB` family usable without hardcoding Toshiba.
2. Short two-/three-character prefixes can suggest a manufacturer across varying layouts, at a fixed serial length. Three examples are required for three characters, five for two; pure numeric prefixes are excluded. This fallback never fills a model.
3. Ambiguous four-character manufacturer-only prefix matches check their broader parent family for conflicting manufacturers.
4. Two independent references can suggest only a manufacturer when a three-character prefix or four-character suffix agrees with the complete serial format. Long suffix families may instead use a shared two-character start and fixed length, allowing the middle to change layout. Both markers must contain a letter. All same-length marker matches are checked for conflicting manufacturers before narrowing by format; duplicates never inflate support. Models remain candidate choices, even when both labels agree.

The rules are derived dynamically from built-in, imported and reviewed equipment facts; the family table is documentation, not a hardcoded brand database.

## Cross-validation

Each serial was hidden along with every reference having that serial, then recognised against the remaining facts. The 321 labelled cases include both labels for the one disputed serial; duplicates cannot support themselves.

| Result | Before this analysis | Initial improvements | Small-family improvement |
| --- | ---: | ---: | ---: |
| Manufacturer and model labels agree | 92 | 99 | 99 |
| Manufacturer agrees; model left uncertain | 131 | 139 | 142 |
| Manufacturer agrees; model label differs | 7 | 7 | 7 |
| Wrong manufacturer suggested | 1 | 0 | 0 |
| No manufacturer suggestion | 90 | 76 | 73 |

Together these add 18 correct full or manufacturer-only suggestions without increasing model-label mismatches. The latest small-family fallback adds three manufacturer suggestions in the hidden-serial check, and enables new serials such as `59F9Z77QTCN3` to suggest Toshiba from the two existing TCN3 references. The seven mismatches remain review-required suggestions; some involve alias-like model labels, and they are not claimed to be accurate models. Results on this small historical collection do not guarantee performance on other equipment.

Validation: 39 unit tests, nine focused browser workflow tests (including manufacturer-only entry, candidate review, saved evidence and reload), and a production build passed.

Reproduce with `node scripts/analyse-serial-patterns.mjs '/path/to/Decom 2026 - Summer.xlsx'`. The script prints pattern candidates, disputed serials, holdout counts and mismatches; review candidates before promoting them to production rules.
