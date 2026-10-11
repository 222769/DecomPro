# Named collection sessions

Collections organise work such as **Summer 2026** or **October clear-out**. Equipment belongs to a collection through its trolley; collection grouping does not rewrite serials, disposal dates, technician attribution, readiness or collection history.

## Start or continue a collection

1. Open **Collections → Create collection**, enter a name and select its existing trolleys. Up to 12 trolleys can be assigned to a collection. A trolley can belong to only one collection.
2. The new collection becomes your active scan session. Its first open trolley is selected for new records.
3. Use **Change trolley** to scan into another open trolley belonging to that collection. Create new trolleys through **Trolleys**, then assign them with **Manage collection trolleys**.
4. **Pause session** saves your accepted scan fields and batch defaults in this browser. **Resume session** restores them. Switching to another collection keeps independent saved progress; returning restores the previous draft. **General scan session** restores your scan outside a named session; trolley ownership continues to determine record grouping.
5. The collection cards show equipment totals, unresolved readiness checks, open/ready/collected trolleys and collected item totals. A collection is labelled Collected only when it contains at least one trolley and all of its trolleys have been collected. These totals are recorded progress; the app does not invent a target count for unsorted basement equipment.

Names/grouping and equipment are shared in Firebase. Unfinished scans and the active/paused selection remain personal to this browser, keyed to the signed-in account when connecting to a shared team. Workspace backups retain collection grouping and every saved scan checkpoint. Recovering a draft on another device requires its backup; this release does not sync unfinished drafts to Firebase.

## Imports, inventory and exports

- **Import equipment Excel** adds rows to the selected trolley, which automatically puts those records in the trolley’s collection. Historical model details remain excluded from recognition until checked. The separate Settings importer continues teaching recognition without adding inventory.
- **View collection inventory** and the register’s **Collection inventory** filter show equipment from that collection’s trolleys. A scanned trolley barcode opens its own inventory and takes priority over the collection filter. Viewing a collection does not switch or clear the active scan.
- **Export collection Excel** exports all saved equipment from the collection, including its ready and collected trolleys, using the existing supplier columns. Searches and missing-detail filters do not restrict the export. Shared exports retrieve equipment and grouping from Firebase and fail clearly if the server cannot confirm them; cached equipment remains intact.
- Existing trolleys with historical equipment can be grouped through the same editor. To move a trolley to another collection, remove its assignment from the current collection, save, then add it to the new collection. Physical trolley status and equipment move history remain unchanged.
- Importing a preserved local workspace into Firebase currently transfers equipment/trolleys through the existing admin importer. Afterwards, create the shared collections and assign those trolleys; local collection metadata is not uploaded automatically.

## Enable shared collections in Firebase

This feature adds protected `teams/{team}/collectionSessions` and `collectionTrolleys` paths. Existing equipment/trolley/reference permissions are retained. Collections load separately, so unpublished collection rules do not disconnect or lock the existing equipment database.

After the website update is deployed:

1. Sign in as a DecomPro team administrator and open **Database**.
2. Select **Copy latest Firestore rules**. If automatic clipboard access is unavailable, select and copy the displayed rules.
3. In [Firebase → Cloud Firestore → Rules](https://console.firebase.google.com/project/decompro-236e9/firestore/rules), replace the editor content with the copied rules and select **Publish**.
4. Return to DecomPro and select **Refresh collections**. Each device also loads collections when reconnecting to the team.

The copy button bundles the tested `database/firestore.rules` file; it does not contain private credentials. Rules deployment was attempted with the configured credential and the previously uploaded service account, but the CLI failed to authenticate, so live rules publication remains a console step.

## Validation and implementation limits

Membership is required for collection reads and writes. Shared trolley ownership changes use transactions, owner checks and collection version checks; concurrent collection creation cannot claim the same trolley twice. Collection revisions are immutable, and assignment changes must accompany an authorised session update. Active-session equipment saving checks the current trolley assignment inside its Firebase transaction.

Changes are limited to 12 trolley links per save to remain within Firestore rule access limits. For a complete replacement of a full collection, detach old trolley assignments and save before adding replacements. Collected trolleys may be grouped as historical metadata without changing their locked equipment or physical status.

Tests exercise independent drafts, pause/reload/resume, backup recovery and malformed checkpoint rejection, failed browser storage, collection-only supplier exports, legacy Excel imports, fresh shared export failures, unpublished rules recovery, shared ownership races, immutable history and the 12-trolley permission boundary. Browser checks use Chromium, including a phone-width viewport; physical iOS Safari is not verified. Shared database checks use the Firestore emulator, rather than live college equipment.

Final verification: 88 browser tests, 45 unit tests and 19 Firestore emulator tests passed. The production build also passed; a production preview at 390px restored a paused serial after reload, reported no page/resource errors and had no horizontal page overflow.
