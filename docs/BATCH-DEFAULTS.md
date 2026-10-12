# Batch defaults and Config

Use the Config button in Batch defaults to control each field independently. Save configuration applies the choices; Cancel leaves them unchanged. Current input is not cleared when changing configuration.

| Field | Initially keep for next item | If unchecked after a successful save |
| --- | --- | --- |
| Disposal date | Yes | Clear |
| Equipment description | No | Clear |
| Manufacturer | No | Clear |
| Taken from | Yes | Clear |
| Reason for disposal | Yes | Clear |

Fresh workspaces begin with Taken from set to Storage and reason set to EOL. Date, description and manufacturer begin blank. Keeping source and reason checked carries Storage/EOL forward; unchecking them allows the user to clear those fields too. Caged trolley always follows the selected trolley and is not part of this configuration.

Checked fields retain the values used for the saved equipment, including recognised or edited descriptions and manufacturers. Recognition can still suggest the details for the next item independently. Configuration persists across reload, other Settings changes and workspace backups. Older keep-all settings migrate to all five checked; older unchecked settings migrate to date/source/reason checked and description/manufacturer unchecked.

Only successful saves reset unchecked fields. Failed saves preserve current details and scans. Pending shared saves preserve newer edits and other collection checkpoints. Blank dates are valid for an unfinished workspace; saving equipment still requires complete required details and a valid disposal date. No Firebase rules update is required.
