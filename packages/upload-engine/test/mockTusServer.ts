/**
 * mock TUS 1.0 서버 — Node `http` 만 사용 (외부 의존 0). ADR-201 §3-2 적합성 스위트의 대상.
 *
 * 지원: core · creation · expiration · checksum (sha1/sha256) · termination · OPTIONS 광고 ·
 * `X-HTTP-Method-Override: PATCH` · CORS (origin 반사 + credentials, `corsStar` 로 `*` 시뮬레이션).
 * 바이트는 버린다 (offset 만 추적) — `keepBytes` 로 소용량 내용 검증만 가능.
 *
 * 결함 주입 (`setOptions`): `abortAfterBytes` (PATCH 수신 중 소켓 강제 단절, 1회) ·
 * `patchDelayMs` (PATCH 응답 지연) · `gatewayTimeoutMs` (지연 후 504 — 프록시 61s 시뮬레이션) ·
 * `hangPatch` (응답 없음 — 클라이언트 timeout 검증) · `blockPatch` (PATCH → 405) ·
 * `expiresMs` (Upload-Expires) · `requireCsrfHeader` · `corsStar` · `commitMode`.
 *
 * Node 24 type-stripping 으로 직접 실행 가능: `node test/mockTusServer.ts --listen [port]`.
 * (enum · parameter property 등 지울 수 없는 문법은 쓰지 않는다)
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ERROR_TABLE, statusOf } from "../src/errors.ts";

// 응답 status 는 클라이언트 어댑터와 같은 표 (src/errors.ts) 에서 — 3자 대조 (서버 계약 문서 · 어댑터 · mock)
const S = {
  offsetMismatch: statusOf("E_OFFSET_MISMATCH"),
  expired: statusOf("E_EXPIRED"),
  tooLarge: statusOf("E_TOO_LARGE"),
  patchBlocked: statusOf("E_PATCH_BLOCKED"),
  checksum: statusOf("E_CHECKSUM"),
  proxyTimeout: statusOf("E_PROXY_TIMEOUT"),
  unauthenticated: 401,
  forbidden: 403,
  rejected: 400,
  unsupportedMedia: 415,
};
for (const [code, st] of [
  ["E_UNAUTHORIZED", 401],
  ["E_UNAUTHORIZED", 403],
  ["E_REJECTED", 400],
  ["E_REJECTED", 415],
  ["E_EXPIRED", 404],
] as const) {
  if (!(ERROR_TABLE[code].status as readonly number[]).includes(st)) {
    throw new Error(`errors.ts 표와 mock 서버 status 불일치: ${code} ${st}`);
  }
}

export interface MockTusOptions {
  /** 기본 `/files` */
  basePath?: string;
  maxSize?: number;
  /** 광고할 확장 — 기본 creation,expiration,checksum,termination */
  extensions?: string[];
  /** Upload-Expires 까지 ms (0 = 만료 없음) */
  expiresMs?: number;
  /** "stream" = 수신 즉시 offset 커밋 (tusd 동형) · "chunk" = PATCH 완료 시 커밋 */
  commitMode?: "stream" | "chunk";
  /** PATCH 메서드 자체를 405 로 거부 (WAF 시뮬레이션) */
  blockPatch?: boolean;
  /** `POST + X-HTTP-Method-Override: PATCH` 허용 */
  allowOverride?: boolean;
  /** `Access-Control-Allow-Origin: *` (credentials 와 충돌 — 클라이언트 거부 검증용) */
  corsStar?: boolean;
  /** 이 헤더가 없는 POST/PATCH/DELETE 는 403 */
  requireCsrfHeader?: string;
  /** 소유자 바인딩 헤더 (기본 `X-Owner`, 값이 다르면 403) */
  ownerHeader?: string;
  /** 모든 요청 401 (인증 실패 시뮬레이션) */
  rejectAuth?: boolean;
  /** creation 을 429 로 거부 (quota) */
  quotaExceeded?: boolean;
  /** PATCH 수신 중 누적 N 바이트에서 소켓 destroy (1회 후 자동 해제) */
  abortAfterBytes?: number;
  /** PATCH 수신 중 누적 N 바이트에서 서버 전체를 `downMs` 동안 내린다 (listen 중단 → 재기동, 1회) — 진짜 네트워크 단절 */
  downAfterBytes?: number;
  downMs?: number;
  patchDelayMs?: number;
  /** 지연 후 504 응답 (바디는 읽되 커밋하지 않음) — 1회 후 해제 */
  gatewayTimeoutMs?: number;
  /** 응답을 보내지 않음 (1회 후 해제) */
  hangPatch?: boolean;
  /** 다음 PATCH 를 460 (checksum mismatch) 로 거부 — 1회 */
  failChecksumOnce?: boolean;
  /** 바이트 보관 (테스트 소용량 한정, 상한 16MB) */
  keepBytes?: boolean;
  /** 폴더 traversal 검사 비활성 (서버 방어 없는 환경 시뮬레이션은 하지 않는다 — 항상 검사) */
  log?: boolean;
}

export interface MockUpload {
  id: string;
  length: number;
  offset: number;
  metadata: Record<string, string>;
  owner: string | null;
  createdAt: number;
  expiresAt: number | null;
  patches: number;
  bytesReceived: number;
  terminated: boolean;
  bytes?: Buffer[];
}

export interface MockStats {
  requests: Array<{
    method: string;
    path: string;
    status: number;
    offset?: number;
    bytes?: number;
  }>;
  bytesReceived: number;
  patches: number;
  creations: number;
  heads: number;
  aborted: number;
}

export interface MockTusServer {
  server: Server;
  url: string;
  endpoint: string;
  port: number;
  uploads: Map<string, MockUpload>;
  stats: MockStats;
  options: MockTusOptions;
  setOptions(patch: Partial<MockTusOptions>): void;
  reset(): void;
  /** listen 중단 + 연결 전부 파괴 (서버 다운 시뮬레이션) */
  pause(): Promise<void>;
  /** 같은 포트로 재기동 */
  resume(): Promise<void>;
  close(): Promise<void>;
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/** §3-6 프로토콜 층 — 파일명·relativePath 검증 (서버 거부 사유 문자열, null = 통과) */
export function validatePathName(
  value: string,
  allowSeparators: boolean,
): string | null {
  if (value.length === 0) return "empty";
  if (value.length > 255 * 8) return "too long";
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) return "control character";
  const norm = value.normalize("NFC");
  if (/^[a-zA-Z]:/.test(norm)) return "drive letter";
  if (norm.startsWith("\\\\") || norm.startsWith("//")) return "unc path";
  if (norm.startsWith("/") || norm.startsWith("\\")) return "absolute path";
  const segments = norm.split(/[\\/]/);
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") return "traversal";
  }
  if (!allowSeparators && segments.length > 1) return "separator";
  for (const seg of segments) {
    if (seg.length > 255) return "segment too long";
    if (RESERVED.test(seg)) return "reserved name";
    if (/[<>:"|?*]/.test(seg)) return "forbidden character";
    if (seg.endsWith(" ") || seg.endsWith(".")) return "trailing dot/space";
  }
  return null;
}

export function decodeMetadata(header: string | undefined): {
  metadata: Record<string, string>;
  error: string | null;
} {
  const metadata: Record<string, string> = {};
  if (!header) return { metadata, error: null };
  for (const pair of header.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(" ");
    const [key, b64] = parts;
    if (parts.length > 2 || !key || !/^[A-Za-z0-9_-]+$/.test(key))
      return { metadata, error: "bad key" };
    if (key in metadata) return { metadata, error: "duplicate key" };
    if (b64 === undefined) {
      metadata[key] = "";
      continue;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
      return { metadata, error: "bad base64" };
    metadata[key] = Buffer.from(b64, "base64").toString("utf8");
  }
  return { metadata, error: null };
}

const EXPOSE = [
  "Location",
  "Upload-Offset",
  "Upload-Length",
  "Upload-Expires",
  "Upload-Metadata",
  "Tus-Resumable",
  "Tus-Version",
  "Tus-Extension",
  "Tus-Max-Size",
  "Tus-Checksum-Algorithm",
].join(", ");

export function createMockTusServer(
  initial: MockTusOptions = {},
): Promise<MockTusServer> {
  const options: MockTusOptions = {
    basePath: "/files",
    maxSize: 8 * 1024 ** 3,
    extensions: ["creation", "expiration", "checksum", "termination"],
    expiresMs: 0,
    commitMode: "stream",
    ownerHeader: "X-Owner",
    ...initial,
  };
  const uploads = new Map<string, MockUpload>();
  const stats: MockStats = {
    requests: [],
    bytesReceived: 0,
    patches: 0,
    creations: 0,
    heads: 0,
    aborted: 0,
  };

  const base = () => options.basePath ?? "/files";

  function cors(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    if (origin || options.corsStar) {
      res.setHeader(
        "Access-Control-Allow-Origin",
        options.corsStar ? "*" : (origin as string),
      );
      if (!options.corsStar)
        res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Upload-Checksum, Upload-Defer-Length, Content-Type, X-HTTP-Method-Override, X-Requested-With, X-Owner, X-CSRF-Token, Authorization",
      );
      res.setHeader("Access-Control-Expose-Headers", EXPOSE);
      res.setHeader("Access-Control-Max-Age", "600");
    }
  }

  function record(
    req: IncomingMessage,
    res: ServerResponse,
    extra: { offset?: number; bytes?: number } = {},
  ) {
    stats.requests.push({
      method: effectiveMethod(req),
      path: req.url ?? "",
      status: res.statusCode,
      ...extra,
    });
    if (options.log) {
      console.log(
        `[mock-tus] ${effectiveMethod(req)} ${req.url} -> ${res.statusCode}`,
        extra,
      );
    }
  }

  function finish(
    req: IncomingMessage,
    res: ServerResponse,
    status: number,
    headers: Record<string, string> = {},
    body?: string,
  ) {
    res.statusCode = status;
    res.setHeader("Tus-Resumable", "1.0.0");
    res.setHeader("Cache-Control", "no-store");
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    if (body !== undefined) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Length", String(Buffer.byteLength(body)));
    }
    record(req, res, {
      offset: headers["Upload-Offset"]
        ? Number(headers["Upload-Offset"])
        : undefined,
    });
    res.end(body);
  }

  function effectiveMethod(req: IncomingMessage): string {
    const m = (req.method ?? "GET").toUpperCase();
    const override = req.headers["x-http-method-override"];
    if (
      m === "POST" &&
      typeof override === "string" &&
      override.toUpperCase() === "PATCH"
    ) {
      return "PATCH(override)";
    }
    return m;
  }

  /** 바디를 읽어 버린다 — 거부 응답이라도 회선에 실린 바이트는 stats 에 센다 (재전송 측정 무결성) */
  function drain(req: IncomingMessage): Promise<void> {
    return new Promise((resolve) => {
      req.on("data", (c: Buffer) => {
        stats.bytesReceived += c.length;
      });
      req.on("end", resolve);
      req.on("error", () => resolve());
    });
  }

  function expired(u: MockUpload): boolean {
    return u.expiresAt !== null && Date.now() > u.expiresAt;
  }

  function expiresHeader(u: MockUpload): Record<string, string> {
    return u.expiresAt !== null
      ? { "Upload-Expires": new Date(u.expiresAt).toUTCString() }
      : {};
  }

  function checkCommon(req: IncomingMessage, res: ServerResponse): boolean {
    const m0 = (req.method ?? "").toUpperCase();
    if (m0 !== "OPTIONS" && req.headers["tus-resumable"] !== "1.0.0") {
      finish(req, res, 412, { "Tus-Version": "1.0.0" }, "Tus-Resumable mismatch");
      return false;
    }
    if (options.rejectAuth) {
      finish(req, res, S.unauthenticated, {}, "unauthorized");
      return false;
    }
    const csrf = options.requireCsrfHeader;
    const m = (req.method ?? "").toUpperCase();
    if (csrf && (m === "POST" || m === "PATCH" || m === "DELETE")) {
      if (!req.headers[csrf.toLowerCase()]) {
        finish(req, res, S.forbidden, {}, "csrf token missing");
        return false;
      }
    }
    return true;
  }

  function findUpload(
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
  ): MockUpload | null {
    const u = uploads.get(id);
    if (!u || u.terminated) {
      finish(req, res, 404, {}, "not found");
      return null;
    }
    if (expired(u)) {
      finish(req, res, S.expired, {}, "expired");
      return null;
    }
    const ownerHeader = options.ownerHeader ?? "X-Owner";
    const owner = req.headers[ownerHeader.toLowerCase()];
    if (u.owner !== null && owner !== u.owner) {
      finish(req, res, S.forbidden, {}, "forbidden (owner mismatch)");
      return null;
    }
    return u;
  }

  async function handleCreate(req: IncomingMessage, res: ServerResponse) {
    await drain(req);
    if (!checkCommon(req, res)) return;
    if (options.quotaExceeded) return finish(req, res, 429, {}, "quota exceeded");
    if (req.headers["upload-defer-length"] !== undefined) {
      return finish(req, res, S.rejected, {}, "Upload-Defer-Length not allowed");
    }
    const lenRaw = req.headers["upload-length"];
    const length = Number(lenRaw);
    if (lenRaw === undefined || !Number.isInteger(length) || length < 0) {
      return finish(req, res, S.rejected, {}, "Upload-Length invalid");
    }
    if (options.maxSize !== undefined && length > options.maxSize) {
      return finish(req, res, S.tooLarge, {}, "Upload-Length exceeds Tus-Max-Size");
    }
    const { metadata, error } = decodeMetadata(
      req.headers["upload-metadata"] as string | undefined,
    );
    if (error) return finish(req, res, S.rejected, {}, `Upload-Metadata ${error}`);
    if (metadata.filename !== undefined) {
      const why = validatePathName(metadata.filename, false);
      if (why) return finish(req, res, S.rejected, {}, `filename rejected: ${why}`);
    }
    if (metadata.relativePath !== undefined && metadata.relativePath !== "") {
      const why = validatePathName(metadata.relativePath, true);
      if (why)
        return finish(req, res, S.rejected, {}, `relativePath rejected: ${why}`);
    }
    const id = randomUUID();
    const ownerHeader = options.ownerHeader ?? "X-Owner";
    const ownerRaw = req.headers[ownerHeader.toLowerCase()];
    const now = Date.now();
    const u: MockUpload = {
      id,
      length,
      offset: 0,
      metadata,
      owner: typeof ownerRaw === "string" ? ownerRaw : null,
      createdAt: now,
      expiresAt: options.expiresMs ? now + options.expiresMs : null,
      patches: 0,
      bytesReceived: 0,
      terminated: false,
      bytes: options.keepBytes ? [] : undefined,
    };
    uploads.set(id, u);
    stats.creations++;
    finish(req, res, 201, {
      Location: `${base()}/${id}`,
      "Upload-Offset": "0",
      ...expiresHeader(u),
    });
  }

  function handleHead(req: IncomingMessage, res: ServerResponse, id: string) {
    stats.heads++;
    if (!checkCommon(req, res)) return;
    const u = findUpload(req, res, id);
    if (!u) return;
    finish(req, res, 200, {
      "Upload-Offset": String(u.offset),
      "Upload-Length": String(u.length),
      ...expiresHeader(u),
    });
  }

  function handlePatch(req: IncomingMessage, res: ServerResponse, id: string) {
    stats.patches++;
    if (!checkCommon(req, res)) return void drain(req);
    if (req.headers["content-type"] !== "application/offset+octet-stream") {
      void drain(req);
      return finish(
        req,
        res,
        S.unsupportedMedia,
        {},
        "Content-Type must be application/offset+octet-stream",
      );
    }
    const u = findUpload(req, res, id);
    if (!u) return void drain(req);
    const offset = Number(req.headers["upload-offset"]);
    if (!Number.isInteger(offset) || offset !== u.offset) {
      void drain(req);
      return finish(
        req,
        res,
        S.offsetMismatch,
        { "Upload-Offset": String(u.offset) },
        `offset mismatch (server ${u.offset}, client ${offset})`,
      );
    }
    u.patches++;
    const checksumHeader = req.headers["upload-checksum"];
    let hash: ReturnType<typeof createHash> | null = null;
    let expectDigest = "";
    if (typeof checksumHeader === "string") {
      const [algo, digest] = checksumHeader.split(" ");
      if (!["sha1", "sha256"].includes(algo) || !digest) {
        void drain(req);
        return finish(
          req,
          res,
          S.rejected,
          {},
          "Upload-Checksum algorithm unsupported",
        );
      }
      hash = createHash(algo);
      expectDigest = digest;
    }
    // checksum 이 있으면 검증 전 커밋 불가 → chunk 모드로 동작
    const streamCommit = options.commitMode !== "chunk" && !hash;
    let received = 0;
    let aborted = false;
    const parts: Buffer[] = [];
    const abortAt = options.abortAfterBytes;
    let gatewayTimeout = options.gatewayTimeoutMs;
    const hang = options.hangPatch;
    const delay = options.patchDelayMs ?? 0;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      received += chunk.length;
      stats.bytesReceived += chunk.length;
      u.bytesReceived += chunk.length;
      if (hash) hash.update(chunk);
      if (u.bytes && u.bytesReceived < 16 * 1024 ** 2) parts.push(Buffer.from(chunk));
      // stream 커밋은 바이트도 즉시 보관 (tusd 동형)
      if (streamCommit && u.bytes) u.bytes.push(parts.pop()!);
      if (streamCommit) {
        // stream 커밋 — 길이 초과분은 잘라서 400 로 마감
        u.offset = Math.min(u.length, offset + received);
      }
      if (abortAt !== undefined && offset + received >= abortAt) {
        aborted = true;
        stats.aborted++;
        options.abortAfterBytes = undefined;
        if (options.log)
          console.log(`[mock-tus] abort socket at ${offset + received}`);
        req.socket.destroy();
        stats.requests.push({
          method: "PATCH",
          path: req.url ?? "",
          status: 0,
          offset: u.offset,
          bytes: received,
        });
      }
      const downAt = options.downAfterBytes;
      if (!aborted && downAt !== undefined && offset + received >= downAt) {
        aborted = true;
        stats.aborted++;
        options.downAfterBytes = undefined;
        const downMs = options.downMs ?? 500;
        if (options.log) console.log(`[mock-tus] server down ${downMs}ms at ${offset + received}`);
        stats.requests.push({
          method: "PATCH",
          path: req.url ?? "",
          status: 0,
          offset: u.offset,
          bytes: received,
        });
        void pause().then(() => setTimeout(() => void resume(), downMs));
      }
    });
    req.on("end", () => {
      if (aborted) return;
      const respond = () => {
        if (hang) {
          options.hangPatch = false;
          stats.requests.push({
            method: "PATCH",
            path: req.url ?? "",
            status: -1,
          });
          return; // 응답 없음
        }
        if (gatewayTimeout) {
          options.gatewayTimeoutMs = undefined;
          if (!streamCommit) {
            // 커밋 안 함
          }
          setTimeout(
            () => finish(req, res, S.proxyTimeout, {}, "gateway timeout"),
            gatewayTimeout,
          );
          gatewayTimeout = undefined;
          return;
        }
        if (offset + received > u.length) {
          if (streamCommit) u.offset = u.length;
          return finish(
            req,
            res,
            400,
            { "Upload-Offset": String(u.offset) },
            "body exceeds Upload-Length",
          );
        }
        if (hash) {
          const actual = hash.digest("base64");
          if (options.failChecksumOnce || actual !== expectDigest) {
            options.failChecksumOnce = false;
            return finish(
              req,
              res,
              S.checksum,
              { "Upload-Offset": String(u.offset) },
              "checksum mismatch",
            );
          }
        }
        if (!streamCommit) {
          u.offset = offset + received;
          u.bytes?.push(...parts);
        }
        finish(req, res, 204, {
          "Upload-Offset": String(u.offset),
          ...expiresHeader(u),
        });
        stats.requests[stats.requests.length - 1].bytes = received;
      };
      if (delay > 0) setTimeout(respond, delay);
      else respond();
    });
    req.on("error", () => {
      /* 소켓 단절 — stream 커밋분은 유지 */
    });
  }

  async function handleDelete(
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
  ) {
    await drain(req);
    if (!checkCommon(req, res)) return;
    const u = findUpload(req, res, id);
    if (!u) return;
    u.terminated = true;
    finish(req, res, 204);
  }

  async function handleControl(
    req: IncomingMessage,
    res: ServerResponse,
    sub: string,
  ) {
    const m = (req.method ?? "GET").toUpperCase();
    if (m === "GET" && sub.startsWith("/uploads")) {
      const id = sub.slice("/uploads/".length);
      const payload = id
        ? (uploads.get(id) ?? null)
        : Array.from(uploads.values());
      res.statusCode = payload === null ? 404 : 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify(payload, (k, v) => (k === "bytes" ? undefined : v)),
      );
    }
    if (m === "GET" && sub === "/stats") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(stats));
    }
    if (m === "POST") {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
        : {};
      if (body.reset) reset();
      if (body.set) Object.assign(options, body.set);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ options, uploads: uploads.size }));
    }
    res.statusCode = 404;
    res.end();
  }

  function reset() {
    uploads.clear();
    stats.requests.length = 0;
    stats.bytesReceived = 0;
    stats.patches = 0;
    stats.creations = 0;
    stats.heads = 0;
    stats.aborted = 0;
  }

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const method = (req.method ?? "GET").toUpperCase();
    cors(req, res);
    if (url.startsWith("/__control")) {
      void handleControl(req, res, url.slice("/__control".length));
      return;
    }
    if (method === "OPTIONS") {
      const ext = options.extensions ?? [];
      const headers: Record<string, string> = {
        "Tus-Version": "1.0.0",
        "Tus-Extension": ext.join(","),
      };
      if (options.maxSize !== undefined)
        headers["Tus-Max-Size"] = String(options.maxSize);
      if (ext.includes("checksum"))
        headers["Tus-Checksum-Algorithm"] = "sha1,sha256";
      return finish(req, res, 204, headers);
    }
    const b = base();
    if (url === `${b}/multipart` && method === "POST") {
      // multipart fallback 대상 — 바디를 버리고 201 (필드 파싱 없음, 바이트 수만)
      let n = 0;
      req.on("data", (c: Buffer) => {
        n += c.length;
        stats.bytesReceived += c.length;
      });
      req.on("end", () => {
        stats.creations++;
        finish(req, res, 201, { Location: `${b}/multipart/${randomUUID()}` });
        stats.requests[stats.requests.length - 1].bytes = n;
      });
      return;
    }
    if (url === b || url === `${b}/`) {
      if (method === "POST") return void handleCreate(req, res);
      return void drain(req).then(() =>
        finish(req, res, 405, {}, "method not allowed"),
      );
    }
    if (url.startsWith(`${b}/`)) {
      const id = url.slice(b.length + 1).split("?")[0];
      const override = req.headers["x-http-method-override"];
      const isOverridePatch =
        method === "POST" &&
        typeof override === "string" &&
        override.toUpperCase() === "PATCH";
      if (method === "HEAD") return handleHead(req, res, id);
      if (method === "PATCH") {
        if (options.blockPatch) {
          return void drain(req).then(() =>
            finish(req, res, S.patchBlocked, {}, "PATCH blocked"),
          );
        }
        return handlePatch(req, res, id);
      }
      if (isOverridePatch) {
        if (!options.allowOverride) {
          return void drain(req).then(() =>
            finish(req, res, S.patchBlocked, {}, "override not allowed"),
          );
        }
        return handlePatch(req, res, id);
      }
      if (method === "DELETE") {
        if (!(options.extensions ?? []).includes("termination")) {
          return void drain(req).then(() =>
            finish(req, res, 405, {}, "termination not supported"),
          );
        }
        return void handleDelete(req, res, id);
      }
      return void drain(req).then(() =>
        finish(req, res, 405, {}, "method not allowed"),
      );
    }
    void drain(req).then(() => finish(req, res, 404, {}, "not found"));
  });
  // 대용량 PATCH 가 60s 를 넘어도 서버가 끊지 않게 (Apache Timeout 은 gatewayTimeoutMs 로 시뮬레이션)
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 5_000;

  const listenPort = Number(process.env.MOCK_TUS_PORT ?? 0);
  let boundPort = 0;
  const pause = () =>
    new Promise<void>((r) => {
      server.closeAllConnections();
      server.close(() => r());
    });
  const resume = () =>
    new Promise<void>((r) => {
      server.listen(boundPort, "127.0.0.1", () => r());
    });
  return new Promise((resolve) => {
    server.listen(listenPort, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      boundPort = port;
      const url = `http://127.0.0.1:${port}`;
      resolve({
        server,
        url,
        endpoint: `${url}${base()}`,
        port,
        uploads,
        stats,
        options,
        setOptions: (patch) => Object.assign(options, patch),
        reset,
        pause,
        resume,
        close: () =>
          new Promise<void>((r) => {
            server.closeAllConnections();
            server.close(() => r());
          }),
      });
    });
  });
}

// CLI: `node test/mockTusServer.ts --listen [port]`
if (process.argv.includes("--listen")) {
  const idx = process.argv.indexOf("--listen");
  const port = process.argv[idx + 1];
  if (port && /^\d+$/.test(port)) process.env.MOCK_TUS_PORT = port;
  createMockTusServer({ log: process.argv.includes("--log") }).then((s) => {
    console.log(`mock TUS server listening: ${s.endpoint}`);
  });
}
