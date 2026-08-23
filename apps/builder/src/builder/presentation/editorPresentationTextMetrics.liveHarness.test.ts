// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { useStore } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { resolvePresentationTextMetricProps } from "../../preview/components/presentationTextMetricProps";
import { resolveTextMetricPresentationPilotTarget } from "./editorPresentationTextMetrics";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import type { EditorPresentationFrameScheduler } from "./editorPresentationRuntime";
import { StoreRenderBridge } from "../workspace/canvas/skia/StoreRenderBridge";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import { getTextParagraphCacheKey } from "../workspace/canvas/skia/textParagraphKey";

const PROJECT_ID = "adr187-text-metric-harness-project";
const TEXT_ID = "adr187-text-metric-harness-text";

interface FakeScheduler extends EditorPresentationFrameScheduler {
  flush(): void;
}

interface HarnessSnapshot {
  canonicalStyle: Readonly<Record<string, unknown>>;
  consoleErrorCount: number;
  geometry: { height: number; left: number; top: number; width: number };
  paragraphKey: string;
  previewStyle: Record<string, unknown>;
  skiaFontSize: number;
  skiaFontWeight: number | undefined;
  terminalEventCount: number;
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

function makeCanonicalNode(): CanonicalNode {
  return {
    children: [],
    id: TEXT_ID,
    props: {
      children: "Parity",
      style: {
        fontSize: "16px",
        fontWeight: "400",
        height: "120px",
        left: "110px",
        position: "absolute",
        top: "70px",
        width: "220px",
      },
    },
    type: "Text",
  } as unknown as CanonicalNode;
}

function makeDocument(node: CanonicalNode): CompositionDocument {
  return {
    children: [node],
    version: "composition-1.0",
  } as CompositionDocument;
}

function makeSkiaNode(): SkiaNodeData {
  const text = {
    color: Float32Array.of(0, 0, 0, 1),
    content: "Parity",
    fontFamilies: ["Inter"],
    fontSize: 16,
    fontWeight: 400,
    maxWidth: 220,
    paddingLeft: 0,
    paddingTop: 0,
  };
  return {
    elementId: TEXT_ID,
    height: 120,
    presentationTextMetricTargets: [{ text }],
    text,
    type: "text",
    visible: true,
    width: 220,
    x: 110,
    y: 70,
  };
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
    selectedElementId: TEXT_ID,
    selectedElementProps: node.props,
  } as never);
  window.history.replaceState(
    {},
    "",
    "/builder/text-metric-harness?adr187Metrics=1",
  );
}

function createHarness(): {
  bridge: StoreRenderBridge;
  node: SkiaNodeData;
  previewBase: Record<string, unknown>;
  runtime: EditorPresentationTransactionRuntime;
  scheduler: FakeScheduler;
} {
  const node = makeSkiaNode();
  registerSkiaNode(TEXT_ID, node);
  const bridge = new StoreRenderBridge();
  const scheduler = createScheduler();
  const previewBase: Record<string, unknown> = {
    style: {
      fontSize: "16px",
      fontWeight: "400",
      height: "120px",
      left: "110px",
      position: "absolute",
      top: "70px",
      width: "220px",
    },
  };
  let canonicalStyle = { ...(previewBase.style as Record<string, unknown>) };
  let previewStyle = { ...(previewBase.style as Record<string, unknown>) };
  let terminalEventCount = 0;
  const runtime = new EditorPresentationTransactionRuntime({
    commit: ({ descriptor }) => {
      if (descriptor.type !== "style.patch") {
        throw new Error("text metric harness requires style patch");
      }
      canonicalStyle = { ...canonicalStyle, ...descriptor.patch };
      return { committedDocumentRevision: 2 };
    },
    hasTarget: () => true,
    isDescriptorEqualToBase: () => false,
    readDocumentVersion: () => 1,
    readTargetValue: () => previewBase.style,
    scheduler,
  });
  runtime.subscribeSessionEvents((event) => {
    if (event.type === "updated") {
      const descriptor = event.session.applied?.descriptor;
      if (!descriptor || descriptor.type !== "style.patch") return;
      bridge.applyPresentationStylePatch(TEXT_ID, descriptor.patch);
      previewStyle = (resolvePresentationTextMetricProps(
        previewBase,
        [descriptor],
        "Text",
      ).style ?? {}) as Record<string, unknown>;
      return;
    }

    terminalEventCount += 1;
    bridge.restorePresentationStylePatch(TEXT_ID);
    if (
      event.result.status === "committed" &&
      event.finalDescriptor?.type === "style.patch"
    ) {
      const patch = event.finalDescriptor.patch;
      const text = node.text!;
      if (typeof patch.fontSize === "number") text.fontSize = patch.fontSize;
      if (typeof patch.fontWeight === "number") {
        text.fontWeight = patch.fontWeight;
      }
      previewStyle = {
        ...(previewBase.style as Record<string, unknown>),
        ...(typeof patch.fontSize === "number"
          ? { fontSize: `${patch.fontSize}px` }
          : {}),
        ...(typeof patch.fontWeight === "number"
          ? { fontWeight: patch.fontWeight }
          : {}),
      };
    } else {
      previewStyle = { ...(previewBase.style as Record<string, unknown>) };
    }
  });
  Object.defineProperty(runtime, "readHarnessSnapshot", {
    value: (): HarnessSnapshot => ({
      canonicalStyle: { ...canonicalStyle },
      consoleErrorCount,
      geometry: {
        height: node.height,
        left: node.x,
        top: node.y,
        width: node.width,
      },
      paragraphKey: getTextParagraphCacheKey(node),
      previewStyle: { ...previewStyle },
      skiaFontSize: node.text?.fontSize ?? 0,
      skiaFontWeight: node.text?.fontWeight,
      terminalEventCount,
    }),
  });
  return { bridge, node, previewBase, runtime, scheduler };
}

let consoleErrorCount = 0;

describe("ADR-187 Text metric populated fixture harness", () => {
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
    clearSkiaRegistry();
  });

  it.each([
    ["fontSize", 18, "18px"],
    ["fontWeight", 700, 700],
  ] as const)(
    "keeps Preview/Skia paragraph and rect parity on cancel for %s",
    (property, value, previewValue) => {
      const canonical = makeCanonicalNode();
      setupDocument(canonical);
      const pilotNode = makeSkiaNode();
      registerSkiaNode(TEXT_ID, pilotNode);
      expect(
        resolveTextMetricPresentationPilotTarget(TEXT_ID, property),
      ).not.toBeNull();
      clearSkiaRegistry();

      const harness = createHarness();
      const target = { kind: "canonical-node" as const, nodeId: TEXT_ID };
      const readSnapshot = (): HarnessSnapshot =>
        (
          harness.runtime as unknown as {
            readHarnessSnapshot: () => HarnessSnapshot;
          }
        ).readHarnessSnapshot();
      const before = readSnapshot();
      const handle = harness.runtime.beginEditorPresentation({
        commitIntent: "style-text-metrics",
        ownerId: "adr187-text-metric-harness",
        projectId: PROJECT_ID,
        targets: [target],
      });
      handle.publish({
        patch: { [property]: value },
        target,
        type: "style.patch",
      });
      harness.scheduler.flush();
      const during = readSnapshot();
      handle.cancel("pointer-cancel");
      const after = readSnapshot();

      expect(during.canonicalStyle).toEqual(before.canonicalStyle);
      expect(during.previewStyle[property]).toBe(previewValue);
      expect(during.geometry).toEqual(before.geometry);
      expect(during.paragraphKey).not.toBe(before.paragraphKey);
      if (property === "fontSize") {
        expect(during.skiaFontSize).toBe(18);
        expect(during.skiaFontWeight).toBe(400);
      } else {
        expect(during.skiaFontSize).toBe(16);
        expect(during.skiaFontWeight).toBe(700);
      }
      expect(after.canonicalStyle).toEqual(before.canonicalStyle);
      expect(after.previewStyle).toEqual(before.previewStyle);
      expect(after.geometry).toEqual(before.geometry);
      expect(after.paragraphKey).toBe(before.paragraphKey);
      expect(after.skiaFontSize).toBe(before.skiaFontSize);
      expect(after.skiaFontWeight).toBe(before.skiaFontWeight);
      expect(after.consoleErrorCount).toBe(0);
      expect(after.terminalEventCount).toBe(1);
    },
  );
});
