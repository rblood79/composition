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
        size: "md",
        isDismissable: false,
        // 2026-06-24 잔존 catalog 이관 — padding/gap 을 catalog md(=RSP var(--spacing-10)=40 정합,
        //   ADR-914 Tier1) 정본값으로 맞춤. factory 24/16 ≠ catalog 40/12 였던 false dirty + 시각
        //   비대칭 해소. width:400 은 RSP size M modal 폭(catalog 미보유) → createDefault 미러로 baseline.
        style: {
          display: "flex",
          flexDirection: "column",
          width: "400px",
          padding: "40px",
          gap: "12px",
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
        // 2026-06-24 잔존 catalog 이관 — size sm→md 로 정합. RAC Popover 레퍼런스 내용 컨테이너
        //   padding:16/gap:12 = catalog md. factory 가 size:sm 인데 padding 은 md(16) 값을 써서
        //   catalog sm(12/8) baseline 과 어긋난 false dirty 였음. size:md 면 padding16/gap12 양쪽 정합.
        size: "md",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "240px",
          padding: "16px",
          gap: "12px",
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
        // 2026-06-24 잔존 catalog 이관 — display 를 catalog/CSS 정본(inline-flex, align-items:center)
        //   으로 정합. factory flex/column 은 generated Tooltip.css(.react-aria-Tooltip inline-flex)와
        //   Skia 비대칭(D3 위반) + false dirty 였음. Tooltip 내용은 단일 텍스트라 column/gap 불요 →
        //   gap:4 제거(catalog 미보유). padding 은 store longhand 정책(style-ssot.md)으로 4-way 분리 —
        //   shorthand "6px 10px" 면 specStyle 이 비대칭이라 padding shorthand baseline 미생성(uniform4Way
        //   undefined) → false dirty. longhand 면 specStyle.paddingTop/Left(catalog paddingY6/paddingX10)
        //   가 baseline 제공 → dirty 0.
        style: {
          display: "inline-flex",
          alignItems: "center",
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 10,
          paddingRight: 10,
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
