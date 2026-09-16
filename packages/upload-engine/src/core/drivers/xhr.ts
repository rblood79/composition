import type { HttpDriver, HttpRequest, HttpResponse } from "../../types";
import { transportError } from "./errors";

/**
 * 브라우저 driver — `XMLHttpRequest`.
 *
 * - body 는 `File.slice(start, end)` Blob 을 그대로 넘긴다 (HC2 — 파일 전체 읽기 0, 브라우저가 스트리밍).
 * - `xhr.upload.onprogress` → `onProgress(loaded)` (G0 first-nail 의 진행률 채널).
 * - `withCredentials` 기본 true (쿠키 세션 — R5).
 * - 분류: 네트워크 단절/CORS 거부 = `E_NETWORK`, timeout = `E_PROXY_TIMEOUT`, abort = `E_ABORTED`.
 */
export function createXhrDriver(): HttpDriver {
  return {
    send(req: HttpRequest): Promise<HttpResponse> {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(req.method, req.url, true);
        xhr.withCredentials = req.withCredentials !== false;
        if (req.timeout) xhr.timeout = req.timeout;
        for (const k in req.headers) xhr.setRequestHeader(k, req.headers[k]);
        if (req.onProgress) {
          const onProgress = req.onProgress;
          xhr.upload.onprogress = (e) => onProgress(e.loaded);
        }
        const abort = () => xhr.abort();
        req.signal?.addEventListener("abort", abort);
        const done = () => req.signal?.removeEventListener("abort", abort);
        xhr.onload = () => {
          done();
          resolve({
            status: xhr.status,
            header: (n) => xhr.getResponseHeader(n),
            text: xhr.responseText,
          });
        };
        xhr.onerror = () => {
          done();
          reject(
            transportError(
              "E_NETWORK",
              xhr.withCredentials
                ? "network error (연결 단절 또는 CORS 거부 — credentials 모드에서는 Access-Control-Allow-Origin: * 를 쓸 수 없다)"
                : "network error",
            ),
          );
        };
        xhr.ontimeout = () => {
          done();
          reject(transportError("E_PROXY_TIMEOUT", "request timeout"));
        };
        xhr.onabort = () => {
          done();
          reject(transportError("E_ABORTED", "aborted", false));
        };
        xhr.send(req.body ?? null);
      });
    },
  };
}
