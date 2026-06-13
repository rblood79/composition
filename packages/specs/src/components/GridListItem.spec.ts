/**
 * GridListItem Component Spec
 *
 * ADR-090 Phase 1 — GridListItem 의 card metric(padding/gap/borderWidth/borderRadius) +
 * containerStyles (display/flexDirection/padding/gap/borderWidth) SSOT.
 *
 * - CSS 자동 생성 미사용 (skipCSSGeneration: true) — parent GridList 가 수동 CSS 유지.
 *   수동 CSS 해체는 후속 ADR (GridList.skipCSSGeneration 전환 + Generator 확장 필요).
 * - Skia consumer: `GridList.render.shapes` 가 `resolveGridListItemMetric(fontSize)` 를 소비.
 * - Layout consumer: `implicitStyles.ts` gridlistitem 분기가 `resolveContainerStylesFallback`
 *   read-through 로 `containerStyles` 를 소비 (ADR-083 Phase 0 인프라).
 *
 * ADR-078 (ListBoxItem spec) 의 패턴을 1:1 재사용.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { parsePxValue } from "../primitives";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";

/**
 * GridListItem Props (Spec metadata + ADR-912 C1 카드 렌더 데이터).
 *
 * ADR-912 단계 4 C1: projected GridListItem node 가 카드를 자체 렌더하므로 row projection 이
 * 주입하는 데이터 필드(children/description/textValue/value/style)를 받는다 (ListBoxItemProps 동형).
 */
export interface GridListItemProps {
  size?: "md";
  children?: unknown;
  description?: unknown;
  textValue?: unknown;
  value?: unknown;
  isDisabled?: boolean;
  _isSelected?: boolean;
  style?: Record<string, string | number | undefined>;
}

/** props.children/textValue/value 에서 카드 label 텍스트 추출 (ListBoxItem 패턴). */
function readText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/** template placeholder(`{label}` 등) 판정 — origin/template 미리보기 시 sample 표시. */
function isTemplatePlaceholder(value: unknown): boolean {
  return typeof value === "string" && /^\{.+\}$/.test(value);
}

/**
 * GridListItem Component Spec
 *
 * skipCSSGeneration: true — CSS 자동 생성 미사용 (parent GridList 수동 CSS 유지).
 * render.shapes: () => [] — Skia shapes 없음 (card 시각은 부모 GridList.render.shapes 담당).
 *
 * sizes.md:
 *   - paddingX: 16, paddingY: 12 — 수동 CSS `var(--spacing-md) var(--spacing-lg)` = 12/16 정합
 *     (fontSize=14 기준값. fontSize>14/>12 분기는 resolveGridListItemMetric 내부에서 처리).
 *   - gap: 2 — label↔description 수직 간격 (수동 CSS `var(--spacing-2xs)` 정합).
 *   - borderWidth: 1 — 수동 CSS `border: 1px solid var(--border)` 정합.
 *   - borderRadius {radius.lg} = 8px (fontSize=14 기준. fontSize>14 분기는 resolver 내부 12px).
 *   - descGap 4 — label↔description 사이 Skia shapes 수직 간격 (fontSize=14 기준).
 *
 * containerStyles: `implicitStyles.ts:758-773` gridlistitem 분기의 하드코딩을 리프팅.
 *   `resolveContainerStylesFallback` 을 통해 parentStyle 에 선주입 → 기존 분기 해체 가능.
 */
export const GridListItemSpec: ComponentSpec<GridListItemProps> = {
  name: "GridListItem",
  description:
    "GridList item — Spec metadata 전용 (skipCSSGeneration: true, Skia shapes 부모 소비)",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,

  // ADR-912 collection sub-part cutover (2026-06-14): containerStyles(display/flexDirection)는
  //   implicitStyles.ts gridlistitem 분기가 `display: parentStyle.display ?? "flex"` /
  //   `flexDirection: ... ?? "column"` 로 직접 주입(분기 자족화)하므로 spec body 비의존.
  //   resolveContainerStylesFallback 의 generic spec.containerStyles 읽기 의존을 제거 — spec body
  //   물리 삭제 후에도 fallback {} → 분기 기본값 발동으로 layout 불변(redundant 확정).

  defaultSize: "md",

  // ADR-090 Phase 1: md 기준 card metric SSOT (fontSize=14 기준값).
  //   fontSize>14/>12 분기는 resolveGridListItemMetric 내부에 캡슐화.
  sizes: {
    md: {
      // height 0 = content-fit (card 시각은 label+description 합산 + padding)
      height: 0,
      paddingX: 16,
      paddingY: 12,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      gap: 2,
      fontWeight: 600,
    },
  },

  states: {
    hover: {
      background: "{color.layer-1}",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  render: {
    // ADR-912 단계 4 C1 (2026-06-03): 카드 시각을 부모 GridList.render.shapes 에서 본 spec 으로 이전.
    //   projected GridListItem node(canvasSceneNode collectionProjection)가 카드 1개를 자체 렌더한다
    //   (ListBoxItem.spec.render.shapes 동형 — 부모는 shell, item spec 이 행/카드 렌더). 배치(grid/stack
    //   numCols)는 Taffy layout 이 담당하므로 카드는 (0,0) origin 단일 박스로 그린다.
    //   시각 정본: 기존 GridList.render.shapes renderOneCard(roundRect {color.layer-1} + border
    //   {color.border} + label fw600 + description {color.neutral-subdued}).
    shapes: (props, size, _state = "default") => {
      const style = (props.style ?? {}) as Record<string, unknown>;
      const fontSize = resolveSpecFontSize(
        (style.fontSize as string | number | undefined) ?? size.fontSize,
        14,
      );
      const metric = resolveGridListItemMetric(fontSize);
      const cardPaddingX = parsePxValue(
        style.paddingLeft ?? style.padding,
        metric.cardPaddingX,
      );
      const cardPaddingY = parsePxValue(
        style.paddingTop ?? style.padding,
        metric.cardPaddingY,
      );
      const cardBorderRadius = parsePxValue(
        style.borderRadius,
        metric.cardBorderRadius,
      );
      const descFontSize = fontSize - 2;
      const ff = (style.fontFamily as string) || fontFamily.sans;
      const textColor =
        (style.color as string | undefined) ?? ("{color.neutral}" as TokenRef);

      // template placeholder(`{label}`) → sample 미리보기 (빈 화면 방지, ListBoxItem 패턴).
      const labelRaw = props.children ?? props.textValue ?? props.value;
      const isTemplatePreview = isTemplatePlaceholder(labelRaw);
      const label = isTemplatePreview
        ? "Label"
        : (readText(props.children) ??
          readText(props.textValue) ??
          readText(props.value) ??
          "");
      const description = isTemplatePreview
        ? props.description != null && props.description !== ""
          ? "Description"
          : null
        : readText(props.description);

      const labelH = fontSize;
      const descH = description ? descFontSize + metric.descGap : 0;
      const cardHeight = parsePxValue(
        style.height,
        cardPaddingY * 2 + labelH + descH,
      );

      const shapes: Shape[] = [];

      // 카드 박스 (bg + border) — GridList.render.shapes renderOneCard 정본.
      shapes.push({
        id: "card-bg",
        type: "roundRect",
        x: 0,
        y: 0,
        width: "auto",
        height: cardHeight,
        radius: cardBorderRadius,
        fill: "{color.layer-1}" as TokenRef,
      });
      shapes.push({
        type: "border",
        target: "card-bg",
        borderWidth: parsePxValue(style.borderWidth, 1),
        color: "{color.border}" as TokenRef,
        radius: cardBorderRadius,
      });

      // label
      shapes.push({
        type: "text",
        x: cardPaddingX,
        y: cardPaddingY,
        text: label,
        fontSize,
        fontFamily: ff,
        fontWeight: (style.fontWeight as string | number | undefined) ?? 600,
        fill: textColor,
      });

      // description (optional)
      if (description) {
        shapes.push({
          type: "text",
          x: cardPaddingX,
          y: cardPaddingY + fontSize + metric.descGap,
          text: description,
          fontSize: descFontSize,
          fontFamily: ff,
          fill: "{color.neutral-subdued}" as TokenRef,
        });
      }

      return shapes;
    },
    react: () => ({}),
  },
};

/**
 * ADR-090 Phase 2: GridListItem card metric 단일 소스 resolver.
 *
 * `GridList.render.shapes` 가 카드 시각 생성 시 본 resolver 를 소비.
 * fontSize-based 분기(fontSize>14: 20/16/12/6, >12: 16/12/8/4, else: 12/10/8/4) 를 내부 캡슐화.
 *
 * 기본값 (fontSize=14 기준): GridListItemSpec.sizes.md 에서 직접 참조.
 * fontSize=14 기준값: paddingX/Y = CSS `var(--spacing-md)/var(--spacing-lg)` (12/16) 정합.
 * gap=2 = CSS `var(--spacing-2xs)` 정합. borderRadius={radius.lg}=8px = CSS `var(--radius-lg)` 정합.
 * fontSize>14/>12 분기는 내부에서 처리 (cardBorderRadius 12/8/8).
 * ADR-105-c: 삼자 정합 완결 (Spec {radius.lg} / resolver 8 / CSS var(--radius-lg)).
 */
export function resolveGridListItemMetric(fontSize: number): {
  cardPaddingX: number;
  cardPaddingY: number;
  cardBorderRadius: number;
  descGap: number;
} {
  // fontSize>14: large 카드 (20/16/12/6)
  if (fontSize > 14) {
    return {
      cardPaddingX: 20,
      cardPaddingY: 16,
      cardBorderRadius: 12,
      descGap: 6,
    };
  }
  // fontSize>12: medium 카드 (16/12/8/4) — spec.sizes.md 기본값 매칭
  if (fontSize > 12) {
    const sz = GridListItemSpec.sizes.md;
    return {
      cardPaddingX: sz.paddingX,
      cardPaddingY: sz.paddingY,
      cardBorderRadius: 8,
      descGap: 4,
    };
  }
  // fontSize≤12: small 카드 (12/10/8/4)
  return {
    cardPaddingX: 12,
    cardPaddingY: 10,
    cardBorderRadius: 8,
    descGap: 4,
  };
}
