# Prevent duplicate trolley names across sessions

Shared trolley creation and rename now reserve the normalised name in a Firestore transaction alongside the trolley and its immutable revision. Case and repeated spaces resolve to the same reservation. Two concurrent requests with different trolley IDs cannot both reserve the name. Existing legacy names are checked from the server before creating or renaming a trolley. A name can be reused after its owner is deleted or renamed; permanent references remain separate.

Creation has an explicit in-progress guard. Every awaited stage checks the captured workspace/client before proceeding or updating the interface. A confirmed creation response arriving after timeout or another sign-in cannot modify the new workspace. Reconnecting retrieves the confirmed server record rather than creating another. Creating in the general scan session selects the new permanent reference; named collections still require trolley assignment before use.

## Existing duplicate names

Existing trolley records are retained because they may contain equipment or collection history. Trolley management displays a duplicate-name notice and item counts beside permanent TSU references. If Save reports Duplicated trolley name, choose Choose trolley reference, select the correct physical trolley's TSU reference, then save the preserved item. The chosen reference survives timeout/sign-in. An administrator can rename or unlock the other trolley and delete it once empty and unassigned. Equipment stays on its recorded reference until explicitly moved.

## Activate in Firebase

After GitHub Pages deployment, sign in as administrator and use Database → Copy latest Firestore rules. Publish these in Firebase project decompro-236e9 → Cloud Firestore → Rules. New trolley creation and renaming use the trolleyNames collection, and outdated clients cannot create an unreserved trolley with the new rules. Existing trolley status changes, equipment and audit history remain supported.

Readiness and unlock transitions validate their allowed changes against an already validated prior payload. This keeps six-trolley atomic operations within Firestore's rule-expression limit while retaining full handover-link and immutable revision checks.

Tests cover concurrent creation/rename collisions, legacy-name conflicts, deleted-name reuse, timeout while creation confirmation is pending, repeated sign-ins/reloads, existing-duplicate selection and save after timeout, six-trolley collection and unlocking, and deletion/status/removal regressions.
