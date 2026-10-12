# Trolley rescan mode

Use this when physical equipment has been placed on the wrong trolley but its record already exists.

1. Select **Change trolley** and choose the physical destination's permanent TSU reference.
2. Enable **Trolley rescan mode** in the scan station.
3. Scan the serial and select **Find saved item** (the scanner's Enter terminator also submits it).
4. Check the existing model, manufacturer, asset number, barcode, security etch and recorded trolley.
5. Select **Confirm trolley placement**. The existing item moves to the selected trolley. Scan the next serial.

This updates the same equipment record and keeps its scan-order number, original disposal date, technician and other identifiers. Moves use the existing audited move mechanism. Local backups retain mover history; shared moves use the Firebase record revisions. Confirming an item already on the destination creates neither another record nor another move.

Rescan lookup uses exact, unique serial matches in the **equipment register**. It does not infer a model, copy details from a similar serial, or add another record. Unknown serials, N/A and duplicate saved serials stop for review. Ready source/destination trolleys must be reopened; collected inventories stay locked. A changed record must be looked up again. Shared lookups and confirmations check fresh Firebase data and record versions; offline changes are blocked.

Reference-training spreadsheets contain only serial/model/manufacturer facts. They cannot supply an asset number or barcode for a rescan. To rescan historical spreadsheet equipment, use **Collection register → Import equipment Excel** first so the full record is available. That importer remains separate from recognition training. The supplied training workbooks have not been imported as equipment records automatically.

Normal mode retains its existing serial recognition behavior and does not autofill asset/barcode from previous equipment. Enabling rescan pauses the normal draft without modifying it; disabling rescan returns to that draft. Mode and lookup preview are temporary, start off after a page reload or fresh sign-in, and are cleared when locking/signing out or restoring/resetting a workspace. A normal draft remains in its existing backup/checkpoint mechanism.

Confirmation is explicit for each matched item. A failed write keeps the preview for retry. An accepted move followed by an interrupted workspace update tells the user to check the register before retrying. No Firebase rule update, new collection schema or paid backend service is required.

Verification: full browser suite **150 passed**; focused rescan suite **13 passed** after the scanner-focus refinement; unit suite **56 passed**; production-build rescan scenarios **six passed**. The build succeeded. Tests cover exact fields, stable item counts, preserved normal draft/typed input, original attribution, move history, repeat scans, unknown/reference-only/N/A/ambiguous serials, ready/collected locks, failed writes, stale shared revisions, offline behavior, phone navigation and scanner focus. Shared transport was simulated in browser tests; existing Firebase move transactions/rules are reused.
