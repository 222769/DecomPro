# Delete a named collection

Open **Collections**, find the collection and select **Delete collection**. The dialog shows the collection name and its current equipment/trolley counts.

Deletion requires both:

- Enter exactly **DELETE** (uppercase, without extra spaces).
- Tick the acknowledgement that the collection and its unfinished scan will be removed while equipment and trolleys remain.

The button is disabled until both requirements are met. Cancel leaves data unchanged. Controls are disabled while deletion is being confirmed; a failure preserves the dialog for review or retry.

Deleting a collection removes its name from collection views and releases its trolley assignments. Saved equipment, permanent trolley references, physical ready/collected statuses, pickup history and equipment scan-order numbering remain. The selected collection's browser scan checkpoint is removed. If it is the active collection, the general scan session is restored, including its previously saved checkpoint when present.

Local workspaces allow deletion by their local operator. Shared Firebase workspaces require an active **administrator** membership, enforced in the Firestore rules as well as the interface. A stale collection revision must be reopened and reviewed before deletion. Saving an item must finish before deletion can be opened.

## Firebase setup

Publish the updated `database/firestore.rules` before deleting shared collections:

1. In DecomPro, open **Database** as an administrator and select **Copy latest Firestore rules**.
2. Open Firebase project **decompro-236e9 → Cloud Firestore → Rules**.
3. Replace the rules editor contents with the copied rules, then select **Publish**.
4. Return to DecomPro and refresh collections before deleting.

No Cloud Functions, paid plan, or migration of existing documents is required. Existing collections remain compatible.

Shared deletion is an audited logical deletion. Firestore retains the collection document with `deleted: true` and an immutable revision, while the transaction releases its trolley assignments. Deleted collections cannot be edited or revived through the client. The application filters these documents from active collection views; grouping history remains available in the database audit. Equipment and trolley documents are not deleted. The release of up to 12 trolley assignments was tested within Firestore's access limits.

The available execution environment cannot publish the rules to the live project. The interface, client transaction and rules were tested locally and with the Firestore emulator.

Verification: 131 browser tests, 50 unit tests, 23 Firestore emulator tests, and three production-build deletion scenarios passed. The production build succeeded. Checks include confirmation/cancellation, failed writes and retries, administrator enforcement, stale revisions, immutable deletion audit, release/reuse of 12 trolley assignments, remote deletion reconciliation, and preservation of another collection's active input.
