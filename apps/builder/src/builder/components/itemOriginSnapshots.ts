/**
 * ADR-239 G6 — 저장 history 스냅샷의 재생 시점 이관 (ADR-240 F28 선례 — `ensureRegionSlotsInSnapshot`).
 *
 * origin 편집 history 는 Components body 전체를 remove + insert 스냅샷으로 남긴다. 239 전에 저장된 스냅샷을 hydration
 * 이관 뒤에 Undo 하면 (a) 이관이 history 밖에서 더한 origin (TreeItem · ColorSwatch · ColorSwatchPicker 와 변형) 이
 * body 에서 빠져 이관된 항목 ref 가 끊기고 (Tree 행 · swatch 가 사라짐) (b) `component-tree` 가 plain TreeItem 으로
 * 돌아가 펼침 채움 전 모양이 된다. 재삽입되는 스냅샷을 문서 이관과 같은 함수로 맞춘다.
 *
 * - (a) body 스냅샷: 현재 body 에 있고 이 history 항목의 어느 body 스냅샷에도 없는 origin = history 밖 (이관) 추가 →
 *   스냅샷에 싣는다. 사용자가 이 항목에서 만든 · 지운 origin 은 두 스냅샷 중 하나에 있어 건드리지 않는다.
 * - (b) 모든 재삽입 스냅샷: Tree · swatch 이관 (멱등 — 이관을 지난 스냅샷은 같은 객체).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import { migrateColorSwatchesToInstances } from "./colorswatch/colorSwatchOrigins";
import { migrateTreeItemsToInstances } from "./tree/treeTemplateOrigins";

type SnapshotEvent = { type: string; node?: CanonicalNode };

const SNAPSHOT_HOLDER_ID = "__adr239-history-snapshot";

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function wrap(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children } as CompositionDocument;
}

function migrateSnapshotDocument(
  document: CompositionDocument,
): CompositionDocument {
  return migrateColorSwatchesToInstances(migrateTreeItemsToInstances(document));
}

function alignSnapshot(
  node: CanonicalNode,
  currentBody: CanonicalNode,
  carried: readonly CanonicalNode[],
): CanonicalNode {
  if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
    const withOrigins =
      carried.length > 0
        ? { ...node, children: [...(node.children ?? []), ...carried] }
        : node;
    const migrated = migrateSnapshotDocument(wrap([withOrigins]));
    return migrated.children[0] ?? withOrigins;
  }
  // origin 하나 · 사용자 페이지 노드: 현재 Components body (origin 조회) 옆에서 이관한다. 같은 id 의 origin 이면
  //   body 안 자리에 끼운다 (중복 id 금지).
  const bodyChildren = currentBody.children ?? [];
  const inBody = bodyChildren.some((child) => child.id === node.id);
  const body = inBody
    ? {
        ...currentBody,
        children: bodyChildren.map((child) =>
          child.id === node.id ? node : child,
        ),
      }
    : currentBody;
  const holder = {
    id: SNAPSHOT_HOLDER_ID,
    type: "frame",
    children: inBody ? [] : [node],
  } as unknown as CanonicalNode;
  const migrated = migrateSnapshotDocument(wrap([body, holder]));
  return findNode(migrated.children, node.id) ?? node;
}

export function alignItemOriginSnapshots<E extends SnapshotEvent>(
  document: CompositionDocument,
  events: E[],
): E[] {
  const reinserts = events.filter(
    (event) =>
      (event.type === "insert" || event.type === "remove") && event.node,
  );
  if (reinserts.length === 0) return events;
  const currentBody = findNode(document.children, COMPONENTS_SYSTEM_BODY_ID);
  if (!currentBody) return events;
  const snapshotOriginIds = new Set<string>();
  let hasBodySnapshot = false;
  for (const event of reinserts) {
    if (event.node!.id !== COMPONENTS_SYSTEM_BODY_ID) continue;
    hasBodySnapshot = true;
    for (const child of event.node!.children ?? []) {
      snapshotOriginIds.add(child.id);
    }
  }
  const carried = hasBodySnapshot
    ? (currentBody.children ?? []).filter(
        (child) => !snapshotOriginIds.has(child.id),
      )
    : [];
  return events.map((event) => {
    if ((event.type !== "insert" && event.type !== "remove") || !event.node) {
      return event;
    }
    const node = alignSnapshot(event.node, currentBody, carried);
    return node === event.node ? event : { ...event, node };
  });
}
