// @vitest-environment node
/**
 * paragraph 캐시 동적 상한 계약 (2026-07-30 텍스트 소실 수정).
 *
 * 한 프레임의 paragraph draw 수가 상한을 넘으면 캐시가 프레임마다 전량
 * 스래싱한다 — 대량 delete/재생성이 CanvasKit(Ganesh) 내부 텍스트 blob
 * 캐시의 stale 히트(WASM 힙 주소 재사용)를 유발해 해당 텍스트가 조용히
 * 소실된다 (2026-07-30 live 실측: drawParagraph 실행 + 같은 지점 drawRect
 * 는 표시되는데 글리프만 소실). 그래서 상한은 항상 **프레임 피크 사용량
 * 위**에 있어야 한다.
 */
import { describe, expect, it } from "vitest";

import {
  beginParagraphFrame,
  countParagraphDraw,
  getMaxParagraphCacheSize,
} from "./nodeRendererState";

describe("paragraph 캐시 동적 상한", () => {
  it("프레임 사용량이 base(1000) 이하면 base 를 유지한다", () => {
    beginParagraphFrame();
    for (let i = 0; i < 100; i++) countParagraphDraw();

    expect(getMaxParagraphCacheSize()).toBe(1000);
  });

  it("프레임 사용량이 base 를 넘으면 상한이 그 위(×1.25)로 커진다", () => {
    beginParagraphFrame();
    for (let i = 0; i < 1416; i++) countParagraphDraw(); // 실측 재현 규모

    const limit = getMaxParagraphCacheSize();
    expect(limit).toBeGreaterThanOrEqual(Math.ceil(1416 * 1.25));
    // 상한이 사용량보다 크므로 그 프레임 안에서 LRU 퇴거가 발생하지 않는다
    expect(limit).toBeGreaterThan(1416);
  });

  it("피크는 세션 단조 — 다음 프레임에 적게 그려도 상한이 줄지 않는다", () => {
    beginParagraphFrame();
    for (let i = 0; i < 2000; i++) countParagraphDraw();
    const grown = getMaxParagraphCacheSize();

    beginParagraphFrame(); // 새 프레임: 사용량 0부터
    for (let i = 0; i < 10; i++) countParagraphDraw();

    // 줄어드는 쪽으로 조이면 왕복 줌에서 상한이 출렁여 다시 스래싱이 된다
    expect(getMaxParagraphCacheSize()).toBe(grown);
  });
});
