import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 회귀 방지 — CheckboxGroup/RadioGroup orientation 의 Skia 레이아웃 처리 (2026-06-19).
 *
 * **버그**: orientation(=자식 Checkbox/Radio 의 배치 축, labelPosition 과 직교) prop 이 CSS preview
 * 에서는 작동(`.checkbox-items`/`.radio-items` wrapper 의 flex-direction:row)하지만 Skia(builder
 * canvas)에서는 무시됐다. `implicitStyles.ts` 의 CheckboxGroup/RadioGroup 블록이 flexDirection 을
 * 항상 "column" 으로 하드코딩하고 orientation prop 을 안 읽었기 때문(ToggleButtonGroup/Toolbar 는 읽음).
 *
 * **fix**: ADR-912 로 중간 컨테이너(.checkbox-items)가 폐기돼 Skia 는 그룹 직속 flat
 * `[Label, Checkbox, ...]` 만 받는다. CSS 2단 구조(그룹 column > Label + items row)를 Skia 1단에서
 * 재현하기 위해 horizontal 시 그룹 flexDirection:row + flexWrap:wrap, Label 에 flexBasis:100% 를
 * 주입한다(Label 이 첫 줄 전체 차지 → 자식 Checkbox 가 둘째 줄에 가로 배치). vertical 은 기존 column.
 * labelPosition=side(sideMode)는 orientation 과 직교한 별도 축이라 영향받지 않는다.
 */

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

describe("CheckboxGroup/RadioGroup orientation implicit styles (Skia 대칭 회귀 방지 2026-06-19)", () => {
  for (const tag of ["CheckboxGroup", "RadioGroup"]) {
    const itemTag = tag === "CheckboxGroup" ? "Checkbox" : "Radio";

    it(`${tag} orientation=horizontal 은 그룹 row+wrap + Label flexBasis:100% 를 주입한다`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top", orientation: "horizontal" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );

      const parentStyle = getParentStyle(result);
      // CSS 의 .checkbox-items[data-orientation=horizontal] flex-direction:row 와 시각 대칭.
      expect(parentStyle.flexDirection).toBe("row");
      expect(parentStyle.flexWrap).toBe("wrap");
      expect(parentStyle.alignItems).toBe("flex-start");

      // Label 이 첫 줄 전체를 차지해 자식을 둘째 줄로 wrap 시킨다(CSS 2단 구조 재현).
      const labelStyle = getChildStyle(result, "Label");
      expect(labelStyle.flexBasis).toBe("100%");
      expect(labelStyle.whiteSpace).toBe("nowrap");
    });

    it(`${tag} orientation=vertical 은 기존 column(wrap/flexBasis 없음)을 유지한다`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top", orientation: "vertical" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );

      const parentStyle = getParentStyle(result);
      expect(parentStyle.flexDirection).toBe("column");
      expect(parentStyle.flexWrap).toBeUndefined();

      const labelStyle = getChildStyle(result, "Label");
      expect(labelStyle.flexBasis).toBeUndefined();
    });

    it(`${tag} orientation 미지정 시 기본 vertical(column)로 동작한다`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top" },
        [makeChild("lbl", "Label"), makeChild("c1", itemTag)],
      );

      const parentStyle = getParentStyle(result);
      expect(parentStyle.flexDirection).toBe("column");
      expect(parentStyle.flexWrap).toBeUndefined();
    });

    it(`${tag} labelPosition=side 는 orientation=horizontal 과 직교 — side(row) 유지, flexBasis 미주입`, () => {
      // sideMode 는 labelPosition(그룹↔라벨 축)이라 orientation(자식 축)과 별개 분기.
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "side", orientation: "horizontal" },
        [makeChild("lbl", "Label"), makeChild("c1", itemTag)],
      );

      const parentStyle = getParentStyle(result);
      // side variant 의 row 정렬 유지(orientation 의 wrap 패턴이 침범하지 않음).
      expect(parentStyle.flexDirection).toBe("row");
      expect(parentStyle.alignItems).toBe("flex-start");

      // side mode 에서는 Label flexBasis:100% 를 주입하지 않는다(horizontal wrap 패턴 비적용).
      const labelStyle = getChildStyle(result, "Label");
      expect(labelStyle.flexBasis).toBeUndefined();
    });
  }
});
