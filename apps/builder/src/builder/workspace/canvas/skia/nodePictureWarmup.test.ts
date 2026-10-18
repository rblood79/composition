// @vitest-environment node
/**
 * ADR-266 Phase 4 (사용자 결정 2 「idle 미리 기록」) — 화면 밖 요소의 picture 를 idle 에 미리 기록한다.
 *
 * 1. 순서는 화면 가운데에서 가까운 요소부터 · 안 보이는 서브트리 · self span 없는 요소는 건너뛴다.
 * 2. idle 남은 시간 (`more()`) 만큼만 하고 다음 idle 에 이어 간다 · 같은 stream · revision 은 한 번만.
 * 3. revision 이 바뀌면 (편집) 다시 차례를 만든다.
 * 4. 미리 기록한 entry 는 퇴거를 일으키지 않고 (상한 하한 4,096) · 퇴거 때 프레임이 쓴 entry 보다 먼저 나간다.
 * 5. ADR-272 Phase 2 — 후보 = page root ∪ 공간 질의 결과 · 남은 자리 0 이면 모으지 않음 · 기록할 수 있는
 *    후보 중 가까운 k (남은 자리) 개만 정렬 · 카메라 칸이 바뀌면 차례를 다시 세운다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasKit, FontMgr, SkPicture } from "canvaskit-wasm";

const warmed: string[] = [];
const { gate, index } = vi.hoisted(() => ({
  /** 이미 유효한 picture 가 있는 (기록할 수 없는) 요소 · 기록 시도가 `false` 인 요소 (경쟁). */
  gate: { warm: new Set<string>(), race: new Set<string>() },
  /** 가짜 공간 인덱스 — 켜면 `stream.boundsMap` 과 사각형이 겹치는 요소를 돌려준다 (page root 는 뺀다). */
  index: {
    on: false,
    boxes: new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >(),
    unindexed: new Set<string>(),
    queries: 0,
  },
}));
vi.mock("./renderCommands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./renderCommands")>()),
  isNodePictureWarmable: vi.fn(
    (_stream: unknown, id: string) => !gate.warm.has(id),
  ),
  warmNodePicture: vi.fn((_ck: unknown, _stream: unknown, id: string) => {
    // 실제 계약: 이미 유효한 picture · 경쟁 (선별 뒤 편집 시작) 은 기록 없이 false
    if (gate.warm.has(id) || gate.race.has(id)) return false;
    warmed.push(id);
    return true;
  }),
}));
vi.mock("../wasm-bindings/spatialIndex", () => ({
  getSpatialIndex: () => (index.on ? {} : null),
  queryRect: (left: number, top: number, right: number, bottom: number) => {
    index.queries += 1;
    return [...index.boxes]
      .filter(
        ([id, b]) =>
          !index.unindexed.has(id) &&
          b.x < right &&
          b.x + b.width > left &&
          b.y < bottom &&
          b.y + b.height > top,
      )
      .map(([id]) => id);
  },
}));

import type { RenderCommandStream } from "./renderCommands";
import {
  flushNodePictureWarmup,
  requestNodePictureWarmup,
  resetNodePictureWarmup,
  setNodePictureWarmupManual,
  setNodePictureWarmupZoom,
  warmNodePictures,
  warmupCameraKey,
  warmupRect,
} from "./nodePictureWarmup";
import {
  renderDebug,
  resetRenderCounters,
  snapshotRenderCounters,
} from "./renderCounters";
import {
  beginNodePictureFullRecord,
  clearNodePictureCache,
  endNodePictureFullRecord,
  getCachedNodePicture,
  getNodePictureCacheSize,
  hasNodePictureWarmRoom,
  MAX_WARM_NODE_PICTURES,
  resetNodePictureCapacity,
  invalidateNodePicture,
  storeNodePicture,
  storeWarmNodePicture,
  takeWarmTextPaint,
} from "./nodePictureCache";
import { drainPendingWasmDisposals } from "./deferredDisposal";

const CK = {} as CanvasKit;
const FONT_MGR = { id: "fm" } as unknown as FontMgr;
const VIEWPORT = { x: 0, y: 0, width: 100, height: 100 } as DOMRect;

interface Box {
  id: string;
  x: number;
  y?: number;
  visible?: boolean;
  self?: boolean;
  children?: Box[];
}

/** ELEMENT_BEGIN · DRAW · CHILDREN · END 만 가진 stream — 순서 · 건너뛰기 판정에 필요한 만큼. */
function streamOf(boxes: Box[], revision = 0): RenderCommandStream {
  const commands: Array<Record<string, unknown>> = [];
  const selfSpans = new Map<string, { start: number; end: number }>();
  const subtreeSpans = new Map<string, { start: number; end: number }>();
  const boundsMap = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  const subtreeBuildContextByElement = new Map<
    string,
    { parentElementId: string | null }
  >();
  const emit = (box: Box, parent: string | null = null) => {
    subtreeBuildContextByElement.set(box.id, { parentElementId: parent });
    const start = commands.length;
    commands.push({
      type: 0,
      elementId: box.id,
      visible: box.visible ?? true,
      width: 10,
      height: 10,
    });
    if (box.self ?? true) {
      selfSpans.set(box.id, { start: start + 1, end: start + 2 });
      commands.push({ type: 2 });
    }
    for (const child of box.children ?? []) emit(child, box.id);
    commands.push({ type: 1 });
    subtreeSpans.set(box.id, { start, end: commands.length });
    boundsMap.set(box.id, { x: box.x, y: box.y ?? 45, width: 10, height: 10 });
  };
  boxes.forEach((box) => emit(box));
  index.boxes = boundsMap;
  return {
    commands,
    selfSpans,
    subtreeSpans,
    subtreeBuildContextByElement,
    boundsMap,
    presentationRevision: revision,
  } as unknown as RenderCommandStream;
}

const picture = () =>
  ({
    delete: vi.fn(),
    approximateBytesUsed: () => 100,
  }) as unknown as SkPicture;

beforeEach(() => {
  warmed.length = 0;
  gate.warm.clear();
  gate.race.clear();
  index.on = false;
  index.unindexed.clear();
  index.queries = 0;
  renderDebug.warmupBoundedOff = false;
  resetNodePictureWarmup();
  setNodePictureWarmupManual(true);
  clearNodePictureCache();
  resetNodePictureCapacity();
  drainPendingWasmDisposals();
});

describe("ADR-266 idle 미리 기록 — 순서 · 건너뛰기", () => {
  it("화면 가운데에서 가까운 요소부터 · 안 보이는 서브트리와 self span 없는 요소는 건너뛴다", () => {
    const stream = streamOf([
      { id: "far", x: 900 },
      {
        id: "hidden",
        x: 50,
        visible: false,
        children: [{ id: "hidden-child", x: 50 }],
      },
      { id: "wrapper", x: 45, self: false, children: [{ id: "near", x: 40 }] },
      { id: "mid", x: 300 },
    ]);
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    expect(warmed).toEqual(["near", "mid", "far"]);
  });

  it("fontMgr 전에는 기록하지 않는다 (글자가 빠진 picture 는 폰트가 오면 어차피 버린다)", () => {
    requestNodePictureWarmup(
      CK,
      streamOf([{ id: "a", x: 0 }]),
      VIEWPORT,
      () => undefined,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual([]);
  });
});

describe("ADR-266 idle 미리 기록 — 나눠서 · 한 번만", () => {
  it("idle 남은 시간만큼만 하고 다음에 이어 간다 · 끝난 stream 은 다시 하지 않는다", () => {
    const stream = streamOf(
      [0, 1, 2, 3, 4].map((i) => ({ id: `e${i}`, x: i * 10 })),
    );
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    let budget = 2;
    expect(warmNodePictures(() => budget-- > 0)).toBe(false);
    expect(warmed).toHaveLength(2);
    expect(warmNodePictures(() => true)).toBe(true);
    expect(warmed).toHaveLength(5);
    warmed.length = 0;
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    expect(warmed).toEqual([]);
  });

  it("revision 이 바뀌면 (편집) 차례를 다시 만든다", () => {
    const boxes = [{ id: "a", x: 0 }];
    requestNodePictureWarmup(CK, streamOf(boxes, 1), VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    requestNodePictureWarmup(CK, streamOf(boxes, 2), VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    expect(warmed).toEqual(["a", "a"]);
  });
});

describe("ADR-266 idle 미리 기록 — 상한", () => {
  it("미리 기록한 entry 는 작은 화면의 full 기록이 밀어내지 않는다 (상한 하한 4,096)", () => {
    const ref = { id: "w" };
    for (let i = 0; i < 3000; i += 1)
      storeWarmNodePicture(`w${i}`, ref, 10, 10, picture(), null);
    for (let round = 0; round < 61; round += 1) {
      beginNodePictureFullRecord();
      getCachedNodePicture("w0", ref, 10, 10);
      endNodePictureFullRecord();
    }
    expect(getNodePictureCacheSize()).toBe(3000);
  });

  it("상한에 닿으면 더 기록하지 않는다", () => {
    const ref = { id: "w" };
    for (let i = 0; i < MAX_WARM_NODE_PICTURES; i += 1)
      storeWarmNodePicture(`w${i}`, ref, 10, 10, picture(), null);
    expect(hasNodePictureWarmRoom()).toBe(false);
    requestNodePictureWarmup(
      CK,
      streamOf([{ id: "x", x: 0 }]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual([]);
  });

  it("넘쳐 퇴거할 때는 프레임이 아직 쓰지 않은 미리 기록 entry 가 먼저 나간다", () => {
    const ref = { id: "r" };
    storeNodePicture("shown", ref, 10, 10, picture(), null);
    for (let i = 0; i < MAX_WARM_NODE_PICTURES; i += 1)
      storeWarmNodePicture(`w${i}`, ref, 10, 10, picture(), null);
    expect(getNodePictureCacheSize()).toBeLessThan(MAX_WARM_NODE_PICTURES + 1);
    expect(getCachedNodePicture("shown", ref, 10, 10)).not.toBeNull();
  });

  it("글자 넘침은 picture 에 보관했다가 첫 재생이 한 번 가져간다 · entry 가 사라지면 같이 지운다", () => {
    const ref = { id: "t" };
    storeWarmNodePicture("t", ref, 10, 10, picture(), null, true);
    storeWarmNodePicture("u", ref, 10, 10, picture(), null);
    expect(takeWarmTextPaint("u")).toBeUndefined();
    expect(takeWarmTextPaint("t")).toBe(true);
    expect(takeWarmTextPaint("t")).toBeUndefined();
    storeWarmNodePicture("v", ref, 10, 10, picture(), null, false);
    invalidateNodePicture("v");
    expect(takeWarmTextPaint("v")).toBeUndefined();
    storeWarmNodePicture("w", ref, 10, 10, picture(), null, true);
    storeNodePicture("w", ref, 10, 10, picture(), null);
    expect(takeWarmTextPaint("w")).toBeUndefined();
  });
});

describe("ADR-272 Phase 2 — 후보 bounded · k 제한 · 카메라 칸", () => {
  /** dev 카운터를 켠다 (node 환경이라 dev 분기가 읽는 window 도 둔다). */
  const dev = () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("window", {});
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const fill = (n: number) => {
    const ref = { id: "f" };
    for (let i = 0; i < n; i += 1)
      storeWarmNodePicture(`f${i}`, ref, 10, 10, picture(), null);
  };
  const counters = () => {
    const c = snapshotRenderCounters();
    return [
      c.warmCandidatesScanned,
      c.warmCandidatesSorted,
      c.warmPassRebuilt,
      c.warmCandidatesLinear,
    ];
  };

  it("후보 사각형은 배율과 무관한 world 넓이다 (최소 줌 culling × 2) · 칸 키도 같다", () => {
    const at = (zoom: number) =>
      ({ x: 0, y: 0, width: 1000 / zoom, height: 600 / zoom }) as DOMRect;
    const r1 = warmupRect(at(1), 1);
    const r4 = warmupRect(at(0.25), 0.25);
    const rMin = warmupRect(at(0.1), 0.1);
    expect([r1.width, r1.height]).toEqual([20000, 12000]);
    expect([r4.width, r4.height]).toEqual([20000, 12000]);
    expect([rMin.width, rMin.height]).toEqual([20000, 12000]);
    // 가운데 = 화면 가운데
    expect(r1.x + r1.width / 2).toBe(500);
    expect(warmupCameraKey(at(1), 1)).toBe(warmupCameraKey(at(0.25), 0.25));
  });

  it("후보 = page root ∪ 질의 결과 — 사각형 밖 요소는 보지 않고, 인덱스에 없는 page root 는 싣는다", () => {
    dev();
    index.on = true;
    const stream = streamOf([
      { id: "root", x: 99_999, children: [{ id: "near", x: 40 }] },
      { id: "mid", x: 300 },
      { id: "far", x: 90_000 },
    ]);
    index.unindexed.add("root");
    fill(MAX_WARM_NODE_PICTURES - 3);
    resetRenderCounters();
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR, ["root"]);
    flushNodePictureWarmup();
    expect(warmed).toEqual(["near", "mid", "root"]);
    // 본 후보 = root 1 + 질의 결과 2 (near · mid) — far 는 사각형 밖
    expect(counters()).toEqual([3, 3, 1, 0]);
  });

  it("남은 자리가 0 이면 후보를 모으지 않는다 (질의 · 훑기 0)", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES);
    resetRenderCounters();
    requestNodePictureWarmup(
      CK,
      streamOf([{ id: "x", x: 0 }]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual([]);
    expect(index.queries).toBe(0);
    expect(counters()).toEqual([0, 0, 1, 0]);
  });

  it("M1 반례 — 자리 1 · 가장 가까운 A 는 이미 유효 · B 는 cold → B 를 먼저 기록한다 (warm 항목이 k 를 쓰지 않는다)", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 1);
    gate.warm.add("A");
    // 선별 없이 고르면 k = 1 자리를 A 가 쓰고, 정렬 안 된 나머지 첫째 (c9 — 가장 먼 것) 가 먼저 기록된다
    const stream = streamOf([
      { id: "c9", x: 225 },
      { id: "A", x: 45 },
      { id: "B", x: 60 },
      { id: "c2", x: 85 },
    ]);
    resetRenderCounters();
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    expect(warmed[0]).toBe("B");
    expect(warmed).not.toContain("A");
    expect(snapshotRenderCounters().warmCandidatesSorted).toBe(1);
  });

  it("정렬은 가까운 k 개 (k = 남은 자리) 만 · 나머지는 버리지 않고 뒤에 둔다 · 기록이 false 면 다음으로 보충", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 2);
    gate.race.add("e1");
    const stream = streamOf(
      [5, 1, 4, 2, 3].map((i) => ({ id: `e${i}`, x: 45 + i * 20 })),
    );
    resetRenderCounters();
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    // e1 (최근접) 은 경쟁으로 false → e2 · 나머지에서 보충 (mock 은 캐시를 채우지 않아 끝까지 간다)
    expect(warmed.slice(0, 1)).toEqual(["e2"]);
    expect(new Set(warmed)).toEqual(new Set(["e2", "e3", "e4", "e5"]));
    expect(snapshotRenderCounters().warmCandidatesSorted).toBe(2);
  });

  it("사각형 안 후보가 남은 자리보다 적으면 stream 전체로 보충한다 (줌아웃 재배치가 먼 페이지를 데려온다)", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 3);
    // 사각형 질의 결과 3 (자리 3 이상) 중 기록할 수 있는 것은 near 하나 — 나머지 자리는 사각형 밖 far 로
    gate.warm.add("w1");
    gate.warm.add("w2");
    resetRenderCounters();
    requestNodePictureWarmup(
      CK,
      streamOf([
        { id: "near", x: 40 },
        { id: "w1", x: 50 },
        { id: "w2", x: 60 },
        { id: "far", x: 90_000 },
      ]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual(["near", "far"]);
    expect(snapshotRenderCounters().warmCandidatesLinear).toBe(1);
  });

  it("질의 결과가 남은 자리보다 적으면 사각형 선별 없이 전체 순회만 한다 (두 번 훑지 않는다)", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 3);
    resetRenderCounters();
    requestNodePictureWarmup(
      CK,
      streamOf([
        { id: "near", x: 40 },
        { id: "far", x: 90_000 },
      ]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual(["near", "far"]);
    // 훑은 수 = 요소 시작 명령 2 (사각형 후보를 따로 세지 않았다)
    expect(snapshotRenderCounters().warmCandidatesScanned).toBe(2);
  });

  it("안 보이는 조상 아래 요소는 질의에 걸려도 싣지 않는다", () => {
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 1);
    requestNodePictureWarmup(
      CK,
      streamOf([
        {
          id: "hidden",
          x: 50,
          visible: false,
          children: [{ id: "wrap", x: 50, self: false, children: [{ id: "deep", x: 50 }] }],
        },
        { id: "shown", x: 60 },
      ]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual(["shown"]);
  });

  it("카메라 칸이 같으면 차례를 유지하고, 먼 곳으로 옮기면 다시 세워 새 주변부터 기록한다", () => {
    dev();
    index.on = true;
    fill(MAX_WARM_NODE_PICTURES - 1);
    setNodePictureWarmupZoom(1);
    const stream = streamOf([
      { id: "home", x: 40 },
      { id: "away", x: 40, y: 500_000 },
    ]);
    resetRenderCounters();
    requestNodePictureWarmup(CK, stream, VIEWPORT, () => FONT_MGR);
    flushNodePictureWarmup();
    expect(warmed).toEqual(["home"]);
    // 같은 칸 안의 작은 팬 — 다시 세우지 않는다
    requestNodePictureWarmup(
      CK,
      stream,
      ({ x: 30, y: 0, width: 100, height: 100 }) as DOMRect,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(snapshotRenderCounters().warmPassRebuilt).toBe(1);
    // 먼 페이지로 점프 — 새 칸 → 다시 세우고 그 주변을 기록한다
    requestNodePictureWarmup(
      CK,
      stream,
      ({ x: 0, y: 499_955, width: 100, height: 100 }) as DOMRect,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual(["home", "away"]);
    expect(snapshotRenderCounters().warmPassRebuilt).toBe(2);
  });

  it("롤백 플래그 (`warmupBoundedOff`) · 인덱스 없음 → stream 전체 순회 (`warmCandidatesLinear`)", () => {
    dev();
    index.on = true;
    renderDebug.warmupBoundedOff = true;
    resetRenderCounters();
    requestNodePictureWarmup(
      CK,
      streamOf([
        { id: "a", x: 0 },
        { id: "b", x: 90_000 },
      ]),
      VIEWPORT,
      () => FONT_MGR,
    );
    flushNodePictureWarmup();
    expect(warmed).toEqual(["a", "b"]);
    expect(index.queries).toBe(0);
    expect(snapshotRenderCounters().warmCandidatesLinear).toBe(1);
  });
});

describe("ADR-272 Phase 2 — 프레임 안 호출 0 (HC4)", () => {
  it("미리 기록 실행 (`warmNodePictures` · `flushNodePictureWarmup`) 은 이 모듈의 idle · 하니스 flush 밖에서 부르지 않는다", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "../../../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.tsx?$/.test(name) &&
          !/\.test\.tsx?$/.test(name) &&
          name !== "nodePictureWarmup.ts" &&
          /\b(warmNodePictures|flushNodePictureWarmup)\(/.test(
            readFileSync(path, "utf8"),
          )
        )
          offenders.push(path);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
