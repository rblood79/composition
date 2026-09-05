/**
 * ADR-198 하니스 — tester 페이지에 **Preview 와 같은 폰트**를 싣는다.
 *
 * 두 leg 의 폰트 문맥이 다르다는 것이 오래 가려져 있었다:
 *
 * - Preview leg 은 `preview.html` 번들을 iframe 으로 띄우므로 앱 CSS
 *   (`pretendard/dist/web/static/pretendard.css`) 가 같이 실린다.
 * - Skia leg 의 측정은 **tester 페이지**의 Canvas 2D 에서 일어나는데 (ADR-051 —
 *   레이아웃 측정 oracle 은 Canvas 2D), 그 페이지에는 앱 CSS 가 없다.
 *
 * 그래서 같은 `fontFamily: "Pretendard"` 가 leg 마다 다른 metric 으로 잡혔다. 실측
 * (2026-09-05): tester 페이지에서 Pretendard 14px 는 폴백 metric 255px, Preview iframe
 * 은 실제 Pretendard 로 260px 을 넘겨 줄 수가 갈렸다. 이 격차는 ADR-205 Phase 4 가
 * 인라인 fontSize 결손을 고치기 전까지, 그 결손이 Skia 를 16px(291px)로 부풀려
 * **우연히 상쇄**하고 있었다.
 *
 * 폰트 로드는 lazy 라 `@font-face` 를 넣는 것만으로는 부족하다 — 쓰이는 face 를
 * 명시적으로 요청하고 기다린다.
 */
import "pretendard/dist/web/static/pretendard.css";

/** 픽스처가 쓰는 face. 크기는 로딩과 무관하고 weight·style 만 face 를 가른다. */
const FACES = [
  '400 16px "Pretendard"',
  '500 16px "Pretendard"',
  '600 16px "Pretendard"',
  '700 16px "Pretendard"',
] as const;

await Promise.all(FACES.map((f) => document.fonts.load(f)));
await document.fonts.ready;
