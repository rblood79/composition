/**
 * ADR-201 — `@composition/upload/react` lazy 로더 (HC1: builder/preview 초기 chunk 에 엔진 0).
 *
 * 엔진은 **첫 파일 선택 시** 한 번만 `import()` 한다. 실패 (패키지 부재 · 네트워크 · 브라우저가
 * bare specifier 를 못 푸는 경우) 는 throw 하지 않고 `null` 로 떨어져 `FileUpload` 가
 * "엔진 미로드" 안전 상태 (정적 UI 유지 · `E_ENGINE_UNAVAILABLE` 표시 · console error 0) 를
 * 그린다. 결과는 캐시된다 — 실패도 캐시하므로 같은 페이지에서 재시도하려면
 * `resetUploadEngineLoaderForTests()` (테스트 전용).
 */

export type UploadReactModule = typeof import("@composition/upload/react");
export type UploadEngineLoader = () => Promise<UploadReactModule | null>;

let cached: Promise<UploadReactModule | null> | null = null;

function isUploadReactModule(value: unknown): value is UploadReactModule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { useUploadQueue?: unknown }).useUploadQueue === "function"
  );
}

export const loadUploadEngine: UploadEngineLoader = () => {
  if (!cached) {
    cached = import("@composition/upload/react")
      .then((mod: unknown) => (isUploadReactModule(mod) ? mod : null))
      .catch(() => null);
  }
  return cached;
};

/** 테스트 전용 — 캐시된 로드 결과를 버린다. */
export function resetUploadEngineLoaderForTests(): void {
  cached = null;
}
