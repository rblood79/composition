// @vitest-environment jsdom
// ADR-264 Phase 1 (G1) — 옮기기 (`translateSubtree`) 뒤의 명령 · 맵 · SpatialIndex 등록이 같은 layout
// 으로 처음부터 기록한 결과와 같다. 리뷰 r1 반례 3 건 (H1 root 문맥 · H2 넘친 자식 damage · M3 clip
// 재교차) 은 이름 붙인 케이스로 둔다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "./nodeRenderers";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setScrollNode } from "./propertyNodes";
import { setDragSiblingOffsets } from "./nodeRendererTree";

/** SpatialIndex 대역 — full build 의 snapshot 과 옮기기의 upsert · remove 를 같은 맵에. */
const index = vi.hoisted(() => ({
  entries: new Map<string, { x: number; y: number; w: number; h: number }>(),
}));
vi.mock("../wasm-bindings/spatialIndex", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../wasm-bindings/spatialIndex")>();
  return {
    ...actual,
    batchUpdate: (
      items: Array<{ id: string; x: number; y: number; w: number; h: number }>,
    ) => {
      index.entries.clear();
      for (const item of items) index.entries.set(item.id, { ...item });
    },
    // Rust `upsert` 처럼 넓이 0 은 지운다 (`spatial_index.rs`).
    updateElement: (id: string, x: number, y: number, w: number, h: number) =>
      w > 0 && h > 0
        ? index.entries.set(id, { id, x, y, w, h } as never)
        : index.entries.delete(id),
    removeElement: (id: string) => index.entries.delete(id),
  };
});

const { buildRenderCommandStream, buildSubtreeCommandStream } =
  await import("./renderCommands");
const {
  translateSubtree,
  placeRegion,
  applyScrollDelta,
  planSubtreeTranslate,
} = await import("./subtreeTranslate");
const { applyCommitSubtreeCommandPatch } =
  await import("./subtreeCommandPatch");
type Stream = ReturnType<typeof buildRenderCommandStream>;

interface Spec {
  id: string;
  parent: string | null;
  layout: { x: number; y: number; width: number; height: number };
  data?: Partial<SkiaNodeData>;
  /** ADR-269: a scroll/auto box's position (its property node). */
  scroll?: { scrollTop: number; scrollLeft: number };
}

function register(spec: Spec) {
  registerSkiaNode(spec.id, {
    elementId: spec.id,
    type: "container",
    visible: true,
    x: 0,
    y: 0,
    width: spec.layout.width,
    height: spec.layout.height,
    ...spec.data,
  } as SkiaNodeData);
  if (spec.scroll) setScrollNode(spec.id, spec.scroll);
}

function build(specs: readonly Spec[]): Stream {
  const children = new Map<string, CanvasSceneNode[]>();
  const layout = new Map<string, ComputedLayout>();
  for (const spec of specs) {
    register(spec);
    layout.set(spec.id, { ...spec.layout } as ComputedLayout);
    if (spec.parent)
      children.set(spec.parent, [
        ...(children.get(spec.parent) ?? []),
        { id: spec.id, type: "Box", props: {} } as unknown as CanvasSceneNode,
      ]);
  }
  return buildRenderCommandStream(["body"], children, layout, {
    body: { x: 0, y: 0 },
  });
}

const plain = <T>(map: ReadonlyMap<string, T>) =>
  Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
const commandsOf = (stream: Stream) =>
  Array.from({ length: stream.commands.length }, (_, i) => stream.commands[i]);

/** 옮기기 결과와 처음부터 기록한 결과의 대조 (`ids` = 대조할 요소, 기본 전부). */
function expectSameAsRebuild(moved: Stream, rebuilt: Stream, ids?: string[]) {
  const pick = <T>(map: ReadonlyMap<string, T>) =>
    ids
      ? new Map(ids.flatMap((id) => (map.has(id) ? [[id, map.get(id)!]] : [])))
      : map;
  expect(plain(pick(moved.boundsMap))).toEqual(plain(pick(rebuilt.boundsMap)));
  expect(plain(pick(moved.hitBoundsMap))).toEqual(
    plain(pick(rebuilt.hitBoundsMap)),
  );
  expect(plain(pick(moved.clipContextByElement))).toEqual(
    plain(pick(rebuilt.clipContextByElement)),
  );
  expect(plain(pick(moved.subtreeBuildContextByElement))).toEqual(
    plain(pick(rebuilt.subtreeBuildContextByElement)),
  );
  if (!ids) {
    expect(commandsOf(moved)).toEqual(commandsOf(rebuilt));
    expect(plain(moved.selfSpans)).toEqual(plain(rebuilt.selfSpans));
    expect(plain(moved.subtreeSpans)).toEqual(plain(rebuilt.subtreeSpans));
    expect(plain(moved.childrenSpans)).toEqual(plain(rebuilt.childrenSpans));
  }
}

function subtreeIds(specs: readonly Spec[], root: string): string[] {
  const out = [root];
  for (const spec of specs)
    if (spec.parent && out.includes(spec.parent)) out.push(spec.id);
  return out;
}

const contains = (
  outer: { x: number; y: number; width: number; height: number } | undefined,
  inner: { x: number; y: number; width: number; height: number } | undefined,
) =>
  !inner ||
  (!!outer &&
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height);

/** 결정적 난수 (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 깊이 1 ~ 6 · 자식 0 ~ 3 · clip (+ border inset · scroll) · 숨김 · 넓이 0 이 섞인 트리. */
function randomTree(seed: number): Spec[] {
  const next = random(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const specs: Spec[] = [
    {
      id: "body",
      parent: null,
      layout: { x: 0, y: 0, width: 800, height: 800 },
      data: next() < 0.5 ? { clipChildren: true } : {},
    },
  ];
  const grow = (parent: string, depth: number) => {
    if (depth >= int(1, 6)) return;
    for (let c = int(depth === 0 ? 1 : 0, 3); c > 0; c -= 1) {
      const id = `${parent}.${c}`;
      const clips = next() < 0.35;
      specs.push({
        id,
        parent,
        layout: {
          x: int(-40, 300),
          y: int(-40, 300),
          width: next() < 0.08 ? 0 : int(10, 300),
          height: next() < 0.08 ? 0 : int(10, 300),
        },
        ...(() => {
          const data: Partial<SkiaNodeData> = {};
          let scroll: Spec["scroll"];
          if (clips) {
            data.clipChildren = true;
            if (next() < 0.4) data.clipBorderInset = int(1, 6);
            if (next() < 0.4)
              scroll = { scrollTop: int(0, 80), scrollLeft: int(0, 40) };
          }
          if (next() < 0.08) data.visible = false;
          return { data, ...(scroll ? { scroll } : {}) };
        })(),
      });
      grow(id, depth + 1);
    }
  };
  grow("body", 0);
  return specs;
}

const moveTo = (specs: Spec[], id: string, x: number, y: number) =>
  specs.map((spec) =>
    spec.id === id ? { ...spec, layout: { ...spec.layout, x, y } } : spec,
  );

beforeEach(() => {
  index.entries.clear();
});
afterEach(() => {
  clearSkiaRegistry();
  setDragSiblingOffsets(null);
});

describe("ADR-264 translateSubtree — 처음부터 기록한 결과와 같다", () => {
  it("무작위 트리 1,200 건: 한 서브트리를 옮긴 뒤 명령 · span · 맵 · SpatialIndex 가 같다", () => {
    let moved = 0;
    for (let seed = 1; seed <= 1200; seed += 1) {
      const specs = randomTree(seed);
      if (specs.length < 2) continue;
      const pickAt = random(seed * 7919);
      const target = specs[1 + Math.floor(pickAt() * (specs.length - 1))]!;
      const x = target.layout.x + Math.round((pickAt() - 0.5) * 400);
      const y = target.layout.y + Math.round((pickAt() - 0.5) * 400);
      const before = build(specs);
      const oldHits = new Map(before.hitBoundsMap);
      const result = translateSubtree({
        stream: before,
        rootId: target.id,
        x,
        y,
        context: before.subtreeBuildContextByElement.get(target.id)!,
      });
      expect(result.applied, `seed ${seed}`).toBe(true);
      const translatedIndex = new Map(index.entries);
      clearSkiaRegistry();
      const after = build(moveTo(specs, target.id, x, y));
      expectSameAsRebuild(before, after);
      expect(plain(translatedIndex), `seed ${seed} index`).toEqual(
        plain(index.entries),
      );
      for (const id of subtreeIds(specs, target.id)) {
        expect(contains(result.damageBounds, oldHits.get(id))).toBe(true);
        expect(contains(result.damageBounds, after.hitBoundsMap.get(id))).toBe(
          true,
        );
      }
      moved += 1;
      clearSkiaRegistry();
    }
    expect(moved).toBeGreaterThanOrEqual(1000);
  });

  it("부모가 다시 기록된 경우: 부모가 넘긴 문맥 (이동 · clip 변화) 으로 옮긴 서브트리가 같다", () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const specs = randomTree(seed);
      const pickAt = random(seed * 104729);
      const candidates = specs.filter(
        (spec) => spec.parent && spec.parent !== "body",
      );
      if (!candidates.length) continue;
      const target = candidates[Math.floor(pickAt() * candidates.length)]!;
      const parent = specs.find((spec) => spec.id === target.parent)!;
      // 부모가 움직이고 크기가 바뀐다 (clip 하는 부모면 자식의 바깥 clip 이 바뀐다).
      const changed = specs.map((spec) =>
        spec.id === parent.id
          ? {
              ...spec,
              layout: {
                x: spec.layout.x + Math.round((pickAt() - 0.5) * 200),
                y: spec.layout.y + Math.round((pickAt() - 0.5) * 200),
                width: spec.layout.width + Math.round(pickAt() * 120),
                height: Math.max(
                  0,
                  spec.layout.height - 40 + Math.round(pickAt() * 120),
                ),
              },
            }
          : spec,
      );
      const before = build(specs);
      clearSkiaRegistry();
      const after = build(changed);
      clearSkiaRegistry();
      for (const spec of specs) register(spec);
      const result = translateSubtree({
        stream: before,
        rootId: target.id,
        x: target.layout.x,
        y: target.layout.y,
        context: after.subtreeBuildContextByElement.get(target.id)!,
      });
      expect(result.applied).toBe(true);
      expectSameAsRebuild(before, after, subtreeIds(specs, target.id));
      clearSkiaRegistry();
    }
  });
});

describe("ADR-266 내부 자식 (요소 id 없는 그리기 wrapper) 을 가진 서브트리", () => {
  // Button 라벨 · rule shape 처럼 노드 데이터의 `children` 은 `emitInternalChildDraw` 가 elementId ""
  // 인 ELEMENT_BEGIN 으로 감싼다 — 요소가 아니라 boundsMap 에 없다. 실사용 형태 문서 (`app-pages`)
  // 의 page root 는 전부 이런 자손을 가져 옮기기가 늘 `invalid-span` 으로 거절됐다 (Phase 0 카운트).
  const label = (x: number): SkiaNodeData =>
    ({
      type: "box",
      x,
      y: 4,
      width: 30,
      height: 10,
      visible: true,
      box: { fillColor: Float32Array.of(0, 0, 0, 1), borderRadius: 0 },
      children: [
        {
          type: "box",
          x: 2,
          y: 2,
          width: 5,
          height: 5,
          visible: true,
          box: { fillColor: Float32Array.of(1, 0, 0, 1), borderRadius: 0 },
        },
      ],
    }) as unknown as SkiaNodeData;
  const specs: Spec[] = [
    {
      id: "body",
      parent: null,
      layout: { x: 0, y: 0, width: 800, height: 800 },
    },
    {
      id: "card",
      parent: "body",
      layout: { x: 20, y: 30, width: 200, height: 120 },
      data: { clipChildren: true },
    },
    {
      id: "button",
      parent: "card",
      layout: { x: 10, y: 10, width: 80, height: 24 },
      data: { children: [label(8), label(44)] },
    },
    {
      id: "leaf",
      parent: "button",
      layout: { x: 2, y: 2, width: 10, height: 10 },
    },
  ];

  it("옮긴 결과가 처음부터 기록한 것과 같다 (명령 · span · 맵 · SpatialIndex)", () => {
    const before = build(specs);
    const internal = commandsOf(before).filter(
      (command) => command.type === 0 && command.elementId === "",
    );
    expect(internal.length).toBe(4);
    const result = translateSubtree({
      stream: before,
      rootId: "card",
      x: 300,
      y: 410,
      context: before.subtreeBuildContextByElement.get("card")!,
    });
    expect(result.applied).toBe(true);
    const translatedIndex = new Map(index.entries);
    clearSkiaRegistry();
    const after = build(moveTo(specs, "card", 300, 410));
    expectSameAsRebuild(before, after);
    expect(plain(translatedIndex)).toEqual(plain(index.entries));
    expect(before.boundsMap.has("")).toBe(false);
  });
});

describe("ADR-264 리뷰 r1 반례", () => {
  const card = (rootY: number, data: Partial<SkiaNodeData> = {}): Spec[] => [
    {
      id: "body",
      parent: null,
      layout: { x: 0, y: 0, width: 400, height: 400 },
    },
    {
      id: "p",
      parent: "body",
      layout: { x: 0, y: 0, width: 400, height: 200 },
    },
    {
      id: "r",
      parent: "p",
      layout: { x: 0, y: rootY, width: 100, height: 30 },
      data,
    },
    { id: "c", parent: "r", layout: { x: 0, y: 60, width: 50, height: 20 } },
  ];

  it("H1 — 옮긴 뒤 같은 root 를 편집해도 저장된 문맥은 부모의 것 (bounds.y 30, 50 아님)", () => {
    const stream = build(card(10));
    translateSubtree({
      stream,
      rootId: "r",
      x: 0,
      y: 30,
      context: stream.subtreeBuildContextByElement.get("r")!,
    });
    const children = new Map([
      [
        "r",
        [{ id: "c", type: "Box", props: {} } as unknown as CanvasSceneNode],
      ],
    ]);
    const layout = new Map<string, ComputedLayout>([
      ["r", { x: 0, y: 30, width: 100, height: 30 } as ComputedLayout],
      ["c", { x: 0, y: 60, width: 50, height: 20 } as ComputedLayout],
    ]);
    const rebuilt = buildSubtreeCommandStream({
      rootId: "r",
      childrenMap: children,
      layoutMap: layout,
      context: stream.subtreeBuildContextByElement.get("r")!,
      revision: { presentationRevision: 1, baseCanonicalRevision: 0 },
    });
    expect(rebuilt.boundsMap.get("r")?.y).toBe(30);
    expect(rebuilt.boundsMap.get("c")?.y).toBe(90);
  });

  it("H2 — overflow visible root 밖의 자식까지 damage 가 덮는다 (y 10 .. 110)", () => {
    const stream = build(card(10));
    const result = translateSubtree({
      stream,
      rootId: "r",
      x: 0,
      y: 30,
      context: stream.subtreeBuildContextByElement.get("r")!,
    });
    expect(result.damageBounds).toEqual({
      x: 0,
      y: 10,
      width: 100,
      height: 100,
    });
  });

  it("M3 — 바깥 clip 에 잘렸던 안쪽 clip 이 이동으로 드러난다 (clip 높이 10 → 30, hit 20)", () => {
    const specs: Spec[] = [
      {
        id: "body",
        parent: null,
        layout: { x: 0, y: 0, width: 400, height: 400 },
      },
      {
        id: "p",
        parent: "body",
        layout: { x: 0, y: 0, width: 400, height: 100 },
        data: { clipChildren: true },
      },
      {
        id: "r",
        parent: "p",
        layout: { x: 0, y: 90, width: 100, height: 30 },
        data: { clipChildren: true },
      },
      { id: "c", parent: "r", layout: { x: 0, y: 0, width: 50, height: 20 } },
    ];
    const stream = build(specs);
    expect(stream.clipContextByElement.get("c")?.height).toBe(10);
    translateSubtree({
      stream,
      rootId: "r",
      x: 0,
      y: 70,
      context: stream.subtreeBuildContextByElement.get("r")!,
    });
    expect(stream.clipContextByElement.get("c")?.height).toBe(30);
    expect(stream.hitBoundsMap.get("c")?.height).toBe(20);
    clearSkiaRegistry();
    expectSameAsRebuild(stream, build(moveTo(specs, "r", 0, 70)));
  });
});

describe("ADR-264 옮길 수 없는 모양은 쓰기 전에 거절한다", () => {
  const base = (data: Partial<SkiaNodeData> = {}): Spec[] => [
    {
      id: "body",
      parent: null,
      layout: { x: 0, y: 0, width: 400, height: 400 },
    },
    {
      id: "r",
      parent: "body",
      layout: { x: 0, y: 10, width: 100, height: 30 },
    },
    {
      id: "c",
      parent: "r",
      layout: { x: 0, y: 0, width: 50, height: 20 },
      data,
    },
  ];
  const attempt = (stream: Stream) => {
    const before = commandsOf(stream);
    const bounds = plain(stream.boundsMap);
    const result = translateSubtree({
      stream,
      rootId: "r",
      x: 0,
      y: 50,
      context:
        stream.subtreeBuildContextByElement.get("r") ??
        ({
          parentAbsX: 0,
          parentAbsY: 0,
          clipRect: null,
          cmdOffsetX: 0,
          cmdOffsetY: 0,
          parentElementId: "body",
          zOrderKey: "r",
          scrollContextKey: "root-scroll-context",
          topLayerSubtree: false,
        } as const),
    });
    if (!result.applied) {
      expect(commandsOf(stream)).toEqual(before);
      expect(plain(stream.boundsMap)).toEqual(bounds);
    }
    return result;
  };

  it("fixed · sticky 자손 (fixed = top layer)", () => {
    // fixed 는 build 가 top layer 집합에 넣는다.
    expect(attempt(build(base({ isFixed: true }))).reason).toBe("top-layer");
    clearSkiaRegistry();
    expect(
      attempt(
        build(
          base({
            sticky: {
              owner: null,
              constrainingRect: { x: 0, y: 0, width: 800, height: 600 },
              stickyRect: { x: 0, y: 0, width: 100, height: 40 },
              containingBlockRect: { x: 0, y: 0, width: 800, height: 600 },
              top: 0,
              right: null,
              bottom: null,
              left: null,
            },
          }),
        ),
      ).reason,
    ).toBe("fixed-or-sticky");
  });

  it("ADR-267: sticky 는 scroll container 가 같이 옮겨질 때만 옮긴다", () => {
    const sticky = (owner: string | null) => ({
      sticky: {
        owner,
        constrainingRect: { x: 0, y: 0, width: 100, height: 30 },
        stickyRect: { x: 0, y: 0, width: 50, height: 20 },
        containingBlockRect: { x: 0, y: 0, width: 100, height: 30 },
        top: 0,
        right: null,
        bottom: null,
        left: null,
      },
    });
    // container = the moved root "r": its offset relative to "r" is unchanged.
    const stream = build(base(sticky("r")));
    const before = stream.boundsMap.get("c")!.y;
    const result = attempt(stream);
    expect(result.applied).toBe(true);
    expect(stream.boundsMap.get("c")!.y).toBe(before + 40);
    expect(stream.damageUnsafeElementIds.has("c")).toBe(false);
    clearSkiaRegistry();
    // container outside the moved subtree: drawn again.
    expect(attempt(build(base(sticky("body")))).reason).toBe("fixed-or-sticky");
  });

  it("drag 의 형제 비킴 중", () => {
    const stream = build(base());
    setDragSiblingOffsets(new Map([["x", { dx: 0, dy: 10 }]]));
    expect(attempt(stream).reason).toBe("drag-offset");
  });

  it("build 문맥 · span 이 없는 root", () => {
    const stream = build(base());
    stream.subtreeBuildContextByElement.delete("r");
    expect(attempt(stream).reason).toBe("subtree-context");
    const other = build(base());
    other.subtreeSpans.delete("r");
    expect(attempt(other).reason).toBe("missing-span");
  });

  it("top layer 문맥", () => {
    const stream = build(base());
    stream.topLayerElementIds.add("c");
    expect(attempt(stream).reason).toBe("top-layer");
  });

  it("hit bounds 밖 paint 는 옮기되 full 로 그리라고 알린다", () => {
    const stream = build(
      base({ box: { shadows: [{ inner: false }] } } as Partial<SkiaNodeData>),
    );
    const result = attempt(stream);
    expect(result.applied).toBe(true);
    expect(result.unsafePaint).toBe(true);
  });
});

describe("ADR-264 placeRegion — 경로 자기 patch + 옮기기 = 처음부터 기록", () => {
  /** seed 의 크기가 바뀌어 조상 경로가 커지고, 경로의 형제 일부가 자리만 옮긴 편집. */
  function edit(specs: Spec[], seed: number) {
    const next = random(seed * 31337);
    const byId = new Map(specs.map((spec) => [spec.id, spec]));
    const nonRoot = specs.filter((spec) => spec.parent);
    const target = nonRoot[Math.floor(next() * nonRoot.length)]!;
    const path: string[] = [];
    for (let id: string | null = target.id; id; id = byId.get(id)!.parent)
      path.push(id);
    const changed = new Map<string, Spec["layout"]>();
    const grow = () => Math.round((next() - 0.3) * 80);
    for (const id of path) {
      const spec = byId.get(id)!;
      changed.set(id, {
        ...spec.layout,
        width: Math.max(0, spec.layout.width + (id === "body" ? 0 : grow())),
        height: Math.max(0, spec.layout.height + (id === "body" ? 0 : grow())),
      });
      for (const sibling of specs.filter(
        (s) => s.parent && s.parent === spec.parent && s.id !== id,
      ))
        if (next() < 0.5)
          changed.set(sibling.id, {
            ...sibling.layout,
            x: sibling.layout.x + Math.round((next() - 0.5) * 60),
            y: sibling.layout.y + Math.round((next() - 0.5) * 120),
          });
    }
    const after = specs.map((spec) =>
      changed.has(spec.id) ? { ...spec, layout: changed.get(spec.id)! } : spec,
    );
    return { target: target.id, path: new Set(path), after, changed };
  }

  it("무작위 트리 1,000 건 — 명령 · span · 맵 · SpatialIndex 가 같고, 다시 기록한 서브트리는 seed 뿐", () => {
    let selfPatched = 0;
    let translatedTotal = 0;
    let fellBack = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const specs = randomTree(seed);
      if (specs.length < 3) continue;
      const { target, path, after, changed } = edit(specs, seed);
      const stream = build(specs);
      clearSkiaRegistry();
      const children = new Map<string, CanvasSceneNode[]>();
      const layout = new Map<string, ComputedLayout>();
      for (const spec of after) {
        register(spec);
        layout.set(spec.id, { ...spec.layout } as ComputedLayout);
        if (spec.parent)
          children.set(spec.parent, [
            ...(children.get(spec.parent) ?? []),
            {
              id: spec.id,
              type: "Box",
              props: {},
            } as unknown as CanvasSceneNode,
          ]);
      }
      const before = new Map(specs.map((spec) => [spec.id, spec.layout]));
      let revision = stream.presentationRevision;
      const result = placeRegion({
        stream,
        rootId: "body",
        childrenMap: children,
        layoutMap: layout,
        revision: {
          presentationRevision: revision + 1,
          baseCanonicalRevision: 0,
        },
        isSeed: (id) => id === target,
        onPath: (id) => path.has(id) || changed.has(id),
        movedOnly: (id) => {
          const old = before.get(id)!;
          const now = layout.get(id)!;
          return (
            !path.has(id) &&
            changed.has(id) &&
            old.width === now.width &&
            old.height === now.height
          );
        },
        patchSubtree: (id) => {
          revision += 1;
          const replacement = buildSubtreeCommandStream({
            rootId: id,
            childrenMap: children,
            layoutMap: layout,
            context: stream.subtreeBuildContextByElement.get(id)!,
            revision: {
              presentationRevision: revision,
              baseCanonicalRevision: 0,
            },
          });
          return applyCommitSubtreeCommandPatch({
            current: stream,
            replacement,
            rootId: id,
            revision,
            canonicalRevision: 0,
          });
        },
      });
      expect(result.applied, `seed ${seed}`).toBe(true);
      const placedIndex = new Map(index.entries);
      clearSkiaRegistry();
      const rebuilt = build(after);
      expectSameAsRebuild(stream, rebuilt);
      expect(plain(placedIndex), `seed ${seed} index`).toEqual(
        plain(index.entries),
      );
      for (const id of [...path, ...changed.keys()]) {
        expect(
          contains(result.damageBounds, rebuilt.hitBoundsMap.get(id)),
        ).toBe(true);
      }
      if (result.patched.length === 1 && result.patched[0] === target)
        selfPatched += 1;
      else fellBack += 1;
      translatedTotal += result.translated.length;
      clearSkiaRegistry();
    }
    // 대부분은 seed 만 다시 기록한다 (경로 문맥이 바뀐 seed 는 가까운 조상에서 다시 기록).
    expect(selfPatched).toBeGreaterThan(fellBack);
    expect(translatedTotal).toBeGreaterThan(500);
  });
});

describe("ADR-269 Phase 1 — 스크롤 (applyScrollDelta) 뒤 결과가 같은 위치로 처음부터 기록한 것과 같다", () => {
  const layoutOf = (specs: readonly Spec[]) =>
    new Map(
      specs.map((spec) => [spec.id, { ...spec.layout } as ComputedLayout]),
    );
  /** The scroll a spec list gives its scroll owners (the table the stream was recorded with). */
  const withScroll = (
    specs: readonly Spec[],
    id: string,
    scroll: { scrollTop: number; scrollLeft: number },
  ) => specs.map((spec) => (spec.id === id ? { ...spec, scroll } : spec));

  it("무작위 트리 1,200 건: 상자 하나를 세 번 스크롤한 뒤 명령 · span · 맵 · SpatialIndex 가 같고 명령 쓰기 0", () => {
    let scrolled = 0;
    for (let seed = 1; seed <= 1200; seed += 1) {
      const specs = randomTree(seed);
      const owners = specs.filter((spec) =>
        specs.some((child) => child.parent === spec.id),
      );
      if (!owners.length) continue;
      const pickAt = random(seed * 6151);
      const owner = owners[Math.floor(pickAt() * owners.length)]!;
      const stream = build(specs);
      const recorded = commandsOf(stream);
      const layout = layoutOf(specs);
      const ids = subtreeIds(specs, owner.id).filter((id) => id !== owner.id);
      const oldHits = new Map(
        ids.map((id) => [id, stream.hitBoundsMap.get(id)]),
      );
      let offset = owner.scroll ?? { scrollTop: 0, scrollLeft: 0 };
      let damage:
        { x: number; y: number; width: number; height: number } | undefined;
      for (let step = 0; step < 3; step += 1) {
        const next = {
          scrollTop: Math.floor(pickAt() * 120),
          scrollLeft: Math.floor(pickAt() * 60),
        };
        setScrollNode(owner.id, next);
        const result = applyScrollDelta({
          stream,
          ownerId: owner.id,
          dx: offset.scrollLeft - next.scrollLeft,
          dy: offset.scrollTop - next.scrollTop,
          layoutMap: layout,
        });
        expect(result, `seed ${seed}`).not.toBeNull();
        expect(result!.rerecord).toEqual([]);
        if (result!.damageBounds)
          damage = damage
            ? {
                x: Math.min(damage.x, result!.damageBounds.x),
                y: Math.min(damage.y, result!.damageBounds.y),
                width:
                  Math.max(
                    damage.x + damage.width,
                    result!.damageBounds.x + result!.damageBounds.width,
                  ) - Math.min(damage.x, result!.damageBounds.x),
                height:
                  Math.max(
                    damage.y + damage.height,
                    result!.damageBounds.y + result!.damageBounds.height,
                  ) - Math.min(damage.y, result!.damageBounds.y),
              }
            : { ...result!.damageBounds };
        offset = next;
      }
      // The commands were not written (the owner's position is its property node).
      expect(commandsOf(stream)).toEqual(recorded);
      const scrolledIndex = new Map(index.entries);
      clearSkiaRegistry();
      const rebuilt = build(withScroll(specs, owner.id, offset));
      expectSameAsRebuild(stream, rebuilt);
      expect(plain(scrolledIndex), `seed ${seed} index`).toEqual(
        plain(index.entries),
      );
      for (const id of ids) {
        expect(contains(damage, oldHits.get(id))).toBe(true);
        expect(contains(damage, rebuilt.hitBoundsMap.get(id))).toBe(true);
      }
      scrolled += 1;
      clearSkiaRegistry();
    }
    expect(scrolled).toBeGreaterThanOrEqual(900);
  });

  it("스크롤 + 옮김: 스크롤된 상자 안 서브트리를 옮겨도 같다 (저장 문맥이 스크롤을 따라왔다)", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const specs = randomTree(seed);
      const owner = specs.find(
        (spec) =>
          spec.parent &&
          specs.some(
            (child) =>
              child.parent === spec.id &&
              specs.some((grand) => grand.parent === child.id),
          ),
      );
      if (!owner) continue;
      const child = specs.find((spec) => spec.parent === owner.id)!;
      const stream = build(specs);
      const before = owner.scroll ?? { scrollTop: 0, scrollLeft: 0 };
      const after = { scrollTop: before.scrollTop + 37, scrollLeft: 0 };
      setScrollNode(owner.id, after);
      expect(
        applyScrollDelta({
          stream,
          ownerId: owner.id,
          dx: before.scrollLeft,
          dy: before.scrollTop - after.scrollTop,
          layoutMap: layoutOf(specs),
        }),
      ).not.toBeNull();
      const moved = translateSubtree({
        stream,
        rootId: child.id,
        x: child.layout.x + 25,
        y: child.layout.y - 15,
        context: stream.subtreeBuildContextByElement.get(child.id)!,
      });
      expect(moved.applied).toBe(true);
      clearSkiaRegistry();
      expectSameAsRebuild(
        stream,
        build(
          moveTo(
            withScroll(specs, owner.id, after),
            child.id,
            child.layout.x + 25,
            child.layout.y - 15,
          ),
        ),
      );
      clearSkiaRegistry();
    }
  });

  it("drag offset 중에는 놓지 않는다 (null — 호출부가 소유자를 다시 기록)", () => {
    const specs = randomTree(3);
    const owner = specs.find((spec) =>
      specs.some((child) => child.parent === spec.id),
    )!;
    const stream = build(specs);
    setDragSiblingOffsets(new Map([[owner.id, { dx: 4, dy: 0 }]]));
    expect(
      applyScrollDelta({
        stream,
        ownerId: owner.id,
        dx: 0,
        dy: -10,
        layoutMap: layoutOf(specs),
      }),
    ).toBeNull();
  });

  it("옮기기 검사는 명령을 훑지 않고 자식 색인으로 같은 판정을 낸다", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const specs = randomTree(seed);
      const stream = build(specs);
      for (const spec of specs.slice(1)) {
        const context = stream.subtreeBuildContextByElement.get(spec.id);
        if (!context) continue;
        const plan = planSubtreeTranslate(stream, spec.id, context);
        expect(plan.reason, `seed ${seed} ${spec.id}`).toBeUndefined();
      }
      // Every recorded element is reachable from the root by the index (the walk misses none).
      const reached = new Set<string>();
      const walk = (id: string) => {
        reached.add(id);
        for (const child of stream.childElementIds.get(id) ?? []) walk(child);
      };
      walk("body");
      expect([...reached].sort()).toEqual(
        [...stream.subtreeSpans.keys()].sort(),
      );
      clearSkiaRegistry();
    }
  });
});
