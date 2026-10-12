# Trolley rescan mode

Use this when physical equipment has been placed on the wrong trolley but its record already exists.

1. Select **Change trolley** and choose the physical destination's permanent TSU reference.
2. Enable **Trolley rescan mode** in the scan station.
3. Scan the serial, barcode, security etch or asset number and select **Find saved item** (the scanner's Enter terminator also submits it).
4. Check the existing model, manufacturer, asset number, barcode, security etch and recorded trolley.
5. Select **Confirm trolley placement**. The existing item moves to the selected trolley. Scan the next equipment identifier.

This updates the same equipment record and keeps its scan-order number, original disposal date, technician and other identifiers. Moves use the existing audited move mechanism. Local backups retain mover history; shared moves use the Firebase record revisions. Confirming an item already on the destination creates neither another record nor another move.

Rescan lookup uses exact, unique serial, barcode, security etch or asset matches in the **equipment register**. It does not infer a model, copy details from a similar serial, or add another record. Unknown identifiers, N/A, duplicate identifiers and cross-field conflicts stop for review. Ready source/destination trolleys must be reopened; collected inventories require administrator unlocking. A changed record must be looked up again. Shared lookups and confirmations check fresh Firebase data and record versions; offline changes are blocked.

Reference-training spreadsheets contain only serial/model/manufacturer facts. They cannot supply an asset number or barcode for a rescan. To rescan historical spreadsheet equipment, use **Collection register → Import equipment Excel** first so the full record is available. That importer remains separate from recognition training. The supplied training workbooks have not been imported as equipment records automatically.

Normal mode retains its existing serial recognition behavior and does not autofill asset/barcode from previous equipment. Enabling rescan pauses the normal draft without modifying it; disabling rescan returns to that draft. Mode and lookup preview are temporary, start off after a page reload or fresh sign-in, and are cleared when locking/signing out or restoring/resetting a workspace. A normal draft remains in its existing backup/checkpoint mechanism.

Confirmation is explicit for each matched item. A failed write keeps the preview for retry. An accepted move followed by an interrupted workspace update tells the user to check the register before retrying. No Firebase rule update, new collection schema or paid backend service is required.

Verification: full browser suite **150 passed**; focused rescan suite **13 passed** after the scanner-focus refinement; unit suite **56 passed**; production-build rescan scenarios **six passed**. The build succeeded. Tests cover exact fields, stable item counts, preserved normal draft/typed input, original attribution, move history, repeat scans, unknown/reference-only/N/A/ambiguous serials, ready/collected locks, failed writes, stale shared revisions, offline behavior, phone navigation and scanner focus. Shared transport was simulated in browser tests; existing Firebase move transactions/rules are reused.

## Find by a saved equipment identifier

Trolley rescan mode accepts an exact saved serial number, barcode, security etch or asset number (for example A0042). Matching ignores case and surrounding spaces; it does not guess missing digits or asset prefixes. An asset can identify an item whose serial is N/A. The preview retains all recorded identifiers and disposal attribution, and confirmation moves the existing record rather than creating a new item.

N/A cannot identify an item. Duplicate assets, duplicate serials and an input matching one item's serial and another item's asset stop lookup for review. Confirmation checks identifier uniqueness again against the refreshed shared register before moving. Normal scanning and serial-pattern recognition remain separate. No new Firestore rules are required for asset rescan lookup.

## Recognition-only references

If an identifier is absent from the saved register but matches an exact recognition reference, the rescan view now shows that reference's model/manufacturer and explains that it is not a saved inventory item. For example, C17K352ZDNCR is Apple A1418 in the bundled Mac spreadsheet.

Choose Record this item to switch to normal scanning with the serial/model/manufacturer prefilled, then capture the remaining barcode/security/asset fields and Save. This action does not automatically save a new item or invent asset/barcode values. If a normal scan is already unfinished, the reference view offers Return to paused scan instead, preserving that work.

Saved register matches take priority and retain their original complete details for trolley placement. Duplicate identifier errors and connection failures do not fall back to references. Pattern guesses remain in normal scanning; reference-only results cannot be confirmed as an existing-item move.


Barcode and security-etch lookups retain the original serial, asset, model/manufacturer and disposal attribution. Leading zeros and punctuation are preserved; only case and surrounding spaces are ignored. A value matching multiple fields on one item counts as one result. A value matching different items, including different identifier fields, stops for review. N/A and unknown placeholder values cannot identify an item. All four identifiers use the same refreshed-register confirmation checks and audited move path, with no additional Firebase rules required.

Asset numbers present only in training spreadsheets are not part of the public recognition catalogue. For example, A0803 appears in the July 2025 workbook but must be imported through Collection register → Import equipment Excel before asset rescan can find it. Import reference spreadsheet remains a separate training action. Missing inventory lookup now names the scanned identifier and explains the correct importer.

## Full previous-spreadsheet lookup

Use **Load previous decom Excel** in Trolley rescan to load complete historical equipment fields privately. Matching any of the four identifiers shows an editable full-record preview and **Add to current trolley**, even with a normal scan paused. See [Historical rescan](HISTORICAL-RESCAN.md) for source selection, current date/technician attribution, private backup storage and safeguards. Reference-training facts remain separate and do not invent missing identifiers.
