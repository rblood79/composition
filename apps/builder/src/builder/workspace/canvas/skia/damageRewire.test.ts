// @vitest-environment jsdom
// ADR-263 Phase 3 (G3) — damage 부분 재기록 재연결의 안전 조건:
//  - patch 전 · 후 어느 쪽이든 hit bounds 밖 paint 가 있으면 그 patch 는 full (review r1 H1)
//  - full 요청은 실제 full 재기록까지 남고 뒤 damage 가 덮지 못한다 (review r1 H2)

import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  clearSkiaRegistry,
  getSkiaNode,
  registerSkiaNode,
} from "./useSkiaNode";
import {
  clearNodePictureCache,
  getCachedNodePicture,
  storeNodePicture,
} from "./nodePictureCache";
import { resetRenderCounters, snapshotRenderCounters } from "./renderCounters";
import { buildRenderCommandStream } from "./renderCommands";
import { applyCommitSubtreeCommandPatch } from "./subtreeCommandPatch";
import { SkiaRenderer } from "./SkiaRenderer";
import type { BoundingBox } from "../selection/types";

const shadow = {
  box: {
    fillColor: Float32Array.of(1, 1, 1, 1),
    borderRadius: 0,
    shadows: [
      {
        type: "drop-shadow",
        color: Float32Array.of(0, 0, 0, 0.4),
        offsetX: -40,
        offsetY: 0,
        blur: 0,
        spread: 0,
        inner: false,
      },
    ],
  },
};

function scene(revision: number, leaf: Record<string, unknown> = {}) {
  const node = (id: string, parent: string | null) =>
    ({
      id,
      type: "Box",
      parent_id: parent,
      props: {},
    }) as unknown as CanvasSceneNode;
  const register = (id: string, over: Record<string, unknown> = {}) =>
    registerSkiaNode(id, {
      elementId: id,
      type: "box",
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ...over,
    } as never);
  register("body", { type: "container", width: 800, height: 600 });
  register("owner", { type: "container", width: 400, height: 300 });
  register("leaf", { width: 80, height: 40, ...leaf });
  return buildRenderCommandStream(
    ["body"],
    new Map([
      ["body", [node("owner", "body")]],
      ["owner", [node("leaf", "owner")]],
    ]),
    new Map([
      ["owner", { x: 20, y: 30, width: 400, height: 300 } as ComputedLayout],
      ["leaf", { x: 80, y: 70, width: 80, height: 40 } as ComputedLayout],
    ]),
    { body: { x: 0, y: 0 } },
    { presentationRevision: revision, baseCanonicalRevision: 0 },
  );
}

describe("ADR-263 Phase 3 — patch 전 · 후 hit bounds 밖 paint", () => {
  afterEach(() => clearSkiaRegistry());

  const patch = (
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => {
    const current = scene(0, before);
    clearSkiaRegistry();
    const replacement = scene(1, after);
    return applyCommitSubtreeCommandPatch({
      current,
      replacement,
      rootId: "leaf",
      revision: 1,
      canonicalRevision: 0,
    });
  };

  it("그림자 제거 (unsafe → safe) 는 hit bounds damage 로 충분하지 않다", () => {
    const result = patch(shadow, {});
    expect(result.applied).toBe(true);
    // damage 는 hit bounds (그림자 중심 x 60 은 밖) — 그래서 unsafePaint 로 full 이어야 한다.
    expect(result.damageBounds!.x).toBeGreaterThan(60);
    expect(result.unsafePaint).toBe(true);
  });

  it("그림자 추가 (safe → unsafe) 도 full", () => {
    expect(patch({}, shadow).unsafePaint).toBe(true);
  });

  it("양쪽 모두 hit bounds 안 paint 면 damage 로 간다", () => {
    const result = patch({}, { width: 90 });
    expect(result.unsafePaint).toBe(false);
    expect(result.damageBounds).toBeDefined();
  });
});

describe("ADR-263 Phase 3 — 무효화 상태 clean · damage · full", () => {
  /** 생성자 (GPU surface) 없이 무효화 상태와 판정 메서드만 쓴다 — 스냅샷 · standby 는 준비된 상태. */
  function renderer() {
    const r = Object.create(SkiaRenderer.prototype) as SkiaRenderer;
    Object.assign(r, {
      pendingDamage: null,
      pendingFull: false,
      contentDirty: false,
      contentSnapshot: {},
      standbySurface: {},
      standbyCanvas: {},
      standbyContentSynchronized: true,
      contentNode: { renderSkia() {}, renderDamageSkia: () => 1 },
      snapshotCamera: { zoom: 1, panX: 0, panY: 0 },
      transitionManager: null,
      animationEngine: null,
    });
    return r;
  }
  const camera = { zoom: 1, panX: 0, panY: 0 };
  const box = (x: number): BoundingBox => ({ x, y: 0, width: 10, height: 10 });
  const canDamage = (r: ReturnType<typeof renderer>) =>
    (
      r as unknown as { canRenderDamage(c: typeof camera): boolean }
    ).canRenderDamage(camera);

  it("full → damage: full 이 남는다", () => {
    const r = renderer();
    r.invalidateContent();
    r.invalidateContent(box(100));
    expect(canDamage(r)).toBe(false);
    expect((r as unknown as Record<string, unknown>).pendingFull).toBe(true);
  });

  it("damage → full: full 로 바뀐다", () => {
    const r = renderer();
    r.invalidateContent(box(100));
    expect(canDamage(r)).toBe(true);
    r.invalidateContent();
    expect(canDamage(r)).toBe(false);
  });

  it("full → damage × 3: full 이 남는다", () => {
    const r = renderer();
    r.invalidateContent();
    for (const x of [1, 50, 300]) r.invalidateContent(box(x));
    expect(canDamage(r)).toBe(false);
    expect((r as unknown as Record<string, unknown>).pendingDamage).toBeNull();
  });

  it("damage → damage: 합집합", () => {
    const r = renderer();
    r.invalidateContent(box(100));
    r.invalidateContent(box(300));
    expect(canDamage(r)).toBe(true);
    expect((r as unknown as Record<string, unknown>).pendingDamage).toEqual({
      x: 100,
      y: 0,
      width: 210,
      height: 10,
    });
  });

  it("빈 damage (다 잘린 변경) 는 다른 damage 를 원점으로 넓히지 않는다", () => {
    const r = renderer();
    const empty = { x: 0, y: 0, width: 0, height: 0 };
    r.invalidateContent(empty);
    r.invalidateContent(box(300));
    r.invalidateContent(empty);
    expect(canDamage(r)).toBe(true);
    expect((r as unknown as Record<string, unknown>).pendingDamage).toEqual(
      box(300),
    );
  });

  it("보간 (transition) 이 도는 동안은 damage 를 쓰지 않는다", () => {
    const r = renderer();
    (r as unknown as Record<string, unknown>).transitionManager = {
      isActive: () => true,
    };
    r.invalidateContent(box(100));
    expect(canDamage(r)).toBe(false);
  });
});

describe("ADR-263 Phase 5 — patch 검증 한 번 · 살아남는 노드 picture 유지", () => {
  afterEach(() => {
    clearSkiaRegistry();
    clearNodePictureCache();
    vi.unstubAllEnvs();
  });

  it("바뀌지 않은 요소의 picture 는 남고, 지운 요소의 picture 는 풀린다 · span 은 쪽마다 한 번 읽는다", () => {
    vi.stubEnv("NODE_ENV", "development");
    const node = (id: string, parent: string | null) =>
      ({
        id,
        type: "Box",
        parent_id: parent,
        props: {},
      }) as unknown as CanvasSceneNode;
    const build = (leaves: string[], revision: number) =>
      buildRenderCommandStream(
        ["body"],
        new Map([
          ["body", [node("owner", "body")]],
          ["owner", leaves.map((id) => node(id, "owner"))],
        ]),
        new Map([
          [
            "owner",
            { x: 20, y: 30, width: 400, height: 300 } as ComputedLayout,
          ],
          ["leaf", { x: 80, y: 70, width: 80, height: 40 } as ComputedLayout],
          ["leaf2", { x: 200, y: 70, width: 80, height: 40 } as ComputedLayout],
        ]),
        { body: { x: 0, y: 0 } },
        { presentationRevision: revision, baseCanonicalRevision: 0 },
      );
    scene(0, {}); // registers body · owner · leaf
    registerSkiaNode("leaf2", {
      ...getSkiaNode("leaf")!,
      elementId: "leaf2",
    } as never);
    const current = build(["leaf", "leaf2"], 0);
    const picture = () => ({ delete() {} }) as never;
    const owner = getSkiaNode("owner")!;
    const leaf = getSkiaNode("leaf")!;
    const leaf2 = getSkiaNode("leaf2")!;
    storeNodePicture("owner", owner, 400, 300, picture(), null);
    storeNodePicture("leaf", leaf, 80, 40, picture(), null);
    storeNodePicture("leaf2", leaf2, 80, 40, picture(), null);
    const replacement = build(["leaf"], 1); // leaf2 removed, owner · leaf unchanged
    resetRenderCounters();
    const currentSpan = current.subtreeSpans.get("owner")!;
    const replacementSpan = replacement.subtreeSpans.get("owner")!;
    const result = applyCommitSubtreeCommandPatch({
      current,
      replacement,
      rootId: "owner",
      revision: 1,
      canonicalRevision: 0,
    });
    expect(result.applied).toBe(true);
    expect(snapshotRenderCounters().patchScanCommands).toBe(
      currentSpan.end -
        currentSpan.start +
        replacementSpan.end -
        replacementSpan.start,
    );
    expect(getCachedNodePicture("owner", owner, 400, 300)).not.toBeNull();
    expect(getCachedNodePicture("leaf", leaf, 80, 40)).not.toBeNull();
    expect(getCachedNodePicture("leaf2", leaf2, 80, 40)).toBeNull();
  });
});
