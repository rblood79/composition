/**
 * NumberField Component Spec
 *
 * React Aria 기반 숫자 입력 컴포넌트 (stepper 버튼 포함)
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * ComboBox 와 유사한 컨테이너/버튼 패턴이나 독립 선언 유지.
 * sizes metric: FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 참조.
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily, getLabelLineHeight } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import {
  Globe,
  DollarSign,
  Type,
  Hash,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Move,
  CheckSquare,
  PointerOff,
  PenOff,
  MousePointerClick,
  FileText,
  Tag,
  Layout,
  AlignLeft,
  HelpCircle,
  Minimize2,
  EyeOff,
} from "lucide-react";

/**
 * NumberField Props
 */
export interface NumberFieldProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  placeholder?: string;
  defaultValue?: number;
  value?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isWheelDisabled?: boolean;
  isQuiet?: boolean;
  hideStepper?: boolean;
  autoFocus?: boolean;
  name?: string;
  form?: string;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  necessityIndicator?: "icon" | "label";
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  contextualHelp?: string;
  validationBehavior?: "native" | "aria";
  children?: string;
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
  _hasChildren?: boolean;
}

/**
 * NumberField Component Spec
 */
export const NumberFieldSpec: ComponentSpec<NumberFieldProps> = {
  name: "NumberField",
  description: "React Aria 기반 숫자 입력 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  // ADR-087 SP3: outer Field container static display 리프팅.
  //   flexDirection 은 labelPosition prop runtime 결정, gap 은 Label↔Wrapper↔FieldError
  //   수직 간격 (implicitStyles 잔존).
  containerStyles: {
    display: "flex",
  },

  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "label",
            type: "string",
            label: "Label",
            icon: Tag,
          },
          {
            key: "value",
            type: "number",
            label: "Value",
            icon: Hash,
          },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: FileText,
          },
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
            key: "isQuiet",
            type: "boolean",
            label: "Quiet",
            icon: Minimize2,
          },
          {
            key: "hideStepper",
            type: "boolean",
            label: "Hide Stepper",
            icon: EyeOff,
          },
        ],
      },
      {
        title: "Locale",
        fields: [
          {
            key: "locale",
            type: "enum",
            label: "Locale",
            icon: Globe,
            emptyToUndefined: true,
            options: [
              { value: "", label: "Auto" },
              { value: "ko-KR", label: "한국어" },
              { value: "en-US", label: "English (US)" },
              { value: "en-GB", label: "English (UK)" },
              { value: "ja-JP", label: "日本語" },
              { value: "zh-CN", label: "中文" },
              { value: "de-DE", label: "Deutsch" },
              { value: "fr-FR", label: "Français" },
            ],
          },
        ],
      },
      {
        title: "Format",
        fields: [
          {
            key: "formatOptions.style",
            type: "enum",
            label: "Format Options",
            icon: DollarSign,
            options: [
              { value: "decimal", label: "Decimal" },
              { value: "currency", label: "Currency" },
              { value: "percent", label: "Percent" },
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
            icon: DollarSign,
            updatePath: ["formatOptions", "currency"],
            visibleWhen: {
              key: "formatOptions.style",
              equals: "currency",
            },
            options: [
              { value: "KRW", label: "KRW (\u20a9)" },
              { value: "USD", label: "USD ($)" },
              { value: "EUR", label: "EUR (\u20ac)" },
              { value: "GBP", label: "GBP (\u00a3)" },
              { value: "JPY", label: "JPY (\u00a5)" },
              { value: "CNY", label: "CNY (\u00a5)" },
              { value: "AUD", label: "AUD ($)" },
              { value: "CAD", label: "CAD ($)" },
            ],
            defaultValue: "KRW",
          },
          {
            key: "formatOptions.unit",
            type: "enum",
            label: "Unit",
            icon: Type,
            updatePath: ["formatOptions", "unit"],
            visibleWhen: {
              key: "formatOptions.style",
              equals: "unit",
            },
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
          {
            key: "formatOptions.notation",
            type: "enum",
            label: "Notation",
            icon: Hash,
            updatePath: ["formatOptions", "notation"],
            options: [
              { value: "standard", label: "Standard" },
              { value: "compact", label: "Compact" },
              { value: "scientific", label: "Scientific" },
              { value: "engineering", label: "Engineering" },
            ],
            defaultValue: "standard",
          },
          {
            key: "formatOptions.minimumFractionDigits",
            type: "number",
            label: "Min Fraction Digits",
            icon: Hash,
            updatePath: ["formatOptions", "minimumFractionDigits"],
          },
          {
            key: "formatOptions.maximumFractionDigits",
            type: "number",
            label: "Max Fraction Digits",
            icon: Hash,
            updatePath: ["formatOptions", "maximumFractionDigits"],
          },
          {
            key: "formatOptions.useGrouping",
            type: "boolean",
            label: "Show Group Separator",
            icon: Hash,
            updatePath: ["formatOptions", "useGrouping"],
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
          {
            key: "isReadOnly",
            type: "boolean",
            label: "Read Only",
            icon: PenOff,
          },
          {
            key: "isInvalid",
            type: "boolean",
            label: "Invalid",
            icon: AlertTriangle,
          },
          {
            key: "isWheelDisabled",
            type: "boolean",
            label: "Wheel Disabled",
            icon: MousePointerClick,
          },

          {
            key: "errorMessage",
            type: "string",
            label: "Error Message",
            icon: AlertTriangle,
          },
          {
            key: "minValue",
            type: "number",
            label: "Min Value",
            icon: ArrowDown,
          },
          {
            key: "maxValue",
            type: "number",
            label: "Max Value",
            icon: ArrowUp,
          },
          {
            key: "step",
            type: "number",
            label: "Step",
            icon: Move,
            defaultValue: 1,
          },
          {
            key: "necessityIndicator",
            type: "enum",
            label: "Required",
            icon: CheckSquare,
            options: [
              { value: "", label: "None" },
              { value: "icon", label: "Icon (*)" },
              { value: "label", label: "Label (required/optional)" },
            ],
            derivedUpdateFn: (value) => {
              if (value === "") {
                return {
                  isRequired: false,
                  necessityIndicator: undefined,
                };
              }

              return {
                isRequired: true,
                necessityIndicator: value as "icon" | "label",
              };
            },
          },
        ],
      },
    ],
  },

  // FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 와 동일 metric. (ADR-105-b)
  sizes: {
    xs: {
      height: 20,
      paddingX: 4,
      paddingY: 1,
      fontSize: "{typography.text-2xs}" as TokenRef,
      borderRadius: "{radius.xs}" as TokenRef,
      iconSize: 10,
      gap: 2,
    },
    sm: {
      height: 22,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 4,
    },
    md: {
      height: 30,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 18,
      gap: 6,
    },
    lg: {
      height: 42,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      iconSize: 22,
      gap: 8,
    },
    xl: {
      height: 54,
      paddingX: 24,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      iconSize: 28,
      gap: 10,
    },
  },

  // ADR-036 Phase 3a: Tier 2 Composite CSS 생성 메타데이터
  // ComboBox composition 과 기본 구조 유사 (flex-column, gap). 독립 선언 유지.
  // disabled 처리: ComboBox(.react-aria-Button)와 달리 NumberField(.react-aria-Group) 기준.
  composition: {
    layout: "flex-column",
    gap: "var(--spacing-xs)",
    containerStyles: {
      color: "var(--fg)",
    },
    containerVariants: {
      disabled: {
        true: {
          nested: [
            {
              selector: ".react-aria-Group",
              styles: {
                background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                "border-color":
                  "color-mix(in srgb, var(--fg) 12%, transparent)",
                opacity: "0.38",
              },
            },
          ],
        },
      },
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns":
              "var(--form-label-width, max-content) minmax(0, 1fr)",
            "column-gap": "var(--form-field-gap, var(--spacing-md))",
            "row-gap": "var(--spacing-xs)",
            "align-items": "start",
            width: "100%",
          },
          nested: [
            {
              selector: "> .react-aria-Label",
              styles: {
                "grid-column": "1",
                "justify-self": "stretch",
                "text-align": "var(--form-label-align, start)",
              },
            },
            {
              selector: "> :not(.react-aria-Label)",
              styles: { "grid-column": "2", "min-width": "0" },
            },
          ],
        },
      },
      quiet: {
        true: {
          nested: [
            {
              selector: ".react-aria-Group",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-radius": "0",
                "border-bottom": "1px solid var(--border)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled])) .react-aria-Group",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-bottom-color": "var(--border-hover)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Button[data-hovered]:not([data-disabled])) .react-aria-Group",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-bottom-color": "var(--border-hover)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Input[data-focused]:not([data-disabled])) .react-aria-Group",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Input[data-focus-within]:not([data-disabled])) .react-aria-Group",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Button[data-focus-visible]:not([data-disabled])) .react-aria-Group",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector: "&[data-invalid] .react-aria-Group",
              styles: {
                "border-color": "transparent",
                "border-bottom-color": "var(--negative)",
              },
            },
          ],
        },
      },
    },
    delegation: [
      {
        childSelector: ".react-aria-Label",
        prefix: "nf-label",
        variables: {
          xs: { "--nf-label-size": "var(--text-2xs)" },
          sm: { "--nf-label-size": "var(--text-xs)" },
          md: { "--nf-label-size": "var(--text-sm)" },
          lg: { "--nf-label-size": "var(--text-base)" },
          xl: { "--nf-label-size": "var(--text-lg)" },
        },
        bridges: {
          "--label-font-size": "var(--nf-label-size)",
          "--label-font-weight": "600",
          "--label-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: ".react-aria-Group",
        prefix: "nf-group",
        bridges: {
          display: "flex",
          "align-items": "center",
          gap: "var(--spacing-xs)",
          width: "100%",
          border: "1px solid var(--border)",
          "border-radius": "var(--border-radius)",
          background: "var(--bg-inset)",
          overflow: "hidden",
          transition: "border-color 200ms ease, background-color 200ms ease",
          padding:
            "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
        },
        states: {
          ":has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled]))":
            {
              "border-color": "var(--border-hover)",
              background: "var(--bg-overlay)",
            },
          ":has(.react-aria-Button[data-hovered]:not([data-disabled]))": {
            "border-color": "var(--border-hover)",
            background: "var(--bg-overlay)",
          },
          ":has(.react-aria-Input[data-focused])": {
            outline: "2px solid var(--accent)",
            "outline-offset": "-1px",
          },
          ":has(.react-aria-Input[data-focus-within])": {
            outline: "2px solid var(--accent)",
            "outline-offset": "-1px",
          },
          ":has(.react-aria-Button[data-focus-visible])": {
            outline: "2px solid var(--accent)",
            "outline-offset": "-1px",
          },
          ":has([data-invalid])": {
            "border-color": "var(--negative)",
          },
        },
      },
      {
        childSelector: ".react-aria-Input",
        prefix: "nf-input",
        variables: {
          xs: {
            "--nf-input-font-size": "var(--text-2xs)",
            "--nf-input-line-height": "var(--text-2xs--line-height)",
          },
          sm: {
            "--nf-input-font-size": "var(--text-xs)",
            "--nf-input-line-height": "var(--text-xs--line-height)",
          },
          md: {
            "--nf-input-font-size": "var(--text-sm)",
            "--nf-input-line-height": "var(--text-sm--line-height)",
          },
          lg: {
            "--nf-input-font-size": "var(--text-base)",
            "--nf-input-line-height": "var(--text-base--line-height)",
          },
          xl: {
            "--nf-input-font-size": "var(--text-lg)",
            "--nf-input-line-height": "var(--text-lg--line-height)",
          },
        },
        bridges: {
          flex: "1 1 auto",
          "min-width": "0",
          border: "none",
          "border-radius": "0",
          background: "transparent",
          outline: "none",
          "forced-color-adjust": "none",
          padding: "0",
          "font-size": "var(--nf-input-font-size)",
          "line-height": "var(--nf-input-line-height)",
          "--input-padding": "0",
          "--input-font-size": "var(--nf-input-font-size)",
          "--input-line-height": "var(--nf-input-line-height)",
        },
      },
      {
        childSelector: ".react-aria-Button",
        prefix: "nf-btn",
        variables: {
          xs: {
            "--nf-btn-size": "10px",
            "--nf-btn-icon-size": "10px",
          },
          sm: {
            "--nf-btn-size": "14px",
            "--nf-btn-icon-size": "12px",
          },
          md: {
            "--nf-btn-size": "18px",
            "--nf-btn-icon-size": "16px",
          },
          lg: {
            "--nf-btn-size": "22px",
            "--nf-btn-icon-size": "18px",
          },
          xl: {
            "--nf-btn-size": "28px",
            "--nf-btn-icon-size": "22px",
          },
        },
        bridges: {
          position: "static",
          flex: "0 0 auto",
          padding: "0",
          border: "none",
          "border-radius": "var(--radius-xs)",
          width: "var(--nf-btn-size)",
          height: "var(--nf-btn-size)",
          "min-width": "unset",
          "min-height": "unset",
          background: "var(--bg-overlay)",
          color: "var(--fg)",
          "forced-color-adjust": "none",
          "box-shadow": "var(--shadow-sm)",
        },
        states: {
          "[data-hovered]:not([data-disabled])": {
            background: "var(--accent-subtle)",
          },
          "[data-pressed]:not([data-disabled])": {
            background: "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
          },
          "[data-focus-visible]": {
            outline: "2px solid var(--accent)",
            "outline-offset": "2px",
          },
          "[data-disabled]": {
            background: "color-mix(in srgb, var(--fg) 12%, transparent)",
            color: "color-mix(in srgb, var(--fg) 38%, transparent)",
            cursor: "not-allowed",
          },
        },
      },
      {
        childSelector: ".react-aria-Button svg",
        bridges: {
          width: "var(--nf-btn-icon-size)",
          height: "var(--nf-btn-icon-size)",
        },
      },
      {
        childSelector: ".react-aria-FieldError",
        prefix: "nf-hint",
        variables: {
          xs: { "--nf-hint-size": "var(--text-2xs)" },
          sm: { "--nf-hint-size": "var(--text-xs)" },
          md: { "--nf-hint-size": "var(--text-xs)" },
          lg: { "--nf-hint-size": "var(--text-sm)" },
          xl: { "--nf-hint-size": "var(--text-base)" },
        },
        bridges: {
          "--error-font-size": "var(--nf-hint-size)",
          "--error-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: '[slot="description"]',
        bridges: {
          "font-size": "var(--nf-hint-size)",
          color: "var(--fg-muted)",
        },
      },
    ],
  },

  propagation: {
    // ADR-912 R1 (2026-06-12): ComboBoxWrapper/Input → Select family 공용 type retype.
    rules: [
      { parentProp: "size", childPath: "Label", override: true },
      { parentProp: "size", childPath: "SelectTrigger", override: true },
      {
        parentProp: "label",
        childPath: "Label",
        childProp: "children",
        override: true,
      },
      {
        parentProp: "placeholder",
        childPath: ["SelectTrigger", "SelectValue"],
        childProp: "placeholder",
        override: true,
      },
    ],
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

  render: {
    shapes: (props, size, state = "default") => {
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 200;
      const btnSize = size.iconSize ?? 18;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius as unknown as number,
      );

      const userBg = props.style?.backgroundColor;
      const bgColor =
        userBg != null && userBg !== "transparent"
          ? userBg
          : state === "hover"
            ? ("{color.layer-1}" as TokenRef)
            : state === "pressed"
              ? ("{color.layer-1}" as TokenRef)
              : ("{color.layer-2}" as TokenRef);

      const borderColor = props.style?.borderColor;

      const defaultBw = props.isInvalid ? 2 : 1;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, defaultBw);

      const fontSize = resolveSpecFontSize(
        props.size ? size.fontSize : (props.style?.fontSize ?? size.fontSize),
        14,
      );

      const labelLineHeight = getLabelLineHeight(fontSize);
      const labelGap = 8;
      const labelOffset = labelLineHeight + labelGap;
      const inputHeight = size.height as number;

      const fwRaw = props.style?.fontWeight;
      const fontWeight =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 500
          : 500;

      const ff = (props.style?.fontFamily as string) || fontFamily.sans;

      const textColor = props.style?.color ?? ("{color.neutral}" as TokenRef);

      const paddingX = parsePxValue(
        props.style?.paddingLeft ??
          props.style?.paddingRight ??
          props.style?.padding,
        size.paddingX,
      );

      // 버튼 간 간격
      const btnGap = 4;

      const shapes: Shape[] = [];
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      const inputY = props.label ? labelOffset : 0;

      if (hasChildren) {
        // Compositional: Label/Group/Button은 자식이 각자 렌더링
        // NumberField 자체는 빈 shapes 반환 (Group에 컨테이너 Spec 없으므로)
        return shapes;
      }

      // Label
      if (props.label) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: 0,
          text: props.label,
          fontSize,
          fontFamily: ff,
          fontWeight,
          fill: textColor,
          align: "left" as const,
          baseline: "top" as const,
        });
      }

      // 컨테이너 배경 (= ComboBox .combobox-container)
      shapes.push({
        id: "container",
        type: "roundRect" as const,
        x: 0,
        y: inputY,
        width,
        height: inputHeight,
        radius: borderRadius,
        fill: bgColor,
      });

      // 컨테이너 테두리
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "container",
          borderWidth,
          color: props.isInvalid
            ? ("{color.negative}" as TokenRef)
            : borderColor,
          radius: borderRadius,
        });
      }

      // 숫자 값 텍스트 (왼쪽 패딩, 세로 중앙)
      const textMaxWidth = width - paddingX * 2 - (btnSize * 2 + btnGap);
      shapes.push({
        type: "text" as const,
        x: paddingX,
        y: inputY + inputHeight / 2,
        text: String(props.value ?? 0),
        fontSize,
        fontFamily: ff,
        fill: textColor,
        align: "center" as const,
        baseline: "middle" as const,
        maxWidth: textMaxWidth,
      });

      // 감소 아이콘 (-) — ComboBox chevron 과 동일한 배경 없이 아이콘만 패턴
      const btn1X = width - paddingX - btnSize * 2 - btnGap + btnSize / 2;
      const btnCenterY = inputY + inputHeight / 2;
      shapes.push({
        type: "icon_font" as const,
        iconName: "minus",
        x: btn1X,
        y: btnCenterY,
        fontSize: btnSize,
        fill: "{color.neutral-subdued}" as TokenRef,
        strokeWidth: 2,
      });

      // 증가 아이콘 (+) — ComboBox chevron 과 동일한 배경 없이 아이콘만 패턴
      const btn2X = width - paddingX - btnSize + btnSize / 2;
      shapes.push({
        type: "icon_font" as const,
        iconName: "plus",
        x: btn2X,
        y: btnCenterY,
        fontSize: btnSize,
        fill: "{color.neutral-subdued}" as TokenRef,
        strokeWidth: 2,
      });

      // 에러 메시지 / 설명
      const descText =
        props.isInvalid && props.errorMessage
          ? props.errorMessage
          : props.description;
      if (descText) {
        shapes.push({
          type: "text" as const,
          x: 0,
          y: inputY + inputHeight + 4,
          text: descText,
          fontSize: fontSize - 2,
          fontFamily: ff,
          fill: props.isInvalid
            ? ("{color.negative}" as TokenRef)
            : ("{color.neutral-subdued}" as TokenRef),
          align: "left" as const,
          baseline: "top" as const,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-invalid": props.isInvalid || undefined,
      "data-disabled": props.isDisabled || undefined,
      "data-required": props.isRequired || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "default",
    }),
  },
};
