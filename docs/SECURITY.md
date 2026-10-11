# DecomPro security

## Security update — 11 October 2026

The website has a Content Security Policy that only runs JavaScript served by the app. Inline event handlers and external scripts are blocked. Connections are limited to the same origin and Firebase/Google API hosts used by the app. Object embeds, altered base URLs and external form submission are blocked. The referrer policy suppresses page URLs on outgoing requests. Startup recovery and theme selection are embedded in the page with exact SHA-256 hashes in the script policy. Arbitrary inline scripts and event handlers remain blocked; recovery does not depend on another script downloading.

Shared equipment is not rendered or available for export until Firebase sign-in and a server membership check succeed. Reopening a shared workspace checks membership again. Existing cached records and unfinished scans remain stored. Network loss during an already verified session retains the working view; reconnect before saving. Public local-only workspaces keep their existing behavior.

Rejected team sign-ins are signed out of Firebase. Failed initial workspace loads also sign out. Password fields are cleared on failed connection and when the dialog closes. Membership and authentication listeners lock the workspace if the signed-in identity, role, disposal initials or active membership changes. Firestore rules remain the authority for every shared read and write.

Firestore writes reject equipment payload fields the app does not support and limit equipment text and imported reference facts to 1,000 characters, matching browser workspace validation. Ordinary technicians can read individual member documents for audit names but cannot list all memberships. Administrators can list them. Membership writes, privilege escalation, cross-team access, unauthenticated reads, unaudited edits and changes to collected inventory remain forbidden.

Known production dependency advisories were resolved through scoped overrides: `@grpc/grpc-js` 1.14.6 or newer, ExcelJS's UUID dependency 11.1.1 or newer, and the prepared functions package's UUID dependency 11.1.1 or newer. These avoid downgrading Firebase or ExcelJS. Both production dependency audits reported zero advisories at verification time. No account function has been deployed as part of this update.

Credential-like filenames, environment files and private key files are ignored by Git. A scan of tracked files and credential-like paths in the available Git history found no service-account private keys committed. Firebase's public web configuration is intentionally shipped with the app; it is not an admin credential.

## Publish the database protection

After the GitHub Pages deployment finishes:

1. Sign in to DecomPro as an administrator.
2. Open **Database → Copy latest Firestore rules**.
3. In Firebase project **decompro-236e9**, open **Cloud Firestore → Rules**.
4. Replace the rules with the copied version and select **Publish**.
5. Return to DecomPro and select **Check connection** and **Refresh collections**.

Pushing GitHub changes does not publish Firebase rules. The updated rules were verified in the Firestore emulator; they have not been verified as published to the live project by this environment.

## Remaining controls

- Browser storage and downloaded Excel/JSON/PDF files are unencrypted. The sign-in gate protects the app interface, not against someone with access to the device, browser developer tools or profile files. Use managed devices and sign out when finished. A downloaded backup remains readable without signing in.
- Sign-in defaults to Firebase browser-session persistence. Remember me is an explicit trusted-device option. Manual or inactivity locking signs out and sets a persistent lock marker, so refreshing cannot automatically reopen a locked workspace. Browser session restoration can retain session storage; lock or sign out when leaving a shared device.
- Spreadsheet reference facts previously approved for bundling remain public in the website and source. Making the repository private would not make bundled website assets private.
- GitHub Pages does not let this repository set custom HTTP response security headers. The meta policy cannot enforce `frame-ancestors`, HTTP HSTS or `X-Content-Type-Options`. A hosting proxy or a future cPanel deployment can supply these headers.
- Restrict Firebase Authentication's authorized domains to the domains actually used, enforce HTTPS in GitHub Pages, protect administrator Google/GitHub accounts with MFA, and enable GitHub secret scanning/push protection where available.
- Revoke previously shared service-account keys in Google Cloud IAM if they are no longer needed. The app uses Firebase web authentication and does not require an Admin SDK key in its public website.

## Verification

Security checks include script injection attempts, unavailable shared membership, password cleanup, cross-team and revoked access, oversized and forged records, shared audit retrieval, and auth/membership listener invalidation. Existing scanning, Excel imports/exports, PDFs, backups, collection grouping and dark-phone workflows are also exercised. Production builds and both production dependency audits are checked separately from emulator tests. Passing these checks is not a claim that every possible security flaw has been eliminated.

Final validation: **93 browser tests, 47 unit tests, 21 database emulator tests and 10 account/auth emulator tests passed** (171 total). The production build passed, and desktop/phone production checks showed no runtime errors or horizontal overflow while the shared sign-in gate preserved unfinished scans. Both production dependency audits reported zero known advisories. Functions-emulator warnings about unconfigured Authentication triggers did not prevent the account tests from executing and passing.

## Shared-device controls

Use **Lock workspace** in the top toolbar or **Settings → Device security → Lock workspace now**. The app signs out, hides the shared register, and preserves accepted scan fields plus any partly typed current scan input. Sign in with a password to continue. Locking one tab also locks other open shared-workspace tabs. An already submitted server write may finish after locking; the next sign-in retrieves confirmed records.

Inactivity locking defaults to five minutes; Settings offers 5, 10, 15 or 30 minutes. Scanner keyboard input, pointer presses and form input count as activity. Returning from a background tab checks elapsed inactivity. Device security preferences are stored separately from workspace backups. Local-only profiles do not provide authenticated locking.
