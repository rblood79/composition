/**
 * DialogFooter Component Spec
 *
 * Dialog 액션 버튼 영역 슬롯 컨테이너. Dialog factory(`OverlayComponents.ts`)가
 * Dialog 생성 시 Heading/Description 과 함께 자동 생성한다.
 *
 * Disclosure·Tree 버그 클래스 수정 (2026-05-18): DialogFooter 는 그동안 spec 이 없어
 * Skia `buildSpecNodeData` 가 노드를 만들지 못했고(`getSpecForTag` → null) Preview
 * (`App.tsx` DialogFooter case)만 렌더 → Builder(Skia) ↔ Preview 시각 비대칭(D3 위반).
 * 본 spec 으로 Skia 가 컨테이너 노드를 생성하게 하여 footer 레이아웃을 복원한다.
 *
 * - render.shapes: () => [] — 컨테이너 shell. 시각은 자식 버튼 Element +
 *   element.props.style(display:flex / justifyContent) 가 담당.
 * - skipCSSGeneration: true — 부모 DialogSpec.childSpecs 경로(ADR-094 `expandChildSpecs`)로
 *   Skia/Taffy 자동 등록. CardHeader/CardFooter 슬롯과 동일.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";

/**
 * DialogFooter Props
 */
export interface DialogFooterProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * DialogFooter Component Spec
 *
 * skipCSSGeneration: true — 독립 CSS 파일 emit 없음. 부모 DialogSpec.childSpecs 경로.
 * render.shapes: () => [] — Skia shapes 없음 (container shell).
 */
export const DialogFooterSpec: ComponentSpec<DialogFooterProps> = {
  name: "DialogFooter",
  description: "Dialog footer slot — action button area, container shell",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,

  defaultSize: "md",

  // sizes: DialogFooter 는 Dialog 컨테이너 padding 내부 슬롯이므로 자체 padding = 0.
  //   gap 만 size-indexed — 액션 버튼들 사이 간격(factory inline gap 이 우선).
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
      gap: 8,
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
      gap: 12,
    },
    xl: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 12,
    },
  },

  states: {
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    // Skia 미사용 — container shell.
    //   footer 시각은 자식 버튼 Element + element.props.style 가 담당.
    shapes: () => [],
    react: () => ({}),
  },
};
