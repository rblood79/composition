import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * Dialog 컴포넌트 정의
 *
 * CSS DOM 구조와 동일한 복합 컴포넌트 트리:
 *   Dialog (parent)
 *     ├─ Heading   — 제목 텍스트 노드
 *     ├─ Description — 본문 텍스트 노드
 *     └─ DialogFooter — 버튼 영역 컨테이너
 */
export function createDialogDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Dialog",
    parent: {
      type: "Dialog",
      props: {
        variant: "accent",
        size: "md",
        isDismissable: false,
        style: {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          padding: "24px",
          gap: "16px",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Heading",
        props: {
          children: "Dialog Title",
          level: 2,
          style: {
            display: "block",
            fontSize: "18px",
            fontWeight: "600",
          },
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children: "Dialog content goes here.",
          style: {
            display: "block",
            fontSize: "14px",
            lineHeight: "1.5",
          },
        } as ComponentElementProps,
      },
      {
        type: "DialogFooter",
        props: {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Popover 컴포넌트 정의
 *
 * CSS DOM 구조와 동일한 복합 컴포넌트 트리:
 *   Popover (parent)
 *     ├─ Heading   — 팝오버 제목 노드
 *     └─ Description — 팝오버 내용 노드
 */
export function createPopoverDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Popover",
    parent: {
      type: "Popover",
      props: {
        variant: "default",
        size: "sm",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "240px",
          padding: "16px",
          gap: "8px",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Heading",
        props: {
          children: "Popover Title",
          level: 3,
          style: {
            display: "block",
            fontSize: "14px",
            fontWeight: "600",
          },
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children: "Popover content goes here.",
          style: {
            display: "block",
            fontSize: "13px",
            lineHeight: "1.5",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Tooltip 컴포넌트 정의
 *
 * CSS DOM 구조와 동일한 복합 컴포넌트 트리:
 *   Tooltip (parent)
 *     └─ Description — 툴팁 텍스트 노드
 */
export function createTooltipDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Tooltip",
    parent: {
      type: "Tooltip",
      props: {
        variant: "default",
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "6px 10px",
          gap: "4px",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Description",
        props: {
          children: "Tooltip text",
          style: {
            display: "block",
            fontSize: "12px",
            lineHeight: "1.4",
          },
        } as ComponentElementProps,
      },
    ],
  };
}
