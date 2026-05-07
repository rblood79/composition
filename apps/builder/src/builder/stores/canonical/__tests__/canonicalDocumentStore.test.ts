/**
 * @fileoverview canonicalDocumentStore unit tests — ADR-116 Phase 1 (G2)
 *
 * R1 대응 evidence: Phase 1 = "API + unit test" scope 충족.
 * 본 파일은 7 action × 핵심 happy path + edge case 를 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionExtension,
  CompositionExtendedNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

import {
  selectActiveCanonicalDocument,
  selectCanonicalNode,
  useCanonicalDocumentStore,
} from "../canonicalDocumentStore";

// ─────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────

function makeDoc(
  overrides?: Partial<CompositionDocument>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [],
    ...overrides,
  };
}

function makeNode(
  id: string,
  type: CanonicalNode["type"] = "Frame",
  overrides?: Partial<CanonicalNode>,
): CanonicalNode {
  return {
    id,
    type,
    ...overrides,
  };
}

function makeRefNode(
  id: string,
  ref: string,
  overrides?: Partial<RefNode>,
): RefNode {
  return {
    id,
    type: "ref",
    ref,
    ...overrides,
  };
}

function getExtension(nodeId: string): CompositionExtension | undefined {
  return (selectCanonicalNode(nodeId) as CompositionExtendedNode | null)?.[
    "x-composition"
  ];
}

/** store 를 매 테스트 시작 시 깨끗한 상태로 리셋 */
function resetStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

// ─────────────────────────────────────────────
// getDocument / setDocument / setCurrentProject
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — basic document lifecycle", () => {
  beforeEach(resetStore);

  it("getDocument returns undefined for unknown projectId", () => {
    expect(
      useCanonicalDocumentStore.getState().getDocument("nope"),
    ).toBeUndefined();
  });

  it("setDocument stores document and getDocument retrieves it", () => {
    const doc = makeDoc({ children: [makeNode("root-1")] });
    useCanonicalDocumentStore.getState().setDocument("project-A", doc);

    const retrieved = useCanonicalDocumentStore
      .getState()
      .getDocument("project-A");
    expect(retrieved).toBeDefined();
    expect(retrieved?.children).toHaveLength(1);
    expect(retrieved?.children[0].id).toBe("root-1");
  });

  it("setDocument increments documentVersion", () => {
    const before = useCanonicalDocumentStore.getState().documentVersion;
    useCanonicalDocumentStore.getState().setDocument("project-A", makeDoc());
    const after = useCanonicalDocumentStore.getState().documentVersion;
    expect(after).toBe(before + 1);
  });

  it("setDocument does not auto-activate project", () => {
    useCanonicalDocumentStore.getState().setDocument("project-A", makeDoc());
    expect(useCanonicalDocumentStore.getState().currentProjectId).toBeNull();
  });

  it("setCurrentProject updates currentProjectId", () => {
    useCanonicalDocumentStore.getState().setCurrentProject("project-A");
    expect(useCanonicalDocumentStore.getState().currentProjectId).toBe(
      "project-A",
    );

    useCanonicalDocumentStore.getState().setCurrentProject(null);
    expect(useCanonicalDocumentStore.getState().currentProjectId).toBeNull();
  });

  it("multiple projects co-exist in documents map", () => {
    const docA = makeDoc({ children: [makeNode("a-root")] });
    const docB = makeDoc({ children: [makeNode("b-root")] });

    useCanonicalDocumentStore.getState().setDocument("project-A", docA);
    useCanonicalDocumentStore.getState().setDocument("project-B", docB);

    expect(
      useCanonicalDocumentStore.getState().getDocument("project-A")?.children[0]
        .id,
    ).toBe("a-root");
    expect(
      useCanonicalDocumentStore.getState().getDocument("project-B")?.children[0]
        .id,
    ).toBe("b-root");
  });
});

// ─────────────────────────────────────────────
// updateNode
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — updateNode", () => {
  beforeEach(resetStore);

  function setupActiveDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("root", "Frame", { name: "Original" }),
        makeNode("sibling", "Section"),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("project-A", doc);
    store.setCurrentProject("project-A");
  }

  it("updates node with partial patch (name)", () => {
    setupActiveDoc();
    useCanonicalDocumentStore
      .getState()
      .updateNode("root", { name: "Renamed" });

    const node = selectCanonicalNode("root");
    expect(node?.name).toBe("Renamed");
  });

  it("silently ignores id and type changes (structural invariant)", () => {
    setupActiveDoc();
    useCanonicalDocumentStore.getState().updateNode("root", {
      id: "new-id",
      type: "Section",
      name: "Updated",
    } as Partial<CanonicalNode>);

    const node = selectCanonicalNode("root");
    expect(node?.id).toBe("root");
    expect(node?.type).toBe("Frame");
    expect(node?.name).toBe("Updated");

    // new-id 는 등록되지 않음
    expect(selectCanonicalNode("new-id")).toBeNull();
  });

  it("ignores props in updateNode (must use updateNodeProps)", () => {
    setupActiveDoc();
    useCanonicalDocumentStore.getState().updateNode("root", {
      props: { foo: "bar" },
      name: "Updated",
    });

    const node = selectCanonicalNode("root");
    expect(node?.props).toBeUndefined();
    expect(node?.name).toBe("Updated");
  });

  it("nested node update finds via DFS", () => {
    resetStore();
    const doc = makeDoc({
      children: [
        makeNode("root", "Frame", {
          children: [
            makeNode("child-1", "Section"),
            makeNode("child-2", "Section", {
              children: [makeNode("grandchild", "Button")],
            }),
          ],
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.updateNode("grandchild", { name: "Deep" });
    expect(selectCanonicalNode("grandchild")?.name).toBe("Deep");
  });

  it("no-op + warn if no active project", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore.getState().updateNode("root", { name: "x" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no-op + warn if node not found", () => {
    setupActiveDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore.getState().updateNode("ghost", { name: "x" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// updateNodeProps
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — updateNodeProps", () => {
  beforeEach(resetStore);

  function setupActiveDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("button-1", "Button", {
          props: { label: "Click", disabled: false },
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("merges patch into existing props", () => {
    setupActiveDoc();
    useCanonicalDocumentStore
      .getState()
      .updateNodeProps("button-1", { disabled: true });

    const node = selectCanonicalNode("button-1");
    expect(node?.props).toEqual({ label: "Click", disabled: true });
  });

  it("creates props if previously undefined", () => {
    resetStore();
    const doc = makeDoc({ children: [makeNode("plain", "Section")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.updateNodeProps("plain", { foo: "bar" });
    expect(selectCanonicalNode("plain")?.props).toEqual({ foo: "bar" });
  });

  it("removes key when value is undefined", () => {
    setupActiveDoc();
    useCanonicalDocumentStore
      .getState()
      .updateNodeProps("button-1", { disabled: undefined });

    const node = selectCanonicalNode("button-1");
    expect(node?.props).toEqual({ label: "Click" });
    expect(node?.props).not.toHaveProperty("disabled");
  });

  it("rejects events / actions / dataBinding keys (G7 enforcement)", () => {
    setupActiveDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    useCanonicalDocumentStore.getState().updateNodeProps("button-1", {
      events: [{ kind: "onPress" }],
      actions: [{ id: "a", kind: "navigate" }],
      dataBinding: { type: "value", source: "x" },
      label: "Allowed",
    });

    const node = selectCanonicalNode("button-1");
    expect(node?.props).not.toHaveProperty("events");
    expect(node?.props).not.toHaveProperty("actions");
    expect(node?.props).not.toHaveProperty("dataBinding");
    expect(node?.props?.label).toBe("Allowed");
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(3);

    warn.mockRestore();
  });

  it("sets props to undefined when all keys removed", () => {
    setupActiveDoc();
    useCanonicalDocumentStore.getState().updateNodeProps("button-1", {
      label: undefined,
      disabled: undefined,
    });
    expect(selectCanonicalNode("button-1")?.props).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// updateNodeExtension
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — updateNodeExtension", () => {
  beforeEach(resetStore);

  function setupActiveDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("button-1", "Button", {
          props: { label: "Click" },
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("stores events / actions / dataBinding only in x-composition", () => {
    setupActiveDoc();

    useCanonicalDocumentStore.getState().updateNodeExtension("button-1", {
      events: [{ kind: "onPress", actionRef: "action-1" }],
      actions: [{ id: "action-1", kind: "navigate", target: "/home" }],
      dataBinding: {
        type: "value",
        source: "state",
        config: { path: "user.name" },
      },
      editor: { panel: "events" },
    });

    const extension = getExtension("button-1");
    expect(extension).toEqual({
      events: [{ kind: "onPress", actionRef: "action-1" }],
      actions: [{ id: "action-1", kind: "navigate", target: "/home" }],
      dataBinding: {
        type: "value",
        source: "state",
        config: { path: "user.name" },
      },
      editor: { panel: "events" },
    });
    expect(selectCanonicalNode("button-1")?.props).toEqual({
      label: "Click",
    });
  });

  it("removes x-composition when all extension keys are deleted", () => {
    setupActiveDoc();
    const store = useCanonicalDocumentStore.getState();

    store.updateNodeExtension("button-1", {
      events: [{ kind: "onPress", actionRef: "action-1" }],
      editor: { panel: "events" },
    });
    expect(getExtension("button-1")).toBeDefined();

    store.updateNodeExtension("button-1", {
      events: undefined,
      editor: undefined,
    });
    expect(getExtension("button-1")).toBeUndefined();
  });

  it("rejects function callbacks and runtime objects in extension payload", () => {
    setupActiveDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    useCanonicalDocumentStore.getState().updateNodeExtension("button-1", {
      events: [
        {
          kind: "onPress",
          callback: () => undefined,
        },
      ] as unknown as CompositionExtension["events"],
      dataBinding: {
        type: "value",
        source: "state",
        config: { marker: Symbol("runtime") },
      } as unknown as CompositionExtension["dataBinding"],
      editor: { panel: "events" },
    });

    expect(getExtension("button-1")).toEqual({ editor: { panel: "events" } });
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(2);

    warn.mockRestore();
  });

  it("does not increment documentVersion when extension patch is fully rejected", () => {
    setupActiveDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = useCanonicalDocumentStore.getState().documentVersion;

    useCanonicalDocumentStore.getState().updateNodeExtension("button-1", {
      actions: [
        {
          id: "bad",
          kind: "callback",
          run: () => undefined,
        },
      ] as unknown as CompositionExtension["actions"],
    });

    expect(useCanonicalDocumentStore.getState().documentVersion).toBe(before);
    expect(getExtension("button-1")).toBeUndefined();

    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// insertNode
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — insertNode", () => {
  beforeEach(resetStore);

  function setupActiveDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("parent", "Frame", {
          children: [makeNode("existing", "Section")],
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("appends node when index omitted", () => {
    setupActiveDoc();
    useCanonicalDocumentStore.getState().insertNode("parent", makeNode("new"));

    const parent = selectCanonicalNode("parent");
    expect(parent?.children?.map((c) => c.id)).toEqual(["existing", "new"]);
  });

  it("inserts at specific index", () => {
    setupActiveDoc();
    useCanonicalDocumentStore
      .getState()
      .insertNode("parent", makeNode("first"), 0);

    const parent = selectCanonicalNode("parent");
    expect(parent?.children?.map((c) => c.id)).toEqual(["first", "existing"]);
  });

  it("clamps index larger than children length", () => {
    setupActiveDoc();
    useCanonicalDocumentStore
      .getState()
      .insertNode("parent", makeNode("end"), 999);

    const parent = selectCanonicalNode("parent");
    expect(parent?.children?.map((c) => c.id)).toEqual(["existing", "end"]);
  });

  it("creates children array when parent had none", () => {
    resetStore();
    const doc = makeDoc({ children: [makeNode("empty", "Frame")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.insertNode("empty", makeNode("first-child"));
    expect(selectCanonicalNode("empty")?.children).toEqual([
      { id: "first-child", type: "Frame" },
    ]);
  });

  it("no-op + warn if parent not found", () => {
    setupActiveDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore.getState().insertNode("ghost", makeNode("x"));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// removeNode
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — removeNode", () => {
  beforeEach(resetStore);

  it("removes root-level node", () => {
    const doc = makeDoc({
      children: [makeNode("a"), makeNode("b"), makeNode("c")],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.removeNode("b");

    const active = selectActiveCanonicalDocument();
    expect(active?.children.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("removes nested node", () => {
    const doc = makeDoc({
      children: [
        makeNode("parent", "Frame", {
          children: [makeNode("kid-1"), makeNode("kid-2")],
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.removeNode("kid-1");

    const parent = selectCanonicalNode("parent");
    expect(parent?.children?.map((c) => c.id)).toEqual(["kid-2"]);
  });

  it("no-op + warn if node not found", () => {
    const doc = makeDoc({ children: [makeNode("a")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    store.removeNode("ghost");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// ADR-118 order helpers
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — ADR-118 children[] order helpers", () => {
  beforeEach(resetStore);

  function setupOrderDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("parent-a", "Frame", {
          children: [makeNode("a"), makeNode("b"), makeNode("c")],
        }),
        makeNode("parent-b", "Frame", {
          children: [makeNode("d")],
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("reads children from canonical children[] order", () => {
    setupOrderDoc();
    const store = useCanonicalDocumentStore.getState();

    expect(store.getNodeChildren("parent-a")?.map((node) => node.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("moves a node across parents with canonical children[] splice", () => {
    setupOrderDoc();
    const store = useCanonicalDocumentStore.getState();

    store.moveNode("b", "parent-b", 1);

    expect(selectCanonicalNode("parent-a")?.children?.map((c) => c.id)).toEqual(
      ["a", "c"],
    );
    expect(selectCanonicalNode("parent-b")?.children?.map((c) => c.id)).toEqual(
      ["d", "b"],
    );
  });

  it("appends same-ref descendant slot fills when child ids are unique", () => {
    const doc = makeDoc({
      children: [makeRefNode("instance", "master")],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.appendDescendantChild("instance", "content", {
      id: "fill-1",
      type: "ref",
      ref: "card-master",
    } as RefNode);
    store.appendDescendantChild("instance", "content", {
      id: "fill-2",
      type: "ref",
      ref: "card-master",
    } as RefNode);

    const instance = selectCanonicalNode("instance") as RefNode | null;
    const children = (
      instance?.descendants?.content as
        | { children: CanonicalNode[] }
        | undefined
    )?.children;
    expect(children?.map((node) => [node.id, (node as RefNode).ref])).toEqual([
      ["fill-1", "card-master"],
      ["fill-2", "card-master"],
    ]);
  });

  it("moves descendant slot children by descendant children[] index", () => {
    const doc = makeDoc({
      children: [
        makeRefNode("instance", "master", {
          descendants: {
            content: {
              children: [makeNode("slot-a"), makeNode("slot-b")],
            },
          },
        }),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    store.moveDescendantChild("instance", "content", "slot-b", 0);

    const instance = selectCanonicalNode("instance") as RefNode | null;
    const children = (
      instance?.descendants?.content as
        | { children: CanonicalNode[] }
        | undefined
    )?.children;
    expect(children?.map((node) => node.id)).toEqual(["slot-b", "slot-a"]);
  });
});

// ─────────────────────────────────────────────
// updateDescendant
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — updateDescendant", () => {
  beforeEach(resetStore);

  function setupRefDoc(): void {
    const doc = makeDoc({
      children: [
        makeNode("master", "Frame", { reusable: true }),
        makeRefNode("instance-1", "master"),
      ],
    });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("adds descendants entry (slot fill — children mode)", () => {
    setupRefDoc();
    const value: DescendantOverride = {
      children: [makeNode("filled", "Button")],
    };
    useCanonicalDocumentStore
      .getState()
      .updateDescendant("instance-1", "main", value);

    const ref = selectCanonicalNode("instance-1") as RefNode | null;
    expect(ref?.descendants?.["main"]).toEqual(value);
  });

  it("merges multiple descendants paths", () => {
    setupRefDoc();
    const store = useCanonicalDocumentStore.getState();
    store.updateDescendant("instance-1", "label", {
      text: "A",
    } as DescendantOverride);
    store.updateDescendant("instance-1", "icon", {
      name: "star",
    } as DescendantOverride);

    const ref = selectCanonicalNode("instance-1") as RefNode | null;
    expect(Object.keys(ref?.descendants ?? {})).toEqual(
      expect.arrayContaining(["label", "icon"]),
    );
  });

  it("overwrites existing descendant entry", () => {
    setupRefDoc();
    const store = useCanonicalDocumentStore.getState();
    store.updateDescendant("instance-1", "label", {
      text: "before",
    } as DescendantOverride);
    store.updateDescendant("instance-1", "label", {
      text: "after",
    } as DescendantOverride);

    const ref = selectCanonicalNode("instance-1") as RefNode | null;
    expect((ref?.descendants?.["label"] as { text: string }).text).toBe(
      "after",
    );
  });

  it("no-op + warn if target is not RefNode", () => {
    setupRefDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore
      .getState()
      .updateDescendant("master", "label", { text: "x" } as DescendantOverride);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no-op + warn if ref node not found", () => {
    setupRefDoc();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore
      .getState()
      .updateDescendant("ghost", "label", { text: "x" } as DescendantOverride);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// Cross-cutting: documentVersion / immutability
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — documentVersion + immutability", () => {
  beforeEach(resetStore);

  function setupActiveDoc(): void {
    const doc = makeDoc({ children: [makeNode("root", "Frame")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");
  }

  it("each successful mutation increments documentVersion", () => {
    setupActiveDoc();
    const v0 = useCanonicalDocumentStore.getState().documentVersion;

    useCanonicalDocumentStore.getState().updateNode("root", { name: "x" });
    const v1 = useCanonicalDocumentStore.getState().documentVersion;
    expect(v1).toBe(v0 + 1);

    useCanonicalDocumentStore.getState().insertNode("root", makeNode("kid"));
    const v2 = useCanonicalDocumentStore.getState().documentVersion;
    expect(v2).toBe(v1 + 1);

    useCanonicalDocumentStore.getState().removeNode("kid");
    const v3 = useCanonicalDocumentStore.getState().documentVersion;
    expect(v3).toBe(v2 + 1);

    useCanonicalDocumentStore.getState().updateNodeExtension("root", {
      editor: { panel: "events" },
    });
    const v4 = useCanonicalDocumentStore.getState().documentVersion;
    expect(v4).toBe(v3 + 1);
  });

  it("no-op mutations do not increment documentVersion", () => {
    setupActiveDoc();
    const before = useCanonicalDocumentStore.getState().documentVersion;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useCanonicalDocumentStore.getState().updateNode("ghost", { name: "x" });
    warn.mockRestore();

    const after = useCanonicalDocumentStore.getState().documentVersion;
    expect(after).toBe(before);
  });

  it("Map reference changes on each setDocument (selector triggers)", () => {
    const before = useCanonicalDocumentStore.getState().documents;
    useCanonicalDocumentStore.getState().setDocument("p", makeDoc());
    const after = useCanonicalDocumentStore.getState().documents;
    expect(after).not.toBe(before);
  });

  it("document tree is cloned on mutation (caller cannot mutate stored doc)", () => {
    setupActiveDoc();
    const doc1 = useCanonicalDocumentStore.getState().getDocument("p");
    expect(doc1).toBeDefined();

    useCanonicalDocumentStore.getState().updateNode("root", { name: "new" });
    const doc2 = useCanonicalDocumentStore.getState().getDocument("p");

    expect(doc1).not.toBe(doc2);
    expect(doc1?.children).not.toBe(doc2?.children);
    expect(doc1?.children[0]).not.toBe(doc2?.children[0]);
  });

  it("x-composition extension is cloned on unrelated node mutation", () => {
    setupActiveDoc();
    useCanonicalDocumentStore.getState().updateNodeExtension("root", {
      editor: { panel: "events" },
    });
    const beforeExtension = getExtension("root");

    useCanonicalDocumentStore.getState().updateNode("root", { name: "new" });
    const afterExtension = getExtension("root");

    expect(afterExtension).toEqual(beforeExtension);
    expect(afterExtension).not.toBe(beforeExtension);
  });
});

// ─────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────

describe("canonicalDocumentStore — selectors", () => {
  beforeEach(resetStore);

  it("selectCanonicalNode returns null without active project", () => {
    expect(selectCanonicalNode("any")).toBeNull();
  });

  it("selectActiveCanonicalDocument returns null without active project", () => {
    expect(selectActiveCanonicalDocument()).toBeNull();
  });

  it("selectActiveCanonicalDocument returns active project's doc", () => {
    const doc = makeDoc({ children: [makeNode("x")] });
    const store = useCanonicalDocumentStore.getState();
    store.setDocument("p", doc);
    store.setCurrentProject("p");

    const active = selectActiveCanonicalDocument();
    expect(active?.children[0].id).toBe("x");
  });
});

afterEach(() => {
  resetStore();
});
