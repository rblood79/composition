// @vitest-environment jsdom
// ADR-263 Phase 1 — Proxy 없는 명령 읽기: 결과는 Proxy 읽기와 같고, 실행은 Proxy 를 지나지 않는다.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import {
  buildRenderCommandStream,
  createCommandReader,
  createSegmentedCommandBuffer,
  executeRenderCommands,
  replaceCommandRange,
  type RenderCommand,
} from "./renderCommands";
import { resetRenderCounters, snapshotRenderCounters } from "./renderCounters";
import type { SkiaNodeData } from "./nodeRenderers";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

/** 결정적 의사 난수 (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const marker = (n: number) => ({ type: 1, n }) as unknown as RenderCommand;

describe("createCommandReader", () => {
  it("무작위 splice 뒤 앞 · 뒤 · 무작위 순서로 읽어도 Proxy 읽기와 같다 (1,000 건)", () => {
    const random = rng(263);
    let next = 0;
    for (let trial = 0; trial < 1000; trial += 1) {
      const buffer = createSegmentedCommandBuffer(
        Array.from({ length: 1 + Math.floor(random() * 40) }, () =>
          marker(next++),
        ),
      );
      const splices = Math.floor(random() * 6);
      for (let s = 0; s < splices; s += 1) {
        const start = Math.floor(random() * (buffer.length + 1));
        const end = start + Math.floor(random() * (buffer.length - start + 1));
        const replacement = Array.from(
          { length: Math.floor(random() * 8) },
          () => marker(next++),
        );
        replaceCommandRange(buffer, start, end, replacement);
      }
      const expected = Array.from(
        { length: buffer.length },
        (_, i) => buffer[i],
      );
      const read = createCommandReader(buffer);
      const order = [
        ...expected.keys(),
        ...[...expected.keys()].reverse(),
        ...Array.from({ length: expected.length }, () =>
          Math.floor(random() * expected.length),
        ),
      ];
      for (const i of order) expect(read(i)).toBe(expected[i]);
      expect(read(-1)).toBeUndefined();
      expect(read(buffer.length)).toBeUndefined();
    }
  });

  it("평평한 배열은 그대로 읽는다", () => {
    const flat = [marker(1), marker(2)];
    const read = createCommandReader(flat);
    expect(read(1)).toBe(flat[1]);
    expect(read(2)).toBeUndefined();
  });
});

describe("executeRenderCommands — piece-table 실행", () => {
  afterEach(() => {
    clearSkiaRegistry();
    vi.unstubAllEnvs();
  });

  const stubCk = {
    LTRBRect: () => ({}),
    ClipOp: { Intersect: 0 },
  } as unknown as CanvasKit;

  function recordingCanvas() {
    const events: string[] = [];
    const canvas = {
      save: () => events.push("save"),
      restore: () => events.push("restore"),
      saveLayer: () => events.push("saveLayer"),
      concat: () => {},
      clipRect: () => events.push("clip"),
      clipPath: () => {},
      drawRect: () => events.push("drawRect"),
      translate: (x: number, y: number) => events.push(`t${x},${y}`),
    } as unknown as Canvas;
    return { canvas, events };
  }

  function stream() {
    const body = { id: "body", type: "body", props: {} } as CanvasSceneNode;
    const children = Array.from(
      { length: 6 },
      (_, i) =>
        ({
          id: `c${i}`,
          type: "Box",
          parent_id: "body",
          props: {},
        }) as unknown as CanvasSceneNode,
    );
    const register = (id: string, over: Partial<SkiaNodeData> = {}) =>
      registerSkiaNode(id, {
        elementId: id,
        type: "container",
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        ...over,
      } as SkiaNodeData);
    register("body", { width: 800, height: 2000 });
    children.forEach((child) => register(child.id));
    const layout = new Map(
      children.map((child, i) => [
        child.id,
        { x: 0, y: i * 300, width: 100, height: 100 } as ComputedLayout,
      ]),
    );
    return {
      built: buildRenderCommandStream(
        ["body"],
        new Map([["body", children]]),
        layout,
        { body: { x: 0, y: 0 } },
      ),
      children,
      layout,
    };
  }

  it("splice 로 segment 가 여럿이어도 Proxy 를 지나지 않고 평평한 배열과 같은 그리기 순서를 낸다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { built, children, layout } = stream();
    // 가운데 자식 하나를 다시 기록해 끼운다 — segment 3 개.
    const replacement = buildRenderCommandStream(
      ["c3"],
      new Map(),
      layout,
      {},
      undefined,
      {
        syncSpatialIndexSnapshot: false,
        publishBoundsSnapshot: false,
        subtreeContext: built.subtreeBuildContextByElement.get("c3"),
      },
    );
    const span = built.subtreeSpans.get("c3")!;
    const replacementSpan = replacement.subtreeSpans.get("c3")!;
    replaceCommandRange(
      built.commands,
      span.start,
      span.end,
      Array.from(
        { length: replacementSpan.end - replacementSpan.start },
        (_, i) => replacement.commands[replacementSpan.start + i]!,
      ),
    );
    expect(children.length).toBe(6);
    const flat = Array.from(
      { length: built.commands.length },
      (_, i) => built.commands[i]!,
    );
    const viewport = { x: 0, y: 0, width: 800, height: 700 } as DOMRect;
    const fromFlat = recordingCanvas();
    executeRenderCommands(stubCk, fromFlat.canvas, flat, viewport);

    resetRenderCounters();
    const fromBuffer = recordingCanvas();
    executeRenderCommands(stubCk, fromBuffer.canvas, built.commands, viewport);
    const counters = snapshotRenderCounters();
    expect(fromBuffer.events).toEqual(fromFlat.events);
    expect(counters.bufferSegmentsAtExec).toBeGreaterThan(1);
    expect(counters.execVisited).toBeGreaterThan(0);
    expect(counters.bufferProxyReads).toBe(0);
  });
});
