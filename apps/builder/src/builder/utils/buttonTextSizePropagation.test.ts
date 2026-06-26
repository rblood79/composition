/**
 * Button/ToggleButton → 자식 Text size 전파 회귀 테스트 (2026-06-27).
 *
 * icon Button label = RSP 공식 `<Button><Icon/><Text>label</Text></Button>` 의 `<Text>` 자식
 * element. 사용자 요청: Button.size 변경 시 자식 Text.size 도 같이 변경(부모-자식 글자 크기 일관),
 * Button/Text size 범위는 둘 다 xs~xl 포함.
 *
 * 두 메커니즘:
 *  1. propagationRegistry 의 buttonPropagationRules(size → Text, override) 등록 — *변경* 시점
 *     Inspector edit 경로(PropertiesPanel)에서 buildPropagationUpdates 가 자식 Text size 갱신.
 *  2. 생성 시점 초기 size 주입은 ButtonChildSection.buildButtonChild(별도 테스트 불필요 — 본
 *     테스트는 변경 시점 전파 계약을 고정).
 *
 * 실행: pnpm vitest buttonTextSizePropagation
 */

import { describe, it, expect } from "vitest";

import {
  getPropagationRules,
  getParentTagsForChild,
} from "./propagationRegistry";
import { buildPropagationUpdates } from "./propagationEngine";

type ElementLike = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

describe("Button/ToggleButton size → Text 전파 rule 등록", () => {
  it("Button 에 size → Text override rule 등록됨", () => {
    const rules = getPropagationRules("Button");
    expect(rules).toBeDefined();
    expect(rules).toContainEqual({
      parentProp: "size",
      childPath: "Text",
      override: true,
    });
  });

  it("ToggleButton 에 size → Text override rule 등록됨 (Button 동형)", () => {
    const rules = getPropagationRules("ToggleButton");
    expect(rules).toBeDefined();
    expect(rules).toContainEqual({
      parentProp: "size",
      childPath: "Text",
      override: true,
    });
  });

  it("reverse index — Text 의 parent 에 button/togglebutton 포함", () => {
    const parents = getParentTagsForChild("Text");
    expect(parents).toBeDefined();
    expect(parents!.has("button")).toBe(true);
    expect(parents!.has("togglebutton")).toBe(true);
  });
});

describe("buildPropagationUpdates — Button size 변경 시 자식 Text size 동기화", () => {
  function setup(parentType: "Button" | "ToggleButton") {
    const parent: ElementLike = {
      id: "btn",
      type: parentType,
      props: { size: "md" },
    };
    const textChild: ElementLike = {
      id: "txt",
      type: "Text",
      props: { children: "Label", size: "md" },
    };
    const iconChild: ElementLike = {
      id: "ic",
      type: "Icon",
      props: { iconName: "star" },
    };
    const childrenMap = new Map<string, ElementLike[]>([
      ["btn", [iconChild, textChild]],
    ]);
    const elementsMap = new Map<string, ElementLike>([
      ["btn", parent],
      ["txt", textChild],
      ["ic", iconChild],
    ]);
    return { parent, childrenMap, elementsMap };
  }

  it.each(["Button", "ToggleButton"] as const)(
    "%s size md→lg 변경 → 자식 Text size 도 lg",
    (parentType) => {
      const { parent, childrenMap, elementsMap } = setup(parentType);
      const rules = getPropagationRules(parentType)!;
      const updates = buildPropagationUpdates(
        parent,
        { size: "lg" },
        rules,
        childrenMap,
        elementsMap,
      );
      const textUpdate = updates.find((u) => u.elementId === "txt");
      expect(textUpdate).toBeDefined();
      expect(textUpdate!.props.size).toBe("lg");
    },
  );

  it("size 범위 xs~xl 전파 무손실 (Button 범위 전부)", () => {
    const { parent, childrenMap, elementsMap } = setup("Button");
    const rules = getPropagationRules("Button")!;
    for (const size of ["xs", "sm", "md", "lg", "xl"]) {
      const updates = buildPropagationUpdates(
        parent,
        { size },
        rules,
        childrenMap,
        elementsMap,
      );
      const textUpdate = updates.find((u) => u.elementId === "txt");
      expect(textUpdate?.props.size).toBe(size);
    }
  });

  it("Icon 자식은 size 전파 대상 아님 (Text 만)", () => {
    const { parent, childrenMap, elementsMap } = setup("Button");
    const rules = getPropagationRules("Button")!;
    const updates = buildPropagationUpdates(
      parent,
      { size: "lg" },
      rules,
      childrenMap,
      elementsMap,
    );
    expect(updates.find((u) => u.elementId === "ic")).toBeUndefined();
  });

  it("size 외 prop 변경은 Text 전파 트리거 안 함", () => {
    const { parent, childrenMap, elementsMap } = setup("Button");
    const rules = getPropagationRules("Button")!;
    const updates = buildPropagationUpdates(
      parent,
      { variant: "secondary" },
      rules,
      childrenMap,
      elementsMap,
    );
    expect(updates).toHaveLength(0);
  });
});
