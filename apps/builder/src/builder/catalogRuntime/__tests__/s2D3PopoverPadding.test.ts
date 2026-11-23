import { describe, expect, it } from "vitest";
import { catalogOverlayPlacement } from "../../../../../../packages/shared/src/catalog/runtime/overlayLayout";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";

/**
 * S2 체크리스트 부록 D.3 Popover 「스크롤 · 화면 경계」 (2026-11-23 1단계): an open Popover the Canvas
 * places keeps `containerPadding` from the viewport edge, as RAC's `calculatePosition` does in the
 * DOM — the same inputs the live run measured in Publish (`s2-d3-guides-live.mjs` 7: trigger
 * 355 × 121, Popover 416 wide, crossOffset −600 → x = 40).
 */
const place = (props: Record<string, unknown>) =>
  catalogOverlayPlacement(
    { props } as unknown as CatalogConsumerNode,
    {
      modal: false,
      owner: {
        ruleId: "DialogTrigger",
        props: {},
      } as unknown as CatalogConsumerNode,
    },
    { x: 355, y: 392, width: 121, height: 32 },
    { x: 0, y: 0, width: 416, height: 120 },
    { width: 1600, height: 1000 },
    "en-US",
  );

describe("S2 D.3 Popover — containerPadding at the viewport edge", () => {
  it("pushed past the left edge: x = containerPadding (40), the default keeps 12", () => {
    expect(
      place({ placement: "bottom", crossOffset: -600, containerPadding: 40 }).x,
    ).toBe(40);
    expect(place({ placement: "bottom", crossOffset: -600 }).x).toBe(12);
  });

  it("pushed past the right edge: x = width − padding − Popover width", () => {
    expect(
      place({ placement: "bottom", crossOffset: 1200, containerPadding: 40 }).x,
    ).toBe(1600 - 40 - 416);
  });
});
