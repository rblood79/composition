import { describe, expect, it } from "vitest";

import { getSkiaPrimitive, getSkiaPrimitiveMode } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * Slider value-fill + thumb — `slider_fill_bar` / `slider_thumb` escape 회귀 게이트.
 *
 * **렌더 소유권 (2026-07-14 복귀 — 본 파일의 핵심 계약)**:
 *   - `slider_fill_bar`(SliderTrack, replace) = track 배경 + value 채움 막대 + **thumb 핸들**.
 *   - `slider_thumb`(SliderThumb, replace) = **shapes 0** (selection/hit box 전용).
 *
 * **왜 되돌렸나 (버그)**: 2026-06-10~07-13 동안 thumb 렌더를 SliderThumb element 가 맡았다.
 *   그 전제는 "SliderThumb box 가 implicitStyles 의 `position:absolute + left:%` 로 value 위치에
 *   배치된다" 였는데, composition-engine(Rust)은 absolute/inset 을 **레이아웃에 반영하지 않는다**
 *   (`Style.inset_*` 는 tree.rs 에 선언·역직렬화만 되고 flex/block/grid 어느 알고리즘도 읽지
 *   않으며 `Position::Absolute` 개념 부재). 결과: thumb box 가 항상 컨테이너 원점(0,0)에 고정 →
 *   **x 가 value 를 따라가지 않고(항상 트랙 좌측 끝), y 도 트랙 세로 중앙이 아님**. CSS(RAC
 *   useSliderThumb: `left:${p}% + translate(-50%,-50%)`, `.react-aria-SliderThumb{top:50%}`)와
 *   정면 발산했다. `_containerWidth`(트랙 실폭)를 아는 slider_fill_bar 로 렌더를 되돌려 해소.
 *
 * 실측 (md/350px/value=50): DOM thumb 중심 = (175, 4) — 본 escape 도 동일해야 한다.
 */

// SliderTrack rule.sizes.md 미러 (trackHeight 8 / thumbSize 18).
const trackSizeMd: SizeSpec = {
  height: 8,
  thumbSize: 18,
  paddingX: 0,
  paddingY: 0,
  fontSize: "{typography.text-sm}" as never,
  borderRadius: "{radius.none}" as never,
};

// SliderTrack rule.variants.default 미러 (track base neutral-subtle / fillBar accent).
const trackVisual: ComponentVisualRule = {
  fill: {
    default: {
      base: "{color.neutral-subtle}" as never,
      hover: "{color.neutral-subtle}" as never,
      pressed: "{color.neutral-subtle}" as never,
    },
  },
  fillBar: "{color.accent}" as never,
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const thumbVisual: ComponentVisualRule = {
  fill: { default: { base: "{color.accent}" as never } },
  text: "{color.neutral}" as never,
} as ComponentVisualRule;

const drawFill = getSkiaPrimitive("slider_fill_bar")!;
const drawThumb = getSkiaPrimitive("slider_thumb")!;

function byId(shapes: Shape[], id: string): Shape | undefined {
  return shapes.find((s) => (s as { id?: string }).id === id);
}
function circles(shapes: Shape[]): Shape[] {
  return shapes.filter((s) => s.type === "circle");
}

describe("skiaPrimitive 'slider_fill_bar' — SliderTrack value-fill + thumb", () => {
  it("registry 에 replace 모드로 등록 (track box 자체 생성, buildCatalogShapes box 대체)", () => {
    expect(drawFill).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_fill_bar")).toBe("replace");
  });

  it("track 배경 = neutral-subtle, fill = accent (rule fillBar)", () => {
    const shapes = drawFill({
      props: { value: 50, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "track") as { fill?: string }).fill).toBe(
      "{color.neutral-subtle}",
    );
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.accent}",
    );
  });

  it("track = box 전체 (trackY=0, height=trackHeight) — thumb 은 box 밖으로 넘침", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "track") as { y?: number }).y).toBe(0);
    expect((byId(shapes, "fill") as { y?: number }).y).toBe(0);
    expect((byId(shapes, "track") as { height?: number }).height).toBe(8);
  });

  // ── 버그 회귀 게이트: thumb x 가 value 를 추종 ──────────────────────────────
  it("thumb x = width * percent — value 를 추종 (엔진 absolute 미지원 우회)", () => {
    const centerXFor = (value: number) => {
      const shapes = drawFill({
        props: { value, minValue: 0, maxValue: 100, _containerWidth: 350 },
        size: trackSizeMd,
        visual: trackVisual,
        style: undefined,
      })!;
      return (byId(shapes, "thumb-0") as { x?: number }).x;
    };
    // 트랙 350px 기준 — DOM(RAC left:${p}% + translate(-50%)) 과 동일 좌표.
    expect(centerXFor(0)).toBe(0);
    expect(centerXFor(25)).toBe(87.5);
    expect(centerXFor(50)).toBe(175); // 실측 DOM 값
    expect(centerXFor(75)).toBe(262.5);
    expect(centerXFor(100)).toBe(350);
  });

  it("thumb y = trackHeight/2 (트랙 세로 중앙) — CSS `top:50%` 정합", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 350 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    // 실측 DOM: thumb 중심 y = 4 (= trackHeight 8 / 2).
    expect((byId(shapes, "thumb-0") as { y?: number }).y).toBe(4);
  });

  it("thumb 반지름 = size.thumbSize/2 (14/18/22/26 → 7/9/11/13)", () => {
    const radiusFor = (thumbSize: number) => {
      const shapes = drawFill({
        props: { value: 50, _containerWidth: 200 },
        size: { ...trackSizeMd, thumbSize },
        visual: trackVisual,
        style: undefined,
      })!;
      return (byId(shapes, "thumb-0") as { radius?: number }).radius;
    };
    expect(radiusFor(14)).toBe(7); // sm
    expect(radiusFor(18)).toBe(9); // md
    expect(radiusFor(22)).toBe(11); // lg
    expect(radiusFor(26)).toBe(13); // xl
  });

  it("thumb border 2px {color.base} (CSS `.react-aria-SliderThumb{border:2px solid var(--bg)}`)", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    const border = shapes.find(
      (s) =>
        s.type === "border" && (s as { target?: string }).target === "thumb-0",
    ) as { borderWidth?: number; color?: string; radius?: number };
    expect(border).toBeDefined();
    expect(border.borderWidth).toBe(2);
    expect(border.color).toBe("{color.base}");
    expect(border.radius).toBe(9);
  });

  it("thumb 색 = fill(accent) 과 동색 — style.color override 도 함께 따라감", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: { color: "{color.positive}" },
    })!;
    expect((byId(shapes, "fill") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
    expect((byId(shapes, "thumb-0") as { fill?: string }).fill).toBe(
      "{color.positive}",
    );
  });

  it("range value [20,80] — fill 구간 + thumb 2개 (양 끝)", () => {
    const shapes = drawFill({
      props: {
        value: [20, 80],
        minValue: 0,
        maxValue: 100,
        _containerWidth: 200,
      },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    const fill = byId(shapes, "fill") as { x?: number; width?: number };
    expect(fill.x).toBe(40);
    expect(fill.width).toBe(120);
    // thumb 2개 — 각 value 위치.
    expect(circles(shapes)).toHaveLength(2);
    expect((byId(shapes, "thumb-0") as { x?: number }).x).toBe(40); // 200*20%
    expect((byId(shapes, "thumb-1") as { x?: number }).x).toBe(160); // 200*80%
  });

  it("min/max 정규화 — minValue 50 maxValue 150 value 100 → 50% (fill + thumb)", () => {
    const shapes = drawFill({
      props: { value: 100, minValue: 50, maxValue: 150, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "fill") as { width?: number }).width).toBe(100);
    // thumb 도 같은 정규화를 따른다 (value 를 raw 로 쓰면 안 됨).
    expect((byId(shapes, "thumb-0") as { x?: number }).x).toBe(100);
  });

  it("value=0 → fill 미생성 (width 0) 이지만 thumb 은 좌측 끝에 존재", () => {
    const shapes = drawFill({
      props: { value: 0, minValue: 0, maxValue: 100, _containerWidth: 200 },
      size: trackSizeMd,
      visual: trackVisual,
      style: undefined,
    })!;
    expect(byId(shapes, "fill")).toBeUndefined();
    expect((byId(shapes, "thumb-0") as { x?: number }).x).toBe(0);
  });

  it("size.thumbSize 누락 시 18 fallback (md)", () => {
    const shapes = drawFill({
      props: { value: 50, _containerWidth: 200 },
      size: { ...trackSizeMd, thumbSize: undefined as unknown as number },
      visual: trackVisual,
      style: undefined,
    })!;
    expect((byId(shapes, "thumb-0") as { radius?: number }).radius).toBe(9);
  });
});

describe("skiaPrimitive 'slider_thumb' — SliderThumb (selection/hit box 전용)", () => {
  it("registry 에 replace 모드로 등록", () => {
    expect(drawThumb).toBeDefined();
    expect(getSkiaPrimitiveMode("slider_thumb")).toBe("replace");
  });

  it("shapes 0 — 그리기는 slider_fill_bar 소관 (이중 렌더 차단)", () => {
    // **회귀 게이트**: 여기서 circle 을 그리면 엔진이 absolute 를 무시하는 탓에
    //   thumb 이 트랙 좌측 끝(0,0)에 중복으로 찍힌다 (2026-06-10~07-13 버그).
    const shapes = drawThumb({
      props: {},
      size: { height: 18 } as SizeSpec,
      visual: thumbVisual,
      style: undefined,
    })!;
    expect(shapes).toHaveLength(0);
  });
});
