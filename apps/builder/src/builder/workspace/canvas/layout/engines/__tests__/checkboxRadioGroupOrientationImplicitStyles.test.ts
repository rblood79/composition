import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import {
  applyImplicitStyles,
  FORM_SIDE_LABEL_GAP,
  FORM_SIDE_LABEL_WIDTH,
} from "../implicitStyles";

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

    it(`${tag} labelPosition=side + orientation=horizontal 은 Label 좌측 고정 + 자식 Label 옆 가로(row+wrap)`, () => {
      // side = Label↔자식묶음 축(그룹 row), orientation = 자식 내부 축(horizontal).
      //   side+horizontal: 자식이 Label 옆에 가로로 이어진다 → 자식 flexBasis/marginLeft 미주입.
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "side", orientation: "horizontal" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );

      const parentStyle = getParentStyle(result);
      expect(parentStyle.flexDirection).toBe("row");
      expect(parentStyle.flexWrap).toBe("wrap");
      expect(parentStyle.alignItems).toBe("flex-start");

      // Label: 좌측 1열 고정(폭 + 축소 방지 + 상단 정렬). top wrap 의 flexBasis:100% 와 다름.
      const labelStyle = getChildStyle(result, "Label");
      expect(labelStyle.width).toBe(FORM_SIDE_LABEL_WIDTH);
      expect(labelStyle.flexShrink).toBe(0);
      expect(labelStyle.alignSelf).toBe("flex-start");
      expect(labelStyle.flexBasis).toBeUndefined();

      // 자식: side+horizontal 은 Label 옆 가로 → flexBasis/marginLeft 미주입.
      const childStyle = getChildStyle(result, itemTag);
      expect(childStyle.flexBasis).toBeUndefined();
      expect(childStyle.marginLeft).toBeUndefined();
    });

    it(`${tag} labelPosition=side + orientation=vertical 은 Label 좌측 고정 + 자식 우측 세로(flexBasis+marginLeft)`, () => {
      // side+vertical: 자식이 Label 우측에서 세로로 쌓인다. 1단 flat 에서 wrapper 없이
      //   각 자식이 우측 영역을 다 차지(flexBasis)해 wrap(세로) + marginLeft 로 Label 폭 들여쓰기.
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "side", orientation: "vertical" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );

      const parentStyle = getParentStyle(result);
      expect(parentStyle.flexDirection).toBe("row");
      expect(parentStyle.flexWrap).toBe("wrap");
      expect(parentStyle.alignItems).toBe("flex-start");

      const labelStyle = getChildStyle(result, "Label");
      expect(labelStyle.width).toBe(FORM_SIDE_LABEL_WIDTH);
      expect(labelStyle.flexShrink).toBe(0);

      // 자식: 한 줄 차지(flexBasis:100% → wrap → 세로) + Label 폭만큼 우측 들여쓰기.
      //   calc(100%-Npx) 는 layout 엔진이 ctx 부재 시 undefined 처리 → "100%" + marginLeft 조합.
      const childStyle = getChildStyle(result, itemTag);
      const expectedOffset = FORM_SIDE_LABEL_WIDTH + FORM_SIDE_LABEL_GAP;
      expect(childStyle.flexBasis).toBe("100%");
      expect(childStyle.marginLeft).toBe(expectedOffset);
    });
  }
});
