/**
 * Menu Component Spec
 *
 * React Aria 기반 메뉴 컴포넌트 (S2 패턴)
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type { StoredMenuItem } from "../types/menu-items";
// ADR-099 Phase 5 stubs (StoredMenuEntry / isMenuSectionEntry /
//   isMenuSeparatorEntry / HeaderSpec) — 실제 사용 Phase 5 구현 시 재추가.
//   현재는 TS6196/6192/6133 unused error 방지 위해 제거 (build:specs 블로킹 해소).
import {
  parsePxValue,
  parseBorderWidth,
  resolveContainerSpacing,
} from "../primitives";
import { fontFamily } from "../primitives/typography";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";
import {
  Tag,
  PointerOff,
  List,
  AlignStartVertical,
  ArrowDown,
  ToggleRight,
  Parentheses,
} from "lucide-react";

/**
 * Menu Props (S2 기준)
 */
export interface MenuProps {
  variant?:
    | "accent"
    | "primary"
    | "secondary"
    | "negative"
    | "premium"
    | "genai";
  size?: "sm" | "md" | "lg" | "xl";
  align?: "start" | "end";
  direction?: "bottom" | "top" | "left" | "right";
  selectionMode?: "none" | "single" | "multiple";
  shouldFlip?: boolean;
  isQuiet?: boolean;
  isDisabled?: boolean;
  label?: string;
  children?: string;
  /** Q6=b 풀 인터페이스 — specs SSOT (ADR-068 P2) */
  items?: StoredMenuItem[];
  style?: Record<string, string | number | undefined>;
}

/** S2 size별 MenuItem 치수 */
export const MENU_ITEM_DIMENSIONS: Record<
  string,
  { minHeight: number; edgeToText: number; iconSize: number }
> = {
  sm: { minHeight: 24, edgeToText: 9, iconSize: 14 },
  md: { minHeight: 32, edgeToText: 12, iconSize: 20 },
  lg: { minHeight: 40, edgeToText: 15, iconSize: 20 },
  xl: { minHeight: 48, edgeToText: 18, iconSize: 20 },
};

/**
 * Menu Component Spec (S2)
 *
 * overlay: popover (포털, 배경 클릭으로 닫기)
 */
export const MenuSpec: ComponentSpec<MenuProps> = {
  name: "Menu",
  description: "React Aria 기반 드롭다운 메뉴 컴포넌트",
  archetype: "collection",
  element: "div",

  // ADR-071: popover container 시각 SSOT
  // `variants` 는 Skia trigger 전용 (render.shapes), CSS 경로는 이 블록만 사용
  containerStyles: {
    background: "{color.raised}" as TokenRef,
    text: "{color.neutral}" as TokenRef,
    border: "{color.border}" as TokenRef,
    borderWidth: 1,
    borderRadius: "{radius.md}" as TokenRef,
    padding: "{spacing.xs}" as TokenRef,
    gap: "{spacing.2xs}" as TokenRef,
    // ADR-083 Phase 6: collection archetype base 의 layout primitive 2 필드 리프팅 (merge).
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxHeight: "300px",
    overflow: "auto",
    outline: "none",
  },

  defaultVariant: "primary",
  defaultSize: "md",

  overlay: {
    usePortal: true,
    type: "popover",
    hasBackdrop: false,
    closeOnBackdropClick: true,
    closeOnEscape: true,
    trapFocus: true,
    pixiLayer: "overlay",
  },

  variants: {
    accent: {
      fill: {
        default: {
          base: "{color.accent}" as TokenRef,
          hover: "{color.accent-hover}" as TokenRef,
          pressed: "{color.accent-pressed}" as TokenRef,
        },
      },
      text: "{color.on-accent}" as TokenRef,
      border: "{color.accent}" as TokenRef,
      borderHover: "{color.accent-hover}" as TokenRef,
    },
    primary: {
      fill: {
        default: {
          base: "{color.neutral}" as TokenRef,
          hover: "{color.neutral-hover}" as TokenRef,
          pressed: "{color.neutral-pressed}" as TokenRef,
        },
      },
      text: "{color.base}" as TokenRef,
      border: "{color.neutral}" as TokenRef,
      borderHover: "{color.neutral-hover}" as TokenRef,
    },
    secondary: {
      fill: {
        default: {
          base: "{color.layer-1}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
          pressed: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.negative}" as TokenRef,
          hover: "{color.negative-hover}" as TokenRef,
          pressed: "{color.negative-pressed}" as TokenRef,
        },
      },
      text: "{color.on-negative}" as TokenRef,
      border: "{color.negative}" as TokenRef,
      borderHover: "{color.negative-hover}" as TokenRef,
    },
    premium: {
      fill: {
        default: {
          base: "{color.purple}" as TokenRef,
          hover: "{color.purple-hover}" as TokenRef,
          pressed: "{color.purple-pressed}" as TokenRef,
        },
      },
      text: "{color.white}" as TokenRef,
      border: "{color.purple}" as TokenRef,
      borderHover: "{color.purple-hover}" as TokenRef,
    },
    genai: {
      fill: {
        default: {
          base: "{color.purple}" as TokenRef,
          hover: "{color.purple-hover}" as TokenRef,
          pressed: "{color.purple-pressed}" as TokenRef,
        },
      },
      text: "{color.white}" as TokenRef,
      border: "{color.purple}" as TokenRef,
      borderHover: "{color.purple-hover}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      lineHeight: "{typography.text-xs--line-height}" as TokenRef,
      borderWidth: 1,
      gap: 6,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      lineHeight: "{typography.text-sm--line-height}" as TokenRef,
      borderWidth: 1,
      gap: 8,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      lineHeight: "{typography.text-base--line-height}" as TokenRef,
      borderWidth: 1,
      gap: 10,
    },
    xl: {
      height: 0,
      paddingX: 24,
      paddingY: 12,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      lineHeight: "{typography.text-lg--line-height}" as TokenRef,
      borderWidth: 1,
      gap: 12,
    },
  },

  states: {
    hover: {},
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
  },

  // propagation 제거 (ADR-068 P2-3): MenuItem element가 element tree에 미존재
  // size는 Menu.props.size → [data-size] CSS 셀렉터로 MenuItem에 자동 적용

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          {
            key: "label",
            type: "string",
            label: "Trigger Label",
            icon: Tag,
            placeholder: "Menu",
          },
        ],
      },
      {
        title: "Appearance",
        fields: [
          {
            type: "variant",
            label: "Variant",
            icon: Parentheses,
          },
          { type: "size" },
          {
            key: "align",
            type: "enum",
            label: "Align",
            icon: AlignStartVertical,
            options: [
              { value: "start", label: "Start" },
              { value: "end", label: "End" },
            ],
            defaultValue: "start",
          },
          {
            key: "direction",
            type: "enum",
            label: "Direction",
            icon: ArrowDown,
            options: [
              { value: "bottom", label: "Bottom" },
              { value: "top", label: "Top" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ],
            defaultValue: "bottom",
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "selectionMode",
            type: "enum",
            label: "Selection Mode",
            icon: List,
            options: [
              { value: "none", label: "None" },
              { value: "single", label: "Single" },
              { value: "multiple", label: "Multiple" },
            ],
            defaultValue: "none",
          },
          {
            key: "shouldFlip",
            type: "boolean",
            label: "Should Flip",
            icon: ToggleRight,
            defaultValue: true,
          },
          { key: "isDisabled", type: "boolean", icon: PointerOff },
        ],
      },
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "items-manager",
            label: "Menu Items",
            itemsKey: "items",
            itemTypeName: "MenuItem",
            defaultItem: {
              id: "", // runtime에서 crypto.randomUUID() 주입
              label: "New Item",
              value: "",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "value", type: "string", label: "Value" },
              { key: "href", type: "string", label: "URL" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
              { key: "icon", type: "icon", label: "Icon" },
              { key: "shortcut", type: "string", label: "Shortcut" },
              { key: "description", type: "string", label: "Description" },
              { key: "onActionId", type: "event-id", label: "On Action" },
            ],
            labelKey: "label",
            allowNested: false,
            // ADR-099 Phase 4: Section/Separator 추가 UI 활성화 (Menu 전용)
            allowSections: true,
            allowSeparators: true,
            sectionHasSelection: true,
          },
        ],
      },
    ],
  },

  render: {
    shapes: (props, size, state = "default") => {
      const variant =
        MenuSpec.variants![
          (props as { variant?: keyof typeof MenuSpec.variants }).variant ??
            MenuSpec.defaultVariant!
        ];
      // ADR-908 Phase 3-A-2: fill token dual-read seam
      const fill = resolveFillTokens(variant);
      const width = "auto" as const;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);

      const bgColor =
        props.style?.backgroundColor ??
        (state === "hover"
          ? (fill.default.hover ?? fill.default.base)
          : state === "pressed"
            ? (fill.default.pressed ?? fill.default.base)
            : fill.default.base);

      const textColor = props.style?.color ?? variant.text;

      const borderColor =
        props.style?.borderColor ??
        (state === "hover" && variant.borderHover
          ? variant.borderHover
          : variant.border);

      const shapes: Shape[] = [
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width,
          height: "auto" as unknown as number,
          radius: borderRadius as unknown as number,
          fill: bgColor,
        },
      ];

      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // Menu는 트리거 버튼이므로 자식(MenuItem) 유무와 무관하게 항상 텍스트 렌더링
      const text = props.label || props.children || "Menu";

      const fontSize = resolveSpecFontSize(
        props.size ? size.fontSize : (props.style?.fontSize ?? size.fontSize),
        14,
      );
      const fwRaw = props.style?.fontWeight;
      const fw =
        fwRaw != null
          ? typeof fwRaw === "number"
            ? fwRaw
            : parseInt(String(fwRaw), 10) || 500
          : 500;
      const ff = (props.style?.fontFamily as string) || fontFamily.sans;
      const { paddingLeft: paddingX } = resolveContainerSpacing({
        style: props.style as Record<string, unknown> | undefined,
        defaults: { paddingLeft: size.paddingX },
      });

      shapes.push({
        type: "text" as const,
        x: paddingX,
        y: 0,
        text,
        fontSize,
        fontFamily: ff,
        fontWeight: fw,
        fill: textColor,
        align: "left" as const,
        baseline: "middle" as const,
      });

      return shapes;
    },

    react: (props) => ({
      role: "menu",
      "data-disabled": props.isDisabled || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
    }),
  },
};
