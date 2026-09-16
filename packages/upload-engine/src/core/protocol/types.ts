import type { UploadError, UploadItemState } from "../../types";

/** 상태기계 내부 상태 — 공용 `UploadItemState` + 서버 커밋 offset · 전송 중 범위 · 만료 */
export interface UploadState extends UploadItemState {
  /** 서버가 커밋한 offset (`Upload-Offset` — 진실). `offset` 은 여기에 전송 중 바이트를 더한 힌트 */
  committed: number;
  /** 전송 중 청크 `[start, end)` */
  inflight?: { start: number; end: number };
  /** `Upload-Expires` epoch ms */
  expires?: number;
}

export type UploadEvent =
  /** 사용자 start / resume — attempt 리셋 */
  | { kind: "start" }
  /** `wait` 뒤 자동 재시도 — attempt 유지 */
  | { kind: "retry" }
  /** creation 응답 (201). `offset` 은 단일 요청 어댑터가 size 로 준다 */
  | { kind: "created"; url: string; offset?: number; expires?: number }
  /** 전송 진행 — 현재 요청 안의 누적 loaded */
  | { kind: "chunk-sent"; bytes: number }
  /** 서버 `Upload-Offset` (HEAD 또는 PATCH 204) — 진실 */
  | { kind: "offset"; offset: number; expires?: number }
  | { kind: "fail"; error: UploadError }
  | { kind: "pause" }
  | { kind: "cancel" };

export type HttpOp = "create" | "head" | "patch" | "delete";

export type Command =
  | { kind: "http"; op: HttpOp; start?: number; end?: number; url?: string }
  | { kind: "persist"; fingerprint: string; url: string; expires?: number }
  | { kind: "forget"; fingerprint: string }
  | { kind: "wait"; ms: number }
  /** 전송 중 요청 중단 */
  | { kind: "abort" };

export interface ProtocolConfig {
  chunkSize: number;
  /** 길이 = 최대 연속 실패 허용 횟수 */
  retryDelays: number[];
  /** epoch ms — 만료 판정 (순수성 유지를 위해 주입) */
  now: number;
  /** `termination` 확장 활성 — cancel 시 DELETE */
  terminate?: boolean;
  /** 단일 요청 어댑터 (multipart) — create 가 곧 전송, 재개 없음 */
  single?: boolean;
}
