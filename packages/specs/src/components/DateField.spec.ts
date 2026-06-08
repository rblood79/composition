/**
 * DateField Component Spec
 *
 * 투명 column 컨테이너. _hasChildren일 때 빈 shapes 반환.
 * 실제 입력 영역은 자식 DateInput Spec이 렌더링.
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import {
  Layout,
  Globe,
  Clock,
  Hash,
  EyeOff,
  AlertTriangle,
  PointerOff,
  PenOff,
  CheckSquare,
  Tag,
  FileText,
  HelpCircle,
  Minimize2,
} from "lucide-react";

export interface DateFieldProps {
  size?: "sm" | "md" | "lg" | "xl";
  isQuiet?: boolean;
  label?: string;
  granularity?: "day" | "hour" | "minute" | "second";
  hourCycle?: 12 | 24;
  locale?: string;
  calendar?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  labelPosition?: "top" | "side";
  contextualHelp?: string;
  name?: string;
  style?: Record<string, string | number | undefined>;
}

export const DateFieldSpec: ComponentSpec<DateFieldProps> = {
  name: "DateField",
  description: "투명 column 컨테이너 — DateInput이 입력 영역 렌더링",
  element: "div",
  skipCSSGeneration: false,

  // ADR-087 SP3: outer Field container static display 리프팅.
  //   flexDirection 은 labelPosition prop runtime 결정 (implicitStyles 잔존).
  containerStyles: {
    display: "flex",
  },

  defaultSize: "md",

  // ADR-086 P1: height 가 SPEC_TRIGGER_HEIGHT Record 값과 일치 (22/30/42/54).
  //   P2 에서 implicitStyles 의 Record 가 제거되고 본 spec.sizes.height 를 직접 소비.
  // ADR-091 Addendum 2: intrinsicHeight (전체 = Label + gap + DateInput) 선언.
  //   utils.ts:2011 dfHeights Record { sm:32, md:40, lg:48 } 해체 대응. xl 은 기존
  //   Record 에 없어 54 + 2 * (default Label height 추정) 대신 62 선언 (스케일 보존).
  sizes: {
    sm: {
      height: 22,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 4,
      intrinsicHeight: 32,
    },
    md: {
      height: 30,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 6,
      intrinsicHeight: 40,
    },
    lg: {
      height: 42,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 8,
      intrinsicHeight: 48,
    },
    xl: {
      height: 54,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 10,
      intrinsicHeight: 62,
    },
  },

  // ADR-059 v2 Pre-Phase 0-B: Composite delegation SSOT 선언
  composition: {
    layout: "flex-column",
    gap: "var(--spacing-xs)",
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
      quiet: {
        true: {
          nested: [
            {
              selector: ".react-aria-DateInput",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "box-shadow": "none",
                "border-radius": "0",
                "border-bottom": "1px solid var(--border)",
              },
            },
            {
              selector: ".react-aria-DateInput:where([data-focused])",
              styles: {
                outline: "none",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector: ".react-aria-DateInput:where([data-invalid])",
              styles: { "border-bottom-color": "var(--negative)" },
            },
          ],
        },
      },
    },
    delegation: [
      {
        childSelector: ".react-aria-Label",
        prefix: "df-label",
        variables: {
          xs: { "--df-label-size": "var(--text-2xs)" },
          sm: { "--df-label-size": "var(--text-xs)" },
          md: { "--df-label-size": "var(--text-sm)" },
          lg: { "--df-label-size": "var(--text-base)" },
          xl: { "--df-label-size": "var(--text-lg)" },
        },
        bridges: {
          "--label-font-size": "var(--df-label-size)",
          "--label-font-weight": "600",
          "--label-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: ".react-aria-DateInput",
        prefix: "df-input",
        variables: {
          xs: {
            "--df-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
            "--df-input-size": "var(--text-2xs)",
            "--df-input-line-height": "var(--text-2xs--line-height)",
            "--df-input-min-width": "100px",
          },
          sm: {
            "--df-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
            "--df-input-size": "var(--text-xs)",
            "--df-input-line-height": "var(--text-xs--line-height)",
            "--df-input-min-width": "120px",
          },
          md: {
            "--df-input-padding": "var(--spacing-xs) var(--spacing-md)",
            "--df-input-size": "var(--text-sm)",
            "--df-input-line-height": "var(--text-sm--line-height)",
            "--df-input-min-width": "150px",
          },
          lg: {
            "--df-input-padding": "var(--spacing-sm) var(--spacing-lg)",
            "--df-input-size": "var(--text-base)",
            "--df-input-line-height": "var(--text-base--line-height)",
            "--df-input-min-width": "180px",
          },
          xl: {
            "--df-input-padding": "var(--spacing-md) var(--spacing-xl)",
            "--df-input-size": "var(--text-lg)",
            "--df-input-line-height": "var(--text-lg--line-height)",
            "--df-input-min-width": "220px",
          },
        },
        bridges: {
          display: "inline-flex",
          padding: "var(--df-input-padding)",
          border: "1px solid",
          "border-radius": "var(--border-radius)",
          width: "100%",
          "min-width": "var(--df-input-min-width)",
          "white-space": "nowrap",
          "forced-color-adjust": "none",
          "font-size": "var(--df-input-size)",
          "line-height": "var(--df-input-line-height)",
          transition: "border-color 200ms ease, background-color 200ms ease",
        },
      },
      {
        childSelector: ".react-aria-DateSegment",
        prefix: "df-segment",
        variables: {
          xs: { "--df-segment-size": "var(--text-2xs)" },
          sm: { "--df-segment-size": "var(--text-xs)" },
          md: { "--df-segment-size": "var(--text-sm)" },
          lg: { "--df-segment-size": "var(--text-base)" },
          xl: { "--df-segment-size": "var(--text-lg)" },
        },
        bridges: {
          padding: "0 2px",
          border: "none",
          background: "transparent",
          height: "auto",
          "font-variant-numeric": "tabular-nums",
          "text-align": "end",
          color: "var(--fg)",
          "border-radius": "var(--radius-xs)",
          "font-size": "var(--df-segment-size)",
          transition: "all 150ms ease",
        },
        states: {
          '[data-type="literal"]': { padding: "0" },
          "[data-placeholder]": {
            color: "var(--fg-muted)",
            "font-style": "italic",
            opacity: "0.6",
          },
          ":focus": {
            color: "var(--fg)",
            background: "var(--accent-subtle)",
            outline: "none",
            "border-radius": "var(--radius-xs)",
            "caret-color": "transparent",
          },
          "[data-invalid]": { color: "var(--negative)" },
          "[data-invalid]:focus": {
            background: "color-mix(in srgb, var(--negative) 15%, transparent)",
            color: "var(--negative)",
          },
          "[data-disabled]": {
            color: "color-mix(in srgb, var(--fg) 38%, transparent)",
            cursor: "not-allowed",
          },
        },
      },
      {
        childSelector: ".react-aria-FieldError",
        prefix: "df-hint",
        variables: {
          xs: { "--df-hint-size": "var(--text-2xs)" },
          sm: { "--df-hint-size": "var(--text-xs)" },
          md: { "--df-hint-size": "var(--text-xs)" },
          lg: { "--df-hint-size": "var(--text-sm)" },
          xl: { "--df-hint-size": "var(--text-base)" },
        },
        bridges: {
          "--error-font-size": "var(--df-hint-size)",
          "--error-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: '[slot="description"]',
        bridges: {
          "font-size": "var(--df-hint-size)",
          color: "var(--fg-muted)",
        },
      },
    ],
  },

  propagation: {
    rules: [
      { parentProp: "size", childPath: "Label", override: true },
      { parentProp: "size", childPath: "DateInput", override: true },
      {
        parentProp: "label",
        childPath: "Label",
        childProp: "children",
        override: true,
      },
    ],
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "label", type: "string", label: "Label", icon: Tag },
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
            key: "granularity",
            type: "enum",
            label: "Granularity",
            icon: Clock,
            emptyToUndefined: true,
            options: [
              { value: "", label: "Day" },
              { value: "hour", label: "Hour" },
              { value: "minute", label: "Minute" },
              { value: "second", label: "Second" },
            ],
          },
          {
            key: "hourCycle",
            type: "enum",
            label: "Hour Cycle",
            icon: Clock,
            emptyToUndefined: true,
            valueTransform: "number",
            options: [
              { value: "", label: "Auto" },
              { value: "12", label: "12 Hour" },
              { value: "24", label: "24 Hour" },
            ],
          },
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
            key: "isQuiet",
            type: "boolean",
            label: "Quiet",
            icon: Minimize2,
          },
          {
            key: "hideTimeZone",
            type: "boolean",
            label: "Hide Timezone",
            icon: EyeOff,
          },
          {
            key: "shouldForceLeadingZeros",
            type: "boolean",
            label: "Force Leading Zeros",
            icon: Hash,
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
              { value: "en-US", label: "English (US)" },
              { value: "en-GB", label: "English (UK)" },
              { value: "ko-KR", label: "한국어" },
              { value: "ja-JP", label: "日本語" },
              { value: "zh-CN", label: "中文" },
              { value: "de-DE", label: "Deutsch" },
              { value: "fr-FR", label: "Français" },
            ],
          },
          {
            key: "calendarSystem",
            type: "enum",
            label: "Calendar System",
            icon: Globe,
            emptyToUndefined: true,
            options: [
              { value: "", label: "Default" },
              { value: "gregory", label: "Gregorian" },
              { value: "japanese", label: "Japanese" },
              { value: "buddhist", label: "Buddhist" },
              { value: "hebrew", label: "Hebrew" },
            ],
          },
        ],
      },
      {
        title: "State",
        fields: [
          { key: "minValue", type: "string", label: "Min Value", icon: Hash },
          { key: "maxValue", type: "string", label: "Max Value", icon: Hash },
          {
            key: "necessityIndicator",
            type: "enum",
            label: "Required",
            icon: CheckSquare,
            emptyToUndefined: true,
            options: [
              { value: "", label: "None" },
              { value: "icon", label: "Icon (*)" },
              { value: "label", label: "Label (required/optional)" },
            ],
            derivedUpdateFn: (value) => {
              if (value === undefined || value === "") {
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
          { key: "isInvalid", type: "boolean", icon: AlertTriangle },
          { key: "isDisabled", type: "boolean", icon: PointerOff },
          { key: "isReadOnly", type: "boolean", icon: PenOff },
        ],
      },
    ],
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
    shapes: () => {
      // 투명 컨테이너 — 자식(Label, DateInput, FieldError)이 개별 렌더링
      return [] as Shape[];
    },

    react: (props) => ({
      "aria-invalid": props.isInvalid || undefined,
      "data-disabled": props.isDisabled || undefined,
      role: "group",
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
      cursor: props.isDisabled ? "not-allowed" : "text",
    }),
  },
};
