# Sign-in after an inactivity timeout

The workspace previously displayed its sign-in screen while Firebase sign-out was still pending. A new sign-in could overlap that older sign-out and lose its authenticated session during verification.

New sign-ins wait for the current lock/sign-out operation to finish. The button shows **Finishing sign-out…**, then **Signing in…**. Repeated submissions are ignored while verification is pending. If sign-out stalls for 15 seconds, the form gives explicit refresh/retry guidance rather than checking credentials against the pending session. Manual and inactivity locks still hide cached team records and require credentials.

The account email from the locked session is prefilled using memory only. Passwords are never persisted by this change. Failed sign-in clears the password field, keeps the email, and leaves saved equipment and unfinished scans intact. A failed sign-out does not destroy a sign-in form that is already open.

Invalid credentials, inactive team access, expired tokens and network failures retain distinct guidance. A timeout itself does not change Authentication accounts or membership documents. This fix addresses a reproducible sign-out overlap; the reported live account's exact error still needs identifying if it persists after deployment.

Validation includes slow/successful/failed/stalled sign-out; duplicate submissions; wrong-password rejection and correction; membership rejection and retry; profile attribution; draft retention; refresh recovery; and existing manual, trusted-device, cross-tab and Never timeout behavior. A real Firebase SDK test against the Auth/Firestore emulators signs a technician out and back in repeatedly with the same credentials, checks the account remains enabled, rejects an incorrect password, and reconnects successfully with the correct password.

This update requires no additional Firestore rule changes or live account/password changes.

Verification: 171 browser tests, 11 account/emulator integration tests, 62 unit tests and 10 production security scenarios passed. Production build succeeded. The live college account was not inspected or modified.
