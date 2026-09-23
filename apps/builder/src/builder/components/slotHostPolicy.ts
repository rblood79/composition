import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
} from "./listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "./gridlist/gridListTemplateOrigins";
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

// ADR-229 Phase 2: TagGroup item template slot host (ListBox 대칭 — root `component-taggroup.slot`,
//   후보는 Tag item origin 2 · selected variant 포함).
const TAG_ITEM_ORIGIN_IDS = new Set([
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
]);

// ADR-233 Phase 1: Tabs 의 Tab 항목 template slot host (root `component-tabs.slot`, Tag 대칭).
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

function isTagGroupHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return normalizeType(element.type) === "taggroup";
}

function isTagGroupPolicyActive(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!isTagGroupHost(element)) return false;
  return element?.reusable === true || element?.metadata?.systemOwned === true;
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

function isTabsHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return normalizeType(element.type) === "tabs";
}

/** ADR-234 Phase 3 — slot 을 가진 TabList (Tabs 의 목록 틀). */
function isTabListHost(element: SlotPolicyElement | undefined): boolean {
  if (!element) return false;
  return (
    normalizeType(element.type) === "tablist" &&
    Array.isArray((element as { slot?: unknown }).slot)
  );
}

function isTabsPolicyActive(element: SlotPolicyElement | undefined): boolean {
  if (!isTabsHost(element)) return false;
  return element?.reusable === true || element?.metadata?.systemOwned === true;
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
 * ADR-229 Phase 3 후속 (사용자 지적 2026-09-21) — Slot 절 "Insert" 의 뜻이 host 마다 다르다.
 * Frame 가족은 slot 에 ref 자식을 넣고, ListBox/GridList 도 (ADR-148 template anchor) ref 자식이다.
 * TagGroup 은 chip 이 `items[]` 데이터라 (ADR-097 Addendum 1) ref 자식을 root 에 넣어도 TagList 에
 * 아무것도 안 생긴다 — Tag item template "+" 는 **item 등록** 이고 selected variant 는 selectedKeys 까지.
 */
export type SlotInsertAction =
  | { kind: "child" }
  | { kind: "collection-item"; itemsKey: "items"; selected: boolean }
  // ADR-234 Phase 3 — TabList (목록 틀) 의 "+" = Tab instance + 짝 TabPanel (`collectionItemInsert`).
  | { kind: "tab-item" }
  // ADR-233: Tabs root slot (이관 전 문서) 의 Tab 은 `items` + TabPanel `itemId` 쌍 (ADR-066) 이라 추가
  //   경로가 없다 — "삽입 없음". 버튼을 숨긴다.
  | { kind: "none" };

export function resolveSlotInsertAction(
  host: SlotPolicyElement | undefined,
  candidate: SlotPolicyElement | undefined,
): SlotInsertAction {
  if (isTabListHost(host) && isTabItemTemplateVariant(candidate)) {
    return { kind: "tab-item" };
  }
  if (isTabsHost(host) && isTabItemTemplateVariant(candidate)) {
    return { kind: "none" };
  }
  if (isTagGroupHost(host) && isTagItemTemplateVariant(candidate)) {
    return {
      kind: "collection-item",
      itemsKey: "items",
      selected: isTagItemSelectedVariant(candidate),
    };
  }
  return { kind: "child" };
}

function isTagItemSelectedVariant(
  candidate: SlotPolicyElement | undefined,
): boolean {
  if (!candidate) return false;
  if (candidate.metadata?.variant === "selected") return true;
  return [candidate.id, candidate.ref, candidate._resolvedFrom].includes(
    TAG_ITEM_SELECTED_ORIGIN_ID,
  );
}

export function isSlotHostElement(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!element) return false;
  if (isListBoxPolicyActive(element)) return true;
  if (isGridListPolicyActive(element)) return true;
  if (isTagGroupPolicyActive(element)) return true;
  if (isTabsPolicyActive(element)) return true;
  if (isTabListHost(element)) return true;
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
  if (isTagGroupHost(host)) {
    return isTagItemTemplateVariant(candidate);
  }
  if (isTabsHost(host) || isTabListHost(host)) {
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
