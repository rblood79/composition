/**
 * IllustratedMessage Component — 빈 상태 표시 (일러스트 placeholder + Heading + Description).
 *
 * **ADR-912 진로 1번 IllustratedMessage proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   IllustratedMessage 은 catalog 미등록 상태에서 spec.render.shapes(IllustratedMessage.spec.ts:104-187)
 *   가 Skia 시각 source 였고, DOM 은 rendererMap.renderIllustratedMessage(LayoutRenderers.tsx:1890)
 *   가 담당했다. catalog 등록 시 DOM cutover 경로(CanonicalNodeRenderer:241)가
 *   `INTERNAL_RENDERERS["illustrated"]` 를 React 컴포넌트로 렌더 — `(element, context)` 계약의
 *   renderIllustratedMessage 는 그 계약에 안 맞으므로(Tabs 선례), props 직접 소비 React 컴포넌트로 신설.
 *   heading/description 은 자식 Element 가 아닌 props(factory `children: []`) → generic fallback 으로는
 *   안 그려진다. INTERNAL_RENDERERS 어댑터가 필수.
 *
 *   Skia 는 `skiaPrimitive: "illustrated_message"` escape(skiaPrimitives.ts, append 모드)가 placeholder
 *   roundRect + heading text + description text 를 그린다 — buildCatalogShapes box+text 는 단일 box +
 *   단일 text 만 가능해 nested placeholder+2text 표현 불가.
 *
 * **ADR-151 후속 (2026-07-17)**: 기하(box/padding/gap/heading·desc 폰트/line height)를
 *   `resolveIllustratedMessageMetric`(specs — escape/layout 과 공유 SSOT) + catalog rule sizes
 *   read-through(StatusLight 패턴)로 전환. 구 md 하드코딩은 size prop(sm/lg) 미소비였고,
 *   line-height 를 1.5 로 명시해 layout 분기 산식(headingLine/descLine)과 px 일치.
 *
 * D1: composition `<div role="status">` (internal source, INTERNAL_RENDERERS 어댑터).
 * D2: heading + description + variant(default) + size(sm/md/lg) 편집.
 * D3: 시각(placeholder dim/text 색)은 인라인 style + 부모 CSS 변수(--bg-muted/--fg/--fg-muted).
 *     Skia escape(illustrated_message)와 metric SSOT 로 시각 대칭.
 */

import React from "react";
import { resolveIllustratedMessageMetric } from "@composition/specs";
import type { IllustratedMessageSizeLike } from "@composition/specs";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";

export interface IllustratedMessageProps {
  /** 헤딩 텍스트 */
  heading?: string;
  /** 설명 텍스트 */
  description?: string;
  /** 크기 (catalog sizes sm/md/lg — padding/gap/폰트/placeholder 변) */
  size?: "sm" | "md" | "lg" | string;
  /** 인라인 style override (cutover 경로의 toReactStyle 결과) */
  style?: React.CSSProperties;
  /** 추가 className */
  className?: string;
  /**
   * ADR-151 후속 (2026-07-17): cutover 경로(CanonicalNodeRenderer)가 marker
   * (data-element-id/data-canonical-id) 및 data-* 를 props 로 주입한다 — root `<div>`
   * 에 passthrough 하지 않으면 preview 측정/클릭 선택(closest("[data-element-id]"))이
   * 이 요소를 못 찾는다 (StatusLight 동형 패턴).
   */
  [dataAttr: `data-${string}`]: string | undefined;
}

/**
 * IllustratedMessage — 빈 상태(empty state) 표시 컴포넌트.
 *
 * cutover DOM 경로(CanonicalNodeRenderer)가 marker props/style 을 주입하므로,
 * 본 컴포넌트는 heading/description/size + style/className 만 소비한다.
 */
export function IllustratedMessage({
  heading,
  description,
  size = "md",
  style,
  className,
  ...rest
}: IllustratedMessageProps): React.ReactElement {
  const headingText = heading || "No content";
  const descriptionText = description || "There is nothing to display.";

  // catalog rule sizes read-through — Skia escape/layout 분기와 동일 metric source.
  const sizeKey = String(size).toLowerCase();
  const rule = resolveComponentRule("IllustratedMessage");
  const m = resolveIllustratedMessageMetric(
    sizeKey,
    rule?.sizes?.[sizeKey] as IllustratedMessageSizeLike | undefined,
  );

  return (
    <div
      {...rest}
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: m.gap,
        padding: `${m.paddingY}px ${m.paddingX}px`,
        textAlign: "center",
        ...style,
      }}
      className={className}
    >
      {/* 일러스트 placeholder */}
      <div
        style={{
          width: m.box,
          height: m.box,
          borderRadius: 12,
          backgroundColor: "var(--bg-muted, #f3f4f6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-muted, #9ca3af)",
          fontSize: 48,
        }}
      >
        &#9675;
      </div>
      <div
        style={{
          fontSize: m.headingFs,
          lineHeight: 1.5,
          fontWeight: 600,
          color: "var(--fg, #1f2937)",
        }}
      >
        {headingText}
      </div>
      <div
        style={{
          fontSize: m.descFs,
          lineHeight: 1.5,
          color: "var(--fg-muted, #6b7280)",
        }}
      >
        {descriptionText}
      </div>
    </div>
  );
}
