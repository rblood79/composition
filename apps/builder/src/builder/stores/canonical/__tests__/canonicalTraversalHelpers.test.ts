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
  getCanonicalDocumentProjectableNodeIds,
  getCanonicalDocumentProjectableNodeCount,
  findByPath,
  getAncestors,
  getChildren,
  getChildrenByParent,
  getCanonicalNodeOccurrenceCount,
  getFirstProjectableNodeById,
  getFirstProjectableNodeLookupById,
  getFirstProjectableNodeLookupByReference,
  getLastProjectableNodeById,
  getNodeMap,
  getParent,
  getProjectableChildrenByParent,
  getProjectableNodeLookups,
  getProjectableNodes,
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

  it("first-match lookup은 legacy mutation의 Array.find 의미를 보존한다", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("duplicate", { props: { value: "first" } }),
          makeNode("duplicate", { props: { value: "last" } }),
        ],
      }),
    );

    expect(getFirstProjectableNodeById("duplicate")?.props?.value).toBe(
      "first",
    );
    expect(getFirstProjectableNodeLookupById("duplicate")).toMatchObject({
      node: { props: { value: "first" } },
      parentId: null,
      pageId: null,
      layoutId: null,
    });
    expect(getLastProjectableNodeById("duplicate")?.props?.value).toBe("last");
    expect(getNodeMap().get("duplicate")?.props?.value).toBe("last");
  });

  it("first projectable lookup은 structural duplicate를 건너뛴다", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("duplicate", { props: undefined }),
          makeNode("duplicate", { props: { value: "renderable" } }),
        ],
      }),
    );

    expect(getFirstProjectableNodeById("duplicate")?.props?.value).toBe(
      "renderable",
    );
    expect(getLastProjectableNodeById("duplicate")?.props?.value).toBe(
      "renderable",
    );
  });

  it("reference lookup은 뒤쪽 id보다 앞선 alias의 DFS 우선순위를 보존한다", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("alias-owner", {
            name: "collision",
            props: { value: "first-alias" },
          }),
          makeNode("collision", { props: { value: "later-id" } }),
        ],
      }),
    );

    expect(
      getFirstProjectableNodeLookupByReference("collision")?.node.props?.value,
    ).toBe("first-alias");
  });

  it("reference lookup은 quarantined customId와 metadata componentName을 인덱싱한다", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("custom-owner", {
            props: {},
            metadata: {
              type: "legacy-element-props",
              customId: "custom-alias",
            },
          }),
          makeNode("component-owner", {
            props: {},
            metadata: { componentName: "component-alias" },
          }),
        ],
      }),
    );

    expect(
      getFirstProjectableNodeLookupByReference("custom-alias")?.node.id,
    ).toBe("custom-owner");
    expect(
      getFirstProjectableNodeLookupByReference("component-alias")?.node.id,
    ).toBe("component-owner");
  });

  it("page ref descendants의 replacement subtree를 canonical hierarchy로 등록", () => {
    const pageRef = makeNode("page-ref", {
      type: "ref",
      metadata: { type: "legacy-page", pageId: "page-1" },
      ref: "layout-1",
      descendants: {
        slot: {
          children: [
            makeNode("body-1", {
              type: "body",
              props: {},
              children: [makeNode("section-1", { type: "Section", props: {} })],
            } as never),
          ],
        },
      },
    } as never);
    setActiveDocument("proj-a", makeDoc({ children: [pageRef] }));

    const map = getNodeMap();

    expect(map.has("page-ref")).toBe(true);
    expect(map.has("body-1")).toBe(true);
    expect(map.has("section-1")).toBe(true);
    expect(getParent("body-1")).toBeNull();
    expect(getParent("section-1")?.id).toBe("body-1");
    expect(getFirstProjectableNodeLookupById("body-1")).toMatchObject({
      node: { id: "body-1" },
      parentId: null,
      pageId: "page-1",
      layoutId: null,
    });
    expect(getFirstProjectableNodeLookupById("section-1")).toMatchObject({
      node: { id: "section-1" },
      parentId: "body-1",
      pageId: "page-1",
      layoutId: null,
    });
    expect(
      getChildrenByParent()
        .get("body-1")
        ?.map((node) => node.id),
    ).toEqual(["section-1"]);
  });

  it("reusable frame children의 normalized layout scope를 등록", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("layout-frame-1", {
            type: "frame",
            reusable: true,
            metadata: { type: "legacy-layout", layoutId: "layout-frame-1" },
            children: [
              makeNode("body-1", {
                type: "body" as CanonicalNode["type"],
                props: {},
              }),
            ],
          }),
        ],
      }),
    );

    expect(getFirstProjectableNodeLookupById("body-1")).toMatchObject({
      node: { id: "body-1" },
      parentId: null,
      pageId: null,
      layoutId: "frame-1",
    });
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

describe("projectable traversal views", () => {
  it("counts only projectable nodes across structural and page-ref boundaries", () => {
    const pageRef = makeNode("page-ref", {
      type: "ref",
      metadata: { type: "legacy-page", pageId: "page-1" },
      ref: "layout-1",
      descendants: {
        slot: {
          children: [
            makeNode("body-1", {
              type: "body",
              props: {},
              children: [makeNode("section-1", { props: {} })],
            } as never),
          ],
        },
      },
    } as never);
    const doc = makeDoc({
      children: [
        makeNode("structural", {
          children: [makeNode("leaf", { props: {} })],
        }),
        pageRef,
        makeNode("slot", {
          type: "frame",
          metadata: { type: "legacy-slot-hoisted", slotName: "content" },
        }),
      ],
    });

    expect(getCanonicalDocumentProjectableNodeCount(doc)).toBe(4);
    expect(getCanonicalDocumentProjectableNodeCount(doc)).toBe(4);
    expect(
      getCanonicalDocumentProjectableNodeCount(
        makeDoc({
          children: [...doc.children, makeNode("extra", { props: {} })],
        }),
      ),
    ).toBe(5);
  });

  it("collects reference-stable projectable IDs without structural wrappers", () => {
    const pageRef = makeNode("page-ref", {
      type: "ref",
      metadata: { type: "legacy-page", pageId: "page-1" },
      ref: "layout-1",
      descendants: {
        slot: {
          children: [makeNode("descendant", { props: {} })],
        },
      },
    } as never);
    const doc = makeDoc({
      children: [
        makeNode("structural", {
          children: [makeNode("leaf", { props: {} })],
        }),
        pageRef,
        makeNode("duplicate", { props: { order: 1 } }),
        makeNode("duplicate", { props: { order: 2 } }),
      ],
    });

    const ids = getCanonicalDocumentProjectableNodeIds(doc);

    expect([...ids]).toEqual(["leaf", "descendant", "duplicate"]);
    expect(ids.has("structural")).toBe(false);
    expect(ids.has("page-ref")).toBe(false);
    expect(getCanonicalDocumentProjectableNodeIds(doc)).toBe(ids);
    expect(
      getCanonicalDocumentProjectableNodeIds(
        makeDoc({
          children: [...doc.children, makeNode("extra", { props: {} })],
        }),
      ).has("extra"),
    ).toBe(true);
  });

  it("structural wrapper를 제외하고 legacy view 순서와 parent lifting을 보존", () => {
    const leaf = makeNode("leaf", { props: { label: "Leaf" } });
    const structuralWrapper = makeNode("structural-wrapper", {
      children: [leaf],
    });
    const root = makeNode("root", {
      props: {},
      children: [structuralWrapper],
    });
    setActiveDocument("proj-a", makeDoc({ children: [root] }));

    expect(getProjectableNodes().map((node) => node.id)).toEqual([
      "root",
      "leaf",
    ]);
    expect(
      getProjectableChildrenByParent()
        .get("root")
        ?.map((node) => node.id),
    ).toEqual(["leaf"]);
    expect(getProjectableChildrenByParent().has("structural-wrapper")).toBe(
      false,
    );
    expect(
      getProjectableNodeLookups().map(({ node, parentId }) => ({
        id: node.id,
        parentId,
      })),
    ).toEqual([
      { id: "root", parentId: null },
      { id: "leaf", parentId: "root" },
    ]);
  });

  it("aggregate lookup은 duplicate occurrence와 page ref scope를 모두 보존", () => {
    const pageRef = makeNode("page-ref", {
      type: "ref",
      metadata: { type: "legacy-page", pageId: "page-1" },
      ref: "layout-1",
      descendants: {
        slot: {
          children: [
            makeNode("duplicate", { props: { label: "First" } }),
            makeNode("duplicate", { props: { label: "Last" } }),
          ],
        },
      },
    } as never);
    setActiveDocument("proj-a", makeDoc({ children: [pageRef] }));

    expect(
      getProjectableNodeLookups().map(
        ({ node, parentId, pageId, layoutId }) => ({
          id: node.id,
          label: node.props?.label,
          parentId,
          pageId,
          layoutId,
        }),
      ),
    ).toEqual([
      {
        id: "duplicate",
        label: "First",
        parentId: null,
        pageId: "page-1",
        layoutId: null,
      },
      {
        id: "duplicate",
        label: "Last",
        parentId: null,
        pageId: "page-1",
        layoutId: null,
      },
    ]);
  });

  it("duplicate id occurrence를 projection 여부와 무관하게 집계", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({
        children: [
          makeNode("duplicate", { props: { label: "First" } }),
          makeNode("duplicate"),
        ],
      }),
    );

    expect(getCanonicalNodeOccurrenceCount("duplicate")).toBe(2);
    expect(getFirstProjectableNodeById("duplicate")?.props).toEqual({
      label: "First",
    });
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

  it("같은 project/version이어도 document reference가 바뀌면 cache flush", () => {
    setActiveDocument(
      "proj-a",
      makeDoc({ children: [makeNode("root-before")] }),
    );
    const map1 = getNodeMap();
    const version = useCanonicalDocumentStore.getState().documentVersion;

    useCanonicalDocumentStore.setState({
      documents: new Map([
        ["proj-a", makeDoc({ children: [makeNode("root-after")] })],
      ]),
      currentProjectId: "proj-a",
      documentVersion: version,
    });

    const map2 = getNodeMap();
    expect(map2.has("root-after")).toBe(true);
    expect(map2.has("root-before")).toBe(false);
    expect(map1).not.toBe(map2);
  });
});
