/**
 * FileUpload 의 **active 분기** — ADR-201 후속 (번들 축소). `FileUpload` 껍데기가 첫 파일 유입 때
 * `import("./FileUploadActive")` 로 한 번만 가져온다. 여기에 있는 것은 idle (디자인 타임) 에는
 * 필요 없는 것 전부다:
 *   - endpoint 해석 (`resolveUploadEndpoint` → vault placeholder 게이트 포함)
 *   - 서버 계약 §5 CSRF 쿠키 → 헤더
 *   - 엔진 옵션 조립 · 런타임 행 (RAC `GridList` + `ProgressBar` · 미리보기 · R1 에러 코드)
 *
 * 엔진 `@composition/upload/react` 는 여기서도 정적 import 하지 않는다 — 껍데기가 `loadEngine`
 * (기본 `loadUploadEngine`, 테스트 주입 가능) 으로 따로 가져와 `mod` 로 넘긴다. 그래서 endpoint 가
 * 막힌 경우 (E_UNAUTHORIZED · E_NO_ENDPOINT) 엔진은 로드되지 않는다 (m4).
 */
import type { UploadItemState, UploadQueueOptions } from "@composition/upload";

import type { UploadReactModule } from "../upload/loadUploadEngine";

import {
  resolveUploadEndpoint,
  type UploadEndpointResolution,
} from "../upload/resolveUploadEndpoint";

export { resolveUploadEndpoint };

export type { UploadEndpointResolution };

/** 미리보기 `<img>` 상한 (R4 — 파일 전체를 읽지 않지만 objectURL 디코드는 브라우저 메모리다). */
export const FILE_UPLOAD_PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

/**
 * 서버 계약 §5 "토큰 획득" — 세션 CSRF 토큰을 `XSRF-TOKEN` 쿠키 (Spring Security
 * CookieCsrfTokenRepository 관례, HttpOnly 아님) 로 받은 경우 `X-CSRF-TOKEN` 헤더로 되돌린다.
 * 쿠키가 없으면 헤더 0 — 서버가 CSRF 를 요구하면 403 → `E_UNAUTHORIZED` 로 드러난다.
 */
export function csrfHeadersFromCookie(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie ?? "");
  if (!match) return {};
  try {
    return { "X-CSRF-TOKEN": decodeURIComponent(match[1]) };
  } catch {
    return { "X-CSRF-TOKEN": match[1] };
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function toRetryDelays(
  value: ReadonlyArray<number | string> | undefined,
): number[] | undefined {
  if (!value) return undefined;
  const out = value
    .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return out.length > 0 ? out : undefined;
}

export function itemPercent(item: UploadItemState): number {
  if (item.status === "done") return 100;
  if (item.size <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((item.offset / item.size) * 100)),
  );
}

export function canPreview(file: File, showPreview: boolean): boolean {
  return (
    showPreview &&
    file.size <= FILE_UPLOAD_PREVIEW_MAX_BYTES &&
    /^image\/(png|jpeg|gif|webp|avif|bmp)$/i.test(file.type) // SVG/HTML 제외 (§3-6)
  );
}

/** 껍데기가 D2 props 그대로 넘기는 전송 설정 — 옵션 조립은 여기서. */
export interface UploadTransportConfig {
  resolution: UploadEndpointResolution;
  dryRun: boolean;
  chunkSize?: number;
  parallelUploads?: number;
  retryDelays?: ReadonlyArray<number | string>;
  maxFileSize?: number;
  autoProceed: boolean;
}

export function buildUploadQueueOptions(
  config: UploadTransportConfig,
): UploadQueueOptions {
  const { resolution } = config;
  return {
    endpoint: resolution.ok ? resolution.url : "dry-run:",
    headers: resolution.ok ? resolution.headers : undefined,
    chunkSize: config.chunkSize,
    parallelUploads: config.parallelUploads,
    retryDelays: toRetryDelays(config.retryDelays),
    maxFileSize:
      config.maxFileSize && config.maxFileSize > 0
        ? config.maxFileSize
        : undefined,
    autoProceed: config.autoProceed,
    withCredentials: true,
    getHeaders: csrfHeadersFromCookie,
    dryRun: config.dryRun,
  };
}

export interface FileUploadActiveProps {
  mod: UploadReactModule;
  config: UploadTransportConfig;
  pending: File[];
  onDrain: () => void;
  showPreview: boolean;
}
