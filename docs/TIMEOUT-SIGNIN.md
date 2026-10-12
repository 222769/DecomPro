# Sign-in after an inactivity timeout

The workspace previously displayed its sign-in screen while Firebase sign-out was still pending. A new sign-in could overlap that older sign-out and lose its authenticated session during verification.

New sign-ins wait for the current lock/sign-out operation to finish. The button shows **Finishing sign-out…**, then **Signing in…**. Repeated submissions are ignored while verification is pending. If sign-out stalls for 15 seconds, the form gives explicit refresh/retry guidance rather than checking credentials against the pending session. Manual and inactivity locks still hide cached team records and require credentials.

The account email from the locked session is prefilled using memory only. Passwords are never persisted by this change. Failed sign-in clears the password field, keeps the email, and leaves saved equipment and unfinished scans intact. A failed sign-out does not destroy a sign-in form that is already open.

Invalid credentials, inactive team access, expired tokens and network failures retain distinct guidance. A timeout itself does not change Authentication accounts or membership documents. The reported locked-login error accepted the same credentials after returning to local mode. Locked-workspace manual re-login now requests a fresh Firebase authentication session, applying that same sign-out/reset before credential verification without switching workspaces. Remembered-session startup retains its existing session.

Validation includes slow/successful/failed/stalled sign-out; duplicate submissions; wrong-password rejection and correction; membership rejection and retry; profile attribution; draft retention; refresh recovery; and existing manual, trusted-device, cross-tab and Never timeout behavior. A real Firebase SDK test against the Auth/Firestore emulators signs a technician out and back in repeatedly with the same credentials, checks the account remains enabled, rejects an incorrect password, and reconnects successfully with the correct password.

When an already connected account is explicitly reauthenticated, the app stops its old listeners and preserves the typed scan first. A rejected attempt locks the cached workspace and displays a retry form with the error and email retained.

This update requires no additional Firestore rule changes or live account/password changes.

The real SDK regression also checks that fresh re-login clears a cached identity, an incorrect password leaves no authenticated identity behind, correct credentials reconnect, and remembered startup does not reset authentication. The live college account was not inspected or modified.

Current verification: 174 browser tests, 12 account/emulator integration tests, 62 unit tests and 13 production security scenarios passed. Production build succeeded.
