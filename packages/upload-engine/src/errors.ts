/**
 * R1 에러 코드 표 — 단일 소스 (ADR-201 review round 1 m2).
 *
 * 어댑터 (HTTP 응답 → 코드) · mock TUS 서버 (코드 → 응답 status) · 서버 계약 문서
 * (`docs/reference/upload/server-contract.md`, 다른 worktree) 가 같은 표를 본다.
 * `errors.json` 은 이 표의 덤프 — `src/errors.table.test.ts` 가 동일성을 검사한다.
 */
import type { UploadError } from "./types";

export interface ErrorSpec {
  /** 이 코드로 분류되는 HTTP status. 첫 값이 서버가 내는 대표 status. `0` = 응답 없음 */
  status: readonly number[];
  retryable: boolean;
  /** 사용자 문구 i18n 키 (composition `upload.error.*`) */
  messageKey: string;
}

export const ERROR_TABLE = {
  E_PATCH_BLOCKED: {
    status: [405, 501],
    retryable: false,
    messageKey: "upload.error.patchBlocked",
  },
  E_PROXY_TIMEOUT: {
    status: [504, 408, 502],
    retryable: true,
    messageKey: "upload.error.proxyTimeout",
  },
  E_OFFSET_MISMATCH: {
    status: [409],
    retryable: true,
    messageKey: "upload.error.offsetMismatch",
  },
  E_TOO_LARGE: {
    status: [413],
    retryable: false,
    messageKey: "upload.error.tooLarge",
  },
  E_NETWORK: {
    status: [0],
    retryable: true,
    messageKey: "upload.error.network",
  },
  E_UNAUTHORIZED: {
    status: [401, 403],
    retryable: false,
    messageKey: "upload.error.unauthorized",
  },
  E_EXPIRED: {
    status: [410, 404],
    retryable: true,
    messageKey: "upload.error.expired",
  },
  E_CHECKSUM: {
    status: [460],
    retryable: true,
    messageKey: "upload.error.checksum",
  },
  E_REJECTED: {
    status: [400, 415, 422],
    retryable: false,
    messageKey: "upload.error.rejected",
  },
  E_SERVER: {
    status: [500, 503],
    retryable: true,
    messageKey: "upload.error.server",
  },
  E_CANCELLED: {
    status: [],
    retryable: false,
    messageKey: "upload.error.cancelled",
  },
} as const satisfies Record<string, ErrorSpec>;

export type KnownErrorCode = keyof typeof ERROR_TABLE;

/** 계약 문서용 설명 — 런타임 번들에 실리지 않는다 (tree-shake). `errors.json` 덤프에만 합쳐진다 */
export const ERROR_DESCRIPTIONS: Record<KnownErrorCode, string> = {
  E_PATCH_BLOCKED:
    "프록시/WAF 가 PATCH 를 차단 — `overridePatchMethod` (POST + X-HTTP-Method-Override: PATCH). 405 수신 시 1회 자동 전환 후에도 실패하면 이 코드",
  E_PROXY_TIMEOUT:
    "프록시 timeout (Apache `Timeout` 60s 등) 또는 클라이언트 `requestTimeout` — 다음 청크부터 chunkSize 를 절반으로 (하한 1MB)",
  E_OFFSET_MISMATCH:
    "`Upload-Offset` 불일치 — 대기 없이 HEAD 로 서버 offset 재동기",
  E_TOO_LARGE:
    "`Tus-Max-Size` / `maxFileSize` 초과 (클라이언트는 OPTIONS 값으로 선차단)",
  E_NETWORK:
    "응답 없음 — 연결 단절, DNS, 또는 CORS 거부 (credentials 모드에서 `Access-Control-Allow-Origin: *` 는 브라우저가 거부)",
  E_UNAUTHORIZED:
    "인증 실패 · 소유자 불일치 · CSRF 토큰 부재 — `getHeaders()` 로 토큰 제공",
  E_EXPIRED:
    "업로드 만료/소멸 (`Upload-Expires` 경과 · TTL GC) — 저장소 forget 후 처음부터 재생성",
  E_CHECKSUM:
    "`Upload-Checksum` 불일치 — 서버는 청크를 버리고, 클라이언트는 HEAD 후 같은 청크 재전송",
  E_REJECTED:
    "서버가 요청을 거부 — 파일명 traversal · 메타데이터 형식 · Content-Type · Upload-Defer-Length",
  E_SERVER: "서버 내부 오류 / 일시 불가 — backoff 재시도",
  E_CANCELLED: "사용자 취소 — termination 확장이 있으면 DELETE",
};

/** 서버가 코드에 대해 내는 대표 HTTP status */
export const statusOf = (code: KnownErrorCode): number =>
  (ERROR_TABLE[code].status as readonly number[])[0] ?? 0;

/** HTTP status → 코드 (표에 없는 4xx 는 E_REJECTED, 5xx 는 E_SERVER) */
export function codeOfStatus(status: number): KnownErrorCode {
  for (const code in ERROR_TABLE) {
    const st: readonly number[] = ERROR_TABLE[code as KnownErrorCode].status;
    if (st.includes(status)) return code as KnownErrorCode;
  }
  return status >= 500 ? "E_SERVER" : "E_REJECTED";
}

export function errorOf(
  code: KnownErrorCode,
  status?: number,
  message?: string,
): UploadError {
  const spec = ERROR_TABLE[code];
  return {
    code,
    status,
    message: message ?? spec.messageKey,
    retryable: spec.retryable,
  };
}

/** HTTP 응답을 에러로 분류 — 재개 url 이 없는 요청 (create) 의 404 는 만료가 아니라 거부 */
export function errorOfResponse(
  status: number,
  text: string | undefined,
  hasUrl: boolean,
): UploadError {
  let code = codeOfStatus(status);
  if (code === "E_EXPIRED" && !hasUrl) code = "E_REJECTED";
  return errorOf(code, status, text?.trim() || `HTTP ${status}`);
}
