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
 *   **dims = size→지름 맵(rule height 대응) + strokeWidth 3 uniform(rule base 정합)**: 지름 sm=24/
 *   md=32/lg=64(rule sizes.height). **strokeWidth 는 3 uniform** — Skia escape(value_fill_arc)가
 *   `size.strokeWidth` 를 읽는데 ComponentRuleSize 타입에 strokeWidth 필드가 없어(rule base 미보유)
 *   primitive 기본값 3 으로 해소된다. DOM 도 같은 base(3)를 써야 대칭. (spec PROGRESSCIRCLE_DIMENSIONS
 *   의 lg=4 는 rule 로 이전 안 된 spec-era 잔재 — rule SSOT 가 base 권위이므로 3 uniform 이 정본.
 *   lg sw 차등이 필요하면 ComponentRuleSize 에 strokeWidth 필드 추가 = 스키마 변경, 전 컴포넌트 영향
 *   → width-base 와 동일 별도 slice). value 비례 호: DOM stroke-dashoffset, Skia arc sweepAngle —
 *   같은 value/100 비율. 지름: Skia 는 layout size.width(factory style.width/height=32) 와 정합.
 *
 * D1: composition `<div role="progressbar">` (SVG circle track + indicator, internal source, 어댑터).
 * D2: value(0-100) + size(sm/md/lg) + isIndeterminate + isDisabled.
 * D3: track 색 = rule fill base / indicator 색 = {color.accent}(theme). Skia escape ↔ DOM SVG 대칭.
 */

import React from "react";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../catalog/resolvers/colorTokenToCss";

export interface ProgressCircleProps {
  /** 진행률 (minValue~maxValue 구간, 기본 0-100) */
  value?: number;
  /** 최소값 (기본 0) — ProgressBar 형제 대칭 (2026-08-21) */
  minValue?: number;
  /** 최대값 (기본 100) */
  maxValue?: number;
  /** 크기 */
  size?: "sm" | "md" | "lg";
  /** 불결정 모드 (75% 정적 호 + CSS 회전 애니메이션) */
  isIndeterminate?: boolean;
  /** 비활성 */
  isDisabled?: boolean;
  /**
   * RSP S2 "over background" — 유색/이미지 배경 위 고정 흑백 스킴 (§2-F, 2026-08-21).
   * track = static 25% wash / indicator = solid static (Skia value_fill_arc 0.25 대칭).
   */
  staticColor?: "auto" | "white" | "black";
  /** 인라인 style override (cutover 경로의 toReactStyle 결과) */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
  /**
   * cutover 경로(toRacProps propPassthrough)가 함께 emit 하는 `data-*` 속성(예: data-size).
   * root `<div>` 에 passthrough 하여 CSS/debug marker 보존. 지름 계산엔 props.size 사용.
   */
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}

// size → 지름 px (rule sizes.height 정합). strokeWidth 는 별도(아래 STROKE_WIDTH 참조).
const DIAMETER: Record<string, number> = {
  sm: 24,
  md: 32,
  lg: 64,
};
// strokeWidth 3 uniform — rule(ComponentRuleSize)에 strokeWidth 필드 없음 → Skia value_fill_arc 가
// 기본값 3 으로 해소. DOM 도 같은 base(3)로 대칭(spec lg=4 는 rule 미이전 잔재, 3 uniform 이 정본).
const STROKE_WIDTH = 3;

/**
 * ProgressCircle — SVG circle track + value 비례 indicator.
 *
 * cutover DOM 경로(CanonicalNodeRenderer)가 marker props/style 을 주입하므로, 본 컴포넌트는
 * value/size/isIndeterminate/isDisabled + style/className 만 소비한다. track 색은 theme rule,
 * indicator 색은 {color.accent}(Skia escape value_fill_arc 와 동일 source).
 */
export function ProgressCircle({
  value = 0,
  minValue = 0,
  maxValue = 100,
  size = "md",
  isIndeterminate,
  isDisabled,
  staticColor,
  style,
  className,
  ...rest
}: ProgressCircleProps): React.ReactElement {
  const sizeKey = String(size).toLowerCase();
  const diameter = DIAMETER[sizeKey] ?? DIAMETER.md;
  const strokeWidth = STROKE_WIDTH;

  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // (value-min)/(max-min) 정규화 — 구 0-100 하드코딩 해소 (§1-3, 2026-08-21).
  //   Skia escape(value_fill_arc)와 동일 공식. span<=0 방어는 0 비율.
  const min = Number(minValue) || 0;
  const max = Number(maxValue) || 0;
  const span = max - min;
  const clamped = Math.max(min, Math.min(max, Number(value) || 0));
  const fraction = span > 0 ? (clamped - min) / span : 0;
  const offset = circumference - fraction * circumference;

  // track 색 = rule fill base, indicator 색 = {color.accent}. Skia escape(value_fill_arc) 와 동일 source.
  // staticColor(white/black) 시 over-background 스킴 — track=25% wash / indicator=solid
  //   (Skia value_fill_arc 동일 상수 0.25, 고정 흑백은 catalog 토큰 표현 불가라 리터럴).
  const rule = resolveComponentRule("ProgressCircle");
  const variant = rule?.variants?.default;
  const isStatic = staticColor === "white" || staticColor === "black";
  const staticRgb = staticColor === "white" ? "255 255 255" : "0 0 0";
  const trackColor = isStatic
    ? `rgb(${staticRgb} / 0.25)`
    : colorTokenToCss(variant?.fill?.default?.base, "var(--bg-muted)");
  const indicatorColor = isStatic
    ? staticColor === "white"
      ? "var(--color-white, #fff)"
      : "var(--color-black, #000)"
    : colorTokenToCss("{color.accent}", "var(--accent)");

  return (
    <div
      {...rest}
      role="progressbar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={isIndeterminate ? undefined : clamped}
      style={{
        width: diameter,
        height: diameter,
        flexShrink: 0,
        ...(isDisabled ? { opacity: 0.38, pointerEvents: "none" } : {}),
        ...style,
      }}
      className={className}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
      >
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {!isIndeterminate && fraction > 0 && (
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={indicatorColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
          />
        )}
      </svg>
    </div>
  );
}
