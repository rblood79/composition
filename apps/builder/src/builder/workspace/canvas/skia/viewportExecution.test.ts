// @vitest-environment jsdom
// ADR-263 Phase 2 (G2) — full 재기록의 컬링: 선형 실행은 화면 밖 서브트리 안을 방문하지 않고,
// viewport 공간 질의 경로는 화면에 걸친 요소 수에 비례한다. 둘 다 그리는 순서는 지금의 선형 실행과 같다.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "./nodeRenderers";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragSiblingOffsets } from "./nodeRendererTree";
import { resetRenderCounters, snapshotRenderCounters } from "./renderCounters";

/** SpatialIndex 대역: 등록된 hit bounds 중 rect 와 겹치는 id (Rust upsert 처럼 넓이 0 은 빠진다). */
const index = vi.hoisted(() => ({
  bounds: null as Map<
    string,
    { x: number; y: number; width: number; height: number }
  > | null,
}));
vi.mock("../wasm-bindings/spatialIndex", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../wasm-bindings/spatialIndex")>();
  return {
    ...actual,
    getSpatialIndex: () => (index.bounds ? {} : null),
    queryRect: (left: number, top: number, right: number, bottom: number) =>
      [...(index.bounds ?? new Map())]
        .filter(
          ([, b]) =>
            b.width > 0 &&
            b.height > 0 &&
            b.x <= right &&
            b.x + b.width >= left &&
            b.y <= bottom &&
            b.y + b.height >= top,
        )
        .map(([id]) => id),
  };
});

const {
  buildRenderCommandStream,
  executeRenderCommands,
  executeViewportRenderCommands,
} = await import("./renderCommands");

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

const node = (id: string, parent: string | null) =>
  ({
    id,
    type: "Box",
    parent_id: parent,
    props: {},
  }) as unknown as CanvasSceneNode;

function register(id: string, over: Partial<SkiaNodeData> = {}) {
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
}

/**
 * body > group × g > leaf × perGroup. 첫 group 의 첫 leaf 만 viewport (0,0,200,200) 안,
 * 나머지 group 은 아래로 멀리. `hidden` 이면 둘째 group 을 visible:false 로.
 */
function nestedScene(leaves: number, perGroup = 20, hidden = false) {
  const groups = Math.ceil(leaves / perGroup);
  const children = new Map<string, CanvasSceneNode[]>();
  const layout = new Map<string, ComputedLayout>();
  register("body", { width: 1000, height: groups * 1000 });
  const bodyChildren: CanvasSceneNode[] = [];
  let made = 0;
  for (let g = 0; g < groups; g += 1) {
    const gid = `g${g}`;
    bodyChildren.push(node(gid, "body"));
    register(gid, {
      width: 1000,
      height: 1000,
      ...(hidden && g === 1 ? { visible: false } : {}),
    });
    layout.set(gid, {
      x: 0,
      y: g * 1000 + (g ? 5000 : 0),
      width: 1000,
      height: 1000,
    } as ComputedLayout);
    const leafNodes: CanvasSceneNode[] = [];
    for (let l = 0; l < perGroup && made < leaves; l += 1, made += 1) {
      const lid = `g${g}l${l}`;
      leafNodes.push(node(lid, gid));
      register(lid, { width: 50, height: 50 });
      layout.set(lid, {
        x: 0,
        y: l * 300,
        width: 50,
        height: 50,
      } as ComputedLayout);
    }
    children.set(gid, leafNodes);
  }
  children.set("body", bodyChildren);
  return buildRenderCommandStream(["body"], children, layout, {
    body: { x: 0, y: 0 },
  });
}

/** body > leaf × n (평평) — 첫 leaf 만 viewport 안. review r1 M1 의 반례 모양. */
function flatScene(n: number) {
  const layout = new Map<string, ComputedLayout>();
  register("body", { width: 1000, height: n * 300 });
  const leaves = Array.from({ length: n }, (_, i) => {
    register(`f${i}`, { width: 50, height: 50 });
    layout.set(`f${i}`, {
      x: 0,
      y: i * 300,
      width: 50,
      height: 50,
    } as ComputedLayout);
    return node(`f${i}`, "body");
  });
  return buildRenderCommandStream(
    ["body"],
    new Map([["body", leaves]]),
    layout,
    {
      body: { x: 0, y: 0 },
    },
  );
}

const viewport = { x: 0, y: 0, width: 200, height: 200 } as DOMRect;

function linear(stream: ReturnType<typeof nestedScene>, jump: boolean) {
  const out = recordingCanvas();
  resetRenderCounters();
  executeRenderCommands(
    stubCk,
    out.canvas,
    stream.commands,
    viewport,
    undefined,
    undefined,
    undefined,
    undefined,
    jump ? { subtreeSpans: stream.subtreeSpans } : {},
  );
  return { events: out.events, counters: snapshotRenderCounters() };
}

function viaViewport(stream: ReturnType<typeof nestedScene>) {
  index.bounds = new Map(stream.hitBoundsMap);
  const out = recordingCanvas();
  resetRenderCounters();
  const used = executeViewportRenderCommands(
    stubCk,
    out.canvas,
    stream,
    viewport,
    ["body"],
  );
  return { used, events: out.events, counters: snapshotRenderCounters() };
}

describe("ADR-263 Phase 2 — 선형 실행의 서브트리 점프", () => {
  afterEach(() => {
    clearSkiaRegistry();
    vi.unstubAllEnvs();
  });

  it.each([false, true])(
    "컬링 · 숨김 서브트리 안을 방문하지 않고 그리는 순서는 그대로다 (숨김 group %s)",
    (hidden) => {
      vi.stubEnv("NODE_ENV", "development");
      const stream = nestedScene(600, 20, hidden);
      const before = linear(stream, false);
      const after = linear(stream, true);
      expect(after.events).toEqual(before.events);
      expect(before.counters.execSkipped).toBeGreaterThan(1000);
      expect(after.counters.execSkipped).toBe(0);
      expect(after.counters.execCulledJumped).toBe(before.counters.execSkipped);
    },
  );
});

describe("ADR-263 Phase 2 — viewport 공간 질의 경로", () => {
  afterEach(() => {
    clearSkiaRegistry();
    index.bounds = null;
    setDragSiblingOffsets(null);
    vi.unstubAllEnvs();
  });

  it.each([
    ["중첩", nestedScene],
    ["평평", flatScene],
  ] as const)(
    "%s — 가시 leaf 1 · N = 600 / 5,000 의 방문 수가 같고 그리는 순서는 선형과 같다",
    (_, scene) => {
      vi.stubEnv("NODE_ENV", "development");
      const visits: number[] = [];
      for (const n of [600, 5000]) {
        const stream = scene(n);
        const reference = linear(stream, false);
        const run = viaViewport(stream);
        expect(run.used).toBe(true);
        expect(run.events).toEqual(reference.events);
        visits.push(run.counters.execVisited);
        clearSkiaRegistry();
      }
      expect(visits[0]).toBe(visits[1]);
      expect(visits[0]).toBeLessThan(20);
    },
  );

  it("형제 비킴 offset 이 있으면 쓰지 않는다 (index 는 offset 전 상자만 안다)", () => {
    const stream = nestedScene(40);
    setDragSiblingOffsets(new Map([["g0l1", { dx: 0, dy: -300 }]]));
    expect(viaViewport(stream).used).toBe(false);
  });

  it("넓이 0 상자가 그리면 hit bounds 밖 paint 로 보고 쓰지 않는다", () => {
    register("body", { width: 400, height: 400 });
    register("line", {
      type: "box",
      width: 200,
      height: 0,
      box: {
        fillColor: Float32Array.of(0, 0, 0, 1),
        borderRadius: 0,
        strokeColor: Float32Array.of(0, 0, 0, 1),
        strokeWidth: 1,
      },
    } as Partial<SkiaNodeData>);
    const stream = buildRenderCommandStream(
      ["body"],
      new Map([["body", [node("line", "body")]]]),
      new Map([
        ["line", { x: 0, y: 10, width: 200, height: 0 } as ComputedLayout],
      ]),
      { body: { x: 0, y: 0 } },
    );
    expect(stream.damageUnsafeElementIds.has("line")).toBe(true);
    expect(viaViewport(stream).used).toBe(false);
  });
});

describe("ADR-263 Phase 2 — sequence 의 self span 옮김 (노드 picture 재생)", () => {
  afterEach(() => clearSkiaRegistry());

  it("통째로 복사된 self-draw 구간은 sequence index 로 옮겨 답하고, 빠진 요소는 답하지 않는다", async () => {
    const { buildDamageRenderCommandSequence } =
      await import("./renderCommands");
    const fill = {
      type: "box",
      box: { fillColor: Float32Array.of(1, 1, 1, 1), borderRadius: 0 },
    } as Partial<SkiaNodeData>;
    register("body", { ...fill, width: 1000, height: 1000 });
    const leaves = ["a", "b", "c"].map((id, i) => {
      register(id, { ...fill, width: 50, height: 50 });
      return [id, i] as const;
    });
    const stream = buildRenderCommandStream(
      ["body"],
      new Map([["body", leaves.map(([id]) => node(id, "body"))]]),
      new Map(
        leaves.map(([id, i]) => [
          id,
          { x: 0, y: i * 300, width: 50, height: 50 } as ComputedLayout,
        ]),
      ),
      { body: { x: 0, y: 0 } },
    );
    const sequence = buildDamageRenderCommandSequence(stream, ["body", "c"])!;
    for (const id of ["body", "c"]) {
      const span = sequence.selfSpans.get(id)!;
      const source = stream.selfSpans.get(id)!;
      expect(span.end - span.start).toBe(source.end - source.start);
      const begin = sequence.commands[span.start - 1] as { elementId?: string };
      expect(begin.elementId).toBe(id);
      for (let k = 0; k < span.end - span.start; k += 1)
        expect(sequence.commands[span.start + k]).toBe(
          stream.commands[source.start + k],
        );
    }
    expect(sequence.selfSpans.get("a")).toBeUndefined();
    expect(sequence.selfSpans.get("b")).toBeUndefined();
  });
});
