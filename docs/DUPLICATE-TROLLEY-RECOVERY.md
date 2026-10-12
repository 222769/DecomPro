# Duplicate trolley names and technician saving

A duplicate display name is not a safe trolley identifier. Each physical trolley has a permanent UUID and TSU barcode reference. Existing entries with the same name may contain different equipment or belong to different collections, so the application does not automatically merge or delete them.

## Recover scanning

1. Open **Change trolley** (or **Choose trolley reference** beneath a duplicate-name save error).
2. Select the **TSU reference matching the label on the physical trolley**. The selector and shortcut buttons show the permanent reference and item count for each entry.
3. Select **Use trolley**, then save the captured equipment. The draft stays available throughout.

The existing **Trolleys → Use** action also selects a specific reference. Choose this on each technician's device; the display name alone cannot identify one of two same-name entries.

If the selected trolley is outside the active collection, manage its collection assignment or resume the collection that owns it. Ready and collected trolley locks remain enforced. Do not remove a duplicate with equipment or history simply to get past the naming error.

## Fixes

- Shared save and switch operations fetch current trolley records before resolving the selected reference. A stale or empty device cache cannot cause save to create another team trolley.
- Shared saving no longer silently creates a missing trolley. Create new shared trolleys explicitly through Trolleys.
- Case and repeated whitespace are normalised for matching, while saved equipment records use the canonical trolley name from Firebase. This prevents the server rejecting an otherwise correct reference due to different name casing.
- A new device keeps an existing reference when its default name matches exactly one shared trolley; ambiguous names require a selection.
- New trolleys created through the shared manager derive the same UUID from the normalised name within the workspace. Firebase's existing version-checked transaction admits only one of two concurrent creation attempts. Existing random UUIDs and printed references are unchanged, and the manager checks for existing names before creating.
- These safeguards apply to the application creation paths. They do not silently rewrite existing duplicates. The name-claim update below adds a server-enforced unique-name registry.

No Firebase rule change or new account permission is required. Jawad remains a technician and records new items under his JA initials.

Existing live duplicate documents were not removed or merged: this execution environment cannot administer the live Firebase project. The tests reproduce two legacy same-name entries using a simulated Jawad technician account and verify reference selection and saving. A Firestore emulator test verifies concurrent creation commits one shared reference while preserving existing trolley records.

Verification: 138 browser tests, 55 unit tests, 24 Firestore emulator tests and three production-build scenarios passed. The production build succeeded. The pending-save test now uses an existing shared trolley; its old empty-server fixture depended on the automatic creation behavior intentionally removed by this fix.

## Reload and sign-in recovery update

Startup now restores trolley selection using the permanent ID before inspecting display names. Equipment carrying an existing ID uses that trolley's current name; an old label cannot create another trolley. Legacy name matching normalises spacing/case and assigns a reference only when one match exists. A typed default name does not create a trolley during reload. Empty shared caches and orphaned permanent references do not manufacture replacement identities. Older backups without a trolley register also deduplicate normalised legacy names during migration.

Sign-in loads the server trolley register and does not write trolley documents. The new regression scenario creates exactly one shared trolley as a simulated Jawad technician, locks/signs back in three times, refreshes after each sign-in, clears the device trolley cache and reconnects, then saves equipment. The test requires exactly one creation write and the same permanent reference throughout. Another regression checks repeated local reloads with a stale equipment name and differently cased/spaced defaults.

This update does not delete or merge existing live trolley documents. Compare permanent TSU references and equipment contents before deciding how to resolve existing entries. No additional Firestore rules change is needed for this recovery update; the preceding renaming feature still needs its updated rules published.

## Name-claim update (timeout during creation)

Jawad created trolley 1.1 once, timed out, signed back in and found two 1.1 entries, which blocked saving. Two gaps remained after the updates above:

1. Names were not reserved atomically. Duplicate checks read the register before writing, and only same-ID creations conflicted. A trolley with a different reference (an older app build, a retried request, a rename or a local workspace import) could still take an existing name.
2. A creation that Firebase confirmed after an inactivity lock was still applied to whichever workspace was open when the response arrived.

Fixes:

- Each normalised name (case and spacing ignored) now has one `trolleyNames/{key}` claim. The key is the SHA-256 of the normalised name. Creating or renaming a trolley writes the claim in the same transaction as the trolley and its audit revision. Firestore retries the transaction on contention, so two devices cannot both claim one name. The rules refuse a trolley creation or rename without its claim and refuse to take a claim whose trolley still uses that name. Deleting or renaming a trolley releases its old name.
- Trolleys that existed before claims (including existing duplicates) are still checked by name on the server before a create or rename. Status changes, readiness, collection and unlock never touch claims, so linked six-trolley handovers stay within Firestore's rule limits.
- If the workspace locks, times out or reconnects before Firebase answers, the result is not applied to the new session. A message says to sign in and check Trolleys rather than creating the trolley again. If it was created, it appears after sign-in, and a repeat attempt reports the existing reference.
- A duplicate is reported as "A trolley named "1.1" already exists (TSU-…). Select it with Use trolley", not as a team access error.
- Local workspace import blocks items whose local trolley would add a second shared trolley with an existing name.

### Publish order

Publish `database/firestore.rules` in the Firebase console (or `firebase deploy --only firestore:rules`) **before** deploying this app build. Until the rules are published, this build cannot create or rename shared trolleys, because Firebase refuses `trolleyNames` writes. Older app builds still open on other devices cannot create or rename trolleys once the rules are published: refresh those devices. Existing trolleys, saving equipment, readiness and collection are unaffected.

Existing live duplicate trolley documents are still not merged or removed automatically. Resolve them as described above.

Normalisation folds ASCII spaces and tabs only. Unusual Unicode spaces in a name are compared exactly by the claim, but the server-side name check still compares them loosely.
