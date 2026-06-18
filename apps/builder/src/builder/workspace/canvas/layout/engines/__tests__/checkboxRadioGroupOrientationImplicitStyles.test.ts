import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 회귀 방지 — CheckboxGroup/RadioGroup 의 synthetic items wrapper 합성 (2026-06-19).
 *
 * **버그**: orientation(=자식 Checkbox/Radio 의 배치 축, labelPosition 과 직교) prop 이 CSS preview
 * 에서는 작동(`.checkbox-items`/`.radio-items` wrapper 의 flex-direction:row)하지만 Skia(builder
 * canvas)에서는 무시됐다. ADR-912 로 중간 컨테이너 element(CheckboxItems/RadioItems)가 데이터 모델
 * 에서 폐기돼 Skia 는 그룹 직속 flat `[Label, Checkbox, ...]` (1단) 만 받는다.
 *
 * **flat 시뮬레이션의 한계 (직전 fix 82416d543)**: 단일 flexbox 에서 flexWrap+flexBasis:100%
 * +marginLeft 로 2단을 흉내냈으나 live 측정 결과 side+vertical 에서 자식이 120px 과하게 우측 +
 * Label 아래로 떨어져 CSS 2단과 시각 불일치(opt0 CSS x=72 y=0 vs flat x=192 y=24).
 *
 * **근본 해법**: layout 시점에 synthetic items wrapper 노드(`${groupId}__items`)를 합성해 CSS
 * 2단 구조를 복원한다. 데이터 모델은 1단 유지(canonical/IndexedDB 불변), wrapper 는 render-space
 * 전용(ADR-135/136 ID 경계 — store/canonical 미영속). 합성 후:
 *   filteredChildren = [Label?, itemsWrapper, ...items]
 *     - group flex-direction = labelPosition 축 (top→column, side→row)
 *     - wrapper flex-direction = orientation 축 (vertical→column, horizontal→row)
 *     - wrapper.props.__synthChildIds = [item id...] (fullTreeLayout 이 batch index 로 연결)
 * live 좌표 검증: 4조합 전부 CSS 2단 정본과 일치(side+vertical opt0 x=72 y=0).
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

function getParentStyle(
  result: ReturnType<typeof applyImplicitStyles>,
): Record<string, unknown> {
  return (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

function getWrapper(result: ReturnType<typeof applyImplicitStyles>) {
  return result.filteredChildren.find(
    (child) => child.type === "__SyntheticItemsWrapper__",
  );
}

function getWrapperStyle(
  result: ReturnType<typeof applyImplicitStyles>,
): Record<string, unknown> {
  return (getWrapper(result)?.props?.style ?? {}) as Record<string, unknown>;
}

describe("CheckboxGroup/RadioGroup synthetic items wrapper (Skia 2단 복원 회귀 방지 2026-06-19)", () => {
  for (const tag of ["CheckboxGroup", "RadioGroup"]) {
    const itemTag = tag === "CheckboxGroup" ? "Checkbox" : "Radio";

    it(`${tag} 은 filteredChildren = [Label, itemsWrapper, ...items] 로 wrapper 를 합성한다`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top", orientation: "vertical" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );

      const types = result.filteredChildren.map((c) => c.type);
      expect(types).toEqual([
        "Label",
        "__SyntheticItemsWrapper__",
        itemTag,
        itemTag,
      ]);

      // wrapper 는 carrier(__synthChildIds)로 자식 item id 를 담아 fullTreeLayout 이
      //   group 직속에서 제외하고 wrapper children 으로 연결하게 한다(이중 부모 방지).
      const wrapper = getWrapper(result);
      expect(wrapper?.id).toBe(`${tag}-1__items`);
      expect(
        (wrapper?.props as Record<string, unknown>).__synthChildIds,
      ).toEqual(["c1", "c2"]);
    });

    it(`${tag} top+vertical → group column, wrapper column`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top", orientation: "vertical" },
        [makeChild("lbl", "Label"), makeChild("c1", itemTag)],
      );
      expect(getParentStyle(result).flexDirection).toBe("column");
      expect(getWrapperStyle(result).flexDirection).toBe("column");
    });

    it(`${tag} top+horizontal → group column, wrapper row+wrap`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top", orientation: "horizontal" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );
      expect(getParentStyle(result).flexDirection).toBe("column");
      const ws = getWrapperStyle(result);
      expect(ws.flexDirection).toBe("row");
      expect(ws.flexWrap).toBe("wrap");
    });

    it(`${tag} side+vertical → group row(flex-start), wrapper column (Label 자연폭 옆 세로)`, () => {
      // side+vertical: 직전 flat fix 의 버그 조합. wrapper 가 Label 자연폭(width 강제 없음)
      //   옆에 붙어 세로 배치 → CSS 2단 정본(opt0 x=72 y=0)과 일치, 120px 과잉 우측 제거.
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
      expect(parentStyle.alignItems).toBe("flex-start");
      // group gap 은 specFallback(spec containerStyles 정적 gap) 유지 — labelPosition 으로
      //   바꾸지 않는다(CSS group gap 은 flex-direction 과 독립).

      const ws = getWrapperStyle(result);
      expect(ws.flexDirection).toBe("column");

      // Label 은 자연폭 유지(width 강제 없음) — flat fix 의 width:176 제거가 핵심.
      const labelStyle = (result.filteredChildren.find(
        (c) => c.type === "Label",
      )?.props?.style ?? {}) as Record<string, unknown>;
      expect(labelStyle.width).toBeUndefined();
      expect(labelStyle.flexShrink).toBe(0);
      expect(labelStyle.alignSelf).toBe("flex-start");
    });

    it(`${tag} side+horizontal → group row(flex-start), wrapper row+wrap`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "side", orientation: "horizontal" },
        [
          makeChild("lbl", "Label"),
          makeChild("c1", itemTag),
          makeChild("c2", itemTag),
        ],
      );
      expect(getParentStyle(result).flexDirection).toBe("row");
      const ws = getWrapperStyle(result);
      expect(ws.flexDirection).toBe("row");
      expect(ws.flexWrap).toBe("wrap");
    });

    it(`${tag} orientation 미지정 시 wrapper 는 기본 column(vertical)`, () => {
      const result = applyContainer(
        tag,
        { label: "Options", labelPosition: "top" },
        [makeChild("lbl", "Label"), makeChild("c1", itemTag)],
      );
      expect(getWrapperStyle(result).flexDirection).toBe("column");
    });

    it(`${tag} label 없으면 filteredChildren = [itemsWrapper, ...items]`, () => {
      const result = applyContainer(
        tag,
        { labelPosition: "top", orientation: "vertical" },
        [makeChild("c1", itemTag), makeChild("c2", itemTag)],
      );
      const types = result.filteredChildren.map((c) => c.type);
      expect(types).toEqual(["__SyntheticItemsWrapper__", itemTag, itemTag]);
    });
  }
});
