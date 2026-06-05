import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentWidth } from "../utils";

const makeMenu = (props: Record<string, unknown>): CanvasLayoutNode =>
  ({
    id: "menu-1",
    type: "Menu",
    props: {
      size: "md",
      children: "Menu",
      style: { width: "fit-content" },
      ...props,
    },
  }) as CanvasLayoutNode;

describe("calculateContentWidth — Menu trigger label source", () => {
  test("label 이 legacy children 보다 우선해 Skia intrinsic width 를 갱신한다", () => {
    const legacyWidth = calculateContentWidth(makeMenu({}));
    const labelWidth = calculateContentWidth(
      makeMenu({ label: "A much longer trigger label" }),
    );

    expect(labelWidth).toBeGreaterThan(legacyWidth);
  });
});
