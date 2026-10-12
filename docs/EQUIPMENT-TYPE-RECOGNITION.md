# Equipment descriptions from recognition

Serial recognition now suggests the current item's equipment description as well as model and manufacturer. This applies to exact references, suggested serial families, checked model choices and model corrections. Trolley rescan continues to preserve the existing equipment record.

Reference training imports retain the optional Description, Equipment description or Equipment type column. The bundled catalogue retains the same 1,527 approved serial/model/manufacturer facts, enriched with available categories from the seven supplied workbooks. Full workbooks, financial fields and technician details are not published.

Named product families such as ThinkPad, Latitude and Satellite classify as laptops; ThinkCentre and OptiPlex classify as desktops. Other models use agreement among spreadsheet descriptions for that model and manufacturer. Manufacturer-only matches can suggest a description when every candidate has the same known type. Unknown or conflicting categories keep the batch default for manual checking; a manufacturer alone does not determine equipment type.

The description is visible at the scan station and editable in the defaults panel. A recognised description applies to the current item only, survives refresh and backups, and is saved in the register and Excel export. Saving restores the batch description for the next item. Manual edits to a suggested description remain authoritative while adjusting the same item's model. Existing equipment history is not rewritten.

## Shared reference imports

Publish the updated `database/firestore.rules` in Firebase Console → Cloud Firestore → Rules to allow the optional description field on newly imported shared references. Existing references without it remain valid. Normal scanning and saving recognised descriptions use the existing equipment schema and do not require this rule change.

## Validation

Regression coverage includes laptop/monitor/desktop transitions, unknown and conflicting types, legacy Monitor defaults, spreadsheet parsing and preview, editable descriptions, reload, item saving, next-item batch defaults and Firebase validation of optional reference descriptions.

## Correct equipment already recorded

Open Settings → Review saved equipment descriptions. In a shared workspace this tool is available to team administrators. It fetches the current register from Firebase before previewing changes.

The preview compares the saved model/manufacturer with the current type catalogue. Old Monitor defaults with a different supported type are selected initially. Other description changes are left unchecked for individual review. Deselect anything you want to retain, then choose Update selected descriptions. Unknown types, missing/ambiguous trolleys and ready or collected inventories are skipped. Reopen a ready trolley before editing its contents; collected history stays locked.

Only the description field changes. Equipment IDs, serials, model/manufacturer, assets, barcodes, disposal attribution, trolley references and unfinished scans remain intact. Local updates commit together. Shared updates use the existing version-checked equipment writes and revision history; another technician's changes invalidate a preview. If only some shared updates succeed, the result identifies confirmed changes and failures. Refresh suggestions before retrying so confirmed records are not updated twice. No new Firestore rules are required for description repairs.
