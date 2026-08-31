/**
 * ADR-198 Phase 4a — 의도적 변형 (test-only)
 *
 * negative probe 의 입력이다. 계측기를 **대조군으로 먼저 검증**하기 위한 것으로
 * (measurement-validity §1 Q3), 같은 leg 에 원본과 변형본을 각각 태워 비교한다.
 * 두 leg 사이의 실제 발산과 섞이지 않으므로, 여기서 나오는 판정은 오직 "계측기가
 * 이 변화를 잡는가" 만 말한다.
 *
 * 변형은 전부 **한 축만** 움직인다. 두 축을 같이 흔들면 어느 층이 잡았는지
 * 말할 수 없다.
 */

import type { CompositionDocument } from "@composition/shared";

interface MutableNode {
  id?: string;
  props?: { style?: Record<string, unknown>; [k: string]: unknown };
  children?: MutableNode[];
  [k: string]: unknown;
}

function clone(doc: CompositionDocument): CompositionDocument {
  return structuredClone(doc);
}

function findNode(doc: CompositionDocument, id: string): MutableNode | null {
  const walk = (nodes: MutableNode[] | undefined): MutableNode | null => {
    for (const n of nodes ?? []) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
    return null;
  };
  return walk((doc as unknown as { children?: MutableNode[] }).children);
}

function patchStyle(
  doc: CompositionDocument,
  id: string,
  patch: Record<string, unknown>,
): CompositionDocument {
  const next = clone(doc);
  const node = findNode(next, id);
  if (!node) throw new Error(`mutations: 노드 ${id} 를 찾지 못했다 — 케이스가 바뀌었다`);
  node.props = node.props ?? {};
  node.props.style = { ...(node.props.style ?? {}), ...patch };
  return next;
}

/** N px 기하 오프셋. §3.6 의 L1 허용치가 "각 delta ≤ 1px" 이라 1 은 통과한다. */
export function shiftBy(
  doc: CompositionDocument,
  id: string,
  px: number,
): CompositionDocument {
  return patchStyle(doc, id, {
    marginLeft: `${px}px`,
    marginTop: `${px}px`,
  });
}

/** props 변경 — style 이 아니라 catalog 의미 축(variant 등)을 움직인다. */
export function changeProps(
  doc: CompositionDocument,
  id: string,
  patch: Record<string, unknown>,
): CompositionDocument {
  const next = structuredClone(doc);
  const node = findNode(next, id);
  if (!node) throw new Error(`mutations: 노드 ${id} 를 찾지 못했다`);
  node.props = { ...(node.props ?? {}), ...patch };
  return next;
}

/** 색 토큰 1단계 변경 — 진폭으로 잡혀야 한다 (§3.6). */
export function changeFillColor(
  doc: CompositionDocument,
  id: string,
  color: string,
): CompositionDocument {
  return patchStyle(doc, id, { backgroundColor: color });
}

/** border 1px / radius 1px — 경계 밴드가 잡아야 한다. */
export function thickenBorder(
  doc: CompositionDocument,
  id: string,
): CompositionDocument {
  return patchStyle(doc, id, {
    borderTopWidth: "3px",
    borderRightWidth: "3px",
    borderBottomWidth: "3px",
    borderLeftWidth: "3px",
    borderRadius: "13px",
  });
}

/** 폰트 크기·행간 metric 변경 — L4 가 잡아야 한다. */
export function changeTextMetrics(
  doc: CompositionDocument,
  id: string,
): CompositionDocument {
  return patchStyle(doc, id, { fontSize: "15px", lineHeight: "21px" });
}

/**
 * 콘텐츠를 전부 걷어낸 문서. 두 leg 이 나란히 비어도 **일치로 통과하면 안 된다**
 * (R11). page/body 뼈대는 남겨 "문서가 없어서 못 그렸다" 와 "그릴 게 없다" 를
 * 구별한다.
 */
export function emptyBody(doc: CompositionDocument): CompositionDocument {
  const next = clone(doc);
  const root = (next as unknown as { children?: MutableNode[] }).children?.[0];
  const body = root?.children?.[0];
  if (!body) throw new Error("mutations: page > body 뼈대를 찾지 못했다");
  body.children = [];
  return next;
}
