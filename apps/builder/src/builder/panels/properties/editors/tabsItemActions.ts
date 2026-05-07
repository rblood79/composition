/**
 * Tabs items SSOT — add/remove helpers (ADR-066)
 *
 * TabsEditor (Properties panel)와 TabListActionOverlay (Canvas)가 공유.
 * items 배열과 TabPanel element 동기화.
 */

import type { Element } from "../../../../types/core/store.types";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { getDB } from "../../../../lib/db";
import { useStore } from "../../../stores";
import type { TabItem } from "@composition/specs";

export async function addTabItem(params: {
  tabsElementId: string;
  pageId: string;
  items: TabItem[];
  currentProps: Record<string, unknown>;
  onUpdate: (props: Record<string, unknown>) => void;
  addElement: (element: Element) => Promise<void>;
}): Promise<void> {
  const { tabsElementId, pageId, items, currentProps, onUpdate, addElement } =
    params;

  const newItemId = ElementUtils.generateId();
  const newItem: TabItem = {
    id: newItemId,
    title: `Tab ${items.length + 1}`,
  };

  const { elements } = useStore.getState();
  const tabPanelsEl = elements.find(
    (el) => el.parent_id === tabsElementId && el.type === "TabPanels",
  );
  if (!tabPanelsEl) {
    throw new Error(`TabPanels element not found under Tabs ${tabsElementId}`);
  }

  const newPanelElement: Element = {
    id: ElementUtils.generateId(),
    page_id: pageId,
    type: "TabPanel",
    props: { itemId: newItemId },
    parent_id: tabPanelsEl.id,
  };

  const db = await getDB();
  const insertedPanel = await db.elements.insert(newPanelElement);

  const nextItems = [...items, newItem];
  const updatedProps: Record<string, unknown> = { items: nextItems };
  if (items.length === 0) {
    updatedProps.defaultSelectedKey = newItemId;
  } else if (!currentProps.defaultSelectedKey) {
    updatedProps.defaultSelectedKey = nextItems[0].id;
  }

  try {
    await db.elements.update(tabsElementId, { props: updatedProps });
  } catch (err) {
    console.warn("⚠️ [IndexedDB] update Tabs items failed:", err);
  }

  onUpdate(updatedProps);
  await addElement(insertedPanel);
}

export async function removeTabItem(params: {
  tabsElementId: string;
  itemId: string;
  items: TabItem[];
  currentProps: Record<string, unknown>;
  onUpdate: (props: Record<string, unknown>) => void;
  removeElement: (elementId: string) => Promise<void>;
}): Promise<void> {
  const {
    tabsElementId,
    itemId,
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

  const { elements } = useStore.getState();
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

  const db = await getDB();
  try {
    await db.elements.update(tabsElementId, { props: updatedProps });
  } catch (err) {
    console.warn("⚠️ [IndexedDB] update Tabs items failed:", err);
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

  const projectId = pathParts[pathParts.length - 2];
  if (!projectId) return null;

  try {
    const db = await getDB();
    const pages = await db.pages.getByProject(projectId);
    if (!pages || pages.length === 0) return null;

    const sortedPages = pages.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
    return sortedPages[0].id;
  } catch (err) {
    console.error("❌ [IndexedDB] Failed to resolve page ID:", err);
    return null;
  }
}
