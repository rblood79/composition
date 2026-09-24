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

export const TREE_ITEM_DEFAULT_ORIGIN_ID = "component-tree-item-default";
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

/** 239 전 key (Preview `renderTree` — 노드 id) → 새 key 대응을 Tree subtree 에서 모은다. */
function collectKeyMap(
  before: readonly CanonicalNode[],
  after: readonly CanonicalNode[],
  byIdAfter: ReadonlyMap<string, TreeNode>,
  parentOf: ReadonlyMap<string, string>,
  out: Map<string, string>,
): void {
  const isInstance = (node: TreeNode) => node.type === "ref";
  const getParentItem = (node: TreeNode): TreeNode | undefined => {
    const parentId = parentOf.get(node.id);
    const parent = parentId ? byIdAfter.get(parentId) : undefined;
    return parent && (String(parent.type) === "TreeItem" || parent.type === "ref")
      ? parent
      : undefined;
  };
  for (let i = 0; i < before.length; i += 1) {
    const old = before[i]!;
    const next = after[i];
    if (!next || next.id !== old.id) continue;
    const oldKey = old.id;
    const newKey = resolveTreeItemKey(
      next as TreeNode,
      getParentItem,
      isInstance,
    );
    out.set(oldKey, newKey);
    collectKeyMap(
      (old.children ?? []).filter((c) => String(c.type) === "TreeItem"),
      (next.children ?? []).filter(
        (c) => String(c.type) === "TreeItem" || c.type === "ref",
      ),
      byIdAfter,
      parentOf,
      out,
    );
  }
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

/** plain Tree (origin 포함) 의 TreeItem 자식 이관 — 결과 노드 · key 대응 (변화 없으면 null). */
function migratePlainTree(
  tree: CanonicalNode,
  held: string[],
): { node: CanonicalNode; keyMap: Map<string, string> } | null {
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
  const nextChildren = convert(tree.children);
  const addsSlot = tree.id === TREE_ORIGIN_ID && tree.slot === undefined;
  if (!converted && !addsSlot) return null;

  const keyMap = new Map<string, string>();
  if (converted) {
    const byIdAfter = new Map<string, TreeNode>();
    const parentOf = new Map<string, string>();
    const index = (nodes: readonly CanonicalNode[], parentId: string) => {
      for (const node of nodes) {
        byIdAfter.set(node.id, node as TreeNode);
        parentOf.set(node.id, parentId);
        index(node.children ?? [], node.id);
      }
    };
    index(nextChildren, tree.id);
    collectKeyMap(
      (tree.children ?? []).filter((c) => String(c.type) === "TreeItem"),
      nextChildren.filter((c) => String(c.type) === "TreeItem" || c.type === "ref"),
      byIdAfter,
      parentOf,
      keyMap,
    );
  }

  const props = { ...((tree.props ?? {}) as Record<string, unknown>) };
  let missing = false;
  for (const field of TREE_KEY_FIELDS) {
    if (!(field in props)) continue;
    const mapped = mapKeyList(props[field], keyMap);
    if (mapped.missing) missing = true;
    props[field] = mapped.value;
  }
  if (missing) {
    held.push(`${tree.id}: 선택 · 펼침 key 중 대응 없는 값`);
    return null;
  }
  return {
    node: {
      ...tree,
      props,
      children: nextChildren,
      ...(addsSlot ? { slot: treeItemSlotIds() } : {}),
    } as CanonicalNode,
    keyMap,
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
 * 문서의 plain Tree (Components origin 포함) 이관 + 그 Tree 를 참조하는 instance 의 key 필드 · interaction param 대응.
 * 바인딩 Tree (`dataBinding`) 는 행 = 데이터라 대상 밖.
 */
export function migrateTreeItemsToInstances(
  document: CompositionDocument,
): CompositionDocument {
  const held: string[] = [];
  /** Tree id → key 대응 (plain Tree · origin). instance 는 origin 의 대응을 쓴다. */
  const keyMaps = new Map<string, Map<string, string>>();
  let changed = false;

  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      let next = node;
      if (next.children) {
        const children = visit(next.children);
        if (!children.every((child, i) => child === next.children![i])) {
          next = { ...next, children };
        }
      }
      if (next.type === "Tree" && !isBoundTree(next)) {
        const migrated = migratePlainTree(next, held);
        if (migrated) {
          changed = true;
          if (migrated.keyMap.size > 0) keyMaps.set(next.id, migrated.keyMap);
          return migrated.node;
        }
      }
      return next;
    });

  let children = visit(document.children);

  // Tree instance (origin 이 이관된 ref) 의 key 필드 — origin 의 대응표로 (instance 자기 자식 plain 항목은 드물어
  //   instance 는 root props 만 옮긴다).
  const instanceKeyMap = (ref: unknown): Map<string, string> | undefined =>
    typeof ref === "string" ? keyMaps.get(ref) : undefined;
  const instanceKeyMaps = new Map<string, Map<string, string>>();
  const remapInstances = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      let next = node;
      if (next.children) {
        const kids = remapInstances(next.children);
        if (!kids.every((child, i) => child === next.children![i])) {
          next = { ...next, children: kids };
        }
      }
      const keyMap =
        next.type === "ref"
          ? instanceKeyMap((next as TreeNode).ref)
          : undefined;
      if (!keyMap) return next;
      const props = { ...((next.props ?? {}) as Record<string, unknown>) };
      let touched = false;
      for (const field of TREE_KEY_FIELDS) {
        if (!Array.isArray(props[field])) continue;
        const mapped = mapKeyList(props[field], keyMap);
        props[field] = mapped.value;
        touched = true;
      }
      // interaction 규칙이 instance 를 대상으로 해도 같은 대응 (아래 events pass).
      instanceKeyMaps.set(next.id, keyMap);
      if (!touched) return next;
      changed = true;
      return { ...next, props } as CanonicalNode;
    });
  if (keyMaps.size > 0) children = remapInstances(children);

  // interaction 규칙 (N4) — Tree 대상 capability 의 key param.
  let events = document.events;
  if (keyMaps.size > 0 && Array.isArray(events)) {
    const nextEvents = events.map((rule): InteractionRule => {
      const action = (rule as { action?: unknown }).action;
      if (!isRecord(action) || action.kind !== "capability") return rule;
      const keyMap =
        keyMaps.get(String(action.targetId)) ??
        instanceKeyMaps.get(String(action.targetId));
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
