# Future update: Honeywell 1400g scanner controls

Status: proposed and deferred; no scanner behaviour changes implemented.
Recorded: 12 October 2026.

## User feedback and requirements

The team uses a Honeywell 1400g. Double pressing its trigger did not activate skip. Keyboard double Enter worked well and must remain available, alongside the on-screen Skip / N/A button.

DecomPro currently skips a blank capture field when two empty Enter submissions arrive within the configured window (700 ms by default). This handles keyboard input; it does not receive a physical scanner trigger event.

## Working explanation to verify

In typical USB keyboard mode, successful barcode decoding sends characters followed by a configured suffix, such as Enter. A trigger press without a decoded barcode generally sends no keyboard data. Confirm the actual interface, suffix and no-read behaviour on the team's device before changing its configuration.

Honeywell documentation was inaccessible from the development environment. Model-specific programming codes and no-read options remain unverified. Obtain the correct 1400g user guide before recommending settings or programming barcodes.

## Proposed update

1. Keep keyboard double Enter and the existing on-screen skip button.
2. Provide a printable Code 128 label titled Skip / N/A, encoding a reserved command such as DECOMPRO:SKIP.
3. Handle that exact command in the active normal capture field: fill N/A, advance one field and speak the next prompt. Do not save the command as equipment data or interpret it as an inventory identifier in trolley rescan mode.
4. Add a diagnostic tool in Settings to display received characters and Enter/Tab endings. Keep diagnostic input on the device and clear it when the tool closes; do not upload scanned identifiers as telemetry.
5. Update scanner instructions and the Settings label to distinguish the keyboard double-Enter window from scanner trigger presses.

## Validation before implementation and release

- In a text editor, scan an ordinary barcode and observe its suffix. Point away from barcodes and press the trigger twice to observe whether any host input arrives.
- Verify the command label decodes on the actual Honeywell 1400g.
- Ensure one command read skips exactly one active field. Handle duplicate deliveries without accidentally skipping multiple fields, while allowing deliberate consecutive skips.
- Keep ordinary barcodes, serials, leading zeros, asset numbers and security etch values unchanged.
- Keep double Enter limited to empty input and retain the configurable timing window.
- Ensure a command does not save a review-stage item, move equipment, bypass a paused/locked workspace, or act inside another dialog.
- Test focus loss, missing suffixes, repeated reads, all capture fields and speech prompts. Diagnostics must not modify register records or unfinished scans.

The user has requested recording this proposal for future updates, not implementing it now. Scanner configuration, application code and live equipment remain unchanged by this document.
