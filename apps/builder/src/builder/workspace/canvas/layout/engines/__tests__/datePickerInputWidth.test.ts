import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * DatePicker / DateRangePicker 의 DateInput 자식 prop/height 주입 + width 정책 회귀 가드.
 *
 * 1차 버그(width 0): layout 분기가 DateInput 에 height/_granularity/_hourCycle/_locale 를
 *   주입 안 해 Taffy width 0. → 부모 props + height 주입으로 해소.
 *
 * 2차 버그(box < 콘텐츠, 2026-06-23): width 0 fix 가 `width:"100%"` 를 줬는데, 부모
 *   container 가 width:auto(body align-items:flex-start)라 Taffy 가 `100%` 를 콘텐츠보다
 *   작게 계산 → box < 콘텐츠 → segment 텍스트가 box 밖으로 넘침. → layout 분기는 width 를
 *   **주입하지 않고**(명시 width 만 보존), INLINE_BLOCK_TAGS(dateinput) + calculateContentWidth
 *   dateinput 분기가 콘텐츠 자연폭을 산출하도록 위임(dateInputContentWidth.test.ts 가 폭 검증).
 *
 * factory(DateColorComponents.ts)는 DateInput 을 `{ _parentTag }` 만으로 생성하므로
 *   layout 분기가 유일한 부모 props 주입처.
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

describe("DatePicker/DateRangePicker DateInput width policy", () => {
  it("DateRangePicker → DateInput 자식에 height 주입 + width 는 미주입(자연폭 위임)", () => {
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
    // 2차 버그(box<콘텐츠) fix — width 는 주입하지 않는다 (calculateContentWidth 위임).
    expect(style?.width).toBeUndefined();
    // height = catalog rule sizes.md.height (30)
    expect(style?.height).toBe(30);
  });

  it("DatePicker → DateInput 자식에 height + granularity 주입, width 미주입", () => {
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
    expect(style?.width).toBeUndefined();
    expect(style?.height).toBe(30);
    // DateField 분기와 동형 — 세그먼트 placeholder 생성용 부모 props
    expect(props._parentTag).toBe("DatePicker");
    expect(props._granularity).toBe("day");
  });

  it("사용자 명시 width 는 보존 (cs.width !== undefined 면 유지)", () => {
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

  it("대조 — DateField 도 width 미주입 (동일 정책, calculateContentWidth 위임)", () => {
    const result = applyContainer("DateField", { label: "Date", size: "md" }, [
      makeChild("di", "DateInput", { _parentTag: "DateField" }),
    ]);
    const di = findDateInput(result);
    const style = (di!.props as { style?: Record<string, unknown> }).style;
    expect(style?.width).toBeUndefined();
  });
});
