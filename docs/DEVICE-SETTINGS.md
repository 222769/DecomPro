# Device settings and compact overview

The top toolbar now uses a compact database chip. Green means Firebase has confirmed the shared register. Amber means offline or another connection issue; the chip opens Database settings and exposes the connection detail in its accessible label and tooltip.

The collection dashboard keeps its totals and collection/status filters visible. **Trolley details** is collapsed initially; choosing a filter expands it. Daily progress is available through **Today’s progress**. Collection management remains in the **Collections** navigation.

Settings adds:
- Device security: inactivity period, trusted-device Remember me, lock and sign-out actions.
- Dashboard layout: optionally keep daily progress and collection management visible on the overview.
- Workspace tools: database connection, trolley management, equipment Excel import, backup and restore.

Appearance, security and dashboard preferences stay on this device and are excluded from workspace backups. Scanner/voice settings retain their existing backup behavior. The separate recognition spreadsheet importer remains under Model recognition.

No Firestore rule changes or paid backend services are needed for this update. Browser storage and downloaded backups remain unencrypted; lock your computer as well when leaving it unattended.

The **Overview** navigation opens a focused dashboard view; the scan station, register and duplicate scan-context tiles stay out of that view. Use **Scan station** or **Collection register** to return to the work area. The small connection indicator remains available throughout.

Validation: 97 browser cases verified (96 in the final full run plus the corrected heading assertion rerun), 49 unit tests and 10 authentication emulator tests passed. Production light desktop and dark phone checks found no runtime errors or horizontal overflow. A production-build shared-connection smoke check used a test database adapter and verified the compact status chip, session-only default and preservation of a partly typed serial when locking; this does not verify the live Firebase connection.

## Empty draft recovery

The first locking release could store an empty current scan field, causing “The backup has invalid captured values” on reconnect and “Saved data could not be loaded” after a refresh. Locking now leaves an empty field uncaptured. Workspace loading normalizes blank draft fields, including saved collection checkpoints, while still rejecting invalid types and inconsistent accepted progress. Equipment records and other captured values remain intact. Failed connection validation also keeps the persistent lock marker in place.

Recovery is applied when the updated app loads; do not clear browser data. Validation: 16 targeted browser tests and the production build passed, including empty serial/model lock cycles and recovery of an affected saved draft alongside an existing equipment record.

## Startup loading recovery

Startup recovery and initial theme selection now run directly from the HTML, with exact script hashes generated in the Content Security Policy. A missing separate recovery-script download can no longer leave the app behind the opening screen. A plain **Reload the latest app** link works without JavaScript, and stalled component downloads expose the timed Refresh app control. The legacy public startup files remain available for older cached pages.

Validation: 12 targeted browser tests passed, including missing and stalled component downloads, initializer failures, script injection protection and lock/draft recovery. Production desktop/phone checks loaded with no runtime or CSP errors, and a deliberately failed production module download exposed recovery controls. Live-site requests are blocked by the execution network proxy, so deployment status must be checked separately in GitHub Actions.

## Save feedback

The whole save preparation path now runs inside error handling. Exceptions before the database request can no longer fail silently or leave the saving flag stuck. Feedback is an accessible status message directly below Save; required fields are highlighted without jumping focus away from that message. Slow confirmation displays a notice after 15 seconds while keeping the pending save guarded against duplicate submission. Shared saves capture their connection context and preserve the unfinished draft if locking or a workspace switch happens before confirmation.

Validation: 62 save/scanning/recognition/import/export browser tests and the production build passed. Regression cases cover an injected preparation exception followed by a successful retry, delayed Firebase confirmation, and locking before confirmation without discarding the scanned item.
