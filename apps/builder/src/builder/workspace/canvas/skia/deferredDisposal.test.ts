// @vitest-environment node
/**
 * 프레임 중 WASM `.delete()` 금지 계약 (ADR-174 Phase 1, G3).
 *
 * `canvas.drawPicture` / `drawParagraph` 는 surface flush 까지 deferred 라,
 * 같은 walk 안에서 LRU 퇴거/교체/무효화가 이미 그려진 객체를 즉시 delete 하면
 * 그 노드의 self-draw 나 그 텍스트의 글리프가 화면에서 조용히 소실된다
 * (에러도 로그도 없다 — ADR-174 Context 의 병리).
 *
 * 계약: 캐시가 유발하는 폐기는 즉시 delete 가 아니라 `deferredDisposal` 큐에
 * 쌓이고, drain 시점(프레임 flush 후 / 프레임 밖 일괄 정리)에만 실제 delete
 * 된다.
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
  scheduleWasmDisposal,
} from "./deferredDisposal";
import { destroyAllSkiaCaches } from "./disposable";

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

describe("큐 적체 방지 — 프레임 밖 경로는 스스로 배수한다 (R3)", () => {
  it("teardown 레지스트리 경유 해제는 pending 을 남기지 않는다", () => {
    // hidden 탭에서 rAF 가 멈추면 render() finally 의 drain 이 오지 않는다.
    // 프레임 밖 일괄 정리 경로가 스스로 배수하지 않으면 큐가 그대로 적체한다.
    const a = makePicture();
    storeNodePicture("el-a", DATA_REF, 10, 10, a, null);
    scheduleWasmDisposal(makePicture());

    destroyAllSkiaCaches();

    expect(getPendingWasmDisposalCount()).toBe(0);
    expect(a.delete).toHaveBeenCalledTimes(1);
  });
});
