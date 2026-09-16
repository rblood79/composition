import type { HttpDriver, HttpRequest, HttpResponse } from "../../types";
import { transportError } from "./errors";

/**
 * Node / Electron main / 브라우저 폴백 driver — `fetch`.
 * 진행률 콜백 없음 (`onProgress` 미호출 — 청크 완료 시 `offset` 이벤트로만 진행).
 * timeout 은 `AbortSignal.timeout` (Node 20.3+ / Chrome 116+) — `TimeoutError` → `E_PROXY_TIMEOUT`.
 */
export function createFetchDriver(
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): HttpDriver {
  return {
    async send(req: HttpRequest): Promise<HttpResponse> {
      const signals = [
        req.signal,
        req.timeout ? AbortSignal.timeout(req.timeout) : undefined,
      ].filter(Boolean) as AbortSignal[];
      let res: Response;
      try {
        res = await fetchImpl(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body ?? undefined,
          credentials:
            req.withCredentials === false ? "same-origin" : "include",
          signal: signals.length ? AbortSignal.any(signals) : undefined,
        });
      } catch (e) {
        const name = (e as Error)?.name;
        throw transportError(
          name === "TimeoutError"
            ? "E_PROXY_TIMEOUT"
            : name === "AbortError"
              ? "E_ABORTED"
              : "E_NETWORK",
          (e as Error)?.message ?? "network error",
          name !== "AbortError",
        );
      }
      const text =
        req.method === "HEAD"
          ? undefined
          : await res.text().catch(() => undefined);
      return { status: res.status, header: (n) => res.headers.get(n), text };
    },
  };
}
