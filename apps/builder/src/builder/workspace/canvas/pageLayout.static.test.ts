import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("explicit page layout command contract", () => {
  it("exposes page arrangement from the zoom popover", async () => {
    const source = await readFile(
      resolve(__dirname, "../ZoomControls.tsx"),
      "utf-8",
    );

    // ADR-248 4e-7: the open Builder's align (the old store's is `storeViewportActions.legacy.ts`).
    expect(source).toContain("viewportActions.alignPages()");
    expect(source).toContain('case "align-pages"');
    expect(source).toContain('id="align-pages"');
    expect(source).toContain('t("zoom.align")');
  });

  // ADR-232 — breakpoint 전환은 위치를 옮기지 않는다 (스냅샷 3벌 소멸). tier 차이는 페이지
  //   placement 의 responsive override 가 갖고, 파생이 활성 tier 로 다시 돈다.
});
