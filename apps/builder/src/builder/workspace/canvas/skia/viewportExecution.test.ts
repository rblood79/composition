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
  executeDamageRenderCommands,
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

/**
 * 칠하는 경로 (Paint · 도형) 까지 타는 stub — 어떤 속성 · 생성 · 호출이든 자기 자신을 돌려준다.
 * canvas 의 draw 계열은 이름으로 기록한다 (선형 ↔ viewport 순서 대조).
 */
function deepStub(): unknown {
  const target = function () {} as unknown as object;
  const proxy: unknown = new Proxy(target, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : proxy),
    apply: () => proxy,
    construct: () => proxy as object,
  });
  return proxy;
}
function paintingCk(): CanvasKit {
  return new Proxy(stubCk as object, {
    get: (target, key) =>
      key in target
        ? (target as Record<string | symbol, unknown>)[key]
        : deepStub(),
  }) as CanvasKit;
}
function paintingCanvas() {
  const out = recordingCanvas();
  const canvas = new Proxy(out.canvas as object, {
    get: (target, key) =>
      key in target
        ? (target as Record<string | symbol, unknown>)[key]
        : (..._args: unknown[]) => {
            out.events.push(String(key));
            return deepStub();
          },
  }) as Canvas;
  return { canvas, events: out.events };
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

  it("ADR-266: 넓이 0 상자 (hit bounds 밖 paint) 가 있어도 쓰고, 늘 실어 그리는 순서는 선형과 같다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const lineData = {
      type: "box",
      width: 200,
      height: 0,
      box: {
        fillColor: Float32Array.of(0, 0, 0, 1),
        borderRadius: 0,
        strokeColor: Float32Array.of(0, 0, 0, 1),
        strokeWidth: 1,
      },
    } as Partial<SkiaNodeData>;
    register("body", { width: 400, height: 4000 });
    register("line", lineData);
    const leaves = Array.from({ length: 6 }, (_, i) => {
      register(`f${i}`, { width: 50, height: 50 });
      return [`f${i}`, i] as const;
    });
    const stream = buildRenderCommandStream(
      ["body"],
      new Map([
        [
          "body",
          [node("line", "body"), ...leaves.map(([id]) => node(id, "body"))],
        ],
      ]),
      new Map([
        ["line", { x: 0, y: 10, width: 200, height: 0 } as ComputedLayout],
        ...leaves.map(
          ([id, i]) =>
            [
              id,
              {
                x: 0,
                y: 40 + i * 600,
                width: 50,
                height: 50,
              } as ComputedLayout,
            ] as const,
        ),
      ]),
      { body: { x: 0, y: 0 } },
    );
    expect(stream.damageUnsafeElementIds.has("line")).toBe(true);
    const ck = paintingCk();
    const linearOut = paintingCanvas();
    executeRenderCommands(
      ck,
      linearOut.canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans, // production 의 선형 경로 (`canvasScene.contentNode`) 와 같게 — picture 재생
      undefined,
      undefined,
      { subtreeSpans: stream.subtreeSpans },
    );
    index.bounds = new Map(stream.hitBoundsMap);
    const viewportOut = paintingCanvas();
    resetRenderCounters();
    const used = executeViewportRenderCommands(
      ck,
      viewportOut.canvas,
      stream,
      viewport,
      ["body"],
    );
    expect(used).toBe(true);
    expect(snapshotRenderCounters().viewportFallbacks).toBe(0);
    expect(viewportOut.events).toEqual(linearOut.events);
    // 넓이 0 상자는 index 에 없지만 그려진다
    expect(stream.hitBoundsMap.get("line")?.height).toBe(0);
    expect(
      viewportOut.events.filter((e) => e.startsWith("draw")).length,
    ).toBeGreaterThan(0);
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

describe("ADR-266 Phase 0 — viewport 후퇴 사유", () => {
  afterEach(() => {
    clearSkiaRegistry();
    index.bounds = null;
    setDragSiblingOffsets(null);
    vi.unstubAllEnvs();
  });

  const reasons = (counters: ReturnType<typeof snapshotRenderCounters>) => ({
    total: counters.viewportFallbacks,
    linearOnly: counters.viewportFallbackLinearOnly,
    noIndex: counters.viewportFallbackNoIndex,
    unsafePaint: counters.viewportFallbackUnsafePaint,
    dragOffset: counters.viewportFallbackDragOffset,
    halfRule: counters.viewportFallbackHalfRule,
    noSequence: counters.viewportFallbackNoSequence,
  });
  const only = (key: string) => ({
    total: 1,
    linearOnly: 0,
    noIndex: 0,
    unsafePaint: 0,
    dragOffset: 0,
    halfRule: 0,
    noSequence: 0,
    [key]: 1,
  });

  it("후보가 절반을 넘으면 halfRule 로 센다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const stream = flatScene(3);
    index.bounds = new Map(stream.hitBoundsMap);
    resetRenderCounters();
    const used = executeViewportRenderCommands(
      stubCk,
      recordingCanvas().canvas,
      stream,
      { x: 0, y: 0, width: 1000, height: 1000 } as DOMRect,
      ["body"],
    );
    expect(used).toBe(false);
    expect(reasons(snapshotRenderCounters())).toEqual(only("halfRule"));
  });

  it("drag 형제 비킴은 dragOffset · index 없음은 noIndex 로 센다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const stream = nestedScene(40);
    setDragSiblingOffsets(new Map([["g0l1", { dx: 0, dy: -300 }]]));
    expect(reasons(viaViewport(stream).counters)).toEqual(only("dragOffset"));
    setDragSiblingOffsets(null);
    resetRenderCounters();
    expect(
      executeViewportRenderCommands(
        stubCk,
        recordingCanvas().canvas,
        stream,
        viewport,
        ["body"],
      ),
    ).toBe(true);
    expect(snapshotRenderCounters().viewportFallbacks).toBe(0);
    index.bounds = null;
    resetRenderCounters();
    executeViewportRenderCommands(
      stubCk,
      recordingCanvas().canvas,
      stream,
      viewport,
      ["body"],
    );
    expect(reasons(snapshotRenderCounters())).toEqual(only("noIndex"));
  });

  it("화면과 겹치지 않는 clip 조상 안의 unsafe 는 싣지 않는다 (방문 수 = 화면 몫)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const groups = 30;
    register("body", { width: 1000, height: groups * 1000 });
    const children = new Map<string, CanvasSceneNode[]>();
    const layout = new Map<string, ComputedLayout>();
    const bodyChildren: CanvasSceneNode[] = [];
    for (let g = 0; g < groups; g += 1) {
      const gid = `g${g}`;
      bodyChildren.push(node(gid, "body"));
      register(gid, { width: 1000, height: 1000, clipChildren: true });
      layout.set(gid, {
        x: 0,
        y: g * 1000,
        width: 1000,
        height: 1000,
      } as ComputedLayout);
      const leaf = `g${g}l`;
      const line = `g${g}line`;
      register(leaf, { width: 50, height: 50 });
      register(line, {
        width: 200,
        height: 0,
        visible: true,
      } as Partial<SkiaNodeData>);
      layout.set(leaf, { x: 0, y: 0, width: 50, height: 50 } as ComputedLayout);
      layout.set(line, {
        x: 0,
        y: 60,
        width: 200,
        height: 0,
      } as ComputedLayout);
      children.set(gid, [node(leaf, gid), node(line, gid)]);
    }
    children.set("body", bodyChildren);
    const stream = buildRenderCommandStream(["body"], children, layout, {
      body: { x: 0, y: 0 },
    });
    // 넓이 0 상자는 칠하지 않아도 unsafe 로 잡히지 않는다 — 직접 표시해 화면 밖 unsafe 를 만든다
    for (let g = 0; g < groups; g += 1)
      stream.damageUnsafeElementIds.add(`g${g}line`);
    const reference = linear(stream, true);
    const run = viaViewport(stream);
    expect(run.used).toBe(true);
    expect(run.events).toEqual(reference.events);
    // 화면 (0,0,200,200) 의 group 하나 몫만 걷는다 — 29 개 화면 밖 group 의 closure 는 없다
    expect(run.counters.execVisited).toBeLessThan(30);
  });

  it("unsafe 가 요소의 절반을 넘으면 unsafePaint 로 센다 (선형이 더 싸다)", () => {
    vi.stubEnv("NODE_ENV", "development");
    register("body", { width: 400, height: 400 });
    const shadowed = ["s0", "s1", "s2"].map((id, i) => {
      register(id, {
        type: "box",
        width: 50,
        height: 50,
        box: {
          fillColor: Float32Array.of(1, 1, 1, 1),
          borderRadius: 0,
          shadows: [
            {
              inner: false,
              offsetX: 0,
              offsetY: 4,
              blur: 8,
              spread: 0,
              color: Float32Array.of(0, 0, 0, 0.3),
            },
          ],
        },
      } as unknown as Partial<SkiaNodeData>);
      return [id, i] as const;
    });
    const stream = buildRenderCommandStream(
      ["body"],
      new Map([["body", shadowed.map(([id]) => node(id, "body"))]]),
      new Map(
        shadowed.map(([id, i]) => [
          id,
          { x: 0, y: i * 100, width: 50, height: 50 } as ComputedLayout,
        ]),
      ),
      { body: { x: 0, y: 0 } },
    );
    expect(stream.damageUnsafeElementIds.size).toBe(3);
    expect(reasons(viaViewport(stream).counters)).toEqual(only("unsafePaint"));
  });
});

describe("ADR-266 Phase 3 — damage 경로도 칠할 수 있는 unsafe 를 싣는다", () => {
  afterEach(() => {
    clearSkiaRegistry();
    index.bounds = null;
  });

  /** body > target (0..80) + 그림자 형제 (100..180, 그림자가 왼쪽 40 으로 target 위에 칠한다). */
  function shadowScene(clipOwner: boolean) {
    register("body", { width: 400, height: 200 });
    register("group", {
      width: clipOwner ? 90 : 400,
      height: 200,
      ...(clipOwner ? { clipChildren: true } : {}),
    });
    register("target", {
      type: "box",
      width: 80,
      height: 40,
      box: { fillColor: Float32Array.of(1, 0, 0, 1), borderRadius: 0 },
    } as Partial<SkiaNodeData>);
    register("shadowed", {
      type: "box",
      width: 80,
      height: 40,
      box: {
        fillColor: Float32Array.of(1, 1, 1, 1),
        borderRadius: 0,
        shadows: [
          {
            type: "drop-shadow",
            color: Float32Array.of(0, 0, 0, 0.4),
            dx: -40,
            dy: 0,
            sigmaX: 8,
            sigmaY: 8,
            inner: false,
          },
        ],
      },
    } as unknown as Partial<SkiaNodeData>);
    return buildRenderCommandStream(
      ["body"],
      new Map([
        ["body", [node("target", "body"), node("group", "body")]],
        ["group", [node("shadowed", "group")]],
      ]),
      new Map([
        ["target", { x: 0, y: 0, width: 80, height: 40 } as ComputedLayout],
        [
          "group",
          {
            x: clipOwner ? 300 : 0,
            y: 0,
            width: clipOwner ? 90 : 400,
            height: 200,
          } as ComputedLayout,
        ],
        ["shadowed", { x: 100, y: 0, width: 80, height: 40 } as ComputedLayout],
      ]),
      { body: { x: 0, y: 0 } },
    );
  }

  it("target 의 damage 에 그림자 형제를 같이 다시 그린다 (전에는 null → full)", () => {
    const stream = shadowScene(false);
    expect(stream.damageUnsafeElementIds.has("shadowed")).toBe(true);
    index.bounds = new Map(stream.hitBoundsMap);
    const out = paintingCanvas();
    const commands = executeDamageRenderCommands(
      paintingCk(),
      out.canvas,
      stream,
      { x: 0, y: 0, width: 80, height: 40 } as DOMRect,
    );
    expect(commands).not.toBeNull();
    // 그림자 형제의 ELEMENT_BEGIN translate (100, 0) 이 sequence 에 있다
    expect(out.events).toContain("t100,0");
  });

  it("clip 이 damage 와 겹치지 않는 unsafe 는 싣지 않는다", () => {
    const stream = shadowScene(true);
    expect(stream.damageUnsafeElementIds.has("shadowed")).toBe(true);
    index.bounds = new Map(stream.hitBoundsMap);
    const out = paintingCanvas();
    const commands = executeDamageRenderCommands(
      paintingCk(),
      out.canvas,
      stream,
      { x: 0, y: 0, width: 80, height: 40 } as DOMRect,
    );
    expect(commands).not.toBeNull();
    expect(out.events).not.toContain("t300,0");
  });
});
