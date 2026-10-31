/**
 * ProgressCircle Component — 원형 진행률 (SVG circle track + value 비례 indicator).
 *
 * **ADR-912 진로 1번 ProgressCircle proof slice (value-fill internal leaf catalog 발효, 2026-06-06)**:
 *   ProgressCircle 은 catalog 미등록 상태에서 spec.render.shapes(ProgressCircle.spec.ts:125-235)가 Skia
 *   시각 source 였고, DOM 은 rendererMap.renderProgressCircle(LayoutRenderers.tsx:1717) inline 함수가
 *   SVG `<circle stroke-dasharray>` 로 담당했다. factory `children: []`(leaf, 자식 Element 아님) +
 *   value/size/isIndeterminate 는 props → catalog cutover DOM 경로가 INTERNAL_RENDERERS["progresscircle"]
 *   를 React 컴포넌트로 렌더(Avatar 선례 동형).
 *
 *   **track 색 = rule(DOM/Skia 대칭)**: track stroke 를 resolveComponentRule("ProgressCircle").
 *   variants.default.fill.default.base(TokenRef) → colorTokenToCss 로 변환해 적용. indicator stroke 는
 *   {color.accent}(rule 에 indicator 필드 없음 — spec PROGRESSCIRCLE_FILL_COLORS.default 및 Skia escape
 *   value_fill_arc 의 `visual.fillBar ?? {color.accent}` 와 동일 source). Skia escape(value_fill_arc)도
 *   같은 두 색을 읽으므로 시각 대칭. (legacy renderProgressCircle 의 var(--bg-muted)/var(--accent)
 *   하드코딩과 동일 값: {color.neutral-subtle}=var(--bg-muted), {color.accent}=var(--accent) — drift 0)
 *
 *   **dims = rule (DOM/Skia 대칭)**: 지름 = rule `sizes.height` (S2 S 16 · M 32 · L 64, `scaled` — 터치 × 1.25),
 *   선 굵기 = rule `sizes.indicator.strokeWidth` (S2 S 2 · M 3 · L 4, 터치 불변). value 비례 호: DOM 은 S2 처럼
 *   `pathLength` 100 의 dashoffset, Skia 는 arc sweepAngle — 같은 value 비율.
 *
 * D1: composition `<div role="progressbar">` (SVG circle track + indicator, internal source, 어댑터).
 * D2: value(0-100) + size(sm/md/lg) + isIndeterminate + isDisabled.
 * D3: track 색 = rule fill base / indicator 색 = {color.accent}(theme). Skia escape ↔ DOM SVG 대칭.
 */

import React from "react";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../catalog/resolvers/colorTokenToCss";
import { ruleLengthCss, ruleSizeLengthRef } from "@composition/rendering";

export interface ProgressCircleProps {
  /** 진행률 (minValue~maxValue 구간, 기본 0-100) */
  value?: number;
  /** 최소값 (기본 0) — ProgressBar 형제 대칭 (2026-08-21) */
  minValue?: number;
  /** 최대값 (기본 100) */
  maxValue?: number;
  /** 크기 */
  size?: "S" | "M" | "L";
  /** 불결정 모드 (75% 정적 호 + CSS 회전 애니메이션) */
  isIndeterminate?: boolean;
  /** 비활성 */
  isDisabled?: boolean;
  /**
   * RSP S2 "over background" — 유색/이미지 배경 위 고정 흑백 스킴 (§2-F, 2026-08-21).
   * S2 1.8.0: track = static 색 0.17 / indicator = 0.94 (Skia value_fill_arc 같은 상수).
   */
  staticColor?: "auto" | "white" | "black";
  /** 인라인 style override (cutover 경로의 toReactStyle 결과) */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
  /**
   * 접근 가능한 이름. `role="progressbar"` 는 이름이 필수인데 이 컴포넌트에는 보이는 label 이
   * 없어서(RSP ProgressCircle 과 같은 형태) 호출부가 줘야 한다. 예전에는 타입에 없어 넘기면
   * TS 오류였고 — 런타임은 `...rest` 로 통과시키고 있었다 — 그래서 이름 없는 progressbar 가
   * 나갔다 (ADR-205 후속, 2026-09-05). 축은 D1(ARIA) 이고 이 컴포넌트는 RAC 가 아닌
   * composition 자체 어댑터라 DOM 소유가 여기 있다.
   */
  "aria-label"?: string;
  /** 접근 가능한 이름을 다른 요소에서 참조할 때 (`aria-label` 과 택일). */
  "aria-labelledby"?: string;
  /**
   * S2 Button `isPending` 의 원 (`buttonPending.ts`): 지름 · 선 굵기를 버튼 size 가 정하고, 색은
   * 버튼의 글자색 (`currentColor`) 이다 — size 표 대신 이 값을 쓴다. Canvas 는 같은 두 호를
   * `ruleShapes` 가 그린다.
   */
  diameter?: number;
  strokeWidth?: number;
  /** indicator 색 (기본 `{color.accent}`). */
  indicatorColor?: string;
  /** track 색 (기본 rule fill base). */
  trackColor?: string;
  /**
   * cutover 경로(toRacProps propPassthrough)가 함께 emit 하는 `data-*` 속성(예: data-size).
   * root `<div>` 에 passthrough 하여 CSS/debug marker 보존. 지름 계산엔 props.size 사용.
   */
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}

// size → 지름 px (rule sizes.height 정합 — S2 `ProgressCircle.tsx` S 16 · M 32 · L 64, ADR-295 Phase 3c-3c).
const DIAMETER: Record<string, number> = {
  S: 16,
  M: 32,
  L: 64,
};
// 선 굵기 = rule `indicator.strokeWidth` (S2 S 2 · M 3 · L 4) — Skia value_fill_arc 와 같은 칸. 이 값은 rule 이 없을 때만.
const STROKE_WIDTH = 3;

/**
 * ProgressCircle — SVG circle track + value 비례 indicator.
 *
 * cutover DOM 경로(renderCatalogDom)가 marker props/style 을 주입하므로, 본 컴포넌트는
 * value/size/isIndeterminate/isDisabled + style/className 만 소비한다. track 색은 theme rule,
 * indicator 색은 {color.accent}(Skia escape value_fill_arc 와 동일 source).
 */
export function ProgressCircle({
  value = 0,
  minValue = 0,
  maxValue = 100,
  size = "M",
  isIndeterminate,
  isDisabled,
  staticColor,
  style,
  className,
  diameter: diameterProp,
  strokeWidth: strokeWidthProp,
  indicatorColor: indicatorColorProp,
  trackColor: trackColorProp,
  ...rest
}: ProgressCircleProps): React.ReactElement {
  const sizeKey = String(size).toUpperCase();
  const diameter = diameterProp ?? DIAMETER[sizeKey] ?? DIAMETER.M;
  // 상자 = rule 지름 (`scaled` — S2 `size()`, 터치 × 1.25) 의 기기 식. 원은 S2 처럼 상자 비율로 그린다 —
  //   중심 50% · 반지름 `calc(50% - 굵기/2)` · `pathLength` 100 — 선 굵기는 px 그대로 (S2 `pxToRem`, 터치 불변).
  const block = resolveComponentRule("ProgressCircle")?.sizes?.[sizeKey];
  const diameterRef =
    diameterProp === undefined && block
      ? ruleSizeLengthRef(block, "height")
      : undefined;
  const box = (diameterRef && ruleLengthCss(diameterRef)) ?? diameter;
  const strokeWidth =
    strokeWidthProp ?? block?.indicator?.strokeWidth ?? STROKE_WIDTH;
  const radius = `calc(50% - ${strokeWidth / 2}px)`;
  // (value-min)/(max-min) 정규화 — 구 0-100 하드코딩 해소 (§1-3, 2026-08-21).
  //   Skia escape(value_fill_arc)와 동일 공식. span<=0 방어는 0 비율.
  const min = Number(minValue) || 0;
  const max = Number(maxValue) || 0;
  const span = max - min;
  const clamped = Math.max(min, Math.min(max, Number(value) || 0));
  const fraction = span > 0 ? (clamped - min) / span : 0;

  // track 색 = rule fill base, indicator 색 = {color.accent}. Skia escape(value_fill_arc) 와 동일 source.
  // staticColor(white/black) 시 over-background 스킴 — S2 1.8.0 `ProgressCircle` (2026-10-10):
  //   track = static 색 0.17 (`transparent-overlay-300`) / indicator = 0.94 (`-900`). Skia
  //   value_fill_arc 동일 상수 (고정 흑백은 catalog 토큰 표현 불가라 리터럴).
  const rule = resolveComponentRule("ProgressCircle");
  const variant = rule?.variants?.default;
  const isStatic = staticColor === "white" || staticColor === "black";
  const staticRgb = staticColor === "white" ? "255 255 255" : "0 0 0";
  const trackColor =
    trackColorProp ??
    (isStatic
      ? `rgb(${staticRgb} / 0.17)`
      : colorTokenToCss(variant?.fill?.default?.base, "var(--bg-muted)"));
  const indicatorColor =
    indicatorColorProp ??
    (isStatic
      ? `rgb(${staticRgb} / 0.94)`
      : colorTokenToCss("{color.accent}", "var(--accent)"));

  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      style={{
        width: box,
        height: box,
        flexShrink: 0,
        ...(isDisabled ? { opacity: 0.38, pointerEvents: "none" } : {}),
        ...style,
      }}
      className={className}
    >
      <svg width="100%" height="100%" fill="none" style={{ display: "block" }}>
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {(isIndeterminate || fraction > 0) && (
          // S2 `fill`: 길이 100 으로 정규화한 호를 -90° 돌린다. 불결정은 270° 정적 호 (Skia `value_fill_arc` — 시트가 돌릴 수 있다).
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            stroke={indicatorColor}
            strokeWidth={strokeWidth}
            pathLength={100}
            strokeDasharray="100 200"
            strokeDashoffset={isIndeterminate ? 25 : 100 - fraction * 100}
            strokeLinecap="round"
            style={{ rotate: "-90deg", transformOrigin: "center" }}
            {...(isIndeterminate ? { "data-indeterminate-arc": "" } : {})}
          />
        )}
      </svg>
    </div>
  );
}
