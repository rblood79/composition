/**
 * ADR-240 Phase 2 — mode C 로 채운 노드의 편집 쓰기 (리뷰 r1 h3 · 진단 (e) (e2)).
 *
 * 채운 노드 (`descendants[영역].children` 배열 안) 는 instance 소유다. 두 해석기는 그 배열 노드를 읽는다
 * (Canvas `materializeOverrideChildren` · Preview `applyOverrideToNode` mode C → `resolveNode`) — 바깥
 * `descendants["영역/노드"]` mode A patch 는 어느 쪽도 읽지 않는다. 그래서 synthetic id 의 경로에 mode C
 * 조상이 있으면 **배열 안 그 노드** 를 고친다. 234 Slot "+" 항목 (같은 mode C) 도 같은 경로.
 *
 * 경로 segment = Canvas 가 mode C 노드 synthetic id 를 만드는 규칙 (`getOverrideNodeSegment` — customId →
 * id → name → `child-<index>`). ref 노드 아래로 더 내려가면 그 ref 의 자기 `descendants` 로 (같은 규칙 재귀).
 */
import {
  mergePropsWithStyleDeep,
  stripDeletedPatchValues,
} from "../../adapters/canonical/instanceResolver";

type Descendants = Record<string, unknown>;
type FillNode = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modeCChildren(value: unknown): unknown[] | null {
  if (!isRecord(value) || "type" in value) return null;
  return Array.isArray(value.children) ? value.children : null;
}

/** Canvas `getOverrideNodeSegment` 와 같은 규칙. */
export function fillNodeSegment(node: FillNode, index: number): string {
  for (const key of ["customId", "id", "name"] as const) {
    const value = node[key];
    if (typeof value === "string" && value) return value;
  }
  return `child-${index}`;
}

/** 배열 노드에 편집 patch — `fills` 는 1차 필드, 나머지는 props (style 심층 · `null` = 지움). */
function patchFillNode(
  node: FillNode,
  patch: Record<string, unknown>,
): FillNode {
  const { fills, ...propsPatch } = patch;
  const next: FillNode = { ...node };
  if (Object.keys(propsPatch).length > 0) {
    const merged = mergePropsWithStyleDeep(
      isRecord(node.props) ? node.props : {},
      propsPatch,
    );
    // style 의 `undefined` (synthetic 쓰기의 "patch 에서 지움") — 채운 노드는 instance 소유라 지움 = 삭제.
    const stripped = stripDeletedPatchValues(
      isRecord(merged.style)
        ? {
            ...merged,
            style: Object.fromEntries(
              Object.entries(merged.style).filter(([, v]) => v !== undefined),
            ),
          }
        : merged,
    );
    const style = stripped.style;
    next.props =
      isRecord(style) && Object.values(style).includes(null)
        ? { ...stripped, style: stripDeletedPatchValues(style) }
        : stripped;
  }
  if (Array.isArray(fills)) next.fills = fills;
  else if (fills === null) delete next.fills;
  return next;
}

/** 배열 안 `segments` 경로의 노드를 고친 새 배열 (못 찾으면 null). */
function editInFillChildren(
  children: readonly unknown[],
  segments: readonly string[],
  patch: Record<string, unknown>,
): unknown[] | null {
  const [head, ...rest] = segments;
  const index = children.findIndex(
    (child, i) => isRecord(child) && fillNodeSegment(child, i) === head,
  );
  if (index < 0) return null;
  const node = children[index] as FillNode;
  let nextNode: FillNode | null;
  if (rest.length === 0) {
    nextNode = patchFillNode(node, patch);
  } else if (typeof node.ref === "string") {
    // 채운 ref (origin instance) 의 안쪽 — 그 ref 의 자기 descendants (mode C 가 있으면 다시 배열로).
    const own = isRecord(node.descendants) ? node.descendants : {};
    const descendants =
      applyEditToSlotFill(own, rest.join("/"), patch) ??
      appendModeAPatch(own, rest.join("/"), patch);
    nextNode = { ...node, descendants };
  } else if (Array.isArray(node.children)) {
    const nested = editInFillChildren(node.children, rest, patch);
    nextNode = nested ? { ...node, children: nested } : null;
  } else {
    nextNode = null;
  }
  if (!nextNode) return null;
  const next = [...children];
  next[index] = nextNode;
  return next;
}

function appendModeAPatch(
  descendants: Descendants,
  path: string,
  patch: Record<string, unknown>,
): Descendants {
  const previous = isRecord(descendants[path]) ? descendants[path] : {};
  return {
    ...descendants,
    [path]: mergePropsWithStyleDeep(previous, patch),
  };
}

/**
 * `path` (instance 기준 descendants 경로) 에 mode C 조상 (가장 바깥) 이 있으면 그 배열 노드를 고친 새
 * descendants. mode C 조상이 없거나 배열 안에서 노드를 못 찾으면 null (호출자는 종전 mode A patch).
 */
export function applyEditToSlotFill(
  descendants: Descendants,
  path: string,
  patch: Record<string, unknown>,
): Descendants | null {
  const segments = path.split("/");
  for (let cut = 1; cut < segments.length; cut += 1) {
    const hostPath = segments.slice(0, cut).join("/");
    const entry = descendants[hostPath];
    const children = modeCChildren(entry);
    if (!children) continue;
    const next = editInFillChildren(children, segments.slice(cut), patch);
    if (!next) return null;
    return {
      ...descendants,
      [hostPath]: { ...(entry as Record<string, unknown>), children: next },
    };
  }
  return null;
}
