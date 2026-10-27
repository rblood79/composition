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
  /** ADR-235 — 자산 저장 writer 활성 (builder/config/assetStorage.ts) */
  readonly VITE_ASSET_WRITER?: string;
  /** "1" = a production build that exposes the live harness handle (ADR-248 G5 paired runs). */
  readonly VITE_COMPOSITION_HARNESS?: string;
  /** 캔버스 비교 모드 (iframe DOM ↔ Skia 캔버스 동시 표시 교차검증) */
  readonly VITE_CANVAS_COMPARE_MODE?: string;
  /** CSS Preview 클릭 → Canvas 선택 동기화 (기본 false). */
  readonly VITE_ENABLE_HITAREA_MODE?: string;
}

/** 이 빌드의 식별자 — dist 루트 `version.json` 과 같은 값 (ADR-244 옛 배포 판정). dev 는 "dev". */
declare const __BUILD_ID__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
