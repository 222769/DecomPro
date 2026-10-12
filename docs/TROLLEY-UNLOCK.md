# Unlock trolleys for corrections

Ready trolleys can be reopened through Trolleys → Reopen trolley. Collected trolleys can now be unlocked by a team administrator through Trolleys → Unlock trolley. The Remove equipment dialog also offers an unlock shortcut when contents are locked.

Enter a reason and acknowledge that the collection status is being reversed. Unlocking returns the trolley to Open and clears its current readiness/collection flags so equipment can be removed, moved or edited and the trolley can be renamed. The permanent reference, barcode, ownership and inventory stay unchanged. Trolley deletion still requires an empty, unassigned trolley with DELETE and acknowledgement.

For a linked handover, all linked trolleys unlock together. Fresh versions are checked and shared changes commit atomically. A stale or incomplete handover is rejected. A technician cannot unlock a collected shared trolley, including through direct database writes.

Previous collection metadata, actor and reason are retained in immutable Firebase trolley revision documents. Local workspaces retain equivalent snapshots in trolleyUnlocks, including reloads and JSON backups. After corrections, run readiness checks again and mark the trolley collected when appropriate. Earlier printed handover documents describe the previous inventory/status; generate a new pack after correcting it.

## Publish rules before shared unlocks

After the GitHub Pages deployment, sign in as administrator and open Database → Copy latest Firestore rules. In Firebase project decompro-236e9 → Cloud Firestore → Rules, replace the editor contents and Publish. Existing permissions remain; only administrators gain the explicit audited collected-to-open transition. Unauthorised unlocks, unrelated payload changes and partial linked-group unlocks are rejected.

Validation covers local cancellation and storage failures, preserved references/inventory/drafts, removal after reload, shared permission errors and retry, administrator/technician access, immutable reason history, stale versions and six-trolley atomic unlocking within Firestore access limits.

## Change status from one control

Every trolley card now has Change status, showing the current status with a selector for Open, Ready for collection and Collected. Open → Ready opens the readiness checks and requires physical confirmation. Ready → Collected opens the company/pickup confirmation. Ready → Open reopens for editing. Collected → Open uses the administrator unlock and reason flow, including linked-group handling. Collected → Ready requires unlocking to Open and checking readiness again. Open → Collected requires readiness first. Cancelling a choice does not update records.

The control uses the existing status APIs, checks versions when reopening a shared trolley and leaves item identity and scan progress unchanged. It introduces no additional Firestore rule changes beyond the unlock rules above.
