/**
 * Tabs items SSOT — add/remove helpers (ADR-066)
 *
 * TabsEditor (Properties panel)와 TabListActionOverlay (Canvas)가 공유.
 * items 배열과 TabPanel element 동기화.
 */

import { ElementUtils } from "../../../../utils/element/elementUtils";
import { useStore } from "../../../stores";
import type { TabItem } from "@composition/specs";
import type {
  PropertyEditorChildNode,
  PropertyEditorElementPayload,
} from "./propertyEditorNode";

export async function addTabItem(params: {
  tabsElementId: string;
  pageId: string;
  elements: readonly PropertyEditorChildNode[];
  items: TabItem[];
  currentProps: Record<string, unknown>;
  onUpdate: (props: Record<string, unknown>) => void;
  addElement: (element: PropertyEditorElementPayload) => Promise<void>;
}): Promise<void> {
  const {
    tabsElementId,
    pageId,
    elements,
    items,
    currentProps,
    onUpdate,
    addElement,
  } = params;

  const newItemId = ElementUtils.generateId();
  const newItem: TabItem = {
    id: newItemId,
    title: `Tab ${items.length + 1}`,
  };

  const tabPanelsEl = elements.find(
    (el) => el.parent_id === tabsElementId && el.type === "TabPanels",
  );
  if (!tabPanelsEl) {
    throw new Error(`TabPanels element not found under Tabs ${tabsElementId}`);
  }

  const newPanelElement: PropertyEditorElementPayload = {
    id: ElementUtils.generateId(),
    page_id: pageId,
    type: "TabPanel",
    props: { itemId: newItemId },
    parent_id: tabPanelsEl.id,
  };

  const nextItems = [...items, newItem];
  const updatedProps: Record<string, unknown> = { items: nextItems };
  if (items.length === 0) {
    updatedProps.defaultSelectedKey = newItemId;
  } else if (!currentProps.defaultSelectedKey) {
    updatedProps.defaultSelectedKey = nextItems[0].id;
  }

  onUpdate(updatedProps);
  await addElement(newPanelElement);
}

export async function removeTabItem(params: {
  tabsElementId: string;
  itemId: string;
  elements: readonly PropertyEditorChildNode[];
  items: TabItem[];
  currentProps: Record<string, unknown>;
  onUpdate: (props: Record<string, unknown>) => void;
  removeElement: (elementId: string) => Promise<void>;
}): Promise<void> {
  const {
    tabsElementId,
    itemId,
    elements,
    items,
    currentProps,
    onUpdate,
    removeElement,
  } = params;

  // ADR-066 Q3: 최소 1개 유지 가드
  if (items.length <= 1) {
    console.warn("Tabs: 최소 1개 탭은 유지되어야 합니다.");
    return;
  }

  const tabPanelsEl = elements.find(
    (el) => el.parent_id === tabsElementId && el.type === "TabPanels",
  );
  if (!tabPanelsEl) return;

  const panelEl = elements.find(
    (el) =>
      el.parent_id === tabPanelsEl.id &&
      el.type === "TabPanel" &&
      (el.props as { itemId?: string }).itemId === itemId,
  );

  const nextItems = items.filter((item) => item.id !== itemId);
  const updatedProps: Record<string, unknown> = { items: nextItems };
  if (currentProps.defaultSelectedKey === itemId && nextItems.length > 0) {
    updatedProps.defaultSelectedKey = nextItems[0].id;
  }

  onUpdate(updatedProps);
  if (panelEl) {
    await removeElement(panelEl.id);
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolvePageId(
  currentPageId: string | null,
): Promise<string | null> {
  if (currentPageId) return currentPageId;

  const pathParts = window.location.pathname.split("/");
  const urlPageId = pathParts[pathParts.length - 1];
  if (urlPageId && UUID_REGEX.test(urlPageId)) {
    return urlPageId;
  }

  return useStore.getState().pages[0]?.id ?? null;
}
