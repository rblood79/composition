/**
 * Card Component Spec
 *
 * React Aria 기반 카드 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * ADR-104 (098-f 슬롯): `Card` 이름은 S2 공식 이름과 완전 일치
 * (`@react-spectrum/s2/src/Card.tsx` `export const Card = forwardRef(...)`).
 * BC 재평가: `tag:"Card"` factory 직렬화 확인 (`LayoutComponents.ts:101`) — BC HIGH.
 * 대안 A (정당화 유지) 채택. 자식 슬롯 CardHeader/CardContent/CardFooter 는 ADR-092 Compositional
 * Architecture 고유 Card-prefix 구체화 이름 — S2 범용 슬롯 `Header`/`Content`/`Footer` 와 전략
 * 상이하나 D3 시각 domain 귀속 확증 + BC HIGH 으로 정당화 유지.
 *
 * @packageDocumentation
 */

import {
  Type,
  ArrowLeftRight,
  Link,
  ExternalLink,
  ToggleLeft,
  PointerOff,
  Palette,
  Image,
  Layout,
} from "lucide-react";
import type { ComponentSpec, Shape, TokenRef } from "../types";
import { parsePxValue, parseBorderWidth } from "../primitives";
import { CardHeaderSpec } from "./CardHeader.spec";
import { CardContentSpec } from "./CardContent.spec";
import { CardFooterSpec } from "./CardFooter.spec";
import { CardPreviewSpec } from "./CardPreview.spec";

/**
 * Card Props
 */
export interface CardProps {
  cardType?: "default" | "asset" | "user" | "product";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  density?: "compact" | "regular" | "spacious";
  orientation?: "vertical" | "horizontal";
  isSelectable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  isQuiet?: boolean;
  title?: string;
  description?: string;
  footer?: string;
  accentColor?: string;
  asset?: boolean;
  assetSrc?: string;
  preview?: boolean;
  href?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
  children?: string;
  style?: Record<string, string | number | undefined>;
}

/**
 * Card Component Spec
 *
 * height: 0 = auto (콘텐츠에 따라 결정)
 * paddingX/paddingY 동일 값으로 균일 padding 표현
 */
export const CardSpec: ComponentSpec<CardProps> = {
  name: "Card",
  description: "React Aria 기반 카드 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  defaultSize: "md",

  sizes: {
    xs: {
      height: 0,
      paddingX: 4,
      paddingY: 4,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      gap: 4,
    },
    sm: {
      height: 0,
      paddingX: 8,
      paddingY: 8,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 8,
    },
    md: {
      height: 0,
      paddingX: 16,
      paddingY: 16,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 12,
    },
    lg: {
      height: 0,
      paddingX: 24,
      paddingY: 24,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 16,
    },
    xl: {
      height: 0,
      paddingX: 32,
      paddingY: 32,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.xl}" as TokenRef,
      gap: 20,
    },
  },

  states: {
    hover: {},
    pressed: {
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
    },
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-092 Phase 2: ADR-094 인프라 경유 → Skia/CSS/Taffy 자동 등록.
  //   수동 tagSpecMap.ts 등록 불필요.
  childSpecs: [
    CardHeaderSpec,
    CardContentSpec,
    CardFooterSpec,
    CardPreviewSpec,
  ],

  propagation: {
    rules: [
      // ADR-092 Hard Constraint #7: 기존 title/description 전파 보존
      {
        parentProp: "title",
        childPath: ["CardHeader", "Heading"],
        childProp: "children",
        override: true,
      },
      {
        parentProp: "description",
        childPath: ["CardContent", "Description"],
        childProp: "children",
        override: true,
      },
      // ADR-092 Hard Constraint #4: size 전파 3건 추가
      {
        parentProp: "size",
        childPath: "CardHeader",
        override: true,
      },
      {
        parentProp: "size",
        childPath: "CardContent",
        override: true,
      },
      {
        parentProp: "size",
        childPath: "CardFooter",
        override: true,
      },
    ],
  },

  properties: {
    sections: [
      {
        title: "Content",
        fields: [
          { key: "title", type: "string", label: "Title", icon: Type },
          {
            key: "description",
            type: "string",
            label: "Description",
            multiline: true,
            icon: Type,
          },
          { key: "footer", type: "string", label: "Footer", icon: Type },
        ],
      },
      {
        title: "Appearance",
        fields: [
          {
            key: "cardType",
            type: "enum",
            label: "Card Type",
            icon: Layout,
            options: [
              { value: "default", label: "Default" },
              { value: "media", label: "Media" },
              { value: "gallery", label: "Gallery" },
            ],
            defaultValue: "default",
          },
          { type: "size" },
          {
            key: "orientation",
            type: "enum",
            label: "Orientation",
            icon: ArrowLeftRight,
            options: [
              { value: "vertical", label: "Vertical" },
              { value: "horizontal", label: "Horizontal" },
            ],
            defaultValue: "vertical",
          },
          {
            key: "accentColor",
            type: "enum",
            label: "Accent Color",
            icon: Palette,
            emptyToUndefined: true,
            options: [
              { value: "", label: "None" },
              { value: "red", label: "Red" },
              { value: "orange", label: "Orange" },
              { value: "yellow", label: "Yellow" },
              { value: "green", label: "Green" },
              { value: "turquoise", label: "Turquoise" },
              { value: "cyan", label: "Cyan" },
              { value: "blue", label: "Blue" },
              { value: "indigo", label: "Indigo" },
              { value: "purple", label: "Purple" },
              { value: "pink", label: "Pink" },
            ],
          },
        ],
      },
      {
        title: "Asset & Media",
        fields: [
          {
            key: "asset",
            type: "enum",
            label: "Asset Type",
            icon: Image,
            emptyToUndefined: true,
            options: [
              { value: "", label: "None" },
              { value: "file", label: "File" },
              { value: "folder", label: "Folder" },
              { value: "image", label: "Image" },
              { value: "video", label: "Video" },
              { value: "audio", label: "Audio" },
            ],
          },
          {
            key: "assetSrc",
            type: "string",
            label: "Asset Source URL",
            visibleWhen: { key: "asset", truthy: true },
          },
          {
            key: "preview",
            type: "string",
            label: "Preview Image URL",
          },
        ],
      },
      {
        title: "Interactions",
        fields: [
          {
            key: "href",
            type: "string",
            label: "Link",
            placeholder: "https://...",
            icon: Link,
          },
          {
            key: "target",
            type: "enum",
            label: "Target",
            icon: ExternalLink,
            visibleWhen: { key: "href", truthy: true },
            options: [
              { value: "_self", label: "Self" },
              { value: "_blank", label: "Blank" },
            ],
            defaultValue: "_self",
          },
          {
            key: "isSelectable",
            type: "boolean",
            label: "Selectable",
            icon: ToggleLeft,
          },
          {
            key: "isSelected",
            type: "boolean",
            label: "Selected",
            icon: ToggleLeft,
            visibleWhen: { key: "isSelectable", equals: true },
          },
        ],
      },
      {
        title: "State",
        fields: [{ key: "isDisabled", type: "boolean", icon: PointerOff }],
      },
    ],
  },

  render: {
    shapes: (props, size, state = "default") => {
      const CARD_DEFAULTS = {
        background: (props.isQuiet
          ? "{color.transparent}"
          : "{color.layer-2}") as TokenRef,
        backgroundHover: "{color.layer-1}" as TokenRef,
        backgroundPressed: "{color.neutral-subtle}" as TokenRef,
      };

      // 사용자 스타일 우선, 없으면 spec 기본값
      const bgColor =
        props.style?.backgroundColor ??
        (state === "hover"
          ? CARD_DEFAULTS.backgroundHover
          : state === "pressed"
            ? CARD_DEFAULTS.backgroundPressed
            : CARD_DEFAULTS.background);

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );

      const shapes: Shape[] = [];

      // 배경
      shapes.push({
        id: "bg",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width: "auto" as const,
        height: "auto",
        radius: borderRadius as unknown as number,
        fill: bgColor,
      });

      // 테두리 (user override only)
      const borderColor = props.style?.borderColor;
      const borderWidth = parseBorderWidth(props.style?.borderWidth, 1);
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // 선택 상태 강조
      if (props.isSelected) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth: 2,
          color: "{color.accent}" as TokenRef,
          radius: borderRadius as unknown as number,
        });
      }

      // Child Composition: 자식 Element가 있으면 bg + border만 반환 (container 스킵)
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      const padding = parsePxValue(
        props.style?.paddingTop ?? props.style?.padding,
        size.paddingY,
      );
      shapes.push({
        type: "container" as const,
        x: 0,
        y: 0,
        width: "auto",
        height: "auto",
        children: [],
        layout: {
          display: "flex",
          flexDirection: props.orientation === "horizontal" ? "row" : "column",
          gap: size.gap,
          padding,
        },
      });

      return shapes;
    },

    react: (props) => ({
      "data-selectable": props.isSelectable || undefined,
      "data-selected": props.isSelected || undefined,
      role: props.isSelectable ? "button" : undefined,
      tabIndex: props.isSelectable ? 0 : undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isSelectable ? "static" : ("passive" as const),
      cursor: props.isSelectable ? "pointer" : "default",
    }),
  },
};
