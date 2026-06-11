/**
 * DateInput Component Spec
 *
 * DateField/TimeField의 입력 영역 렌더링.
 * background/border/borderRadius + granularity/locale/hourCycle 기반 세그먼트 텍스트.
 * 부모 DateField/TimeField의 props가 DFS에서 주입됨.
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";

export interface DateInputProps {
  variant?: "default" | "accent" | "negative";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** 부모에서 주입 */
  _parentTag?: "DateField" | "TimeField" | "DatePicker" | "DateRangePicker";
  _granularity?: string;
  _hourCycle?: number;
  _locale?: string;
  isDisabled?: boolean;
  style?: Record<string, string | number | undefined>;
}

// Size → input height (componentRulesTable.SelectTrigger.sizes.height 동기 — ADR-912 R1 spec 삭제)
const INPUT_HEIGHT: Record<string, number> = {
  xs: 20,
  sm: 22,
  md: 30,
  lg: 42,
  xl: 54,
};
const INPUT_PADDING_X: Record<string, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
/** Picker용 padding-right = paddingY (비대칭 패턴: right = top) */
const INPUT_PADDING_Y: Record<string, number> = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
};
const INPUT_BORDER_RADIUS: Record<string, number> = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
};

/** locale 기반 날짜 세그먼트 텍스트 생성 */
function buildDateText(
  granularity: string,
  locale: string,
  hourCycle?: number,
): string {
  const isAsian =
    locale.startsWith("ko") ||
    locale.startsWith("ja") ||
    locale.startsWith("zh");
  const isEuropean =
    locale.startsWith("de") ||
    locale.startsWith("fr") ||
    locale.startsWith("es") ||
    locale.startsWith("it") ||
    locale.startsWith("pt") ||
    locale.startsWith("ru");

  let text: string;
  if (isAsian) {
    text = "YYYY / MM / DD";
  } else if (isEuropean) {
    text = "DD / MM / YYYY";
  } else {
    text = "MM / DD / YYYY";
  }

  if (
    granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second"
  ) {
    if (hourCycle === 12) {
      text += "  HH : MM";
      if (granularity === "second") text += " : SS";
      text += "  AM";
    } else {
      text += "  HH : MM";
      if (granularity === "second") text += " : SS";
    }
  }

  return text;
}

/** 시간 세그먼트 텍스트 생성 */
function buildTimeText(granularity: string, hourCycle?: number): string {
  let text: string;
  if (hourCycle === 12) {
    text = "HH : MM";
    if (granularity === "second") text += " : SS";
    text += "  AM";
  } else {
    text = "HH : MM";
    if (granularity === "second") text += " : SS";
  }
  return text;
}

export const DateInputSpec: ComponentSpec<DateInputProps> = {
  name: "DateInput",
  description: "DateField/TimeField 입력 영역 (bg/border + 세그먼트 텍스트)",
  element: "div",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-2}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
      borderHover: "{color.border-hover}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-2}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      borderHover: "{color.accent-hover}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.layer-2}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-2}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.negative}" as TokenRef,
      borderHover: "{color.negative-hover}" as TokenRef,
    },
  },

  sizes: {
    xs: {
      height: 20,
      paddingX: 4,
      paddingY: 1,
      fontSize: "{typography.text-2xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      gap: 0,
    },
    sm: {
      height: 22,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 30,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 42,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 0,
    },
    xl: {
      height: 54,
      paddingX: 24,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: { opacity: 0.38 },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    shapes: (props, _size, state = "default") => {
      const variant =
        DateInputSpec.variants![
          (props as { variant?: keyof typeof DateInputSpec.variants })
            .variant ?? DateInputSpec.defaultVariant!
        ];
      const extra = props as Record<string, unknown>;
      const sizeName = (extra.size as string) || "md";
      const parentTag = (extra._parentTag as string) || "DateField";
      const granularity =
        (extra._granularity as string) ||
        (parentTag === "TimeField" ? "minute" : "day");
      const hourCycle = extra._hourCycle as number | undefined;
      const locale = (extra._locale as string) || "en-US";

      const inputHeight = INPUT_HEIGHT[sizeName] ?? INPUT_HEIGHT.md;
      const paddingX = INPUT_PADDING_X[sizeName] ?? INPUT_PADDING_X.md;

      // fontSize: Spec sizes의 TokenRef를 resolveSpecFontSize()로 숫자 변환 (단일 소스)
      const sizeEntry =
        DateInputSpec.sizes[sizeName as keyof typeof DateInputSpec.sizes];
      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? sizeEntry?.fontSize,
        14,
      );
      const borderRadius =
        INPUT_BORDER_RADIUS[sizeName] ?? INPUT_BORDER_RADIUS.md;
      const containerWidth =
        (extra._containerWidth as number) ||
        (props.style?.width as number) ||
        200;

      const borderColor =
        props.style?.borderColor ??
        (state === "hover" && variant.borderHover
          ? variant.borderHover
          : variant.border);
      const fill = resolveFillTokens(variant);
      const bgColor = props.style?.backgroundColor ?? fill.default.base;
      const textColor = props.style?.color ?? variant.text;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;

      const isPickerInput =
        parentTag === "DatePicker" || parentTag === "DateRangePicker";

      const displayText =
        parentTag === "TimeField"
          ? buildTimeText(granularity, hourCycle)
          : parentTag === "DateRangePicker"
            ? buildDateText("day", locale) +
              " – " +
              buildDateText("day", locale)
            : buildDateText(granularity, locale, hourCycle);

      // Picker: 우측 캘린더 아이콘 영역 (padding-right = paddingY 패턴)
      const padRight = isPickerInput
        ? (INPUT_PADDING_Y[sizeName] ?? INPUT_PADDING_Y.md)
        : paddingX;
      const iconSz = isPickerInput
        ? ({ xs: 10, sm: 14, md: 16, lg: 20, xl: 22 }[sizeName] ?? 16)
        : 0;
      const gap = isPickerInput ? 4 : 0;

      const shapes: Shape[] = [
        {
          id: "input-bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: containerWidth,
          height: inputHeight,
          radius: borderRadius,
          fill: bgColor,
        },
        {
          type: "border" as const,
          target: "input-bg",
          borderWidth: 1,
          color: borderColor ?? ("{color.border}" as TokenRef),
          radius: borderRadius,
        },
        {
          type: "text" as const,
          x: paddingX,
          y: 0,
          text: displayText,
          fontSize,
          fontFamily: ff,
          fontWeight: 400,
          fill: textColor,
          align: "left" as const,
          baseline: "middle" as const,
          maxWidth: isPickerInput
            ? containerWidth - paddingX - iconSz - gap - padRight
            : undefined,
        },
      ];

      // Picker: 캘린더 아이콘
      if (isPickerInput) {
        const btnX = containerWidth - padRight - iconSz / 2 - 4;
        shapes.push({
          type: "icon_font" as const,
          iconName: "calendar",
          x: btnX,
          y: inputHeight / 2,
          fontSize: iconSz,
          fill: "{color.neutral-subdued}" as TokenRef,
          strokeWidth: 2,
        });
      }

      return shapes;
    },

    react: () => ({}),
    pixi: () => ({ eventMode: "static" as const, cursor: "text" }),
  },
};
