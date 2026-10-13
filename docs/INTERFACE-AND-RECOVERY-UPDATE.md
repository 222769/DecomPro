# Interface and recovery update

## Using the changes

- The main Excel button shows the number of items in its trolley, collection or whole-register scope. Its tooltip names that scope. Searching does not change it. Tick items and use **Export selected (N)** to download only the checked equipment, including any checked items hidden by a later search.
- **Forgot password?** in the signed-out Database panel requests a Firebase password-reset email after the user enters their account email. The result deliberately does not disclose whether an account exists. This uses Firebase Authentication and does not require a Cloud Function or Blaze plan.
- Edit equipment now offers existing trolleys by permanent ID/reference. A typed trolley name cannot silently create a new trolley. Locked trolleys still require the existing unlock workflow.
- Collections now has an active navigation marker. Dashboard content is concentrated on Overview; Register, Collections, Review and History suppress unrelated scanning content. The station retains its register below the capture controls for quick checking. Drafts remain mounted and preserved when navigating.
- Scanner wording now describes double **Enter** in an empty field. The physical Honeywell trigger and printable skip-command proposal are unchanged.

## Private team historical spreadsheets

An administrator signs in, enables Trolley rescan, loads a previous decom Excel file, then chooses **Share loaded spreadsheet with team**. Other active team members can search its serial, barcode, security etch or asset number without loading the source file on their own device. Registered equipment takes priority, then this device's loaded spreadsheet rows, then the private team archive. Historical matches still require review and confirmation before adding equipment. Recognition training remains separate.

Each upload stages immutable rows under a new generation, then changes the file's manifest only after all rows are committed. An interrupted upload leaves the previous published version usable. Concurrent replacement of the same file fails with a review message. Re-uploading the same filename replaces the active lookup generation. Old generations remain retained; they are not searched. The archive stores only the eleven DecomPro equipment fields, filename, sheet and row, within the signed-in team's Firestore path. It is never included in the public website bundle.

Limits: 5,000 rows per workbook, up to 100 published file names searched. Searches use exact identifier indexes, request at most 101 results per file, and require a more specific identifier if more than 100 rows match. Searches and uploads consume normal Firestore read/write/storage quota. No new Cloud Functions or paid hosting service are introduced; this does not guarantee unlimited usage within the free quota. Old and abandoned generations remain in Firestore until an administrator cleans them up through a separate maintenance process.

A browser backup preserves that device's loaded local workbooks, not the full team archive. The shared archive is stored in Firestore. Loading a local workbook alone does not publish it; sharing is a separate administrator action.

## Deleted equipment

Collection register → **Deleted equipment** opens recoverable records. In a shared workspace this is an administrator-only operation, backed by Firestore rules. Existing shared tombstones can be recovered. In local mode, removals from this update onward are retained in the browser workspace and JSON backups; earlier local removals cannot be reconstructed.

Review the record, choose an open destination trolley, then choose **Restore item**. The original record ID, equipment details, disposal date and technician attribution are retained. A shared restore advances the record version and records an immutable restore revision, reclaiming its serial reservation. Reused serials, existing IDs, conflicting assets seen in the current register, unavailable destinations and stale revisions block restoration. Local recovery is committed with the register update in one workspace write. Shared serial uniqueness is enforced transactionally; asset duplicate checking uses the fresh register snapshot, as in existing equipment workflows.

## Required Firebase update

Publish the repository's updated `database/firestore.rules` before using shared historical lookup or shared recovery. Existing rules deny both capabilities. The ordinary scan/save workflow continues to use the existing equipment path.

1. In DecomPro, sign in as an administrator and open **Database**.
2. Choose **Copy latest Firestore rules**.
3. Open the Firebase project `decompro-236e9`, then **Build → Firestore Database → Rules**.
4. Replace the rules with the copied content and choose **Publish**.
5. Refresh DecomPro and test one historical identifier from another team device.

The new paths allow active team members to read historical data and only administrators to upload it. Shared restoration is administrator-only, retains facts, and preserves existing revision, trolley and serial constraints. No public-read rule is added.
