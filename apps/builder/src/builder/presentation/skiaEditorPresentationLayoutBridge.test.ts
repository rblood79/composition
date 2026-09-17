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
import {
  SkiaEditorPresentationLayoutBridge,
  type PresentationLayoutComputeRequest,
} from "./skiaEditorPresentationLayoutBridge";
import {
  resetLayoutReceiptsForTest,
  subscribeLayoutReceipts,
  type PresentationLayoutReceipt,
} from "./editorPresentationLayoutReceipt";

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
  const sibling = makeNode("layout-sibling", body.id, "absolute");
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
  registerSkiaNode(sibling.id, {
    elementId: sibling.id,
    type: "container",
    visible: true,
    width: 80,
    height: 40,
    x: 300,
    y: 40,
  } as never);
  const childrenMap = new Map([[body.id, [target, sibling]]]);
  const layoutMap = new Map<string, ComputedLayout>([
    [body.id, { x: 0, y: 0, width: 800, height: 600 } as ComputedLayout],
    [target.id, { x: 10, y: 20, width: 120, height: 80 } as ComputedLayout],
    [sibling.id, { x: 300, y: 40, width: 80, height: 40 } as ComputedLayout],
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
  return { body, target, sibling, childrenMap, layoutMap };
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
  resetLayoutReceiptsForTest();
});

describe("SkiaEditorPresentationLayoutBridge", () => {
  it("absolute left/top만 subtree draw/hit patch로 승격한다", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === target.id
          ? target
          : nodeId === "layout-body"
            ? body
            : nodeId === "layout-sibling"
              ? sibling
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
    expect(
      window.__composition_RENDER_COMMAND_DEBUG__?.readNode(target.id),
    ).toMatchObject({
      available: true,
      baseCanonicalRevision: 7,
      bounds: { x: 50, y: 60 },
      hitBounds: { x: 50, y: 60 },
    });
    expect(stream.presentationRevisionByRootKey.get("page-1")).toBe(1);
    bridge.dispose();
  });

  it("absolute leaf width/height는 targeted patch로 승격한다", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === target.id
          ? target
          : nodeId === "layout-body"
            ? body
            : nodeId === "layout-sibling"
              ? sibling
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
      patch: { width: 200, height: 90 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    const siblingBoundsBefore = getCachedCommandStreamSnapshot()!.boundsMap.get(
      sibling.id,
    );
    scheduler.flush();

    expect(onPatched).toHaveBeenCalledTimes(1);
    expect(
      getCachedCommandStreamSnapshot()!.boundsMap.get(target.id),
    ).toMatchObject({ x: 10, y: 20, width: 200, height: 90 });
    expect(getCachedCommandStreamSnapshot()!.boundsMap.get(sibling.id)).toBe(
      siblingBoundsBefore,
    );
    bridge.dispose();
  });

  it("in-flow width는 parent와 sibling을 atomic targeted publication으로 갱신한다", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const staticTarget = makeNode(target.id, body.id, "static");
    const staticSibling = makeNode(sibling.id, body.id, "static");
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const computeTargetedLayout = vi.fn(
      (input: PresentationLayoutComputeRequest) => {
        expect(input.roots).toEqual([body.id]);
        expect(input.affectedNodeIds).toEqual(
          new Set([body.id, target.id, sibling.id]),
        );
        const hasSpacingPatch =
          input.descriptor.type === "style.patch" &&
          Object.keys(input.descriptor.patch).some((key) =>
            [
              "padding",
              "paddingTop",
              "paddingRight",
              "paddingBottom",
              "paddingLeft",
              "gap",
              "rowGap",
              "columnGap",
            ].includes(key),
          );
        return new Map<string, ComputedLayout>([
          [
            body.id,
            { elementId: body.id, x: 0, y: 0, width: 800, height: 600 },
          ],
          [
            target.id,
            {
              elementId: target.id,
              x: 10,
              y: 20,
              width: hasSpacingPatch ? 184 : 180,
              height: 80,
            },
          ],
          [
            sibling.id,
            {
              elementId: sibling.id,
              x: hasSpacingPatch ? 194 : 190,
              y: 20,
              width: 80,
              height: 40,
            },
          ],
        ]);
      },
    );
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === body.id
          ? body
          : nodeId === target.id
            ? staticTarget
            : nodeId === sibling.id
              ? staticSibling
              : undefined,
      computeTargetedLayout,
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
      patch: { width: 180 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    scheduler.flush();

    expect(computeTargetedLayout).toHaveBeenCalledTimes(1);
    expect(onPatched).toHaveBeenCalledTimes(1);
    const stream = getCachedCommandStreamSnapshot()!;
    expect(stream.boundsMap.get(target.id)).toMatchObject({ width: 180 });
    expect(stream.boundsMap.get(sibling.id)).toMatchObject({ x: 190 });
    expect(stream.hitBoundsMap.get(sibling.id)).toMatchObject({ x: 190 });

    handle.publish({
      patch: { padding: 12 },
      target: { kind: "canonical-node", nodeId: target.id },
      type: "style.patch",
    });
    scheduler.flush();
    expect(computeTargetedLayout).toHaveBeenCalledTimes(2);
    expect(
      getCachedCommandStreamSnapshot()!.hitBoundsMap.get(sibling.id),
    ).toMatchObject({ x: 194 });
    bridge.dispose();
  });

  it("targeted engine이 없으면 in-flow/문자열/spacing은 commit-only로 fail-closed한다", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const inFlowTarget = makeNode(target.id, "layout-body", "static");
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === target.id
          ? inFlowTarget
          : nodeId === "layout-body"
            ? body
            : nodeId === "layout-sibling"
              ? makeNode(sibling.id, body.id, "static")
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
    for (const patch of [
      { width: 200 },
      { padding: 12 },
      { gap: 12 },
      { width: "200px" },
    ]) {
      handle.publish({
        patch,
        target: { kind: "canonical-node", nodeId: target.id },
        type: "style.patch",
      });
      scheduler.flush();
    }

    expect(onPatched).not.toHaveBeenCalled();
    expect(
      getCachedCommandStreamSnapshot()!.boundsMap.get(target.id),
    ).toMatchObject({ x: 10, y: 20, width: 120, height: 80 });
    bridge.dispose();
  });

  // ADR-222 m2: session.applied 는 계산 요청일 뿐이다. 실제 targeted 계산·command
  // patch 성공 경계에서만 published receipt 가 나오고, 계산 null / patch 거부 /
  // canonical revision 불일치는 같은 descriptor revision 으로 rejected 가 나온다.
  it("publishes a layout receipt per descriptor revision and rejects failed spacing frames (ADR-222 m2)", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const staticTarget = makeNode(target.id, body.id, "static");
    const staticSibling = makeNode(sibling.id, body.id, "static");
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const receipts: PresentationLayoutReceipt[] = [];
    const unsubscribe = subscribeLayoutReceipts((receipt) =>
      receipts.push(receipt),
    );
    let computeResult: ReadonlyMap<string, ComputedLayout> | null = new Map<
      string,
      ComputedLayout
    >([
      [body.id, { elementId: body.id, x: 0, y: 0, width: 800, height: 600 }],
      [
        target.id,
        { elementId: target.id, x: 10, y: 20, width: 184, height: 80 },
      ],
      [
        sibling.id,
        { elementId: sibling.id, x: 194, y: 20, width: 80, height: 40 },
      ],
    ]);
    let canonicalRevision = 7;
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => canonicalRevision,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === body.id
          ? body
          : nodeId === target.id
            ? staticTarget
            : nodeId === sibling.id
              ? staticSibling
              : undefined,
      computeTargetedLayout: () => computeResult,
      onPatched: vi.fn(),
      runtime,
    });
    const handle = runtime.beginEditorPresentation({
      commitIntent: "style-layout-spacing",
      ownerId: "spacing-test",
      projectId: "project-1",
      targets: [{ kind: "canonical-node", nodeId: target.id }],
    });
    const targetRef = { kind: "canonical-node", nodeId: target.id } as const;

    handle.publish({
      patch: { paddingTop: 12 },
      target: targetRef,
      type: "style.patch",
    });
    scheduler.flush();
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      sessionId: handle.sessionId,
      descriptorRevision: 1,
      baseCanonicalRevision: 7,
      rootKey: "page-1",
      result: "published",
    });
    expect(
      receipts[0].result === "published" &&
        typeof receipts[0].layoutPublicationRevision,
    ).toBe("number");

    // 두 번째 계산이 null → rejected (같은 sessionId, descriptorRevision 2)
    computeResult = null;
    handle.publish({
      patch: { paddingTop: 20 },
      target: targetRef,
      type: "style.patch",
    });
    scheduler.flush();
    expect(receipts).toHaveLength(2);
    expect(receipts[1]).toMatchObject({
      sessionId: handle.sessionId,
      descriptorRevision: 2,
      result: "rejected",
      reason: "compute-null",
    });

    // canonical revision 교체 → rejected
    computeResult = new Map(computeResult ?? []);
    computeResult = new Map<string, ComputedLayout>([
      [body.id, { elementId: body.id, x: 0, y: 0, width: 800, height: 600 }],
      [
        target.id,
        { elementId: target.id, x: 10, y: 20, width: 190, height: 80 },
      ],
      [
        sibling.id,
        { elementId: sibling.id, x: 200, y: 20, width: 80, height: 40 },
      ],
    ]);
    canonicalRevision = 9;
    handle.publish({
      patch: { paddingTop: 24 },
      target: targetRef,
      type: "style.patch",
    });
    scheduler.flush();
    expect(receipts).toHaveLength(3);
    expect(receipts[2]).toMatchObject({
      descriptorRevision: 3,
      result: "rejected",
      reason: "canonical-revision-mismatch",
    });

    unsubscribe();
    bridge.dispose();
  });
  it("cancel terminal event는 canonical layout으로 local handoff한다", () => {
    const { body, target, sibling, childrenMap, layoutMap } = primeStream();
    const scheduler = createScheduler();
    const runtime = createRuntime(scheduler);
    const onPatched = vi.fn();
    const bridge = new SkiaEditorPresentationLayoutBridge({
      getActiveProjectId: () => "project-1",
      getCanonicalRevision: () => 7,
      getChildrenMap: () => childrenMap,
      getLayoutMap: () => layoutMap,
      getRenderNode: (nodeId) =>
        nodeId === target.id
          ? target
          : nodeId === "layout-body"
            ? body
            : nodeId === "layout-sibling"
              ? sibling
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
