# Continue an Excel collection in DecomPro

There are two separate spreadsheet importers:

- **Collection register → Import equipment Excel** adds historical equipment to the equipment list.
- **Settings → recognition spreadsheet import** adds reference facts for serial recognition, without creating equipment records.

## Import an existing collection

1. Create or choose an open trolley through Trolleys.
2. Open **Import equipment Excel** in the collection register and choose an `.xlsx` workbook.
3. Choose the trolley to receive the selected equipment. All selected rows go into this trolley; import separate selected groups for other trolleys.
4. Review the preview. Expand **View all fields** to inspect each record. Deselect duplicates or rows you do not want. More rows can be displayed with **Show more rows**.
5. If dates or technician initials are blank, expand **Fill missing dates or disposal initials** and supply their historical values. Existing values are preserved. Correct invalid dates in Excel before importing. Other blank fields become N/A, as listed in the preview.
6. Confirm **Import selected equipment**. Close the preview and select the same trolley through **Change trolley** to continue scanning.

Recognised headings are the supplier export headings, including Date of disposal, Description, Model, Manufacturer, Taken From, Serial Number, Barcode, Security Etch, Asset Number, Reason For Disposal and Who disposed of it?. Model number, Disposal date, Equipment description and Technician are also accepted. Each usable sheet must have Serial Number and Model headings within its first 30 rows. Up to 5,000 equipment rows can be imported per file. Empty equipment rows and unrelated sheets are ignored.

Dates support Excel dates, YYYY-MM-DD and UK DD/MM/YYYY. Text identifiers keep leading zeroes; numeric identifier cells with a simple all-zero format also retain their displayed padding. Digits already lost in the original spreadsheet cannot be recovered automatically. When the supplier template contains two Asset Number columns, the first equipment column is used; the later accounting column is ignored.

The importer adds records without replacing equipment, the current scan, profiles or reference examples. Duplicated non-N/A serials/assets in selected rows or the register are blocked. Rows without a serial and asset require a manual duplicate check. Historical asset formats are retained with a warning. Model/manufacturer details start unreviewed and do not contribute to serial recognition until checked through **Edit**; the recognition importer remains available separately for reference data.

Local imports commit to browser storage before updating the register. Connected team imports require an administrator so original disposal attribution can be preserved. Shared records use the existing Firebase historical-import permissions and serial transactions; no new Firestore rules are required. A shared import can partially succeed: the preview shows saved rows and individual failures, and retry skips already saved records. If the register or trolley changes before saving, the preview requires another review.

## Validation

The supplied Summer workbook parses as 356 equipment rows: 354 ready and two rows blocked because the same serial appears twice. No historical equipment was written to the live database during development.

Automated checks cover supplier headers and multiple sheets, padded identifiers, date conversion, missing-field defaults, duplicate selection, locked destinations, preserved attribution, exclusion from recognition until checked, local storage failure, append/reload/export with an unfinished scan, and shared partial-failure retry. Shared retry tests use a simulated client; Firestore permissions are checked separately with the emulator. Physical iOS Safari and the live site are not verified by those checks.

Final checks passed: 42 unit tests, 13 focused browser tests (including the original recognition importer), 16 Firestore emulator tests and the production build. The new register-import browser tests also passed after the mobile-layout and missing-field panel refinements.
