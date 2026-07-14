/**
 * SliderTrack → SliderThumb 배치 주입 회귀 테스트 (2026-07-14).
 *
 * `applyImplicitStyles(SliderTrack)` 가 SliderThumb 자식에 **selection/hit box** 를
 * value 위치로 배치하는 스타일을 주입함을 확증한다. 이 주입은
 * `position:absolute + left:${percent}% + top + marginLeft` 형태이며, **엔진
 * (composition-engine)이 absolute/inset 을 소비**해야 실제 좌표가 된다
 * (`tree.rs::place_absolute_children` — 그 전까지는 전량 무시되어 thumb box 가
 * 항상 원점(0,0)에 고정됐다).
 *
 * 회귀 시나리오:
 *   (a) value=50 → left:"50%" + marginLeft:-9 (중심이 트랙 중앙)
 *   (b) **value=0 → left:"0%"** — `Number(v) || 50` 의 falsy 함정으로 50% 로 튀던 버그
 *   (c) min/max 정규화 (0~100 이 아닌 범위)
 *   (d) range(2-thumb) → 각 thumb 이 자기 value 위치
 *   (e) size 별 thumbSize (14/18/22/26) + 세로 중앙 정렬(top = trackH/2 - thumbSize/2)
 */

import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

function makeTree(
  sliderProps: Record<string, unknown>,
  thumbCount = 1,
): {
  track: Element;
  thumbs: Element[];
  elementById: Map<string, Element>;
} {
  const thumbs: Element[] = Array.from({ length: thumbCount }, (_, i) => ({
    id: `thumb-${i}`,
    type: "SliderThumb",
    parent_id: "track-1",
    props: {},
  })) as Element[];

  const track = {
    id: "track-1",
    type: "SliderTrack",
    parent_id: "slider-1",
    props: {},
  } as Element;

  const slider = {
    id: "slider-1",
    type: "Slider",
    props: { size: "md", minValue: 0, maxValue: 100, ...sliderProps },
  } as Element;

  const elementById = new Map<string, Element>([
    ["slider-1", slider],
    ["track-1", track],
    ...thumbs.map((t) => [t.id, t] as [string, Element]),
  ]);

  return { track, thumbs, elementById };
}

function thumbStyles(
  sliderProps: Record<string, unknown>,
  thumbCount = 1,
): Record<string, unknown>[] {
  const { track, thumbs, elementById } = makeTree(sliderProps, thumbCount);
  const getChildElements = (id: string): Element[] =>
    id === "track-1" ? thumbs : [];
  const { filteredChildren } = applyImplicitStyles(
    track,
    thumbs,
    getChildElements as never,
    elementById as never,
  );
  return filteredChildren
    .filter((c) => c.type === "SliderThumb")
    .map((c) => (c.props?.style ?? {}) as Record<string, unknown>);
}

describe("SliderTrack implicitStyles — SliderThumb selection/hit box 배치", () => {
  it("value=50 → left:'50%' + marginLeft:-9 (중심이 트랙 중앙)", () => {
    const [s] = thumbStyles({ value: 50 });
    expect(s.position).toBe("absolute");
    expect(s.left).toBe("50%");
    expect(s.width).toBe(18); // md thumbSize
    expect(s.height).toBe(18);
    expect(s.marginLeft).toBe(-9); // -thumbSize/2 → 중심 보정
  });

  // ── 회귀 게이트: value=0 falsy 함정 ────────────────────────────────────────
  it("value=0 → left:'0%' (falsy 라 50% 로 튀면 안 됨)", () => {
    // 버그: `Number(rawValue) || 50` 은 0 이 falsy 라 **50 으로 대체**됐다
    //   → value 0 인 Slider 의 thumb 이 트랙 중앙에 그려짐.
    const [s] = thumbStyles({ value: 0 });
    expect(s.left).toBe("0%");
  });

  it("value=100 → left:'100%'", () => {
    const [s] = thumbStyles({ value: 100 });
    expect(s.left).toBe("100%");
  });

  it("min/max 정규화 — min=50 max=150 value=100 → 50%", () => {
    const [s] = thumbStyles({ value: 100, minValue: 50, maxValue: 150 });
    expect(s.left).toBe("50%");
  });

  it("value 가 범위를 벗어나면 0~100% 로 clamp", () => {
    expect(thumbStyles({ value: -20 })[0].left).toBe("0%");
    expect(thumbStyles({ value: 500 })[0].left).toBe("100%");
  });

  it("range value [20,80] → thumb 2개가 각자 위치", () => {
    const styles = thumbStyles({ value: [20, 80] }, 2);
    expect(styles).toHaveLength(2);
    expect(styles[0].left).toBe("20%");
    expect(styles[1].left).toBe("80%");
  });

  it("size 별 thumbSize + 세로 중앙 정렬 (top = trackHeight/2 - thumbSize/2)", () => {
    // Slider.indicator.thumbSize 14/18/22/26, SliderTrack.height 4/8/12/16.
    const cases: Array<[string, number, number]> = [
      ["sm", 14, 4 / 2 - 14 / 2], // -5
      ["md", 18, 8 / 2 - 18 / 2], // -5
      ["lg", 22, 12 / 2 - 22 / 2], // -5
      ["xl", 26, 16 / 2 - 26 / 2], // -5
    ];
    for (const [size, thumbSize, expectedTop] of cases) {
      const [s] = thumbStyles({ value: 50, size });
      expect(s.width, `${size} thumbSize`).toBe(thumbSize);
      expect(s.height, `${size} thumbSize`).toBe(thumbSize);
      expect(s.top, `${size} 세로 중앙`).toBe(expectedTop);
      expect(s.marginLeft, `${size} 중심 보정`).toBe(-(thumbSize / 2));
    }
  });
});
