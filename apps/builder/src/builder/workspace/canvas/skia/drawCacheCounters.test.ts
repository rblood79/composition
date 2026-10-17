// @vitest-environment node
/**
 * ADR-266 Phase 0 — 그리기 캐시의 사유별 카운터 (동작 무변경 · 세기만).
 *
 * 1. picture `cold` miss 를 처음 · 퇴거 · 재바인드 해제 · 무효화 · 전량 폐기로 가른다.
 * 2. paragraph miss 를 처음 · 슬롯 해제 뒤 · 키 · fontMgr 로 가른다.
 * 3. 재바인드 해제 구간의 `unregisterSkiaNode` 가 버린 picture · paragraph 를 사유별로 세고,
 *    새 bind 가 같은 id 로 등록한 데이터가 그리기 내용이 같은지 센다 (인계 가능량의 상한).
 * 4. `sameDrawData` 는 최상위 x · y 만 빼고 깊이 비교한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FontMgr, Paragraph, SkPicture } from "canvaskit-wasm";

import type { SkiaNodeData } from "./nodeRendererTypes";
import {
  clearNodePictureCache,
  getCachedNodePicture,
  invalidateNodePicture,
  storeNodePicture,
} from "./nodePictureCache";
import {
  lastParagraphMissReason,
  releaseParagraphsIn,
  resolveRetainedParagraph,
  retainParagraph,
} from "./retainedParagraph";
import { drainPendingWasmDisposals } from "./deferredDisposal";
import { resetRenderCounters, snapshotRenderCounters } from "./renderCounters";
import {
  beginRebindRelease,
  clearSkiaRegistry,
  endRebindRelease,
  getSkiaNode,
  registerMovedSkiaNode,
  registerSkiaNode,
  unregisterSkiaNode,
} from "./useSkiaNode";
import { sameDrawData } from "./sameDrawData";

const picture = () =>
  ({ delete: vi.fn(), approximateBytesUsed: () => 0 }) as unknown as SkPicture;
const paragraph = () => ({ delete: vi.fn() }) as unknown as Paragraph;
const FONT_MGR = { id: "fm-1" } as unknown as FontMgr;
const OTHER_FONT_MGR = { id: "fm-2" } as unknown as FontMgr;

function textNode(id: string, content = "hello"): SkiaNodeData {
  return {
    elementId: id,
    type: "text",
    x: 10,
    y: 20,
    width: 100,
    height: 20,
    visible: true,
    text: { content, fontSize: 14, color: Float32Array.of(0, 0, 0, 1) },
  } as unknown as SkiaNodeData;
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  clearSkiaRegistry();
  clearNodePictureCache();
  drainPendingWasmDisposals();
  resetRenderCounters();
});

afterEach(() => {
  endRebindRelease();
  vi.unstubAllEnvs();
});

describe("picture cold 사유", () => {
  it("처음 · 무효화 · 재바인드 해제 · 전량 폐기를 가른다", () => {
    const data = textNode("a");
    expect(getCachedNodePicture("a", data, 100, 20)).toBeNull();
    storeNodePicture("a", data, 100, 20, picture(), null);
    expect(getCachedNodePicture("a", data, 100, 20)).not.toBeNull();

    invalidateNodePicture("a");
    expect(getCachedNodePicture("a", data, 100, 20)).toBeNull();

    storeNodePicture("a", data, 100, 20, picture(), null);
    invalidateNodePicture("a", "released");
    expect(getCachedNodePicture("a", data, 100, 20)).toBeNull();

    storeNodePicture("a", data, 100, 20, picture(), null);
    clearNodePictureCache();
    expect(getCachedNodePicture("a", data, 100, 20)).toBeNull();

    const counters = snapshotRenderCounters();
    expect({
      first: counters.pictureColdFirst,
      invalidated: counters.pictureColdInvalidated,
      released: counters.pictureColdReleased,
      cleared: counters.pictureColdCleared,
      evicted: counters.pictureColdEvicted,
    }).toEqual({
      first: 1,
      invalidated: 1,
      released: 1,
      cleared: 1,
      evicted: 0,
    });
  });

  it("상한 초과로 퇴거된 id 의 다음 miss 는 evicted 다", () => {
    const refs = Array.from({ length: 1025 }, (_, i) => textNode(`n${i}`));
    refs.forEach((data, i) =>
      storeNodePicture(`n${i}`, data, 100, 20, picture(), null),
    );
    const counters = snapshotRenderCounters();
    // 넘으면 상한 (1,024) 의 90 % 까지 한 번에 — 1,025 − 921
    expect(counters.pictureEvictions).toBe(104);
    expect(getCachedNodePicture("n0", refs[0], 100, 20)).toBeNull();
    expect(snapshotRenderCounters().pictureColdEvicted).toBe(1);
  });
});

describe("paragraph miss 사유", () => {
  it("처음 · 키 · fontMgr · 슬롯 해제 뒤를 가른다", () => {
    const node = textNode("t");
    expect(resolveRetainedParagraph(node, "k1", FONT_MGR)).toBeUndefined();
    expect(lastParagraphMissReason()).toBe("first");

    retainParagraph(node, paragraph(), "k1", FONT_MGR, 0);
    expect(resolveRetainedParagraph(node, "k2", FONT_MGR)).toBeUndefined();
    expect(lastParagraphMissReason()).toBe("key");

    retainParagraph(node, paragraph(), "k1", FONT_MGR, 0);
    expect(
      resolveRetainedParagraph(node, "k1", OTHER_FONT_MGR),
    ).toBeUndefined();
    expect(lastParagraphMissReason()).toBe("fontMgr");

    retainParagraph(node, paragraph(), "k1", FONT_MGR, 0);
    expect(releaseParagraphsIn(node)).toBe(1);
    const replacement = textNode("t");
    expect(
      resolveRetainedParagraph(replacement, "k1", FONT_MGR),
    ).toBeUndefined();
    expect(lastParagraphMissReason()).toBe("released");

    retainParagraph(replacement, paragraph(), "k1", FONT_MGR, 0);
    expect(releaseParagraphsIn(replacement)).toBe(1);
    expect(releaseParagraphsIn(replacement)).toBe(0);
  });
});

describe("재바인드 해제 구간", () => {
  it("버린 picture · paragraph 를 사유별로 세고 같은 내용의 재등록을 센다", () => {
    const a = textNode("a");
    const b = textNode("b");
    registerSkiaNode("a", a);
    registerSkiaNode("b", b);
    storeNodePicture("a", a, 100, 20, picture(), null);
    retainParagraph(a, paragraph(), "k", FONT_MGR, 0);

    beginRebindRelease("page-grid");
    unregisterSkiaNode("a");
    unregisterSkiaNode("b");
    // 새 bind: a 는 자리만 옮긴 같은 내용, b 는 글자가 바뀌었다
    registerSkiaNode("a", { ...textNode("a"), x: 400, y: 900 });
    registerSkiaNode("b", textNode("b", "changed"));
    endRebindRelease();

    let counters = snapshotRenderCounters();
    expect({
      pictures: counters.rebindReleasedPicturesPageGrid,
      paragraphs: counters.rebindReleasedParagraphsPageGrid,
      other: counters.rebindReleasedPicturesOther,
      reregistered: counters.rebindReregistered,
      same: counters.rebindSameContent,
    }).toEqual({
      pictures: 1,
      paragraphs: 1,
      other: 0,
      reregistered: 2,
      same: 1,
    });
    // 해제는 지금처럼 일어난다 (세기만 한다)
    expect(getCachedNodePicture("a", getSkiaNode("a")!, 100, 20)).toBeNull();
    expect(snapshotRenderCounters().pictureColdReleased).toBe(1);

    // 구간 밖 unregister 는 재바인드 몫에 더하지 않는다
    resetRenderCounters();
    unregisterSkiaNode("a");
    counters = snapshotRenderCounters();
    expect(counters.rebindReleasedPicturesPageGrid).toBe(0);
    expect(counters.rebindReleasedParagraphsOther).toBe(0);
  });

  it("page-grid 밖 사유는 Other 에 센다", () => {
    const a = textNode("a");
    registerSkiaNode("a", a);
    storeNodePicture("a", a, 100, 20, picture(), null);
    beginRebindRelease("verify");
    unregisterSkiaNode("a");
    endRebindRelease();
    expect(snapshotRenderCounters().rebindReleasedPicturesOther).toBe(1);
  });
});

describe("ADR-266 Phase 4 — 자리만 옮긴 노드", () => {
  it("내용이 같으면 picture 가 새 데이터로 따라간다 · 다르면 버린다", () => {
    const a = textNode("a");
    registerSkiaNode("a", a);
    storeNodePicture("a", a, 100, 20, picture(), null);
    const moved = { ...textNode("a"), x: 400, y: 900 };
    registerMovedSkiaNode("a", moved);
    expect(getSkiaNode("a")).toBe(moved);
    expect(getCachedNodePicture("a", moved, 100, 20)).not.toBeNull();

    const changed = { ...textNode("a", "changed"), x: 0 };
    registerMovedSkiaNode("a", changed);
    expect(getSkiaNode("a")).toBe(changed);
    expect(getCachedNodePicture("a", changed, 100, 20)).toBeNull();
  });
});

describe("sameDrawData", () => {
  it("최상위 x · y 만 무시하고 나머지는 깊이 비교한다", () => {
    const base = textNode("a");
    expect(sameDrawData(base, { ...textNode("a"), x: 99, y: -4 })).toBe(true);
    expect(sameDrawData(base, { ...textNode("a"), width: 101 })).toBe(false);
    expect(sameDrawData(base, textNode("a", "other"))).toBe(false);
    const color = {
      ...textNode("a"),
      text: { ...base.text!, color: Float32Array.of(0, 0, 0, 0.5) },
    } as SkiaNodeData;
    expect(sameDrawData(base, color)).toBe(false);
  });

  it("자식의 위치는 그림의 일부다", () => {
    const parent = (childX: number) =>
      ({
        ...textNode("p"),
        children: [{ ...textNode("c"), x: childX }],
      }) as SkiaNodeData;
    expect(sameDrawData(parent(0), parent(0))).toBe(true);
    expect(sameDrawData(parent(0), parent(5))).toBe(false);
  });

  it("평범한 객체가 아닌 값 (이미지 핸들) 은 identity 로 비교한다", () => {
    class Handle {}
    const image = new Handle();
    const withImage = (handle: object) =>
      ({
        ...textNode("i"),
        image: { bitmap: handle },
      }) as unknown as SkiaNodeData;
    expect(sameDrawData(withImage(image), withImage(image))).toBe(true);
    expect(sameDrawData(withImage(image), withImage(new Handle()))).toBe(false);
  });

  it("값이 undefined 인 키는 없는 키와 같다", () => {
    const base = textNode("a");
    expect(
      sameDrawData(base, {
        ...textNode("a"),
        effects: undefined,
      } as SkiaNodeData),
    ).toBe(true);
  });
});
