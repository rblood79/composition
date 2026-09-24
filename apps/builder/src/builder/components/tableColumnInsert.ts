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
import { TABLE_COLUMN_ORIGIN_ID } from "./tableColumnOrigins";

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

/**
 * origin 열을 instance mode C 로 처음 옮길 때의 복제본 — id 는 instance 접두 (문서 유일) · 바깥 instance 의 그 열 patch
 * (`descendants["<header 경로>/<열 segment>"]` — mode C 가 아닌 props patch) 는 복제본 props 로 옮기고 키를 지운다.
 */
function cloneOriginColumns(
  columns: readonly CanonicalNode[],
  instanceId: string,
  headerPath: string,
  descendants: Record<string, unknown>,
  taken: Set<string>,
): CanonicalNode[] {
  return columns.map((column) => {
    const path = `${headerPath}/${getCanonicalRefPathSegment(column)}`;
    const patch = descendants[path];
    let props = (column.props ?? {}) as Record<string, unknown>;
    if (isRecord(patch) && !Array.isArray(patch.children)) {
      props = { ...props, ...patch };
      delete descendants[path];
    }
    return {
      ...column,
      id: uniqueId(`${instanceId}__${column.id}`, taken),
      props,
    } as CanonicalNode;
  });
}

/**
 * `hostId` (plain TableHeader 또는 `<instance>/<path>`) 에 열을 더하는 계획. `columns` 가 없으면 Slot "+" (새 key 하나).
 * `replace` 면 기존 열을 지우고 `columns` 만 남긴다 (quick connect 재연결). 넣을 수 없으면 null.
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
    return {
      kind: "plain",
      headerId: header.id,
      columns: specs.map((spec) => buildColumnNode(spec, header.id, taken)),
      removeIds: replace
        ? (header.children ?? [])
            .filter((child) => isColumnNode(child, byId))
            .map((child) => child.id)
        : [],
    };
  }

  const instanceId = getSyntheticDescendantRootId(hostId);
  const headerPath = getSyntheticDescendantPathKey(hostId);
  const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
  if (!instance || instance.type !== "ref" || !headerPath) return null;
  const master = resolveChainEnd(instance.ref, byId);
  const header = master ? findBySegmentPath(master, headerPath) : null;
  if (!header || String(header.type) !== "TableHeader") return null;

  const descendants = { ...(instance.descendants ?? {}) };
  const entry = isRecord(descendants[headerPath])
    ? (descendants[headerPath] as Record<string, unknown>)
    : {};
  const current = replace
    ? []
    : Array.isArray(entry.children)
      ? (entry.children as CanonicalNode[])
      : cloneOriginColumns(
          header.children ?? [],
          instance.id,
          headerPath,
          descendants,
          taken,
        );
  const specs = columns ?? [nextColumnSpec(readColumnKeys(current, byId))];
  const added = specs.map((spec) => buildColumnNode(spec, instance.id, taken));
  descendants[headerPath] = { ...entry, children: [...current, ...added] };
  return {
    kind: "instance",
    instanceId: instance.id,
    descendants,
    columns: added,
  };
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
