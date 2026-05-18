/**
 * CardPreview Component Spec
 *
 * Card 미디어/프리뷰 슬롯 컨테이너. Card factory(`LayoutComponents.ts`)가 Card 생성 시
 * Image 자식과 함께 자동 생성한다 (CardHeader/CardContent/CardFooter 와 동일한 슬롯).
 *
 * Disclosure·Tree 버그 클래스 수정 (2026-05-18): CardPreview 는 그동안 spec 이 없어
 * Skia `buildSpecNodeData` 가 노드를 만들지 못했고(`getSpecForTag` → null) Preview
 * (`renderCardPreview`)만 렌더 → Builder(Skia) ↔ Preview 시각 비대칭(D3 위반).
 * 본 spec 으로 Skia 가 컨테이너 노드를 생성하게 하여 borderRadius/overflow clip 을 복원한다.
 *
 * - render.shapes: () => [] — 컨테이너 shell. 시각은 자식 Image + element.props.style
 *   (overflow:hidden / borderRadius) 가 담당.
 * - skipCSSGeneration: true — 부모 CardSpec.childSpecs 경로(ADR-094 `expandChildSpecs`)로
 *   Skia/Taffy 자동 등록. CardHeader/CardContent/CardFooter 와 동일.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";

/**
 * CardPreview Props
 */
export interface CardPreviewProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * CardPreview Component Spec
 *
 * skipCSSGeneration: true — 독립 CSS 파일 emit 없음. 부모 CardSpec.childSpecs 경로.
 * render.shapes: () => [] — Skia shapes 없음 (container shell).
 */
export const CardPreviewSpec: ComponentSpec<CardPreviewProps> = {
  name: "CardPreview",
  description: "Card preview/media slot — container shell",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,

  defaultSize: "md",

  // sizes: CardPreview 는 Card 컨테이너 내부 슬롯이므로 자체 padding = 0.
  //   CardHeader/CardFooter 와 동일한 size-indexed 스케일 유지 (정합성).
  sizes: {
    xs: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 4,
    },
    sm: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 4,
    },
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
    },
    xl: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 8,
    },
  },

  states: {
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    // Skia 미사용 — container shell.
    //   미디어 시각은 자식 Image + element.props.style(overflow/borderRadius) 가 담당.
    shapes: () => [],
    react: () => ({}),
  },
};
