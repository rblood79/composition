// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  registerCanonicalMutationRunnerBridge,
  resetCanonicalMutationRunnerBridge,
} from "@/adapters/canonical/canonicalMutationRunner";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "../stores/canonical/canonicalElementsView";
import { historyManager } from "../stores/history";
import { useStore } from "../stores";
import { FillType, type FillItem } from "../../types/builder/fill.types";
import {
  commitEditorPresentationFills,
  commitEditorPresentationStyle,
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationCommitAdapterDiagnostics,
  getEditorPresentationTargetNode,
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

function node(
  id: string,
  color: string,
  style: Record<string, unknown> = {},
): CanonicalNode {
  return {
    children: [],
    fills: [fill(color)],
    id,
    props: { style },
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
    const initialDocument = documentWith();
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, initialDocument);
    useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
    const initialElements = canonicalDocumentToElements(initialDocument);
    useStore.getState().hydrateProjectSnapshot(initialElements);
    useStore.setState({
      currentPageId: PAGE_ID,
      selectedElementId: "node-1",
      selectedElementProps: {},
    } as never);
    registerCanonicalMutationRunnerBridge({ rebuildIndexes });
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
    expect(rebuildIndexes).toHaveBeenCalledWith("store");
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);

    await useStore.getState().undo();
    expect(currentColor()).toBe("#111111FF");
    await useStore.getState().redo();
    expect(currentColor()).toBe("#222222FF");
  });

  it("fill commit은 target mirror만 교체하고 후속 commit에서 O(1) index를 재사용한다", async () => {
    const beforeDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    const untouchedElement = useStore.getState().elements[1];

    commit("#222222FF");

    const state = useStore.getState();
    const firstDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    expect(state.elements[1]).toBe(untouchedElement);
    expect(firstDiagnostics.incrementalStorePatchCount).toBe(
      beforeDiagnostics.incrementalStorePatchCount + 1,
    );
    expect(firstDiagnostics.fullStoreProjectionFallbackCount).toBe(
      beforeDiagnostics.fullStoreProjectionFallbackCount,
    );
    expect(firstDiagnostics.storeElementIndexBuildCount).toBe(
      beforeDiagnostics.storeElementIndexBuildCount + 1,
    );

    commit("#444444FF");
    const secondDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    expect(secondDiagnostics.incrementalStorePatchCount).toBe(
      beforeDiagnostics.incrementalStorePatchCount + 2,
    );
    expect(secondDiagnostics.storeElementIndexBuildCount).toBe(
      firstDiagnostics.storeElementIndexBuildCount,
    );
    expect(rebuildIndexes).toHaveBeenLastCalledWith("store");
    await flushPersist();
  });

  it("duplicate id mirror는 기존 전체 projection 의미로 fallback한다", () => {
    const duplicateDocument = {
      ...documentWith(),
      children: [node("node-1", "#111111FF"), node("node-1", "#333333FF")],
    } as CompositionDocument;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, duplicateDocument);
    const elements = canonicalDocumentToElements(duplicateDocument);
    useStore.setState({
      elements,
      elementsMap: new Map(elements.map((element) => [element.id, element])),
    });
    const beforeDiagnostics = getEditorPresentationCommitAdapterDiagnostics();

    commit("#222222FF");

    const afterDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    expect(useStore.getState().elements).toHaveLength(2);
    expect(
      useStore
        .getState()
        .elements.map(
          (element) =>
            (element.fills?.[0] as { color?: string } | undefined)?.color,
        ),
    ).toEqual(["#111111FF", "#222222FF"]);
    expect(afterDiagnostics.incrementalStorePatchCount).toBe(
      beforeDiagnostics.incrementalStorePatchCount,
    );
    expect(afterDiagnostics.fullStoreProjectionFallbackCount).toBe(
      beforeDiagnostics.fullStoreProjectionFallbackCount + 1,
    );
  });

  it("canonical revision과 다른 부분 store mirror는 full projection으로 복구한다", () => {
    const externallyUpdatedDocument = {
      ...documentWith(),
      children: [
        node("node-1", "#111111FF"),
        node("node-2", "#555555FF"),
        node("node-3", "#777777FF"),
      ],
    } as CompositionDocument;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, externallyUpdatedDocument);
    const beforeDiagnostics = getEditorPresentationCommitAdapterDiagnostics();

    commit("#222222FF");

    const elements = useStore.getState().elements;
    const afterDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    expect(elements.map((element) => element.id)).toEqual([
      "node-1",
      "node-2",
      "node-3",
    ]);
    expect(
      elements.find((element) => element.id === "node-2")?.fills?.[0],
    ).toMatchObject({ color: "#555555FF" });
    expect(afterDiagnostics.incrementalStorePatchCount).toBe(
      beforeDiagnostics.incrementalStorePatchCount,
    );
    expect(afterDiagnostics.fullStoreProjectionFallbackCount).toBe(
      beforeDiagnostics.fullStoreProjectionFallbackCount + 1,
    );
    expect(rebuildIndexes).toHaveBeenLastCalledWith("store");
  });

  it("borderColor style patch는 canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    const updatedDocument = {
      ...document,
      children: [
        node("node-1", "#111111FF", {
          borderColor: "#111111",
          borderWidth: "1px",
        }),
        document.children[1]!,
      ],
    } as CompositionDocument;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, updatedDocument);
    const storeElements = canonicalDocumentToElements(updatedDocument);
    useStore.getState().hydrateProjectSnapshot(storeElements);
    const beforeDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    const untouchedElement = useStore.getState().elements[1];
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-border-color",
      descriptor: {
        patch: { borderColor: "#ABCDEF" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "style-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.borderColor,
    ).toBe("#ABCDEF");
    expect(useStore.getState().elements[1]).toBe(untouchedElement);
    const afterDiagnostics = getEditorPresentationCommitAdapterDiagnostics();
    expect(afterDiagnostics.incrementalStorePatchCount).toBe(
      beforeDiagnostics.incrementalStorePatchCount + 1,
    );
    expect(afterDiagnostics.fullStoreProjectionFallbackCount).toBe(
      beforeDiagnostics.fullStoreProjectionFallbackCount,
    );
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("opacity style patch는 canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        node("node-1", "#111111FF", { opacity: "0.5" }),
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-opacity",
      descriptor: {
        patch: { opacity: "0.25" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "opacity-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.opacity,
    ).toBe("0.25");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("absolute leaf width style patch는 canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        node("node-1", "#111111FF", {
          position: "absolute",
          width: "120px",
          height: "80px",
        }),
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-layout-width",
      descriptor: {
        patch: { width: "200px" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "layout-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.width,
    ).toBe("200px");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("numeric spacing style patch는 canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        node("node-1", "#111111FF", {
          display: "flex",
          gap: "8px",
          paddingTop: "4px",
        }),
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-layout-gap",
      descriptor: {
        patch: { gap: "16px" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "layout-gap-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    const nextStyle = next?.props?.style as Record<string, unknown> | undefined;
    expect(nextStyle?.gap).toBeUndefined();
    expect(nextStyle?.rowGap).toBe("16px");
    expect(nextStyle?.columnGap).toBe("16px");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  // ADR-222 §1.1: Option/Alt 양쪽 padding 은 2변 원자 patch 로 commit 1회.
  it("two-side padding patch는 한 번의 canonical/history/persist 로 원자 commit 된다 (ADR-222)", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        node("node-1", "#111111FF", {
          display: "flex",
          padding: "4px 6px",
        }),
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-layout-spacing",
      descriptor: {
        patch: { paddingLeft: "20px", paddingRight: "20px" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "layout-padding-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    const nextStyle = next?.props?.style as Record<string, unknown> | undefined;
    expect(nextStyle?.padding).toBeUndefined();
    expect(nextStyle?.paddingLeft).toBe("20px");
    expect(nextStyle?.paddingRight).toBe("20px");
    expect(nextStyle?.paddingTop).toBe("4px");
    expect(nextStyle?.paddingBottom).toBe("4px");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  describe("비-desktop breakpoint spacing 라우팅 (ADR-222 §1.1 확장, 2026-09-17)", () => {
    function seedSpacingNode(responsive?: CanonicalNode["responsive"]): void {
      const document = useCanonicalDocumentStore
        .getState()
        .documents.get(PROJECT_ID)!;
      const first = node("node-1", "#111111FF", {
        display: "flex",
        paddingTop: 16,
        rowGap: 8,
      });
      useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
        ...document,
        children: [
          responsive ? { ...first, responsive } : first,
          document.children[1]!,
        ],
      });
    }
    function commitSpacing(patch: Record<string, string>) {
      return commitEditorPresentationStyle({
        baseDocumentVersion:
          useCanonicalDocumentStore.getState().documentVersion,
        commitIntent: "style-layout-spacing",
        descriptor: {
          patch,
          target: { kind: "canonical-node", nodeId: "node-1" },
          type: "style.patch",
        },
        projectId: PROJECT_ID,
        sessionId: "layout-spacing-session",
        targets: [{ kind: "canonical-node", nodeId: "node-1" }],
      });
    }
    function firstNode(): CanonicalNode {
      return useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)!
        .children[0]!;
    }

    afterEach(() => {
      useStore.setState({ activeBreakpoint: "desktop" } as never);
    });

    it("mobile 에서 tier 토글 ON 인 키는 responsive.styles[key].mobile 로 쓰고 base 는 그대로다", async () => {
      seedSpacingNode({ styles: { paddingTop: { mobile: 24 } } });
      useStore.setState({ activeBreakpoint: "mobile" } as never);

      commitSpacing({ paddingTop: "40px" });

      const next = firstNode();
      expect((next.props?.style as Record<string, unknown>).paddingTop).toBe(
        16,
      );
      expect(
        (next.responsive?.styles as Record<string, Record<string, unknown>>)
          .paddingTop,
      ).toEqual({ mobile: 40 });
      expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
      await flushPersist();
      expect(put).toHaveBeenCalledTimes(1);
    });

    it("mobile 에서 토글 OFF 인 키는 base 로 쓴다 (ADR-154 개정 1 기본 모델)", () => {
      seedSpacingNode();
      useStore.setState({ activeBreakpoint: "mobile" } as never);

      commitSpacing({ rowGap: "20px" });

      const next = firstNode();
      expect((next.props?.style as Record<string, unknown>).rowGap).toBe(
        "20px",
      );
      expect(next.responsive).toBeUndefined();
    });

    it("tier override 와 같은 값으로 돌아오면 no-op, base 와 같은 값이어도 override 는 갱신된다", () => {
      seedSpacingNode({ styles: { paddingTop: { mobile: 24 } } });
      useStore.setState({ activeBreakpoint: "mobile" } as never);
      const version = useCanonicalDocumentStore.getState().documentVersion;

      expect(commitSpacing({ paddingTop: "24px" })).toEqual({
        committedDocumentRevision: version,
      });
      // effective 읽기도 tier 값이다 — runtime 의 "base 와 같음" 판정이 override 값을 본다
      expect(
        (
          editorPresentationCanonicalRuntimeOptions.readTargetValue(
            PROJECT_ID,
            { kind: "canonical-node", nodeId: "node-1" },
            "style-layout-spacing",
          ) as Record<string, unknown>
        ).paddingTop,
      ).toBe(24);

      commitSpacing({ paddingTop: "16px" });
      expect(
        (
          firstNode().responsive?.styles as Record<
            string,
            Record<string, unknown>
          >
        ).paddingTop,
      ).toEqual({ mobile: 16 });
    });

    it("desktop 은 responsive 가 있어도 base 로 쓴다", () => {
      seedSpacingNode({ styles: { paddingTop: { mobile: 24 } } });

      commitSpacing({ paddingTop: "40px" });

      const next = firstNode();
      expect((next.props?.style as Record<string, unknown>).paddingTop).toBe(
        "40px",
      );
      expect(
        (next.responsive?.styles as Record<string, Record<string, unknown>>)
          .paddingTop,
      ).toEqual({ mobile: 24 });
    });
  });

  it("boxShadow style patch는 canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        node("node-1", "#111111FF", {
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }),
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-box-shadow",
      descriptor: {
        patch: { boxShadow: "inset 0 4px 10px 1px rgba(0,0,0,0.3)" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "shadow-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.boxShadow,
    ).toBe("inset 0 4px 10px 1px rgba(0,0,0,0.3)");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("Text color style patch는 Text canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        {
          ...node("node-1", "#111111FF", { color: "#112233" }),
          type: "Text",
        } as CanonicalNode,
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-text-color",
      descriptor: {
        patch: { color: "#ABCDEF" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "text-color-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.color,
    ).toBe("#ABCDEF");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("Button color style patch는 text-bearing root canonical/history/persist를 한 번만 수행한다", async () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, documentWith());
    const document = useCanonicalDocumentStore
      .getState()
      .documents.get(PROJECT_ID)!;
    useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, {
      ...document,
      children: [
        {
          ...node("node-1", "#111111FF", {
            children: "Button",
            color: "#112233",
          }),
          type: "Button",
        } as CanonicalNode,
        document.children[1]!,
      ],
    });
    const result = commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-text-color",
      descriptor: {
        patch: { color: "#ABCDEF" },
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "style.patch",
      },
      projectId: PROJECT_ID,
      sessionId: "button-color-session",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });

    expect(result.committedDocumentRevision).toBe(
      useCanonicalDocumentStore.getState().documentVersion,
    );
    const next = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)
      ?.children[0];
    expect(
      (next?.props?.style as Record<string, unknown> | undefined)?.color,
    ).toBe("#ABCDEF");
    expect(rebuildIndexes).toHaveBeenCalledTimes(1);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    await flushPersist();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("Text color style patch는 non-Text target에서 fail-closed한다", () => {
    expect(() =>
      commitEditorPresentationStyle({
        baseDocumentVersion:
          useCanonicalDocumentStore.getState().documentVersion,
        commitIntent: "style-text-color",
        descriptor: {
          patch: { color: "#ABCDEF" },
          target: { kind: "canonical-node", nodeId: "node-1" },
          type: "style.patch",
        },
        projectId: PROJECT_ID,
        sessionId: "text-color-non-text-session",
        targets: [{ kind: "canonical-node", nodeId: "node-1" }],
      }),
    ).toThrow(
      "text color presentation target must own a materialized text target",
    );
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

  // ADR-229 Phase 0 — 조합 origin 의 자식이 다른 origin 의 ref (Form 안 TextField) 일 때 그 안쪽
  //   자식 (Label) 의 style 편집 target 은 nested master 를 거쳐 찾고, 저장은 바깥 instance 의
  //   `descendants["<자식 ref>/<nested 자식>"]` 하나다 (2단 소유권 — 조합 origin · Button origin 무오염).
  it("nested origin-child ref 를 거치는 깊은 path 의 style 편집은 바깥 instance descendants 에 저장된다", () => {
    const nestedDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "component-textfield",
          type: "TextField",
          reusable: true,
          props: { label: "Field" },
          children: [
            {
              id: "component-textfield__1",
              type: "Label",
              props: { children: "Field", style: { fontWeight: 600 } },
            },
          ],
        },
        {
          id: "component-form",
          type: "Form",
          reusable: true,
          props: {},
          children: [
            {
              id: "component-form__field-1",
              type: "ref",
              ref: "component-textfield",
              props: { label: "Name" },
            },
          ],
        },
        { id: "form-1", type: "ref", ref: "component-form", descendants: {} },
      ],
    } as unknown as CompositionDocument;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, nestedDocument);
    const snapshot = JSON.stringify(nestedDocument);

    const target = resolveEditorPresentationTarget(
      PROJECT_ID,
      "form-1/component-form__field-1/component-textfield__1",
    );
    expect(target).toEqual({
      kind: "ref-descendant",
      refId: "form-1",
      pathKey: "component-form__field-1/component-textfield__1",
    });
    // nested ref 자식 자체도 target 이며 base style 은 nested master ⊕ 자식 props 다.
    const fieldTarget = resolveEditorPresentationTarget(
      PROJECT_ID,
      "form-1/component-form__field-1",
    );
    expect(fieldTarget).toEqual({
      kind: "ref-descendant",
      refId: "form-1",
      pathKey: "component-form__field-1",
    });
    expect(
      getEditorPresentationTargetNode(PROJECT_ID, fieldTarget!),
    ).toMatchObject({ type: "TextField", props: { label: "Name" } });

    commitEditorPresentationStyle({
      baseDocumentVersion: useCanonicalDocumentStore.getState().documentVersion,
      commitIntent: "style-border-color",
      descriptor: {
        type: "style.patch",
        target: target!,
        patch: { borderColor: "#ABCDEF" },
      },
      projectId: PROJECT_ID,
      sessionId: "nested-session",
      targets: [target!],
    });

    const doc = useCanonicalDocumentStore.getState().documents.get(PROJECT_ID)!;
    const instance = doc.children.find((c) => c.id === "form-1") as unknown as {
      descendants?: Record<string, { style?: Record<string, unknown> }>;
    };
    expect(
      instance.descendants?.["component-form__field-1/component-textfield__1"]
        ?.style,
    ).toEqual({ borderColor: "#ABCDEF" });
    // 조합 origin 과 TextField origin 은 그대로.
    const origins = doc.children.filter((c) => c.id !== "form-1");
    expect(JSON.stringify(origins)).toBe(
      JSON.stringify(
        JSON.parse(snapshot).children.filter(
          (c: { id: string }) => c.id !== "form-1",
        ),
      ),
    );
  });

  // ADR-229 Phase 2 (F23, live 실측): segment 는 name → id 라 '/' 를 품을 수 있다 (Form seed
  //   "TextField/Name"). path 를 '/' 로 쪼개면 그 자식을 못 찾는다 — 남은 path 의 앞부분과 segment 를
  //   통째로 맞춘다 (해소기 · descendants 키와 같은 문자열 규약).
  it("segment 안에 '/' 가 있는 조합 자식 (name 'TextField/Name') 도 target 을 찾고 그 아래 path 로 내려간다", () => {
    const nestedDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "component-textfield",
          type: "TextField",
          reusable: true,
          props: { label: "Field" },
          children: [
            {
              id: "component-textfield__1",
              type: "Label",
              props: { children: "Field", style: { fontWeight: 600 } },
            },
          ],
        },
        {
          id: "component-form",
          type: "Form",
          reusable: true,
          props: {},
          children: [
            {
              id: "component-form__field-1",
              type: "ref",
              ref: "component-textfield",
              name: "TextField/Name",
              props: { label: "Name" },
            },
          ],
        },
        { id: "form-1", type: "ref", ref: "component-form", descendants: {} },
      ],
    } as unknown as CompositionDocument;
    useCanonicalDocumentStore
      .getState()
      .setDocument(PROJECT_ID, nestedDocument);

    const fieldTarget = resolveEditorPresentationTarget(
      PROJECT_ID,
      "form-1/TextField/Name",
    );
    expect(fieldTarget).toEqual({
      kind: "ref-descendant",
      refId: "form-1",
      pathKey: "TextField/Name",
    });
    expect(
      getEditorPresentationTargetNode(PROJECT_ID, fieldTarget!),
    ).toMatchObject({ type: "TextField", props: { label: "Name" } });
    const labelTarget = resolveEditorPresentationTarget(
      PROJECT_ID,
      "form-1/TextField/Name/component-textfield__1",
    );
    expect(
      getEditorPresentationTargetNode(PROJECT_ID, labelTarget!),
    ).toMatchObject({ type: "Label", props: { children: "Field" } });
    expect(
      resolveEditorPresentationTarget(PROJECT_ID, "form-1/TextField"),
    ).toBeNull();
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
