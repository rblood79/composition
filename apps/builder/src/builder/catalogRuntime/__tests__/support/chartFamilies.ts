import {
  CHART_FAMILY_OF,
  chartFamilyAvailable,
  loadChartFamily,
} from "@composition/rendering";

/**
 * ADR-306 — the Library stores its Chart type cards once the chart families are loaded (the first
 * open waits for them — `workspace.openComponentsView`). A test that opens the Library and reads
 * the stored page at once loads the families first, as a session that has drawn a Chart has.
 */
export async function preloadChartFamilies(): Promise<void> {
  await Promise.all(
    [...new Set(Object.values(CHART_FAMILY_OF))]
      .filter((id) => chartFamilyAvailable(id))
      .map((id) => loadChartFamily(id)),
  );
}
