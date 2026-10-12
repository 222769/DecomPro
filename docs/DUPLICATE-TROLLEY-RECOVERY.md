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
- These safeguards apply to the application creation paths. They do not introduce a server-wide unique-name registry or silently rewrite existing duplicates.

No Firebase rule change or new account permission is required. Jawad remains a technician and records new items under his JA initials.

Existing live duplicate documents were not removed or merged: this execution environment cannot administer the live Firebase project. The tests reproduce two legacy same-name entries using a simulated Jawad technician account and verify reference selection and saving. A Firestore emulator test verifies concurrent creation commits one shared reference while preserving existing trolley records.

Verification: 138 browser tests, 55 unit tests, 24 Firestore emulator tests and three production-build scenarios passed. The production build succeeded. The pending-save test now uses an existing shared trolley; its old empty-server fixture depended on the automatic creation behavior intentionally removed by this fix.
