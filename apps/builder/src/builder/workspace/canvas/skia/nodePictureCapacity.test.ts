// @vitest-environment node
/**
 * ADR-266 Phase 2 (L3) — picture 상한 = working set (사용자 결정 1, 2026-10-17).
 *
 * 1. 같은 visible set 을 연속 full 기록하면 warm 이 유지된다 (hit = 전부 · record 0 · 퇴거 0 · 상한 불변).
 * 2. 리뷰 r1 M2 반례 — 상한을 새 record 수로 잡으면 warm 프레임 (record 0) 에서 1,024 로 줄어 다음
 *    기록이 전부 miss 다. working set (hit + record) 기준이면 그렇지 않다.
 * 3. 처음 큰 화면도 기록 중에 자기 앞부분을 밀어내지 않는다.
 * 4. damage 기록은 상한을 바꾸지 않는다 · 줄이기는 60 회 연속 60 % 아래일 때만.
 * 5. 보유 바이트가 상한을 넘으면 working set 과 무관하게 퇴거한다 (해제는 지연 — Picture → drain).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkPicture } from "canvaskit-wasm";

import {
  beginNodePictureFullRecord,
  clearNodePictureCache,
  endNodePictureFullRecord,
  getCachedNodePicture,
  getNodePictureBytes,
  getNodePictureCacheSize,
  getNodePictureCapacity,
  MAX_NODE_PICTURE_BYTES,
  resetNodePictureCapacity,
  storeNodePicture,
} from "./nodePictureCache";
import { drainPendingWasmDisposals } from "./deferredDisposal";

const refs = new Map<string, object>();
const ref = (id: string) => {
  let r = refs.get(id);
  if (!r) refs.set(id, (r = { id }));
  return r;
};
const picture = (bytes = 250) =>
  ({
    delete: vi.fn(),
    approximateBytesUsed: () => bytes,
  }) as unknown as SkPicture;

/** content full 기록 한 번 — 요소마다 조회, miss 면 record (store). */
function fullRecord(ids: readonly string[], bytes?: number) {
  let hit = 0;
  let record = 0;
  beginNodePictureFullRecord();
  for (const id of ids) {
    if (getCachedNodePicture(id, ref(id), 10, 10)) hit += 1;
    else {
      storeNodePicture(id, ref(id), 10, 10, picture(bytes), null);
      record += 1;
    }
  }
  endNodePictureFullRecord();
  return { hit, record };
}

const range = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => `e${from + i}`);

beforeEach(() => {
  clearNodePictureCache();
  resetNodePictureCapacity();
  drainPendingWasmDisposals();
  refs.clear();
});

describe("ADR-266 picture 상한 = working set", () => {
  it("같은 1,370 요소를 연속 기록하면 warm 이 유지된다 (퇴거 0 · 상한 불변)", () => {
    const visible = range(0, 1370);
    expect(fullRecord(visible)).toEqual({ hit: 0, record: 1370 });
    const capacity = getNodePictureCapacity();
    expect(capacity).toBe(Math.ceil(1370 * 1.25));
    for (let i = 0; i < 5; i += 1) {
      expect(fullRecord(visible)).toEqual({ hit: 1370, record: 0 });
      expect(getNodePictureCapacity()).toBe(capacity);
      expect(getNodePictureCacheSize()).toBe(1370);
    }
  });

  it("리뷰 r1 M2 반례 — warm 프레임 (record 0) 뒤에도 다음 기록이 hit 이다", () => {
    const visible = range(0, 1370);
    fullRecord(visible);
    expect(fullRecord(visible)).toEqual({ hit: 1370, record: 0 });
    // 새 record 수 (0) 로 상한을 잡았다면 여기서 1,024 로 줄어 346 이 퇴거되고 다음이 전부 miss 다
    expect(getNodePictureCapacity()).toBeGreaterThanOrEqual(1370);
    expect(fullRecord(visible)).toEqual({ hit: 1370, record: 0 });
  });

  it("처음 3,961 요소 화면도 기록 중에 자기 앞부분을 밀어내지 않는다", () => {
    const visible = range(0, 3961);
    expect(fullRecord(visible).record).toBe(3961);
    expect(getNodePictureCacheSize()).toBe(3961);
    expect(fullRecord(visible)).toEqual({ hit: 3961, record: 0 });
  });

  it("화면이 바뀌면 지나간 요소부터 퇴거하고 지금 화면은 남긴다", () => {
    fullRecord(range(0, 2000));
    fullRecord(range(2000, 2000));
    expect(getNodePictureCacheSize()).toBeLessThanOrEqual(
      getNodePictureCapacity(),
    );
    expect(fullRecord(range(2000, 2000))).toEqual({ hit: 2000, record: 0 });
  });

  it("damage 기록 (full 구간 밖) 은 상한을 바꾸지 않는다", () => {
    fullRecord(range(0, 2000));
    const capacity = getNodePictureCapacity();
    for (const id of range(0, 10)) getCachedNodePicture(id, ref(id), 10, 10);
    expect(getNodePictureCapacity()).toBe(capacity);
  });

  it("줄이기는 60 회 연속 60 % 아래일 때만 (히스테리시스 — 줌 제스처의 확대 쪽 몇 프레임으로 줄지 않는다)", () => {
    const small = (n: number) => {
      for (let i = 0; i < n; i += 1) fullRecord(range(0, 100));
    };
    fullRecord(range(0, 3000));
    const capacity = getNodePictureCapacity();
    small(59);
    expect(getNodePictureCapacity()).toBe(capacity);
    fullRecord(range(0, 3000)); // 다시 큰 화면 — 연속이 끊긴다
    expect(fullRecord(range(0, 3000))).toEqual({ hit: 3000, record: 0 });
    small(59);
    expect(getNodePictureCapacity()).toBe(capacity);
    small(1);
    expect(getNodePictureCapacity()).toBe(1024);
    expect(getNodePictureCacheSize()).toBeLessThanOrEqual(1024);
  });

  it("보유 바이트가 상한을 넘으면 working set 과 무관하게 퇴거하고 해제는 drain 때", () => {
    const big = Math.ceil(MAX_NODE_PICTURE_BYTES / 100);
    const pictures: SkPicture[] = [];
    beginNodePictureFullRecord();
    for (const id of range(0, 120)) {
      getCachedNodePicture(id, ref(id), 10, 10);
      const p = picture(big);
      pictures.push(p);
      storeNodePicture(id, ref(id), 10, 10, p, null);
    }
    endNodePictureFullRecord();
    expect(getNodePictureBytes()).toBeLessThanOrEqual(MAX_NODE_PICTURE_BYTES);
    const first = pictures[0] as unknown as {
      delete: ReturnType<typeof vi.fn>;
    };
    expect(first.delete).not.toHaveBeenCalled();
    drainPendingWasmDisposals();
    expect(first.delete).toHaveBeenCalledTimes(1);
  });

  it("전량 폐기는 바이트 합을 0 으로", () => {
    fullRecord(range(0, 10));
    expect(getNodePictureBytes()).toBe(2500);
    clearNodePictureCache();
    expect(getNodePictureBytes()).toBe(0);
  });
});
