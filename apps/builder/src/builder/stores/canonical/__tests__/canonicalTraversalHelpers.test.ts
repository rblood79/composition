/**
 * @fileoverview canonicalTraversalHelpers unit tests — ADR-127 Phase 1 Gate G1
 *
 * 검증 영역:
 * 1. getChildren — direct property access
 * 2. getParent — cache 기반 O(1) lookup
 * 3. getAncestors — chain 반복
 * 4. findByPath — pencil path syntax
 * 5. getNodeMap — full traversal + cache
 * 6. getChildrenByParent — full traversal + cache
 * 7. Cache invalidation — documentVersion + projectId 변경
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  __resetTraversalCache_TEST_ONLY__,
  findByPath,
  getAncestors,
  getChildren,
  getChildrenByParent,
  getNodeMap,
  getParent,
} from "../canonicalTraversalHelpers";

// ─────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────

function makeNode(
  id: string,
  overrides?: Partial<CanonicalNode>,
): CanonicalNode {
  return {
    id,
    type: "element",
    componentRef: "Box",
    ...overrides,
  } as CanonicalNode;
}

function makeDoc(
  overrides?: Partial<CompositionDocument>,
): CompositionDocument {
  return {
    schemaVersion: "1.0",
    children: [],
    ...overrides,
  } as CompositionDocument;
}

function resetStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

function setActiveDocument(projectId: string, doc: CompositionDocument): void {
  const store = useCanonicalDocumentStore.getState();
  store.setDocument(projectId, doc);
  store.setCurrentProject(projectId);
}

beforeEach(() => {
  resetStore();
  __resetTraversalCache_TEST_ONLY__();
});

afterEach(() => {
  resetStore();
  __resetTraversalCache_TEST_ONLY__();
});

// ─────────────────────────────────────────────
// 1. getChildren
// ─────────────────────────────────────────────

describe("getChildren", () => {
  it("children 미정의 시 빈 배열 반환", () => {
    const node = makeNode("leaf");
    expect(getChildren(node)).toEqual([]);
  });

  it("children 정의 시 배열 그대로 반환 (배열 순서 보존)", () => {
    const c1 = makeNode("c1");
    const c2 = makeNode("c2");
    const c3 = makeNode("c3");
    const parent = makeNode("p", { children: [c1, c2, c3] });

    const result = getChildren(parent);
    expect(result).toHaveLength(3);
    expect(result.map((n) => n.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("active document 무관 — direct property access", () => {
    // store 비활성 상태에서도 getChildren 은 작동 (cache 미사용)
    const node = makeNode("standalone", { children: [makeNode("inner")] });
    expect(getChildren(node)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// 2. getParent
// ─────────────────────────────────────────────

describe("getParent", () => {
  it("active document 없으면 null", () => {
    expect(getParent("any-id")).toBeNull();
  });

  it("root 직계 노드의 parent 는 null", () => {
    const root = makeNode("root-1");
    setActiveDocument("proj-a", makeDoc({ children: [root] }));
    expect(getParent("root-1")).toBeNull();
  });

  it("nested 노드의 parent 반환", () => {
    const leaf = makeNode("leaf");
    const mid = makeNode("mid", { children: [leaf] });
    const root = makeNode("root", { children: [mid] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const result = getParent("leaf");
    expect(result?.id).toBe("mid");

    const midParent = getParent("mid");
    expect(midParent?.id).toBe("root");
  });

  it("미존재 nodeId → null", () => {
    setActiveDocument("proj-a", makeDoc({ children: [makeNode("root")] }));
    expect(getParent("missing")).toBeNull();
  });
});

// ─────────────────────────────────────────────
// 3. getAncestors
// ─────────────────────────────────────────────

describe("getAncestors", () => {
  it("active document 없으면 빈 배열", () => {
    expect(getAncestors("any-id")).toEqual([]);
  });

  it("root 직계는 빈 배열", () => {
    const root = makeNode("root");
    setActiveDocument("proj-a", makeDoc({ children: [root] }));
    expect(getAncestors("root")).toEqual([]);
  });

  it("3 depth nested 의 ancestor chain (mid → root 순서)", () => {
    const leaf = makeNode("leaf");
    const mid = makeNode("mid", { children: [leaf] });
    const root = makeNode("root", { children: [mid] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const ancestors = getAncestors("leaf");
    expect(ancestors.map((n) => n.id)).toEqual(["mid", "root"]);
  });

  it("미존재 nodeId → 빈 배열", () => {
    setActiveDocument("proj-a", makeDoc({ children: [makeNode("root")] }));
    expect(getAncestors("missing")).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// 4. findByPath
// ─────────────────────────────────────────────

describe("findByPath", () => {
  it("active document 없으면 null", () => {
    expect(findByPath("any/path")).toBeNull();
  });

  it("single segment — root 직계 노드 반환", () => {
    const root = makeNode("ok-button");
    setActiveDocument("proj-a", makeDoc({ children: [root] }));
    const result = findByPath("ok-button");
    expect(result?.id).toBe("ok-button");
  });

  it("multi segment — 중첩 children 까지 lookup", () => {
    const label = makeNode("label");
    const button = makeNode("ok-button", { children: [label] });
    setActiveDocument("proj-a", makeDoc({ children: [button] }));

    const result = findByPath("ok-button/label");
    expect(result?.id).toBe("label");
  });

  it("3 depth path — 깊이 nested lookup", () => {
    const grandchild = makeNode("text");
    const child = makeNode("label", { children: [grandchild] });
    const root = makeNode("button", { children: [child] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const result = findByPath("button/label/text");
    expect(result?.id).toBe("text");
  });

  it("missing intermediate segment → null", () => {
    const button = makeNode("ok-button");
    setActiveDocument("proj-a", makeDoc({ children: [button] }));
    expect(findByPath("ok-button/missing")).toBeNull();
  });

  it("empty path → null", () => {
    setActiveDocument("proj-a", makeDoc({ children: [makeNode("root")] }));
    expect(findByPath("")).toBeNull();
  });

  it("leading slash 무시 (filter Boolean)", () => {
    const root = makeNode("root");
    setActiveDocument("proj-a", makeDoc({ children: [root] }));
    expect(findByPath("/root")?.id).toBe("root");
  });
});

// ─────────────────────────────────────────────
// 5. getNodeMap
// ─────────────────────────────────────────────

describe("getNodeMap", () => {
  it("active document 없으면 빈 Map", () => {
    expect(getNodeMap().size).toBe(0);
  });

  it("flat traversal — 모든 노드 등록", () => {
    const leaf = makeNode("leaf");
    const mid = makeNode("mid", { children: [leaf] });
    const root = makeNode("root", { children: [mid] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const map = getNodeMap();
    expect(map.size).toBe(3);
    expect(map.get("root")?.id).toBe("root");
    expect(map.get("mid")?.id).toBe("mid");
    expect(map.get("leaf")?.id).toBe("leaf");
  });

  it("multi-root document 도 모두 등록", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [makeNode("r1"), makeNode("r2"), makeNode("r3")],
      }),
    );

    const map = getNodeMap();
    expect(map.size).toBe(3);
    expect([...map.keys()].sort()).toEqual(["r1", "r2", "r3"]);
  });
});

// ─────────────────────────────────────────────
// 6. getChildrenByParent
// ─────────────────────────────────────────────

describe("getChildrenByParent", () => {
  it("active document 없으면 빈 Map", () => {
    expect(getChildrenByParent().size).toBe(0);
  });

  it("nested children — parent → children list 매핑", () => {
    const c1 = makeNode("c1");
    const c2 = makeNode("c2");
    const root = makeNode("root", { children: [c1, c2] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const map = getChildrenByParent();
    expect(map.get("root")?.map((n) => n.id)).toEqual(["c1", "c2"]);
  });

  it("root level 노드는 entry 없음 (parent 없음)", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({ children: [makeNode("r1"), makeNode("r2")] }),
    );

    const map = getChildrenByParent();
    expect(map.has("r1")).toBe(false); // r1 자체는 leaf 라 entry 없음
    expect(map.has("r2")).toBe(false);
  });

  it("3 depth 모두 — root → mid + mid → leaf", () => {
    const leaf = makeNode("leaf");
    const mid = makeNode("mid", { children: [leaf] });
    const root = makeNode("root", { children: [mid] });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    const map = getChildrenByParent();
    expect(map.get("root")?.map((n) => n.id)).toEqual(["mid"]);
    expect(map.get("mid")?.map((n) => n.id)).toEqual(["leaf"]);
  });
});

// ─────────────────────────────────────────────
// 7. Cache invalidation
// ─────────────────────────────────────────────

describe("Cache invalidation", () => {
  it("documentVersion 변경 시 fresh map 재계산", () => {
    const root = makeNode("root-v1");
    setActiveDocument("proj-a", makeDoc({ children: [root] }));
    const map1 = getNodeMap();
    expect(map1.has("root-v1")).toBe(true);

    // mutation: 새 노드 추가 (setDocument 가 documentVersion 증가)
    const updatedDoc = makeDoc({
      children: [root, makeNode("root-v2")],
    });
    useCanonicalDocumentStore.getState().setDocument("proj-a", updatedDoc);

    const map2 = getNodeMap();
    expect(map2.has("root-v1")).toBe(true);
    expect(map2.has("root-v2")).toBe(true);
    expect(map1).not.toBe(map2); // reference 변경 (cache flush)
  });

  it("projectId 변경 시 cache flush", () => {
    setActiveDocument("proj-a", makeDoc({ children: [makeNode("a-root")] }));
    expect(getNodeMap().has("a-root")).toBe(true);

    setActiveDocument("proj-b", makeDoc({ children: [makeNode("b-root")] }));
    const mapB = getNodeMap();
    expect(mapB.has("b-root")).toBe(true);
    expect(mapB.has("a-root")).toBe(false);
  });

  it("같은 documentVersion 재요청 시 cached map 반환 (reference 동일)", () => {
    setActiveDocument("proj-a", makeDoc({ children: [makeNode("root")] }));
    const map1 = getNodeMap();
    const map2 = getNodeMap();
    expect(map1).toBe(map2); // same reference
  });
});
