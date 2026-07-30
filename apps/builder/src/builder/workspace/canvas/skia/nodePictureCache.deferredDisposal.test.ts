// @vitest-environment node
/**
 * 노드 Picture 캐시 — 프레임 중 `.delete()` 금지 계약 (2026-07-30).
 *
 * `canvas.drawPicture` 는 surface flush 까지 deferred 라, 같은 walk 안에서
 * LRU 퇴거/교체가 이미 그려진 Picture 를 즉시 delete 하면 그 노드의
 * self-draw 가 화면에서 소실된다 (5,046 요소 문서에서 evict 30만 회 실측 —
 * "텍스트가 불특정하게 렌더되지 않는" 사용자 보고의 병리 절반).
 *
 * 계약: store/invalidate/clear 가 유발하는 Picture 폐기는 즉시 delete 가
 * 아니라 `deferredDisposal` 큐에 쌓이고, drain 시점(프레임 flush 후)에만
 * 실제 delete 된다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkPicture } from "canvaskit-wasm";

import {
  clearNodePictureCache,
  getNodePictureCacheSize,
  invalidateNodePicture,
  storeNodePicture,
} from "./nodePictureCache";
import {
  drainPendingWasmDisposals,
  getPendingWasmDisposalCount,
} from "./deferredDisposal";

function makePicture(): SkPicture & { delete: ReturnType<typeof vi.fn> } {
  return { delete: vi.fn() } as unknown as SkPicture & {
    delete: ReturnType<typeof vi.fn>;
  };
}

const DATA_REF = { marker: "data" };

beforeEach(() => {
  clearNodePictureCache();
  drainPendingWasmDisposals();
});

describe("nodePictureCache — 폐기는 drain 시점까지 미뤄진다", () => {
  it("교체 store 는 이전 Picture 를 즉시 delete 하지 않는다", () => {
    const first = makePicture();
    const second = makePicture();
    storeNodePicture("el-1", DATA_REF, 10, 10, first, null);
    storeNodePicture("el-1", DATA_REF, 10, 10, second, null);

    // 같은 프레임(walk) 안 — first 는 이미 drawPicture 로 제출됐을 수 있다
    expect(first.delete).not.toHaveBeenCalled();
    expect(getPendingWasmDisposalCount()).toBeGreaterThan(0);

    drainPendingWasmDisposals();
    expect(first.delete).toHaveBeenCalledTimes(1);
    expect(second.delete).not.toHaveBeenCalled();
  });

  it("invalidateNodePicture 도 delete 를 미룬다", () => {
    const picture = makePicture();
    storeNodePicture("el-1", DATA_REF, 10, 10, picture, null);
    invalidateNodePicture("el-1");

    expect(picture.delete).not.toHaveBeenCalled();
    drainPendingWasmDisposals();
    expect(picture.delete).toHaveBeenCalledTimes(1);
  });

  it("상한 초과 LRU 퇴거도 delete 를 미룬다 (walk 중 use-after-free 차단)", () => {
    const MAX = 1024; // nodePictureCache.MAX_NODE_PICTURES
    const pictures: ReturnType<typeof makePicture>[] = [];
    for (let i = 0; i <= MAX; i++) {
      const p = makePicture();
      pictures.push(p);
      storeNodePicture(`el-${i}`, DATA_REF, 10, 10, p, null);
    }

    expect(getNodePictureCacheSize()).toBe(MAX);
    // 가장 오래된 entry 가 퇴거됐지만 delete 는 아직이다
    const evicted = pictures[0];
    expect(evicted.delete).not.toHaveBeenCalled();

    drainPendingWasmDisposals();
    expect(evicted.delete).toHaveBeenCalledTimes(1);
    // 살아 있는 entry 는 건드리지 않는다
    expect(pictures[MAX].delete).not.toHaveBeenCalled();
  });

  it("clearNodePictureCache 도 delete 를 미룬다 (walk 초입 fontMgr 교체 경로)", () => {
    const a = makePicture();
    const b = makePicture();
    storeNodePicture("el-a", DATA_REF, 10, 10, a, null);
    storeNodePicture("el-b", DATA_REF, 10, 10, b, null);

    clearNodePictureCache();
    expect(getNodePictureCacheSize()).toBe(0);
    expect(a.delete).not.toHaveBeenCalled();
    expect(b.delete).not.toHaveBeenCalled();

    drainPendingWasmDisposals();
    expect(a.delete).toHaveBeenCalledTimes(1);
    expect(b.delete).toHaveBeenCalledTimes(1);
  });

  it("drain 은 큐를 비운다 — 이중 delete 없음", () => {
    const picture = makePicture();
    storeNodePicture("el-1", DATA_REF, 10, 10, picture, null);
    invalidateNodePicture("el-1");

    drainPendingWasmDisposals();
    drainPendingWasmDisposals();
    expect(picture.delete).toHaveBeenCalledTimes(1);
    expect(getPendingWasmDisposalCount()).toBe(0);
  });
});
