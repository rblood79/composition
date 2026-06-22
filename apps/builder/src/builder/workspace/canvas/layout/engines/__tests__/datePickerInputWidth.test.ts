import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * DatePicker / DateRangePicker 의 DateInput 자식 width/height 주입 회귀 가드.
 *
 * 버그(2026-06-23): DatePicker/DateRangePicker layout 분기(implicitStyles.ts)가
 *   DateField/TimeField 분기와 달리 DateInput 자식에 `width:100%`/`height`/
 *   `_granularity`/`_hourCycle`/`_locale` 를 주입하지 않았다. 그 결과 Taffy 가
 *   DateInput 을 width 0 으로 계산 → Skia node box width 0 (CSS 는 RAC grid/flex
 *   자연폭으로 정상이라 Skia 만 발산).
 *
 * factory(DateColorComponents.ts)는 DateInput 을 `{ _parentTag }` 만으로 생성하므로
 *   layout 분기가 유일한 width 주입처 — 누락 시 width 미주입.
 */
function makeChild(
  id: string,
  type: string,
  props?: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props: props ?? { style: {} },
    childrenIds: [],
  } as Element;
}

function applyContainer(
  type: string,
  props: Record<string, unknown>,
  children: Element[],
): ReturnType<typeof applyImplicitStyles> {
  const containerId = `${type}-1`;
  const normalizedChildren = children.map((child) => ({
    ...child,
    parent_id: containerId,
  })) as Element[];
  const container = {
    id: containerId,
    type,
    props,
    childrenIds: normalizedChildren.map((child) => child.id),
  } as Element;
  const byId = new Map<string, Element>([
    [container.id, container],
    ...normalizedChildren.map((child) => [child.id, child] as const),
  ]);

  return applyImplicitStyles(
    container,
    normalizedChildren,
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((childId: string) => byId.get(childId)!) ?? [],
    byId,
  );
}

function findDateInput(
  result: ReturnType<typeof applyImplicitStyles>,
): Element | undefined {
  return result.filteredChildren.find((c) => c.type === "DateInput") as
    | Element
    | undefined;
}

describe("DatePicker/DateRangePicker DateInput width injection", () => {
  it("DateRangePicker → DateInput 자식에 width:100% + height 주입", () => {
    const result = applyContainer(
      "DateRangePicker",
      { label: "Date Range", size: "md", labelPosition: "top" },
      [
        makeChild("label", "Label", {
          children: "Date Range",
          style: { width: "fit-content" },
        }),
        makeChild("di", "DateInput", { _parentTag: "DateRangePicker" }),
        makeChild("cal", "Calendar", {}),
      ],
    );
    const di = findDateInput(result);
    expect(di).toBeDefined();
    const style = (di!.props as { style?: Record<string, unknown> }).style;
    // width 0 회귀 가드 — 명시 width 없으면 100% (부모 폭 stretch)
    expect(style?.width).toBe("100%");
    // height = catalog rule sizes.md.height (30)
    expect(style?.height).toBe(30);
  });

  it("DatePicker → DateInput 자식에 width:100% + height + granularity 주입", () => {
    const result = applyContainer(
      "DatePicker",
      { label: "Date", size: "md", labelPosition: "top", granularity: "day" },
      [
        makeChild("label", "Label", {
          children: "Date",
          style: { width: "fit-content" },
        }),
        makeChild("di", "DateInput", { _parentTag: "DatePicker" }),
        makeChild("cal", "Calendar", {}),
      ],
    );
    const di = findDateInput(result);
    expect(di).toBeDefined();
    const props = di!.props as Record<string, unknown>;
    const style = props.style as Record<string, unknown>;
    expect(style?.width).toBe("100%");
    expect(style?.height).toBe(30);
    // DateField 분기와 동형 — 세그먼트 placeholder 생성용 부모 props
    expect(props._parentTag).toBe("DatePicker");
    expect(props._granularity).toBe("day");
  });

  it("사용자 명시 width 는 보존 (cs.width ?? '100%')", () => {
    const result = applyContainer(
      "DateRangePicker",
      { label: "Date Range", size: "md" },
      [
        makeChild("di", "DateInput", {
          _parentTag: "DateRangePicker",
          style: { width: "320px" },
        }),
        makeChild("cal", "Calendar", {}),
      ],
    );
    const di = findDateInput(result);
    const style = (di!.props as { style?: Record<string, unknown> }).style;
    expect(style?.width).toBe("320px");
  });

  it("대조 — DateField 는 이미 DateInput width:100% 주입 (회귀 아님)", () => {
    const result = applyContainer("DateField", { label: "Date", size: "md" }, [
      makeChild("di", "DateInput", { _parentTag: "DateField" }),
    ]);
    const di = findDateInput(result);
    const style = (di!.props as { style?: Record<string, unknown> }).style;
    expect(style?.width).toBe("100%");
  });
});
