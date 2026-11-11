/**
 * ADR-142 family ①(primitives/actions) — Link leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Link 는 text-only leaf(배경 없음, fill.alpha:0) + underline(D3 시각, theme/composition 데이터).
 * de-risk 그룹(box+text): Separator(divider) 다음으로 단순. icon/children 합성 없음.
 *
 * D1: RAC `Link` 가 `<a>` 를 emit. href/target/rel/isDisabled 는 RAC props 통과.
 * D2: variant(primary·secondary)/size/staticColor/isQuiet 등 편집 surface.
 *     isExternal/showExternalIcon 은 2026-09-10 제거 — RSP 미규정 custom 이고 canonical Preview 는
 *     raw RAC.Link 라 소비처가 없었다(외부 링크는 RAC `target`/`rel` 로 표현).
 * D3: 시각(text 색/underline)은 theme/tokens data-* rules. underline 은 Skia 가
 *     buildCatalogShapes 의 spec.composition.rootSelectors text-decoration 데이터로 재현.
 */

import type { PrimitiveBinding } from "../types";
import { ARIA_LABELING_PROPS, RAC_SLOT_PROP } from "./accessibilityProps";

export const linkBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Link",
  },
  rac: {
    primitive: "Link",
    parts: ["link"],
    slots: [],
    states: [
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
    ],
    renderProps: [
      "isHovered",
      "isPressed",
      "isFocused",
      "isFocusVisible",
      "isDisabled",
      "isCurrent",
    ],
    dataAttributes: [
      "data-hovered",
      "data-pressed",
      "data-focused",
      "data-focus-visible",
      "data-disabled",
      "data-current",
    ],
  },
  props: {
    accepts: {
      ...ARIA_LABELING_PROPS,
      slot: RAC_SLOT_PROP,
      // (2026-11-11 사용자 결정 「숨김」: developer HTML · ARIA attributes — accepted, not offered in the panel.)
      "aria-current": {
        editorHidden: true,
        kind: "enum",
        label: "Current",
        section: "state",
        options: [
          "page",
          "step",
          "location",
          "date",
          "time",
          "true",
          "false",
        ].map((value) => ({ value, label: value })),
      },
      download: {
        kind: "string",
        label: "Download",
        section: "content",
        editorHidden: true,
      },
      hrefLang: {
        kind: "string",
        label: "Link language",
        section: "content",
        editorHidden: true,
      },
      ping: {
        kind: "string",
        label: "Ping",
        section: "content",
        editorHidden: true,
      },
      referrerPolicy: {
        editorHidden: true,
        kind: "enum",
        label: "Referrer policy",
        section: "content",
        options: [
          "no-referrer",
          "no-referrer-when-downgrade",
          "origin",
          "origin-when-cross-origin",
          "same-origin",
          "strict-origin",
          "strict-origin-when-cross-origin",
          "unsafe-url",
        ].map((value) => ({ value, label: value })),
      },
      children: { kind: "string", label: "Label", section: "content" },
      // 시각 차원 → data-variant / data-size (theme 가 값 집합 + text 색 제공)
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "primary",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      staticColor: {
        kind: "enum",
        label: "Static Color",
        section: "appearance",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ],
      },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // S2 1.8.0 Link `isStandalone` (2026-10-10): 문단 밖 단독 링크 — S2 는 UI font + medium
      //   weight (Link.tsx `fontWeight: { isStandalone: 'medium' }`). DOM = `data-standalone`
      //   (toRacProps) + Link.css, Canvas = 같은 weight 를 rule top-level
      //   containerVariants.standalone 에서 (`rulePaint.ts` · `styleOf` 측정).
      isStandalone: {
        kind: "boolean",
        label: "Standalone",
        section: "appearance",
      },
      // RAC Link / anchor props
      href: { kind: "string", label: "URL", section: "content" },
      target: {
        kind: "enum",
        label: "Target",
        section: "content",
        options: [
          { value: "_self", label: "Same Window" },
          { value: "_blank", label: "New Window" },
          { value: "_parent", label: "Parent Frame" },
          { value: "_top", label: "Top Frame" },
        ],
      },
      rel: { kind: "string", label: "Rel", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — generic toRacProps 경로.
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
};
