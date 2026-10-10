# Future update: migrate DecomPro to MySQL and PHP

Status: planned, not implemented or deployed.
Recorded: 10 October 2026.

## Goal and confirmed hosting

Use the user's existing **MySQL database, cPanel hosting and PHP** to provide shared equipment storage and administrator-managed technician accounts without requiring Firebase's Blaze plan.

Firebase remains the current database. This plan does not change the running application, hosting, authentication or saved records.

## Hosting decision to make

Recommended: host the built DecomPro website and PHP API together on cPanel at `decompro.hxali.com`. Serving both from the same origin simplifies secure cookie-based sign-in.

Alternative: retain GitHub Pages for the website and host the PHP API separately. This requires explicit CORS configuration and a tested authentication approach compatible with browser cookie restrictions.

Neither hosting arrangement has been selected yet. Confirm the hosting location, PHP version, PDO MySQL extension, MySQL/MariaDB version, HTTPS availability, scheduled jobs, email delivery and backup facilities before implementation. Prefer a supported PHP version, at least PHP 8.2, and InnoDB tables with `utf8mb4` encoding.

## Current implementation to replace

- `src/firebase-db.js` supplies shared reads, writes, version checks, listeners, membership checks and administrator calls.
- `src/main.js` contains Firebase connection, sign-in, resume and status messages that must support the new provider.
- `src/admin.js` supplies the administrator interface; retain its behavior while replacing Firebase-specific operations.
- `functions/` contains the Firebase account administration backend. It has been implemented and tested locally but has not been deployed. Its deployment requires Blaze.
- Firestore rules protect the current Firebase data. PHP must enforce equivalent authorization on every request; SQL access alone does not replace those rules.

## Data to preserve

Design relational tables and reviewed migrations for:

- Teams, users and team memberships: names, emails, roles, active access and immutable disposal initials.
- Equipment: existing IDs, serials, asset numbers, model/manufacturer, disposal details, technician attribution, trolley links, review flags and readiness notes.
- Trolleys: existing IDs and unique references, department ownership, readiness, collection status, company and collection attribution.
- Recognition examples, reviewed corrections and their provenance, including spreadsheet imports and learned serial families.
- Available equipment, trolley, reference and membership audit history, revisions and deletion markers.

Preserve all identifiers and historical attribution. Build an explicit identity mapping between Firebase users and SQL users. Distinguish server-owned shared data from browser-only profiles, settings and unfinished scans; do not silently merge a local workspace into the team database.

## PHP backend requirements

- Keep database credentials outside the public web directory and out of GitHub and browser code. Use a database account limited to the application's database.
- Use PDO prepared statements, input validation, transactions, foreign keys and unique constraints.
- Hash passwords using PHP's password APIs. Existing Firebase passwords are not plain text and must not be assumed transferable. Plan technician invitations/password setup and test any supported credential migration separately.
- For same-origin hosting, use secure HttpOnly session cookies, session rotation at login, expiry, logout and CSRF protection for state-changing requests.
- Rate-limit authentication and password-reset attempts; return safe errors without exposing credentials or SQL details.
- Check current active team membership and role on every request. Technicians must not gain access to other teams or administrator operations.
- Support administrator account creation, role/name updates, team deactivation and expiring, single-use password setup/reset links. Never store raw passwords or reset tokens in audit logs.
- Preserve unique disposal initials and prevent administrators from removing their own administrator access accidentally. Revocation must apply to existing sessions.
- Enforce optimistic version checks for concurrent updates, duplicate-serial rules and ready/collected trolley locks on the server.
- Record attributable audit events in the same transaction as each change.
- Replace Firestore listeners with tested polling or another hosting-supported refresh mechanism. Show confirmed saves and connection failures accurately; preserve unfinished scans on failures.

## Delivery phases

1. Confirm hosting capabilities and deployment location. Create an isolated staging database and take a verified Firebase export plus separate browser workspace backups where needed.
2. Define the SQL schema, versioned schema migrations and PHP configuration. Implement authentication, team authorization and administrator account management.
3. Implement equipment, trolley, readiness, collection, recognition and audit APIs with transactions and concurrency checks.
4. Add a MySQL/PHP client adapter and update connection/settings wording. Retain local workspace behavior, scanning, speech, Excel export and PDF trolley labels.
5. Build an explicit import tool with a dry run, mapping report and reconciliation checks. Import copies into staging without deleting or modifying Firebase originals.
6. Test administrator and technician workflows, revoked access, competing updates, failed saves, backups, export and serial recognition. Compare migrated counts and field values, not just totals.
7. Choose a maintenance window, pause Firebase writes, perform and reconcile the final transfer, then switch the application to PHP/MySQL. Avoid simultaneous production writes to two databases.
8. Verify live saves and retrieval on a second device, monitor errors and retain Firebase backups until recovery and retention requirements are satisfied.

## Acceptance checks before switching

- A technician can sign in on another device and retrieve the same equipment and trolley inventory.
- An administrator can create and deactivate accounts; a technician cannot administer users, bypass trolley locks or read another team's records.
- Saved equipment survives browser refresh and sign-out. Failed requests do not clear drafts or report an unconfirmed save as successful.
- Historical IDs, trolley barcodes/links, disposal initials and collection details remain correct.
- Serial recognition retains the existing exact and pattern-based behavior, including reviewed corrections and imported references.
- SQL backups can be restored into a separate database, and equipment/collection exports still work.

## Backup and rollback

Use scheduled database backups stored separately from the hosting account where possible. Choose retention with the college and test restoration. A database on the same hosting account is shared storage, not an independent backup by itself.

Keep the pre-migration Firebase export and prior deployable frontend. If SQL has received new production writes, reconcile those writes before rolling back; merely switching the frontend back to Firebase could lose or hide work recorded after migration.

## Information needed later

- Final frontend/API domain and public web directory.
- Hosting versions, database name and permissions, supplied securely during deployment.
- Administrator bootstrap identity and password setup/email delivery approach.
- Existing Firebase export availability, browser-only workspaces to preserve and backup retention requirements.

Do not place private keys, database passwords or technician passwords in this document or the repository.
