/**
 * ADR-234 Phase 3 — 이관: 작성자가 채운 목록 (`items` 데이터) → 목록 틀의 항목 instance 자식.
 *
 * breakdown §4 Phase 3 계약:
 * - 목록 틀 = 항목을 직접 담는 노드 (Tabs 는 TabList). 정적 `items` 의 행 하나 = 항목 origin 의
 *   instance 자식 하나 (`type: "ref"` · `props.id` = 행 id — RAC key · TabPanel `itemId` 짝) · label 등은
 *   `descendants` (origin 의 label slot 자식 id).
 * - slot 은 목록 틀로 옮긴다 (값 = 항목 origin 추천 목록).
 * - 바인딩 목록 (`dataBinding`) 은 `items` + 템플릿 경로 그대로 — 이관하지 않는다.
 * - ref instance 가 자기 `items` 를 덮어쓴 경우: 목록 틀 경로에 descendants mode C (자식 교체) 로.
 *   그 경로에 이미 다른 patch 가 있으면 보류 (경고) — 부분 이관 없음.
 * - 항목 origin 이 문서에 없으면 그 목록은 보류 (다음 hydration 에서 origin 이 생기면 이관).
 * - 멱등: 이관을 지난 문서는 같은 객체 (재hydration Δ0).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { getElementDataBinding } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import { TAB_ITEM_DEFAULT_ORIGIN_ID } from "./tabs/tabsTemplateOrigins";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function indexNodes(document: CompositionDocument): Map<string, CanonicalNode> {
  const map = new Map<string, CanonicalNode>();
  const visit = (nodes: readonly CanonicalNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      map.set(node.id, node);
      visit(node.children);
    }
  };
  visit(document.children);
  return map;
}

/** ref 체인 끝 (origin). 순환 · 깊이 초과 · 누락이면 undefined. */
export function resolveChainEnd(
  id: string | undefined,
  byId: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode | undefined {
  let current = id ? byId.get(id) : undefined;
  for (let depth = 0; current?.type === "ref"; depth += 1) {
    if (depth >= 8) return undefined;
    current = byId.get((current as RefLike).ref ?? "");
  }
  return current;
}

/** 정적 목록인가 — 바인딩 목록은 `items` + 템플릿 경로 그대로 (breakdown §1-3). */
function isBoundCollection(node: CanonicalNode): boolean {
  return (
    getElementDataBinding(
      node as unknown as Parameters<typeof getElementDataBinding>[0],
    ) != null
  );
}

function readItems(
  props: Record<string, unknown> | undefined,
): Array<Record<string, unknown>> | null {
  const items = props?.items;
  if (!Array.isArray(items)) return null;
  return items.filter(isRecord);
}

function omitKey(
  props: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const next = { ...(props ?? {}) };
  delete next[key];
  return next;
}

/** slot 추천 목록에서 항목 origin (ref 가 아닌 노드 · 체인 끝) — 없으면 fallback 상수. */
export function pickItemOriginId(
  slot: unknown,
  byId: ReadonlyMap<string, CanonicalNode>,
  fallback: string,
): string | null {
  if (Array.isArray(slot)) {
    for (const entry of slot) {
      if (typeof entry !== "string") continue;
      const node = byId.get(entry);
      if (node && node.type !== "ref") return node.id;
    }
    for (const entry of slot) {
      if (typeof entry !== "string") continue;
      const end = resolveChainEnd(entry, byId);
      if (end) return end.id;
    }
  }
  return byId.has(fallback) ? fallback : null;
}

/**
 * origin 의 label slot 자식 `descendants` 키 — segment 경로 (name 우선). Canvas 는 segment 만, Preview 는
 * id · segment 둘 다 읽는다 (편집기도 segment 로 쓴다).
 */
export function findLabelChildId(origin: CanonicalNode): string | null {
  const label = (origin.children ?? []).find(
    (child) =>
      (child.metadata as Record<string, unknown> | undefined)?.slotRole ===
        "label" ||
      (child.props as Record<string, unknown> | undefined)?.slot === "label",
  );
  return label ? getCanonicalRefPathSegment(label) : null;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// ───────────────────────────── Tabs ─────────────────────────────

/** Tabs `items` 행 → Tab instance 자식. */
export function buildTabInstances(
  items: ReadonlyArray<Record<string, unknown>>,
  idPrefix: string,
  originId: string,
  labelChildId: string | null,
  taken: Set<string>,
  /** 새 항목의 번호 시작 (Slot "+" 는 기존 항목 수 — id `__tab-<n>`). */
  startIndex = 0,
): CanonicalNode[] {
  return items.map((item, offset) => {
    const index = startIndex + offset;
    const title = item.title ?? item.label ?? item.textValue ?? "";
    const props: Record<string, unknown> = {
      id: String(item.id ?? `${idPrefix}-${index + 1}`),
    };
    if (item.isDisabled === true) props.isDisabled = true;
    return {
      id: uniqueId(`${idPrefix}__tab-${index + 1}`, taken),
      type: "ref",
      ref: originId,
      props,
      ...(labelChildId
        ? { descendants: { [labelChildId]: { children: String(title) } } }
        : {}),
    } as unknown as CanonicalNode;
  });
}

/** plain Tabs (origin 포함) — TabList 에 Tab instance 자식 · items 제거 · slot 을 TabList 로. */
function migratePlainTabs(
  tabs: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
): CanonicalNode | null {
  if (isBoundCollection(tabs)) return null;
  const children = tabs.children ?? [];
  const tabListIndex = children.findIndex((child) => child.type === "TabList");
  if (tabListIndex < 0) return null;
  const tabList = children[tabListIndex]!;
  const tabsProps = (tabs.props ?? {}) as Record<string, unknown>;
  const tabListProps = (tabList.props ?? {}) as Record<string, unknown>;
  const hasStaticChildren = (tabList.children ?? []).length > 0;
  const items = readItems(tabsProps) ?? readItems(tabListProps);
  const rootSlot = Array.isArray(tabs.slot) ? tabs.slot : undefined;
  const needsConversion = !hasStaticChildren && items !== null;
  if (!needsConversion && !rootSlot) return null;

  let nextTabListChildren = tabList.children;
  if (needsConversion && items.length > 0) {
    const originId = pickItemOriginId(
      tabList.slot ?? rootSlot,
      byId,
      TAB_ITEM_DEFAULT_ORIGIN_ID,
    );
    const origin = originId ? byId.get(originId) : undefined;
    if (!originId || !origin) return null; // 보류 — origin 이 생기면 다음 hydration 에서.
    nextTabListChildren = buildTabInstances(
      items,
      tabList.id,
      originId,
      findLabelChildId(origin),
      taken,
    );
  }

  const nextTabList: CanonicalNode = {
    ...tabList,
    ...(needsConversion ? { props: omitKey(tabListProps, "items") } : {}),
    ...(nextTabListChildren ? { children: nextTabListChildren } : {}),
    ...(rootSlot && !Array.isArray(tabList.slot) ? { slot: rootSlot } : {}),
  };
  const { slot: _movedSlot, ...tabsWithoutSlot } = tabs;
  const nextChildren = [...children];
  nextChildren[tabListIndex] = nextTabList;
  return {
    ...(rootSlot ? tabsWithoutSlot : tabs),
    ...(needsConversion ? { props: omitKey(tabsProps, "items") } : {}),
    children: nextChildren,
  } as CanonicalNode;
}

/** Tabs ref instance 가 자기 `items` 를 덮어쓴 경우 → TabList 경로 descendants mode C. */
function migrateTabsInstance(
  instance: RefLike,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
  held: string[],
): CanonicalNode | null {
  const props = (instance.props ?? {}) as Record<string, unknown>;
  const items = readItems(props);
  if (items === null || isBoundCollection(instance)) return null;
  const master = resolveChainEnd(instance.ref, byId);
  if (master?.type !== "Tabs") return null;
  const tabList = (master.children ?? []).find(
    (child) => child.type === "TabList",
  );
  if (!tabList) return null;
  const tabListPath = getCanonicalRefPathSegment(tabList);
  const existing = instance.descendants?.[tabListPath];
  if (existing !== undefined) {
    held.push(`${instance.id}: descendants["${tabListPath}"] 이미 있음`);
    return null;
  }
  const originId = pickItemOriginId(
    tabList.slot ?? master.slot,
    byId,
    TAB_ITEM_DEFAULT_ORIGIN_ID,
  );
  const origin = originId ? byId.get(originId) : undefined;
  if (!originId || !origin) return null;
  return {
    ...instance,
    props: omitKey(props, "items"),
    descendants: {
      ...(instance.descendants ?? {}),
      [tabListPath]: {
        children: buildTabInstances(
          items,
          instance.id,
          originId,
          findLabelChildId(origin),
          taken,
        ),
      },
    },
  } as CanonicalNode;
}

// ───────────────────────────── 문서 ─────────────────────────────

export function migrateStaticCollectionsToInstances(
  document: CompositionDocument,
): CompositionDocument {
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  const held: string[] = [];

  const visit = (node: CanonicalNode): CanonicalNode => {
    let next = node;
    if (node.children) {
      let changed = false;
      const children = node.children.map((child) => {
        const visited = visit(child);
        if (visited !== child) changed = true;
        return visited;
      });
      if (changed) next = { ...node, children };
    }
    if (next.type === "Tabs") {
      return migratePlainTabs(next, byId, taken) ?? next;
    }
    if (next.type === "ref") {
      return migrateTabsInstance(next as RefLike, byId, taken, held) ?? next;
    }
    return next;
  };

  let changed = false;
  const children = document.children.map((child) => {
    const visited = visit(child);
    if (visited !== child) changed = true;
    return visited;
  });
  if (held.length > 0) {
    console.warn("[ADR-234] 정적 목록 이관 보류", held);
  }
  return changed ? { ...document, children } : document;
}
