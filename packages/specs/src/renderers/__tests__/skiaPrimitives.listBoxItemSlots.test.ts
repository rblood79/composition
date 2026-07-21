import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "../skiaPrimitives";
import type { Shape, SizeSpec } from "../../types";

/**
 * ADR-148 Phase 0 — `listbox_item` escape 의 slot 구성(`props._slots`) 소비 게이트.
 *
 * **갭 (2026-07-17 실측, ADR-148 R8)**: ADR-147 이 도입한 origin slot 조합 자식
 * (Icon/Label/Description, `metadata.slotRole`)은 어떤 렌더 경로도 소비하지 않는
 * 미배선 구조였다 — origin 에서 slot 자식을 지워도/스타일을 바꿔도 화면 변화 0.
 *
 * **배선 계약**: projection(appendListBoxRowProjection)이 origin slot 자식에서
 * `resolveSlotComposition()`(packages/shared slotRoles.ts — 계약 정본) 결과를 projected
 * row 의 `props._slots` 로 주입하고, 본 escape 가 slot **존재 gating / 스타일 overlay /
 * 스택 순서**를 소비한다. `_slots` 부재 = legacy 문서 → 기존 flat-props 동작(BC).
 */

// ListBoxItem rule.sizes.md 근사 미러 (escape 는 숫자 fallback 보유).
const sizeMd: SizeSpec = {
  height: 0,
  paddingX: 12,
  paddingY: 4,
  fontSize: 14 as never,
  gap: 2,
  iconSize: 16,
  borderRadius: 4,
  borderWidth: 0,
};

const draw = getSkiaPrimitive("listbox_item")!;

type AnyShape = {
  type?: string;
  iconName?: string;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fontWeight?: string | number;
  fill?: string;
};

function iconShapes(shapes: Shape[] | null): AnyShape[] {
  return ((shapes ?? []) as AnyShape[]).filter(
    (s) => s.type === "icon_font" && s.iconName !== "check",
  );
}

function textShapes(shapes: Shape[] | null): AnyShape[] {
  return ((shapes ?? []) as AnyShape[]).filter((s) => s.type === "text");
}

const flatProps = {
  children: "Aardvark",
  description: "A large burrowing mammal",
  icon: "star",
};

function drawWith(
  props: Record<string, unknown>,
  style: Record<string, unknown> = {},
): Shape[] | null {
  return draw({
    props,
    size: sizeMd,
    visual: undefined,
    style,
  } as Parameters<typeof draw>[0]);
}

function composition(
  order: string[],
  styles: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    order,
    slots: Object.fromEntries(
      order.map((role) => [role, { role, style: styles[role] }]),
    ),
  };
}

describe("listbox_item slot 구성 소비 (ADR-148 Phase 0 배선)", () => {
  it("BC: _slots 부재(legacy) → icon + label + description 모두 렌더 (기존 동작)", () => {
    const shapes = drawWith({ ...flatProps });

    expect(iconShapes(shapes)).toHaveLength(1);
    expect(textShapes(shapes).map((s) => s.text)).toEqual([
      "Aardvark",
      "A large burrowing mammal",
    ]);
  });

  it("icon slot 자식이 구성에 없으면 데이터에 icon 이 있어도 미렌더", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"]),
    });

    expect(iconShapes(shapes)).toHaveLength(0);
    // icon 미렌더 시 텍스트는 icon 여백 없이 paddingLeft 에서 시작
    expect(textShapes(shapes)[0]?.x).toBe(12);
  });

  it("description slot 자식이 구성에 없으면 데이터가 있어도 미렌더 + 단일 줄 세로 중앙", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["icon", "label"]),
    });

    const texts = textShapes(shapes);
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text).toBe("Aardvark");
    // 단일 줄 → rowHeight/2 세로 중앙 (paddingY 4*2 + lineHeight 20 = 28 → y 14)
    expect(texts[0]?.y).toBe(14);
  });

  it("label slot 자식이 구성에 없으면 label 미렌더 (description 만 잔존)", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["icon", "description"]),
    });

    const texts = textShapes(shapes);
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text).toBe("A large burrowing mammal");
  });

  it("label slot 자식 style 이 fontWeight/color/fontSize overlay 로 반영된다", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        label: { fontWeight: 800, color: "#ff0000", fontSize: 18 },
      }),
    });

    const label = textShapes(shapes).find((s) => s.text === "Aardvark");
    expect(label?.fontWeight).toBe(800);
    expect(label?.fill).toBe("#ff0000");
    expect(label?.fontSize).toBe(18);
  });

  it("description slot 자식 style 이 color/fontSize overlay 로 반영된다", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        description: { color: "#00aa00", fontSize: 12 },
      }),
    });

    const desc = textShapes(shapes).find(
      (s) => s.text === "A large burrowing mammal",
    );
    expect(desc?.fill).toBe("#00aa00");
    expect(desc?.fontSize).toBe(12);
  });

  it("icon slot 자식 style 의 fontSize 가 icon 크기 채널로 반영된다", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["icon", "label"], {
        icon: { fontSize: 24, color: "#0000ff" },
      }),
    });

    const icon = iconShapes(shapes)[0];
    expect(icon?.fontSize).toBe(24);
    expect(icon?.fill).toBe("#0000ff");
    // textX 도 커진 icon 폭을 반영 (slotInset 12 + 24 + slotGap 6 = 42)
    expect(textShapes(shapes)[0]?.x).toBe(42);
  });

  it("slot 자식 순서가 label/description 스택 순서를 결정한다 (description 선행)", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["description", "label"]),
    });

    const texts = textShapes(shapes);
    expect(texts.map((s) => s.text)).toEqual([
      "A large burrowing mammal",
      "Aardvark",
    ]);
    expect(texts[0]!.y!).toBeLessThan(texts[1]!.y!);
  });

  it("잘못된 _slots shape 는 무시하고 legacy 동작 유지 (방어적 판독)", () => {
    const shapes = drawWith({ ...flatProps, _slots: "broken" });

    expect(iconShapes(shapes)).toHaveLength(1);
    expect(textShapes(shapes)).toHaveLength(2);
  });
});

// 2026-07-20 (Selected variant 배선) — row-bg fill 우선순위:
//   style.backgroundColor(origin style override 층) > catalog fill(selected) > 투명.
describe("listbox_item row-bg — origin style override 층 (2026-07-20)", () => {
  function rowBg(shapes: Shape[] | null): AnyShape | undefined {
    return ((shapes ?? []) as Array<AnyShape & { id?: string }>).find(
      (s) => s.id === "row-bg",
    );
  }

  it("isSelected + backgroundColor 부재 → catalog fallback(accent-subtle) 유지", () => {
    const shapes = drawWith({ ...flatProps, isSelected: true });
    expect(rowBg(shapes)?.fill).toBe("{color.accent-subtle}");
  });

  it("isSelected + style.backgroundColor → origin override 가 fill 로 반영", () => {
    const shapes = drawWith(
      { ...flatProps, isSelected: true },
      { backgroundColor: "var(--accent-subtle)" },
    );
    expect(rowBg(shapes)?.fill).toBe("var(--accent-subtle)");
  });

  it("비선택 + style.backgroundColor → Default origin 배경도 행에 렌더", () => {
    const shapes = drawWith({ ...flatProps }, { backgroundColor: "#eee" });
    expect(rowBg(shapes)?.fill).toBe("#eee");
  });

  it("비선택 + backgroundColor 부재 → row-bg 미생성 (기존 투명 동작 BC)", () => {
    const shapes = drawWith({ ...flatProps });
    expect(rowBg(shapes)).toBeUndefined();
  });
});

// 2026-07-21 — 행 appearance 전반 렌더 (background 특정이 아니라 Style 패널 appearance 전체):
//   origin ListBoxItem 의 border / box-shadow style 이 projected 행에 반영되어야 한다
//   (사용자 보고: origin 에 border 변경 → 인스턴스 행 미반영). row-bg 를 target 으로 stroke/shadow.
describe("listbox_item 행 appearance — border / box-shadow (2026-07-21)", () => {
  type BorderLike = {
    type?: string;
    target?: string;
    borderWidth?: number;
    color?: string;
    style?: string;
    offsetX?: number;
    offsetY?: number;
    blur?: number;
    id?: string;
    fill?: string;
  };
  const all = (shapes: Shape[] | null): BorderLike[] =>
    (shapes ?? []) as BorderLike[];
  const borderShape = (shapes: Shape[] | null) =>
    all(shapes).find((s) => s.type === "border");
  const shadowShapes = (shapes: Shape[] | null) =>
    all(shapes).filter((s) => s.type === "shadow");
  const rowBg = (shapes: Shape[] | null) =>
    all(shapes).find((s) => s.id === "row-bg");

  it("style.borderWidth>0 → border shape 가 row-bg 를 target 으로 렌더 (borderStyle 부재 시 solid)", () => {
    const shapes = drawWith(
      { ...flatProps },
      { borderWidth: 1, borderColor: "#E31414" },
    );
    const border = borderShape(shapes);
    expect(border).toBeDefined();
    expect(border?.target).toBe("row-bg");
    expect(border?.borderWidth).toBe(1);
    expect(border?.color).toBe("#E31414");
    expect(border?.style).toBe("solid");
    // 배경 없어도 border target 노드 보장 — row-bg 를 transparent 로 생성
    expect(rowBg(shapes)?.fill).toBe("{color.transparent}");
  });

  it("borderStyle 명시 시 그대로 반영 (dashed)", () => {
    const shapes = drawWith(
      { ...flatProps },
      { borderWidth: 2, borderColor: "#000", borderStyle: "dashed" },
    );
    expect(borderShape(shapes)?.style).toBe("dashed");
  });

  it("borderWidth 0/부재 → border shape 미생성 (BC)", () => {
    expect(borderShape(drawWith({ ...flatProps }))).toBeUndefined();
  });

  it("style.boxShadow → shadow shape 로 분해 (offset/blur, target row-bg)", () => {
    const shapes = drawWith(
      { ...flatProps },
      { boxShadow: "0 2px 4px rgba(0,0,0,0.2)" },
    );
    const shadows = shadowShapes(shapes);
    expect(shadows).toHaveLength(1);
    expect(shadows[0]?.target).toBe("row-bg");
    expect(shadows[0]?.offsetX).toBe(0);
    expect(shadows[0]?.offsetY).toBe(2);
    expect(shadows[0]?.blur).toBe(4);
  });

  it("border + background 동시 → row-bg fill 은 배경색, border 는 별도 stroke", () => {
    const shapes = drawWith(
      { ...flatProps },
      { backgroundColor: "#eee", borderWidth: 1, borderColor: "#f00" },
    );
    expect(rowBg(shapes)?.fill).toBe("#eee");
    expect(borderShape(shapes)?.color).toBe("#f00");
  });
});

// 2026-07-21 (Issue 2) — 행 높이/스택이 label/description slot size 에 반응:
//   과거 lineHeight 계단 매핑(>16 → 28 cap)은 3xl(30) label 을 28 로 눌러 텍스트 겹침.
//   getLabelLineHeight 로 label/description 각자 line box 산출 → y 좌표가 size 비례로 이동.
describe("listbox_item 행 높이 — label/description size 반응 (2026-07-21)", () => {
  const textY = (shapes: Shape[] | null, text: string): number | undefined =>
    (shapes as AnyShape[] | null)?.find(
      (s) => s.type === "text" && s.text === text,
    )?.y;

  it("label 만(3xl=30) → 단일 줄 세로 중앙 y = rowHeight/2 (pad4*2 + lh36 = 44 → 22)", () => {
    // label 30 → getLabelLineHeight(30)=36. description slot 제외.
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label"], { label: { fontSize: 30 } }),
    });
    expect(textY(shapes, "Aardvark")).toBe(22);
  });

  it("label(3xl=30) + description(2xl=24) → 2줄 스택이 각자 line box 로 배치", () => {
    // label lh 36, description lh 32(getLabelLineHeight(24)). pad 4.
    //   label y = 4 + 36/2 = 22, description y = 4 + 36 + gap2 + 32/2 = 58.
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        label: { fontSize: 30 },
        description: { fontSize: 24 },
      }),
    });
    expect(textY(shapes, "Aardvark")).toBe(22);
    expect(textY(shapes, "A large burrowing mammal")).toBe(58);
  });

  it("BC: 표준 사이즈(14) 단일 줄 y=14 유지 (계단 매핑과 동일 값)", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label"]),
    });
    expect(textY(shapes, "Aardvark")).toBe(14);
  });
});
