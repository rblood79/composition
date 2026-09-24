/**
 * ADR-240 Phase 1 — Dialog 영역 구조 이관의 경로 전치 (문서 hydration · 저장 history 재생 공용).
 *
 * 구조 이관 (`regionSlotOrigins.ensureRegionSlots`) 은 Description 을 Content 영역 frame 안으로 옮긴다. 옛
 * instance patch 키 `<본문>/<Description>` 은 `<본문>/Content/<Description>` 이 된다. 전치 표는 **이관을 지난
 * origin** 에서 읽는다 (Description id 는 문서 세대마다 다르다 — F17 · G0 F6 정정). 문서 이관과 history 재생
 * (`applyCanonicalHistoryEventsToDocument`) 이 같은 함수를 쓴다 — 이관 전 스냅샷을 Undo/Redo 로 되살려도 새 경로.
 * 의존은 shared 타입과 경로 segment 정본뿐 (history 모듈이 import 한다).
 */
import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";

export const DIALOG_ORIGIN_ID = "component-dialog";
export const DIALOG_CONTENT_REGION_ID = `${DIALOG_ORIGIN_ID}__content-region`;
export const DIALOG_ACTIONS_REGION_ID = `${DIALOG_ORIGIN_ID}__actions-region`;
/** 영역 frame 의 name = 경로 segment (`getCanonicalRefPathSegment` — Canvas · Properties 쓰기 키). */
export const DIALOG_CONTENT_REGION_NAME = "Content";
export const DIALOG_ACTIONS_REGION_NAME = "Actions";

/** 이관 뒤 origin 에서 읽은 전치 표 — Description 옛 경로 접두사 → 새 경로 접두사. */
export interface DialogRegionPathRewrite {
  originId: string;
  pairs: ReadonlyArray<{ from: string; to: string }>;
}

function segmentForms(node: CanonicalNode): string[] {
  const segment = getCanonicalRefPathSegment(node);
  return segment === node.id ? [segment] : [segment, node.id];
}

/** origin 이 이관된 모양 (Content 영역 frame 보유) 이면 전치 표, 아니면 null. */
export function buildDialogRegionPathRewrite(
  origin: CanonicalNode | undefined,
): DialogRegionPathRewrite | null {
  if (!origin || origin.type !== "DialogTrigger") return null;
  const pairs: Array<{ from: string; to: string }> = [];
  for (const body of origin.children ?? []) {
    if (body.type !== "Dialog") continue;
    const region = (body.children ?? []).find(
      (child) => child.metadata?.slotRole === "content",
    );
    if (!region) continue;
    const regionSegment = getCanonicalRefPathSegment(region);
    for (const bodySegment of segmentForms(body)) {
      for (const moved of region.children ?? []) {
        for (const movedSegment of segmentForms(moved)) {
          pairs.push({
            from: `${bodySegment}/${movedSegment}`,
            to: `${bodySegment}/${regionSegment}/${movedSegment}`,
          });
        }
      }
    }
  }
  return pairs.length > 0 ? { originId: origin.id, pairs } : null;
}

function rewriteKey(
  key: string,
  pairs: DialogRegionPathRewrite["pairs"],
): string {
  for (const { from, to } of pairs) {
    if (key === from) return to;
    if (key.startsWith(`${from}/`)) return `${to}${key.slice(from.length)}`;
  }
  return key;
}

function rewriteOverride(
  override: DescendantOverride,
  rewrite: DialogRegionPathRewrite,
): DescendantOverride {
  if ("type" in override && override.type) {
    return rewriteDialogRegionPathsInNode(
      override as CanonicalNode,
      rewrite,
    ) as DescendantOverride;
  }
  if (Array.isArray((override as { children?: unknown }).children)) {
    const children = (override as { children: CanonicalNode[] }).children;
    const next = children.map((child) =>
      rewriteDialogRegionPathsInNode(child, rewrite),
    );
    return next.every((child, index) => child === children[index])
      ? override
      : ({ ...override, children: next } as DescendantOverride);
  }
  return override;
}

/**
 * 노드 subtree 안 Dialog instance (`ref` = origin) 의 descendants 키 전치 (멱등 — 새 경로는 옛 접두사와 안 맞는다).
 * 새 키가 이미 있으면 그 값이 이긴다 (이관 뒤 편집). 바뀐 것이 없으면 같은 노드.
 */
export function rewriteDialogRegionPathsInNode(
  node: CanonicalNode,
  rewrite: DialogRegionPathRewrite,
): CanonicalNode {
  let next = node;
  if (node.children) {
    const children = node.children.map((child) =>
      rewriteDialogRegionPathsInNode(child, rewrite),
    );
    if (children.some((child, index) => child !== node.children![index])) {
      next = { ...next, children };
    }
  }
  if (node.type !== "ref") return next;
  const ref = next as RefNode;
  const source = ref.descendants;
  if (!source) return next;
  const isTarget = ref.ref === rewrite.originId;
  let changed = false;
  const descendants: Record<string, DescendantOverride> = {};
  const moved: Array<[string, DescendantOverride]> = [];
  for (const [key, override] of Object.entries(source)) {
    const value = rewriteOverride(override, rewrite);
    if (value !== override) changed = true;
    const nextKey = isTarget ? rewriteKey(key, rewrite.pairs) : key;
    if (nextKey !== key) {
      changed = true;
      moved.push([nextKey, value]);
    } else {
      descendants[key] = value;
    }
  }
  for (const [key, value] of moved) {
    if (!Object.hasOwn(descendants, key)) descendants[key] = value;
  }
  return changed ? ({ ...ref, descendants } as CanonicalNode) : next;
}

/** 문서의 Dialog origin 전치 표 (history 복원 시점 — 이관을 지난 문서에서만 non-null). */
export function getDialogRegionPathRewrite(
  document: CompositionDocument | null | undefined,
): DialogRegionPathRewrite | null {
  if (!document) return null;
  const find = (nodes: readonly CanonicalNode[]): CanonicalNode | undefined => {
    for (const node of nodes) {
      if (node.id === DIALOG_ORIGIN_ID && node.reusable === true) return node;
      const hit = find(node.children ?? []);
      if (hit) return hit;
    }
    return undefined;
  };
  return buildDialogRegionPathRewrite(find(document.children));
}
