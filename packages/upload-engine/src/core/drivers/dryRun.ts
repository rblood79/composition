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
  const uploads = new Map<string, { length: number; offset: number }>();
  let seq = 0;
  const reply = (
    status: number,
    headers: Record<string, string> = {},
  ): HttpResponse => ({
    status,
    header: (n) => headers[n] ?? null,
    text: "",
  });
  return {
    send(req: HttpRequest): Promise<HttpResponse> {
      const method = req.method.toUpperCase();
      const override = req.headers["X-HTTP-Method-Override"];
      const url = req.url;
      const id = url.slice(url.lastIndexOf("/") + 1);
      const u = uploads.get(id);
      if (method === "OPTIONS") {
        return Promise.resolve(
          reply(204, {
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,expiration,termination",
          }),
        );
      }
      if (method === "POST" && !override) {
        const nid = `dry-${++seq}`;
        uploads.set(nid, {
          length: Number(req.headers["Upload-Length"] ?? 0),
          offset: 0,
        });
        return Promise.resolve(
          reply(201, { Location: `${url.replace(/\/$/, "")}/${nid}` }),
        );
      }
      if (!u) return Promise.resolve(reply(404));
      if (method === "HEAD") {
        return Promise.resolve(
          reply(200, {
            "Upload-Offset": String(u.offset),
            "Upload-Length": String(u.length),
          }),
        );
      }
      if (method === "DELETE") {
        uploads.delete(id);
        return Promise.resolve(reply(204));
      }
      // PATCH (또는 override)
      const offset = Number(req.headers["Upload-Offset"]);
      if (offset !== u.offset)
        return Promise.resolve(
          reply(409, { "Upload-Offset": String(u.offset) }),
        );
      const size = (req.body as Blob | undefined)?.size ?? 0;
      return new Promise((resolve, reject) => {
        let sent = 0;
        const step = Math.max(1, Math.round((rate * tick) / 1000));
        const timer = setInterval(() => {
          if (req.signal?.aborted) {
            clearInterval(timer);
            return reject(transportError("E_ABORTED", "aborted", false));
          }
          sent = Math.min(size, sent + step);
          req.onProgress?.(sent);
          if (sent >= size) {
            clearInterval(timer);
            u.offset = Math.min(u.length, offset + size);
            resolve(reply(204, { "Upload-Offset": String(u.offset) }));
          }
        }, tick);
      });
    },
  };
}
