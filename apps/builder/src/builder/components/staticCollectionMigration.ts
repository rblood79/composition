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
import { TAG_ITEM_DEFAULT_ORIGIN_ID } from "./taggroup/tagGroupTemplateOrigins";

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

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// ───────────────────────────── 가족 표 ─────────────────────────────

/** origin 의 slot 역할 자식 (`metadata.slotRole` · `props.slot`) 의 descendants 키 (segment). */
function findSlotChildKey(origin: CanonicalNode, role: string): string | null {
  const child = (origin.children ?? []).find(
    (c) =>
      (c.metadata as Record<string, unknown> | undefined)?.slotRole === role ||
      (c.props as Record<string, unknown> | undefined)?.slot === role,
  );
  return child ? getCanonicalRefPathSegment(child) : null;
}

/**
 * 정적 목록 가족 — owner (items 보유) · 목록 틀 (항목 자식을 담는 노드) · 항목 origin 기본 id · 행 →
 * 항목 instance 의 props / descendants.
 */
export interface StaticCollectionFamily {
  ownerType: string;
  listType: string;
  itemType: string;
  itemPrefix: string;
  defaultOriginId: string;
  buildItem(
    item: Record<string, unknown>,
    origin: CanonicalNode,
  ): { props: Record<string, unknown>; descendants: Record<string, unknown> };
}

function labelDescendant(
  origin: CanonicalNode,
  text: unknown,
): Record<string, unknown> {
  const key = findSlotChildKey(origin, "label");
  return key ? { [key]: { children: String(text ?? "") } } : {};
}

export const TABS_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "Tabs",
  listType: "TabList",
  itemType: "Tab",
  itemPrefix: "tab",
  defaultOriginId: TAB_ITEM_DEFAULT_ORIGIN_ID,
  buildItem(item, origin) {
    return {
      props: item.isDisabled === true ? { isDisabled: true } : {},
      descendants: labelDescendant(
        origin,
        item.title ?? item.label ?? item.textValue,
      ),
    };
  },
};

export const TAGGROUP_STATIC_FAMILY: StaticCollectionFamily = {
  ownerType: "TagGroup",
  listType: "TagList",
  itemType: "Tag",
  itemPrefix: "tag",
  defaultOriginId: TAG_ITEM_DEFAULT_ORIGIN_ID,
  buildItem(item, origin) {
    const descendants: Record<string, unknown> = labelDescendant(
      origin,
      item.label ?? item.textValue ?? item.title,
    );
    // leading slot 은 행에 값이 있을 때만 (projection 의 존재 gating 과 같은 결과) — 없으면 숨김.
    const icon = findSlotChildKey(origin, "icon");
    if (icon) {
      descendants[icon] =
        typeof item.icon === "string" && item.icon
          ? { iconName: item.icon }
          : { enabled: false };
    }
    const avatar = findSlotChildKey(origin, "avatar");
    if (avatar) {
      descendants[avatar] =
        typeof item.avatar === "string" && item.avatar
          ? { src: item.avatar }
          : { enabled: false };
    }
    return {
      props: {
        ...(item.isDisabled === true ? { isDisabled: true } : {}),
        ...(item.allowsRemoving === true ? { allowsRemoving: true } : {}),
      },
      descendants,
    };
  },
};

export const STATIC_COLLECTION_FAMILIES: readonly StaticCollectionFamily[] = [
  TABS_STATIC_FAMILY,
  TAGGROUP_STATIC_FAMILY,
];

/** 행 → 항목 instance 자식 (`props.id` = 행 id — RAC key). */
export function buildItemInstances(
  family: StaticCollectionFamily,
  items: ReadonlyArray<Record<string, unknown>>,
  idPrefix: string,
  origin: CanonicalNode,
  taken: Set<string>,
  /** 새 항목의 번호 시작 (Slot "+" 는 기존 항목 수 — id `__<prefix>-<n>`). */
  startIndex = 0,
): CanonicalNode[] {
  return items.map((item, offset) => {
    const index = startIndex + offset;
    const built = family.buildItem(item, origin);
    return {
      id: uniqueId(`${idPrefix}__${family.itemPrefix}-${index + 1}`, taken),
      type: "ref",
      ref: origin.id,
      props: {
        id: String(item.id ?? `${idPrefix}-${index + 1}`),
        ...built.props,
      },
      ...(Object.keys(built.descendants).length > 0
        ? { descendants: built.descendants }
        : {}),
    } as unknown as CanonicalNode;
  });
}

/** plain owner (origin 포함) — 목록 틀에 항목 instance 자식 · items 제거 · slot 을 목록 틀로. */
function migratePlainOwner(
  family: StaticCollectionFamily,
  owner: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
): CanonicalNode | null {
  if (isBoundCollection(owner)) return null;
  const children = owner.children ?? [];
  const listIndex = children.findIndex(
    (child) => child.type === family.listType,
  );
  if (listIndex < 0) return null;
  const list = children[listIndex]!;
  const ownerProps = (owner.props ?? {}) as Record<string, unknown>;
  const listProps = (list.props ?? {}) as Record<string, unknown>;
  const hasStaticChildren = (list.children ?? []).length > 0;
  const items = readItems(ownerProps) ?? readItems(listProps);
  const rootSlot = Array.isArray(owner.slot) ? owner.slot : undefined;
  const needsConversion = !hasStaticChildren && items !== null;
  if (!needsConversion && !rootSlot) return null;

  let nextListChildren = list.children;
  if (needsConversion && items.length > 0) {
    const originId = pickItemOriginId(
      list.slot ?? rootSlot,
      byId,
      family.defaultOriginId,
    );
    const origin = originId ? byId.get(originId) : undefined;
    if (!origin) return null; // 보류 — origin 이 생기면 다음 hydration 에서.
    nextListChildren = buildItemInstances(family, items, list.id, origin, taken);
  }

  const nextList: CanonicalNode = {
    ...list,
    ...(needsConversion ? { props: omitKey(listProps, "items") } : {}),
    ...(nextListChildren ? { children: nextListChildren } : {}),
    ...(rootSlot && !Array.isArray(list.slot) ? { slot: rootSlot } : {}),
  };
  const { slot: _movedSlot, ...ownerWithoutSlot } = owner;
  const nextChildren = [...children];
  nextChildren[listIndex] = nextList;
  return {
    ...(rootSlot ? ownerWithoutSlot : owner),
    ...(needsConversion ? { props: omitKey(ownerProps, "items") } : {}),
    children: nextChildren,
  } as CanonicalNode;
}

/** owner ref instance 가 자기 `items` 를 덮어쓴 경우 → 목록 틀 경로 descendants mode C. */
function migrateOwnerInstance(
  instance: RefLike,
  byId: ReadonlyMap<string, CanonicalNode>,
  taken: Set<string>,
  held: string[],
): CanonicalNode | null {
  const props = (instance.props ?? {}) as Record<string, unknown>;
  const items = readItems(props);
  if (items === null || isBoundCollection(instance)) return null;
  const master = resolveChainEnd(instance.ref, byId);
  const family = STATIC_COLLECTION_FAMILIES.find((f) => f.ownerType === master?.type);
  if (!master || !family) return null;
  const list = (master.children ?? []).find(
    (child) => child.type === family.listType,
  );
  if (!list) return null;
  const listPath = getCanonicalRefPathSegment(list);
  if (instance.descendants?.[listPath] !== undefined) {
    held.push(`${instance.id}: descendants["${listPath}"] 이미 있음`);
    return null;
  }
  const originId = pickItemOriginId(
    list.slot ?? master.slot,
    byId,
    family.defaultOriginId,
  );
  const origin = originId ? byId.get(originId) : undefined;
  if (!origin) return null;
  return {
    ...instance,
    props: omitKey(props, "items"),
    descendants: {
      ...(instance.descendants ?? {}),
      [listPath]: {
        children: buildItemInstances(family, items, instance.id, origin, taken),
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
    const family = STATIC_COLLECTION_FAMILIES.find((f) => f.ownerType === next.type);
    if (family) {
      return migratePlainOwner(family, next, byId, taken) ?? next;
    }
    if (next.type === "ref") {
      return migrateOwnerInstance(next as RefLike, byId, taken, held) ?? next;
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

/**
 * ADR-234 Phase 3 — 이 노드가 **작성자가 채운 목록** (목록 틀에 항목 instance 자식) 의 owner 인가. Properties 의
 * items 편집기 (items-manager) 는 바인딩 목록 전용이 된다 — 정적 목록에 `items` 를 다시 쓰면 두 목록이 겹친다.
 * ref instance 는 체인 끝 origin 의 목록 틀 (instance 가 그 경로를 mode C 로 채웠어도 정적).
 */
export function isStaticCollectionOwner(
  document: CompositionDocument,
  nodeId: string,
): boolean {
  const byId = indexNodes(document);
  const node = byId.get(nodeId);
  if (!node || isBoundCollection(node)) return false;
  const master = node.type === "ref" ? resolveChainEnd(nodeId, byId) : node;
  const family = STATIC_COLLECTION_FAMILIES.find(
    (f) => f.ownerType === master?.type,
  );
  if (!master || !family) return false;
  const list = (master.children ?? []).find(
    (child) => child.type === family.listType,
  );
  return (list?.children ?? []).length > 0;
}
