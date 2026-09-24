/**
 * ADR-238 Phase 2 — 목록 section origin (Components 페이지) · owner slot 추천.
 *
 * - section origin 3: `component-listbox-section` · `component-menu-section` · `component-gridlist-section` — RAC section
 *   type (`ListBoxSection` …) · 자식 = Header + 항목 origin 의 instance 2 (`props.id` = `item-1` · `item-2`). section
 *   origin 자신도 slot host (후보 = 그 목록의 항목 origin — owner slot 의 항목 후보와 같다).
 * - owner origin (ListBox · Menu · GridList) 의 slot 에 section origin 을 더한다 — slot 이 시스템 항목 후보만 담고
 *   있을 때만 (사용자가 바꾼 추천 목록은 그대로, 237 그룹 slot 과 같은 보존 규칙).
 * - 멱등: section origin 이 다 있고 slot 이 이미 맞으면 같은 문서 객체.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureTemplateOrigins } from "./ensureTemplateOrigins";
import {
  GRIDLIST_STATIC_FAMILY,
  LISTBOX_STATIC_FAMILY,
  MENU_STATIC_FAMILY,
  buildItemInstances,
  indexNodes,
  type StaticCollectionFamily,
} from "./staticCollectionMigration";

export const LISTBOX_SECTION_ORIGIN_ID = "component-listbox-section";
export const MENU_SECTION_ORIGIN_ID = "component-menu-section";
export const GRIDLIST_SECTION_ORIGIN_ID = "component-gridlist-section";
// origin id 는 리터럴 — 항목 origin 모듈과 순환 import 안이라 그 상수 (와 `*_STATIC_FAMILY.defaultOriginId`) 가
//   진입 순서에 따라 undefined 다 (새 프로젝트 경로 실측).
const LISTBOX_ORIGIN_ID = "component-listbox";
const LISTBOX_ITEM_DEFAULT_ORIGIN_ID = "component-listbox-item-default";
const LISTBOX_ITEM_SELECTED_ORIGIN_ID = "component-listbox-item-selected";
const MENU_ORIGIN_ID = "component-menu";
const MENU_ITEM_DEFAULT_ORIGIN_ID = "component-menu-item-default";
const GRIDLIST_ORIGIN_ID = "component-gridlist";
const GRIDLIST_ITEM_DEFAULT_ORIGIN_ID = "component-gridlist-item-default";

export interface CollectionSectionFamily {
  ownerOriginId: string;
  ownerType: string;
  sectionType: string;
  sectionOriginId: string;
  itemFamily: StaticCollectionFamily;
  /** 항목 origin id (section origin 의 항목 instance 가 가리킨다). */
  itemOriginId: string;
  /** owner slot 의 시스템 항목 후보 — 이것만 담긴 slot 에 section origin 을 더한다. */
  systemItemCandidates: readonly string[];
}

/**
 * 가족 표는 **지연 평가** — 이 모듈은 항목 origin 모듈과 순환 import 안에 있어 (listBoxTemplateOrigins → … →
 * reusableCompositeOrigins → 여기), 모듈 평가 시점에 상수를 읽으면 진입 순서에 따라 undefined 가 된다 (새 프로젝트
 * 경로에서 ListBox section origin 이 조용히 빠졌다).
 */
let familiesCache: readonly CollectionSectionFamily[] | null = null;
export function getCollectionSectionFamilies(): readonly CollectionSectionFamily[] {
  familiesCache ??= [] = [
    {
      ownerOriginId: LISTBOX_ORIGIN_ID,
      ownerType: "ListBox",
      sectionType: "ListBoxSection",
      sectionOriginId: LISTBOX_SECTION_ORIGIN_ID,
      itemFamily: LISTBOX_STATIC_FAMILY,
      itemOriginId: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      systemItemCandidates: [
        `${LISTBOX_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
        LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
        LISTBOX_ITEM_SELECTED_ORIGIN_ID,
      ],
    },
    {
      ownerOriginId: MENU_ORIGIN_ID,
      ownerType: "Menu",
      sectionType: "MenuSection",
      sectionOriginId: MENU_SECTION_ORIGIN_ID,
      itemFamily: MENU_STATIC_FAMILY,
      itemOriginId: MENU_ITEM_DEFAULT_ORIGIN_ID,
      systemItemCandidates: [MENU_ITEM_DEFAULT_ORIGIN_ID],
    },
    {
      ownerOriginId: GRIDLIST_ORIGIN_ID,
      ownerType: "GridList",
      sectionType: "GridListSection",
      sectionOriginId: GRIDLIST_SECTION_ORIGIN_ID,
      itemFamily: GRIDLIST_STATIC_FAMILY,
      itemOriginId: GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
      systemItemCandidates: [
        `${GRIDLIST_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
        GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
      ],
    },
  ];
  return familiesCache;
}

const SECTION_ORIGIN_IDS: ReadonlySet<string> = new Set([
  LISTBOX_SECTION_ORIGIN_ID,
  MENU_SECTION_ORIGIN_ID,
  GRIDLIST_SECTION_ORIGIN_ID,
]);

/** section origin 의 기본 항목 행 (항목 origin 의 label 에 싣는다). */
const SECTION_SAMPLE_ROWS: ReadonlyArray<Record<string, string>> = [
  { id: "item-1", label: "Item 1" },
  { id: "item-2", label: "Item 2" },
];

/** section 의 항목 후보 = owner slot 의 항목 후보 (section origin 은 빼고) — 없으면 항목 origin 하나. */
function itemCandidatesOf(
  family: CollectionSectionFamily,
  owner: CanonicalNode | undefined,
  byId: ReadonlyMap<string, CanonicalNode>,
): string[] {
  const slot = Array.isArray(owner?.slot) ? owner.slot : [];
  const items = slot.filter(
    (id): id is string =>
      typeof id === "string" && !SECTION_ORIGIN_IDS.has(id) && byId.has(id),
  );
  return items.length > 0 ? items : [family.itemOriginId];
}

function createSectionOrigin(
  family: CollectionSectionFamily,
  byId: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode | null {
  const itemOrigin = byId.get(family.itemOriginId);
  if (!itemOrigin) return null; // 보류 — 항목 origin 이 생기면 다음 hydration 에서.
  const id = family.sectionOriginId;
  const taken = new Set(byId.keys());
  return {
    id,
    type: family.sectionType,
    name: family.sectionType,
    reusable: true,
    props: {},
    slot: itemCandidatesOf(family, byId.get(family.ownerOriginId), byId),
    children: [
      {
        id: `${id}__header`,
        type: "Header",
        name: "Header",
        props: { children: "Section" },
      } as CanonicalNode,
      ...buildItemInstances(
        family.itemFamily,
        SECTION_SAMPLE_ROWS,
        id,
        itemOrigin,
        taken,
      ),
    ],
    metadata: {
      type: "collection-section-origin",
      systemOwned: true,
      componentFamily: family.ownerType,
    },
  } as CanonicalNode;
}

/** owner slot 이 시스템 항목 후보만 담고 section origin 이 없으면 더한 slot (아니면 null). */
function upgradedOwnerSlot(
  family: CollectionSectionFamily,
  owner: CanonicalNode | undefined,
): string[] | null {
  if (!owner || !Array.isArray(owner.slot)) return null;
  const slot = owner.slot as unknown[];
  if (slot.includes(family.sectionOriginId)) return null;
  const system = new Set(family.systemItemCandidates);
  if (!slot.every((id) => typeof id === "string" && system.has(id))) {
    return null;
  }
  return [...(slot as string[]), family.sectionOriginId];
}

function replaceNodes(
  nodes: readonly CanonicalNode[],
  replacements: ReadonlyMap<string, CanonicalNode>,
): { nodes: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const next = nodes.map((node) => {
    const replaced = replacements.get(node.id);
    if (replaced) {
      changed = true;
      return replaced;
    }
    if (!node.children) return node;
    const inner = replaceNodes(node.children, replacements);
    if (!inner.changed) return node;
    changed = true;
    return { ...node, children: inner.nodes };
  });
  return { nodes: next, changed };
}

export function ensureCollectionSectionOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let byId = indexNodes(document);
  let next = document;
  const missing = getCollectionSectionFamilies().filter(
    (family) =>
      !byId.has(family.sectionOriginId) &&
      byId.has(family.itemOriginId),
  );
  if (missing.length > 0) {
    const created = new Map<string, CanonicalNode>();
    for (const family of missing) {
      const origin = createSectionOrigin(family, byId);
      if (origin) created.set(origin.id, origin);
    }
    next = ensureTemplateOrigins(next, new Set(created.keys()), (existing) =>
      [...created.values()].map((origin) => existing.get(origin.id) ?? origin),
    );
    byId = indexNodes(next);
  }
  const slotUpgrades = new Map<string, CanonicalNode>();
  for (const family of getCollectionSectionFamilies()) {
    if (!byId.has(family.sectionOriginId)) continue;
    const owner = byId.get(family.ownerOriginId);
    const slot = upgradedOwnerSlot(family, owner);
    if (owner && slot) slotUpgrades.set(owner.id, { ...owner, slot });
  }
  if (slotUpgrades.size === 0) return next;
  const replaced = replaceNodes(next.children, slotUpgrades);
  return replaced.changed ? { ...next, children: replaced.nodes } : next;
}
