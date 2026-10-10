# DecomPro account administration

The `decomproAdmin` callable function creates Firebase Authentication accounts and their team membership, links existing accounts, lists members, updates names/roles/team access, and generates private password setup/reset links. Deactivating access revokes the selected team's data access; historical equipment records and disposal initials stay intact. The app never stores or sends passwords. New accounts receive a random password that is not returned; the technician chooses their own through a private setup link.

Every request checks the caller's current active administrator membership. Changes check it again inside a transaction, serialize against `teams/{team}.adminRevision`, and append an immutable `memberAudit` record. Unique disposal initials stay fixed after creation. Administrators cannot demote or deactivate themselves. Definite membership validation failures roll back the newly created Authentication user; ambiguous transaction failures keep its identity for reconciliation, so a committed membership never loses its sign-in account. Refresh the user list or link the existing account before retrying; existing accounts are never deleted during rollback. Audit records contain neither passwords nor reset links. Only administrators read audit records. Public Firestore clients, including admin clients, cannot write memberships or audits; the console and Admin SDK remain trusted bootstrap paths.

## Deploy to Firebase

GitHub Pages hosts the interface. It does not execute this backend. Cloud Functions requires the **Blaze** plan; deployment and usage can incur charges. The function runs in `europe-west2`, has no minimum instances and is limited to two instances. The runtime service account needs Firebase Authentication administrator and Firestore data access. Use your college's approved permissions; the browser has no privileged credential.

This environment currently receives `403 Domain forbidden` from the Cloud Functions and billing API domains. That network response does not establish your project's billing plan or IAM permissions. The local implementation and emulator tests are available regardless. Do not claim the admin section is operational until the function has deployed and a signed-in administrator has listed the live accounts.

From Google Cloud Shell, authenticated as a project administrator:

1. Clone the current repository and enter it:

   ```sh
   git clone https://github.com/222769/DecomPro.git
   cd DecomPro
   ```

   If you already have this checkout, use `git pull --ff-only` instead of cloning again.

2. Install locked dependencies:

   ```sh
   npm ci
   npm ci --prefix functions
   ```

3. Sign in to the Firebase CLI if needed:

   ```sh
   npx firebase login --no-localhost
   ```

4. Deploy both the service and tested rules:

   ```sh
   npx firebase deploy --only functions:decomproAdmin,firestore:rules --project decompro-236e9
   ```

   Enable Blaze in Firebase if the CLI reports that billing is required. Only the project owner should approve that billing change. If the runtime lacks permissions, assign the required roles through your approved IAM process. No service-account JSON or private key belongs in GitHub or the website.

5. After the GitHub Pages deployment finishes, sign in to DecomPro with your administrator account and open **Admin → Refresh users**. Create a test technician or link an existing Firebase account, privately share its setup link when applicable, and sign in on another device. Verify team access, deactivate it, and verify server reads are denied. Do not use real equipment records as test fixtures.

If publishing rules separately, deploy this function before relying on the app to manage accounts. Membership bootstrap in the trusted Firebase console remains available. Firebase Authentication email/password sign-in must already be enabled; this service does not change project-wide sign-in configuration.

## Local validation

Install root and functions dependencies. Java 21 is required for the Firestore emulator.

```sh
npm run test:accounts
npm run test:database
npm test
npm run build
```

`test:accounts` uses the Auth, Firestore and Functions emulators, never the college project. It covers authorization, creation/rollback, duplicate initials, concurrent administration, preserving history, password setup and real technician sign-in, linking existing users, and authenticated callable HTTP requests. Database tests verify that browser clients cannot bypass the service. Browser tests cover the admin interface and private-link handling with mocked callable responses. Live deployment remains a separate validation step.
