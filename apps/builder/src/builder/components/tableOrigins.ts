/**
 * ADR-241 — Table 열 · 행 origin (Components 페이지 · 팔레트 밖) 과 TableHeader · TableBody slot, TableView 이관.
 *
 * - Column origin `component-table-column` (Phase 2) · Row origin `component-table-row` (Phase 3 — 행 모양만, 셀 자식 없음).
 *   Table · TableView 가 Column origin 을, TableView 가 Row origin 을 쓴다 (Radio origin 선례, 233).
 * - Table · TableView origin 의 TableHeader `slot` = `[Column origin]` · TableView 의 TableBody `slot` = `[Row origin]` — slot 이
 *   없을 때만 넣는다 (사용자가 바꾼 추천 목록 보존).
 * - TableView 이관 (Phase 3): plain Column → Column origin ref · plain Row → Row origin ref (셀 = 그 ref 의 자기 자식 — 노드째
 *   그대로). **id 를 유지** 하므로 바깥 instance `descendants` 경로 (`<body>/<row>/<cell>` · `<header>/<열>`) 가 같은 노드에 닿는다
 *   (선행 수리 — 두 해석기가 중첩 ref 자기 자식에 바깥 patch 를 적용). 행 하나라도 셀 수 ≠ 열 수면 그 TableView 는 이관하지 않는다
 *   (plain 그대로 · slot 없음 — 셀 동기화 대상 아님, 리뷰 r1 m2). 이관한 TableView 는 TableHeader · TableBody slot 도 연다.
 * - 멱등: origin · slot 이 있고 이관할 plain 열/행이 없으면 같은 문서 객체.
 * - 저장 history 의 스냅샷 (Components body · origin · 사용자 TableView subtree) 도 같은 보정을 거친다 — 이관 전 스냅샷을 Undo 로
 *   재생하면 origin 이 빠지거나 plain 행이 되살아난다 (ADR-240 F28 가족).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import { ensureTemplateOrigins } from "./ensureTemplateOrigins";
import { indexNodes } from "./staticCollectionMigration";

export const TABLE_COLUMN_ORIGIN_ID = "component-table-column";
export const TABLE_ROW_ORIGIN_ID = "component-table-row";
// origin id 는 리터럴 — catalog origin 모듈과 순환 import 안이다 (collectionSectionOrigins 와 같은 이유).
const TABLE_ORIGIN_ID = "component-table";
const TABLEVIEW_ORIGIN_ID = "component-tableview";
/** TableHeader slot 을 여는 owner origin. */
export const TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS: readonly string[] = [
  TABLE_ORIGIN_ID,
  TABLEVIEW_ORIGIN_ID,
];
const TABLE_ORIGIN_IDS = new Set([TABLE_COLUMN_ORIGIN_ID, TABLE_ROW_ORIGIN_ID]);

const typeOf = (node: CanonicalNode | undefined): string => String(node?.type);

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

export function createTableRowOrigin(): CanonicalNode {
  return {
    id: TABLE_ROW_ORIGIN_ID,
    type: "Row",
    name: "Row",
    reusable: true,
    props: {},
    metadata: {
      type: "table-row-origin",
      systemOwned: true,
      componentFamily: "TableView",
    },
  } as unknown as CanonicalNode;
}

function createOrigin(id: string): CanonicalNode {
  return id === TABLE_ROW_ORIGIN_ID
    ? createTableRowOrigin()
    : createTableColumnOrigin();
}

/** 행의 셀 수 = 열 수인가 (TableView 이관 · 셀 동기화 조건). 행 = TableBody 의 자식 (plain · ref). */
export function isTableViewAligned(tableView: CanonicalNode): boolean {
  const header = (tableView.children ?? []).find(
    (child) => typeOf(child) === "TableHeader",
  );
  const body = (tableView.children ?? []).find(
    (child) => typeOf(child) === "TableBody",
  );
  const columnCount = header?.children?.length ?? 0;
  return (body?.children ?? []).every(
    (row) => (row.children?.length ?? 0) === columnCount,
  );
}

function toRef(node: CanonicalNode, originId: string): CanonicalNode {
  return { ...node, type: "ref", ref: originId } as unknown as CanonicalNode;
}

/**
 * Table · TableView 노드 하나의 보정 — slot (없을 때만) · TableView 는 plain 열/행 → ref (정렬된 경우만). 바뀐 게 없으면 같은 객체.
 * `openSlots` 가 false 면 (사용자 plain Table) slot 을 건드리지 않는다.
 */
function patchTableNode(
  node: CanonicalNode,
  openSlots: boolean,
): CanonicalNode {
  const isTableView = typeOf(node) === "TableView";
  if (!isTableView && typeOf(node) !== "Table") return node;
  if (isTableView && !isTableViewAligned(node)) return node;
  let changed = false;
  const children = (node.children ?? []).map((child) => {
    if (typeOf(child) === "TableHeader") {
      let next = child;
      if (isTableView && child.children?.some((c) => typeOf(c) === "Column")) {
        next = {
          ...next,
          children: child.children.map((c) =>
            typeOf(c) === "Column" ? toRef(c, TABLE_COLUMN_ORIGIN_ID) : c,
          ),
        };
      }
      if (openSlots && !Array.isArray(next.slot)) {
        next = { ...next, slot: [TABLE_COLUMN_ORIGIN_ID] } as CanonicalNode;
      }
      if (next !== child) changed = true;
      return next;
    }
    if (isTableView && typeOf(child) === "TableBody") {
      let next = child;
      if (child.children?.some((c) => typeOf(c) === "Row")) {
        next = {
          ...next,
          children: child.children.map((c) =>
            typeOf(c) === "Row" ? toRef(c, TABLE_ROW_ORIGIN_ID) : c,
          ),
        };
      }
      if (openSlots && !Array.isArray(next.slot)) {
        next = { ...next, slot: [TABLE_ROW_ORIGIN_ID] } as CanonicalNode;
      }
      if (next !== child) changed = true;
      return next;
    }
    return child;
  });
  return changed ? { ...node, children } : node;
}

/**
 * subtree 안의 Table 가족 보정 — owner origin (Table · TableView) 과 사용자 TableView. ref `descendants` 안쪽 (instance 자기 노드) 은
 * 대상 밖. 바뀐 게 없으면 같은 객체.
 */
function patchTablesInNodes(nodes: readonly CanonicalNode[]): {
  nodes: CanonicalNode[];
  changed: boolean;
} {
  let changed = false;
  const next = nodes.map((node) => {
    const isOwnerOrigin = TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS.includes(node.id);
    let patched = patchTableNode(
      node,
      isOwnerOrigin || typeOf(node) === "TableView",
    );
    if (patched.children && typeOf(patched) !== "TableView") {
      const inner = patchTablesInNodes(patched.children);
      if (inner.changed) patched = { ...patched, children: inner.nodes };
    }
    if (patched !== node) changed = true;
    return patched;
  });
  return { nodes: changed ? next : (nodes as CanonicalNode[]), changed };
}

export function ensureTableOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let byId = indexNodes(document);
  // Table 가족 origin 이 하나도 없으면 (catalog seed 전) 보류 — 다음 hydration.
  if (!TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS.some((id) => byId.has(id))) {
    return document;
  }
  let next = document;
  const missing = [...TABLE_ORIGIN_IDS].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    next = ensureTemplateOrigins(next, new Set(missing), (existing) =>
      missing.map((id) => existing.get(id) ?? createOrigin(id)),
    );
    byId = indexNodes(next);
  }
  const patched = patchTablesInNodes(next.children);
  return patched.changed ? { ...next, children: patched.nodes } : next;
}

/**
 * history 스냅샷 보정 — Components body 스냅샷이면 origin 보충 + owner slot · TableView 이관, 그 밖의 subtree 는 Table 가족 보정만
 * (멱등, 같은 객체).
 */
export function ensureTableOriginsInSnapshot(
  node: CanonicalNode,
): CanonicalNode {
  const patched = patchTablesInNodes([node]);
  let next = patched.nodes[0]!;
  if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
    const children = next.children ?? [];
    const hasOwner = children.some((child) =>
      TABLE_HEADER_SLOT_OWNER_ORIGIN_IDS.includes(child.id),
    );
    const absent = [...TABLE_ORIGIN_IDS].filter(
      (id) => !children.some((child) => child.id === id),
    );
    if (hasOwner && absent.length > 0) {
      next = { ...next, children: [...children, ...absent.map(createOrigin)] };
    }
  }
  return next;
}
