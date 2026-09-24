/**
 * ADR-241 Phase 2 — Table 열 추가 계획 (Slot "+" · quick connect · Preview `ADD_COLUMN_ELEMENTS` 공용).
 *
 * - 열 = Column origin (`component-table-column`) 의 instance (`type: "ref"`, `props.key` · `props.children`).
 * - plain TableHeader (문서 Table · origin): 자식으로 덧붙인다.
 * - instance 의 TableHeader (`<instance>/<path>` — origin 안쪽 노드): 바깥 instance `descendants[path].children` (mode C, 234 Tabs
 *   TabList 선례). 처음이면 origin 의 현재 열을 복제해 이어 쓰고, 그 열에 붙어 있던 바깥 patch (`descendants["path/열"]` —
 *   글자 · 폭 편집) 는 복제본 props 로 옮긴다 (경로가 복제본 id 로 바뀌므로 그대로 두면 편집이 사라진다).
 * - `key` 는 형제 열 (유효 props — ref 는 origin props 위에 자기 props) 과 겹치지 않게 배정한다 (R3). 명시 key (quick connect
 *   schema) 는 그대로 쓴다.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveTableColumnKey } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import {
  getSyntheticDescendantPathKey,
  getSyntheticDescendantRootId,
  isSyntheticDescendantId,
} from "../stores/canonical/syntheticDescendantLookup";
import { indexNodes, resolveChainEnd } from "./staticCollectionMigration";
import { TABLE_COLUMN_ORIGIN_ID, TABLE_ROW_ORIGIN_ID } from "./tableOrigins";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

export type TableColumnSpec = {
  key: string;
  label: string;
  /** quick connect · Preview 감지 열의 추가 props (width · allowsSorting …) */
  props?: Record<string, unknown>;
};

export type TableColumnInsertPlan =
  | {
      kind: "plain";
      headerId: string;
      /** 새 열 (append) — replace 면 `removeIds` 를 먼저 지운다 */
      columns: CanonicalNode[];
      removeIds: string[];
      /** ADR-241 Phase 3 — TableView 정적 행에 덧붙일 셀 (행 id → 셀) */
      cells: Array<{ rowId: string; cell: CanonicalNode }>;
    }
  | {
      kind: "instance";
      instanceId: string;
      descendants: Record<string, unknown>;
      columns: CanonicalNode[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** origin subtree 에서 segment 경로 (`a/b`) 로 노드를 찾는다. */
function findBySegmentPath(
  root: CanonicalNode,
  path: string,
): CanonicalNode | null {
  let current: CanonicalNode | undefined = root;
  for (const segment of path.split("/")) {
    current = (current?.children ?? []).find(
      (child) => getCanonicalRefPathSegment(child) === segment,
    );
    if (!current) return null;
  }
  return current ?? null;
}

/**
 * Table (plain · ref instance) 의 TableHeader host id — plain 은 자식 TableHeader id, instance 는 `<instance>/<origin 안 경로>`.
 * TableHeader 가 없으면 null.
 */
export function resolveTableHeaderHostId(
  document: CompositionDocument,
  tableId: string,
): string | null {
  const byId = indexNodes(document);
  const table = byId.get(tableId);
  if (!table) return null;
  if (table.type !== "ref") {
    return (
      (table.children ?? []).find(
        (child) => String(child.type) === "TableHeader",
      )?.id ?? null
    );
  }
  const master = resolveChainEnd((table as RefLike).ref, byId);
  const header = (master?.children ?? []).find(
    (child) => String(child.type) === "TableHeader",
  );
  return header ? `${table.id}/${getCanonicalRefPathSegment(header)}` : null;
}

/** 열 노드의 유효 props — ref 는 체인 끝 origin props 위에 자기 props. */
function effectiveProps(
  node: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
): Record<string, unknown> {
  const own = (node.props ?? {}) as Record<string, unknown>;
  if (node.type !== "ref") return own;
  const master = resolveChainEnd((node as RefLike).ref, byId);
  return { ...((master?.props ?? {}) as Record<string, unknown>), ...own };
}

function isColumnNode(
  node: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
): boolean {
  if (String(node.type) === "Column") return true;
  return (
    node.type === "ref" &&
    String(resolveChainEnd((node as RefLike).ref, byId)?.type) === "Column"
  );
}

/** 지금 보이는 열의 key (삭제 표시 제외 · Preview 와 같은 index 규칙). */
export function readColumnKeys(
  columns: readonly CanonicalNode[],
  byId: ReadonlyMap<string, CanonicalNode>,
): string[] {
  return columns
    .filter(
      (node) =>
        isColumnNode(node, byId) &&
        (node as { deleted?: boolean }).deleted !== true,
    )
    .map((node, index) =>
      resolveTableColumnKey(effectiveProps(node, byId), index),
    );
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** 새 열 spec — Slot "+" 는 `column<n>` · "Column <n>" (n = 열 수 + 1 부터, key 가 겹치지 않을 때까지). */
function nextColumnSpec(keys: readonly string[]): TableColumnSpec {
  const taken = new Set(keys);
  for (let n = keys.length + 1; ; n += 1) {
    const key = `column${n}`;
    if (!taken.has(key)) return { key, label: `Column ${n}` };
  }
}

function buildColumnNode(
  spec: TableColumnSpec,
  prefix: string,
  taken: Set<string>,
): CanonicalNode {
  return {
    id: uniqueId(`${prefix}__column-${spec.key}`, taken),
    type: "ref",
    ref: TABLE_COLUMN_ORIGIN_ID,
    props: { ...(spec.props ?? {}), key: spec.key, children: spec.label },
  } as unknown as CanonicalNode;
}

const PATCH_NODE_FIELDS = ["fills", "sizing", "responsive"] as const;

/** 바깥 patch 하나를 노드에 접는다 (props · 노드 필드) — 해석기 `propsFromDescendantPatch` 와 같은 props 규칙. */
function foldOuterPatch(
  node: CanonicalNode,
  patch: Record<string, unknown>,
): CanonicalNode {
  const {
    children,
    descendants: _descendants,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    enabled: _enabled,
    fills: _fills,
    sizing: _sizing,
    responsive: _responsive,
    ...flat
  } = patch;
  const props = isRecord(patch.props)
    ? patch.props
    : {
        ...flat,
        ...(children !== undefined && !Array.isArray(children)
          ? { children }
          : {}),
      };
  const next: Record<string, unknown> = {
    ...node,
    props: { ...((node.props ?? {}) as Record<string, unknown>), ...props },
  };
  for (const field of PATCH_NODE_FIELDS) {
    if (patch[field] !== undefined) next[field] = patch[field];
  }
  return next as unknown as CanonicalNode;
}

/**
 * origin 노드들을 instance mode C 로 처음 옮길 때의 복제본 — id 는 instance 접두 (문서 유일) · 바깥 instance 의 patch
 * (`descendants["<base>/<seg>…"]` — mode C 가 아닌 patch, 자손까지 — 행의 셀) 는 복제본에 접고 키를 지운다 (경로가 복제본 id 로
 * 바뀌므로 그대로 두면 편집이 사라진다).
 */
function cloneWithOuterPatches(
  nodes: readonly CanonicalNode[],
  basePath: string,
  instanceId: string,
  descendants: Record<string, unknown>,
  taken: Set<string>,
): CanonicalNode[] {
  return nodes.map((node) => {
    const path = `${basePath}/${getCanonicalRefPathSegment(node)}`;
    const patch = descendants[path];
    let next = node;
    if (isRecord(patch) && !Array.isArray(patch.children)) {
      next = foldOuterPatch(node, patch);
      delete descendants[path];
    }
    return {
      ...next,
      id: uniqueId(`${instanceId}__${node.id}`, taken),
      ...(node.children
        ? {
            children: cloneWithOuterPatches(
              node.children,
              path,
              instanceId,
              descendants,
              taken,
            ),
          }
        : {}),
    } as CanonicalNode;
  });
}

function buildCellNode(prefix: string, taken: Set<string>): CanonicalNode {
  return {
    id: uniqueId(`${prefix}__cell`, taken),
    type: "Cell",
    props: { children: "" },
  } as unknown as CanonicalNode;
}

function findParent(
  nodes: readonly CanonicalNode[],
  childId: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.children?.some((child) => child.id === childId)) return node;
    const hit = findParent(node.children ?? [], childId);
    if (hit) return hit;
  }
  return undefined;
}

function childOfType(
  parent: CanonicalNode | null | undefined,
  type: string,
): CanonicalNode | undefined {
  return (parent?.children ?? []).find((child) => String(child.type) === type);
}

/** instance 안 경로의 mode C 자식 — 있으면 그것, 없으면 origin 자식 복제 (바깥 patch 접기). */
function currentModeCChildren(
  descendants: Record<string, unknown>,
  path: string,
  originNode: CanonicalNode,
  instanceId: string,
  taken: Set<string>,
): CanonicalNode[] {
  const entry = descendants[path];
  if (isRecord(entry) && Array.isArray(entry.children)) {
    return entry.children as CanonicalNode[];
  }
  return cloneWithOuterPatches(
    originNode.children ?? [],
    path,
    instanceId,
    descendants,
    taken,
  );
}

function writeModeC(
  descendants: Record<string, unknown>,
  path: string,
  children: CanonicalNode[],
): void {
  const entry = isRecord(descendants[path])
    ? (descendants[path] as Record<string, unknown>)
    : {};
  descendants[path] = { ...entry, children };
}

/** 행마다 셀 수 = 열 수 (셀 동기화 조건 — 어긋난 TableView 는 동기화 대상 아님, 리뷰 r1 m2). */
function rowsAligned(
  rows: readonly CanonicalNode[],
  columnCount: number,
): boolean {
  return rows.every((row) => (row.children?.length ?? 0) === columnCount);
}

/**
 * `hostId` (plain TableHeader 또는 `<instance>/<path>`) 에 열을 더하는 계획. `columns` 가 없으면 Slot "+" (새 key 하나).
 * `replace` 면 기존 열을 지우고 `columns` 만 남긴다 (quick connect 재연결). 넣을 수 없으면 null.
 * ADR-241 Phase 3 — TableView 면 모든 정적 행에 새 열 수만큼 셀을 덧붙인다 (셀 수 = 열 수인 TableView 만). instance 는 TableBody
 * 도 mode C (234 Tabs 가 TabList · TabPanels 를 같이 쓰는 것과 같은 모양).
 */
export function planTableColumnInsert(input: {
  document: CompositionDocument;
  hostId: string;
  columns?: readonly TableColumnSpec[];
  replace?: boolean;
}): TableColumnInsertPlan | null {
  const { document, hostId, columns, replace = false } = input;
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  if (!byId.has(TABLE_COLUMN_ORIGIN_ID)) return null;

  if (!isSyntheticDescendantId(hostId)) {
    const header = byId.get(hostId);
    if (!header || String(header.type) !== "TableHeader") return null;
    const current = replace ? [] : (header.children ?? []);
    const specs = columns ?? [nextColumnSpec(readColumnKeys(current, byId))];
    const owner = findParent(document.children, header.id);
    const body =
      String(owner?.type) === "TableView"
        ? childOfType(owner, "TableBody")
        : undefined;
    const rows = body?.children ?? [];
    const cells =
      !replace && rowsAligned(rows, header.children?.length ?? 0)
        ? rows.flatMap((row) =>
            specs.map(() => ({
              rowId: row.id,
              cell: buildCellNode(row.id, taken),
            })),
          )
        : [];
    return {
      kind: "plain",
      headerId: header.id,
      columns: specs.map((spec) => buildColumnNode(spec, header.id, taken)),
      removeIds: replace
        ? (header.children ?? [])
            .filter((child) => isColumnNode(child, byId))
            .map((child) => child.id)
        : [],
      cells,
    };
  }

  const instanceId = getSyntheticDescendantRootId(hostId);
  const headerPath = getSyntheticDescendantPathKey(hostId);
  const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
  if (!instance || instance.type !== "ref" || !headerPath) return null;
  const master = resolveChainEnd(instance.ref, byId);
  const header = master ? findBySegmentPath(master, headerPath) : null;
  if (!master || !header || String(header.type) !== "TableHeader") return null;

  const descendants = { ...(instance.descendants ?? {}) };
  const current = replace
    ? []
    : currentModeCChildren(descendants, headerPath, header, instance.id, taken);
  const specs = columns ?? [nextColumnSpec(readColumnKeys(current, byId))];
  const added = specs.map((spec) => buildColumnNode(spec, instance.id, taken));
  writeModeC(descendants, headerPath, [...current, ...added]);

  // TableView instance — 정적 행 (origin 행 복제 또는 mode C 행) 에 셀 덧붙이기.
  const parentPath = headerPath.split("/").slice(0, -1).join("/");
  const owner = parentPath ? findBySegmentPath(master, parentPath) : master;
  const body =
    String(owner?.type) === "TableView"
      ? childOfType(owner, "TableBody")
      : undefined;
  if (body && !replace) {
    const bodyPath = [parentPath, getCanonicalRefPathSegment(body)]
      .filter(Boolean)
      .join("/");
    const rows = currentModeCChildren(
      descendants,
      bodyPath,
      body,
      instance.id,
      taken,
    );
    if (rows.length > 0 && rowsAligned(rows, current.length)) {
      writeModeC(
        descendants,
        bodyPath,
        rows.map((row) => ({
          ...row,
          children: [
            ...(row.children ?? []),
            ...specs.map(() => buildCellNode(row.id, taken)),
          ],
        })),
      );
    }
  }
  return {
    kind: "instance",
    instanceId: instance.id,
    descendants,
    columns: added,
  };
}

export type TableRowInsertPlan =
  | { kind: "plain"; bodyId: string; row: CanonicalNode }
  | {
      kind: "instance";
      instanceId: string;
      descendants: Record<string, unknown>;
      row: CanonicalNode;
    };

function buildRowNode(
  prefix: string,
  columnCount: number,
  taken: Set<string>,
): CanonicalNode {
  const id = uniqueId(`${prefix}__row`, taken);
  return {
    id,
    type: "ref",
    ref: TABLE_ROW_ORIGIN_ID,
    props: {},
    children: Array.from({ length: columnCount }, () =>
      buildCellNode(id, taken),
    ),
  } as unknown as CanonicalNode;
}

/**
 * ADR-241 Phase 3 — TableView 의 TableBody (plain 또는 `<instance>/<path>`) 에 행을 더하는 계획: Row origin 의 instance + 열 수만큼
 * 셀 (그 ref 의 자기 자식). instance 는 TableBody mode C (처음이면 origin 행을 복제 — 셀 patch 접기). 셀 수가 어긋난 TableView
 * (동기화 대상 아님) · host 가 아니면 null.
 */
export function planTableRowInsert(input: {
  document: CompositionDocument;
  hostId: string;
}): TableRowInsertPlan | null {
  const { document, hostId } = input;
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  if (!byId.has(TABLE_ROW_ORIGIN_ID)) return null;

  if (!isSyntheticDescendantId(hostId)) {
    const body = byId.get(hostId);
    if (!body || String(body.type) !== "TableBody") return null;
    const owner = findParent(document.children, body.id);
    if (String(owner?.type) !== "TableView") return null;
    const columnCount =
      childOfType(owner, "TableHeader")?.children?.length ?? 0;
    if (!rowsAligned(body.children ?? [], columnCount)) return null;
    return {
      kind: "plain",
      bodyId: body.id,
      row: buildRowNode(body.id, columnCount, taken),
    };
  }

  const instanceId = getSyntheticDescendantRootId(hostId);
  const bodyPath = getSyntheticDescendantPathKey(hostId);
  const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
  if (!instance || instance.type !== "ref" || !bodyPath) return null;
  const master = resolveChainEnd(instance.ref, byId);
  const body = master ? findBySegmentPath(master, bodyPath) : null;
  if (!master || !body || String(body.type) !== "TableBody") return null;
  const parentPath = bodyPath.split("/").slice(0, -1).join("/");
  const owner = parentPath ? findBySegmentPath(master, parentPath) : master;
  if (String(owner?.type) !== "TableView") return null;
  const header = childOfType(owner, "TableHeader");
  const headerPath = header
    ? [parentPath, getCanonicalRefPathSegment(header)].filter(Boolean).join("/")
    : null;
  const columnCount = headerPath
    ? (readTableHeaderColumns(document, `${instance.id}/${headerPath}`)
        ?.length ?? 0)
    : 0;

  const descendants = { ...(instance.descendants ?? {}) };
  const rows = currentModeCChildren(
    descendants,
    bodyPath,
    body,
    instance.id,
    taken,
  );
  if (!rowsAligned(rows, columnCount)) return null;
  const row = buildRowNode(instance.id, columnCount, taken);
  writeModeC(descendants, bodyPath, [...rows, row]);
  return { kind: "instance", instanceId: instance.id, descendants, row };
}
/**
 * host (plain TableHeader 또는 `<instance>/<path>`) 의 지금 열 — quick connect 의 기존 열 · Preview 감지의 늦은 도착 가드.
 * instance 는 mode C 자기 열이 있으면 그것, 없으면 origin 열 (바깥 글자 patch 반영). host 가 아니면 null.
 */
export function readTableHeaderColumns(
  document: CompositionDocument,
  hostId: string,
): Array<{ id: string; key: string; label: string }> | null {
  const byId = indexNodes(document);
  let columns: readonly CanonicalNode[];
  let patches: Record<string, unknown> = {};
  let headerPath = "";
  if (!isSyntheticDescendantId(hostId)) {
    const header = byId.get(hostId);
    if (!header || String(header.type) !== "TableHeader") return null;
    columns = header.children ?? [];
  } else {
    const instanceId = getSyntheticDescendantRootId(hostId);
    headerPath = getSyntheticDescendantPathKey(hostId) ?? "";
    const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
    if (!instance || instance.type !== "ref" || !headerPath) return null;
    const master = resolveChainEnd(instance.ref, byId);
    const header = master ? findBySegmentPath(master, headerPath) : null;
    if (!header || String(header.type) !== "TableHeader") return null;
    const entry = (instance.descendants ?? {})[headerPath];
    if (isRecord(entry) && Array.isArray(entry.children)) {
      columns = entry.children as CanonicalNode[];
    } else {
      columns = header.children ?? [];
      patches = instance.descendants ?? {};
    }
  }
  return columns
    .filter(
      (node) =>
        isColumnNode(node, byId) &&
        (node as { deleted?: boolean }).deleted !== true,
    )
    .map((node, index) => {
      const patch = headerPath
        ? patches[`${headerPath}/${getCanonicalRefPathSegment(node)}`]
        : undefined;
      const props = {
        ...effectiveProps(node, byId),
        ...(isRecord(patch) ? patch : {}),
      };
      return {
        id: node.id,
        key: resolveTableColumnKey(props, index),
        label: String(props.label ?? props.children ?? props.key ?? ""),
      };
    });
}

/**
 * Preview 열 감지 (`ADD_COLUMN_ELEMENTS`) 가 instance 의 TableHeader (해석 id) 로 온 경우의 계획 — 이미 열이 있으면 null
 * (quick connect 가 바인딩보다 먼저 쓴 늦은 도착 — ADR-013 §4 가드와 같은 규칙). payload 열 props (`key` · `label` ·
 * `children` · width …) 를 Column instance props 로.
 */
export function planPreviewDetectedColumns(
  document: CompositionDocument,
  headerId: string,
  payloadColumns: unknown,
): TableColumnInsertPlan | null {
  const existing = readTableHeaderColumns(document, headerId);
  if (!existing || existing.length > 0 || !Array.isArray(payloadColumns)) {
    return null;
  }
  const specs = payloadColumns.map((column): TableColumnSpec => {
    const props =
      isRecord(column) && isRecord(column.props) ? column.props : {};
    const { key, label, children, ...rest } = props;
    return {
      key: String(key ?? ""),
      label: String(label ?? children ?? key ?? ""),
      props: { ...rest, ...(label != null ? { label } : {}) },
    };
  });
  return planTableColumnInsert({ document, hostId: headerId, columns: specs });
}
