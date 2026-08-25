import { describe, expect, it } from "vitest";

import { getSkiaPrimitive } from "./catalogPaintFixture";
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
    // 단일 줄 → rowHeight/2 세로 중앙. label 은 react-aria-Text 기본 16 (item fontSize 미상속 —
    //   라이브 실측 2026-07-22) → getTextLineHeight(16)=24 → rowHeight pad4*2+24=32 → y 16.
    expect(texts[0]?.y).toBe(16);
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

// 2026-07-22 — 행 높이/스택이 label/description slot size 에 반응 + origin/CSS/DOM line box 일치:
//   label line box = getTextLineHeight(1.5×fs) (react-aria-Text 기본, slot CSS override 없음).
//   description line box = getDescriptionLineHeight(1.333×fs) (CSS [slot=desc] line-height 토큰 —
//   label 1.5× 와 별도 비율). 미지정 label 은 react-aria-Text 기본 16 (item fontSize 미상속).
//   라이브 실측(preview iframe DOM 주입): label 16→24/30→45, desc 12→16/24→32.
describe("listbox_item 행 높이 — label/description size 반응 (2026-07-22)", () => {
  const textY = (shapes: Shape[] | null, text: string): number | undefined =>
    (shapes as AnyShape[] | null)?.find(
      (s) => s.type === "text" && s.text === text,
    )?.y;

  it("label 만(3xl=30) → 단일 줄 세로 중앙 y = rowHeight/2 (pad4*2 + lh45 = 53 → 26.5)", () => {
    // label 30 → getTextLineHeight(30)=45(=1.5×30, origin/CSS 동일). description slot 제외.
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label"], { label: { fontSize: 30 } }),
    });
    expect(textY(shapes, "Aardvark")).toBe(26.5);
  });

  it("label(3xl=30) + description(2xl=24) → 2줄 스택이 각자 line box 로 배치", () => {
    // label lh 45(1.5×30, react-aria-Text). description lh 32(1.333×24, CSS [slot=desc] 토큰
    //   — label 1.5× 와 별도 비율, 라이브 실측 2026-07-22). pad 4.
    //   label y = 4 + 45/2 = 26.5, description y = 4 + 45 + gap2 + 32/2 = 67 (과거 desc 1.5×→69).
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        label: { fontSize: 30 },
        description: { fontSize: 24 },
      }),
    });
    expect(textY(shapes, "Aardvark")).toBe(26.5);
    expect(textY(shapes, "A large burrowing mammal")).toBe(67);
  });

  it("BC: 미지정 label → react-aria-Text 기본 16 단일 줄 y=16 (item fontSize 미상속)", () => {
    // label slot size 미지정 → react-aria-Text 기본 16 (item fontSize 14 미상속, 라이브 실측
    //   2026-07-22) → getTextLineHeight(16)=24 → rowHeight pad4*2+24=32 → y 16 (과거 label 14→14.5).
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label"]),
    });
    expect(textY(shapes, "Aardvark")).toBe(16);
  });
});

// 2026-07-21 (Issue 1) — slot 자식 배경(fills → backgroundColor fold)이 행 label/description
//   뒤 밴드로 렌더. origin 은 실 자식이 fills→box 배경을 그리지만 projection 행은 escape 가
//   flat 렌더하므로 slot backgroundColor 를 escape 가 재현해야 한다.
describe("listbox_item slot 배경 밴드 — label/description backgroundColor (2026-07-21)", () => {
  type BgShape = {
    type?: string;
    id?: string;
    fill?: string;
    x?: number;
    width?: number;
    height?: number;
    y?: number;
  };
  const bandOf = (shapes: Shape[] | null, id: string): BgShape | undefined =>
    (shapes as BgShape[] | null)?.find(
      (s) => s.type === "roundRect" && s.id === id,
    );

  it("label slot backgroundColor → label-bg roundRect 가 텍스트 뒤(먼저) 렌더", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        label: { backgroundColor: "#2CAB3F" },
      }),
    });
    const band = bandOf(shapes, "label-bg");
    expect(band).toBeDefined();
    expect(band?.fill).toBe("#2CAB3F");
    // 텍스트 x 와 동일 위치에서 시작 (label cell)
    expect(band?.x).toBe(12);
    // band 는 대응 label 텍스트보다 shapes 배열에서 먼저 (뒤에 깔림)
    const arr = shapes as BgShape[];
    const bandIdx = arr.findIndex((s) => s.id === "label-bg");
    const labelTextIdx = arr.findIndex(
      (s) => (s as { text?: string }).text === "Aardvark",
    );
    expect(bandIdx).toBeLessThan(labelTextIdx);
  });

  it("description slot backgroundColor → description-bg roundRect 렌더", () => {
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        description: { backgroundColor: "#00aa00" },
      }),
    });
    expect(bandOf(shapes, "description-bg")?.fill).toBe("#00aa00");
  });

  it("backgroundColor 부재/transparent → 배경 밴드 미생성 (BC)", () => {
    expect(
      bandOf(
        drawWith({ ...flatProps, _slots: composition(["label"]) }),
        "label-bg",
      ),
    ).toBeUndefined();
    expect(
      bandOf(
        drawWith({
          ...flatProps,
          _slots: composition(["label"], {
            label: { backgroundColor: "transparent" },
          }),
        }),
        "label-bg",
      ),
    ).toBeUndefined();
  });
});

// ─── wrap 블록 스택 offset (2026-07-22 사용자 보고: 긴 label 이 description 과 겹침) ───
//
// converter(specShapeConverter)는 baseline:"middle" + y>0 을 "paragraph top = y − 단일줄
// lineHeight/2" 로 해석하고 wrap 은 아래로 흐른다. escape 가 두 번째 entry offset 을 단일 줄
// lineHeight 로 잡으면 label 이 3줄로 wrap 될 때 description 이 label 블록 위에 겹쳐 그려진다.
// 주입 측정기(builder = paint 동일 CanvasKit 엔진)의 블록 높이를 offset 에 소비하는지 검증.
// 미주입(null) 시 단일 줄 fallback = 기존 동작(BC).
import {
  setSpecWrappedTextHeightMeasurer,
  measureSpecWrappedTextHeight,
} from "../utils/measureText";
import { afterEach } from "vitest";

describe("listbox_item — wrap 블록 높이 기반 스택 offset", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  // 기본 metric: labelFontSize 16 → lineHeight 24, descriptionFontSize 12 → lineHeight 16,
  //   paddingTop 4, rowGap(gap) 2.
  const LABEL_LH = 24;
  const DESC_LH = 16;

  it("미주입(fallback) — description y = paddingTop + label 1줄 + gap + desc/2 (BC)", () => {
    const shapes = textShapes(drawWith(flatProps));
    expect(shapes[1]?.y).toBe(4 + LABEL_LH + 2 + DESC_LH / 2); // 38
  });

  it("주입 측정기가 label 3줄(72) 반환 → description y 가 블록 높이 뒤로 이동", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lineHeight) =>
      text === flatProps.children ? 72 : (lineHeight ?? 16),
    );
    const shapes = textShapes(drawWith(flatProps));
    // label paragraph top 은 여전히 paddingTop (y = paddingTop + 단일줄/2)
    expect(shapes[0]?.y).toBe(4 + LABEL_LH / 2); // 16
    // description top = paddingTop + labelBlock(72) + gap → y = top + desc 단일줄/2
    expect(shapes[1]?.y).toBe(4 + 72 + 2 + DESC_LH / 2); // 86
  });

  it("style.height 부재 시 행 높이(fallback)가 블록 합산으로 성장", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lineHeight) =>
      text === flatProps.children ? 72 : (lineHeight ?? 16),
    );
    const shapes = drawWith({ ...flatProps, isSelected: true });
    // check 아이콘 y = rowHeight/2 — rowHeight = pad 8 + 72 + 2 + 16 = 98
    const check = ((shapes ?? []) as AnyShape[]).find(
      (s) => s.type === "icon_font" && s.iconName === "check",
    );
    expect(check?.y).toBe(98 / 2);
  });

  it("단일 entry(label-only) wrap 블록은 행 내 세로 중앙 배치", () => {
    setSpecWrappedTextHeightMeasurer(() => 72);
    const shapes = textShapes(
      drawWith(
        { children: "Long wrapped label", _slots: composition(["label"]) },
        { height: 100 },
      ),
    );
    // paragraph top = (100 − 72) / 2 = 14 → y = 14 + 24/2 = 26
    expect(shapes[0]?.y).toBe(26);
  });

  it("slot 배경 밴드 높이 = wrap 블록 높이 (단일 줄 아님)", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lineHeight) =>
      text === flatProps.children ? 72 : (lineHeight ?? 16),
    );
    const shapes = drawWith({
      ...flatProps,
      _slots: composition(["label", "description"], {
        label: { backgroundColor: "#ff0000" },
      }),
    });
    const band = (
      (shapes ?? []) as Array<{ id?: string; height?: number }>
    ).find((s) => s.id === "label-bg");
    expect(band?.height).toBe(72);
  });

  it("text shape 가 lineHeight(px) 를 명시 — converter strut 정합 (desc 1.333×)", () => {
    const shapes = textShapes(drawWith(flatProps)) as Array<{
      lineHeight?: number;
    }>;
    expect(shapes[0]?.lineHeight).toBe(LABEL_LH);
    expect(shapes[1]?.lineHeight).toBe(DESC_LH);
  });

  it("measureSpecWrappedTextHeight — 미주입/빈 텍스트/무효 폭 → null", () => {
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 100)).toBeNull();
    setSpecWrappedTextHeightMeasurer(() => 48);
    expect(measureSpecWrappedTextHeight("", 16, 600, "Inter", 100)).toBeNull();
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 0)).toBeNull();
    expect(measureSpecWrappedTextHeight("x", 16, 600, "Inter", 100)).toBe(48);
  });
});
