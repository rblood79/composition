// @vitest-environment node
/**
 * ADR-266 Phase 4 (사용자 결정 2 「idle 미리 기록」) — 화면 밖 요소의 picture 를 idle 에 미리 기록한다.
 *
 * 1. 순서는 화면 가운데에서 가까운 요소부터 · 안 보이는 서브트리 · self span 없는 요소는 건너뛴다.
 * 2. idle 남은 시간 (`more()`) 만큼만 하고 다음 idle 에 이어 간다 · 같은 stream · revision 은 한 번만.
 * 3. revision 이 바뀌면 (편집) 다시 차례를 만든다.
 * 4. 미리 기록한 entry 는 퇴거를 일으키지 않고 (상한 하한 4,096) · 퇴거 때 프레임이 쓴 entry 보다 먼저 나간다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasKit, FontMgr, SkPicture } from "canvaskit-wasm";

const warmed: string[] = [];
vi.mock("./renderCommands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./renderCommands")>()),
  warmNodePicture: vi.fn((_ck: unknown, _stream: unknown, id: string) => {
    warmed.push(id);
    return true;
  }),
}));

import type { RenderCommandStream } from "./renderCommands";
import {
  flushNodePictureWarmup,
  requestNodePictureWarmup,
  resetNodePictureWarmup,
  setNodePictureWarmupManual,
  warmNodePictures,
} from "./nodePictureWarmup";
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
  const emit = (box: Box) => {
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
    for (const child of box.children ?? []) emit(child);
    commands.push({ type: 1 });
    subtreeSpans.set(box.id, { start, end: commands.length });
    boundsMap.set(box.id, { x: box.x, y: 45, width: 10, height: 10 });
  };
  boxes.forEach(emit);
  return {
    commands,
    selfSpans,
    subtreeSpans,
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
