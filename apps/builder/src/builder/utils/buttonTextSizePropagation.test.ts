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
  buttonIconPx,
  buttonTextMetrics,
} from "./propagationRegistry";
import { buildPropagationUpdates } from "./propagationEngine";

type ElementLike = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

// 사용자 지정 버튼 내 아이콘 px (2026-06-27) — catalog Button.sizes[size].iconSize 단일 소스.
const EXPECTED_ICON_PX: Record<string, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 24,
  xl: 28,
};

describe("Button/ToggleButton → Text 텍스트 척도(fontSize/lineHeight) inline 전파", () => {
  it("Button 에 size → Text fontSize/lineHeight (asStyle) rule 등록됨", () => {
    const rules = getPropagationRules("Button")!;
    const textStyleRules = rules.filter(
      (r) => r.childPath === "Text" && r.asStyle,
    );
    // fontSize + lineHeight 2 rule.
    expect(textStyleRules.map((r) => r.childProp).sort()).toEqual([
      "fontSize",
      "lineHeight",
    ]);
    // size prop 직접 전파 rule 은 없어야 함(Text 컴포넌트 독립 척도 16/24 적용 방지).
    expect(rules.some((r) => r.childPath === "Text" && !r.asStyle)).toBe(false);
  });

  it("ToggleButton 동형 (Button 과 같은 Text 척도 전파)", () => {
    const rules = getPropagationRules("ToggleButton")!;
    const textStyleRules = rules.filter(
      (r) => r.childPath === "Text" && r.asStyle,
    );
    expect(textStyleRules.map((r) => r.childProp).sort()).toEqual([
      "fontSize",
      "lineHeight",
    ]);
  });

  it("reverse index — Text 의 parent 에 button/togglebutton 포함", () => {
    const parents = getParentTagsForChild("Text");
    expect(parents).toBeDefined();
    expect(parents!.has("button")).toBe(true);
    expect(parents!.has("togglebutton")).toBe(true);
  });
});

describe("buttonTextMetrics — catalog Button.sizes fontSize/lineHeight read-through", () => {
  it("md → text-sm 척도 (fontSize 14 / lineHeight '20px')", () => {
    const tm = buttonTextMetrics("md");
    expect(tm.fontSize).toBe(14);
    expect(tm.lineHeight).toBe("20px");
  });

  it("lineHeight 는 항상 'Npx' 문자열 (parseLineHeight 배율 오해석 방지)", () => {
    for (const size of ["xs", "sm", "md", "lg", "xl"]) {
      const tm = buttonTextMetrics(size);
      expect(typeof tm.lineHeight).toBe("string");
      expect(tm.lineHeight).toMatch(/^\d+(\.\d+)?px$/);
      expect(typeof tm.fontSize).toBe("number");
    }
  });

  it("미지정/비문자열 → md(14 / '20px') fallback", () => {
    expect(buttonTextMetrics(undefined)).toEqual({
      fontSize: 14,
      lineHeight: "20px",
    });
    expect(buttonTextMetrics(42)).toEqual({ fontSize: 14, lineHeight: "20px" });
  });
});

describe("buildPropagationUpdates — Button size 변경 시 Text 척도 inline 동기화", () => {
  function setup(parentType: "Button" | "ToggleButton") {
    const parent: ElementLike = {
      id: "btn",
      type: parentType,
      props: { size: "md" },
    };
    const textChild: ElementLike = {
      id: "txt",
      type: "Text",
      props: { children: "Label", style: { fontSize: 14, lineHeight: "20px" } },
    };
    const iconChild: ElementLike = {
      id: "ic",
      type: "Icon",
      props: { iconName: "star", style: { fontSize: 18, height: 18 } },
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
    "%s size 변경 → Text style.fontSize/lineHeight 가 Button 척도(Text 컴포넌트 16/24 아님)",
    (parentType) => {
      const { parent, childrenMap, elementsMap } = setup(parentType);
      const rules = getPropagationRules(parentType)!;
      for (const size of ["xs", "sm", "md", "lg", "xl"]) {
        const updates = buildPropagationUpdates(
          parent,
          { size },
          rules,
          childrenMap,
          elementsMap,
        );
        const textUpdate = updates.find((u) => u.elementId === "txt");
        expect(textUpdate).toBeDefined();
        const style = textUpdate!.props.style as Record<string, unknown>;
        const tm = buttonTextMetrics(size);
        expect(style.fontSize).toBe(tm.fontSize);
        expect(style.lineHeight).toBe(tm.lineHeight);
        // Text 에 size prop 직접 전파 안 함(독립 척도 적용 방지).
        expect(textUpdate!.props.size).toBeUndefined();
      }
    },
  );

  it("md: Text 가 Button 척도 14/20px — Text 컴포넌트 척도 16/24 가 아님(height leaf 정합)", () => {
    const { parent, childrenMap, elementsMap } = setup("Button");
    const rules = getPropagationRules("Button")!;
    const updates = buildPropagationUpdates(
      parent,
      { size: "md" },
      rules,
      childrenMap,
      elementsMap,
    );
    const textUpdate = updates.find((u) => u.elementId === "txt")!;
    const style = textUpdate.props.style as Record<string, unknown>;
    expect(style.fontSize).toBe(14);
    expect(style.lineHeight).toBe("20px");
    expect(style.fontSize).not.toBe(16); // Text 컴포넌트 md 척도 배제
  });

  it("size 외 prop 변경은 Text/Icon 전파 트리거 안 함", () => {
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

describe("buttonIconPx — catalog Button.sizes iconSize read-through", () => {
  it.each(Object.entries(EXPECTED_ICON_PX))("size=%s → %d px", (size, px) => {
    expect(buttonIconPx(size)).toBe(px);
  });

  it("미지정/비문자열 → md(18) fallback", () => {
    expect(buttonIconPx(undefined)).toBe(18);
    expect(buttonIconPx(42)).toBe(18);
    expect(buttonIconPx("nope")).toBe(18);
  });
});

describe("buildPropagationUpdates — Button size 변경 시 자식 Icon px(style.fontSize) 동기화", () => {
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
      props: { iconName: "star", style: { fontSize: 18 } },
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
    "%s size 변경 → Icon style.fontSize/height 가 buttonIconPx 매핑 + size prop 동기",
    (parentType) => {
      const { parent, childrenMap, elementsMap } = setup(parentType);
      const rules = getPropagationRules(parentType)!;
      for (const size of ["xs", "sm", "md", "lg", "xl"]) {
        const updates = buildPropagationUpdates(
          parent,
          { size },
          rules,
          childrenMap,
          elementsMap,
        );
        const iconUpdate = updates.find((u) => u.elementId === "ic");
        expect(iconUpdate).toBeDefined();
        const style = iconUpdate!.props.style as
          | Record<string, unknown>
          | undefined;
        // 픽셀 강제: fontSize(SVG 1em) + height(컨테이너 박스) 둘 다 매핑 px.
        expect(style?.fontSize).toBe(EXPECTED_ICON_PX[size]);
        expect(style?.height).toBe(EXPECTED_ICON_PX[size]);
        // 의미 정합: top-level size prop = 부모 size → DOM data-size.
        expect(iconUpdate!.props.size).toBe(size);
      }
    },
  );

  it("Icon size prop 전파 → data-size(DOM) 가 부모 size 와 정합", () => {
    const { parent, childrenMap, elementsMap } = setup("Button");
    const rules = getPropagationRules("Button")!;
    const updates = buildPropagationUpdates(
      parent,
      { size: "lg" },
      rules,
      childrenMap,
      elementsMap,
    );
    const iconUpdate = updates.find((u) => u.elementId === "ic")!;
    // size prop = lg (data-size="lg" 로 렌더), style.fontSize/height = 24(매핑 px).
    expect(iconUpdate.props.size).toBe("lg");
    const style = iconUpdate.props.style as Record<string, unknown>;
    expect(style.fontSize).toBe(24);
    expect(style.height).toBe(24);
    // top-level fontSize/height 는 미설정(asStyle 은 style 에만).
    expect(iconUpdate.props.fontSize).toBeUndefined();
    expect(iconUpdate.props.height).toBeUndefined();
  });
});
