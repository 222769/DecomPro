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
