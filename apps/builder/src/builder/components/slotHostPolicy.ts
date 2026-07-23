import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
} from "./listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "./gridlist/gridListTemplateOrigins";

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

export function isSlotHostElement(
  element: SlotPolicyElement | undefined,
): boolean {
  if (!element) return false;
  if (isListBoxPolicyActive(element)) return true;
  if (isGridListPolicyActive(element)) return true;
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
