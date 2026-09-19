import { beforeEach, describe, expect, it } from "vitest";
import { useCompareModeStore } from "./compareMode";

describe("compareMode store", () => {
  beforeEach(() => {
    useCompareModeStore.getState().setCompareMode(false);
    useCompareModeStore.getState().setCurrentPageFilter(false);
  });

  it("keeps the current-page filter off by default behavior", () => {
    expect(useCompareModeStore.getState().filterCurrentPage).toBe(false);
  });

  it("supports an independent current-page filter option", () => {
    useCompareModeStore.getState().setCurrentPageFilter(true);
    expect(useCompareModeStore.getState().filterCurrentPage).toBe(true);
    expect(useCompareModeStore.getState().isCompareMode).toBe(false);

    useCompareModeStore.getState().setCurrentPageFilter(false);
    expect(useCompareModeStore.getState().filterCurrentPage).toBe(false);
  });
});
