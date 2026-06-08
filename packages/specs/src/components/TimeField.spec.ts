/**
 * TimeField Component Spec
 *
 * 투명 column 컨테이너. 실제 입력 영역은 자식 DateInput Spec이 렌더링.
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import {
  Layout,
  Clock,
  Hash,
  EyeOff,
  AlertTriangle,
  PointerOff,
  PenOff,
  CheckSquare,
  HelpCircle,
  FileText,
  Minimize2,
} from "lucide-react";

export interface TimeFieldProps {
  size?: "sm" | "md" | "lg" | "xl";
  isQuiet?: boolean;
  label?: string;
  description?: string;
  errorMessage?: string;
  granularity?: "hour" | "minute" | "second";
  hourCycle?: 12 | 24;
  locale?: string;
  name?: string;
  form?: string;
  defaultValue?: string;
  placeholderValue?: string;
  value?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  contextualHelp?: string;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  style?: Record<string, string | number | undefined>;
}

export const TimeFieldSpec: ComponentSpec<TimeFieldProps> = {
  name: "TimeField",
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
  sizes: {
    sm: {
      height: 22,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 4,
    },
    md: {
      height: 30,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 6,
    },
    lg: {
      height: 42,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 8,
    },
    xl: {
      height: 54,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xl}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 10,
    },
  },

  // ADR-059 v2 Pre-Phase 0-B: Composite delegation SSOT 선언
  // 주의: prefix는 `time-field-*` (TextField `tf-*` 와 충돌 차단)
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
        prefix: "time-field-label",
        variables: {
          xs: { "--time-field-label-size": "var(--text-2xs)" },
          sm: { "--time-field-label-size": "var(--text-xs)" },
          md: { "--time-field-label-size": "var(--text-sm)" },
          lg: { "--time-field-label-size": "var(--text-base)" },
          xl: { "--time-field-label-size": "var(--text-lg)" },
        },
        bridges: {
          "--label-font-size": "var(--time-field-label-size)",
          "--label-font-weight": "600",
          "--label-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: ".react-aria-DateInput",
        prefix: "time-field-input",
        variables: {
          xs: {
            "--time-field-input-padding":
              "var(--spacing-3xs) var(--spacing-xs)",
            "--time-field-input-size": "var(--text-2xs)",
            "--time-field-input-line-height": "var(--text-2xs--line-height)",
            "--time-field-input-min-width": "100px",
          },
          sm: {
            "--time-field-input-padding":
              "var(--spacing-2xs) var(--spacing-sm)",
            "--time-field-input-size": "var(--text-xs)",
            "--time-field-input-line-height": "var(--text-xs--line-height)",
            "--time-field-input-min-width": "120px",
          },
          md: {
            "--time-field-input-padding": "var(--spacing-xs) var(--spacing-md)",
            "--time-field-input-size": "var(--text-sm)",
            "--time-field-input-line-height": "var(--text-sm--line-height)",
            "--time-field-input-min-width": "150px",
          },
          lg: {
            "--time-field-input-padding": "var(--spacing-sm) var(--spacing-lg)",
            "--time-field-input-size": "var(--text-base)",
            "--time-field-input-line-height": "var(--text-base--line-height)",
            "--time-field-input-min-width": "180px",
          },
          xl: {
            "--time-field-input-padding": "var(--spacing-md) var(--spacing-xl)",
            "--time-field-input-size": "var(--text-lg)",
            "--time-field-input-line-height": "var(--text-lg--line-height)",
            "--time-field-input-min-width": "220px",
          },
        },
        bridges: {
          display: "inline-flex",
          padding: "var(--time-field-input-padding)",
          border: "1px solid",
          "border-radius": "var(--border-radius)",
          width: "100%",
          "min-width": "var(--time-field-input-min-width)",
          "white-space": "nowrap",
          "forced-color-adjust": "none",
          "font-size": "var(--time-field-input-size)",
          "line-height": "var(--time-field-input-line-height)",
          transition: "border-color 200ms ease, background-color 200ms ease",
        },
      },
      {
        childSelector: ".react-aria-DateSegment",
        prefix: "time-field-segment",
        variables: {
          xs: { "--time-field-segment-size": "var(--text-2xs)" },
          sm: { "--time-field-segment-size": "var(--text-xs)" },
          md: { "--time-field-segment-size": "var(--text-sm)" },
          lg: { "--time-field-segment-size": "var(--text-base)" },
          xl: { "--time-field-segment-size": "var(--text-lg)" },
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
          "font-size": "var(--time-field-segment-size)",
          transition: "all 150ms ease",
        },
        states: {
          '[data-type="literal"]': { padding: "0" },
          "[data-placeholder]": {
            color: "var(--fg-muted)",
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
        prefix: "time-field-hint",
        variables: {
          xs: { "--time-field-hint-size": "var(--text-2xs)" },
          sm: { "--time-field-hint-size": "var(--text-xs)" },
          md: { "--time-field-hint-size": "var(--text-xs)" },
          lg: { "--time-field-hint-size": "var(--text-sm)" },
          xl: { "--time-field-hint-size": "var(--text-base)" },
        },
        bridges: {
          "--error-font-size": "var(--time-field-hint-size)",
          "--error-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: '[slot="description"]',
        bridges: {
          "font-size": "var(--time-field-hint-size)",
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
          {
            key: "label",
            type: "string",
            label: "Label",
            icon: Layout,
            emptyToUndefined: true,
          },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: FileText,
            emptyToUndefined: true,
          },
          {
            key: "errorMessage",
            type: "string",
            label: "Error Message",
            icon: AlertTriangle,
            emptyToUndefined: true,
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
            options: [
              { value: "hour", label: "Hour" },
              { value: "minute", label: "Minute" },
              { value: "second", label: "Second" },
            ],
            defaultValue: "minute",
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
        fields: [],
      },
      {
        title: "State",
        fields: [
          {
            key: "minValue",
            type: "string",
            label: "Min Value",
            icon: Hash,
            placeholder: "09:00",
          },
          {
            key: "maxValue",
            type: "string",
            label: "Max Value",
            icon: Hash,
            placeholder: "18:00",
          },
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
          {
            key: "placeholderValue",
            type: "string",
            label: "Placeholder",
            icon: FileText,
            emptyToUndefined: true,
          },
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
