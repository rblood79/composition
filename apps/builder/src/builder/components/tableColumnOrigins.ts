/**
 * ADR-241 Phase 2 — Table 열 origin (Components 페이지 · 팔레트 밖) 과 TableHeader slot.
 *
 * - Column origin `component-table-column` (RAC `Column` — 글자 한 줄). Table · TableView 가 같이 쓴다 (Radio origin 선례, 233).
 * - Table · TableView origin 의 TableHeader `slot` = `[Column origin]` — slot 이 없을 때만 넣는다 (사용자가 바꾼 추천 목록 보존).
 * - 멱등: origin 이 있고 slot 이 이미 있으면 같은 문서 객체.
 * - 저장 history 의 Components body 스냅샷 (origin 편집 = body 전체 remove+insert, ADR-240 F28) 도 같은 보정을 거친다 —
 *   이관 전 스냅샷을 Undo 로 재생하면 Column origin 이 빠져 instance 열 (Column ref) 이 origin 을 잃는다.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import { ensureTemplateOrigins } from "./ensureTemplateOrigins";
import { indexNodes } from "./staticCollectionMigration";

export const TABLE_COLUMN_ORIGIN_ID = "component-table-column";
// origin id 는 리터럴 — catalog origin 모듈과 순환 import 안이다 (collectionSectionOrigins 와 같은 이유).
const TABLE_ORIGIN_ID = "component-table";
const TABLEVIEW_ORIGIN_ID = "component-tableview";
/** TableHeader slot 을 여는 owner origin. */
export const TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS: readonly string[] = [
  TABLE_ORIGIN_ID,
  TABLEVIEW_ORIGIN_ID,
];

export function createTableColumnOrigin(): CanonicalNode {
  return {
    id: TABLE_COLUMN_ORIGIN_ID,
    type: "Column",
    name: "Column",
    reusable: true,
    props: { children: "Column" },
    metadata: {
      type: "table-column-origin",
      systemOwned: true,
      componentFamily: "Table",
    },
  } as unknown as CanonicalNode;
}

/** owner origin 의 TableHeader 에 slot 이 없으면 Column origin 추천을 넣은 owner (아니면 같은 객체). */
function withHeaderSlot(owner: CanonicalNode): CanonicalNode {
  let changed = false;
  const children = (owner.children ?? []).map((child) => {
    if (String(child.type) !== "TableHeader" || Array.isArray(child.slot)) return child;
    changed = true;
    return { ...child, slot: [TABLE_COLUMN_ORIGIN_ID] } as CanonicalNode;
  });
  return changed ? { ...owner, children } : owner;
}

const OWNER_IDS = new Set(TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS);

/** Components body 자식 목록에서 owner origin 의 slot 을 보정하고, Column origin 이 없으면 끝에 붙인다. */
function patchComponentsBodyChildren(
  children: readonly CanonicalNode[],
  addOrigin: boolean,
): CanonicalNode[] | null {
  let changed = false;
  const next = children.map((child) => {
    if (!OWNER_IDS.has(child.id)) return child;
    const patched = withHeaderSlot(child);
    if (patched !== child) changed = true;
    return patched;
  });
  if (addOrigin && !next.some((child) => child.id === TABLE_COLUMN_ORIGIN_ID)) {
    next.push(createTableColumnOrigin());
    changed = true;
  }
  return changed ? next : null;
}

export function ensureTableColumnOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let byId = indexNodes(document);
  // Table 가족 origin 이 하나도 없으면 (catalog seed 전) 보류 — 다음 hydration.
  if (!TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS.some((id) => byId.has(id))) {
    return document;
  }
  let next = document;
  if (!byId.has(TABLE_COLUMN_ORIGIN_ID)) {
    next = ensureTemplateOrigins(
      next,
      new Set([TABLE_COLUMN_ORIGIN_ID]),
      (existing) => [
        existing.get(TABLE_COLUMN_ORIGIN_ID) ?? createTableColumnOrigin(),
      ],
    );
    byId = indexNodes(next);
  }
  const owners = TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS.map((id) =>
    byId.get(id),
  ).filter((owner): owner is CanonicalNode => Boolean(owner));
  const upgrades = new Map<string, CanonicalNode>();
  for (const owner of owners) {
    const patched = withHeaderSlot(owner);
    if (patched !== owner) upgrades.set(owner.id, patched);
  }
  if (upgrades.size === 0) return next;
  const replace = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const upgraded = upgrades.get(node.id);
      if (upgraded) return upgraded;
      return node.children
        ? { ...node, children: replace(node.children) }
        : node;
    });
  return { ...next, children: replace(next.children) };
}

/**
 * history 스냅샷 보정 — Components body 스냅샷이면 owner slot + Column origin, owner origin 하나면 slot 만 (멱등, 같은 객체).
 */
export function ensureTableColumnOriginsInSnapshot(
  node: CanonicalNode,
): CanonicalNode {
  if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
    const children = node.children ?? [];
    const hasOwner = children.some((child) => OWNER_IDS.has(child.id));
    const patched = patchComponentsBodyChildren(children, hasOwner);
    return patched ? { ...node, children: patched } : node;
  }
  return OWNER_IDS.has(node.id) ? withHeaderSlot(node) : node;
}
