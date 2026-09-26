/**
 * 런타임 오류 목록 — 잡히지 않은 error 와 unhandled rejection 을 페이지 안에 모은다.
 *
 * 하니스 (Playwright `pageerror`) 밖에서는 오류가 콘솔에만 흘러가 Chrome MCP 세션이나
 * `/evaluate` 가 "동작 중 오류 0" 을 판정할 근거가 없었다. dev 빌드에서만
 * `window.__composition_RUNTIME_ERRORS__` 로 읽힌다 (production 은 등록만 하고 노출 0,
 * 네트워크 전송 0). 출처: Chrome case study CyberAgent — 전 컴포넌트 순회 오류 감사.
 */

export type RuntimeErrorKind = "error" | "unhandledrejection";

export interface RuntimeErrorEntry {
  /** 설치 이후 누적 번호 — 상한으로 버린 항목도 센다. */
  seq: number;
  kind: RuntimeErrorKind;
  message: string;
  stack?: string;
  atMs: number;
}

export const RUNTIME_ERROR_LOG_LIMIT = 50;
const STACK_LINES = 8;

let entries: RuntimeErrorEntry[] = [];
let nextSeq = 0;
let installed = false;

function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return {
      message: `${reason.name}: ${reason.message}`,
      stack: reason.stack?.split("\n").slice(0, STACK_LINES).join("\n"),
    };
  }
  return { message: String(reason) };
}

export function recordRuntimeError(
  kind: RuntimeErrorKind,
  reason: unknown,
): void {
  entries.push({
    seq: nextSeq++,
    kind,
    ...describe(reason),
    atMs: Math.round(
      typeof performance === "undefined" ? Date.now() : performance.now(),
    ),
  });
  if (entries.length > RUNTIME_ERROR_LOG_LIMIT) {
    entries = entries.slice(entries.length - RUNTIME_ERROR_LOG_LIMIT);
  }
}

export function readRuntimeErrors(): readonly RuntimeErrorEntry[] {
  return entries;
}

/** 페이지당 한 번 등록. */
export function startRuntimeErrorLog(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    recordRuntimeError("error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordRuntimeError("unhandledrejection", event.reason);
  });
  if (import.meta.env?.DEV) {
    (
      window as unknown as Record<string, unknown>
    ).__composition_RUNTIME_ERRORS__ = {
      read: readRuntimeErrors,
      count: () => nextSeq,
    };
  }
}

/** 테스트용. */
export function resetRuntimeErrorLog(): void {
  entries = [];
  nextSeq = 0;
}
