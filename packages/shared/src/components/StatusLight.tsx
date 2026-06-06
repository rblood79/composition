/**
 * StatusLight Component — 상태 표시 dot + 라벨 (Spectrum 2 StatusLight).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   StatusLight 은 catalog 미등록 상태에서 spec.render.shapes(StatusLight.spec.ts:362-425)가
 *   Skia 시각 source 였고, DOM 은 rendererMap.renderStatusLight 가 담당. factory `children: []`
 *   (자식 Element 아님) + label 은 props.children → catalog cutover DOM 경로가
 *   INTERNAL_RENDERERS["statuslight"] 를 React 컴포넌트로 렌더(IllustratedMessage 선례 동형).
 *
 *   **dot 색 = rule 기반 20 variant (DOM/Skia 대칭)**: StatusLight 은 dot 인디케이터라 generated CSS
 *   (`react-aria-{Type}[data-variant] { background }`, 컨테이너에 칠함)를 쓸 수 없는 outlier
 *   (archetype simple 41 컴포넌트 중 유일 — 나머지는 컨테이너 색이 정확). generated CSS dot redirect 는
 *   CSSGenerator broad-shared rework(41 컴포넌트 공유) 라 격리 회피. 대신 본 컴포넌트가
 *   resolveComponentRule("StatusLight").variants[v].fill.default.base(TokenRef) → colorTokenToCss 로
 *   dot 에 인라인 색 적용. Skia escape(skiaPrimitives.ts status_light)도 같은 rule fill base 를
 *   읽으므로 양쪽이 같은 source(rule) → 시각 대칭. (사용자 결정 2026-06-06: "DOM 도 rule 기반 20 variant")
 *
 * D1: composition `<div>` (dot span + label span, internal source, INTERNAL_RENDERERS 어댑터).
 * D2: variant(20종: neutral/informative/positive/notice/negative + named color 15) + size(sm/md/lg/xl) + children.
 * D3: dot 색 = rule fill base(theme rule SSOT). Skia escape ↔ DOM 인라인 style 시각 대칭.
 */

import React from "react";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../catalog/resolvers/colorTokenToCss";

export interface StatusLightProps {
  /** 상태 색 variant (rule table 의 20 variant) */
  variant?: string;
  /** 크기 */
  size?: "sm" | "md" | "lg" | "xl";
  /** 라벨 텍스트 */
  children?: React.ReactNode;
  /** 인라인 style override (cutover 경로의 toReactStyle 결과) */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
  /**
   * cutover 경로(toRacProps propPassthrough)가 함께 emit 하는 `data-*` 속성(예: data-variant,
   * data-size). root `<div>` 에 passthrough 하여 CSS/debug marker 보존. dot 색 계산엔 props.variant 사용.
   */
  [dataAttr: `data-${string}`]: string | undefined;
}

// size → dot/font px (StatusLight.spec.ts sizes 와 정합 — rule sizes 에 dotSize 미보유).
const DOT_SIZE: Record<string, number> = { sm: 8, md: 10, lg: 12, xl: 14 };
const FONT_SIZE: Record<string, number> = { sm: 12, md: 14, lg: 16, xl: 18 };

/**
 * StatusLight — 상태 dot + 라벨.
 *
 * cutover DOM 경로(CanonicalNodeRenderer)가 marker props/style 을 주입하므로,
 * 본 컴포넌트는 variant/size/children + style/className 만 소비한다.
 * dot 색은 theme rule(resolveComponentRule)의 variant fill base — 하드코딩 맵 아님(20 variant 대칭).
 */
export function StatusLight({
  variant = "neutral",
  size = "md",
  children,
  style,
  className,
  ...rest
}: StatusLightProps): React.ReactElement {
  const sizeKey = String(size).toLowerCase();
  const dotSize = DOT_SIZE[sizeKey] ?? 10;
  const fontSize = FONT_SIZE[sizeKey] ?? 14;

  // dot 색 = rule fill base (20 variant) → CSS. Skia escape 와 같은 source.
  const rule = resolveComponentRule("StatusLight");
  const fillBase = rule?.variants?.[variant]?.fill?.default?.base;
  const dotColor = colorTokenToCss(fillBase);

  return (
    <div
      {...rest}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        ...style,
      }}
      className={className}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      {children != null && children !== "" && (
        <span style={{ fontSize }}>{children}</span>
      )}
    </div>
  );
}
