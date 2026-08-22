// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  registerCanonicalMutationRunnerBridge,
  resetCanonicalMutationRunnerBridge,
} from "@/adapters/canonical/canonicalMutationRunner";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { historyManager } from "../stores/history";
import { useStore } from "../stores";
import { FillType, type FillItem } from "../../types/builder/fill.types";
import {
  commitEditorPresentationFills,
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationCommitAdapterDiagnostics,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";

const put = vi.fn(
  async (
    _projectId: string,
    _document: CompositionDocument,
    _options?: unknown,
  ) => undefined,
);

vi.mock("../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put } })),
}));

const PROJECT_ID = "adr187-phase2";
const PAGE_ID = "page-1";

function fill(color: string): FillItem {
  return {
    blendMode: "normal",
    color,
    enabled: true,
    id: "fill-1",
    opacity: 1,
    type: FillType.Color,
  };
}

function node(id: string, color: string): CanonicalNode {
  return {
    children: [],
    fills: [fill(color)],
    id,
    props: {},
    type: "div",
  } as unknown as CanonicalNode;
}

function documentWith(
  firstColor = "#111111FF",
  secondColor = "#333333FF",
): CompositionDocument {
  return {
    children: [node("node-1", firstColor), node("node-2", secondColor)],
    version: "composition-1.0",
  } as CompositionDocument;
}

function currentColor(nodeId = "node-1"): string | undefined {
  const document = useCanonicalDocumentStore
    .getState()
    .documents.get(PROJECT_ID);
  const target = document?.children.find((child) => child.id === nodeId);
  return (target?.fills?.[0] as { color?: string } | undefined)?.color;
}

function commit(color: string, baseDocumentVersion?: number) {
  const canonical = useCanonicalDocumentStore.getState();
  return commitEditorPresentationFills({
    baseDocumentVersion: baseDocumentVersion ?? canonical.documentVersion,
    commitIntent: "fill-color",
    descriptor: {
      fills: [fill(color)],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    },
    projectId: PROJECT_ID,
    sessionId: "session-1",
    targets: [{ kind: "canonical-node", nodeId: "node-1" }],
  });
}

async function flushPersist(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ADR-187 Phase 2 canonical fill commit", () => {
  const rebuildIndexes = vi.fn();

  beforeEach(() => {
    put.mockClear();
    rebuildIndexes.mockClear();
    historyManager.clearAllHistory();
    historyManager.setCurrentPage(PAGE_ID);
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useStore.setState({
      currentPageId: PAGE_ID,
      elements: [],
      elementsMap: new Map(),
      selectedElementId: "node-1",
      selectedElementProps: {},
    } as never);
    registerCanonicalMutationRunnerBridge({ rebuildIndexes });
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  });

  afterEach(() => {
    resetCanonicalMutationRunnerBridge();
    historyManager.clearAllHistory();
  });

  it("finish는 canonical/history/persist를 정확히 한 번 수행하고 실제 undo/redo 된다", async () => {
    const result = commit("#222222FF");

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    expect(currentColor()).toBe("#222222FF");
    expect(
      (
        useStore.getState().elements.find((element) => element.id === "node-1")
          ?.fills?.[0] as { color?: string } | undefined
      )?.color,
    ).toBe("#222222FF");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);

    await useStore.getState().undo();
    expect(currentColor()).toBe("#111111FF");
    await useStore.getState().redo();
    expect(currentColor()).toBe("#222222FF");
  });

  it("begin indexed read는 document tree를 lazy rebuild하지 않는다", () => {
    const before = getEditorPresentationCommitAdapterDiagnostics();
    const runtime = new EditorPresentationTransactionRuntime(
      editorPresentationCanonicalRuntimeOptions,
    );
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-indexed-read",
      projectId: PROJECT_ID,
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(getEditorPresentationCommitAdapterDiagnostics()).toEqual(before);
    handle.cancel("unmount");
  });

  it("no-op과 stale conflict는 runner 진입 전에 종료한다", async () => {
    const version = useCanonicalDocumentStore.getState().documentVersion;
    expect(commit("#111111FF")).toEqual({
      committedDocumentRevision: version,
    });
    expect(() => commit("#222222FF", version - 1)).toThrow(
      /document version changed/,
    );

    await flushPersist();
    expect(rebuildIndexes).not.toHaveBeenCalled();
    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    expect(put).not.toHaveBeenCalled();
  });

  it("reload hydration은 committed canonical 값만 복원하고 overlay를 만들지 않는다", async () => {
    commit("#ABCDEF80");
    await flushPersist();
    const persisted = put.mock.calls[0]?.[1];
    if (!persisted) throw new Error("persisted document expected");

    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, persisted);
    useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);

    expect(currentColor()).toBe("#ABCDEF80");
  });

  it("disjoint mutation은 rebase 후 commit하고 same-target mutation은 cancel한다", () => {
    const disjointRuntime = new EditorPresentationTransactionRuntime(
      editorPresentationCanonicalRuntimeOptions,
    );
    const disjoint = disjointRuntime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: PROJECT_ID,
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith("#111111FF", "#444444FF"));
    disjointRuntime.reconcileDocumentVersion(PROJECT_ID);
    expect(
      disjoint.finish({
        fills: [fill("#222222FF")],
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "fills.replace",
      }).status,
    ).toBe("committed");
    expect(currentColor("node-2")).toBe("#444444FF");

    const conflictRuntime = new EditorPresentationTransactionRuntime(
      editorPresentationCanonicalRuntimeOptions,
    );
    const conflict = conflictRuntime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-2",
      projectId: PROJECT_ID,
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith("#555555FF", "#444444FF"));
    conflictRuntime.reconcileDocumentVersion(PROJECT_ID);
    expect(
      conflict.finish({
        fills: [fill("#666666FF")],
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "fills.replace",
      }),
    ).toEqual({ reason: "conflict", status: "cancelled" });
    expect(currentColor()).toBe("#555555FF");
  });

  it("ref-descendant fill은 stable path를 통해 DOM/Skia 공통 semantic target으로 commit한다", () => {
    const refDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "master-card",
          type: "frame",
          reusable: true,
          children: [
            {
              id: "label",
              type: "frame",
              fills: [fill("#111111FF")],
              props: {},
            },
          ],
        },
        {
          id: "instance-card",
          type: "ref",
          ref: "master-card",
          descendants: {},
        },
      ],
    } as unknown as CompositionDocument;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, refDocument);

    const target = resolveEditorPresentationTarget(
      PROJECT_ID,
      "instance-card/label",
    );
    expect(target).toEqual({
      kind: "ref-descendant",
      refId: "instance-card",
      pathKey: "label",
    });

    commitEditorPresentationFills({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "fill-color",
      descriptor: {
        type: "fills.replace",
        target: target!,
        fills: [fill("#ABCDEF80")],
      },
      projectId: PROJECT_ID,
      sessionId: "ref-session",
      targets: [target!],
    });

    const next = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)
      ?.children.find(
        (candidate) => candidate.id === "instance-card",
      ) as unknown as { descendants?: Record<string, { fills?: FillItem[] }> };
    expect(
      (next.descendants?.label?.fills?.[0] as { color?: string } | undefined)
        ?.color,
    ).toBe("#ABCDEF80");
  });
});
