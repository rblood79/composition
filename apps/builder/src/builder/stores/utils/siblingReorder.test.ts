import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import { moveCanonicalChild } from "@composition/shared";
import { describe, expect, it } from "vitest";
import { resolveSiblingReorderTarget } from "./siblingReorder";

function makeDoc(children: CanonicalNode[] = []): CompositionDocument {
  return { version: "composition-1.0", children };
}

function makeNode(id: string, children?: CanonicalNode[]): CanonicalNode {
  return { id, type: "frame", ...(children ? { children } : {}) };
}

/** 해석 결과를 실제 mutation 에 적용해 최종 순서를 확인 (post-removal 계약 확증) */
function applyReorder(
  document: CompositionDocument,
  elementId: string,
  direction: -1 | 1,
): string[] | null {
  const target = resolveSiblingReorderTarget(document, elementId, direction);
  if (!target) return null;
  const result = moveCanonicalChild(
    document,
    elementId,
    target.parentId,
    target.insertionIndex,
  );
  expect(result.changed).toBe(true);
  const siblings =
    target.parentId === null
      ? result.document.children
      : (findNode(result.document.children, target.parentId)?.children ?? []);
  return siblings.map((node) => node.id);
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

describe("resolveSiblingReorderTarget", () => {
  it("이전 형제 쪽 이동은 i-1 을 목표로 한다", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(resolveSiblingReorderTarget(doc, "b", -1)).toEqual({
      parentId: null,
      insertionIndex: 0,
    });
  });

  it("다음 형제 쪽 이동은 i+1 을 목표로 한다 (제거로 당겨진 형제 뒤)", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(resolveSiblingReorderTarget(doc, "b", 1)).toEqual({
      parentId: null,
      insertionIndex: 2,
    });
  });

  it("첫 형제의 이전 / 마지막 형제의 다음은 null (경계)", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(resolveSiblingReorderTarget(doc, "a", -1)).toBeNull();
    expect(resolveSiblingReorderTarget(doc, "c", 1)).toBeNull();
  });

  it("중첩 부모 안에서도 그 부모를 parentId 로 돌려준다", () => {
    const doc = makeDoc([
      makeNode("box-1", [makeNode("x"), makeNode("y"), makeNode("z")]),
    ]);
    expect(resolveSiblingReorderTarget(doc, "y", 1)).toEqual({
      parentId: "box-1",
      insertionIndex: 2,
    });
  });

  it("형제가 1개면 양방향 모두 null", () => {
    const doc = makeDoc([makeNode("only")]);
    expect(resolveSiblingReorderTarget(doc, "only", -1)).toBeNull();
    expect(resolveSiblingReorderTarget(doc, "only", 1)).toBeNull();
  });

  it("존재하지 않는 id 는 null", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b")]);
    expect(resolveSiblingReorderTarget(doc, "ghost", -1)).toBeNull();
  });

  it("ref override(descendants) 내부 노드는 대상에서 제외한다", () => {
    // buildCanonicalMoveEvents 가 ref override 내부 move 를 안전하게 재적용
    // 못하므로(undo 훼손) 일반 트리 밖은 no-op 이어야 한다.
    const refNode: RefNode = {
      id: "ref-1",
      type: "ref",
      ref: "master",
      descendants: {
        "0": { children: [makeNode("inner-a"), makeNode("inner-b")] },
      },
    };
    const doc = makeDoc([refNode]);
    expect(resolveSiblingReorderTarget(doc, "inner-a", 1)).toBeNull();
    expect(resolveSiblingReorderTarget(doc, "inner-b", -1)).toBeNull();
  });
});

describe("resolveSiblingReorderTarget → moveCanonicalChild 적용 결과", () => {
  it("한 칸씩 왕복하면 원래 순서로 돌아온다", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(applyReorder(doc, "b", 1)).toEqual(["a", "c", "b"]);

    const moved = moveCanonicalChild(doc, "b", null, 2).document;
    expect(applyReorder(moved, "b", -1)).toEqual(["a", "b", "c"]);
  });

  it("두 번째 → 첫 번째 이동", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(applyReorder(doc, "b", -1)).toEqual(["b", "a", "c"]);
  });

  it("마지막 직전 요소를 다음으로 보내면 마지막이 된다", () => {
    const doc = makeDoc([makeNode("a"), makeNode("b"), makeNode("c")]);
    expect(applyReorder(doc, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("중첩 컨테이너 자식도 같은 규칙으로 이동한다", () => {
    const doc = makeDoc([
      makeNode("box-1", [makeNode("x"), makeNode("y"), makeNode("z")]),
    ]);
    expect(applyReorder(doc, "z", -1)).toEqual(["x", "z", "y"]);
    expect(applyReorder(doc, "x", 1)).toEqual(["y", "x", "z"]);
  });
});
