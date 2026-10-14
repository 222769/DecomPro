# Serial recognition research — 14 October 2026

## What a serial can tell us

A serial number identifies an individual device. Manufacturers may encode a family, factory, production batch or sequence in parts of it, but the encoding is not consistent across manufacturers or product generations. The catalogue shows that a shared prefix or ending can be useful evidence, while a short prefix, suffix or numeric format alone is often not enough to identify a model. A product/model number, asset number and security etch are separate identifiers and should remain separate fields.

This report uses DecomPro's bundled, reviewed catalogue because live manufacturer documentation could not be reached from this research environment. The observations below describe **this collection history**, not a universal manufacturer specification.

## Evidence from six historical workbooks

The bundled catalogue has 1,527 labelled facts for 1,524 distinct serials. Three serials have conflicting model labels. The six source files contribute 370, 355, 321, 296, 145 and 40 facts respectively.

Two tests were run with the current `recognizeSerial` function:

| Hidden evidence | Correct model + maker | Correct maker, model left open | Wrong model, correct maker | Wrong maker | No maker suggestion |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hide the target serial, retain the other workbooks and same-workbook units | 426 | 649 | 26 | 10 | 416 |
| Hide the target's **entire workbook** | 67 | 571 | 63 | 83 | 743 |

The second test better resembles a newly encountered batch. Its 83 wrong-maker labels include 64 Fortinet items matching earlier Meru-labelled serial families. This may reflect a naming or ownership change in the source spreadsheets; it must be reviewed before treating either name as canonical. Other collisions include Stone/Zoostorm, HP/Aruba and several makers sharing similar numeric layouts. Of the 164 model suggestions in the whole-workbook holdout, only 67 exactly matched the recorded model text. Some mismatches are spelling or model-detail variants, but others are distinct equipment. Therefore a pattern suggestion should not silently become a saved model.

The current scanner already requires a technician confirmation for non-exact recognition. Keep that safeguard. Exact serial matches should still show conflicts when the library records more than one model for the same serial.

## Changes worth testing next

1. **Use the complete label when available.** Capture the printed model, product/part number or machine type alongside the serial. A serial family plus a matching product identifier is stronger evidence than a serial pattern alone. Do not infer a model from an asset tag or security etch: those belong to the organisation's inventory, not the manufacturer's model code.
2. **Keep recognition levels separate.** Exact serial = known reference; cross-batch unanimous family = possible model; broad prefix, suffix or shape = manufacturer or candidate list only. If a family has conflicting manufacturers across workbooks, display candidates and ask for the physical label. Never take the most common label as truth by itself.
3. **Review manufacturer and model aliases.** Record explicit, auditable relationships for source labels such as Meru/Fortinet and spelling variants. Preserve the source text and let a technician choose the product's printed branding. Do not silently rewrite historical records.
4. **Validate across workbooks.** Assess any new rule by withholding one full collection file at a time and reporting wrong-maker and wrong-model counts separately. A rule should only be promoted if it improves useful suggestions without raising either error count. Count distinct serials and independent collections, not duplicate rows.
5. **Parse labelled barcode payloads carefully.** When a scanner returns a value prefixed by `S/N`, `SN:` or a known structured barcode format, extract the serial into the serial field and keep the original scan for review. Preserve leading zeroes and meaningful punctuation. Unknown barcode payloads should remain barcodes until a person confirms their meaning.
6. **Offer near matches as corrections, never autofill.** For a scan differing by one likely transcription character such as `O`/`0` or `I`/`1`, show a possible match with the differing characters highlighted. Require confirmation against the label; do not silently normalize those characters because both may be valid.

## Recommended acceptance checks

- A new serial from a manufacturer-renamed family cannot silently fill the old maker.
- A prefix or suffix shared by multiple models presents candidates and keeps the model open.
- An exact serial with conflicting catalogue rows requires review.
- Leading zeroes survive barcode capture, lookup, export and reload.
- A whole-workbook holdout reports both exact-text and reviewed-alias results, so alias cleanup cannot hide genuinely wrong equipment predictions.

Existing family observations and the original one-workbook analysis are in [SERIAL-PATTERN-ANALYSIS.md](SERIAL-PATTERN-ANALYSIS.md).
