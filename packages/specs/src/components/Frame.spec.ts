/**
 * Frame Component Spec — ADR-130 Phase 1
 *
 * canonical `frame` = layout container (pencil structural lowercase).
 * RAC `Group` (D1/ARIA semantic) 과 분리된 D3 layout primitive.
 *
 * - skipCSSGeneration: true (수동 CSS 없음, layout container dedicated)
 * - ARIA role 없음 (RAC Group 의 role="group" 비대응)
 * - render.shapes(): 배경이 있으면 bg box, 자식이 없으면 최소 container shape
 *
 * ## 배경 fill (ADR-198, 2026-08-31)
 *
 * frame 은 catalog 미등록 native 3종 중 하나라 이 spec 의 `render.shapes()` 가
 * **Skia 가 무엇을 그릴지 정하는 유일한 자리**다. 그런데 이 함수가 `props.style`
 * 을 한 번도 읽지 않아, 사용자가 프레임에 칠한 배경색이 Skia 픽셀에 도달하지
 * 못했다 — Preview(DOM) 는 `props.style` 을 인라인 style 로 직결해 칠하므로 두
 * consumer 가 같은 입력에서 다른 그림을 냈다 (D3 대칭 위반).
 *
 * 실측 (2026-08-31, 실제 빌더 compare 모드): frame 하나에 `#00FF00FF` fill 을
 * 넣으면 CSS 열은 초록으로 칠하고 Canvas 열은 아무것도 그리지 않았다. 하니스
 * 쪽 실측도 같다 — fill 을 완전 녹색으로 바꿔도 전 region `maxByte 0`.
 *
 * 색은 `props.style.backgroundColor` 로 들어온다. canonical 1차 필드 `fills[]`
 * 는 `buildSpecNodeData` 가 hex6 + `_fillBgAlpha` 로 분해해 같은 자리에 실어
 * 주므로 (fills / style 어느 쪽으로 authoring 하든 이 한 채널로 모인다), 여기서는
 * 그 채널만 읽는다. 합성 alpha 는 `applyPresentationFillAlpha` 가
 * `presentationRole: "background-fill"` 을 보고 곱하므로 여기서 곱하지 않는다.
 *
 * @see docs/adr/130-layer3-canonical-vocabulary-alignment.md
 * @see docs/adr/198-d3-renderer-pixel-parity-gate.md
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";

export interface FrameProps {
  clip?: boolean;
  placeholder?: boolean;
  style?: Record<string, string | number | undefined>;
}

/** `8` / `"8"` / `"8px"` 를 숫자로. 그 외(토큰·`%`·다중 값)는 0 — 반올림 없는 사각 배경. */
function toRadius(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const match = /^(-?\d*\.?\d+)(px)?$/.exec(value.trim());
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 칠할 배경이 실제로 있는가 — 빈 문자열·`transparent`·`none` 은 없는 것으로 본다. */
function hasPaintableBackground(value: string | number | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "transparent" &&
    normalized !== "none"
  );
}

/** 숫자 또는 `"2px"` → 숫자. 그 외 표기는 0. */
function toPx(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const match = /^(-?\d*\.?\d+)(px)?$/.exec(value.trim());
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 테두리를 그릴 값이 실제로 있는가.
 *
 * CSS 처럼 longhand(`borderTopWidth`)와 shorthand(`borderWidth`)를 둘 다 읽는다 —
 * 패널이 어느 쪽으로 쓰는지에 따라 한쪽만 읽으면 조용히 안 그려진다.
 *
 * **한계 (의도적)**: `BorderShape` 는 변별 두께/색을 한 쌍만 담으므로, 변마다
 * 두께가 다른 테두리는 그 중 첫 값으로 그리고 `sides` 로 유무만 구분한다. 변별
 * 두께가 필요해지면 shape 스키마부터 바꿔야 한다 — 여기서 근사로 덮지 않는다.
 */
function resolveBorder(
  style: Record<string, string | number | undefined>,
): { width: number; color: string; style: string; sides: Record<string, boolean> } | null {
  const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

  const widths = SIDES.map(
    (s) => toPx(style[`border${s}Width`]) || toPx(style.borderWidth),
  );
  const styles = SIDES.map((s) =>
    String(style[`border${s}Style`] ?? style.borderStyle ?? "solid"),
  );
  const colors = SIDES.map((s) =>
    String(style[`border${s}Color`] ?? style.borderColor ?? ""),
  );

  const visible = SIDES.map(
    (_, i) =>
      widths[i] > 0 &&
      styles[i] !== "none" &&
      styles[i] !== "hidden" &&
      colors[i].length > 0 &&
      colors[i] !== "transparent",
  );
  const firstVisible = visible.indexOf(true);
  if (firstVisible === -1) return null;

  return {
    width: widths[firstVisible],
    color: colors[firstVisible],
    style: styles[firstVisible],
    sides: {
      top: visible[0],
      right: visible[1],
      bottom: visible[2],
      left: visible[3],
    },
  };
}

export const FrameSpec: ComponentSpec<FrameProps> = {
  name: "frame",
  description: "Canonical layout container (ADR-130, pencil structural).",
  element: "div",
  skipCSSGeneration: true,

  defaultSize: "md",

  sizes: {
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {},

  render: {
    shapes: (props) => {
      const style = (props.style ?? {}) as Record<
        string,
        string | number | undefined
      >;
      const shapes: Shape[] = [];
      const radius = toRadius(style.borderRadius);
      const background = hasPaintableBackground(style.backgroundColor);
      const border = resolveBorder(style);

      // 배경은 자식 유무와 무관하다 — 자식이 있다고 배경이 사라지지는 않는다.
      // x/y 0 + width/height "auto" 라 specShapesToSkia 가 이 shape 을 자식 노드가
      // 아니라 컴포넌트 배경 box 로 추출한다 (canonical 자식 렌더와 겹치지 않음).
      //
      // 테두리만 있고 배경이 없어도 이 box 를 낸다 — `border` shape 이 붙을
      // 대상이 필요하고, 투명 채움은 그리는 게 없으므로 안전하다.
      if (background || border) {
        shapes.push({
          type: "roundRect" as const,
          id: "bg",
          presentationRole: "background-fill" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          radius,
          fill: background ? (style.backgroundColor as string) : "transparent",
        });
      }

      // 배경과 같은 결함이었다 (ADR-198, 2026-08-31): 이 함수가 style 을 안 읽어서
      // 프레임에 선언된 테두리가 Skia 픽셀에 도달하지 못했다. 실측 — 파일럿
      // fixture 의 2px 테두리를 Preview 는 `#102A5C` 로 그리고 Skia 는 그 자리에
      // 채움색을 놔뒀다 (경계 선을 따라 maxByte 145).
      if (border) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth: border.width,
          color: border.color,
          style: border.style as never,
          radius,
          sides: border.sides,
        });
      }

      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      shapes.push({
        type: "container" as const,
        x: 0,
        y: 0,
        width: "auto",
        height: "auto",
        children: [],
        layout: {
          display: "flex",
          flexDirection: "column",
          gap: 0,
        },
      });

      return shapes;
    },

    react: () => ({}),
  },
};
