/// <reference types="vite/client" />

/**
 * Vite 환경변수 타입 정의
 *
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
interface ImportMetaEnv {
  /** 발급기 공개키 override (선택 — 기본은 소스 내장 `issuerPublicKey.ts`) */
  readonly VITE_LICENSE_PUBLIC_KEY?: string;
  /** API 기본 URL */
  readonly VITE_API_URL?: string;
  /** 디버그 로그 활성화 */
  readonly VITE_ENABLE_DEBUG_LOGS?: string;
  /** 🚀 Phase 10: WebGL Canvas 활성화 Feature Flag */
  readonly VITE_USE_WEBGL_CANVAS?: string;
  /** 캔버스 비교 모드 (iframe DOM ↔ Skia 캔버스 동시 표시 교차검증) */
  readonly VITE_CANVAS_COMPARE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
