# Collection dashboard

Open **Overview** in the navigation. The dashboard sits above the scan station and shows the whole workspace, or one named collection. Filtering the dashboard does not switch your active scan session, clear a draft, or change equipment records.

The five totals show saved equipment, trolley count, unresolved record checks, trolleys ready for pickup, and collected trolleys. Equipment progress shows how many saved items are on collected trolleys, and how many are on ready trolleys. Status filters narrow the trolley cards while the totals remain for the selected collection.

Trolley states:
- **Empty trolley:** no saved equipment; cannot be ready for pickup.
- **Needs review:** unresolved missing details, duplicate identifiers, unchecked suggestions or shared trolley assignment problems.
- **Awaiting physical check:** record checks clear, but the trolley has not been marked ready through the existing physical confirmation process.
- **Ready for pickup:** saved equipment, clear record checks and an existing ready status.
- **Collected:** physical pickup has already been recorded; the inventory stays available.

Duplicate checks use the full register, including equipment in other collections. Recorded missing-detail exceptions follow the existing readiness rules. Historical exceptions on collected trolleys do not become current blockers. A previously ready trolley with new unresolved checks is shown as needing review.

**View inventory** opens that trolley's register. **Check trolley** / **Review readiness** opens the existing readiness dialog. The dashboard never marks trolleys ready or collected automatically.

Firebase equipment changes update the totals through the existing register listener. Use **Collections → Refresh collections** to fetch another technician's grouping changes. Offline or disconnected views explicitly say they are cached; final shared readiness checks still use Firebase. No new database paths or Firestore rules are required.

Validation: unit checks cover cross-collection duplicates, empty ready cages and shared legacy assignments. Browser checks cover status totals, collection/status filters, preserved active drafts, readiness shortcuts, updated totals after editing, reload, and the dark phone layout.
