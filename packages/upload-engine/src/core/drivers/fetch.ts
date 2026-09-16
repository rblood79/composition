import type { HttpDriver, HttpRequest, HttpResponse } from "../../types";
import { transportError } from "./errors";

/**
 * Node / Electron main / 브라우저 폴백 driver — `fetch`.
 * 진행률 콜백 없음 (`onProgress` 미호출 — 청크 완료 시 `offset` 이벤트로만 진행).
 */
export function createFetchDriver(
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): HttpDriver {
  return {
    async send(req: HttpRequest): Promise<HttpResponse> {
      const ctl = new AbortController();
      let timedOut = false;
      const onAbort = () => ctl.abort();
      req.signal?.addEventListener("abort", onAbort);
      const timer = req.timeout
        ? setTimeout(() => {
            timedOut = true;
            ctl.abort();
          }, req.timeout)
        : undefined;
      let res: Response;
      try {
        res = await fetchImpl(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body ?? undefined,
          credentials:
            req.withCredentials === false ? "same-origin" : "include",
          signal: ctl.signal,
        });
      } catch (e) {
        if (timedOut)
          throw transportError("E_PROXY_TIMEOUT", "request timeout");
        if ((e as Error)?.name === "AbortError") {
          throw transportError("E_ABORTED", "aborted", false);
        }
        throw transportError(
          "E_NETWORK",
          (e as Error)?.message ?? "network error",
        );
      } finally {
        if (timer) clearTimeout(timer);
        req.signal?.removeEventListener("abort", onAbort);
      }
      const text =
        req.method === "HEAD"
          ? undefined
          : await res.text().catch(() => undefined);
      return { status: res.status, header: (n) => res.headers.get(n), text };
    },
  };
}
