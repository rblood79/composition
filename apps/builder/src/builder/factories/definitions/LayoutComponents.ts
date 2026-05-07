import { ComponentElementProps } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * Tabs 컴포넌트 정의
 */
export function createTabsDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ADR-066: items SSOT — Tab element 소멸, TabPanel만 유지 (itemId 페어링)
  const item1Id = ElementUtils.generateId();
  const item2Id = ElementUtils.generateId();
  const items = [
    { id: item1Id, title: "Tab 1" },
    { id: item2Id, title: "Tab 2" },
  ];

  // ⭐ Layout/Slot System

  return {
    type: "Tabs",
    parent: {
      type: "Tabs",
      props: {
        items,
        defaultSelectedKey: item1Id,
        orientation: "horizontal",
        showIndicator: true,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "TabList",
        props: {} as ComponentElementProps,
      },
      {
        type: "TabPanels",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "TabPanel",
            props: {
              itemId: item1Id,
            } as ComponentElementProps,
          },
          {
            type: "TabPanel",
            props: {
              itemId: item2Id,
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * Card 컴포넌트 정의
 *
 * Card를 복합 컴포넌트로 생성하여 title(Heading)과 description(p)을
 * 별도 Element로 관리합니다.
 * → 더블클릭으로 자식 선택, 레이어 트리에서 계층 구조 확인 가능
 */
export function createCardDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Card",
    parent: {
      type: "Card",
      props: {
        variant: "primary",
        size: "md",
        orientation: "vertical",
        title: "Card Title",
        description: "Card description text goes here.",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "16px",
          borderWidth: "1px",
          gap: "8px",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "CardPreview",
        props: {
          style: {
            display: "flex",
            width: "100%",
            height: "fit-content",
            overflow: "hidden",
            borderRadius: "8px 8px 0 0",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Image",
            props: {
              src: "",
              alt: "Card preview",
              style: {
                width: "100%",
                height: 200,
                objectFit: "cover",
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-092 Phase 4: CardHeader inline style(display/flexDirection/alignItems/gap/width)
        //   → CardHeaderSpec.containerStyles + sizes.md.gap 으로 이관. factory inline 제거.
        //   기존 저장 프로젝트에 inline style 이 있는 경우 그대로 유지 (사용자 편집 간주).
        type: "CardHeader",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "Heading",
            props: {
              children: "Card Title",
              level: 3,
              className: "card-title",
              style: {
                display: "block",
                fontSize: "16px",
                fontWeight: "600",
                lineHeight: "1.4",
                margin: "0",
                flex: 1,
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-092 Phase 4: CardContent inline style(display/flexDirection/gap/width)
        //   → CardContentSpec.containerStyles + sizes.md.gap 으로 이관. factory inline 제거.
        type: "CardContent",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "Description",
            props: {
              children: "Card description text goes here.",
              style: {
                display: "block",
                width: "100%",
                fontSize: "14px",
                fontWeight: "400",
                lineHeight: "1.5",
                color: "#49454f",
              },
            } as ComponentElementProps,
          },
        ],
      },
      {
        // ADR-092 Phase 4: CardFooter inline style(display/flexDirection/alignItems/gap/width)
        //   → CardFooterSpec.containerStyles + sizes.md.gap 으로 이관. factory inline 제거.
        //   paddingTop/borderTopWidth 는 Taffy layout prop 아님 — 시각적 구분선으로 보존.
        type: "CardFooter",
        props: {
          style: {
            paddingTop: "8px",
            borderTopWidth: "1px",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Tree 컴포넌트 정의
 */
export function createTreeDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Tree",
    parent: {
      type: "Tree",
      props: {
        "aria-label": "Tree",
        selectionMode: "single",
        selectionBehavior: "replace",
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "TreeItem",
        props: {
          title: "Node 1",
          hasChildren: true,
        } as ComponentElementProps,
      },
      {
        type: "TreeItem",
        props: {
          title: "Node 2",
          hasChildren: false,
        } as ComponentElementProps,
      },
    ],
  };
}
