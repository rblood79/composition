// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  getCachedCommandStream,
  getCachedCommandStreamSnapshot,
  getSceneBounds,
  invalidateCommandStreamCache,
} from "../workspace/canvas/skia/renderCommands";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import { SkiaEditorPresentationLayoutBridge } from "./skiaEditorPresentationLayoutBridge";

function createScheduler() {
  const callbacks: Array<(timestamp: number) => void> = [];
  return {
    request(callback: (timestamp: number) => void) {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancel() {},
    flush() {
      for (const callback of callbacks.splice(0)) callback(0);
    },
  };
}

function makeNode(
  id: string,
  parentId: string | null,
  position?: string,
): CanvasSceneNode {
  const sourceNode = {
    id,
    type: id === "layout-body" ? "body" : "Box",
    props: { style: position ? { position } : {} },
  } as never;
  return {
    id,
    type: id === "layout-body" ? "body" : "Box",
    page_id: "page-1",
    parent_id: parentId,
    parentId,
    pageId: "page-1",
    props: { style: position ? { position } : {} },
    sourceNode,
  } as unknown as CanvasSceneNode;
}

function primeStream() {
  const body = makeNode("layout-body", null);
  const target = makeNode("layout-target", body.id, "absolute");
  registerSkiaNode(body.id, {
    elementId: body.id,
    type: "container",
    visible: true,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
  } as never);
  registerSkiaNode(target.id, {
    elementId: target.id,
    type: "container",
    visible: true,
    width: 120,
    height: 80,
    x: 10,
    y: 20,
  } as never);
  const childrenMap = new Map([[body.id, [target]]]);
  const layoutMap = new Map<string, ComputedLayout>([
    [body.id, { x: 0, y: 0, width: 800, height: 600 } as ComputedLayout],
    [target.id, { x: 10, y: 20, width: 120, height: 80 } as ComputedLayout],
  ]);
  getCachedCommandStream(
    [body.id],
    childrenMap,
    layoutMap,
    { [body.id]: { x: 0, y: 0 } },
    101,
    102,
    103,
    7,
    { baseCanonicalRevision: 7 },
  );
  return { body, target, childrenMap, layoutMap };
}

function createRuntime(scheduler: ReturnType<typeof createScheduler>) {
  return new EditorPresentationTransactionRuntime({
    commit: vi.fn(() => ({ committedDocumentRevision: 8 })),
    readDocumentVersion: () => 1,
    readTargetValue: () => null,
    scheduler,
  });
}

afterEach(() => {
  invalidateCommandStreamCache();
  clearSkiaRegistry();
});

describe("SkiaEditorPresentationLayoutBridge", () => {
  it("absolute left/top만 subtree draw/hit patch로 승격한다", () => {
    const { target, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === target.id || nodeId === "layout-body"
          ? nodeId === target.id
            ? target
            : childrenMap.get("layout-body")?.[0]
          : undefined,
      onPatched,
      runtime,
    });

    const handle = runtime.beginEditorPresentation({
      commitIntent: "layout",
      ownerId: "layout-test",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: target.id }],
    });
    handle.publish({
      patch: { left: 50, top: 60 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    scheduler.flush();

    expect(onPatched).toHaveBeenCalledTimes(1);
    const stream = getCachedCommandStreamSnapshot()!;
    expect(stream.boundsMap.get(target.id)).toMatchObject({ x: 50, y: 60 });
    expect(stream.hitBoundsMap.get(target.id)).toMatchObject({ x: 50, y: 60 });
    expect(getSceneBounds(target.id)).toMatchObject({ x: 50, y: 60 });
    expect(stream.presentationRevisionByRootKey.get("page-1")).toBe(1);
    bridge.dispose();
  });

  it("size/문자열/fixed 성격의 unsupported descriptor는 commit-only로 남긴다", () => {
    const { target, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: () => target,
      onPatched,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "layout",
      ownerId: "layout-test",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: target.id }],
    });
    handle.publish({
      patch: { width: 200 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    scheduler.flush();

    expect(onPatched).not.toHaveBeenCalled();
    expect(
      getCachedCommandStreamSnapshot()!.boundsMap.get(target.id),
    ).toMatchObject({ x: 10, y: 20 });
    bridge.dispose();
  });

  it("cancel terminal event는 canonical layout으로 local handoff한다", () => {
    const { target, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: () => target,
      onPatched,
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "layout",
      ownerId: "layout-test",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: target.id }],
    });
    handle.publish({
      patch: { left: 50 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    scheduler.flush();
    handle.cancel("escape");

    expect(onPatched).toHaveBeenCalledTimes(2);
    expect(
      getCachedCommandStreamSnapshot()!.boundsMap.get(target.id),
    ).toMatchObject({ x: 10, y: 20 });
    bridge.dispose();
  });
});
