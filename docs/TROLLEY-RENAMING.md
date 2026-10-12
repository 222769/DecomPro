# Trolley renaming and equipment removal

Open Trolleys, choose **Rename / edit trolley** on an open trolley, enter a distinct name, and save. Its UUID, TSU reference, barcode link, inventory, ownership and collection assignment stay unchanged. Ready trolleys must be reopened first; collected history remains locked.

The permanent trolley ID is authoritative. Existing shared equipment retains its historical stored name until its next edit; the register, exports and cached backups resolve the current name using its trolley ID. Equipment audit revisions retain the original facts. Name changes use the existing version-checked trolley write and audit trail. Legacy shared records without trolley IDs must be assigned to the permanent reference before renaming.

Remove opens an in-app confirmation rather than a browser popup. Cancel preserves the item. Confirm removes the item from the register and future exports; Firebase retains its soft-deleted record and immutable audit. Errors remain beside the confirmation button with retry available. Ready/collected trolley protections, membership checks and record-version checks still apply.

## Publish updated Firestore rules

Shared renaming requires the bundled `database/firestore.rules` update. In DecomPro's Database area, copy the latest Firestore rules, then paste and Publish at:

https://console.firebase.google.com/project/decompro-236e9/firestore/databases/-default-/security/rules

The update permits audited name changes on open trolleys only. Permanent IDs/references remain immutable. An old equipment snapshot name does not block editing/removing its record, while the submitted name must match the current destination trolley. Inventory version advancement, serial claims and audit requirements remain enforced.
