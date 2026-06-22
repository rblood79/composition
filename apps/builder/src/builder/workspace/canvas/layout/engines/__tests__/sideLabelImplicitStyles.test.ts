import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

function makeChild(
  id: string,
  type: string,
  style?: Record<string, unknown>,
): Element {
  return {
    id,
    type,
    props: { style: style ?? {} },
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

function applyNestedContainer(
  parentTag: string,
  parentProps: Record<string, unknown>,
  childTag: string,
  childProps: Record<string, unknown> = {},
): ReturnType<typeof applyImplicitStyles> {
  const parent = {
    id: `${parentTag}-parent`,
    type: parentTag,
    props: parentProps,
    childrenIds: [`${childTag}-child`],
  } as Element;
  const child = {
    id: `${childTag}-child`,
    type: childTag,
    parent_id: parent.id,
    props: childProps,
    childrenIds: [],
  } as Element;
  const byId = new Map<string, Element>([
    [parent.id, parent],
    [child.id, child],
  ]);

  return applyImplicitStyles(
    child,
    [],
    (id) =>
      (
        byId.get(id) as { childrenIds?: string[] } | undefined
      )?.childrenIds?.map((childId: string) => byId.get(childId)!) ?? [],
    byId,
  );
}

function getChildStyle(
  result: ReturnType<typeof applyImplicitStyles>,
  type: string,
): Record<string, unknown> {
  return (result.filteredChildren.find((child) => child.type === type)?.props
    ?.style ?? {}) as Record<string, unknown>;
}

function getParentStyle(
  result: ReturnType<typeof applyImplicitStyles>,
): Record<string, unknown> {
  return (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("side-label implicit styles", () => {
  it("CheckboxGroup side variant는 spec containerVariants 기반 row 정렬을 사용한다", () => {
    // ADR-912 (2026-06-14): CheckboxItems 중간 컨테이너 폐기 → 자식은 Checkbox 직속.
    const result = applyContainer(
      "CheckboxGroup",
      { label: "Options", labelPosition: "side" },
      [makeChild("lbl", "Label"), makeChild("cb", "Checkbox")],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.alignItems).toBe("flex-start");
    expect(parentStyle.gap).toBe(4);

    const labelStyle = getChildStyle(result, "Label");
    expect(labelStyle.whiteSpace).toBe("nowrap");
  });

  it("NumberField side variant는 Label/Wrapper/FieldError 보정을 유지한다", () => {
    const result = applyContainer(
      "NumberField",
      { label: "Count", labelPosition: "side" },
      [
        makeChild("lbl", "Label"),
        makeChild("wrap", "SelectTrigger"),
        makeChild("err", "FieldError"),
      ],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.display).toBe("flex");
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.flexWrap).toBe("wrap");
    expect(parentStyle.alignItems).toBe("flex-start");

    const labelStyle = getChildStyle(result, "Label");
    expect(typeof labelStyle.width).toBe("number");
    expect(labelStyle.flexShrink).toBe(0);

    const wrapperStyle = getChildStyle(result, "SelectTrigger");
    expect(wrapperStyle.flex).toBe(1);
    expect(wrapperStyle.minWidth).toBe(0);

    const fieldErrorStyle = getChildStyle(result, "FieldError");
    expect(fieldErrorStyle.width).toBe("100%");
    expect(typeof fieldErrorStyle.marginLeft).toBe("number");
  });

  it("NumberField side variant는 inline flexDirection:column 이 있어도 parent row 를 강제한다", () => {
    // ADR-913 후속 fix (2026-06-19): 기존 store element 는 factory 가 박은 inline
    //   display:flex/flexDirection:column 을 보유한다(신규 분은 factory 에서 제거됐으나 기존
    //   문서 잔존). getSideLabelParentStyle 의 `...rawParentStyle` 마지막 spread 가 side 의
    //   flexDirection:row 를 column 으로 덮어 Label 이 위로 쌓이던 근본. side 모드에서 inline
    //   display/flexDirection 을 strip 하여 row 강제(그 외 inline 은 보존)하는지 가드.
    const result = applyContainer(
      "NumberField",
      {
        label: "Count",
        labelPosition: "side",
        // 기존 element 가 보유하던 inline 충돌 값
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 4,
        },
      },
      [
        makeChild("lbl", "Label"),
        makeChild("wrap", "SelectTrigger"),
        makeChild("err", "FieldError"),
      ],
    );

    const parentStyle = getParentStyle(result);
    // inline column 무시하고 row 강제
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.display).toBe("flex");
    expect(parentStyle.alignItems).toBe("flex-start");
    // 충돌 안 하는 inline 은 보존 (width/gap)
    expect(parentStyle.width).toBe("100%");
    expect(parentStyle.gap).toBe(4);
  });

  it("DateField side variant는 DateInput 보정과 parent row 레이아웃을 유지한다", () => {
    const result = applyContainer(
      "DateField",
      { label: "Date", labelPosition: "side", size: "md" },
      [
        makeChild("lbl", "Label"),
        makeChild("input", "DateInput"),
        makeChild("err", "FieldError"),
      ],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.display).toBe("flex");
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.flexWrap).toBe("wrap");
    expect(parentStyle.alignItems).toBe("flex-start");

    const inputStyle = getChildStyle(result, "DateInput");
    // 2026-06-23: layout 분기 width 미주입 — side 모드는 injectSideLabel 의 flex:1 이 폭 담당.
    expect(inputStyle.width).toBeUndefined();
    expect(inputStyle.height).toBe(30);
    expect(inputStyle.flex).toBe(1);
    expect(inputStyle.minWidth).toBe(0);

    const fieldErrorStyle = getChildStyle(result, "FieldError");
    expect(fieldErrorStyle.width).toBe("100%");
    expect(typeof fieldErrorStyle.marginLeft).toBe("number");
  });

  it("DatePicker side variant는 Group 보정을 유지하고 popover children을 제외한다", () => {
    const result = applyContainer(
      "DatePicker",
      { label: "Appointment", labelPosition: "side" },
      [
        makeChild("lbl", "Label"),
        makeChild("group", "Group"),
        makeChild("err", "FieldError"),
        makeChild("calendar", "Calendar"),
      ],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.display).toBe("flex");
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.flexWrap).toBe("wrap");
    expect(parentStyle.alignItems).toBe("flex-start");

    const groupStyle = getChildStyle(result, "Group");
    expect(groupStyle.flex).toBe(1);
    expect(groupStyle.minWidth).toBe(0);

    const fieldErrorStyle = getChildStyle(result, "FieldError");
    expect(fieldErrorStyle.width).toBe("100%");
    expect(typeof fieldErrorStyle.marginLeft).toBe("number");
    expect(
      result.filteredChildren.find((child) => child.type === "Calendar"),
    ).toBe(undefined);
  });

  it("TextArea side variant는 TextField와 같은 Label/Input/FieldError 보정을 사용한다", () => {
    const result = applyContainer(
      "TextArea",
      { label: "Bio", labelPosition: "side" },
      [
        makeChild("lbl", "Label"),
        makeChild("input", "Input"),
        makeChild("err", "FieldError"),
      ],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.display).toBe("flex");
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.flexWrap).toBe("wrap");
    expect(parentStyle.alignItems).toBe("flex-start");

    const labelStyle = getChildStyle(result, "Label");
    expect(typeof labelStyle.width).toBe("number");
    expect(labelStyle.flexShrink).toBe(0);

    const inputStyle = getChildStyle(result, "Input");
    expect(inputStyle.flex).toBe(1);
    expect(inputStyle.minWidth).toBe(0);

    const fieldErrorStyle = getChildStyle(result, "FieldError");
    expect(fieldErrorStyle.width).toBe("100%");
    expect(typeof fieldErrorStyle.marginLeft).toBe("number");
  });

  it("TagGroup side variant는 spec containerVariants 기반 row 정렬을 사용한다", () => {
    const result = applyContainer(
      "TagGroup",
      { label: "Tags", labelPosition: "side" },
      [makeChild("lbl", "Label"), makeChild("list", "TagList")],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.flexDirection).toBe("row");
    expect(parentStyle.alignItems).toBe("flex-start");
    expect(parentStyle.flexWrap).toBe("wrap");

    const labelStyle = getChildStyle(result, "Label");
    expect(labelStyle.whiteSpace).toBe("nowrap");
  });

  it("TagGroup top 기본 방향은 spec containerStyles 기반 column 정렬을 사용한다", () => {
    const result = applyContainer(
      "TagGroup",
      { label: "Tags", labelPosition: "top" },
      [makeChild("lbl", "Label"), makeChild("list", "TagList")],
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.flexDirection).toBe("column");
    expect(parentStyle.flexWrap).toBeUndefined();
  });

  it("TagList는 부모 TagGroup side variant를 기준으로 flex 보정을 받는다", () => {
    const result = applyNestedContainer(
      "TagGroup",
      { label: "Tags", labelPosition: "side" },
      "TagList",
    );

    const parentStyle = getParentStyle(result);
    expect(parentStyle.flex).toBe(1);
    expect(parentStyle.minWidth).toBe(0);
  });
});
