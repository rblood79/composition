/**
 * ADR-234 Phase 3 — Slot "+" = 목록 틀 (TabList · TagList · ListBox) 에 항목 instance 삽입 (breakdown §4 Phase 3).
 *
 * Tabs 는 Tab `id` 로 TabPanel 을 짝지으므로 (RAC `id` 짝 규칙) Tab instance 와 TabPanel 을 함께 만든다.
 * - plain 목록 틀 (origin · 문서 Tabs): TabList 에 Tab ref 자식 · TabPanels 에 TabPanel 자식.
 * - instance 의 synthetic 목록 틀 (`<instance>/<path>`): canonical 에 그 노드가 없다 — 바깥 instance 의
 *   `descendants` 에 목록 틀 · TabPanels 경로의 mode C (자식 교체) 로 (Pencil P5 와 같은 모양). 처음이면
 *   origin 의 현재 자식을 복제한 뒤 덧붙인다.
 * 항목은 slot 항목이 아니라 **항목 origin** (체인 끝) 을 가리킨다 — 휴지 변형을 직접 ref 하면 실행 중
 * 선택 상태가 그 patch 를 이기지 못한다 (선택 상태 = origin 자신, 층 patch 없음).
 * 그래서 slot 의 어느 모양을 골랐는지는 owner 의 선택 key 로 남긴다: 선택 모양 후보 (`metadata.variant:
 * "selected"`) 면 새 key 를 owner 선택 key 에 더하고, 휴지 후보면 항목만 (사용자 지적 2026-09-23 — 두 후보가
 * 같은 항목을 넣었다).
 */
import type {
  CanonicalNode,
  CompositionDocument,
  TreeItemKeyNode,
} from "@composition/shared";
import { resolveTreeItemKey } from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import {
  getSyntheticDescendantPathKey,
  getSyntheticDescendantRootId,
  isSyntheticDescendantId,
} from "../stores/canonical/syntheticDescendantLookup";
import {
  STATIC_COLLECTION_FAMILIES,
  buildItemInstances,
  indexNodes,
  resolveChainEnd,
  type StaticCollectionFamily,
} from "./staticCollectionMigration";

type RefLike = CanonicalNode & {
  ref?: string;
  descendants?: Record<string, unknown>;
};

export type TabItemInsertPlan =
  | {
      kind: "plain";
      /** 목록 틀 (TabList · TagList) id */
      tabListId: string;
      /** 새 항목 instance */
      tab: CanonicalNode;
      /** Tabs 만 — 짝 TabPanel 을 넣을 TabPanels */
      tabPanelsId: string | null;
      panel: CanonicalNode | null;
      /** 선택 모양 후보일 때 owner (plain 노드) 선택 key patch */
      selection: { ownerId: string; props: Record<string, unknown> } | null;
    }
  | {
      kind: "instance";
      instanceId: string;
      descendants: Record<string, unknown>;
      /** 선택 모양 후보일 때 instance 의 다음 props 전체 (자기 props + 선택 key — owner = instance root) */
      props: Record<string, unknown> | null;
    };

/** slot 의 선택 모양 후보 — 선택 가능한 가족의 항목 origin (ADR-234 이관: origin = 선택 상태). */
function isSelectedLookCandidate(
  candidate: CanonicalNode | undefined,
): boolean {
  return (
    (candidate?.metadata as Record<string, unknown> | undefined)?.variant ===
    "selected"
  );
}

/**
 * owner 선택 key 에 `key` 를 더하는 props patch. 읽기 순서는 Canvas `isOwnerSelectedKey` 와 같고
 * (`selectedKeys ?? defaultSelectedKeys` · `selectedKey ?? defaultSelectedKey`), 쓸 키는 이미 있는 키 — 없으면
 * renderer 정식 계약 키 (`selectedKeys` · `selectedKey`). Tabs 와 `selectionMode: "single"` 은 교체.
 */
function selectionPatch(
  ownerType: string,
  ownerProps: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  if (ownerType === "Tabs") {
    return ownerProps.selectedKey === undefined &&
      ownerProps.defaultSelectedKey !== undefined
      ? { defaultSelectedKey: key }
      : { selectedKey: key };
  }
  const prop =
    ownerProps.selectedKeys === undefined &&
    ownerProps.defaultSelectedKeys !== undefined
      ? "defaultSelectedKeys"
      : "selectedKeys";
  const current = ownerProps[prop];
  if (current === "all") return null;
  if (ownerProps.selectionMode === "single") return { [prop]: [key] };
  const keys = Array.isArray(current) ? current.map(String) : [];
  return { [prop]: [...keys, key] };
}

function findParent(
  document: CompositionDocument,
  childId: string,
): CanonicalNode | undefined {
  const visit = (
    nodes: readonly CanonicalNode[] | undefined,
  ): CanonicalNode | undefined => {
    for (const node of nodes ?? []) {
      if (node.children?.some((child) => child.id === childId)) return node;
      const hit = visit(node.children);
      if (hit) return hit;
    }
    return undefined;
  };
  return visit(document.children);
}

/** origin subtree 에서 segment 경로 (`a/b`) 로 노드를 찾는다. */
function findBySegmentPath(
  root: CanonicalNode,
  path: string,
): { node: CanonicalNode; parent: CanonicalNode } | null {
  let parent = root;
  const segments = path.split("/");
  for (let index = 0; index < segments.length; index += 1) {
    const node = (parent.children ?? []).find(
      (child) => getCanonicalRefPathSegment(child) === segments[index],
    );
    if (!node) return null;
    if (index === segments.length - 1) return { node, parent };
    parent = node;
  }
  return null;
}

function cloneWithFreshIds(
  nodes: readonly CanonicalNode[],
  prefix: string,
  taken: Set<string>,
): CanonicalNode[] {
  return nodes.map((node) => {
    let id = `${prefix}__${node.id}`;
    for (let n = 2; taken.has(id); n += 1) id = `${prefix}__${node.id}-${n}`;
    taken.add(id);
    return {
      ...node,
      id,
      ...(node.children
        ? { children: cloneWithFreshIds(node.children, prefix, taken) }
        : {}),
    };
  });
}

/**
 * ADR-239 Phase 2 — 항목 host (TreeItem) 에 하위 항목을 넣으면 host 를 소속 Tree `expandedKeys` 에 더한다 (펼침 정본 —
 * 접힌 항목에 넣은 항목은 두 leg 모두 보이지 않는다). host key = `resolveTreeItemKey` (부모 TreeItem 이 instance 면 부모
 * key 접두). `roots` 는 host 를 품은 subtree (문서 · instance 가 참조하는 origin), owner 의 현재 값은 ref 체인에서 처음 만난
 * 배열. 이미 펼쳐져 있거나 소속 Tree 가 없으면 null.
 */
function treeHostExpansion(
  roots: readonly CanonicalNode[],
  byId: ReadonlyMap<string, CanonicalNode>,
  hostId: string,
  ownerProps?: Record<string, unknown>,
): { ownerId: string; expandedKeys: string[] } | null {
  const found = findTreeItemOwner(roots, byId, hostId);
  if (!found) return null;
  const { host, owner, parents, isItem } = found;
  const key = resolveTreeItemKey(
    host as TreeItemKeyNode & CanonicalNode,
    (node) => {
      const parent = parents.get(node.id);
      return parent && isItem(parent)
        ? (parent as TreeItemKeyNode & CanonicalNode)
        : undefined;
    },
    (node) => node.type === "ref",
  );
  let current: unknown = ownerProps?.expandedKeys;
  let cursor: CanonicalNode | undefined = owner;
  for (let depth = 0; !Array.isArray(current) && cursor && depth < 8; depth += 1) {
    current = (cursor.props as Record<string, unknown> | undefined)
      ?.expandedKeys;
    cursor =
      cursor.type === "ref"
        ? byId.get((cursor as RefLike).ref ?? "")
        : undefined;
  }
  const keys = Array.isArray(current) ? current.map(String) : [];
  if (keys.includes(key)) return null;
  return { ownerId: owner.id, expandedKeys: [...keys, key] };
}

/**
 * ADR-239 판독 M1 — 항목 host (TreeItem) 의 소속 Tree (조상 TreeItem 사슬 위). 없으면 null — Components 의 TreeItem
 * origin · 상태 변형 · Tree 밖 instance 는 하위 항목 host 가 아니다 (Canvas 는 하위 행을 Tree 행 평탄화로만 그리고,
 * RAC TreeItem 은 Tree collection 밖에서 행을 만들지 않는다).
 */
function findTreeItemOwner(
  roots: readonly CanonicalNode[],
  byId: ReadonlyMap<string, CanonicalNode>,
  hostId: string,
): {
  host: CanonicalNode;
  owner: CanonicalNode;
  parents: Map<string, CanonicalNode>;
  isItem: (node: CanonicalNode) => boolean;
} | null {
  const parents = new Map<string, CanonicalNode>();
  const index = (nodes: readonly CanonicalNode[], parent?: CanonicalNode) => {
    for (const node of nodes) {
      if (parent) parents.set(node.id, parent);
      index(node.children ?? [], node);
    }
  };
  index(roots);
  const chainType = (node: CanonicalNode) =>
    node.type === "ref" ? resolveChainEnd(node.id, byId)?.type : node.type;
  const isItem = (node: CanonicalNode) => String(chainType(node)) === "TreeItem";
  const host = byId.get(hostId) ?? findInRoots(roots, hostId);
  if (!host) return null;
  let owner = parents.get(hostId);
  while (owner && isItem(owner)) owner = parents.get(owner.id);
  if (!owner || String(chainType(owner)) !== "Tree") return null;
  return { host, owner, parents, isItem };
}

function findInRoots(
  roots: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of roots) {
    if (node.id === id) return node;
    const hit = findInRoots(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * `hostId` (목록 틀 — plain 또는 synthetic) 에 `candidateId` (slot 항목) 의 항목을 넣는 계획. 넣을 수 없으면
 * null (origin 누락 · 구조 불일치).
 */
export function planTabItemInsert(input: {
  document: CompositionDocument;
  hostId: string;
  candidateId: string;
  newKey: string;
}): TabItemInsertPlan | null {
  const { document, hostId, candidateId, newKey } = input;
  const byId = indexNodes(document);
  const taken = new Set(byId.keys());
  const origin = resolveChainEnd(candidateId, byId);
  if (!origin) return null;
  const selectsNewItem = isSelectedLookCandidate(byId.get(candidateId));
  // ADR-238 Phase 2 — 목록 틀 = owner 또는 section (section host) · 후보 = 항목 origin 또는 section origin (목록 host).
  const familyOf = (listType: string): StaticCollectionFamily | undefined =>
    STATIC_COLLECTION_FAMILIES.find(
      (f) =>
        ((f.listType ?? f.ownerType) === listType &&
          (origin.type === f.itemType ||
            (f.sectionType !== undefined && origin.type === f.sectionType))) ||
        (f.sectionType !== undefined &&
          f.sectionType === listType &&
          origin.type === f.itemType) ||
        // ADR-239 Phase 1 — 항목 안 항목 (TreeItem host 에 TreeItem).
        (f.recursiveItems === true &&
          f.itemType === listType &&
          origin.type === f.itemType),
    );
  /** ADR-239 — host 가 항목 자신 (재귀 목록) 이면 선택 key 를 쓰지 않는다 (선택 owner = 조상). */
  const isItemHost = (family: StaticCollectionFamily, hostType: string) =>
    family.recursiveItems === true && hostType === family.itemType;
  /** 판독 M1 — TreeItem host 는 소속 Tree 안에서만 (MenuItem 하위 메뉴는 Menu 밖 제약 없음). */
  const lacksTreeOwner = (
    family: StaticCollectionFamily,
    hostType: string,
    hostId: string,
  ) =>
    isItemHost(family, hostType) &&
    family.itemType === "TreeItem" &&
    !findTreeItemOwner(document.children, byId, hostId);
  /** 목록 틀 자식 하나 — section origin 이면 section instance (`props.id` = 새 key), 아니면 항목 instance. */
  const buildChild = (
    family: StaticCollectionFamily,
    prefix: string,
    count: number,
  ): CanonicalNode => {
    if (
      family.sectionType !== undefined &&
      origin.type === family.sectionType
    ) {
      let id = `${prefix}__section-${count + 1}`;
      for (let n = 2; taken.has(id); n += 1)
        id = `${prefix}__section-${count + 1}-${n}`;
      taken.add(id);
      return {
        id,
        type: "ref",
        ref: origin.id,
        props: { id: newKey },
      } as unknown as CanonicalNode;
    }
    return buildItemInstances(
      family,
      [newRow(count)],
      prefix,
      origin,
      taken,
      count,
    )[0]!;
  };
  const insertsSection = (family: StaticCollectionFamily) =>
    family.sectionType !== undefined && origin.type === family.sectionType;
  /** 선택 모양 후보면 owner 선택 key 에 더한다 — section 삽입 · Select/ComboBox (popover 항목) 는 제외. */
  const selectsFor = (family: StaticCollectionFamily) =>
    selectsNewItem &&
    !insertsSection(family) &&
    family.skipsSelectionOnInsert !== true;
  const newRow = (count: number) => ({
    id: newKey,
    title: `${origin.type} ${count + 1}`,
    label: `${origin.type} ${count + 1}`,
  });

  if (!isSyntheticDescendantId(hostId)) {
    const host = byId.get(hostId);
    // 목록 틀 = owner 인 가족 (ListBox) 의 instance — 항목은 instance 자기 자식으로 덧붙는다 (origin 항목 뒤,
    //   두 leg 공통 의미). 번호는 origin 항목 + 자기 자식 수부터.
    if (host?.type === "ref") {
      const master = resolveChainEnd((host as RefLike).ref, byId);
      const family = master ? familyOf(master.type) : undefined;
      if (
        !master ||
        !family ||
        (family.listType !== null && master.type !== family.sectionType)
      ) {
        return null;
      }
      if (lacksTreeOwner(family, master.type, host.id)) return null;
      // ADR-239 — 항목 host (TreeItem) 는 역할 자식 (Label) 을 항목으로 세지 않는다.
      const countOf = (nodes: readonly CanonicalNode[] | undefined) =>
        isItemHost(family, master.type)
          ? (nodes ?? []).filter(
              (child) => resolveChainEnd(child.id, byId)?.type === family.itemType,
            ).length
          : (nodes ?? []).length;
      const count = countOf(master.children) + countOf(host.children);
      const item = buildChild(family, host.id, count);
      const hostProps = (host.props ?? {}) as Record<string, unknown>;
      // section instance host 의 항목 선택 key 는 owner (목록) 가 갖는다 — 여기서는 쓰지 않는다.
      const patch =
        selectsFor(family) &&
        master.type !== family.sectionType &&
        !isItemHost(family, master.type)
          ? selectionPatch(
              family.ownerType,
              { ...(master.props as Record<string, unknown>), ...hostProps },
              newKey,
            )
          : null;
      // ADR-239 Phase 2 — 항목 host 는 선택 대신 소속 Tree 펼침에 host 를 더한다.
      const expansion = isItemHost(family, master.type)
        ? treeHostExpansion(document.children, byId, host.id)
        : null;
      return {
        kind: "plain",
        tabListId: host.id,
        tab: item,
        tabPanelsId: null,
        panel: null,
        selection: patch
          ? { ownerId: host.id, props: patch }
          : expansion
            ? {
                ownerId: expansion.ownerId,
                props: { expandedKeys: expansion.expandedKeys },
              }
            : null,
      };
    }
    const list = host;
    const family = list ? familyOf(list.type) : undefined;
    if (!list || !family) return null;
    if (lacksTreeOwner(family, list.type, list.id)) return null;
    const owner = findParent(document, list.id);
    const tabPanels =
      family.ownerType === "Tabs"
        ? owner?.children?.find((child) => child.type === "TabPanels")
        : undefined;
    const count = isItemHost(family, list.type)
      ? (list.children ?? []).filter(
          (child) => resolveChainEnd(child.id, byId)?.type === family.itemType,
        ).length
      : (list.children ?? []).length;
    const tab = buildChild(family, list.id, count);
    // 선택 owner — 목록 틀 = owner 인 가족 (ListBox) 은 자기, section host 와 나머지는 부모 (TagGroup · Tabs).
    const selectionOwner = isItemHost(family, list.type)
      ? undefined
      : family.listType === null && list.type !== family.sectionType
        ? list
        : owner;
    const patch =
      selectsFor(family) && selectionOwner
        ? selectionPatch(
            family.ownerType,
            (selectionOwner.props ?? {}) as Record<string, unknown>,
            newKey,
          )
        : null;
    return {
      kind: "plain",
      tabListId: list.id,
      tab,
      tabPanelsId: tabPanels?.id ?? null,
      panel: tabPanels
        ? {
            id: `${tabPanels.id}__panel-${newKey}`,
            type: "TabPanel",
            props: { itemId: newKey },
          }
        : null,
      selection:
        patch && selectionOwner
          ? { ownerId: selectionOwner.id, props: patch }
          : null,
    };
  }

  const instanceId = getSyntheticDescendantRootId(hostId);
  const listPath = getSyntheticDescendantPathKey(hostId);
  const instance = instanceId ? (byId.get(instanceId) as RefLike) : undefined;
  if (!instance || instance.type !== "ref" || !listPath) return null;
  const master = resolveChainEnd(instance.ref, byId);
  if (!master) return null;
  const listHit = findBySegmentPath(master, listPath);
  // ADR-239 — 목록 틀이 origin 안의 ref (TreeItem instance) 면 체인 끝 type 으로 가족을 찾는다.
  const listType =
    listHit?.node.type === "ref"
      ? resolveChainEnd(listHit.node.id, byId)?.type
      : listHit?.node.type;
  const family = listHit && listType ? familyOf(listType) : undefined;
  if (!listHit || !family) return null;
  // 상속 항목 host — origin 이 Tree 이거나 instance (TreeItem) 자신이 Tree 안에 있어야 한다 (M1).
  // 소속 Tree 는 origin 안쪽 경로 (Tree origin · 사용자 컴포넌트 안 Tree) 에서 먼저, 없으면 instance 쪽 (Tree 안 항목 instance).
  if (
    !findTreeItemOwner([master], byId, listHit.node.id) &&
    lacksTreeOwner(family, listType!, instance.id)
  ) {
    return null;
  }
  const tabPanels =
    family.ownerType === "Tabs"
      ? listHit.parent.children?.find((child) => child.type === "TabPanels")
      : undefined;
  const parentPath = listPath.split("/").slice(0, -1).join("/");
  const tabPanelsPath = tabPanels
    ? [parentPath, getCanonicalRefPathSegment(tabPanels)]
        .filter(Boolean)
        .join("/")
    : null;

  const descendants = { ...(instance.descendants ?? {}) };
  const currentChildren = (path: string, fallback: CanonicalNode) => {
    const patch = descendants[path] as { children?: unknown } | undefined;
    return Array.isArray(patch?.children)
      ? (patch.children as CanonicalNode[])
      : cloneWithFreshIds(fallback.children ?? [], instance.id, taken);
  };
  const itemChildren = currentChildren(listPath, listHit.node);
  const item = buildChild(family, instance.id, itemChildren.length);
  descendants[listPath] = {
    ...((descendants[listPath] as Record<string, unknown>) ?? {}),
    children: [...itemChildren, item],
  };
  if (tabPanels && tabPanelsPath) {
    const panelChildren = currentChildren(tabPanelsPath, tabPanels);
    descendants[tabPanelsPath] = {
      ...((descendants[tabPanelsPath] as Record<string, unknown>) ?? {}),
      children: [
        ...panelChildren,
        {
          id: `${instance.id}__panel-${newKey}`,
          type: "TabPanel",
          props: { itemId: newKey },
        },
      ],
    };
  }
  // 선택 owner = 목록 틀의 부모. instance root 면 instance 자기 props, 더 안쪽이면 그 경로의 descendants props.
  let props: Record<string, unknown> | null = null;
  if (selectsFor(family) && !isItemHost(family, String(listType))) {
    const instanceProps = (instance.props ?? {}) as Record<string, unknown>;
    if (listHit.parent === master) {
      const patch = selectionPatch(
        family.ownerType,
        { ...(master.props as Record<string, unknown>), ...instanceProps },
        newKey,
      );
      props = patch ? { ...instanceProps, ...patch } : null;
    } else if (parentPath) {
      const parentPatch = (descendants[parentPath] ?? {}) as {
        props?: Record<string, unknown>;
      };
      const patch = selectionPatch(
        family.ownerType,
        {
          ...(listHit.parent.props as Record<string, unknown>),
          ...(parentPatch.props ?? {}),
        },
        newKey,
      );
      if (patch) {
        descendants[parentPath] = {
          ...parentPatch,
          props: { ...(parentPatch.props ?? {}), ...patch },
        };
      }
    }
  }
  // ADR-239 Phase 2 — instance 가 상속한 항목 host: origin (Tree) 안 key 로 instance 펼침에 더한다.
  if (isItemHost(family, String(listType)) && master.type === "Tree") {
    const instanceProps = (props ?? instance.props ?? {}) as Record<
      string,
      unknown
    >;
    const expansion = treeHostExpansion(
      [master],
      byId,
      listHit.node.id,
      Array.isArray(instanceProps.expandedKeys) ? instanceProps : undefined,
    );
    if (expansion) {
      props = { ...instanceProps, expandedKeys: expansion.expandedKeys };
    }
  }
  return { kind: "instance", instanceId: instance.id, descendants, props };
}
