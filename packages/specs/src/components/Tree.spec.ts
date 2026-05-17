/**
 * Tree Component Spec
 *
 * React Aria 기반 트리 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { resolveStateColors } from "../utils/stateEffect";
import {
  Tag,
  FileText,
  FolderTree,
  Workflow,
  SquareX,
  PointerOff,
  ChevronsUpDown,
  Hash,
} from "lucide-react";

function parseCsvList(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Tree Props
 */
export interface TreeProps {
  variant?: "default" | "accent";
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "replace" | "toggle";
  disallowEmptySelection?: boolean;
  selectedKeys?: string[];
  expandedKeys?: string[];
  defaultSelectedKeys?: string[];
  defaultExpandedKeys?: string[];
  isDisabled?: boolean;
  autoFocus?: boolean;
  style?: Record<string, string | number | undefined>;
}

/**
 * Tree Component Spec
 */
export const TreeSpec: ComponentSpec<TreeProps> = {
  name: "Tree",
  description: "React Aria 기반 트리 컴포넌트",
  element: "div",
  skipCSSGeneration: true,

  defaultVariant: "default",
  defaultSize: "md",

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
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "selectionMode",
            type: "enum",
            label: "Selection Mode",
            icon: FolderTree,
            options: [
              { value: "none", label: "None" },
              { value: "single", label: "Single" },
              { value: "multiple", label: "Multiple" },
            ],
            defaultValue: "none",
          },
          {
            key: "selectionBehavior",
            type: "enum",
            label: "Selection Behavior",
            icon: Workflow,
            options: [
              { value: "replace", label: "Replace" },
              { value: "toggle", label: "Toggle" },
            ],
            defaultValue: "toggle",
          },
          {
            key: "disallowEmptySelection",
            type: "boolean",
            label: "Disallow Empty Selection",
            icon: SquareX,
          },
          {
            key: "expandedKeys",
            type: "string",
            label: "Expanded Keys",
            icon: ChevronsUpDown,
            placeholder: "item1, item2, item3",
            derivedUpdateFn: (value) => ({
              expandedKeys: parseCsvList(value),
            }),
          },
          {
            key: "selectedKeys",
            type: "string",
            label: "Selected Keys",
            icon: Hash,
            placeholder: "item1, item2",
            derivedUpdateFn: (value) => ({
              selectedKeys: parseCsvList(value),
            }),
          },
          {
            key: "defaultExpandedKeys",
            type: "string",
            label: "Default Expanded Keys",
            icon: ChevronsUpDown,
            placeholder: "item1, item2",
            derivedUpdateFn: (value) => ({
              defaultExpandedKeys: parseCsvList(value),
            }),
          },
          {
            key: "defaultSelectedKeys",
            type: "string",
            label: "Default Selected Keys",
            icon: Hash,
            placeholder: "item1",
            derivedUpdateFn: (value) => ({
              defaultSelectedKeys: parseCsvList(value),
            }),
          },

          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
        ],
      },
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "children-manager",
            label: "Tree Items",
            childTag: "TreeItem",
            defaultChildProps: {
              children: "Item",
              value: "",
            },
            labelProp: "children",
          },
        ],
      },
    ],
  },

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.accent-subtle}" as TokenRef,
          pressed: "{color.accent-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 28,
      paddingX: 8,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      iconSize: 14,
      gap: 2,
    },
    md: {
      height: 36,
      paddingX: 12,
      paddingY: 6,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 16,
      gap: 4,
    },
    lg: {
      height: 44,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      iconSize: 20,
      gap: 6,
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  render: {
    shapes: (_props, size, state = "default") => {
      // Disclosure 버그 클래스 수정 (2026-05-18): Tree 는 자식 TreeItem Element 가
      // 각자 행을 렌더한다 (Preview renderTree 와 D3 대칭). 컨테이너 spec 은
      // 배경/테두리 shell 만 담당 — 기존 하드코딩 더미 트리(Root/Documents/...) 제거.
      const variant = TreeSpec.variants![TreeSpec.defaultVariant!];
      const borderRadius = size.borderRadius;

      const shapes: Shape[] = [
        {
          id: "bg",
          type: "roundRect" as const,
          x: 0,
          y: 0,
          width: "auto",
          height: "auto",
          radius: borderRadius as unknown as number,
          fill: resolveStateColors(variant, state).background,
        },
        {
          type: "border" as const,
          target: "bg",
          borderWidth: 1,
          color: variant.border || ("{color.border}" as TokenRef),
          radius: borderRadius as unknown as number,
        },
      ];

      return shapes;
    },

    react: () => ({
      role: "tree",
    }),

    pixi: () => ({
      eventMode: "static" as const,
      cursor: "default",
    }),
  },
};
