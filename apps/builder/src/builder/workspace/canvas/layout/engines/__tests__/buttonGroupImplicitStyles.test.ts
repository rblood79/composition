import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";

const apply = (props: Record<string, unknown>) => {
  const group = {
    id: "button-group",
    type: "ButtonGroup",
    props,
  } as CanvasLayoutNode;
  const result = applyImplicitStyles(
    group,
    [],
    () => [],
    new Map([[group.id, group]]),
  );
  return result.effectiveParent.props.style as Record<string, unknown>;
};

describe("ButtonGroup Preview layout defaults", () => {
  it("projects size gap and prop defaults when authored style omits them", () => {
    expect(
      apply({ size: "md", orientation: "vertical", align: "start" }),
    ).toMatchObject({
      display: "flex",
      flexDirection: "column",
      rowGap: 8,
      columnGap: 8,
      justifyContent: "flex-start",
    });
  });

  it("preserves authored layout overrides while filling only the missing gap", () => {
    expect(
      apply({
        size: "lg",
        orientation: "horizontal",
        align: "end",
        style: {
          flexDirection: "column",
          justifyContent: "center",
          rowGap: 3,
        },
      }),
    ).toMatchObject({
      flexDirection: "column",
      justifyContent: "center",
      rowGap: 3,
      columnGap: 10,
    });
  });
});
