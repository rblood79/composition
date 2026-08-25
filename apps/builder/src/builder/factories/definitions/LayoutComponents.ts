import { ComponentElementProps } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * Tabs 컴포넌트 정의
 */
export function createTabsDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement } = context;
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

// ADR-148 Phase 3 (2026-07-17): createCardDefinition 삭제 — Card 는 reusable origin
//   (`component-card`, cardTemplateOrigins.ts)으로 전환. palette-add 는 catalog reusable
//   entry 를 보고 type:"ref" instance 를 생성한다 (Toolbar/Form/IconButton 동형).
//   구 title/description propagation 라우팅은 propsSchema 템플릿 바인딩이 대체 (legacy
//   flat Card 문서용 propagationRegistry rule 은 존속).

/**
 * Tree 컴포넌트 정의
 */
export function createTreeDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement } = context;
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
          children: "Node 1",
        } as ComponentElementProps,
      },
      {
        type: "TreeItem",
        props: {
          children: "Node 2",
        } as ComponentElementProps,
      },
    ],
  };
}
