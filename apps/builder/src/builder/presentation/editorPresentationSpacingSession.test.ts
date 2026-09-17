// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  getCachedCommandStream,
  getCachedCommandStreamSnapshot,
  invalidateCommandStreamCache,
} from "../workspace/canvas/skia/renderCommands";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import { SkiaEditorPresentationLayoutBridge } from "./skiaEditorPresentationLayoutBridge";
import { resetLayoutReceiptsForTest } from "./editorPresentationLayoutReceipt";
import type { SpacingCapability } from "./editorPresentationSpacingCapability";
import {
  SpacingPresentationSession,
  getActiveSpacingSession,
  setActiveSpacingSession,
} from "./editorPresentationSpacingSession";

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

function makeNode(id: string, parentId: string | null): CanvasSceneNode {
  const style = id === "sp-target" ? { display: "flex" } : {};
  const sourceNode = {
    id,
    type: id === "sp-body" ? "body" : "Box",
    props: { style },
  } as never;
  return {
    id,
    type: id === "sp-body" ? "body" : "Box",
    page_id: "page-1",
    parent_id: parentId,
    parentId,
    pageId: "page-1",
    props: { style },
    sourceNode,
  } as unknown as CanvasSceneNode;
}

function primeStream() {
  const body = makeNode("sp-body", null);
  const target = makeNode("sp-target", body.id);
  const a = makeNode("sp-a", target.id);
  const b = makeNode("sp-b", target.id);
  const following = makeNode("sp-following", body.id);
  const register = (n: CanvasSceneNode, l: Partial<ComputedLayout>) =>
    registerSkiaNode(n.id, {
      elementId: n.id,
      type: "container",
      visible: true,
      ...l,
    } as never);
  register(body, { x: 0, y: 0, width: 800, height: 600 });
  register(target, { x: 0, y: 0, width: 200, height: 100 });
  register(a, { x: 8, y: 8, width: 50, height: 40 });
  register(b, { x: 8, y: 56, width: 50, height: 40 });
  register(following, { x: 0, y: 100, width: 50, height: 40 });
  const childrenMap = new Map([
    [body.id, [target, following]],
    [target.id, [a, b]],
  ]);
  const layoutMap = new Map<string, ComputedLayout>([
    [body.id, { x: 0, y: 0, width: 800, height: 600 } as ComputedLayout],
    [target.id, { x: 0, y: 0, width: 200, height: 100 } as ComputedLayout],
    [a.id, { x: 8, y: 8, width: 50, height: 40 } as ComputedLayout],
    [b.id, { x: 8, y: 56, width: 50, height: 40 } as ComputedLayout],
    [following.id, { x: 0, y: 100, width: 50, height: 40 } as ComputedLayout],
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
  const nodes = new Map([
    [body.id, body],
    [target.id, target],
    [a.id, a],
    [b.id, b],
    [following.id, following],
  ]);
  return { body, target, a, b, following, childrenMap, layoutMap, nodes };
}

function capability(): SpacingCapability {
  return {
    projectId: "project-1",
    target: { kind: "canonical-node", nodeId: "sp-target" },
    rootKey: "page-1",
    nodeType: "Box",
    border: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: {
      supported: true,
      values: { top: 8, right: 8, bottom: 8, left: 8 },
      rawSides: new Set(),
    },
    gap: {
      supported: true,
      property: "rowGap",
      axis: "vertical",
      reverse: false,
      value: 8,
      flowChildIds: ["sp-a", "sp-b"],
    },
    rawStyle: { display: "flex", flexDirection: "column" },
  };
}

interface Harness {
  scheduler: ReturnType<typeof createScheduler>;
  runtime: EditorPresentationTransactionRuntime;
  bridge: SkiaEditorPresentationLayoutBridge;
  commit: ReturnType<typeof vi.fn>;
  compute: ReturnType<typeof vi.fn>;
  setComputeResult: (value: ReadonlyMap<string, ComputedLayout> | null) => void;
  timeouts: Array<() => void>;
}

function createHarness(): Harness {
  const prime = primeStream();
  const scheduler = createScheduler();
  const commit = vi.fn(() => ({ committedDocumentRevision: 8 }));
  const runtime = new EditorPresentationTransactionRuntime({
    commit,
    readDocumentVersion: () => 1,
    readTargetValue: () => ({ display: "flex", flexDirection: "column" }),
    scheduler,
  });
  let computeResult: ReadonlyMap<string, ComputedLayout> | null = null;
  const compute = vi.fn(
    (input: { descriptor: { patch: Record<string, unknown> } }) => {
      if (computeResult) return computeResult;
      const patch = input.descriptor.patch;
      const pad = Number(patch.paddingTop ?? 8);
      const gap = Number(patch.rowGap ?? 8);
      const targetHeight = pad + 40 + gap + 40 + 8;
      return new Map<string, ComputedLayout>([
        [
          prime.body.id,
          { elementId: "sp-body", x: 0, y: 0, width: 800, height: 600 },
        ],
        [
          prime.target.id,
          {
            elementId: "sp-target",
            x: 0,
            y: 0,
            width: 200,
            height: targetHeight,
          },
        ],
        [
          prime.a.id,
          { elementId: "sp-a", x: 8, y: pad, width: 50, height: 40 },
        ],
        [
          prime.b.id,
          { elementId: "sp-b", x: 8, y: pad + 40 + gap, width: 50, height: 40 },
        ],
        [
          prime.following.id,
          {
            elementId: "sp-following",
            x: 0,
            y: targetHeight,
            width: 50,
            height: 40,
          },
        ],
      ]);
    },
  );
  const bridge = new SkiaEditorPresentationLayoutBridge({
    getActiveProjectId: () => "project-1",
    getCanonicalRevision: () => 7,
    getChildrenMap: () => prime.childrenMap,
    getLayoutMap: () => prime.layoutMap,
    getRenderNode: (id) => prime.nodes.get(id),
    computeTargetedLayout: compute as never,
    onPatched: vi.fn(),
    runtime,
  });
  const timeouts: Array<() => void> = [];
  return {
    scheduler,
    runtime,
    bridge,
    commit,
    compute,
    setComputeResult: (value) => {
      computeResult = value;
    },
    timeouts,
  };
}

const scheduleTimeout =
  (timeouts: Array<() => void>) =>
  (fn: () => void): (() => void) => {
    timeouts.push(fn);
    return () => {
      const index = timeouts.indexOf(fn);
      if (index >= 0) timeouts.splice(index, 1);
    };
  };

afterEach(() => {
  setActiveSpacingSession(null);
  invalidateCommandStreamCache();
  clearSkiaRegistry();
  resetLayoutReceiptsForTest();
});

describe("SpacingPresentationSession (ADR-222 G0 first-nail)", () => {
  it("padding drag: start value → publish → receipt-confirmed value → finish commits px patch once (hug parent + following sibling move)", async () => {
    const h = createHarness();
    const session = new SpacingPresentationSession({
      capability: capability(),
      kind: "padding",
      sides: ["top"],
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    expect(session.getSnapshot().startValues).toEqual({ paddingTop: 8 });

    expect(session.setDelta(12)).toBe(true);
    // 프레임 flush 전 — 요청값만 바뀌고 확정값은 시작값
    expect(session.getSnapshot().requestedValues).toEqual({ paddingTop: 20 });
    expect(session.getSnapshot().confirmedValues).toEqual({ paddingTop: 8 });
    expect(h.commit).not.toHaveBeenCalled();

    h.scheduler.flush();
    expect(h.compute).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().confirmedValues).toEqual({ paddingTop: 20 });
    expect(session.getSnapshot().confirmedPublicationRevision).not.toBeNull();
    // 형제 following 이 hug 높이 증가만큼 이동 — h1 반증 (mock 엔진: 8+40+gap+40+8 = 104 → pad 20 이면 116).
    // 실제 엔진 대조는 Phase 3 live (G1) 에서 Preview DOM rect 로 한다.
    const stream = getCachedCommandStreamSnapshot()!;
    expect(stream.boundsMap.get("sp-target")).toMatchObject({ height: 116 });
    expect(stream.boundsMap.get("sp-following")).toMatchObject({ y: 116 });
    expect(stream.hitBoundsMap.get("sp-following")).toMatchObject({ y: 116 });

    const result = await session.finish();
    expect(result).toEqual({
      status: "committed",
      committedDocumentRevision: 8,
    });
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.commit.mock.calls[0][0]).toMatchObject({
      descriptor: {
        type: "style.patch",
        patch: { paddingTop: "20px" },
        target: { kind: "canonical-node", nodeId: "sp-target" },
      },
    });
    expect(session.phase).toBe("closed");
    h.bridge.dispose();
  });

  it("gap drag on the axis property with clamp at 0 and no-op finish when back at start", async () => {
    const h = createHarness();
    const session = new SpacingPresentationSession({
      capability: capability(),
      kind: "gap",
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    expect(session.properties).toEqual(["rowGap"]);
    session.setDelta(-30);
    expect(session.getSnapshot().requestedValues).toEqual({ rowGap: 0 });
    h.scheduler.flush();
    expect(session.getSnapshot().confirmedValues).toEqual({ rowGap: 0 });

    session.setDelta(0);
    h.scheduler.flush();
    const result = await session.finish();
    expect(result).toEqual({ status: "no-op" });
    expect(h.commit).not.toHaveBeenCalled();
    h.bridge.dispose();
  });

  it("two-side padding keeps the asymmetric difference and clamps the shared delta", async () => {
    const h = createHarness();
    const cap = capability();
    const session = new SpacingPresentationSession({
      capability: {
        ...cap,
        padding: {
          supported: true,
          values: { top: 8, right: 20, bottom: 8, left: 4 },
          rawSides: new Set(),
        },
      },
      kind: "padding",
      sides: ["left", "right"],
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    session.setDelta(-10);
    expect(session.getSnapshot().requestedValues).toEqual({
      paddingLeft: 0,
      paddingRight: 16,
    });
    h.scheduler.flush();
    const result = await session.finish();
    expect(result.status).toBe("committed");
    expect(h.commit.mock.calls[0][0]).toMatchObject({
      descriptor: { patch: { paddingLeft: "0px", paddingRight: "16px" } },
    });
    h.bridge.dispose();
  });

  it("waits for the final receipt before finish and cancels (commit 0) on a rejected frame", async () => {
    const h = createHarness();
    const session = new SpacingPresentationSession({
      capability: capability(),
      kind: "padding",
      sides: ["top"],
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    session.setDelta(4);
    h.scheduler.flush();
    expect(session.getSnapshot().confirmedValues).toEqual({ paddingTop: 12 });

    // pointerup 직전 마지막 이동 — 아직 flush 되지 않은 상태로 finish
    session.setDelta(10);
    h.setComputeResult(null);
    const pending = session.finish();
    expect(session.phase).toBe("finalizing");
    expect(h.commit).not.toHaveBeenCalled();

    // 마지막 frame 의 계산이 실패 → rejected receipt → cancel
    h.compute.mockImplementationOnce(() => null);
    h.scheduler.flush();
    const result = await pending;
    expect(result).toEqual({ status: "cancelled", reason: "conflict" });
    expect(h.commit).not.toHaveBeenCalled();
    expect(session.lastRejectReason).toBe("compute-null");
    h.bridge.dispose();
  });

  it("cancels without commit when the final receipt never arrives (1s limit)", async () => {
    const h = createHarness();
    const session = new SpacingPresentationSession({
      capability: capability(),
      kind: "padding",
      sides: ["top"],
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    session.setDelta(6);
    const pending = session.finish();
    expect(h.timeouts).toHaveLength(1);
    h.timeouts[0]();
    const result = await pending;
    expect(result).toEqual({ status: "cancelled", reason: "conflict" });
    expect(h.commit).not.toHaveBeenCalled();
    h.bridge.dispose();
  });

  it("Escape cancel writes nothing and clears the active registry", () => {
    const h = createHarness();
    const session = new SpacingPresentationSession({
      capability: capability(),
      kind: "padding",
      sides: ["top", "right", "bottom", "left"],
      ownerId: "canvas-spacing",
      runtime: h.runtime,
      scheduleTimeout: scheduleTimeout(h.timeouts),
    });
    setActiveSpacingSession(session);
    session.setDelta(5);
    h.scheduler.flush();
    expect(session.cancel("escape")).toBe(true);
    expect(session.phase).toBe("closed");
    expect(getActiveSpacingSession()).toBeNull();
    expect(h.commit).not.toHaveBeenCalled();
    // 취소 후 canonical layout 으로 복원 (bridge restore)
    expect(
      getCachedCommandStreamSnapshot()!.boundsMap.get("sp-following"),
    ).toMatchObject({ y: 100 });
    h.bridge.dispose();
  });
});
