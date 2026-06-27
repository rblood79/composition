import { describe, it, expect } from "vitest";
import {
  BUTTON_CHILD_HOST_TAGS,
  buildButtonChild,
  findFirstIconChild,
  findFirstTextChild,
} from "./ButtonChildSection";

describe("ButtonChildSection gate", () => {
  it("Button/ToggleButton 만 host 대상", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("Button")).toBe(true);
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButton")).toBe(true);
  });

  it("ToggleButtonGroup / 비-button 은 host 아님", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButtonGroup")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Text")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Frame")).toBe(false);
  });
});

describe("findFirstIconChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstIconChild([])).toBeUndefined();
  });

  it("Icon 자식 없으면 undefined", () => {
    expect(
      findFirstIconChild([
        { id: "t1", type: "Text" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Icon 자식 반환", () => {
    const result = findFirstIconChild([
      { id: "t1", type: "Text" },
      { id: "i1", type: "Icon" },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i1");
  });

  it("삭제된 Icon 은 건너뛴다", () => {
    const result = findFirstIconChild([
      { id: "i1", type: "Icon", deleted: true },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i2");
  });
});

describe("findFirstTextChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstTextChild([])).toBeUndefined();
  });

  it("Text 자식 없으면 undefined", () => {
    expect(
      findFirstTextChild([
        { id: "i1", type: "Icon" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Text 자식 반환", () => {
    const result = findFirstTextChild([
      { id: "i1", type: "Icon" },
      { id: "t1", type: "Text" },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t1");
  });

  it("삭제된 Text 는 건너뛴다", () => {
    const result = findFirstTextChild([
      { id: "t1", type: "Text", deleted: true },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t2");
  });
});

/**
 * buildButtonChild 생성 시점 size 주입 회귀 (2026-06-28).
 *
 * **버그**: 부모 XL ToggleButton 에 icon 추가 시 Icon 자식은 size:xl 을 받는데 Text 자식은
 *   size prop 이 누락돼 getDefaultProps("Text").size(md)로 고정 → 형제 size 불일치(Icon xl /
 *   Text md). 사용자: "부모 XL 자식 icon 추가 시 자식 text size 가 XL 이 아닌 M".
 * **수정**: Text 생성 propsOverride 에 size 주입(Icon 동형). 시각은 inline fontSize/lineHeight 가
 *   Text.css [data-size] 보다 우선이라 버튼 척도 유지.
 */
describe("buildButtonChild 생성 시점 size 주입", () => {
  it("Text 자식 propsOverride 의 size 가 생성 element.props.size 로 반영된다", () => {
    const el = buildButtonChild("Text", "parent-1", "page-1", [], {
      children: "Toggle 2",
      size: "xl",
      style: { fontSize: 18, lineHeight: "28px" },
    });
    expect(el.type).toBe("Text");
    expect((el.props as { size?: unknown }).size).toBe("xl");
    // 시각 inline 도 보존
    const style = (el.props as { style?: Record<string, unknown> }).style;
    expect(style?.fontSize).toBe(18);
    expect(style?.lineHeight).toBe("28px");
  });

  it("Icon 자식도 propsOverride size 반영 (Text 와 동형)", () => {
    const el = buildButtonChild("Icon", "parent-1", "page-1", [], {
      iconName: "a-arrow-down",
      size: "lg",
      style: { fontSize: 24, height: 24 },
    });
    expect((el.props as { size?: unknown }).size).toBe("lg");
  });
});
