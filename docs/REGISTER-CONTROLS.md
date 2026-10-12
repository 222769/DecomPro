# Register and scan-station controls

## View one trolley

Collection register → Trolley inventory lets you choose a trolley or All trolleys. Options show item count and the reference suffix to distinguish repeated names; the selected trolley's complete TSU reference appears in the inventory banner. Sorting, search and original scan-order numbers continue to work. The selected view is reflected in the URL and survives reload. Changing trolley filters clears equipment selection. Viewing a trolley does not change the trolley for new scans. The existing selected-trolley Excel export scope is reused.

## Delete selected equipment

Select equipment using its row checkbox or Select visible equipment, then choose Delete selected. The preview lists every selected item, including selections hidden by search. Type DELETE and tick the acknowledgement before deletion. Cancel leaves the inventory unchanged.

The entire selection is checked against current records and open source trolleys before deletion begins. Ready or collected sources must first be reopened/unlocked. Local deletion commits all selected removals together. Shared deletions use the existing version-checked equipment removal and immutable revisions. If only some shared removals succeed, confirmed items leave the selection; failed items remain selected. Close the preview and choose Delete selected again to review/retry the remainder. Failed storage, stale records and connection changes retain unsaved items. Unselected inventory, trolleys and unfinished scans remain intact.

## Selected trolley for new scans

Caged trolley in Batch defaults is read-only and visually muted. Use Change trolley to select a permanent reference, or create a trolley in Trolleys. The field follows that selection and remains part of FormData; saving uses the selected workspace trolley and captures its reference when Save is pressed. Register viewing filters do not affect this destination.

## Rescan toggle

Trolley rescan now uses a rounded scanner control with On/Off state and the scan station's blue palette. Its checkbox semantics, keyboard operation, pending-operation restrictions and paused normal draft are retained. The header wraps on narrow screens.

These controls reuse existing Firebase APIs and rules; no additional rule publication is required for this update.
