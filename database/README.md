# Shared Firebase database

Firestore is the shared database; Firebase Authentication supplies account identities. GitHub Pages serves the static interface. Local technician profiles are not used as authenticated identities in Firebase mode.

## Validation status

The eight database/rules tests pass against the local Firestore emulator, including trolley creation, department changes, conflict handling, collection locks, immutable history, realtime updates between two independent team clients, and offline loading/reconnection. Live Firebase authentication and member reads have been verified for project `decompro-236e9`. The reference-review rules were published on 10 October 2026 and verified against the tested source; signed-in member reads of equipment, references, trolleys and reference corrections returned HTTP 200. Future rule changes must also be deployed to that project; emulator checks alone do not publish them. Run the tests before deploying future rule changes:

```sh
npm ci
npm run test:database
```

The test command starts a local Firestore emulator using a demo project; it does not deploy anything. It tests denied access, role escalation, transactional records/revisions, serial uniqueness, concurrent edits, retained removal history, escaping serial keys, idempotent reference imports, trolley lifecycle changes, and denied equipment changes after collection. Java 21 or later is required. In the current cloud workspace, use writable cache paths:

```sh
XDG_CONFIG_HOME=/workspace/.firebase-config FIREBASE_EMULATORS_PATH=/workspace/.firebase-emulators npm run test:database
```

The **Validate Firebase database** GitHub Actions workflow also runs these tests on pushes and pull requests. Check its result before deploying the rules to the live project.

## Configure the project after validation

The supplied public Web app configuration for **decompro-236e9** is bundled in `src/firebase-config.js` and prefilled in the Database dialog. A previously saved browser configuration takes precedence. Users still need to sign in; adding the configuration does not create accounts, enable Firestore, grant membership, or deploy rules. Analytics is not initialized: the inventory workflow uses Authentication and Firestore.

1. Create a college-approved Firebase project, or use an existing approved project. Firestore and email/password Authentication are sufficient; this integration does not require Cloud Functions, Analytics, or paid services. Review current Firebase plan limits before importing large datasets. A free allowance is not an unlimited service or a guarantee of zero cost.
2. Register a **Web app** and obtain its public `apiKey`, `authDomain`, `projectId` and `appId`. These identify the client project and are designed to appear in browser code. Never provide service-account JSON, private keys or admin credentials to the app.
3. Enable **Authentication → Sign-in method → Email/Password**. Add technician accounts through your approved admin process. Under **Authentication → Settings → Authorized domains**, add `decompro.hxali.com` and keep `222769.github.io` for the original Pages address. Enter hostnames only, without `https://` or a path. Do not send passwords in chat.
4. Create the Firestore database in the region approved by your college. Use production/deny access defaults initially. After the emulator tests pass, deploy `firestore.rules` from this directory using the Firebase CLI (`firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`) or publish it in the Firebase console Rules editor. The app does not deploy rules for you.
5. Choose a team ID, for example `college-it`. In the console create `teams/college-it` with a name field, then create `teams/college-it/members/USER_UID` for each Firebase Authentication user. Each member document contains exactly:

```json
{"displayName":"Technician name","code":"Disposal initials","role":"technician","active":true}
```

Use `role: "admin"` for your first administrator. Bootstrap membership in the trusted console; the public app cannot grant its first user admin access. `code` is what appears in the supplier's disposal column. Keep codes unique within your team. Set `active: false` to revoke a member's team access. Rules deny non-members, inactive members and unauthenticated visitors. Members can read their team's records; administrators manage membership through the authenticated account service. Direct browser membership writes are denied. The app uses the Firebase console for account and membership administration. Administrators can open **Database → Team access checklist** for the exact setup steps and a server-confirmed list of active and inactive memberships. The checklist does not create Authentication users or assign access automatically.

For the first account, copy its **User UID** from **Authentication → Users**. In **Firestore Database → Data**, start collection `teams`, give its document the ID `college-it`, and add a string field `name` such as `IT Decommissioning`. Open that document and start subcollection `members`. Use the copied UID as the member document ID (not the email address or an automatically generated ID). Add these four fields:

| Field | Firestore type | Value |
|---|---|---|
| `displayName` | string | Your name |
| `code` | string | Your disposal initials |
| `role` | string | `admin` for the first administrator |
| `active` | boolean | `true` |

The first membership path is `teams/college-it/members/YOUR_AUTH_USER_UID`. For Jawad, create a separate Authentication user and a separate member document with his UID, `displayName` of `Jawad`, `code` of `JA`, `role` of `technician`, and boolean `active` of `true`. These console steps can be completed while rules validation is pending; keep production/deny access rules until validation passes.

6. Open **Database** in DecomPro. Paste the public Web app configuration as valid JSON, enter the team ID, then sign in with the technician's email/password. The membership document controls the displayed name/code. The chosen local profile cannot impersonate a shared account.
7. Import the original XLSX once through **Settings → Import reference spreadsheet** while connected. This uploads only usable serial/model/manufacturer examples, not the entire supplier workbook or its finance/personnel data. The import preview shows new facts, duplicates, conflicting details and incomplete rows before saving. Only selected usable facts are uploaded; conflicting selections require a checked confirmation. Shared imports re-read server evidence before writing and ask for another review if selected evidence changed. Other connected members receive the references automatically.
8. An administrator can open **Database → Import local equipment** to preview the preserved local register. The preview identifies ready items, identical items already saved, conflicting IDs/serials, repeated local serials and unavailable trolleys. Confirm **Import ready items** to save eligible historical records; the authenticated importing account is audited and the original disposal initials stay attached. The import rechecks server data before writing, never overwrites existing equipment, explains individual failures and can retry the remaining rows without rewriting successful ones. Cancel makes no changes. Ready trolleys start open for a fresh review. Historical collection details are restored only when the complete shared trolley inventory matches the local records; a failed history write can be retried separately. Your preserved local register stays unchanged. Import spreadsheet references separately through Settings; review local corrections in the shared reference library rather than silently applying them during equipment transfer.

## Stored data and concurrency

- `teams/{team}/equipment/{id}`: full supplier payload, record version, creation/update identity, server timestamps, deletion flag and last revision ID.
- `equipment/{id}/revisions/{revision}`: immutable before/after snapshots, actor, action and server time. Removal is a soft deletion and retains history.
- `teams/{team}/serials/{key}`: canonical uppercase serial claim. Equipment and serial claim updates commit in the same Firestore transaction; rules bind the key to the actual serial, preventing another member from choosing a different key to bypass uniqueness. `N/A` has no unique claim. Slash/tilde characters are escaped rather than restricting manufacturers' serial formats.
- `teams/{team}/references/{id}`: deduplicated spreadsheet facts and importing user/time. Conflicting labels can coexist and stop automatic recognition.
- `teams/{team}/referenceCorrections/{id}`: canonical serial, reviewed correction/exclusion/restoration, reason, optimistic version and authenticated write metadata. Administrators write; active members read. Its `revisions` subcollection retains immutable before/after history. Original reference facts and equipment records remain intact.
- `teams/{team}/trolleys/{id}`: permanent reference, name, owning department, open/collected status, collection company/time/initials, optimistic version and authenticated write metadata. Its `revisions` subcollection retains immutable before/after history.
- `teams/{team}/members/{uid}`: trusted name, initials, active state and role.

Records use optimistic versions: a stale edit is rejected instead of overwriting another technician's update. Shared records and references have realtime listeners. All shared writes require an authenticated, active team member. Rules also require each record change to include an immutable audit revision, and protect the original disposal attribution against changes by ordinary client edits.

## Local preservation and disconnected operation

Connecting preserves the local workspace separately before displaying shared data. The local workspace is not uploaded without an administrator's explicit import. Signing out restores that preserved workspace. JSON restore is disabled while using shared records, so it cannot accidentally replace a team's database.

Shared drafts remain in this browser's local cache, and remote writes must succeed before a draft is cleared. If reconnecting fails, the cached team register becomes read-only until reconnection or a return to local mode. This is not an offline synchronization queue: shared saves require a working connection, and a transaction may wait or fail during an outage. Do not assume a save succeeded until it is confirmed. For reliable fully offline shared operation, an outbox/reconciliation workflow remains future work.

Exports and backups contain the inventory data visible to the authenticated team member. They are not database backups with point-in-time recovery. Configure a college-approved backup/retention process for the live Firestore database separately.

## Trolley migration and labels

New shared equipment writes require a registered open trolley ID and matching trolley name. Existing equipment without an ID remains readable; editing it in the updated app assigns a registered ID. Marking a trolley collected first links matching legacy shared records to its ID so the database can enforce their inventory lock. If several trolleys share that name, collection stops and requires assigning those legacy items to the correct reference. Collected trolley records cannot be reopened or deleted through the app. PDF barcodes encode the permanent reference; QR codes select the ID in the website URL and require the same team workspace on another device.

Local equipment imports create trolley records first, import their equipment, and restore historical collection details only when that trolley's equipment import has no failures. An administrator's import preserves historical initials while audit revisions identify the actual importing account. Failed rows remain in the preserved local workspace.

## Confirm the live team connection

Publish the tested `database/firestore.rules` in the Firebase project's Firestore Rules editor. Emulator success verifies the tested rules and client workflow; it does not establish that the live project has the same configuration. Use the server connection check below on your devices.

After the Pages deployment succeeds:

1. Open the same DecomPro website on two devices. Sign in through **Database** with each technician's Firebase account and team ID `college-it`.
2. On each device select **Database → Check connection**. It reads equipment, trolleys and imported references directly from the server and reports counts. Initial connection also requires server-confirmed data; cached data is not reported as a successful connection.
3. Create a clearly named test trolley on device A, record one test item, and confirm both appear on device B. Attempt the same serial on device B: it should be rejected.
4. Confirm an edit on device B appears on device A, then print the trolley label and scan its barcode on the work device.
5. Mark the test trolley collected. Confirm both devices show its company, date, initials and contents under **Collection history**, and reject changes to its equipment. Retain this identifiable test collection until your retention process determines how to handle it.
6. Disconnect the network. The banner should show **Offline · team changes paused**. Captured progress remains here; saves require reconnection. Restore the network and use **Check connection** to confirm access again.

The connection banner distinguishes local storage, confirmed shared access, cached/reconnecting data and offline operation. Its confirmation time records the most recent server response in this session; it is not a guarantee of uninterrupted connectivity. Browser backups include only the loaded workspace and remain distinct from a complete database backup including revisions and membership.

## Verified recovery workflow

Browser tests restore an actual downloaded workspace backup into a separate browser context and verify equipment, permanent trolley references, imported recognition facts and an unfinished scan survive reload. Database emulator tests exercise two distinct technician accounts: live retrieval, a fresh client login, cross-account edits, original disposal attribution and revocation. These are local checks, not a live test using college accounts. Shared saves show a pending Firebase confirmation and only clear the captured item after the transaction succeeds. Local saves explicitly say that the item is stored in this browser. A JSON backup is a portable workspace copy, not a complete Firestore disaster-recovery backup.

## Administration section

The Admin section creates personal accounts, links existing Firebase users, changes names and roles, activates/deactivates team access and generates private password setup/reset links. The `decomproAdmin` Cloud Function must be deployed before these controls work; GitHub Pages only publishes the interface. See [functions/README.md](../functions/README.md) for deployment, billing prerequisites and validation. The membership schema remains the same four fields. The updated rules deny direct client membership writes and restrict administration audit reads to active administrators. Trusted console bootstrap remains possible.
