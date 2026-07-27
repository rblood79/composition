/**
 * CanvasKit 리소스 수동 해제 관리
 *
 * CanvasKit의 C++ 힙 객체(Paint, Path, Surface, Image 등)는
 * JavaScript GC가 해제하지 않으므로 명시적으로 .delete()를 호출해야 한다.
 *
 * try/finally 패턴(방법 A)을 사용한다 — tsconfig ES2020 target에서
 * `using` 키워드 없이 동작한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.4 Disposable 패턴
 */

/** .delete() 메서드를 가진 CanvasKit 네이티브 객체 */
interface Deletable {
  delete(): void;
}

/**
 * CanvasKit 네이티브 객체의 수명을 스코프에 바인딩한다.
 *
 * 사용법:
 * ```ts
 * const scope = new SkiaDisposable();
 * try {
 *   const path = scope.track(new ck.Path());
 *   // ... path 사용. Paint 는 직접 생성하지 말고
 *   // paints.ts 의 acquireScopedPaint(scope, ck) 사용 (ADR-153 Phase 2)
 * } finally {
 *   scope.dispose();
 * }
 * ```
 */
export class SkiaDisposable {
  private resources: Deletable[] = [];

  /**
   * 리소스를 추적 대상에 추가하고 그대로 반환한다.
   * dispose() 시 추가 역순으로 delete()가 호출된다.
   */
  track<T extends Deletable>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }

  /** 추적 중인 모든 리소스를 역순으로 delete() 한다. */
  dispose(): void {
    for (let i = this.resources.length - 1; i >= 0; i--) {
      try {
        this.resources[i].delete();
      } catch {
        // 이미 삭제된 리소스는 무시
      }
    }
    this.resources.length = 0;
  }
}

// ============================================================
// 통합 캐시 해제 레지스트리 (ADR-153 Phase 2 — open-pencil lifecycle 패턴)
// ============================================================

/**
 * Skia 관련 모듈 캐시 (paint 풀 / imageCache 등) 의 해제 경로 단일화.
 *
 * 각 캐시 모듈이 자기 해제 콜백을 self-register 하고, 캔버스 teardown
 * (SkiaCanvas unmount) 이 `destroyAllSkiaCaches()` 단일 심볼만 호출한다.
 * Why: 해제 경로가 모듈별로 분산되면 신규 캐시 추가 시 teardown 누락이
 * 구조적으로 재발한다 (R2 — WASM 객체 누수).
 */
const cacheDestroyRegistry = new Map<string, () => void>();

export function registerSkiaCacheDestroy(
  name: string,
  destroy: () => void,
): void {
  cacheDestroyRegistry.set(name, destroy);
}

/**
 * 등록된 캐시 이름 목록.
 * 신규 캐시 모듈의 **등록 누락**을 정적 가드가 잡을 수 있게 레지스트리 자체를
 * 노출한다 (소스 문자열 검사로는 "아직 없는 파일"을 검사할 수 없다).
 */
export function getRegisteredSkiaCacheNames(): string[] {
  return [...cacheDestroyRegistry.keys()];
}

/** 등록된 모든 Skia 캐시를 해제한다 — 캔버스 teardown 의 단일 진입점. */
export function destroyAllSkiaCaches(): void {
  for (const destroy of cacheDestroyRegistry.values()) {
    try {
      destroy();
    } catch {
      // 개별 캐시 해제 실패가 나머지 해제를 막지 않도록 격리
    }
  }
}
