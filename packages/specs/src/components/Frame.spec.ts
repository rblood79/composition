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

      // 배경은 자식 유무와 무관하다 — 자식이 있다고 배경이 사라지지는 않는다.
      // x/y 0 + width/height "auto" 라 specShapesToSkia 가 이 shape 을 자식 노드가
      // 아니라 컴포넌트 배경 box 로 추출한다 (canonical 자식 렌더와 겹치지 않음).
      if (hasPaintableBackground(style.backgroundColor)) {
        shapes.push({
          type: "roundRect" as const,
          id: "bg",
          presentationRole: "background-fill" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          radius: toRadius(style.borderRadius),
          fill: style.backgroundColor as string,
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
