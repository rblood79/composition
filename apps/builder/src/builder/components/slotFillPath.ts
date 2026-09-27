/**
 * ADR-240 Phase 1 — instance slot 채우기 (mode C `descendants[path].children`) 의 경로 키.
 *
 * 키 = **경로 segment** (`getCanonicalRefChildSegments` — 형제 목록 기준, customId 우선). Canvas scene 해석 (`materializeSyntheticDescendants`)
 * 과 Properties/Styles 쓰기 (synthetic id) 가 segment 만 쓰고, Preview 해석기는 id · segment 둘 다 받는다. 종전 UI
 * (`customId ?? id`) 는 name 을 가진 host (Card 영역 `Content` …) 에서 id 키를 써 Canvas 만 상속 자식을 그렸다 (G0 F14 ·
 * 진단 (g)). 옛 id 키 채움은 읽을 때 폴백하고, 다음 채우기 · 비우기에서 segment 키로 옮긴다.
 */
import { getCanonicalRefChildSegments } from "../../adapters/canonical/canonicalRefResolution";

export type SlotFillPathNode = {
  id: string;
  customId?: string | null;
  componentName?: string | null;
  name?: string | null;
  slot?: unknown;
  metadata?: unknown;
};

export interface SlotFillHost<T extends SlotFillPathNode> {
  host: T;
  /** 쓰기 키 (segment path) */
  path: string;
  /** 종전 UI 키 (`customId ?? id` path) — segment 와 같으면 null */
  legacyPath: string | null;
  recommendedIds: string[];
}

function legacySegment(node: SlotFillPathNode): string {
  return node.customId ?? node.id;
}

function slotValue(node: SlotFillPathNode): string[] | null {
  if (Array.isArray(node.slot)) return node.slot as string[];
  const metadataSlot = (node.metadata as { slot?: unknown } | undefined)?.slot;
  return Array.isArray(metadataSlot) ? (metadataSlot as string[]) : null;
}

/** master 자식 (root 제외 — root 영역은 instance 자기 자식, `FrameSlotSection`) 중 `slot` 배열을 가진 host. */
export function collectSlotFillHosts<T extends SlotFillPathNode>(
  parentId: string,
  childrenByParent: ReadonlyMap<string, readonly T[]>,
  prefix: { path: string; legacyPath: string } = { path: "", legacyPath: "" },
): SlotFillHost<T>[] {
  const hosts: SlotFillHost<T>[] = [];
  const children = childrenByParent.get(parentId) ?? [];
  // 노드를 그대로 넘긴다 — 필드를 골라 새 객체를 만들면 metadata customId (문서 노드) 가 빠진다.
  const segments = getCanonicalRefChildSegments(
    children.map((child) => ({ ...child, name: child.name ?? undefined })),
  );
  for (const [index, child] of children.entries()) {
    const segment = segments[index]!;
    const path = prefix.path ? `${prefix.path}/${segment}` : segment;
    const legacy = prefix.legacyPath
      ? `${prefix.legacyPath}/${legacySegment(child)}`
      : legacySegment(child);
    const slot = slotValue(child);
    if (slot) {
      hosts.push({
        host: child,
        path,
        legacyPath: legacy === path ? null : legacy,
        recommendedIds: slot,
      });
    }
    hosts.push(
      ...collectSlotFillHosts(child.id, childrenByParent, {
        path,
        legacyPath: legacy,
      }),
    );
  }
  return hosts;
}

type Descendants = Record<string, unknown>;

function childrenOf(value: unknown): unknown[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const children = (value as { children?: unknown }).children;
  return Array.isArray(children) ? children : null;
}

/** host 의 현재 채움 (segment 키 우선 · 옛 id 키 폴백). */
export function readSlotFill(
  descendants: Descendants | undefined,
  host: Pick<SlotFillHost<SlotFillPathNode>, "path" | "legacyPath">,
): unknown[] {
  if (!descendants) return [];
  return (
    childrenOf(descendants[host.path]) ??
    (host.legacyPath ? childrenOf(descendants[host.legacyPath]) : null) ??
    []
  );
}

function entryRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 채움 목록을 segment 키로 쓴 다음 descendants (옛 id 키는 지운다). `children` 이 null 이면 비우기.
 * ADR-240 Phase 2 — 같은 항목의 영역 host 편집 (style · fills 등 mode A 필드) 은 채우기 · 비우기에서 보존한다.
 */
export function writeSlotFill(
  descendants: Descendants | undefined,
  host: Pick<SlotFillHost<SlotFillPathNode>, "path" | "legacyPath">,
  children: unknown[] | null,
): Descendants {
  const next: Descendants = { ...(descendants ?? {}) };
  const { children: _legacyChildren, ...legacyRest } = host.legacyPath
    ? entryRecord(next[host.legacyPath])
    : {};
  const { children: _currentChildren, ...currentRest } = entryRecord(
    next[host.path],
  );
  if (host.legacyPath) delete next[host.legacyPath];
  const kept = { ...legacyRest, ...currentRest };
  if (children !== null) next[host.path] = { ...kept, children };
  else if (Object.keys(kept).length > 0) next[host.path] = kept;
  else delete next[host.path];
  return next;
}
