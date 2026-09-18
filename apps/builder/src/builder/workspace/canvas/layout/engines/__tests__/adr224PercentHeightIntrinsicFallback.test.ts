import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { enrichWithIntrinsicSize } from "../utils";

const button = (height: string): CanvasLayoutNode =>
  ({
    id: `button-${height}`,
    type: "Button",
    props: {
      children: "Cancel",
      size: "md",
      style: { height },
    },
  }) as CanvasLayoutNode;

describe("ADR-224 percentage height intrinsic fallback", () => {
  it("preserves authored 100% and supplies content height for an indefinite parent", () => {
    const out = enrichWithIntrinsicSize(
      button("100%"),
      342,
      844,
      undefined,
      [],
      () => [],
      true,
    );
    const style = out.props.style as Record<string, unknown>;

    expect(style.height).toBe("100%");
    expect(style.contentHeight).toBe(20);
  });

  it("does not replace a definite authored height with a measurement scalar", () => {
    const out = enrichWithIntrinsicSize(
      button("45px"),
      342,
      844,
      undefined,
      [],
      () => [],
      true,
    );
    const style = out.props.style as Record<string, unknown>;

    expect(style.height).toBe("45px");
    expect(style.contentHeight).toBeUndefined();
  });
});
