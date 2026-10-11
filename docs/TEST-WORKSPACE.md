# Separate test workspace

Open **Settings → Test data → Open test workspace**, or the deployed website with `?workspace=demo#overview`. A visible **TEST WORKSPACE** banner identifies it. The regular register remains in `decompro.v1`; the test register uses `decompro.demo.v1`. Existing test edits load again on refresh.

The generated data includes:
- 96 synthetic equipment records: desktops, monitors, laptops, network switches and hard drives.
- Eight permanently referenced TEST trolleys: four open, two ready and two collected.
- Two named TEST collections, including a linked two-trolley collection history pack.
- Three synthetic technician profiles.
- Missing manufacturer/model/serial details, duplicate serial and asset labels, an unchecked model suggestion and a recorded exception on open trolleys.
- Leading-zero barcodes and historical disposal dates on collected equipment.

The browser's test workspace never resumes the real shared connection. Database controls and the connection function reject Firebase connection/upload attempts while in this mode. Existing Firebase authentication in another tab is left alone. Test-mode backups use a TEST filename prefix; equipment descriptions, collection names, trolley names, supplier exports and collector name are clearly marked TEST.

Try filtering the register, reviewing flagged equipment, scanning `TEST-DL7050-99999`, changing trolley, exporting collection Excel, printing trolley PDFs or checking collection history. **Settings → Test data → Reset synthetic data** replaces only the test register after confirmation. **Return to real workspace** opens the regular workspace again. The test workspace is local to this browser; it is not a shared team database.

Appearance and other device preferences remain device settings. Equipment, scans, trolleys, reference imports and collection edits stay in the separate test register. Downloaded backups are ordinary files and can be deliberately imported elsewhere; use the TEST labels to keep them out of real collection work.

Validation includes sentinel checks that real register/local-backup/configuration/mode/lock values remain unchanged, zero Firebase requests, persisted test edits, collection Excel row counts, PDF labels, synthetic reset and phone popup/navigation behavior.

Final validation: all 112 browser tests and the production build passed. Built desktop/phone checks each loaded 96 test records, suggested OptiPlex 7050 for `TEST-DL7050-99999`, made zero Firebase API requests, produced no runtime errors/overflow, and preserved real register/mode/lock sentinel values.
