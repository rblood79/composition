// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FillType, type FillItem } from "../../types/builder/fill.types";
import { StoreRenderBridge } from "../workspace/canvas/skia/StoreRenderBridge";
import { isVolatileNode } from "../workspace/canvas/skia/nodePictureCache";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import {
  EditorPresentationTransactionRuntime,
  type EditorPresentationFrameScheduler,
} from "./editorPresentationRuntime";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";
import { SkiaEditorPresentationBridge } from "./skiaEditorPresentationBridge";

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

function createScheduler(): EditorPresentationFrameScheduler & {
  flush(): void;
} {
  let callback: ((timestamp: number) => void) | null = null;
  return {
    cancel: () => {
      callback = null;
    },
    flush: () => {
      const pending = callback;
      callback = null;
      pending?.(0);
    },
    request: (next) => {
      callback = next;
      return 1;
    },
  };
}

function createNode(): SkiaNodeData {
  const box: NonNullable<SkiaNodeData["box"]> = {
    borderRadius: 0,
    fillColor: Float32Array.of(0, 0, 0, 1),
  };
  return {
    box,
    height: 40,
    presentationFillTargets: [{ color: box.fillColor, opacityMultiplier: 1 }],
    type: "box",
    visible: true,
    width: 80,
    x: 0,
    y: 0,
  };
}

function createBorderNode(): SkiaNodeData {
  const node = createNode();
  const strokeColor = Float32Array.of(0.1, 0.2, 0.3, 1);
  node.box!.strokeColor = strokeColor;
  node.presentationStrokeTargets = [{ color: strokeColor }];
  return node;
}

function replaceNodeBox(node: SkiaNodeData, fillColor: Float32Array): void {
  const box: NonNullable<SkiaNodeData["box"]> = {
    borderRadius: 0,
    fillColor,
  };
  node.box = box;
  node.presentationFillTargets = [
    { color: box.fillColor, opacityMultiplier: 1 },
  ];
}

describe("SkiaEditorPresentationBridge canonical handoff", () => {
  beforeEach(() => clearSkiaRegistry());
  afterEach(() => clearSkiaRegistry());

  it("finish final overlay를 canonical renderer input 도착까지 유지한다", () => {
    const scheduler = createScheduler();
    const node = createNode();
    registerSkiaNode("node-1", node);
    let documentVersion = 1;
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => {
        documentVersion += 1;
        return { committedDocumentRevision: documentVersion };
      },
      readDocumentVersion: () => documentVersion,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["node-1"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    handle.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    scheduler.flush();

    handle.finish({
      fills: [fill("#0000FFFF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });

    expect(node.box?.fillColor).toEqual(Float32Array.of(0, 0, 1, 1));
    expect(isVolatileNode("node-1")).toBe(true);

    replaceNodeBox(node, Float32Array.of(0, 0, 1, 1));
    presentationBridge.handleStoreSync(documentVersion);

    expect(node.box?.fillColor).toEqual(Float32Array.of(0, 0, 1, 1));
    expect(isVolatileNode("node-1")).toBe(false);
    presentationBridge.dispose();
  });

  it("style borderColor session은 Skia stroke slot만 patch하고 cancel에서 복원한다", () => {
    const scheduler = createScheduler();
    const node = createBorderNode();
    const baseStrokeColor = node.box!.strokeColor!;
    registerSkiaNode("border-node", node);
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: (_projectId, _target, commitIntent) =>
        commitIntent?.startsWith("style-")
          ? { borderColor: "#1A334D" }
          : [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["border-node"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-border-color",
      ownerId: "owner-border",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "border-node" }],
    });
    handle.publish({
      patch: { borderColor: "#FF000080" },
      target: { kind: "canonical-node", nodeId: "border-node" },
      type: "style.patch",
    });
    scheduler.flush();

    expect(node.box!.strokeColor).toEqual(Float32Array.of(1, 0, 0, 128 / 255));
    handle.cancel("pointer-cancel");
    expect(node.box!.strokeColor).toBe(baseStrokeColor);
    presentationBridge.dispose();
  });

  it("explicit opacity:1은 실제 Skia bridge에서 presentation slot을 materialize하고 terminal handoff한다", () => {
    const scheduler = createScheduler();
    const node = createNode();
    node.effects = undefined;
    registerSkiaNode("opacity-default-node", node);
    let documentVersion = 1;
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => {
        documentVersion += 1;
        return { committedDocumentRevision: documentVersion };
      },
      readDocumentVersion: () => documentVersion,
      readTargetValue: () => ({ opacity: 1 }),
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["opacity-default-node"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const target = {
      kind: "canonical-node" as const,
      nodeId: "opacity-default-node",
    };
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-opacity",
      ownerId: "owner-opacity",
      projectId: "project-1",
      targets: [target],
    });

    handle.publish({
      patch: { opacity: "0.42" },
      target,
      type: "style.patch",
    });
    scheduler.flush();

    expect(node.effects).toEqual([
      { type: "opacity", value: 0.42, source: "presentation" },
    ]);
    expect(isVolatileNode("opacity-default-node")).toBe(true);

    expect(
      handle.finish({
        patch: { opacity: "0.42" },
        target,
        type: "style.patch",
      }).status,
    ).toBe("committed");
    expect(node.effects).toEqual([
      { type: "opacity", value: 0.42, source: "presentation" },
    ]);

    node.effects = [{ type: "opacity", value: 0.42, source: "style" }];
    presentationBridge.handleStoreSync(documentVersion);
    expect(node.effects).toEqual([
      { type: "opacity", value: 0.42, source: "style" },
    ]);
    expect(isVolatileNode("opacity-default-node")).toBe(false);
    presentationBridge.dispose();
  });

  it("cancel은 document revision이 그대로면 캡처한 base를 즉시 복원한다", () => {
    const scheduler = createScheduler();
    const node = createNode();
    const baseFillColor = node.box!.fillColor;
    registerSkiaNode("node-1", node);
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["node-1"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    handle.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    scheduler.flush();

    handle.cancel("pointer-cancel");

    expect(node.box?.fillColor).toBe(baseFillColor);
    expect(isVolatileNode("node-1")).toBe(false);
    presentationBridge.dispose();
  });

  it("partial commit failure 뒤 cancel은 handoff로 오인하지 않고 ownership을 정리한다", () => {
    const scheduler = createScheduler();
    const node = createNode();
    const baseFillColor = node.box!.fillColor;
    registerSkiaNode("node-1", node);
    let documentVersion = 1;
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => {
        documentVersion += 1;
        throw new Error("history failed after canonical stage");
      },
      readDocumentVersion: () => documentVersion,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["node-1"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    handle.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    scheduler.flush();

    expect(
      handle.finish({
        fills: [fill("#0000FFFF")],
        target: { kind: "canonical-node", nodeId: "node-1" },
        type: "fills.replace",
      }).status,
    ).toBe("failed");
    expect(isVolatileNode("node-1")).toBe(true);

    handle.cancel("unmount");

    expect(node.box?.fillColor).toBe(baseFillColor);
    expect(isVolatileNode("node-1")).toBe(false);
    presentationBridge.dispose();
  });

  it("active drag 중 store full resync로 box가 교체되면 overlay를 즉시 재적용한다", () => {
    const scheduler = createScheduler();
    const node = createNode();
    registerSkiaNode("node-1", node);
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => ["node-1"] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    handle.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    scheduler.flush();

    replaceNodeBox(node, Float32Array.of(0, 0, 0, 1));
    presentationBridge.handleStoreSync(1);

    expect(node.box?.fillColor).toEqual(Float32Array.of(1, 0, 0, 1));
    expect(isVolatileNode("node-1")).toBe(true);
    handle.cancel("unmount");
    presentationBridge.dispose();
  });

  it("store sync에서 semantic target을 최신 visible projection으로 다시 해석한다", () => {
    const scheduler = createScheduler();
    const firstNode = createNode();
    const secondNode = createNode();
    registerSkiaNode("node-a", firstNode);
    registerSkiaNode("node-b", secondNode);
    let visibleRenderId = "node-a";
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve: () => [visibleRenderId] }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "canonical-node" }],
    });
    handle.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "canonical-node" },
      type: "fills.replace",
    });
    scheduler.flush();
    expect(firstNode.box?.fillColor).toEqual(Float32Array.of(1, 0, 0, 1));

    visibleRenderId = "node-b";
    presentationBridge.handleStoreSync(1);

    expect(firstNode.box?.fillColor).toEqual(Float32Array.of(0, 0, 0, 1));
    expect(isVolatileNode("node-a")).toBe(false);
    expect(secondNode.box?.fillColor).toEqual(Float32Array.of(1, 0, 0, 1));
    expect(isVolatileNode("node-b")).toBe(true);
    handle.cancel("unmount");
    presentationBridge.dispose();
  });

  it("한 session publish는 다른 active session을 재스캔하지 않고 자기 k만 갱신한다", () => {
    const scheduler = createScheduler();
    const firstNode = createNode();
    const secondNode = createNode();
    registerSkiaNode("node-1", firstNode);
    registerSkiaNode("node-2", secondNode);
    const resolve = vi.fn((target: EditorPresentationTargetRef) =>
      target.kind === "canonical-node" ? [target.nodeId] : [],
    );
    const runtime = new EditorPresentationTransactionRuntime({
      commit: () => ({ committedDocumentRevision: 2 }),
      readDocumentVersion: () => 1,
      readTargetValue: () => [fill("#000000FF")],
      scheduler,
    });
    const storeBridge = new StoreRenderBridge();
    const presentationBridge = new SkiaEditorPresentationBridge({
      getActiveProjectId: () => "project-1",
      getProjectionIndex: () => ({ resolve }),
      getStoreRenderBridge: () => storeBridge,
      onPaintInvalidated: () => undefined,
      runtime,
    });
    const first = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-1",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-1" }],
    });
    const second = runtime.beginEditorPresentation({
      commitIntent: "fill-color",
      ownerId: "owner-2",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: "node-2" }],
    });
    first.publish({
      fills: [fill("#FF0000FF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    second.publish({
      fills: [fill("#00FF00FF")],
      target: { kind: "canonical-node", nodeId: "node-2" },
      type: "fills.replace",
    });
    scheduler.flush();
    resolve.mockClear();

    first.publish({
      fills: [fill("#0000FFFF")],
      target: { kind: "canonical-node", nodeId: "node-1" },
      type: "fills.replace",
    });
    scheduler.flush();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({
      kind: "canonical-node",
      nodeId: "node-1",
    });
    expect(firstNode.box?.fillColor).toEqual(Float32Array.of(0, 0, 1, 1));
    expect(secondNode.box?.fillColor).toEqual(Float32Array.of(0, 1, 0, 1));
    first.cancel("unmount");
    second.cancel("unmount");
    presentationBridge.dispose();
  });
});
