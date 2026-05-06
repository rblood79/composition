/**
 * @fileoverview canonicalElementsBridge unit tests — ADR-116 Phase 2 G3 Sub-Phase A
 *
 * 검증 영역:
 * 1. Read API — getCanonicalNode / getActiveCanonicalDocument
 * 2. Subscribe API — subscribeCanonicalStore lifecycle
 * 3. React hooks — useCanonicalNode / useActiveCanonicalDocument
 *    (useSyncExternalStore D6=i 채택 검증)
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  getActiveCanonicalDocument,
  getCanonicalNode,
  subscribeCanonicalStore,
  useActiveCanonicalDocument,
  useCanonicalNode,
} from "../canonicalElementsBridge";

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
  };
}

function makeDoc(
  overrides?: Partial<CompositionDocument>,
): CompositionDocument {
  return {
    schemaVersion: "1.0",
    children: [],
    ...overrides,
  };
}

function resetStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ─────────────────────────────────────────────
// A. Read API — getCanonicalNode
// ─────────────────────────────────────────────

describe("getCanonicalNode", () => {
  it("currentProjectId 가 null 일 때 null 반환", () => {
    expect(getCanonicalNode("any-id")).toBeNull();
  });

  it("document 미등록 projectId 활성 시 null 반환", () => {
    const store = useCanonicalDocumentStore.getState();
    store.setCurrentProject("missing-proj");
    expect(getCanonicalNode("any-id")).toBeNull();
  });

  it("root 직계 노드 반환", () => {
    const node = makeNode("root-1");
    const doc = makeDoc({ children: [node] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", doc);
    store.setCurrentProject("proj-a");

    const result = getCanonicalNode("root-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("root-1");
  });

  it("깊이 nested 노드도 DFS 로 발견", () => {
    const leaf = makeNode("leaf-deep");
    const mid = makeNode("mid", { children: [leaf] });
    const root = makeNode("root", { children: [mid] });
    const doc = makeDoc({ children: [root] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", doc);
    store.setCurrentProject("proj-a");

    const result = getCanonicalNode("leaf-deep");
    expect(result?.id).toBe("leaf-deep");
  });
});

// ─────────────────────────────────────────────
// B. Read API — getActiveCanonicalDocument
// ─────────────────────────────────────────────

describe("getActiveCanonicalDocument", () => {
  it("currentProjectId 가 null 이면 null 반환", () => {
    expect(getActiveCanonicalDocument()).toBeNull();
  });

  it("setCurrentProject 후 document 반환", () => {
    const doc = makeDoc({ children: [makeNode("n1")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", doc);
    store.setCurrentProject("proj-a");

    const result = getActiveCanonicalDocument();
    expect(result).not.toBeNull();
    expect(result?.children).toHaveLength(1);
  });

  it("setCurrentProject(null) 후 다시 null", () => {
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", makeDoc());
    store.setCurrentProject("proj-a");
    expect(getActiveCanonicalDocument()).not.toBeNull();

    store.setCurrentProject(null);
    expect(getActiveCanonicalDocument()).toBeNull();
  });
});

// ─────────────────────────────────────────────
// C. Subscribe API
// ─────────────────────────────────────────────

describe("subscribeCanonicalStore", () => {
  it("mutation 발생 시 listener 호출", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCanonicalStore(listener);

    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", makeDoc());

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("unsubscribe 후 listener 호출 안 됨", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCanonicalStore(listener);
    unsubscribe();

    const store = useCanonicalDocumentStore.getState();
    store.setDocument("proj-a", makeDoc());

    expect(listener).not.toHaveBeenCalled();
  });

  it("여러 listener 모두 호출", () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const u1 = subscribeCanonicalStore(l1);
    const u2 = subscribeCanonicalStore(l2);

    useCanonicalDocumentStore.getState().setDocument("proj-a", makeDoc());

    expect(l1).toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
    u1();
    u2();
  });

  it("setCurrentProject 도 listener trigger", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCanonicalStore(listener);

    useCanonicalDocumentStore.getState().setCurrentProject("proj-a");

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

// ─────────────────────────────────────────────
// D. useCanonicalNode hook
// ─────────────────────────────────────────────

describe("useCanonicalNode hook", () => {
  it("nodeId 미등록 시 null 반환", () => {
    const { result } = renderHook(() => useCanonicalNode("missing"));
    expect(result.current).toBeNull();
  });

  it("등록된 노드 반환", () => {
    const node = makeNode("hook-target");
    const doc = makeDoc({ children: [node] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result } = renderHook(() => useCanonicalNode("hook-target"));
    expect(result.current?.id).toBe("hook-target");
  });

  it("mutation 발생 시 re-render + 새 노드 반환", () => {
    const node = makeNode("mutating", { props: { color: "red" } });
    const doc = makeDoc({ children: [node] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result } = renderHook(() => useCanonicalNode("mutating"));
    expect(result.current?.props?.color).toBe("red");

    act(() => {
      useCanonicalDocumentStore
        .getState()
        .updateNodeProps("mutating", { color: "blue" });
    });

    expect(result.current?.props?.color).toBe("blue");
  });

  it("snapshot stability — mutation 없으면 동일 reference", () => {
    const node = makeNode("stable");
    const doc = makeDoc({ children: [node] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result, rerender } = renderHook(() => useCanonicalNode("stable"));
    const first = result.current;
    rerender();
    const second = result.current;
    expect(second).toBe(first); // reference equal
  });

  it("nodeId === null 시 null 반환 (Step 2 시그니처 확장)", () => {
    const node = makeNode("any");
    const doc = makeDoc({ children: [node] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result } = renderHook(() => useCanonicalNode(null));
    expect(result.current).toBeNull();
  });

  it("nodeId 변경 시 새 노드 반환", () => {
    const a = makeNode("node-a");
    const b = makeNode("node-b");
    const doc = makeDoc({ children: [a, b] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useCanonicalNode(id),
      { initialProps: { id: "node-a" } },
    );
    expect(result.current?.id).toBe("node-a");

    rerender({ id: "node-b" });
    expect(result.current?.id).toBe("node-b");
  });
});

// ─────────────────────────────────────────────
// F. useActiveCanonicalDocument hook
// ─────────────────────────────────────────────

describe("useActiveCanonicalDocument hook", () => {
  it("currentProjectId null → null", () => {
    const { result } = renderHook(() => useActiveCanonicalDocument());
    expect(result.current).toBeNull();
  });

  it("setCurrentProject 후 document 반환", () => {
    const doc = makeDoc({ children: [makeNode("n1")] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result } = renderHook(() => useActiveCanonicalDocument());
    expect(result.current).not.toBeNull();
    expect(result.current?.children).toHaveLength(1);
  });

  it("mutation 시 새 document reference 반환 (clone-on-write)", () => {
    const doc = makeDoc({ children: [makeNode("n1")] });
    act(() => {
      const s = useCanonicalDocumentStore.getState();
      s.setDocument("proj-a", doc);
      s.setCurrentProject("proj-a");
    });

    const { result } = renderHook(() => useActiveCanonicalDocument());
    const first = result.current;

    act(() => {
      useCanonicalDocumentStore
        .getState()
        .updateNodeProps("n1", { foo: "bar" });
    });

    const second = result.current;
    expect(second).not.toBe(first); // mutation 후 reference 변경
    expect(second?.children[0].props?.foo).toBe("bar");
  });
});
