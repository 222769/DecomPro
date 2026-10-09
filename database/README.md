# Shared Firebase database

Firestore is the shared database; Firebase Authentication supplies account identities. GitHub Pages serves the static interface. Local technician profiles are not used as authenticated identities in Firebase mode.

## Validation status

The integration and rules are prepared. A live Firebase project has not been connected or verified. The emulator download is currently blocked by the cloud environment's network policy for `storage.googleapis.com`, so the four database/rules tests have not run. Run and pass these tests before using the rules with real team records:

```sh
npm ci
npm run test:database
```

The test command starts a local Firestore emulator using a demo project; it does not deploy anything. It tests denied access, role escalation, transactional records/revisions, serial uniqueness, concurrent edits, retained removal history, escaping serial keys, and idempotent reference imports. Java 21 or later is required. In the current cloud workspace, use writable cache paths:

```sh
XDG_CONFIG_HOME=/workspace/.firebase-config FIREBASE_EMULATORS_PATH=/workspace/.firebase-emulators npm run test:database
```

The needed network domain has been saved in the environment configuration draft. Saving that draft does not itself apply networking changes. The **Validate Firebase database** GitHub Actions workflow also runs these tests on pushes and pull requests; its result must be checked before deploying the rules. A submitted workflow is not evidence that its tests passed.

## Configure the project after validation

1. Create a college-approved Firebase project, or use an existing approved project. Firestore and email/password Authentication are sufficient; this integration does not require Cloud Functions, Analytics, or paid services. Review current Firebase plan limits before importing large datasets. A free allowance is not an unlimited service or a guarantee of zero cost.
2. Register a **Web app** and obtain its public `apiKey`, `authDomain`, `projectId` and `appId`. These identify the client project and are designed to appear in browser code. Never provide service-account JSON, private keys or admin credentials to the app.
3. Enable **Authentication → Sign-in method → Email/Password**. Add technician accounts through your approved admin process. Add your deployed domain (for GitHub Pages, `222769.github.io`) to authorized domains where required. Do not send passwords in chat.
4. Create the Firestore database in the region approved by your college. Use production/deny access defaults initially. After the emulator tests pass, deploy `firestore.rules` from this directory using the Firebase CLI (`firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`) or publish it in the Firebase console Rules editor. The app does not deploy rules for you.
5. Choose a team ID, for example `college-it`. In the console create `teams/college-it` with a name field, then create `teams/college-it/members/USER_UID` for each Firebase Authentication user. Each member document contains exactly:

```json
{"displayName":"Technician name","code":"Disposal initials","role":"technician","active":true}
```

Use `role: "admin"` for your first administrator. Bootstrap membership in the trusted console; the public app cannot grant its first user admin access. `code` is what appears in the supplier's disposal column. Keep codes unique within your team. Set `active: false` to revoke a member's team access. Rules deny non-members, inactive members and unauthenticated visitors. Members can read their team's records; administrators can manage membership. The app currently uses the console for account and membership administration.

6. Open **Database** in DecomPro. Paste the public Web app configuration as valid JSON, enter the team ID, then sign in with the technician's email/password. The membership document controls the displayed name/code. The chosen local profile cannot impersonate a shared account.
7. Import the original XLSX once through **Settings → Import reference spreadsheet** while connected. This uploads only usable serial/model/manufacturer examples, not the entire supplier workbook or its finance/personnel data. Other connected members receive the references automatically.
8. An administrator can explicitly import their preserved local register through **Import local equipment**. Imported historical disposal initials are retained and marked as historical; the authenticated importing user is recorded as the creator. Duplicates/conflicts are not overwritten. Partial import failures leave the preserved local data available.

## Stored data and concurrency

- `teams/{team}/equipment/{id}`: full supplier payload, record version, creation/update identity, server timestamps, deletion flag and last revision ID.
- `equipment/{id}/revisions/{revision}`: immutable before/after snapshots, actor, action and server time. Removal is a soft deletion and retains history.
- `teams/{team}/serials/{key}`: canonical uppercase serial claim. Equipment and serial claim updates commit in the same Firestore transaction; rules bind the key to the actual serial, preventing another member from choosing a different key to bypass uniqueness. `N/A` has no unique claim. Slash/tilde characters are escaped rather than restricting manufacturers' serial formats.
- `teams/{team}/references/{id}`: deduplicated spreadsheet facts and importing user/time. Conflicting labels can coexist and stop automatic recognition.
- `teams/{team}/members/{uid}`: trusted name, initials, active state and role.

Records use optimistic versions: a stale edit is rejected instead of overwriting another technician's update. Shared records and references have realtime listeners. All shared writes require an authenticated, active team member. Rules also require each record change to include an immutable audit revision, and protect the original disposal attribution against changes by ordinary client edits.

## Local preservation and disconnected operation

Connecting preserves the local workspace separately before displaying shared data. The local workspace is not uploaded without an administrator's explicit import. Signing out restores that preserved workspace. JSON restore is disabled while using shared records, so it cannot accidentally replace a team's database.

Shared drafts remain in this browser's local cache, and remote writes must succeed before a draft is cleared. If reconnecting fails, the cached team register becomes read-only until reconnection or a return to local mode. This is not an offline synchronization queue: shared saves require a working connection, and a transaction may wait or fail during an outage. Do not assume a save succeeded until it is confirmed. For reliable fully offline shared operation, an outbox/reconciliation workflow remains future work.

Exports and backups contain the inventory data visible to the authenticated team member. They are not database backups with point-in-time recovery. Configure a college-approved backup/retention process for the live Firestore database separately.
