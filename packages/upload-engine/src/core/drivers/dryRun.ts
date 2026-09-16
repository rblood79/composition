import type { HttpDriver, HttpRequest, HttpResponse } from "../../types";
import { transportError } from "./errors";

/**
 * dry-run driver — 바이트를 보내지 않는 메모리 TUS 서버 (preview 기본, ADR-201 §3-4 "preview 안전").
 * 진행률은 `bytesPerSecond` 로 시뮬레이션하고 abort 를 존중한다.
 */
export function createDryRunDriver(
  opts: { bytesPerSecond?: number; tickMs?: number } = {},
): HttpDriver {
  const rate = opts.bytesPerSecond ?? 200 * 1024 ** 2;
  const tick = opts.tickMs ?? 40;
  const offsets = new Map<string, number>();
  let seq = 0;
  const reply = (
    status: number,
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> =>
    Promise.resolve({ status, header: (n) => headers[n] ?? null, text: "" });
  return {
    send(req: HttpRequest) {
      const m = req.method;
      const h = req.headers;
      const id = req.url.slice(req.url.lastIndexOf("/") + 1);
      if (m === "OPTIONS")
        return reply(204, {
          "Tus-Extension": "creation,expiration,termination",
        });
      if (m === "POST" && !h["X-HTTP-Method-Override"]) {
        const n = `dry-${++seq}`;
        offsets.set(n, 0);
        return reply(201, { Location: `${req.url.replace(/\/$/, "")}/${n}` });
      }
      const off = offsets.get(id);
      if (off === undefined) return reply(404);
      if (m === "HEAD") return reply(200, { "Upload-Offset": String(off) });
      if (m === "DELETE") {
        offsets.delete(id);
        return reply(204);
      }
      if (Number(h["Upload-Offset"]) !== off)
        return reply(409, { "Upload-Offset": String(off) });
      const size = (req.body as Blob | undefined)?.size ?? 0;
      return new Promise((resolve, reject) => {
        let sent = 0;
        const step = Math.max(1, Math.round((rate * tick) / 1000));
        const t = setInterval(() => {
          if (req.signal?.aborted) {
            clearInterval(t);
            return reject(transportError("E_ABORTED", "aborted", false));
          }
          sent = Math.min(size, sent + step);
          req.onProgress?.(sent);
          if (sent >= size) {
            clearInterval(t);
            offsets.set(id, off + size);
            resolve(reply(204, { "Upload-Offset": String(off + size) }));
          }
        }, tick);
      });
    },
  };
}
