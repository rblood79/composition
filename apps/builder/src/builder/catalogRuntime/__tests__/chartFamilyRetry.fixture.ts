/** Test seam — the registry's loader swap and a stand-in family (no chunk import in the test). */
export { __setChartFamilyLoaderForTest } from "../../../../../../packages/rendering/src/chart/families/registry";
import type { ChartFamily } from "@composition/rendering";

export function categoryFamilyForTest(): ChartFamily {
  return {
    id: "category",
    buildScene: () => {
      throw new Error("not drawn in this test");
    },
    sample: () => [],
    sampleProps: () => ({}),
  };
}
