import type { FontMgr } from "canvaskit-wasm";

let editingElementId: string | null = null;

export function setEditingElementId(id: string | null): void {
  if (editingElementId === id) return;
  editingElementId = id;
}

export function getEditingElementId(): string | null {
  return editingElementId;
}

const BASE_PARAGRAPH_CACHE_SIZE = (() => {
  const env = import.meta.env.VITE_PARAGRAPH_CACHE_SIZE;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1000;
})();

/**
 * 프레임 내 paragraph 사용량 추적 — 상한의 동적 하한 (2026-07-30 텍스트 소실 수정).
 *
 * 한 walk 의 가시 텍스트 수가 상한을 넘으면 캐시가 **프레임마다 전량
 * 스래싱**한다 (실측: 가시 텍스트 1,416 > 구 고정 상한 1000). 스래싱은
 * paragraph 를 대량 delete/재생성하는데, delete 된 paragraph 의 WASM 힙
 * 주소가 새 paragraph 에 재사용되면 CanvasKit(Ganesh) 내부 텍스트 blob
 * 캐시가 stale 히트해 **그 텍스트가 조용히 소실**된다 — drawParagraph 는
 * 실행되고 같은 지점의 drawRect 는 화면에 나오는데 글리프만 안 나오는
 * 형태로 실측 확정 (2026-07-30, 5,046 요소 문서 줌 왕복). 상한을 프레임
 * 실사용량 위로 유지해 정상 경로에서 퇴거 자체가 일어나지 않게 한다.
 */
let paragraphDrawsThisFrame = 0;
let paragraphFramePeak = 0;

/** 프레임 시작 — SkiaRenderer.render() 진입 시 호출 */
export function beginParagraphFrame(): void {
  paragraphDrawsThisFrame = 0;
}

/** renderText 가 paragraph 를 그릴 때마다 호출 */
export function countParagraphDraw(): void {
  paragraphDrawsThisFrame++;
  if (paragraphDrawsThisFrame > paragraphFramePeak) {
    paragraphFramePeak = paragraphDrawsThisFrame;
  }
}

let lastParagraphFontMgr: FontMgr | null = null;

export function getLastParagraphFontMgr(): FontMgr | null {
  return lastParagraphFontMgr;
}

export function setLastParagraphFontMgr(fontMgr: FontMgr | null): void {
  lastParagraphFontMgr = fontMgr;
}

/**
 * 상한 = max(base, 프레임 피크 사용량 × 1.25).
 *
 * 프레임 피크보다 상한이 크면 한 프레임 안에서 LRU 퇴거가 발생하지 않아
 * "그리는 중인 프레임의 paragraph 를 지우는" 경로가 구조적으로 사라진다.
 * 메모리는 가시 텍스트 수에 비례 — 그 텍스트를 그리는 한 필요한 작업
 * 집합이다. 피크는 세션 단조 증가 (줄어드는 쪽으로는 조이지 않는다 —
 * 왕복 줌에서 상한이 출렁이면 다시 스래싱이 된다).
 */
export function getMaxParagraphCacheSize(): number {
  return Math.max(
    BASE_PARAGRAPH_CACHE_SIZE,
    Math.ceil(paragraphFramePeak * 1.25),
  );
}
