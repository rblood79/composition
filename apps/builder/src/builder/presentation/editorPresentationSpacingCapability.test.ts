import { describe, expect, it } from "vitest";
import {
  resolveSpacingCapabilityFromInputs,
  type SpacingCapabilityInputs,
} from "./editorPresentationSpacingCapability";

function inputs(
  overrides: Partial<SpacingCapabilityInputs> = {},
): SpacingCapabilityInputs {
  return {
    projectId: "p",
    nodeId: "box",
    nodeType: "Box",
    rootKey: "page-1",
    rawStyle: {},
    engineStyle: {
      display: "flex",
      flexDirection: "row",
      paddingTop: "8px",
      paddingRight: "12px",
      paddingBottom: "8px",
      paddingLeft: "12px",
      borderTop: "1px",
      borderLeft: "1px",
      columnGap: "16px",
    },
    ancestorEngineStyles: [{ display: "block" }],
    children: [
      { id: "a", engineStyle: { display: "block" }, rawStyle: {} },
      { id: "b", engineStyle: { display: "block" }, rawStyle: {} },
    ],
    activeBreakpoint: "desktop",
    locked: false,
    ...overrides,
  };
}

describe("resolveSpacingCapabilityFromInputs (ADR-222 G0 capability table)", () => {
  it("reads effective padding·gap·border from the engine style even without raw canonical values", () => {
    const cap = resolveSpacingCapabilityFromInputs(inputs());
    expect(cap.padding).toMatchObject({
      supported: true,
      values: { top: 8, right: 12, bottom: 8, left: 12 },
    });
    expect(cap.padding.supported && cap.padding.rawSides.size).toBe(0);
    expect(cap.gap).toMatchObject({
      supported: true,
      property: "columnGap",
      axis: "horizontal",
      reverse: false,
      value: 16,
      flowChildIds: ["a", "b"],
    });
    expect(cap.border).toEqual({ top: 1, right: 0, bottom: 0, left: 1 });
  });

  it("uses rowGap for column flex and marks reverse", () => {
    const cap = resolveSpacingCapabilityFromInputs(
      inputs({
        engineStyle: {
          display: "flex",
          flexDirection: "column-reverse",
          rowGap: "4px",
        },
      }),
    );
    expect(cap.gap).toMatchObject({
      supported: true,
      property: "rowGap",
      axis: "vertical",
      reverse: true,
      value: 4,
    });
  });

  it("reports unspecified spacing as 0 with padding still supported", () => {
    const cap = resolveSpacingCapabilityFromInputs(
      inputs({ engineStyle: { display: "flex" } }),
    );
    expect(cap.padding).toMatchObject({
      supported: true,
      values: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(cap.gap).toMatchObject({ supported: true, value: 0 });
  });

  it.each([
    ["body", inputs({ nodeType: "body" })],
    ["locked", inputs({ locked: true })],
    ["engine-style-missing", inputs({ engineStyle: null })],
    [
      "position-unsupported",
      inputs({ engineStyle: { display: "flex", position: "sticky" } }),
    ],
    ["grid", inputs({ engineStyle: { display: "grid" } })],
    [
      "grid-ancestor",
      inputs({
        ancestorEngineStyles: [{ display: "block" }, { display: "grid" }],
      }),
    ],
    ["transform", inputs({ rawStyle: { transform: "rotate(10deg)" } })],
  ] as const)("blocks both axes with reason %s", (reason, input) => {
    const cap = resolveSpacingCapabilityFromInputs(input);
    expect(cap.padding).toEqual({ supported: false, reason });
    expect(cap.gap).toEqual({ supported: false, reason });
  });

  it("keeps padding supported on a structural container with no children and closes gap", () => {
    const cap = resolveSpacingCapabilityFromInputs(
      inputs({ nodeType: "Section", children: [] }),
    );
    expect(cap.padding.supported).toBe(true);
    expect(cap.gap).toEqual({
      supported: false,
      reason: "fewer-than-two-children",
    });
  });

  it("closes padding on a non-container leaf", () => {
    const cap = resolveSpacingCapabilityFromInputs(
      inputs({
        nodeType: "Text",
        children: [],
        engineStyle: { display: "block" },
      }),
    );
    expect(cap.padding).toEqual({ supported: false, reason: "not-container" });
  });

  it("closes the axis whose raw value must be preserved (%, rem, var)", () => {
    const percent = resolveSpacingCapabilityFromInputs(
      inputs({ rawStyle: { paddingLeft: "10%" } }),
    );
    expect(percent.padding).toEqual({
      supported: false,
      reason: "raw-unit-preserved",
    });
    expect(percent.gap.supported).toBe(true);

    const token = resolveSpacingCapabilityFromInputs(
      inputs({ rawStyle: { gap: "var(--gap)" } }),
    );
    expect(token.gap).toEqual({
      supported: false,
      reason: "raw-unit-preserved",
    });
    expect(token.padding.supported).toBe(true);
  });

  it("closes gap on wrap, distributed alignment, non-flex, auto-margin child and single in-flow child", () => {
    expect(
      resolveSpacingCapabilityFromInputs(
        inputs({ engineStyle: { display: "flex", flexWrap: "wrap" } }),
      ).gap,
    ).toEqual({ supported: false, reason: "wrap" });
    expect(
      resolveSpacingCapabilityFromInputs(
        inputs({
          engineStyle: { display: "flex", justifyContent: "space-between" },
        }),
      ).gap,
    ).toEqual({ supported: false, reason: "distributed-alignment" });
    expect(
      resolveSpacingCapabilityFromInputs(
        inputs({ engineStyle: { display: "block" } }),
      ).gap,
    ).toEqual({ supported: false, reason: "not-flex" });
    expect(
      resolveSpacingCapabilityFromInputs(
        inputs({
          children: [
            { id: "a", engineStyle: { marginLeft: "auto" }, rawStyle: {} },
            { id: "b", engineStyle: {}, rawStyle: {} },
          ],
        }),
      ).gap,
    ).toEqual({ supported: false, reason: "auto-margin-child" });
    expect(
      resolveSpacingCapabilityFromInputs(
        inputs({
          children: [
            { id: "a", engineStyle: { position: "absolute" }, rawStyle: {} },
            { id: "b", engineStyle: {}, rawStyle: {} },
          ],
        }),
      ).gap,
    ).toEqual({ supported: false, reason: "fewer-than-two-children" });
  });

  it("records which padding sides come from raw canonical (provenance)", () => {
    const cap = resolveSpacingCapabilityFromInputs(
      inputs({ rawStyle: { padding: "4px 6px" } }),
    );
    expect(cap.padding.supported && [...cap.padding.rawSides].sort()).toEqual([
      "bottom",
      "left",
      "right",
      "top",
    ]);
    const one = resolveSpacingCapabilityFromInputs(
      inputs({ rawStyle: { paddingTop: 10 } }),
    );
    expect(one.padding.supported && [...one.padding.rawSides]).toEqual(["top"]);
  });

  describe("non-desktop breakpoint (2026-09-17 scope 확장 — tier override 라우팅)", () => {
    it("opens both axes at mobile with no responsive config (base write, Inspector 와 같은 기본 모델)", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({ activeBreakpoint: "mobile", rawStyle: { paddingTop: 8 } }),
      );
      expect(cap.padding.supported).toBe(true);
      expect(cap.padding.supported && [...cap.padding.rawSides]).toEqual([
        "top",
      ]);
      expect(cap.gap.supported).toBe(true);
    });

    it("reads provenance from the tier override when the tier toggle is ON", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({
          activeBreakpoint: "mobile",
          rawStyle: { paddingTop: "10%" },
          responsive: {
            styles: {
              paddingTop: { mobile: 24 },
              paddingLeft: { mobile: 4 },
            },
          },
        }),
      );
      // base 는 % 지만 mobile 목적지는 override(px) 라 열린다
      expect(cap.padding.supported).toBe(true);
      expect(cap.padding.supported && [...cap.padding.rawSides]).toEqual([
        "top",
        "left",
      ]);
    });

    it("blocks a unit-preserved value on the tier override", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({
          activeBreakpoint: "tablet",
          responsive: { styles: { columnGap: { tablet: "1rem" } } },
        }),
      );
      expect(cap.gap).toEqual({
        supported: false,
        reason: "raw-unit-preserved",
      });
      expect(cap.padding.supported).toBe(true);
    });

    it("blocks the axis whose base write would be shadowed by a higher tier override", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({
          activeBreakpoint: "mobile",
          responsive: { styles: { paddingTop: { tablet: 30 } } },
        }),
      );
      expect(cap.padding).toEqual({
        supported: false,
        reason: "cascade-shadowed",
      });
      expect(cap.gap.supported).toBe(true);
    });

    it("treats a legacy shorthand override as a shadow too", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({
          activeBreakpoint: "mobile",
          responsive: { styles: { gap: { tablet: 6 } } },
        }),
      );
      expect(cap.gap).toEqual({ supported: false, reason: "cascade-shadowed" });
    });

    it("does not shadow at tablet when only the tablet tier itself carries the override", () => {
      const cap = resolveSpacingCapabilityFromInputs(
        inputs({
          activeBreakpoint: "tablet",
          responsive: { styles: { paddingTop: { tablet: 30 } } },
        }),
      );
      expect(cap.padding.supported).toBe(true);
    });
  });
});
