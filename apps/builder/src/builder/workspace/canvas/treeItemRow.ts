/**
 * ADR-239 Phase 1 — Tree 행 (TreeItem) 의 Canvas 공용 판정 (layout · Skia 가 같은 함수를 읽는다).
 *
 * DOM (RAC Tree) 은 중첩 TreeItem 을 **평탄한 행** 으로 그린다 — 부모 행 상자 안에 자식 행을 넣지 않는다. 239 전
 * Canvas 는 중첩 TreeItem 을 부모 행 상자 (고정 높이) 안에 겹쳐 그렸다 (breakdown §5 N1). 그래서:
 * - Tree layout 자식 = TreeItem 자손을 DFS 순서로 편 행 목록 (`flattenTreeRows`) — 각 행 상자는 자기 행만.
 * - TreeItem layout 자식 = 역할 자식 (Label Text · Icon …) 만 — 행 안에 가로로, 왼쪽 여백 = chevron 앞까지
 *   (`resolveTreeItemContentInset` — Skia 가 옛 행 글자를 밀던 폭과 같은 식).
 * - 들여쓰기 깊이 · 선택 체크박스는 canonical 부모 사슬 (scene) 로 계산한다 (평탄화와 무관).
 */
import {
  resolveBindingSelectionMode,
  resolveBindingSelectionStyle,
  resolveSelectionCheckboxVisible,
} from "@composition/shared";

import { resolveCanvasTreeItemKey } from "../../../adapters/canonical/canonicalRefResolution";
import { resolveSkiaRule } from "./skia/resolveSkiaVisualRule";

/** 판정에 필요한 최소 노드 — CanvasSceneNode · CanvasLayoutNode 공통. */
export interface TreeRowNode {
  id: string;
  type: string;
  parent_id?: string | null;
  props?: Record<string, unknown> | null;
}

/**
 * TreeItem depth (1-based) — parent 체인의 TreeItem 조상 수 + 1. Tree 에 닿거나 TreeItem 사슬 밖이면 멈춘다.
 * 무한 루프 방지 상한 32.
 */
export function resolveTreeItemLevel<N extends TreeRowNode>(
  element: N,
  elementsMap: ReadonlyMap<string, N>,
): number {
  let level = 1;
  let currentId: string | null | undefined = element.parent_id;
  for (let guard = 0; guard < 32 && currentId; guard++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor || ancestor.type !== "TreeItem") break;
    level++;
    currentId = ancestor.parent_id;
  }
  return level;
}

/**
 * TreeItem 행에 선택 체크박스를 그릴지 — 조상 Tree 의 selection 축 (DOM `TreeItemContent` 의 RAC renderProps
 * `selectionBehavior === "toggle" && selectionMode !== "none"` 와 같은 helper · 같은 fallback).
 */
export function resolveTreeSelectionCheckboxVisible<N extends TreeRowNode>(
  element: N,
  elementsMap: ReadonlyMap<string, N>,
): boolean {
  let currentId: string | null | undefined = element.parent_id;
  for (let guard = 0; guard < 32 && currentId; guard++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) return false;
    if (ancestor.type === "Tree") {
      const p = (ancestor.props ?? {}) as Record<string, unknown>;
      return resolveSelectionCheckboxVisible({
        selectionMode: p.selectionMode,
        selectionStyle:
          p.selectionStyle ?? resolveBindingSelectionStyle("Tree"),
        selectionBehavior: p.selectionBehavior,
        defaultSelectionMode: resolveBindingSelectionMode("Tree", "single"),
        checkboxModes: ["single", "multiple"],
        fallback: "replace",
      });
    }
    if (ancestor.type !== "TreeItem") return false;
    currentId = ancestor.parent_id;
  }
  return false;
}

/** 역할 자식 (행 안 내용) — 중첩 TreeItem 이 아닌 자식. */
export function isTreeItemRoleChild(child: { type: string }): boolean {
  return child.type !== "TreeItem";
}

/**
 * 행 안 내용의 왼쪽 여백 (px) = paddingX + (level − 1) × indentPerLevel + [체크박스 + gap] + chevron (iconSize + gap).
 * Skia `buildCatalogShapes` 가 옛 행 글자를 밀던 식 (`resolveTreeIndent` + `resolveSelectionSlot` +
 * `resolveLeadingSlot`) 과 같은 값 — DOM 은 padding 8 + chevron 버튼 20 (+ 들여쓰기) + gap 2 로 같은 x 에 놓는다.
 */
export function resolveTreeItemContentInset<N extends TreeRowNode>(
  element: N,
  elementsMap: ReadonlyMap<string, N>,
): { left: number; right: number } {
  const rule = resolveSkiaRule("TreeItem");
  const sizeName = String(
    (element.props as Record<string, unknown> | undefined)?.size ??
      rule?.defaultSize ??
      "md",
  );
  const size = (rule?.sizes?.[sizeName] ?? rule?.sizes?.md) as
    Record<string, unknown> | undefined;
  const visual = rule?.variants?.[rule?.defaultVariant ?? "default"] as
    Record<string, unknown> | undefined;
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" ? value : fallback;
  const paddingX = num(size?.paddingX, 8);
  const indent = num(size?.indentPerLevel, 16);
  const iconSize = num(size?.iconSize, 16);
  const leadingIcon = visual?.leadingIcon as { gap?: unknown } | undefined;
  const chevron = leadingIcon ? iconSize + num(leadingIcon.gap, 6) : 0;
  const checkbox = visual?.selectionCheckbox as
    { size?: unknown; gap?: unknown } | undefined;
  const checkboxWidth =
    checkbox && resolveTreeSelectionCheckboxVisible(element, elementsMap)
      ? num(checkbox.size, 20) + num(checkbox.gap, 2)
      : 0;
  const level = resolveTreeItemLevel(element, elementsMap);
  return {
    left: paddingX + (level - 1) * indent + checkboxWidth + chevron,
    right: paddingX,
  };
}

/**
 * Tree layout 자식 — TreeItem 자손을 DFS (부모 행 → 그 자식 행들) 순서로 편다. `includeChildrenOf` 가 false 인
 * 항목 (Phase 2 — 접힘) 은 자식 행을 싣지 않는다. TreeItem 아닌 직계 자식 (없어야 정상) 은 그 자리 그대로.
 */
export function flattenTreeRows<N extends { id: string; type: string }>(
  children: readonly N[],
  getChildren: (id: string) => readonly N[],
  includeChildrenOf: (item: N) => boolean = () => true,
): N[] {
  const out: N[] = [];
  const visit = (nodes: readonly N[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.type !== "TreeItem" || !includeChildrenOf(node)) continue;
      visit(getChildren(node.id).filter((child) => child.type === "TreeItem"));
    }
  };
  visit(children);
  return out;
}

/** 가장 가까운 Tree 조상 (TreeItem 사슬 위) — 없으면 undefined (Components 페이지 단독 TreeItem). */
export function findOwnerTree<N extends TreeRowNode>(
  element: N,
  elementsMap: ReadonlyMap<string, N>,
): N | undefined {
  let currentId: string | null | undefined = element.parent_id;
  for (let guard = 0; guard < 32 && currentId; guard++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) return undefined;
    if (ancestor.type === "Tree") return ancestor;
    if (ancestor.type !== "TreeItem") return undefined;
    currentId = ancestor.parent_id;
  }
  return undefined;
}

/**
 * ADR-239 Phase 2 — TreeItem 의 유효 펼침 (정본 = 소속 Tree `expandedKeys`). Preview `renderTree` 와 같은 읽기:
 * `expandedKeys` 가 배열이 아니면 `[]` (controlled — 부재 = 전부 접힘, RAC 기본), 항목 key 는 `resolveCanvasTreeItemKey`
 * (Preview RAC key 와 같은 함수). Tree 밖 단독 TreeItem (Components 페이지 origin · `--collapsed` 변형) 은 자기
 * `isExpanded` (부재 = 펼침 — origin = 가장 완성된 모양, 237 Disclosure 선례).
 */
export function isTreeItemExpanded<N extends TreeRowNode>(
  element: N,
  elementsMap: ReadonlyMap<string, N>,
): boolean {
  const tree = findOwnerTree(element, elementsMap);
  if (!tree) {
    return (element.props as Record<string, unknown> | undefined)?.isExpanded !== false;
  }
  const keys = (tree.props as Record<string, unknown> | undefined)?.expandedKeys;
  if (!Array.isArray(keys) || keys.length === 0) return false;
  const key = resolveCanvasTreeItemKey(
    element as never,
    elementsMap as never,
  );
  return keys.some((entry) => String(entry) === key);
}
