/**
 * ADR-239 Phase 1 — Tree 항목 origin · Tree origin 구조 · 기존 Tree 이관 (breakdown §4 Phase 1 · Phase 2 key 대응).
 *
 * - TreeItem origin (`component-tree-item-default`, 팔레트 밖) = 선택 상태 (234 규칙 — `metadata.variant:"selected"`)
 *   + 역할 자식 Label (Text · DEFAULT_SLOT — RAC TreeItemContent 의 자유 자식). 상태 변형 (`--unselected` · 상호작용 4 ·
 *   `--collapsed`) 은 `ensureStateVariantOrigins` 가 ref 로 보충한다. `slot` = Tree origin 과 같은 추천 목록 — TreeItem
 *   instance 가 Slot "+" host 일 때 그 목록을 읽는다 (`resolveSelfListInstanceMaster` 는 ref 체인 끝 origin 의 slot).
 * - 새 문서의 Tree origin (`component-tree`) 자식 = TreeItem instance (중첩 예시 1 — `expandedKeys` 가 그 부모를 펼침) ·
 *   `slot` = TreeItem origin 2.
 * - 기존 문서: plain TreeItem 노드 → **같은 id** 의 TreeItem origin ref (`props.id` = 옛 RAC key = 노드 id · 글자 =
 *   Label descendants). 부모가 ref 가 된 중첩 항목은 key 가 `<부모 key>/<key>` 로 바뀌므로 (`resolveTreeItemKey`)
 *   Tree 별 옛 key → 새 key 대응표로 선택 · 펼침 네 필드 · interaction `params.value` 를 같은 pass 에서 옮긴다.
 *   대응표에 없는 key 가 남는 Tree 는 이관 보류 (경고).
 * - 멱등: 이관을 지난 문서는 같은 객체.
 */
import type {
  CanonicalNode,
  CompositionDocument,
  InteractionRule,
} from "@composition/shared";
import {
  catalogReusableOriginId,
  getElementDataBinding,
  resolveTreeItemKey,
} from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";
import { ensureTemplateOrigins } from "../ensureTemplateOrigins";

import { TREE_ITEM_DEFAULT_ORIGIN_ID } from "../templateItemOriginIds";

export { TREE_ITEM_DEFAULT_ORIGIN_ID };
export const TREE_ORIGIN_ID = catalogReusableOriginId("Tree");

/** Tree · TreeItem origin 의 추천 항목 (Slot "+") — 휴지 모양 · 선택 모양. */
export function treeItemSlotIds(): string[] {
  return [
    `${TREE_ITEM_DEFAULT_ORIGIN_ID}--unselected`,
    TREE_ITEM_DEFAULT_ORIGIN_ID,
  ];
}

/** Tree 의 RAC key 필드 — 이관이 대응표로 옮긴다. */
export const TREE_KEY_FIELDS = [
  "expandedKeys",
  "selectedKeys",
  "defaultExpandedKeys",
  "defaultSelectedKeys",
] as const;

const TREE_ITEM_LABEL_SEGMENT = "Label";

function createTreeItemDefaultOrigin(): CanonicalNode {
  return {
    id: TREE_ITEM_DEFAULT_ORIGIN_ID,
    type: "TreeItem",
    name: "TreeItem/Default",
    reusable: true,
    props: {},
    slot: treeItemSlotIds(),
    children: [
      {
        id: `${TREE_ITEM_DEFAULT_ORIGIN_ID}__label`,
        type: "Text",
        name: TREE_ITEM_LABEL_SEGMENT,
        props: { children: "Tree item" },
        metadata: {
          type: "tree-item-slot",
          systemOwned: true,
          slotRole: "label",
        },
      },
    ],
    metadata: {
      type: "tree-template-origin",
      systemOwned: true,
      componentFamily: "Tree",
      // 234 규칙 — origin = 선택 상태 (휴지 모양은 `--unselected` 변형). 변형 seed 가 ref 로 보충한다.
      variant: "selected",
    },
  } as unknown as CanonicalNode;
}

function repairTreeItemOrigin(
  existing: CanonicalNode | undefined,
): CanonicalNode {
  const base = createTreeItemDefaultOrigin();
  if (!existing) return base;
  return {
    ...base,
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    ...(existing.slot !== undefined ? { slot: existing.slot } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      systemOwned: true,
      componentFamily: "Tree",
      variant: "selected",
    },
  } as CanonicalNode;
}

/** TreeItem origin 을 Components 페이지에 보장 (멱등 · 사용자 편집 보존). */
export function ensureTreeTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  return ensureTemplateOrigins(
    document,
    new Set([TREE_ITEM_DEFAULT_ORIGIN_ID]),
    (existing) => [
      repairTreeItemOrigin(existing.get(TREE_ITEM_DEFAULT_ORIGIN_ID)),
    ],
  );
}

// ───────────────────────────── 새 문서 Tree origin seed ─────────────────────────────

function itemRef(
  id: string,
  key: string,
  label: string,
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    id,
    type: "ref",
    ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
    props: { id: key },
    descendants: { [TREE_ITEM_LABEL_SEGMENT]: { children: label } },
    ...(children ? { children } : {}),
  } as unknown as CanonicalNode;
}

/**
 * 새 문서의 Tree origin 모양 — 이 호출에서 처음 생긴 `component-tree` (catalog generic seed 의 plain TreeItem 2) 만
 * 바꾼다. 기존 문서의 origin 은 이관 (`migrateTreeItemsToInstances`) 이 같은 id 의 ref 로만 바꾼다 (중첩 예시를
 * 더하면 모든 instance 에 새 항목이 생긴다 — G6 보존).
 */
export function seedFreshTreeOrigin(
  document: CompositionDocument,
  existingOriginIds: ReadonlySet<string>,
): CompositionDocument {
  if (existingOriginIds.has(TREE_ORIGIN_ID)) return document;
  let changed = false;
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === TREE_ORIGIN_ID && node.type === "Tree") {
        changed = true;
        const props = { ...((node.props ?? {}) as Record<string, unknown>) };
        return {
          ...node,
          props: { ...props, expandedKeys: ["item-1"] },
          slot: treeItemSlotIds(),
          children: [
            itemRef(`${TREE_ORIGIN_ID}__item-1`, "item-1", "Node 1", [
              itemRef(`${TREE_ORIGIN_ID}__item-1-1`, "item-1-1", "Node 1.1"),
            ]),
            itemRef(`${TREE_ORIGIN_ID}__item-2`, "item-2", "Node 2"),
          ],
        } as CanonicalNode;
      }
      if (!node.children) return node;
      const children = visit(node.children);
      return children.every((child, i) => child === node.children![i])
        ? node
        : { ...node, children };
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}

// ───────────────────────────── 기존 문서 이관 ─────────────────────────────

type TreeNode = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 이관 대상 plain TreeItem — reusable origin (TreeItem origin 자신 · 사용자 reusable) 은 제외. */
function isPlainTreeItem(node: CanonicalNode): boolean {
  return String(node.type) === "TreeItem" && node.reusable !== true;
}

/** plain TreeItem 의 글자 — Tree renderer 텍스트 원천 계약 (`children` 문자열). */
function readTreeItemText(props: Record<string, unknown>): string {
  const text = props.children;
  return typeof text === "string" || typeof text === "number"
    ? String(text)
    : "";
}

/** plain TreeItem → 같은 id 의 ref. 자식 중 TreeItem 은 그대로 자기 자식 (재귀 변환은 호출자). */
function toTreeItemRef(
  node: CanonicalNode,
  children: CanonicalNode[],
): CanonicalNode {
  const props = { ...((node.props ?? {}) as Record<string, unknown>) };
  const text = readTreeItemText(props);
  delete props.children;
  // 옛 RAC key = 노드 id (239 전 Preview `renderTree` 는 `props.id` 를 읽지 않았다).
  props.id = node.id;
  const { children: _children, ...rest } = node;
  return {
    ...rest,
    type: "ref",
    ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
    props,
    descendants: { [TREE_ITEM_LABEL_SEGMENT]: { children: text } },
    ...(children.length > 0 ? { children } : {}),
  } as unknown as CanonicalNode;
}

/** 이관 뒤 subtree 의 key 계산 문맥 — host (Tree · Tree instance) 는 항목 부모가 아니다. */
function buildKeyContext(nodes: readonly CanonicalNode[], hostId: string) {
  const byIdAfter = new Map<string, TreeNode>();
  const parentOf = new Map<string, string>();
  const index = (list: readonly CanonicalNode[], parentId: string) => {
    for (const node of list) {
      byIdAfter.set(node.id, node as TreeNode);
      parentOf.set(node.id, parentId);
      index(node.children ?? [], node.id);
    }
  };
  index(nodes, hostId);
  const isInstance = (node: TreeNode) => node.type === "ref";
  const getParentItem = (node: TreeNode): TreeNode | undefined => {
    const parentId = parentOf.get(node.id);
    if (!parentId || parentId === hostId) return undefined;
    const parent = byIdAfter.get(parentId);
    return parent &&
      (String(parent.type) === "TreeItem" || parent.type === "ref")
      ? parent
      : undefined;
  };
  const keyOf = (node: CanonicalNode) =>
    resolveTreeItemKey(node as TreeNode, getParentItem, isInstance);
  return { keyOf };
}

const isItemNode = (node: CanonicalNode) =>
  String(node.type) === "TreeItem" || node.type === "ref";

/** 239 전 key (Preview `renderTree` — 노드 id) → 새 key 대응을 Tree subtree 에서 모은다. */
function collectKeyMap(
  before: readonly CanonicalNode[],
  after: readonly CanonicalNode[],
  keyOf: (node: CanonicalNode) => string,
  out: Map<string, string>,
): void {
  for (let i = 0; i < before.length; i += 1) {
    const old = before[i]!;
    const next = after[i];
    if (!next || next.id !== old.id) continue;
    out.set(old.id, keyOf(next));
    collectKeyMap(
      (old.children ?? []).filter((c) => String(c.type) === "TreeItem"),
      (next.children ?? []).filter(isItemNode),
      keyOf,
      out,
    );
  }
}

/** 자식 항목이 있는 항목의 새 key (DFS) — 펼침 채우기 (ADR-239 Phase 2). */
function collectParentKeys(
  nodes: readonly CanonicalNode[],
  keyOf: (node: CanonicalNode) => string,
  out: string[] = [],
): string[] {
  for (const node of nodes) {
    if (!isItemNode(node)) continue;
    const items = (node.children ?? []).filter(isItemNode);
    if (items.length > 0) {
      out.push(keyOf(node));
      collectParentKeys(items, keyOf, out);
    }
  }
  return out;
}

function mapKeyList(
  value: unknown,
  keyMap: ReadonlyMap<string, string>,
): { value: unknown; missing: boolean } {
  if (!Array.isArray(value)) return { value, missing: false };
  let missing = false;
  const next = value.map((key) => {
    const mapped = keyMap.get(String(key));
    if (mapped === undefined) {
      missing = true;
      return key;
    }
    return mapped;
  });
  return { value: next, missing };
}

const isNonEmptyArray = (value: unknown) =>
  Array.isArray(value) && value.length > 0;

/** Tree · Tree instance 이관 결과 — 다음 pass (instance) 가 origin 의 대응 · 유효 펼침을 읽는다. */
interface TreeHostMigration {
  node: CanonicalNode;
  keyMap: Map<string, string>;
  expandedKeys: unknown;
}

/**
 * Tree host (plain Tree · Components origin · Tree instance) 의 자기 자식 plain TreeItem 이관 + key 대응 + 펼침 채우기.
 * `origin` = instance 가 참조하는 Tree 의 이 pass 이관 결과 (plain host 는 undefined). 변화 없으면 null.
 *
 * 펼침 채우기 (ADR-239 Phase 2 · 사용자 판정 "A 유지: 전부 펼침"): 239 전 Canvas 는 중첩 행을 전부 그렸고 사용자 펼침
 * 선택이 저장된 경로가 없다 — `expandedKeys` 가 부재 · `[]` 이고 중첩 항목이 있으면 부모 항목 key 전부로 채운다. **이관과
 * 같은 pass 에서만** (plain TreeItem 이 있던 Tree = 239 전 문서) — 이관을 지난 Tree 의 `[]` 는 사용자가 전부 접은 값이라
 * 다시 채우지 않는다 (별도 표식 없이 1회).
 */
function migrateTreeHost(
  host: CanonicalNode,
  held: string[],
  origin?: TreeHostMigration,
): TreeHostMigration | null {
  let converted = false;
  const convert = (
    children: readonly CanonicalNode[] | undefined,
  ): CanonicalNode[] =>
    (children ?? []).map((child) => {
      if (isPlainTreeItem(child)) {
        converted = true;
        return toTreeItemRef(child, convert(child.children));
      }
      // 이미 ref 인 항목 (Slot "+" · 앞선 이관) 의 자기 자식 plain TreeItem 도 이관한다.
      if (child.type === "ref" && child.children?.length) {
        const nested = convert(child.children);
        return nested.every((c, i) => c === child.children![i])
          ? child
          : ({ ...child, children: nested } as CanonicalNode);
      }
      return child;
    });
  const nextChildren = convert(host.children);
  const addsSlot = host.id === TREE_ORIGIN_ID && host.slot === undefined;
  if (!converted && !addsSlot && !origin) return null;

  const { keyOf } = buildKeyContext(nextChildren, host.id);
  const keyMap = new Map<string, string>(origin?.keyMap ?? []);
  if (converted) {
    collectKeyMap(
      (host.children ?? []).filter((c) => String(c.type) === "TreeItem"),
      nextChildren.filter(isItemNode),
      keyOf,
      keyMap,
    );
  }

  const props = { ...((host.props ?? {}) as Record<string, unknown>) };
  let missing = false;
  for (const field of TREE_KEY_FIELDS) {
    if (!Array.isArray(props[field])) continue;
    const mapped = mapKeyList(props[field], keyMap);
    if (mapped.missing) missing = true;
    props[field] = mapped.value;
  }
  // instance 의 key 는 origin 이 정한 항목도 가리킨다 — 대응이 없으면 그대로 둔다 (origin 쪽이 보류를 판정).
  if (missing && !origin) {
    held.push(`${host.id}: 선택 · 펼침 key 중 대응 없는 값`);
    return null;
  }

  const ownParents = converted ? collectParentKeys(nextChildren, keyOf) : [];
  if (!origin) {
    if (
      converted &&
      ownParents.length > 0 &&
      !isNonEmptyArray(props.expandedKeys)
    ) {
      props.expandedKeys = ownParents;
    }
  } else {
    // instance — 유효 펼침 = 자기 값 ?? origin 값. 자기 값이 `[]` 거나 (origin 을 가린다) 자기 중첩 항목이 새로
    //   생겼으면 origin 의 채운 값 + 자기 부모 항목.
    const originKeys = Array.isArray(origin.expandedKeys)
      ? origin.expandedKeys.map(String)
      : [];
    const own = props.expandedKeys;
    const merged = [...originKeys, ...ownParents];
    if (
      merged.length > 0 &&
      ((Array.isArray(own) && own.length === 0) ||
        (!Array.isArray(own) && ownParents.length > 0))
    ) {
      props.expandedKeys = merged;
    }
  }

  const hostProps = (host.props ?? {}) as Record<string, unknown>;
  const unchanged =
    !converted &&
    !addsSlot &&
    TREE_KEY_FIELDS.every(
      (field) =>
        JSON.stringify(props[field]) === JSON.stringify(hostProps[field]),
    );
  if (unchanged) {
    return { node: host, keyMap, expandedKeys: props.expandedKeys };
  }
  return {
    node: {
      ...host,
      props,
      children: nextChildren,
      ...(addsSlot ? { slot: treeItemSlotIds() } : {}),
    } as CanonicalNode,
    keyMap,
    expandedKeys: props.expandedKeys,
  };
}

function isBoundTree(node: CanonicalNode): boolean {
  return (
    getElementDataBinding(
      node as unknown as Parameters<typeof getElementDataBinding>[0],
    ) != null
  );
}

/**
 * 문서의 plain Tree (Components origin 포함) 이관 → 그 Tree 를 참조하는 instance (자기 자식 · key 필드 · 펼침) →
 * interaction param 대응. 바인딩 Tree (`dataBinding`) 는 행 = 데이터라 대상 밖.
 */
export function migrateTreeItemsToInstances(
  document: CompositionDocument,
): CompositionDocument {
  const held: string[] = [];
  /** Tree id (plain · origin) → 이 pass 이관 결과. */
  const migrated = new Map<string, TreeHostMigration>();
  /** interaction 대상 id (Tree · instance) → key 대응. */
  const keyMaps = new Map<string, Map<string, string>>();
  let changed = false;

  const mapTree = (
    nodes: readonly CanonicalNode[],
    step: (node: CanonicalNode) => CanonicalNode,
  ): CanonicalNode[] =>
    nodes.map((node) => {
      let next = node;
      if (next.children) {
        const children = mapTree(next.children, step);
        if (!children.every((child, i) => child === next.children![i])) {
          next = { ...next, children };
        }
      }
      return step(next);
    });

  // 1단계 — plain Tree (Components origin 포함).
  let children = mapTree(document.children, (node) => {
    if (node.type !== "Tree" || isBoundTree(node)) return node;
    const result = migrateTreeHost(node, held);
    if (!result) return node;
    migrated.set(node.id, result);
    if (result.keyMap.size > 0) keyMaps.set(node.id, result.keyMap);
    if (result.node !== node) changed = true;
    return result.node;
  });

  // 2단계 — Tree instance (origin 이 1단계에서 이관됐거나 자기 자식에 plain TreeItem).
  const byId = new Map<string, CanonicalNode>();
  const index = (nodes: readonly CanonicalNode[]) => {
    for (const node of nodes) {
      byId.set(node.id, node);
      index(node.children ?? []);
    }
  };
  index(children);
  const chainEnd = (node: CanonicalNode): CanonicalNode | undefined => {
    let current: CanonicalNode | undefined = node;
    for (let depth = 0; current?.type === "ref" && depth < 8; depth += 1) {
      current = byId.get((current as TreeNode).ref ?? "");
    }
    return current;
  };
  children = mapTree(children, (node) => {
    if (node.type !== "ref") return node;
    const end = chainEnd(node);
    if (!end || end.type !== "Tree" || isBoundTree(node)) return node;
    const origin = migrated.get(end.id);
    const hasPlainItems = (node.children ?? []).some(isPlainTreeItem);
    if (!origin && !hasPlainItems) return node;
    const result = migrateTreeHost(
      node,
      held,
      origin ?? {
        node: end,
        keyMap: new Map(),
        expandedKeys: (end.props as Record<string, unknown> | undefined)
          ?.expandedKeys,
      },
    );
    if (!result) return node;
    if (result.keyMap.size > 0) keyMaps.set(node.id, result.keyMap);
    if (result.node !== node) changed = true;
    return result.node;
  });

  // interaction 규칙 (N4) — Tree · instance 대상 capability 의 key param.
  let events = document.events;
  if (keyMaps.size > 0 && Array.isArray(events)) {
    const nextEvents = events.map((rule): InteractionRule => {
      const action = (rule as { action?: unknown }).action;
      if (!isRecord(action) || action.kind !== "capability") return rule;
      const keyMap = keyMaps.get(String(action.targetId));
      const params = action.params;
      if (!keyMap || !isRecord(params) || typeof params.value !== "string") {
        return rule;
      }
      const mapped = keyMap.get(params.value);
      if (mapped === undefined || mapped === params.value) return rule;
      changed = true;
      return {
        ...rule,
        action: { ...action, params: { ...params, value: mapped } },
      } as InteractionRule;
    });
    events = nextEvents;
  }

  if (held.length > 0) console.warn("[ADR-239] Tree 이관 보류", held);
  if (!changed) return document;
  return {
    ...document,
    children,
    ...(events !== document.events ? { events } : {}),
  };
}
/** Components body id — 테스트가 origin 위치를 읽는다. */
export const TREE_COMPONENTS_BODY_ID = COMPONENTS_SYSTEM_BODY_ID;
