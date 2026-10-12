# Modify and delete trolleys

Open **Trolleys → Rename / edit trolley** to change an open trolley's name and owning department. Its permanent reference, barcode and inventory links stay unchanged. Reopen a ready trolley before editing it. Collected records retain their original history.

**Delete trolley** is available for local trolleys and shared team administrators. Type exactly `DELETE` and tick the acknowledgement before confirming. Cancel leaves the trolley unchanged. Failed deletion keeps the confirmation and entered values available for retry.

Deletion requires an open, empty trolley detached from its collection. Move any equipment through the register or rescan mode first, and use **Manage collection trolleys** to detach it. This supports removing an unused duplicate without deleting equipment. Ready and collected trolleys cannot be deleted.

Local deletion removes the trolley and clears its active selection and checkpoint references while preserving unfinished scans and other equipment. Firebase uses an audited deletion marker, hides the trolley from the active list, and preserves its document, reference and revisions. Tombstones cannot be restored or overwritten. New trolleys can reuse a deleted name but receive a different permanent reference.

The deletion client reads current inventory and collection assignments, then uses a version-checked transaction. Equipment writes advance trolley versions; the transaction also reads collection assignments. A concurrent save or assignment causes deletion to reject/retry, rather than accepting equipment on a deleted trolley. Rules restrict deletion markers to administrators and block equipment writes and new assignments against deleted references. Rules cannot query inventory counts; emptiness is checked by the client with the version guard.

Other devices reconcile deleted trolley selections when Firebase updates them, preserving their unfinished scans and requiring a new trolley selection. Reconnecting also clears obsolete checkpoint references so deletion does not prevent startup.

## Enable shared deletion

After GitHub Pages deploys, open DecomPro **Database → Copy latest Firestore rules**. Paste the copied rules into the Firebase Rules editor and choose **Publish**:

https://console.firebase.google.com/project/decompro-236e9/firestore/databases/-default-/security/rules

The application code push does not publish Firebase rules automatically. Existing trolley documents without the new deletion field remain compatible.

Verification: 167 browser tests, 29 Firestore emulator tests, 62 unit tests and 10 production-build scenarios passed. Production build succeeded. Live Firebase rules were not deployed from this environment.
