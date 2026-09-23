import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
} from "./listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "./gridlist/gridListTemplateOrigins";
import { MENU_ITEM_DEFAULT_ORIGIN_ID } from "./menu/menuTemplateOrigins";
import {
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
} from "./taggroup/tagGroupTemplateOrigins";
import {
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
} from "./tabs/tabsTemplateOrigins";

export type SlotPolicyElement = {
  _resolvedFrom?: string;
  componentName?: string | null;
  customId?: string | null;
  id: string;
  metadata?: Record<string, unknown>;
  name?: string | null;
  ref?: string;
  reusable?: boolean;
  type: string;
};

export const FRAME_SLOT_HOST_TYPES = new Set([
  "box",
  "cardcontent",
  "cardfooter",
  "cardheader",
  "frame",
  "group",
  "section",
]);

const LISTBOX_ITEM_ORIGIN_IDS = new Set([
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
]);

// ADR-161 Phase 7: GridList slot host parity (ListBox 대칭). GridList 는 selected-variant
//   origin 없이 item-default 단일 (컨테이너 slot:[item-default]).
const GRIDLIST_ITEM_ORIGIN_IDS = new Set([GRIDLIST_ITEM_DEFAULT_ORIGIN_ID]);

// ADR-229 Phase 2 → ADR-234 Phase 3: Tag 항목 origin (slot host = TagList,
//   후보는 Tag item origin 2 · selected variant 포함).
const TAG_ITEM_ORIGIN_IDS = new Set([
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
]);

// ADR-233 Phase 1 → ADR-234 Phase 3: Tab 항목 origin (slot host = TabList).
const TAB_ITEM_ORIGIN_IDS = new Set([
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
]);

function normalizeType(type: string | undefined): string {
  return (type ?? "").toLowerCase();
}

function getElementLabel(element: SlotPolicyElement): string {
  return (
    element.componentName ?? element.customId ?? element.name ?? element.type
  );
}

function isListBoxHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return normalizeType(element.type) === "listbox";
}

function isListBoxPolicyActive(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!isListBoxHost(element)) return false;
  return element?.reusable === true || element?.metadata?.systemOwned === true;
}

function isListBoxItemTemplateVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (LISTBOX_ITEM_ORIGIN_IDS.has(candidate.id)) return true;
  if (candidate.ref && LISTBOX_ITEM_ORIGIN_IDS.has(candidate.ref)) return true;
  if (
    candidate._resolvedFrom &&
    LISTBOX_ITEM_ORIGIN_IDS.has(candidate._resolvedFrom)
  ) {
    return true;
  }

  const label = getElementLabel(candidate).toLowerCase();
  return label.startsWith("listboxitem/");
}

// ADR-161 Phase 7: GridList host 판정 (isListBoxHost 대칭).
function isGridListHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return normalizeType(element.type) === "gridlist";
}

function isGridListPolicyActive(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!isGridListHost(element)) return false;
  return element?.reusable === true || element?.metadata?.systemOwned === true;
}

function isGridListItemTemplateVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (GRIDLIST_ITEM_ORIGIN_IDS.has(candidate.id)) return true;
  if (candidate.ref && GRIDLIST_ITEM_ORIGIN_IDS.has(candidate.ref)) return true;
  if (
    candidate._resolvedFrom &&
    GRIDLIST_ITEM_ORIGIN_IDS.has(candidate._resolvedFrom)
  ) {
    return true;
  }

  const label = getElementLabel(candidate).toLowerCase();
  return label.startsWith("gridlistitem/");
}

// ADR-234 Phase 3f — Menu 는 자기가 목록 틀 (항목 = MenuItem instance 자식, popover 안).
function isMenuHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return normalizeType(element.type) === "menu";
}

function isMenuPolicyActive(element: SlotPolicyElement | undefined): boolean {
  if (!isMenuHost(element)) return false;
  return element?.reusable === true || element?.metadata?.systemOwned === true;
}

function isMenuItemTemplateVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (
    [candidate.id, candidate.ref, candidate._resolvedFrom].includes(
      MENU_ITEM_DEFAULT_ORIGIN_ID,
    )
  ) {
    return true;
  }
  return getElementLabel(candidate).toLowerCase().startsWith("menuitem/");
}

function isTagItemTemplateVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (TAG_ITEM_ORIGIN_IDS.has(candidate.id)) return true;
  if (candidate.ref && TAG_ITEM_ORIGIN_IDS.has(candidate.ref)) return true;
  if (
    candidate._resolvedFrom &&
    TAG_ITEM_ORIGIN_IDS.has(candidate._resolvedFrom)
  ) {
    return true;
  }
  const label = getElementLabel(candidate).toLowerCase();
  return label.startsWith("tag/");
}

/** ADR-234 Phase 3 — slot 을 가진 TabList (Tabs 의 목록 틀). */
function isTabListHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return (
    normalizeType(element.type) === "tablist" &&
    Array.isArray((element as { slot?: unknown }).slot)
  );
}

/** ADR-234 Phase 3 — slot 을 가진 TagList (TagGroup 의 목록 틀). */
function isTagListHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return (
    normalizeType(element.type) === "taglist" &&
    Array.isArray((element as { slot?: unknown }).slot)
  );
}

function isTabItemTemplateVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (TAB_ITEM_ORIGIN_IDS.has(candidate.id)) return true;
  if (candidate.ref && TAB_ITEM_ORIGIN_IDS.has(candidate.ref)) return true;
  if (
    candidate._resolvedFrom &&
    TAB_ITEM_ORIGIN_IDS.has(candidate._resolvedFrom)
  ) {
    return true;
  }
  const label = getElementLabel(candidate).toLowerCase();
  return label.startsWith("tab/");
}

/**
 * Slot 절 "Insert" 의 뜻 — Frame 가족은 slot 에 ref 자식을 넣고, 목록 틀 (TabList · TagList · ListBox · GridList ·
 * Menu) 은 항목 instance 를 넣는다 (ADR-234 Phase 3 — slot 은 목록 틀에만 있다. TagGroup · Tabs root 는 host 아님).
 */
export type SlotInsertAction =
  | { kind: "child" }
  // ADR-234 Phase 3 — 목록 틀 (TabList · TagList · ListBox) 의 "+" = 항목 instance (Tabs 는 짝 TabPanel 도 —
  //   `collectionItemInsert`).
  | { kind: "list-item" };

export function resolveSlotInsertAction(
  host: SlotPolicyElement | undefined,
  candidate: SlotPolicyElement | undefined,
): SlotInsertAction {
  if (isTabListHost(host) && isTabItemTemplateVariant(candidate)) {
    return { kind: "list-item" };
  }
  if (isTagListHost(host) && isTagItemTemplateVariant(candidate)) {
    return { kind: "list-item" };
  }
  // ListBox 는 자기가 목록 틀 — 정적 목록의 "+" 는 ListBoxItem instance 자식 (바인딩 목록의 행은 데이터).
  if (isListBoxHost(host) && isListBoxItemTemplateVariant(candidate)) {
    return { kind: "list-item" };
  }
  if (isGridListHost(host) && isGridListItemTemplateVariant(candidate)) {
    return { kind: "list-item" };
  }
  if (isMenuHost(host) && isMenuItemTemplateVariant(candidate)) {
    return { kind: "list-item" };
  }
  return { kind: "child" };
}

export function isSlotHostElement(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!element) return false;
  if (isListBoxPolicyActive(element)) return true;
  if (isGridListPolicyActive(element)) return true;
  if (isMenuPolicyActive(element)) return true;
  if (isTabListHost(element) || isTagListHost(element)) return true;
  return FRAME_SLOT_HOST_TYPES.has(normalizeType(element.type));
}

export function isSlotCandidateAllowed(
  host: SlotPolicyElement | undefined,
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!host || !candidate) return false;
  if (isListBoxHost(host)) {
    return isListBoxItemTemplateVariant(candidate);
  }
  if (isGridListHost(host)) {
    return isGridListItemTemplateVariant(candidate);
  }
  if (isMenuHost(host)) {
    return isMenuItemTemplateVariant(candidate);
  }
  if (isTagListHost(host)) {
    return isTagItemTemplateVariant(candidate);
  }
  if (isTabListHost(host)) {
    return isTabItemTemplateVariant(candidate);
  }
  return true;
}

export function filterSlotCandidates<T extends SlotPolicyElement>(
  host: SlotPolicyElement | undefined,
  candidates: readonly T[],
): T[] {
  return candidates.filter(
    (candidate) =>
      candidate.reusable === true && isSlotCandidateAllowed(host, candidate),
  );
}
