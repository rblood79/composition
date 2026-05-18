/**
 * FormField Component Spec
 *
 * Form 필드 그룹 슬롯 컨테이너 (Label + 입력 컨트롤 묶음). Form factory
 * (`FormComponents.ts`)가 Form 생성 시 Heading/Description 과 함께 자동 생성한다.
 *
 * Disclosure·Tree 버그 클래스 수정 (2026-05-18): FormField 는 그동안 spec 이 없어
 * Skia `buildSpecNodeData` 가 노드를 만들지 못했고(`getSpecForTag` → null) Preview 만
 * 렌더 → Builder(Skia) ↔ Preview 시각 비대칭(D3 위반). 본 spec 으로 Skia 가 컨테이너
 * 노드를 생성하게 하여 필드 그룹 레이아웃을 복원한다.
 *
 * - render.shapes: () => [] — 컨테이너 shell. 시각은 자식 Label/입력 Element +
 *   element.props.style(display:flex / flexDirection:column) 가 담당.
 * - skipCSSGeneration: true — 부모 FormSpec.childSpecs 경로(ADR-094 `expandChildSpecs`)로
 *   Skia/Taffy 자동 등록. CardHeader/CardFooter 슬롯과 동일.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";

/**
 * FormField Props
 */
export interface FormFieldProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * FormField Component Spec
 *
 * skipCSSGeneration: true — 독립 CSS 파일 emit 없음. 부모 FormSpec.childSpecs 경로.
 * render.shapes: () => [] — Skia shapes 없음 (container shell).
 */
export const FormFieldSpec: ComponentSpec<FormFieldProps> = {
  name: "FormField",
  description: "Form field slot — label + control group, container shell",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,

  defaultSize: "md",

  // sizes: FormField 는 Form 컨테이너 내부 슬롯이므로 자체 padding = 0.
  //   gap 만 size-indexed — Label + 입력 컨트롤 사이 간격(factory inline gap 이 우선).
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
      gap: 4,
    },
    lg: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 6,
    },
    xl: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 6,
    },
  },

  states: {
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    // Skia 미사용 — container shell.
    //   필드 그룹 시각은 자식 Label/입력 Element + element.props.style 가 담당.
    shapes: () => [],
    react: () => ({}),
  },
};
