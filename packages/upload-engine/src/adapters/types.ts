import type { HttpOp, UploadEvent, UploadState } from "../core/protocol/types";
import type { HttpDriver, HttpRequest, HttpResponse } from "../types";

/** OPTIONS 사전 점검 결과 — 서버가 광고한 능력 */
export interface AdapterCapabilities {
  extensions: string[];
  maxSize?: number;
  checksumAlgorithms: string[];
  terminate: boolean;
  /** PATCH 차단 감지로 override 로 전환됨 */
  overridePatch: boolean;
  /** 어댑터가 강제하는 청크 크기 (없으면 옵션 값) */
  chunkClamp?: number;
}

export interface AdapterContext {
  endpoint: string;
  file: File;
  state: UploadState;
  /** 정적 + `getHeaders()` 병합 결과 */
  headers: Record<string, string>;
  metadata: Record<string, string>;
  withCredentials: boolean;
}

export interface PreflightContext {
  endpoint: string;
  headers: Record<string, string>;
  driver: HttpDriver;
  withCredentials: boolean;
}

/**
 * 프로토콜 어댑터 — 상태기계의 추상 `http` command 를 실제 요청으로, 응답을 이벤트로.
 * 어댑터는 driver 를 직접 부르지 않는다 (preflight 제외) — 순수 변환 + 약간의 능력 상태.
 */
export interface WireAdapter {
  /** 단일 요청 어댑터 (create 가 곧 전송) */
  single?: boolean;
  preflight?(ctx: PreflightContext): Promise<AdapterCapabilities>;
  request(
    op: HttpOp,
    ctx: AdapterContext,
    range: { start: number; end: number },
    caps: AdapterCapabilities,
  ): Promise<HttpRequest> | HttpRequest;
  response(
    op: HttpOp,
    res: HttpResponse,
    ctx: AdapterContext,
    caps: AdapterCapabilities,
  ): UploadEvent;
}

export const DEFAULT_CAPABILITIES: AdapterCapabilities = {
  extensions: ["creation"],
  checksumAlgorithms: [],
  terminate: false,
  overridePatch: false,
};

/** 상대 `Location` → 절대 url */
export const absoluteUrl = (location: string, base: string): string => {
  try {
    return new URL(location, base).href;
  } catch {
    return location;
  }
};
