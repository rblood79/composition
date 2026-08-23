// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument, CanonicalNode } from "@composition/shared";
import { useStore } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { resolvePresentationPaintProps } from "../../preview/components/CanonicalNodeRenderer";
import { resolveOpacityPresentationPilotTarget } from "./editorPresentationStylePilot";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import type { EditorPresentationFrameScheduler } from "./editorPresentationRuntime";
import { StoreRenderBridge } from "../workspace/canvas/skia/StoreRenderBridge";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";

const PROJECT_ID = "adr187-opacity-harness-project";
const DEFAULT_ID = "adr187-opacity-default";
const STATE_ID = "adr187-opacity-state";

let consoleErrorCount = 0;

interface HarnessCounters {
  actionRafCallbackCount: number;
  canonicalWriteCount: number;
  consoleErrorCount: number;
  controlRafCallbackCount: number;
  legacyWriteCount: number;
  staleCallbackAfterTerminalCount: number;
  targetIncrementalPatchCount: number;
  terminalEventCount: number;
}

interface HarnessSnapshot {
  canonicalStyle: Readonly<Record<string, unknown>>;
  counters: HarnessCounters;
  geometry: { height: number; left: number; top: number; width: number };
  previewStyle: Record<string, unknown>;
  skiaEffects: readonly unknown[];
  runtimeFrameApplyCount: number;
}

interface FakeScheduler extends EditorPresentationFrameScheduler {
  flush(): void;
}

function createScheduler(): FakeScheduler {
  let nextHandle = 0;
  const callbacks = new Map<number, (timestamp: number) => void>();
  return {
    cancel(handle) {
      callbacks.delete(handle);
    },
    flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback(0);
    },
    request(callback) {
      nextHandle += 1;
      callbacks.set(nextHandle, callback);
      return nextHandle;
    },
  };
}

function makeCanonicalNode(
  id: string,
  state: "default" | "disabled",
): CanonicalNode {
  return {
    children: [],
    id,
    props: {
      children: "Opacity",
      ...(state === "disabled" ? { isDisabled: true } : {}),
      style: {
        height: "120px",
        left: "110px",
        opacity: 1,
        position: "absolute",
        top: "70px",
        width: "220px",
      },
    },
    type: "Button",
  } as unknown as CanonicalNode;
}

function makeDocument(node: CanonicalNode): CompositionDocument {
  return {
    children: [node],
    version: "composition-1.0",
  } as CompositionDocument;
}

function makeSkiaNode(state: "default" | "disabled"): SkiaNodeData {
  const node: SkiaNodeData = {
    box: {
      borderRadius: 0,
      fillColor: Float32Array.of(0.1, 0.2, 0.3, 1),
    },
    height: 120,
    type: "box",
    visible: true,
    width: 220,
    x: 110,
    y: 70,
  };
  if (state === "disabled") {
    node.effects = [{ type: "opacity", value: 0.38, source: "state" }];
  }
  return node;
}

function setupDocument(node: CanonicalNode): void {
  useCanonicalDocumentStore.setState({
    currentProjectId: null,
    documents: new Map(),
    documentVersion: 0,
  });
  useCanonicalDocumentStore
    .getState()
    .setDocument(PROJECT_ID, makeDocument(node));
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useStore.setState({
    currentPageId: "page-1",
    elements: [],
    elementsMap: new Map(),
    selectedElementId: node.id,
    selectedElementProps: node.props,
  } as never);
  window.history.replaceState(
    {},
    "",
    "/builder/opacity-harness?adr187Metrics=1",
  );
}

function createHarness(
  nodeId: string,
  state: "default" | "disabled",
): {
  bridge: StoreRenderBridge;
  counters: HarnessCounters;
  node: SkiaNodeData;
  previewBase: Record<string, unknown>;
  runtime: EditorPresentationTransactionRuntime;
  scheduler: FakeScheduler;
} {
  const node = makeSkiaNode(state);
  registerSkiaNode(nodeId, node);
  const bridge = new StoreRenderBridge();
  const counters: HarnessCounters = {
    actionRafCallbackCount: 0,
    canonicalWriteCount: 0,
    consoleErrorCount: 0,
    controlRafCallbackCount: 0,
    legacyWriteCount: 0,
    staleCallbackAfterTerminalCount: 0,
    targetIncrementalPatchCount: 0,
    terminalEventCount: 0,
  };
  const scheduler = createScheduler();
  const previewBase: Record<string, unknown> = {
    style: {
      height: "120px",
      left: "110px",
      opacity: 1,
      top: "70px",
      width: "220px",
    },
  };
  const basePreviewStyle = previewBase.style as Record<string, unknown>;
  let canonicalStyle = basePreviewStyle;
  let previewStyle = basePreviewStyle;
  const runtime = new EditorPresentationTransactionRuntime({
    commit: ({ descriptor }) => {
      counters.canonicalWriteCount += 1;
      if (descriptor.type !== "style.patch") {
        throw new Error("opacity harness requires style patch");
      }
      canonicalStyle = {
        ...basePreviewStyle,
        opacity: descriptor.patch.opacity,
      };
      return { committedDocumentRevision: 2 };
    },
    hasTarget: () => true,
    isDescriptorEqualToBase: (descriptor, baseValue) =>
      descriptor.type === "style.patch" &&
      Object.is(descriptor.patch.opacity, baseValue),
    readDocumentVersion: () => 1,
    readTargetValue: () => 1,
    scheduler,
  });
  runtime.subscribeSessionEvents((event) => {
    if (event.type === "updated") {
      const descriptor = event.session.applied?.descriptor;
      if (!descriptor || descriptor.type !== "style.patch") return;
      counters.targetIncrementalPatchCount += 1;
      bridge.applyPresentationStylePatch(nodeId, descriptor.patch);
      previewStyle = (resolvePresentationPaintProps(previewBase, [descriptor])
        .style ?? {}) as Record<string, unknown>;
      return;
    }

    counters.terminalEventCount += 1;
    bridge.restorePresentationStylePatch(nodeId);
    if (
      event.result.status === "committed" &&
      event.finalDescriptor?.type === "style.patch"
    ) {
      node.effects = [
        {
          type: "opacity",
          value: Number(event.finalDescriptor.patch.opacity),
          source: "style",
        },
      ];
      previewStyle = {
        ...basePreviewStyle,
        opacity: event.finalDescriptor.patch.opacity,
      };
    } else {
      previewStyle = basePreviewStyle;
    }
  });
  Object.defineProperty(runtime, "readHarnessSnapshot", {
    value: () => ({
      canonicalStyle: { ...canonicalStyle },
      counters: {
        ...counters,
        consoleErrorCount,
        staleCallbackAfterTerminalCount:
          runtime.getDiagnostics().staleFrameCallbackCount,
      },
      geometry: {
        height: node.height,
        left: node.x,
        top: node.y,
        width: node.width,
      },
      previewStyle: { ...previewStyle },
      skiaEffects: [...(node.effects ?? [])],
      runtimeFrameApplyCount: runtime.getDiagnostics().frameApplyCount,
    }),
  });
  return { bridge, counters, node, previewBase, runtime, scheduler };
}

describe("ADR-187 opacity populated fixture harness", () => {
  beforeEach(() => {
    consoleErrorCount = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    clearSkiaRegistry();
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useStore.setState({ selectedElementId: null } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["cancel", "finish"] as const)(
    "explicit opacity:1 keeps geometry and Preview/Skia parity on %s",
    (terminal) => {
      const canonical = makeCanonicalNode(DEFAULT_ID, "default");
      setupDocument(canonical);
      const pilot = makeSkiaNode("default");
      registerSkiaNode(DEFAULT_ID, pilot);
      expect(resolveOpacityPresentationPilotTarget(DEFAULT_ID)).not.toBeNull();
      clearSkiaRegistry();

      const harness = createHarness(DEFAULT_ID, "default");
      const target = { kind: "canonical-node" as const, nodeId: DEFAULT_ID };
      const before = (
        harness.runtime as unknown as {
          readHarnessSnapshot: () => HarnessSnapshot;
        }
      ).readHarnessSnapshot();
      const handle = harness.runtime.beginEditorPresentation({
        commitIntent: "style-opacity",
        ownerId: "adr187-opacity-harness",
        projectId: PROJECT_ID,
        targets: [target],
      });
      handle.publish({
        patch: { opacity: "0.42" },
        target,
        type: "style.patch",
      });
      harness.scheduler.flush();
      const during = (
        harness.runtime as unknown as {
          readHarnessSnapshot: () => HarnessSnapshot;
        }
      ).readHarnessSnapshot();
      if (terminal === "cancel") handle.cancel("pointer-cancel");
      else
        handle.finish({
          patch: { opacity: "0.42" },
          target,
          type: "style.patch",
        });
      const after = (
        harness.runtime as unknown as {
          readHarnessSnapshot: () => HarnessSnapshot;
        }
      ).readHarnessSnapshot();

      expect(during.geometry).toEqual(before.geometry);
      expect(after.geometry).toEqual(before.geometry);
      expect(during.canonicalStyle.opacity).toBe(1);
      expect(during.previewStyle.opacity).toBe("0.42");
      expect(during.skiaEffects[0]).toMatchObject({
        source: "presentation",
        value: 0.42,
      });
      expect(after.counters.legacyWriteCount).toBe(0);
      expect(after.counters.consoleErrorCount).toBe(0);
      expect(after.counters.actionRafCallbackCount).toBe(0);
      expect(after.counters.controlRafCallbackCount).toBe(0);
      expect(after.counters.staleCallbackAfterTerminalCount).toBe(0);
      expect(after.counters.terminalEventCount).toBe(1);
      if (terminal === "cancel") {
        expect(after.canonicalStyle.opacity).toBe(1);
        expect(after.previewStyle.opacity).toBe(1);
        expect(after.skiaEffects).toEqual([]);
        expect(after.counters.canonicalWriteCount).toBe(0);
      } else {
        expect(after.canonicalStyle.opacity).toBe("0.42");
        expect(after.previewStyle.opacity).toBe("0.42");
        expect(after.skiaEffects[0]).toMatchObject({
          source: "style",
          value: 0.42,
        });
        expect(after.counters.canonicalWriteCount).toBe(1);
      }
    },
  );

  it("state opacity is populated but owner gate remains fail-closed", () => {
    const canonical = makeCanonicalNode(STATE_ID, "disabled");
    setupDocument(canonical);
    const node = makeSkiaNode("disabled");
    registerSkiaNode(STATE_ID, node);

    expect(resolveOpacityPresentationPilotTarget(STATE_ID)).toBeNull();
    expect(node.effects).toEqual([
      { type: "opacity", value: 0.38, source: "state" },
    ]);
    expect(
      node.effects?.some(
        (effect) => effect.type === "opacity" && effect.source === "state",
      ),
    ).toBe(true);
  });
});
