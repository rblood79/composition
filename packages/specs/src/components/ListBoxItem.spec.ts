/**
 * ListBoxItem Component Spec
 *
 * ADR-078 Phase 1 — ListBoxItem 의 item metric(padding/lineHeight/borderRadius/minHeight) SSOT.
 * ADR-146 이후 Builder Skia row projection도 본 Spec 의 render.shapes 를 직접 통과한다.
 * CSSGenerator 자식 selector emit 확장(ADR-078 Phase 2)을 통해
 * `.react-aria-ListBoxItem` 블록은 `generated/ListBox.css` 에 emit 된다.
 *
 * Menu/MenuItem 분리 구조(ADR-068/071) 를 ListBox/ListBoxItem 에 1:1 재적용.
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue } from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";

/**
 * ListBoxItem Props (CSS 생성 전용)
 */
export interface ListBoxItemProps {
  size?: "md";
  children?: unknown;
  description?: unknown;
  isDisabled?: boolean;
  textValue?: unknown;
  value?: unknown;
  _isSelected?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * ListBoxItem Component Spec
 *
 * skipCSSGeneration: false — CSS 자동 생성 활성화 (Phase 2 Generator 확장 연동)
 * ADR-146: Skia row projection이 ListBoxItem renderer를 직접 통과한다.
 *
 * ADR-078 Phase 3 (종결): `ListBox.spec.render.shapes` / layout `calculateContentHeight`
 *   가 `resolveListBoxItemMetric(fontSize)` 를 공유 소비 — 기존 하드코딩 상수 해체 완료.
 * ADR-078 Phase 4 (종결): 수동 `ListBox.css` 중 Generator 커버 속성(padding/border-radius/
 *   min-height/font-size/line-height/font-weight/gap + hover/disabled) 삭제 완료. dead vars
 *   (`--lb-item-min-height/size/line-height`) 제거. 잔존 수동 CSS 는 Generator 미커버 영역만
 *   (display column 레이아웃, slot selector, variant 5종 cascade, Popover context override).
 */
export const ListBoxItemSpec: ComponentSpec<ListBoxItemProps> = {
  name: "ListBoxItem",
  description:
    "ListBox item — row projection renderer and generated CSS source",
  archetype: "simple",
  element: "div",
  // ADR-078 Phase 2: 독립 CSS 파일 emit 중단.
  //   부모 ListBoxSpec.childSpecs 경로로 `generated/ListBox.css` 에만 inline emit 되어
  //   수동 ListBox.css 가 참조하는 `.react-aria-ListBox[data-orientation] .react-aria-ListBoxItem`
  //   등 자식 selector cascade 와 동일 @layer 에 속한다.
  skipCSSGeneration: true,

  // ADR-079: ListBoxItem 내부 레이아웃 SSOT.
  //   archetype="simple" base = `display: inline-flex; align-items: center;` 를 override 하여
  //   label+description 수직 스택 + 좌측 정렬 선언. 기존 수동 ListBox.css 의 4속성
  //   (display/flex-direction/align-items/justify-content) 를 Spec 으로 리프팅.
  containerStyles: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
  },

  defaultSize: "md",

  // ADR-078 G1: md 기준 item metric SSOT
  //   - height = paddingY*2 + lineHeight(20) = 28 (ListBox 실측 정합)
  //   - minHeight 20 = virtual/short 콘텐츠 시 축소 하한(line-box 최소)
  //   - borderRadius {radius.xs} = Menu/MenuItem 과 독립적인 hover pill 모서리
  // sm/lg/xl 사이즈는 현재 ListBox 가 md-only 이므로 미정의.
  //   향후 필요 시 MenuItem 4-size 스키마와 동일 구조로 확장 가능.
  sizes: {
    md: {
      // ADR-078 Phase 4: CSS `height: auto` emit — 수동 `display: flex; flex-direction: column`
      //   레이아웃(label+description 수직 배치)에서 content 에 따라 확장 허용.
      //   Skia/layout intrinsic 은 `resolveListBoxItemMetric(fontSize).itemHeight` 로 계산.
      height: 0,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.xs}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      minHeight: 20,
      // ADR-078 Phase 4: label↔description 수직 간격 2px (수동 CSS `var(--spacing-2xs)` 정합).
      //   `render.shapes` 내부 selection indicator icon↔text 간격은 별도 하드코딩(6px) — scope 외.
      gap: 2,
      // ADR-078 Phase 4: 수동 CSS `font-weight: 600` 이관 — Generator 자동 emit.
      fontWeight: 600,
    },
  },

  states: {
    // ADR-070 패턴 차용: hover 배경은 {color.layer-1} = var(--bg-overlay).
    //   ListBox variant.default.fill.default.hover 가 {color.layer-2} 이나,
    //   item 단위 hover 는 Menu/MenuItem 선례대로 popover context(layer-1) 사용.
    //   Phase 3 render.shapes 연동 시 fill.default.hover 우선순위 재검토.
    hover: {
      background: "{color.layer-1}",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
    // disabled.text 는 추가하지 않음 — opacity 0.38 이 텍스트까지 dim 처리 (ADR-070 패턴)
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  render: {
    shapes: (props, size, state = "default") => {
      const style = props.style ?? {};
      const fontSize = resolveSpecFontSize(style.fontSize ?? size.fontSize, 14);
      const metric = resolveListBoxItemMetric(fontSize);
      const paddingX = parsePxValue(
        style.paddingX ?? style.paddingLeft,
        metric.paddingX,
      );
      const paddingY = parsePxValue(
        style.paddingY ?? style.paddingTop,
        metric.paddingY,
      );
      const rowHeight = parsePxValue(
        style.height,
        Math.max(metric.itemHeight, parsePxValue(style.minHeight, 20)),
      );
      const width =
        typeof style.width === "number" && style.width > 0 ? style.width : 200;
      const label =
        readText(props.children) ??
        readText(props.textValue) ??
        readText(props.value) ??
        "";
      const description = readText(props.description);
      const textColor = props.isDisabled
        ? ("{color.neutral-subdued}" as TokenRef)
        : ((style.color as string | undefined) ??
          ("{color.neutral}" as TokenRef));
      const textX = paddingX;
      const maxWidth = Math.max(1, width - paddingX * 2);
      const shapes: Shape[] = [];

      if (props._isSelected || state === "hover" || state === "pressed") {
        shapes.push({
          id: "row-bg",
          type: "roundRect",
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          radius: parsePxValue(style.borderRadius, 4),
          fill: props._isSelected
            ? ("{color.accent-subtle}" as TokenRef)
            : ("{color.layer-1}" as TokenRef),
        });
      }

      if (description) {
        shapes.push({
          type: "text",
          x: textX,
          y: paddingY + metric.lineHeight / 2,
          text: label,
          fontSize,
          fontFamily:
            (style.fontFamily as string | undefined) ?? fontFamily.sans,
          fontWeight: (style.fontWeight as string | number | undefined) ?? 600,
          fill: textColor,
          align: "left",
          baseline: "middle",
          maxWidth,
          overflow: "ellipsis",
        });
        shapes.push({
          type: "text",
          x: textX,
          y: paddingY + metric.lineHeight + metric.lineHeight / 2,
          text: description,
          fontSize: Math.max(11, fontSize - 1),
          fontFamily:
            (style.fontFamily as string | undefined) ?? fontFamily.sans,
          fontWeight: 400,
          fill: "{color.neutral-subdued}" as TokenRef,
          align: "left",
          baseline: "middle",
          maxWidth,
          overflow: "ellipsis",
        });
        return shapes;
      }

      shapes.push({
        type: "text",
        x: textX,
        y: rowHeight / 2,
        text: label,
        fontSize,
        fontFamily: (style.fontFamily as string | undefined) ?? fontFamily.sans,
        fontWeight: (style.fontWeight as string | number | undefined) ?? 600,
        fill: textColor,
        align: "left",
        baseline: "middle",
        maxWidth,
        overflow: "ellipsis",
      });
      return shapes;
    },
    react: () => ({}),
  },
};

function readText(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return /^\{[^}]+\}$/.test(value) ? null : value;
  }
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * ADR-078 Phase 3: ListBox/ListBoxItem metric 단일 소스 resolver.
 *
 * ListBoxItem renderer와 layout `calculateContentHeight` ListBox 분기가 동일 공식을
 * 사용하도록 공급. `paddingX/paddingY/gap/minHeight` 는 `ListBoxItemSpec.sizes.md` 에서
 * 직접 참조하며, `lineHeight` 은 CSS TokenRef(`{typography.text-sm--line-height}`)와
 * 정합되는 typography 매핑값을 반환한다 (fontSize → CSS var 기본 px).
 *
 * 매핑: xs (≤12) → 16 / sm (≤14) → 20 / base (≤16) → 24 / lg (>16) → 28
 *   → CSS `var(--text-{size}--line-height)` 기본값과 동일 (테마 표준 metric)
 */
export function resolveListBoxItemMetric(fontSize: number): {
  paddingX: number;
  paddingY: number;
  lineHeight: number;
  /** `paddingY * 2 + lineHeight` — Skia shapes/layout 양쪽이 동일 공식으로 소비하는 item height */
  itemHeight: number;
} {
  const sz = ListBoxItemSpec.sizes.md;
  // fontSize 기반 lineHeight 분기: CSS `var(--text-{size}--line-height)` 기본값 매핑.
  // xs(≤12)→16 / sm(≤14)→20 / base(≤16)→24 / lg(>16)→28.
  // sz.lineHeight ({typography.text-sm--line-height}) 는 md 고정 참조 — Spec SSOT 확인용.
  // fontSize 다중 분기가 필요하므로 resolver 내부 하드코딩 유지 (Spec에 fontSize별 lineHeight 미선언).
  // ADR-105-c: @sync 제거 + 현황 문서화. 완전한 Spec 소비는 별도 ADR 대기.
  const lineHeight =
    fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;
  return {
    paddingX: sz.paddingX,
    paddingY: sz.paddingY,
    lineHeight,
    itemHeight: sz.paddingY * 2 + lineHeight,
  };
}
