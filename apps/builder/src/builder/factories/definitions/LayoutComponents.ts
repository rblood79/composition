import { ComponentElementProps } from "../../../types/core/store.types";
import type { Element } from "../../../types/core/store.types";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentDefinition, ComponentCreationContext } from "../types";

export interface TabsCompositeElementOptions {
  parentId: string | null;
  idFactory?: () => string;
  now?: () => string;
}

interface TabsCompositeIds {
  tabOrigin: string;
  tabLabel: string;
  tabIndicator: string;
  tabListOrigin: string;
  tabRefOverview: string;
  tabRefSettings: string;
  tabsOrigin: string;
  tabsTabListRef: string;
  panelOverview: string;
  panelOverviewBody: string;
  panelSettings: string;
  panelSettingsBody: string;
  tabsInstance: string;
}

/**
 * ADR-144 Phase 2: 새 Tabs authoring payload.
 *
 * Legacy `props.items[]` 는 adapter fallback 으로만 남기고, 새 생성 경로는
 * canonical reusable/ref/descendants/slot mirror 를 만든다.
 */
export function createTabsCompositeElements(
  context: ComponentCreationContext,
  options: TabsCompositeElementOptions,
): { parent: Element; children: Element[] } {
  const idFactory = options.idFactory ?? ElementUtils.generateId;
  const now = options.now ?? (() => new Date().toISOString());
  const ids = createTabsCompositeIds(idFactory);
  const pageId = context.pageId || null;
  const layoutId = context.layoutId ?? null;
  const timestamp = now();

  const createElement = (
    id: string,
    type: string,
    props: ComponentElementProps,
    patch: Partial<Element> = {},
  ): Element =>
    withFrameElementMirrorId(
      {
        id,
        type,
        props,
        page_id: patch.page_id ?? null,
        parent_id: patch.parent_id ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        ...patch,
      },
      layoutId,
    );

  const tabOrigin = createElement(
    ids.tabOrigin,
    "Tab",
    {
      style: {
        minWidth: 90,
        height: 32,
      },
    } as ComponentElementProps,
    {
      name: "Tab",
      reusable: true,
      componentRole: "master",
      componentName: "Tab",
    },
  );
  const tabLabel = createElement(
    ids.tabLabel,
    "Text",
    { children: "Tab" } as ComponentElementProps,
    { parent_id: ids.tabOrigin },
  );
  const tabIndicator = createElement(
    ids.tabIndicator,
    "frame",
    {
      enabled: false,
      style: {
        width: 60,
        height: 2,
      },
    } as ComponentElementProps,
    { parent_id: ids.tabOrigin, name: "indicator" },
  );

  const tabListOrigin = createElement(
    ids.tabListOrigin,
    "TabList",
    {} as ComponentElementProps,
    {
      name: "TabList",
      reusable: true,
      componentRole: "master",
      componentName: "TabList",
    },
  );
  const tabRefOverview = createElement(
    ids.tabRefOverview,
    "Tab",
    {} as ComponentElementProps,
    {
      parent_id: ids.tabListOrigin,
      ref: ids.tabOrigin,
      componentRole: "instance",
      masterId: ids.tabOrigin,
      descendants: {
        [ids.tabLabel]: { props: { children: "Overview" } },
        [ids.tabIndicator]: { props: { enabled: true } },
      },
    },
  );
  const tabRefSettings = createElement(
    ids.tabRefSettings,
    "Tab",
    {} as ComponentElementProps,
    {
      parent_id: ids.tabListOrigin,
      ref: ids.tabOrigin,
      componentRole: "instance",
      masterId: ids.tabOrigin,
      descendants: {
        [ids.tabLabel]: { props: { children: "Settings" } },
      },
    },
  );

  const tabsOrigin = createElement(
    ids.tabsOrigin,
    "Tabs",
    {
      "aria-label": "Tabs",
      defaultSelectedKey: ids.tabRefOverview,
      orientation: "horizontal",
      showIndicator: true,
      style: {
        width: "100%",
      },
    } as ComponentElementProps,
    {
      name: "Tabs",
      reusable: true,
      componentRole: "master",
      componentName: "Tabs",
      slot: [ids.tabListOrigin],
    },
  );
  const tabsTabListRef = createElement(
    ids.tabsTabListRef,
    "TabList",
    {} as ComponentElementProps,
    {
      parent_id: ids.tabsOrigin,
      ref: ids.tabListOrigin,
      componentRole: "instance",
      masterId: ids.tabListOrigin,
    },
  );
  const panelOverview = createElement(
    ids.panelOverview,
    "TabPanel",
    { id: ids.tabRefOverview } as ComponentElementProps,
    { parent_id: ids.tabsOrigin },
  );
  const panelOverviewBody = createElement(
    ids.panelOverviewBody,
    "Text",
    { children: "Overview panel content" } as ComponentElementProps,
    { parent_id: ids.panelOverview },
  );
  const panelSettings = createElement(
    ids.panelSettings,
    "TabPanel",
    { id: ids.tabRefSettings } as ComponentElementProps,
    { parent_id: ids.tabsOrigin },
  );
  const panelSettingsBody = createElement(
    ids.panelSettingsBody,
    "Text",
    { children: "Settings panel content" } as ComponentElementProps,
    { parent_id: ids.panelSettings },
  );

  const tabsInstance = createElement(
    ids.tabsInstance,
    "Tabs",
    {
      "aria-label": "Tabs",
      defaultSelectedKey: ids.tabRefOverview,
      orientation: "horizontal",
      showIndicator: true,
      style: {
        width: "100%",
      },
    } as ComponentElementProps,
    {
      parent_id: options.parentId,
      page_id: pageId,
      ref: ids.tabsOrigin,
      componentRole: "instance",
      masterId: ids.tabsOrigin,
    },
  );

  return {
    parent: tabsInstance,
    children: [
      tabOrigin,
      tabLabel,
      tabIndicator,
      tabListOrigin,
      tabRefOverview,
      tabRefSettings,
      tabsOrigin,
      tabsTabListRef,
      panelOverview,
      panelOverviewBody,
      panelSettings,
      panelSettingsBody,
    ],
  };
}

function createTabsCompositeIds(idFactory: () => string): TabsCompositeIds {
  return {
    tabOrigin: idFactory(),
    tabLabel: idFactory(),
    tabIndicator: idFactory(),
    tabListOrigin: idFactory(),
    tabRefOverview: idFactory(),
    tabRefSettings: idFactory(),
    tabsOrigin: idFactory(),
    tabsTabListRef: idFactory(),
    panelOverview: idFactory(),
    panelOverviewBody: idFactory(),
    panelSettings: idFactory(),
    panelSettingsBody: idFactory(),
    tabsInstance: idFactory(),
  };
}

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
