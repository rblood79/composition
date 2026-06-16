/**
 * Avatar Component — 사용자 아바타 circle bg + image | initials placeholder.
 *
 * **ADR-912 진로 1번 Avatar proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   Avatar 는 catalog 미등록 상태에서 구 spec.render.shapes(Avatar.spec.ts, 2026-06-16 삭제)가 Skia
 *   시각 source 였고, DOM 은 rendererMap.renderAvatar(LayoutRenderers.tsx:1269) inline 함수가 담당했다. factory
 *   `children: []`(leaf, 자식 Element 아님) + src/alt/initials 는 props → catalog cutover DOM 경로가
 *   INTERNAL_RENDERERS["avatar"] 를 React 컴포넌트로 렌더(StatusLight 선례 동형).
 *
 *   **circle bg 색 + text 색 = rule(DOM/Skia 대칭)**: Avatar circle 배경/이니셜 텍스트 색을
 *   resolveComponentRule("Avatar").variants.default.fill.default.base / .text(TokenRef) → colorTokenToCss
 *   로 변환해 인라인 적용. Skia escape(skiaPrimitives.ts avatar)도 같은 rule 값을 읽으므로 양쪽이
 *   같은 source → 시각 대칭. (legacy renderAvatar 의 var(--bg-muted)/var(--fg) 하드코딩과 동일 값:
 *   {color.neutral-subtle}=var(--bg-muted), {color.neutral}=var(--fg) — drift 0)
 *
 *   **fontSize 는 size→px 맵(spec typography token 대응)**: xs=10/sm=12/md=14/lg=16/xl=18
 *   (Avatar.spec sizes fontSize = text-2xs..text-lg). Skia escape 와 동일 맵 → 이니셜 크기 대칭.
 *   (legacy renderAvatar 의 `size*0.4` 와 다름 — spec typography token 이 정본).
 *
 * D1: composition `<div>` (circle bg + img|initials span, internal source, INTERNAL_RENDERERS 어댑터).
 * D2: src(image URL) + alt + initials(fallback) + size(xs/sm/md/lg/xl) + isDisabled.
 * D3: circle bg 색 = rule fill base / 이니셜 색 = rule text(theme rule SSOT). Skia escape ↔ DOM 대칭.
 */

import React from "react";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../catalog/resolvers/colorTokenToCss";

export interface AvatarProps {
  /** 이미지 URL (있으면 img, 없으면 initials fallback) */
  src?: string;
  /** 대체 텍스트 (img alt, initials 미지정 시 첫 2글자 fallback) */
  alt?: string;
  /** 이니셜 텍스트 (src 없을 때 표시) */
  initials?: string;
  /** 크기 */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** 비활성 */
  isDisabled?: boolean;
  /** 인라인 style override (cutover 경로의 toReactStyle 결과) */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
  /**
   * cutover 경로(toRacProps propPassthrough)가 함께 emit 하는 `data-*` 속성(예: data-size).
   * root `<div>` 에 passthrough 하여 CSS/debug marker 보존. 크기 계산엔 props.size 사용.
   */
  [dataAttr: `data-${string}`]: string | undefined;
}

// size → 지름 px (rule COMPONENT_RULES_TABLE.Avatar sizes height 와 정합).
const DIAMETER: Record<string, number> = {
  xs: 24,
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
};
// size → 이니셜 fontSize px (rule Avatar sizes fontSize = typography text-2xs..text-lg).
const FONT_SIZE: Record<string, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
};

/**
 * Avatar — circle bg + image | initials.
 *
 * cutover DOM 경로(CanonicalNodeRenderer)가 marker props/style 을 주입하므로,
 * 본 컴포넌트는 src/alt/initials/size/isDisabled + style/className 만 소비한다.
 * circle bg/이니셜 색은 theme rule(resolveComponentRule)의 variant fill base / text.
 */
export function Avatar({
  src,
  alt,
  initials,
  size = "md",
  isDisabled,
  style,
  className,
  ...rest
}: AvatarProps): React.ReactElement {
  const sizeKey = String(size).toLowerCase();
  const diameter = DIAMETER[sizeKey] ?? 32;
  const fontSize = FONT_SIZE[sizeKey] ?? 14;

  // circle bg / 이니셜 색 = rule fill base / colors.text. Skia escape 와 같은 source.
  // 비-fill 색(text)은 ComponentRuleVariant.colors.text 에 있음(variant.text 아님 — 타입상 미존재).
  const rule = resolveComponentRule("Avatar");
  const variant = rule?.variants?.default;
  const bgColor = colorTokenToCss(
    variant?.fill?.default?.base,
    "var(--bg-muted)",
  );
  const textColor = colorTokenToCss(variant?.colors?.text, "var(--fg)");

  const label = initials || alt?.slice(0, 2).toUpperCase() || "?";

  return (
    <div
      {...rest}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
        color: textColor,
        fontSize,
        fontWeight: 500,
        flexShrink: 0,
        ...(isDisabled ? { opacity: 0.38, pointerEvents: "none" } : {}),
        ...style,
      }}
      className={className}
    >
      {src ? (
        <img
          src={src}
          alt={alt || "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
