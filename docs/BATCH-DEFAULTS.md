# Batch defaults

Fresh workspaces start with blank disposal date, equipment description, manufacturer, taken-from and reason fields. The trolley is selected through Change trolley and remains read-only in this panel. Existing saved equipment and unfinished scans are preserved when upgrading.

Keep defaults for next item is unchecked by default. After a confirmed Save item & start next, equipment description, manufacturer, taken-from and reason clear for the next item; the entered disposal date and selected trolley remain. Checked retention keeps the entered batch details for consecutive items. Changing the checkbox does not immediately erase current input. Recognition can still suggest details for the equipment currently being scanned.

The choice is saved with workspace settings and backups and survives reload or saving other Settings. Blank batch dates are valid workspace state; saved equipment still requires a valid disposal date and complete required details.

Validation errors and failed saves retain details. When a shared save finishes after switching collections or editing a newer scan, it resets only the matching completed checkpoint and preserves newer work. These changes require no Firebase rules update.
