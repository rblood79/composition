/**
 * Paint 풀 — 명시 acquire/release free-list (ADR-153 Phase 2)
 *
 * 렌더 hot path 의 `new ck.Paint()` / `.delete()` 반복 (프레임당 그리기 항목
 * 수만큼 WASM malloc/free) 을 풀 재사용으로 대체한다. open-pencil `paints.ts`
 * singleton 패턴의 등가 — 단 purpose-named singleton 대신 free-list 를 쓴다:
 * "configure 1회 후 루프에서 다수 draw" 형태 (workflowRenderer 4~9개 동시
 * 보유) 가 ring 재활용과 충돌하므로, 명시 release 만이 전 사이트에 안전하다.
 *
 * 사용 규약:
 * - `acquirePooledPaint(ck)` → fresh `new ck.Paint()` 와 동일한 기본 상태로
 *   리셋되어 반환 — 사이트는 기존처럼 필요한 setter 만 호출하면 된다.
 * - 사용 종료 시 `releasePooledPaint(paint)` — 기존 `.delete()` 자리 1:1 치환.
 * - `SkiaDisposable` scope 사이트는 `acquireScopedPaint(scope, ck)` — scope
 *   dispose 시점에 release 되는 shim 을 등록한다 (풀 paint 에 `.delete()` 금지).
 * - 풀 paint 를 프레임 경계 너머로 보유 금지 (모듈 상수 paint 필요 시 풀 밖에서
 *   직접 생성 — cold 분류).
 *
 * lifecycle: `registerSkiaCacheDestroy("paintPool", ...)` 로 통합 해제 경로에
 * 등록 — 캔버스 teardown 시 free-list 의 WASM Paint 전량 명시 `.delete()`.
 */

import type { CanvasKit, Paint } from "canvaskit-wasm";
import { getCacheMetrics } from "./cacheMetrics";
import { registerSkiaCacheDestroy } from "./disposable";

interface PaintScope {
  track<T extends { delete(): void }>(resource: T): T;
}

const freeList: Paint[] = [];
/** 생성 총량 (free + 대여 중) — teardown 후 잔존 대여 진단용 */
let createdCount = 0;
/** 현재 대여 중 수 — 0 이 아닌 상태의 teardown 은 release 누락 신호 */
let acquiredCount = 0;

/**
 * fresh `new ck.Paint()` 기본 상태로 복원한다.
 * 리셋 목록 = skia/ 디렉토리 사이트가 사용하는 setter 전수 (2026-07-27 감사:
 * color/style/antiAlias/strokeWidth/pathEffect/strokeCap/shader/imageFilter/
 * colorFilter/blendMode/alphaf/strokeJoin). setMaskFilter 는 사용 0건 —
 * 신규 사용 시 이 목록에 동시 추가할 것.
 */
function resetPaint(ck: CanvasKit, paint: Paint): void {
  paint.setAntiAlias(false);
  paint.setStyle(ck.PaintStyle.Fill);
  paint.setColor(ck.BLACK);
  paint.setStrokeWidth(0);
  paint.setStrokeCap(ck.StrokeCap.Butt);
  paint.setStrokeJoin(ck.StrokeJoin.Miter);
  paint.setBlendMode(ck.BlendMode.SrcOver);
  paint.setPathEffect(null);
  paint.setShader(null);
  paint.setImageFilter(null);
  paint.setColorFilter(null);
}

/** 풀에서 paint 를 대여한다 — fresh 기본 상태 보장. */
export function acquirePooledPaint(ck: CanvasKit): Paint {
  acquiredCount++;
  const pooled = freeList.pop();
  if (pooled) {
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("paintPool").recordHit();
    }
    resetPaint(ck, pooled);
    return pooled;
  }
  createdCount++;
  if (process.env.NODE_ENV === "development") {
    const metrics = getCacheMetrics("paintPool");
    metrics.recordMiss("grow");
    metrics.setSize(createdCount);
  }
  // 신규 생성은 이미 fresh 상태 — 리셋 불요
  return new ck.Paint();
}

/** 대여한 paint 를 풀에 반환한다 — 기존 `.delete()` 호출 자리 1:1 치환. */
export function releasePooledPaint(paint: Paint): void {
  acquiredCount--;
  freeList.push(paint);
}

/**
 * SkiaDisposable scope 연동 대여 — scope.dispose() 시점에 release 된다.
 * scope 에는 release shim 만 등록하므로 풀 paint 가 delete 되지 않는다.
 */
export function acquireScopedPaint(scope: PaintScope, ck: CanvasKit): Paint {
  const paint = acquirePooledPaint(ck);
  scope.track({ delete: () => releasePooledPaint(paint) });
  return paint;
}

/** 진단용 — dev HUD/테스트에서 풀 상태 관찰. */
export function getPaintPoolStats(): {
  created: number;
  free: number;
  acquired: number;
} {
  return {
    created: createdCount,
    free: freeList.length,
    acquired: acquiredCount,
  };
}

registerSkiaCacheDestroy("paintPool", () => {
  for (const paint of freeList) {
    paint.delete();
  }
  freeList.length = 0;
  if (
    process.env.NODE_ENV === "development" &&
    acquiredCount > 0 &&
    typeof console !== "undefined"
  ) {
    // teardown 시점 대여 잔존 = release 누락 (프레임 경계 너머 보유 금지 위반)
    console.warn(
      `[paintPool] destroy 시점 미반환 paint ${acquiredCount}건 — release 누락 의심`,
    );
  }
  createdCount = 0;
  acquiredCount = 0;
});
