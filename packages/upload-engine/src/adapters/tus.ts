/**
 * TUS 1.0 어댑터 — core + creation + expiration, `checksum`/`termination` 은 OPTIONS 감지 후 활성.
 * `Upload-Defer-Length` 미사용. PATCH 차단 (405/501) 은 1회 `POST + X-HTTP-Method-Override: PATCH` 로 자동 전환.
 */
import { errorOf, errorOfResponse } from "../errors";
import type { UploadEvent } from "../core/protocol/types";
import type { HttpRequest, HttpResponse } from "../types";
import {
  absoluteUrl,
  DEFAULT_CAPABILITIES,
  type AdapterCapabilities,
  type AdapterContext,
  type PreflightContext,
  type WireAdapter,
} from "./types";

export interface TusAdapterOptions {
  overridePatchMethod?: boolean;
  /** 서버가 광고해도 checksum 을 끈다 */
  checksum?: boolean;
}

const TUS = "1.0.0";
/** 청크별 checksum 은 청크를 메모리에 올린다 — 이 크기를 넘으면 계산하지 않는다 (HC2) */
const CHECKSUM_MAX_CHUNK = 64 * 1024 ** 2;

const b64Bytes = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const b64 = (s: string): string => b64Bytes(new TextEncoder().encode(s));

/** `Upload-Metadata` — 키는 그대로, 값은 base64. traversal 검증은 서버 책임 (§3-6) */
export const encodeMetadata = (meta: Record<string, string>): string =>
  Object.entries(meta)
    .filter(([k]) => /^[A-Za-z0-9_-]+$/.test(k))
    .map(([k, v]) => (v === "" ? k : `${k} ${b64(v)}`))
    .join(",");

/** 헤더 부재/공백은 NaN — `Number(null)` 이 0 이 되어 offset 0 으로 오인하는 것을 막는다 (tusd 409 에는 Upload-Offset 이 없다) */
const headerInt = (v: string | null): number =>
  v === null || v.trim() === "" ? NaN : Number(v);

const parseExpires = (v: string | null): number | undefined => {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
};

export function createTusAdapter(opts: TusAdapterOptions = {}): WireAdapter {
  let override = !!opts.overridePatchMethod;

  const fileMetadata = (ctx: AdapterContext): Record<string, string> => ({
    filename: ctx.file.name,
    filetype: ctx.file.type,
    ...(ctx.state.relativePath ? { relativePath: ctx.state.relativePath } : {}),
    ...ctx.metadata,
  });

  return {
    async preflight(ctx: PreflightContext): Promise<AdapterCapabilities> {
      const caps: AdapterCapabilities = {
        ...DEFAULT_CAPABILITIES,
        overridePatch: override,
      };
      let res: HttpResponse;
      try {
        res = await ctx.driver.send({
          method: "OPTIONS",
          url: ctx.endpoint,
          headers: { "Tus-Resumable": TUS, ...ctx.headers },
          withCredentials: ctx.withCredentials,
        });
      } catch {
        // OPTIONS 를 막는 프록시 — core+creation 가정으로 진행
        return caps;
      }
      // 브라우저는 이 헤더를 노출하지 않는다 (`*` + credentials 면 OPTIONS 자체가 status 0 → E_NETWORK).
      // Node/Electron 처럼 CORS 가 없는 환경에서만 읽어 무음 실패를 막는다.
      if (
        ctx.withCredentials &&
        typeof document === "undefined" &&
        res.header("Access-Control-Allow-Origin") === "*"
      ) {
        // §3-6 클라이언트 층 — credentials 와 `*` 는 브라우저가 거부한다. 무음 실패 대신 명시 실패
        throw errorOf(
          "E_NETWORK",
          0,
          "Access-Control-Allow-Origin: * with credentials (server must echo Origin)",
        );
      }
      if (res.status < 200 || res.status >= 300) return caps;
      const ext = (res.header("Tus-Extension") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ext.length) caps.extensions = ext;
      const max = Number(res.header("Tus-Max-Size"));
      if (Number.isFinite(max) && max > 0) caps.maxSize = max;
      caps.terminate = ext.includes("termination");
      if (ext.includes("checksum") && opts.checksum !== false) {
        caps.checksumAlgorithms = (res.header("Tus-Checksum-Algorithm") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((a) => a === "sha256" || a === "sha1");
      }
      return caps;
    },

    async request(op, ctx, range, caps): Promise<HttpRequest> {
      const base = { "Tus-Resumable": TUS, ...ctx.headers };
      if (op === "create") {
        return {
          method: "POST",
          url: ctx.endpoint,
          headers: {
            ...base,
            "Upload-Length": String(ctx.file.size),
            "Upload-Metadata": encodeMetadata(fileMetadata(ctx)),
          },
        };
      }
      const url = ctx.state.url ?? "";
      if (op === "head") return { method: "HEAD", url, headers: base };
      if (op === "delete") return { method: "DELETE", url, headers: base };
      const body = ctx.file.slice(range.start, range.end);
      const headers: Record<string, string> = {
        ...base,
        "Upload-Offset": String(range.start),
        "Content-Type": "application/offset+octet-stream",
      };
      const algo = caps.checksumAlgorithms.includes("sha256")
        ? "sha256"
        : caps.checksumAlgorithms.includes("sha1")
          ? "sha1"
          : null;
      if (
        algo &&
        body.size <= CHECKSUM_MAX_CHUNK &&
        globalThis.crypto?.subtle
      ) {
        const digest = await crypto.subtle.digest(
          algo === "sha256" ? "SHA-256" : "SHA-1",
          await body.arrayBuffer(),
        );
        headers["Upload-Checksum"] =
          `${algo} ${b64Bytes(new Uint8Array(digest))}`;
      }
      const useOverride = override || caps.overridePatch;
      if (useOverride) headers["X-HTTP-Method-Override"] = "PATCH";
      return { method: useOverride ? "POST" : "PATCH", url, headers, body };
    },

    response(op, res, ctx, caps): UploadEvent {
      const s = res.status;
      const ok = s >= 200 && s < 300;
      const expires = parseExpires(res.header("Upload-Expires"));
      if (op === "create") {
        const location = res.header("Location");
        if (ok && location) {
          return {
            kind: "created",
            url: absoluteUrl(location, ctx.endpoint),
            expires,
          };
        }
        return {
          kind: "fail",
          error: ok
            ? errorOf("E_REJECTED", s, "no Location")
            : errorOfResponse(s, res.text, false),
        };
      }
      if (op === "delete") return { kind: "chunk-sent", bytes: 0 };
      if (ok) {
        const offset = headerInt(res.header("Upload-Offset"));
        if (!Number.isInteger(offset) || offset < 0) {
          return {
            kind: "fail",
            error: errorOf(
              "E_REJECTED",
              s,
              "no Upload-Offset (check Access-Control-Expose-Headers)",
            ),
          };
        }
        return { kind: "offset", offset, expires };
      }
      if (
        op === "patch" &&
        (s === 405 || s === 501) &&
        !override &&
        !caps.overridePatch
      ) {
        // 1회 자동 전환 — 다음 PATCH 부터 POST + X-HTTP-Method-Override
        override = true;
        caps.overridePatch = true;
        return {
          kind: "fail",
          error: {
            code: "E_PATCH_BLOCKED",
            status: s,
            message:
              "PATCH blocked; retrying with X-HTTP-Method-Override",
            retryable: true,
          },
        };
      }
      const error = errorOfResponse(s, res.text, true);
      if (s === 409) {
        const offset = headerInt(res.header("Upload-Offset"));
        if (Number.isInteger(offset) && offset >= 0)
          return { kind: "fail", error, offset };
      }
      return { kind: "fail", error };
    },
  };
}
