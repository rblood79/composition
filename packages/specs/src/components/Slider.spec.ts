/**
 * Slider Component Spec
 *
 * React Aria 기반 슬라이더 컴포넌트 (트랙 + 썸 + 채우기)
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import { measureSpecTextWidth } from "../renderers/utils/measureText";
import {
  Layout,
  Type,
  Hash,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Move,
  PointerOff,
  PenOff,
  AlignLeft,
  Sparkles,
  HelpCircle,
  Layers,
  SlidersHorizontal,
} from "lucide-react";

/**
 * Slider Props
 */
export interface SliderProps {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  name?: string;
  defaultValue?: number | number[];
  /** 단일 값 또는 범위 값 (React Aria Slider<number | number[]> 패턴) */
  value?: number | number[];
  minValue?: number;
  maxValue?: number;
  step?: number;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  form?: string;
  orientation?: "horizontal" | "vertical";
  autoFocus?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  isEmphasized?: boolean;
  isFilled?: boolean;
  fillOffset?: number;
  trackGradient?: string[];
  showValueLabel?: boolean;
  contextualHelp?: string;
  children?: string;
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
}

/** variant별 채우기/핸들 색상 */
export const SLIDER_FILL_COLORS: Record<
  string,
  { fill: TokenRef; handle: TokenRef }
> = {
  default: {
    fill: "{color.accent}" as TokenRef,
    handle: "{color.accent}" as TokenRef,
  },
  accent: {
    fill: "{color.accent}" as TokenRef,
    handle: "{color.accent}" as TokenRef,
  },
  neutral: {
    fill: "{color.neutral-subdued}" as TokenRef,
    handle: "{color.neutral-subdued}" as TokenRef,
  },
};

/**
 * Slider Component Spec
 */
export const SliderSpec: ComponentSpec<SliderProps> = {
  name: "Slider",
  description: "React Aria 기반 슬라이더 컴포넌트",
  archetype: "slider",
  skipCSSGeneration: false,
  element: "div",

  // ADR-083 Phase 5: slider archetype base 의 layout primitive 1 필드 리프팅.
  //   box-sizing 은 ContainerStylesSchema 미지원 → archetype table 잔존.
  // ADR-912 후속(2026-06-09): ProgressBar/Meter 와 동일 grid 구조 (RAC/RSP 레퍼런스 정합).
  //   resolveContainerStylesFallback 경유로 Skia/Taffy parentStyle 에 선주입 — Skia layout
  //   에서 SliderOutput 우상단 배치 (1fr auto / "label output" "track track"). CSS 경로는
  //   slider archetype base 가 동일 grid-template + 자식 grid-area selector emit.
  containerStyles: {
    display: "grid",
    gridTemplateAreas: '"label output" "track track"',
    gridTemplateColumns: "1fr auto",
  },

  defaultSize: "md",

  // ADR-086 P1 (Rev 4 명시): lineHeight 추가 (SIZE_LINE_HEIGHT Record 와 일치 — 16/20/24/28).
  //   SliderOutput 이 SIZE_LINE_HEIGHT 를 소비 → P2 에서 implicitStyles Record 제거 후
  //   `SliderSpec.sizes[size].lineHeight` 직접 소비.
  //   `gap` 은 Slider.spec.render 내부 `offsetY = fontSize + gap` (row-gap) 에서 소비.
  // ADR-088: `columnGap` 필드 신규 — Label↔SliderOutput 사이 column-gap. ADR-086 Addendum 1
  //   의 `SLIDER_COL_GAP` Record 16/16/20/20 을 spec SSOT 로 이관. Preview CSS 는 CSSGenerator
  //   가 `column-gap` emit 으로 `gap` shorthand 를 override.
  sizes: {
    sm: {
      height: 4,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      lineHeight: "{typography.text-xs--line-height}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 4,
      columnGap: 16,
      indicator: { trackHeight: 4, thumbSize: 14 },
    },
    md: {
      height: 8,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 4,
      columnGap: 16,
      indicator: { trackHeight: 8, thumbSize: 18 },
    },
    lg: {
      height: 12,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      lineHeight: "{typography.text-base--line-height}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 4,
      columnGap: 20,
      indicator: { trackHeight: 12, thumbSize: 22 },
    },
    xl: {
      height: 16,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      lineHeight: "{typography.text-lg--line-height}" as TokenRef,
      borderRadius: "{radius.full}" as TokenRef,
      gap: 4,
      columnGap: 20,
      indicator: { trackHeight: 16, thumbSize: 26 },
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  propagation: {
    rules: [
      { parentProp: "size", childPath: "SliderTrack", override: true },
      { parentProp: "size", childPath: "SliderOutput", override: true },
      // SliderThumb 은 Slider 의 손자(Slider → SliderTrack → SliderThumb)이므로
      // string childPath(직계 자식 매칭)는 DEAD — 배열 childPath 로 손자 경로 명시.
      // Why: string 경로면 propagation 이 SliderThumb store 에 size 를 영영 기록 못 함
      //   → props.size undefined → 증분 sync(detectChangedIds)가 SliderThumb 참조 불변으로
      //   판정하여 rebuild 누락(Slider 가 SYNTHETIC_CHILD_PROP_MERGE_TAGS 비포함). Slider size
      //   변경 시 SliderThumb Skia 노드가 stale → thumb x,y 어긋남(특히 S→M: factory baked
      //   style.width:18=md thumbSize 와 우연 충돌하던 마스킹이 stale 창에서 노출). 배열 경로는
      //   Select `["SelectTrigger","SelectValue"]` 와 동형 — propagationEngine 단계별 순회 지원.
      {
        parentProp: "size",
        childPath: ["SliderTrack", "SliderThumb"],
        override: true,
      },
      { parentProp: "size", childPath: "Label", override: true },
      {
        parentProp: "label",
        childPath: "Label",
        childProp: "children",
        override: true,
      },
      { parentProp: "value", childPath: "SliderTrack", override: true },
      { parentProp: "minValue", childPath: "SliderTrack", override: true },
      { parentProp: "maxValue", childPath: "SliderTrack", override: true },
    ],
  },

  // ADR-912 후속(2026-06-09): size 변경 시 Label/SliderOutput text 크기 동기화.
  //   증상: DOM(Preview/Publish)에서 Slider size 변경 시 Label/Output 이 14px 고정
  //   (ProgressBar 는 정상). root cause — Slider 컨테이너에 [data-size] font-size 는 있으나
  //   (1) Label 은 LabelSpec CSS `font-size: var(--label-font-size, var(--text-sm))` 의
  //   fallback 14px 으로 고정(Slider 가 --label-font-size 미정의), (2) SliderOutput 은
  //   data-size 속성 미전파로 SliderOutput.css 의 [data-size] 규칙 미매칭 → base 14px 고정.
  //   해법: sizeSelectors 로 컨테이너 [data-size] 기반 자식 selector font-size 직접 명시
  //   (ProgressBar.sizeSelectors `.value` 동형). Skia 는 implicitStyles fontSize 주입으로
  //   이미 정상 — 본 수정은 DOM↔Skia 대칭 복원. compositionOwnsContainerBox 는 layout/
  //   containerStyles/containerVariants 미선언으로 false → 컨테이너 박스 CSS 영향 0.
  composition: {
    sizeSelectors: {
      sm: {
        ".react-aria-Label": { "font-size": "var(--text-xs)" },
        ".react-aria-SliderOutput": { "font-size": "var(--text-xs)" },
      },
      md: {
        ".react-aria-Label": { "font-size": "var(--text-sm)" },
        ".react-aria-SliderOutput": { "font-size": "var(--text-sm)" },
      },
      lg: {
        ".react-aria-Label": { "font-size": "var(--text-base)" },
        ".react-aria-SliderOutput": { "font-size": "var(--text-base)" },
      },
      xl: {
        ".react-aria-Label": { "font-size": "var(--text-lg)" },
        ".react-aria-SliderOutput": { "font-size": "var(--text-lg)" },
      },
    },
    delegation: [],
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "label", type: "string", label: "Label", icon: Type },
          {
            key: "contextualHelp",
            type: "string",
            label: "Contextual Help",
            icon: HelpCircle,
            emptyToUndefined: true,
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          { type: "size" },
          {
            key: "labelPosition",
            type: "enum",
            label: "Label Position",
            icon: Layout,
            options: [
              { value: "top", label: "Top" },
              { value: "side", label: "Side" },
            ],
            defaultValue: "top",
          },
          {
            key: "labelAlign",
            type: "enum",
            label: "Label Align",
            icon: AlignLeft,
            options: [
              { value: "start", label: "Start" },
              { value: "end", label: "End" },
            ],
            defaultValue: "start",
          },
          {
            key: "orientation",
            type: "enum",
            label: "Orientation",
            icon: ArrowLeftRight,
            options: [
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
            ],
            defaultValue: "horizontal",
          },
          {
            key: "isEmphasized",
            type: "boolean",
            label: "Emphasized",
            icon: Sparkles,
          },
          {
            key: "isFilled",
            type: "boolean",
            label: "Filled",
            icon: Layers,
          },
          {
            key: "fillOffset",
            type: "number",
            label: "Fill Offset",
            icon: SlidersHorizontal,
            step: 1,
          },
        ],
      },
      {
        title: "Locale",
        fields: [
          {
            key: "formatOptions.style",
            type: "enum",
            label: "Format Options",
            icon: Hash,
            options: [
              { value: "decimal", label: "Decimal" },
              { value: "percent", label: "Percent" },
              { value: "currency", label: "Currency" },
              { value: "unit", label: "Unit" },
            ],
            defaultValue: "decimal",
            derivedUpdateFn: (
              value: unknown,
              props: Record<string, unknown>,
            ) => {
              const prev =
                (props.formatOptions as Record<string, unknown>) ?? {};
              const base: Record<string, unknown> = { ...prev, style: value };
              if (value === "currency" && !prev.currency) base.currency = "KRW";
              if (value === "unit" && !prev.unit) base.unit = "kilometer";
              return { formatOptions: base };
            },
          },
          {
            key: "formatOptions.currency",
            type: "enum",
            label: "Currency",
            icon: Hash,
            updatePath: ["formatOptions", "currency"],
            visibleWhen: { key: "formatOptions.style", equals: "currency" },
            options: [
              { value: "KRW", label: "KRW (₩)" },
              { value: "USD", label: "USD ($)" },
              { value: "EUR", label: "EUR (€)" },
              { value: "GBP", label: "GBP (£)" },
              { value: "JPY", label: "JPY (¥)" },
            ],
            defaultValue: "KRW",
          },
          {
            key: "formatOptions.unit",
            type: "enum",
            label: "Unit",
            icon: Type,
            updatePath: ["formatOptions", "unit"],
            visibleWhen: { key: "formatOptions.style", equals: "unit" },
            options: [
              { value: "kilometer", label: "Kilometer (km)" },
              { value: "meter", label: "Meter (m)" },
              { value: "centimeter", label: "Centimeter (cm)" },
              { value: "millimeter", label: "Millimeter (mm)" },
              { value: "mile", label: "Mile (mi)" },
              { value: "kilogram", label: "Kilogram (kg)" },
              { value: "gram", label: "Gram (g)" },
              { value: "pound", label: "Pound (lb)" },
              { value: "celsius", label: "Celsius (°C)" },
              { value: "fahrenheit", label: "Fahrenheit (°F)" },
              { value: "liter", label: "Liter (L)" },
              { value: "milliliter", label: "Milliliter (mL)" },
              { value: "byte", label: "Byte (B)" },
              { value: "kilobyte", label: "Kilobyte (KB)" },
              { value: "megabyte", label: "Megabyte (MB)" },
              { value: "gigabyte", label: "Gigabyte (GB)" },
              { value: "second", label: "Second (s)" },
              { value: "minute", label: "Minute (min)" },
              { value: "hour", label: "Hour (h)" },
              { value: "day", label: "Day" },
              { value: "percent", label: "Percent (%)" },
            ],
            defaultValue: "kilometer",
          },
        ],
      },
      {
        title: "Range",
        fields: [
          {
            key: "minValue",
            type: "number",
            label: "Min Value",
            icon: ArrowDown,
            defaultValue: 0,
          },
          {
            key: "maxValue",
            type: "number",
            label: "Max Value",
            icon: ArrowUp,
            defaultValue: 100,
          },
          {
            key: "step",
            type: "number",
            label: "Step",
            icon: Move,
            defaultValue: 1,
          },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          {
            key: "isReadOnly",
            type: "boolean",
            label: "Read Only",
            icon: PenOff,
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, _state = "default") => {
      const variantName = "default";
      const sliderDims = {
        trackHeight: size.indicator?.trackHeight ?? 8,
        thumbSize: size.indicator?.thumbSize ?? 18,
      };
      const fillColors =
        SLIDER_FILL_COLORS[variantName] ?? SLIDER_FILL_COLORS.default;
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 200;
      const gap = size.gap ?? 10;

      const min = props.minValue ?? 0;
      const max = props.maxValue ?? 100;
      const rawValue = props.value ?? 50;
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const isRange = values.length >= 2;
      const percents = values.map((v) =>
        Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)),
      );
      const trackY = sliderDims.thumbSize / 2 - sliderDims.trackHeight / 2;
      const trackRadius = sliderDims.trackHeight / 2;

      // 트랙 배경: CSS var(--bg-muted) = {color.neutral-subtle} 통일
      const trackBgColor =
        props.style?.backgroundColor ?? ("{color.neutral-subtle}" as TokenRef);
      const textColor = props.style?.color ?? ("{color.neutral}" as TokenRef);
      const fwRaw = props.style?.fontWeight;
      const fw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 500
          : 500;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;

      // Propagation은 size prop만 변경하므로 props.size 있으면 size.fontSize 우선
      const numericFontSize = resolveSpecFontSize(
        props.size ? size.fontSize : (props.style?.fontSize ?? size.fontSize),
        14,
      );

      const shapes: Shape[] = [];
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

      // 라벨 + 값 행 (자식 Element가 있으면 자식 TextSprite가 렌더링하므로 스킵)
      // S2: SliderOutput은 항상 표시됨
      if (!hasChildren) {
        const formatSingleValue = (v: number): string => {
          if (props.formatOptions) {
            try {
              return new Intl.NumberFormat(
                props.locale,
                props.formatOptions,
              ).format(v);
            } catch {
              return String(v);
            }
          }
          return String(v);
        };
        const valueText = isRange
          ? values.map(formatSingleValue).join(" – ")
          : formatSingleValue(values[0]);
        // ADR-051: 실측 기반 value 텍스트 폭 (추정값 제거)
        const measuredValueWidth =
          measureSpecTextWidth(valueText, numericFontSize, ff) + 4;

        if (props.label) {
          shapes.push({
            type: "text" as const,
            x: 0,
            y: 0,
            text: props.label,
            fontSize: numericFontSize,
            fontFamily: ff,
            fontWeight: fw,
            fill: textColor,
            align: "left" as const,
            baseline: "top" as const,
            maxWidth: width - measuredValueWidth,
          });
        }
        shapes.push({
          type: "text" as const,
          x: 0,
          y: 0,
          text: valueText,
          fontSize: numericFontSize,
          fontFamily: ff,
          fill: textColor,
          align: "right" as const,
          baseline: "top" as const,
          maxWidth: width,
        });
      }

      // 자식 Element(SliderTrack, SliderThumb 등)가 있으면
      // 트랙/fill/thumb은 자식 Spec shapes가 담당 → 부모에서 스킵
      if (!hasChildren) {
        // S2: SliderOutput은 항상 표시되므로 항상 텍스트 행 높이 확보
        const offsetY = numericFontSize + gap;

        shapes.push({
          id: "track",
          type: "roundRect" as const,
          x: 0,
          y: offsetY + trackY,
          width,
          height: sliderDims.trackHeight,
          radius: trackRadius,
          fill: trackBgColor,
        });

        // 채우기 (single: 0~value, range: value[0]~value[1])
        if (isRange) {
          const fillStartX = (width * percents[0]) / 100;
          const fillEndX = (width * percents[1]) / 100;
          const fillW = fillEndX - fillStartX;
          if (fillW > 0) {
            shapes.push({
              id: "fill",
              type: "roundRect" as const,
              x: fillStartX,
              y: offsetY + trackY,
              width: fillW,
              height: sliderDims.trackHeight,
              radius: trackRadius,
              fill: fillColors.fill,
            });
          }
        } else {
          const fillWidth = (width * percents[0]) / 100;
          if (fillWidth > 0) {
            shapes.push({
              id: "fill",
              type: "roundRect" as const,
              x: 0,
              y: offsetY + trackY,
              width: fillWidth,
              height: sliderDims.trackHeight,
              radius: trackRadius,
              fill: fillColors.fill,
            });
          }
        }

        // 썸 (핸들) — single: 1개, range: 2개
        for (let i = 0; i < percents.length; i++) {
          const thumbX = (width * percents[i]) / 100;
          const thumbId = percents.length === 1 ? "thumb" : `thumb-${i}`;
          shapes.push({
            id: thumbId,
            type: "circle" as const,
            x: thumbX,
            y: offsetY + sliderDims.thumbSize / 2,
            radius: sliderDims.thumbSize / 2,
            fill: fillColors.handle,
          });
          shapes.push({
            type: "border" as const,
            target: thumbId,
            borderWidth: 2,
            color: "{color.base}" as TokenRef,
            radius: sliderDims.thumbSize / 2,
          });
        }
      }

      return shapes;
    },

    react: (props) => ({
      "data-disabled": props.isDisabled || undefined,
      role: Array.isArray(props.value) ? "group" : "slider",
      "aria-valuemin": Array.isArray(props.value)
        ? undefined
        : (props.minValue ?? 0),
      "aria-valuemax": Array.isArray(props.value)
        ? undefined
        : (props.maxValue ?? 100),
      "aria-valuenow": Array.isArray(props.value)
        ? undefined
        : ((props.value as number) ?? 50),
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "pointer",
    }),
  },
};
