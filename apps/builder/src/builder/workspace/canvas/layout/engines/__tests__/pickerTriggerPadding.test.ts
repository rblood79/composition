import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 2026-09-30 (사용자 지시) — DatePicker · DateRangePicker 트리거의 오른쪽 여백은 ComboBox 트리거와 같다. catalog
 * 선언도 같다: DatePicker `--dp-group-padding` md `4 4 4 12` · ComboBox `--combo-container-padding-right` md 4.
 * 종전 Canvas 는 picker 분기가 트리거 여백을 주입하지 않아 SelectTrigger 기본 여백 (좌우 12) 이 남았다.
 */
function triggerStyle(ownerType: string, size: string) {
  const owner = {
    id: "o",
    type: ownerType,
    props: { size, label: "L" },
    childrenIds: ["t"],
  } as Element;
  const trigger = {
    id: "t",
    type: "SelectTrigger",
    parent_id: "o",
    props: { style: { width: "100%", display: "flex", flexDirection: "row" } },
    childrenIds: [],
  } as Element;
  const byId = new Map<string, Element>([
    ["o", owner],
    ["t", trigger],
  ]);
  const children = (id: string) =>
    ((byId.get(id) as { childrenIds?: string[] } | undefined)?.childrenIds ?? []).map(
      (child) => byId.get(child)!,
    );
  const ownerResult = applyImplicitStyles(owner, [trigger], children, byId);
  const projected = ownerResult.filteredChildren.find((c) => c.type === "SelectTrigger")!;
  const next = { ...trigger, props: projected.props } as Element;
  byId.set("t", next);
  const result = applyImplicitStyles(next, [], children, byId);
  return (result.effectiveParent.props as { style: Record<string, unknown> }).style;
}

describe("picker trigger padding = ComboBox trigger padding", () => {
  for (const size of ["xs", "sm", "md", "lg", "xl"])
    it(`size ${size}`, () => {
      const combo = triggerStyle("ComboBox", size);
      for (const picker of ["DatePicker", "DateRangePicker"]) {
        const style = triggerStyle(picker, size);
        expect([style.paddingLeft, style.paddingRight]).toEqual([
          combo.paddingLeft,
          combo.paddingRight,
        ]);
      }
      expect(combo.paddingRight).not.toBe(combo.paddingLeft);
    });
});
