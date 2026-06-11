/**
 * ComboBox Component Spec
 *
 * React Aria 기반 콤보박스 컴포넌트 (입력 + 드롭다운)
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type { StoredComboBoxItem } from "../types/combobox-items";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { fontFamily, getLabelLineHeight } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
import {
  Tag,
  Binary,
  CheckSquare,
  PointerOff,
  PenOff,
  FileText,
  Layout,
  Menu,
  AlertTriangle,
  HelpCircle,
  Minimize2,
} from "lucide-react";

/**
 * ComboBox Props
 */
export interface ComboBoxProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isQuiet?: boolean;
  label?: string;
  placeholder?: string;
  name?: string;
  form?: string;
  inputValue?: string;
  selectedText?: string;
  description?: string;
  errorMessage?: string;
  isOpen?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
  allowsCustomValue?: boolean;
  validationBehavior?: "native" | "aria";
  labelPosition?: "top" | "side";
  necessityIndicator?: "icon" | "label";
  /** 트리거 아이콘 이름 */
  iconName?: string;
  /** 드롭다운 아이템 목록 (ADR-073 P2: StoredComboBoxItem[] SSOT) */
  items?: StoredComboBoxItem[];
  /** 선택된 아이템 인덱스 (하이라이트용) */
  selectedIndex?: number;
  children?: string;
  contextualHelp?: string;
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
  /** ElementSprite에서 주입: 자식 Element 존재 시 spec shapes에서 label 렌더링 스킵 */
  _hasChildren?: boolean;
}

/**
 * ComboBox Component Spec
 */
export const ComboBoxSpec: ComponentSpec<ComboBoxProps> = {
  name: "ComboBox",
  description: "React Aria 기반 콤보박스 컴포넌트 (입력 + 드롭다운)",
  element: "div",
  skipCSSGeneration: false,

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
            key: "placeholder",
            type: "string",
            label: "Placeholder",
            icon: FileText,
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
            key: "iconName",
            type: "icon",
            label: "Trigger Icon",
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
        ],
      },
      {
        title: "Trigger Behavior",
        fields: [
          {
            key: "menuTrigger",
            type: "enum",
            label: "Menu Trigger",
            icon: Menu,
            options: [
              { value: "focus", label: "Focus" },
              { value: "input", label: "Input" },
              { value: "manual", label: "Manual" },
            ],
            defaultValue: "input",
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "selectedValue",
            type: "string",
            label: "Value",
            icon: Tag,
            emptyToUndefined: true,
            placeholder: "선택된 값이 여기에 표시됩니다",
          },
          {
            key: "allowsCustomValue",
            type: "boolean",
            label: "Allows Custom Value",
            icon: Binary,
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

          {
            key: "isInvalid",
            type: "boolean",
            label: "Invalid",
            icon: AlertTriangle,
          },
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
        ],
      },
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "items-manager",
            label: "Options",
            itemsKey: "items",
            itemTypeName: "Option",
            defaultItem: {
              id: "",
              label: "Option",
              value: "",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "value", type: "string", label: "Value" },
              { key: "textValue", type: "string", label: "Text Value" },
              { key: "description", type: "string", label: "Description" },
              { key: "icon", type: "icon", label: "Icon" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
              { key: "onActionId", type: "event-id", label: "On Action" },
            ],
            labelKey: "label",
            allowNested: false,
          },
        ],
      },
    ],
  },

  // FIELD_FAMILY_SIZES (primitives/fieldSizes.ts) 와 동일 metric. (ADR-105-b)
  // height = lineHeight + paddingY×2 + borderWidth×2
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

  // ADR-059 v2 Phase 2: Spec SSOT 파생 CSS 메타데이터
  composition: {
    layout: "flex-column",
    gap: "var(--spacing-xs)",
    containerStyles: {
      color: "var(--fg)",
    },
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
              selector: ".react-aria-Button",
              styles: {
                background: "transparent",
                "box-shadow": "none",
                outline: "none",
                "border-color": "transparent",
              },
            },
            {
              selector: ".react-aria-Button[data-hovered]",
              styles: {
                background: "transparent",
                "box-shadow": "none",
                outline: "none",
                "border-color": "transparent",
              },
            },
            {
              selector: ".react-aria-Button[data-pressed]",
              styles: {
                background: "transparent",
                "box-shadow": "none",
                outline: "none",
                "border-color": "transparent",
              },
            },
            {
              selector: ".react-aria-Button[data-focus-visible]",
              styles: {
                background: "transparent",
                "box-shadow": "none",
                outline: "none",
                "border-color": "transparent",
              },
            },
            {
              selector: ".combobox-container",
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
                "&:has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled])) .combobox-container",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--border-hover)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Button[data-hovered]:not([data-disabled])) .combobox-container",
              styles: {
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--border-hover)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Input[data-focused]:not([data-disabled])) .combobox-container",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Input[data-focus-within]:not([data-disabled])) .combobox-container",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Button[data-focus-visible]:not([data-disabled])) .combobox-container",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--accent)",
              },
            },
            {
              selector:
                "&:has(.react-aria-Button[data-pressed]:not([data-disabled])) .combobox-container",
              styles: {
                outline: "none",
                background: "transparent",
                "border-color": "transparent",
                "border-bottom-color": "var(--accent)",
              },
            },
          ],
        },
      },
    },
    externalStyles: [
      {
        selector: '.react-aria-Popover[data-trigger="ComboBox"]',
        styles: {
          width: "var(--trigger-width)",
          "max-width": "none",
          "max-height": "300px",
          overflow: "auto",
          "box-sizing": "border-box",
          border: "1px solid var(--border)",
          "border-radius": "var(--border-radius)",
          background: "var(--bg-raised)",
          "box-shadow": "var(--shadow-lg)",
          contain: "layout style",
        },
        nested: [
          {
            selector: ".react-aria-ListBox",
            styles: {
              border: "none",
              background: "transparent",
              "max-height": "none",
              "min-height": "24px",
            },
          },
        ],
      },
    ],
    delegation: [
      {
        childSelector: ".react-aria-Label",
        prefix: "combo-label",
        variables: {
          xs: { "--combo-label-size": "var(--text-2xs)" },
          sm: { "--combo-label-size": "var(--text-xs)" },
          md: { "--combo-label-size": "var(--text-sm)" },
          lg: { "--combo-label-size": "var(--text-base)" },
          xl: { "--combo-label-size": "var(--text-lg)" },
        },
        bridges: {
          "--label-font-size": "var(--combo-label-size)",
          "--label-font-weight": "600",
          "--label-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: ".combobox-container",
        prefix: "combo-container",
        variables: {
          xs: {
            "--combo-container-padding": "var(--spacing-3xs) var(--spacing-xs)",
            "--combo-container-padding-right": "var(--spacing-3xs)",
          },
          sm: {
            "--combo-container-padding": "var(--spacing-2xs) var(--spacing-sm)",
            "--combo-container-padding-right": "var(--spacing-2xs)",
          },
          md: {
            "--combo-container-padding": "var(--spacing-xs) var(--spacing-md)",
            "--combo-container-padding-right": "var(--spacing-xs)",
          },
          lg: {
            "--combo-container-padding": "var(--spacing-sm) var(--spacing-lg)",
            "--combo-container-padding-right": "var(--spacing-sm)",
          },
          xl: {
            "--combo-container-padding": "var(--spacing-md) var(--spacing-xl)",
            "--combo-container-padding-right": "var(--spacing-md)",
          },
        },
        bridges: {
          display: "flex",
          "align-items": "center",
          gap: "var(--btn-gap, var(--spacing-xs))",
          width: "100%",
          border: "1px solid var(--border)",
          "border-radius": "var(--border-radius)",
          background: "var(--bg-inset)",
          overflow: "hidden",
          transition: "border-color 200ms ease, background-color 200ms ease",
          padding: "var(--combo-container-padding)",
          "padding-right": "var(--combo-container-padding-right)",
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
          ":has([data-disabled])": {
            background: "color-mix(in srgb, var(--fg) 4%, transparent)",
            "border-color": "color-mix(in srgb, var(--fg) 12%, transparent)",
            opacity: "0.38",
          },
        },
      },
      {
        childSelector: ".react-aria-Input",
        prefix: "combo-input",
        variables: {
          xs: {
            "--combo-input-padding": "0",
            "--combo-input-font-size": "var(--text-2xs)",
            "--combo-input-line-height": "var(--text-2xs--line-height)",
          },
          sm: {
            "--combo-input-padding": "0",
            "--combo-input-font-size": "var(--text-xs)",
            "--combo-input-line-height": "var(--text-xs--line-height)",
          },
          md: {
            "--combo-input-padding": "0",
            "--combo-input-font-size": "var(--text-sm)",
            "--combo-input-line-height": "var(--text-sm--line-height)",
          },
          lg: {
            "--combo-input-padding": "0",
            "--combo-input-font-size": "var(--text-base)",
            "--combo-input-line-height": "var(--text-base--line-height)",
          },
          xl: {
            "--combo-input-padding": "0",
            "--combo-input-font-size": "var(--text-lg)",
            "--combo-input-line-height": "var(--text-lg--line-height)",
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
          "font-size": "var(--combo-input-font-size)",
          "line-height": "var(--combo-input-line-height)",
          "--input-padding": "var(--combo-input-padding)",
          "--input-font-size": "var(--combo-input-font-size)",
          "--input-line-height": "var(--combo-input-line-height)",
        },
      },
      {
        childSelector: ".react-aria-Button",
        prefix: "combo-btn",
        variables: {
          xs: { "--combo-btn-size": "10px" },
          sm: { "--combo-btn-size": "14px" },
          md: { "--combo-btn-size": "18px" },
          lg: { "--combo-btn-size": "22px" },
          xl: { "--combo-btn-size": "28px" },
        },
        bridges: {
          position: "static",
          flex: "0 0 auto",
          padding: "0",
          "border-width": "0",
          width: "var(--combo-btn-size)",
          height: "var(--combo-btn-size)",
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
        childSelector: ".react-aria-FieldError",
        prefix: "combo-hint",
        variables: {
          xs: { "--combo-hint-size": "var(--text-2xs)" },
          sm: { "--combo-hint-size": "var(--text-xs)" },
          md: { "--combo-hint-size": "var(--text-xs)" },
          lg: { "--combo-hint-size": "var(--text-sm)" },
          xl: { "--combo-hint-size": "var(--text-base)" },
        },
        bridges: {
          "--error-font-size": "var(--combo-hint-size)",
          "--error-margin": "var(--spacing-xs)",
        },
      },
      {
        childSelector: '[slot="description"]',
        bridges: {
          "font-size": "var(--combo-hint-size)",
          color: "var(--fg-muted)",
        },
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

  propagation: {
    // ADR-912 R1 (2026-06-12): ComboBoxWrapper/Input/Trigger → Select family 공용 type retype.
    rules: [
      { parentProp: "size", childPath: "SelectTrigger", override: true },
      {
        parentProp: "size",
        childPath: ["SelectTrigger", "SelectValue"],
        override: true,
      },
      {
        parentProp: "size",
        childPath: ["SelectTrigger", "SelectIcon"],
        override: true,
      },
      { parentProp: "size", childPath: "Label", override: true },
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

  render: {
    shapes: (props, size, state = "default") => {
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 200;
      const chevronSize = size.iconSize ?? 18;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius as unknown as number,
      );

      // backgroundColor: 'transparent'는 factory 기본값 → 직접 토큰 사용
      const userBg = props.style?.backgroundColor;
      const bgColor =
        userBg != null && userBg !== "transparent"
          ? userBg
          : state === "hover"
            ? ("{color.layer-1}" as TokenRef)
            : state === "pressed"
              ? ("{color.layer-1}" as TokenRef)
              : ("{color.elevated}" as TokenRef);

      const borderColor = props.style?.borderColor;

      const defaultBw = props.isInvalid ? 2 : 1;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, defaultBw);

      const fontSize = resolveSpecFontSize(
        props.style?.fontSize ?? size.fontSize,
        14,
      );

      // CSS 정합성: size.height는 CSS와 동기화된 값 (lineHeight + paddingY*2 + borderWidth*2)
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

      const textAlign =
        (props.style?.textAlign as "left" | "center" | "right") || "left";

      const textColor = props.style?.color ?? ("{color.neutral}" as TokenRef);

      const paddingX = parsePxValue(
        props.style?.paddingLeft ??
          props.style?.paddingRight ??
          props.style?.padding,
        size.paddingX,
      );

      const shapes: Shape[] = [];
      // Compositional Architecture: 자식 Element가 있으면
      // Label, ComboBoxWrapper(ComboBoxInput, ComboBoxTrigger)가 각자 spec으로 렌더링
      // ComboBox 자체에서는 드롭다운 패널만 담당
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      const inputY = props.label ? labelOffset : 0;

      if (!hasChildren) {
        // fallback: 자식이 없는 레거시 데이터 → 전체 렌더링
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
            align: textAlign,
            baseline: "top" as const,
          });
        }

        // 입력 영역 배경
        shapes.push({
          id: "input",
          type: "roundRect" as const,
          x: 0,
          y: inputY,
          width,
          height: inputHeight,
          radius: borderRadius,
          fill: bgColor,
        });

        // 테두리
        if (borderColor) {
          shapes.push({
            type: "border" as const,
            target: "input",
            borderWidth,
            color: props.isInvalid
              ? ("{color.negative}" as TokenRef)
              : borderColor,
            radius: borderRadius,
          });
        }

        // 입력 텍스트 또는 placeholder
        const displayText = props.inputValue || props.placeholder || "";
        if (displayText) {
          const isPlaceholder = !props.inputValue && !!props.placeholder;
          shapes.push({
            type: "text" as const,
            x: paddingX,
            y: inputY + inputHeight / 2,
            text: displayText,
            fontSize,
            fontFamily: ff,
            fill: isPlaceholder
              ? ("{color.neutral-subdued}" as TokenRef)
              : textColor,
            align: textAlign,
            baseline: "middle" as const,
          });
        }

        // 쉐브론 아이콘
        const chevX = width - paddingX - chevronSize / 2;
        const chevY = inputY + inputHeight / 2;
        shapes.push({
          type: "icon_font" as const,
          iconName: props.iconName ?? "chevron-down",
          x: chevX,
          y: chevY,
          fontSize: chevronSize,
          fill: "{color.neutral-subdued}" as TokenRef,
          strokeWidth: 2,
        });
      }

      // 드롭다운 패널 (열린 상태) — hasChildren 여부와 무관하게 렌더링
      if (props.isOpen) {
        // inputValue로 아이템 필터링 (입력값이 있으면 포함된 항목만 표시)
        const storedItems = props.items ?? [];
        const allItems: ReadonlyArray<{
          id: string;
          label: string;
          value?: string;
        }> =
          storedItems.length > 0
            ? storedItems
            : [
                { id: "opt-1", label: "Option 1" },
                { id: "opt-2", label: "Option 2" },
                { id: "opt-3", label: "Option 3" },
              ];
        const filterText = props.inputValue?.toLowerCase() ?? "";
        const dropdownItems = filterText
          ? allItems.filter((item) =>
              item.label.toLowerCase().includes(filterText),
            )
          : allItems;

        const itemH = 36;
        const dropdownPaddingY = 4;
        const dropdownHeight =
          dropdownItems.length > 0
            ? dropdownItems.length * itemH + dropdownPaddingY * 2
            : itemH + dropdownPaddingY * 2;
        const dropdownY = inputY + inputHeight + 4;

        shapes.push({
          type: "shadow" as const,
          target: "dropdown",
          offsetX: 0,
          offsetY: 4,
          blur: 8,
          color: "rgba(0, 0, 0, 0.1)",
          alpha: 0.1,
        });
        shapes.push({
          id: "dropdown",
          type: "roundRect" as const,
          x: 0,
          y: dropdownY,
          width,
          height: dropdownHeight,
          radius: borderRadius,
          fill: "{color.layer-1}" as TokenRef,
        });
        shapes.push({
          type: "border" as const,
          target: "dropdown",
          borderWidth: 1,
          color: "{color.border}" as TokenRef,
          radius: borderRadius,
        });

        if (dropdownItems.length === 0) {
          // 결과 없음 텍스트
          shapes.push({
            type: "text" as const,
            x: paddingX,
            y: dropdownY + dropdownPaddingY + itemH / 2,
            text: "No results",
            fontSize,
            fontFamily: ff,
            fontWeight: 400,
            fill: "{color.neutral-subdued}" as TokenRef,
            align: "left" as const,
            baseline: "middle" as const,
          });
        } else {
          // 선택 인덱스 결정
          const selectedIdx =
            props.selectedIndex ??
            (props.selectedText != null
              ? allItems.findIndex(
                  (it) =>
                    it.label === props.selectedText ||
                    it.value === props.selectedText,
                )
              : -1);

          dropdownItems.forEach((item, i) => {
            const itemY = dropdownY + dropdownPaddingY + i * itemH;
            const isSelected =
              selectedIdx >= 0 && allItems[selectedIdx]?.id === item.id;

            // 선택된 아이템 하이라이트 배경
            if (isSelected) {
              shapes.push({
                type: "roundRect" as const,
                x: 4,
                y: itemY + 2,
                width: width - 8,
                height: itemH - 4,
                radius: borderRadius,
                fill: "{color.accent-subtle}" as TokenRef,
              });
            }

            // 아이템 텍스트
            shapes.push({
              type: "text" as const,
              x: paddingX,
              y: itemY + itemH / 2,
              text: item.label,
              fontSize,
              fontFamily: ff,
              fontWeight: isSelected ? 600 : 400,
              fill: isSelected
                ? ("{color.neutral}" as TokenRef)
                : ("{color.neutral}" as TokenRef),
              align: textAlign,
              baseline: "middle" as const,
            });
          });
        }
      }

      // 설명 / 에러 메시지
      const descText =
        props.isInvalid && props.errorMessage
          ? props.errorMessage
          : props.description;
      if (descText) {
        const descStoredItems = props.items ?? [];
        const descAllItems =
          descStoredItems.length > 0
            ? descStoredItems
            : [
                { id: "opt-1", label: "Option 1" },
                { id: "opt-2", label: "Option 2" },
                { id: "opt-3", label: "Option 3" },
              ];
        const filterText = props.inputValue?.toLowerCase() ?? "";
        const visibleCount = props.isOpen
          ? filterText
            ? descAllItems.filter((item) =>
                item.label.toLowerCase().includes(filterText),
              ).length
            : descAllItems.length
          : 0;
        const descY = props.isOpen
          ? inputY + inputHeight + 4 + Math.max(visibleCount, 1) * 36 + 8 + 4
          : inputY + inputHeight + 4;
        shapes.push({
          type: "text" as const,
          x: 0,
          y: descY,
          text: descText,
          fontSize: fontSize - 2,
          fontFamily: ff,
          fill: props.isInvalid
            ? ("{color.negative}" as TokenRef)
            : ("{color.neutral-subdued}" as TokenRef),
          align: textAlign,
          baseline: "top" as const,
        });
      }

      return shapes;
    },

    react: (props) => ({
      "data-open": props.isOpen || undefined,
      "data-invalid": props.isInvalid || undefined,
      "data-disabled": props.isDisabled || undefined,
      "data-required": props.isRequired || undefined,
      role: "combobox",
      "aria-expanded": props.isOpen || undefined,
    }),

    pixi: (props) => ({
      eventMode: "static" as const,
      cursor: props.isDisabled ? "not-allowed" : "text",
    }),
  },
};
