import type { UploadError } from "../../types";

/** driver 가 reject 하는 전송 실패 — `UploadError` 형태 그대로 (Error 상속 없음, 크기 절약) */
export interface TransportError extends UploadError {
  transport: true;
}

export const transportError = (
  code: string,
  message: string,
  retryable = true,
): TransportError => ({ transport: true, code, message, retryable });

export const isTransportError = (e: unknown): e is TransportError =>
  !!e && typeof e === "object" && (e as TransportError).transport === true;
