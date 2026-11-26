/**
 * ADR-324 Decision 3 · 5 — the save's own request runner: it returns the response's status,
 * headers and body as they came (the submit runner returns the body only — an empty 202, an empty
 * 204 and a 201 with only `Location` were all `undefined` to it), or `lost` when no answer came.
 *
 * A batch to a connection that declared gzip bodies goes compressed only past the threshold and
 * when smaller (사용자 결정 1 — Phase 0: 2,048 B); a 415 to a compressed body is sent once more
 * plain and the caller turns compression off for the session.
 */
import { catalogSaveMethodAllowed } from "../../catalog/document/collectionSave";
import type { ApiEndpointDefinition } from "../../types/collection.types";
import {
  buildEndpointRequest,
  type EndpointTemplateResolver,
} from "../executeCollectionEndpoint";
import type { SaveLost, SaveResponse } from "./judgeSave";
import type { SaveRequest } from "./planSave";

/** Phase 0 (G0) — below this a body is sent as is (gzip gains under 1.5 KB, a cell or two grows). */
export const SAVE_GZIP_THRESHOLD = 2048;

export interface SaveSendOptions {
  endpoint: ApiEndpointDefinition;
  /** The endpoint's `{{ }}` (session variables · route params); `{{ key }}` is the row's key. */
  resolve?: EndpointTemplateResolver;
  /** The connection declared gzip request bodies and the session has not turned it off. */
  gzip?: boolean;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  /** ADR-313 — the JSON writer that keeps a big integer literal. */
  stringify: (value: unknown) => string;
  /** The response text read (big integers kept). */
  parse: (text: string) => unknown;
}

export interface SaveSendResult {
  answer: SaveResponse | SaveLost;
  /** The body went gzip-compressed (and the server took it or not). */
  compressed: boolean;
  /** A 415 to a compressed body: it was sent again plain — the session turns gzip off. */
  gzipRefused?: true;
  /** The request could not be made (a template that does not resolve): nothing went out. */
  notSent?: string;
  /** Not sent because the connection's method is not one its kind may use. */
  wrongMethod?: true;
}

async function gzipBody(text: string): Promise<Uint8Array> {
  const stream = new Response(text).body!.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readAnswer(
  response: Response,
  parse: SaveSendOptions["parse"],
): Promise<SaveResponse> {
  let body: unknown;
  if (response.status !== 204 && response.status !== 205) {
    const text = await response.text().catch(() => "");
    if (text.trim())
      try {
        body = parse(text);
      } catch {
        body = undefined;
      }
  }
  return { status: response.status, headers: response.headers, body };
}

/**
 * The method a request uses: its endpoint's, when that is one its kind may use (`CATALOG_SAVE_METHODS`
 * — an update never goes as a DELETE). Undefined = the connection cannot carry it: nothing is sent.
 */
export function saveMethod(
  request: SaveRequest,
  endpoint: ApiEndpointDefinition,
): string | undefined {
  const method = (endpoint.method ?? "").toUpperCase();
  return catalogSaveMethodAllowed(request.kind, method) ? method : undefined;
}

export async function sendSaveRequest(
  request: SaveRequest,
  options: SaveSendOptions,
): Promise<SaveSendResult> {
  const doFetch = options.fetch ?? fetch;
  const key = "key" in request ? request.key : undefined;
  const resolve: EndpointTemplateResolver = (text) => {
    // (`{{ key }}` is the row's server key — the other names are the session's.)
    if (/\{\{\s*key\s*\}\}/.test(text) && key === undefined) return undefined;
    const withKey =
      key === undefined
        ? text
        : text.replace(/\{\{\s*key\s*\}\}/g, encodeURIComponent(key));
    return /\{\{/.test(withKey) ? options.resolve?.(withKey) : withKey;
  };
  let parts: ReturnType<typeof buildEndpointRequest>;
  try {
    parts = buildEndpointRequest(
      options.endpoint,
      options.signal ?? new AbortController().signal,
      resolve,
      request.kind === "remove" && request.versionQuery
        ? { query: [[request.versionQuery.name, request.versionQuery.value]] }
        : undefined,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { answer: { lost: true, reason }, compressed: false, notSent: reason };
  }
  const headers: Record<string, string> = { ...parts.headers };
  const method = saveMethod(request, options.endpoint);
  if (!method) {
    const reason = `연결의 method (${options.endpoint.method || "없음"}) 가 이 변경을 보낼 수 없음`;
    return {
      answer: { lost: true, reason },
      compressed: false,
      notSent: reason,
      wrongMethod: true,
    };
  }
  if (request.kind === "update" || request.kind === "remove")
    if (request.ifMatch) headers["If-Match"] = request.ifMatch;
  if (request.kind === "create" && request.idempotency?.in === "header")
    headers[request.idempotency.name] = request.idempotency.value;
  const payload = request.kind === "remove" ? undefined : request.body;
  const text = payload === undefined ? undefined : options.stringify(payload);
  if (
    text !== undefined &&
    !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")
  )
    headers["Content-Type"] = "application/json";

  const send = async (compress: boolean): Promise<SaveResponse | SaveLost> => {
    let body: BodyInit | undefined = text;
    const sent = { ...headers };
    if (compress && text !== undefined) {
      body = (await gzipBody(text)) as unknown as BodyInit;
      sent["Content-Encoding"] = "gzip";
    }
    try {
      const response = await doFetch(parts.url, {
        method,
        headers: sent,
        body,
        signal: parts.signal,
      });
      return await readAnswer(response, options.parse);
    } catch (error) {
      return {
        lost: true,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  };

  // (Batch only, past the threshold and only when it is smaller.)
  let compress = false;
  if (options.gzip && request.kind === "batch" && text !== undefined) {
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes >= SAVE_GZIP_THRESHOLD)
      compress = (await gzipBody(text)).byteLength < bytes;
  }
  const first = await send(compress);
  if (compress && !("lost" in first) && first.status === 415)
    return { answer: await send(false), compressed: false, gzipRefused: true };
  return { answer: first, compressed: compress };
}

/**
 * ADR-324 Decision 4 · 6 — a row read by key through a one-row endpoint (the recheck connection —
 * `{{ key }}` in its path): the row (`responseMapping.dataPath`), 「none」 on a 404 · an empty
 * answer, nothing to go by on any other failure — and on an answer that does not tell which row it
 * is (several rows without the one asked, a row of another key: round 3 h12 — 「none」 there
 * reported a remove done that was never sent).
 */
export async function readSavedRow(
  key: string,
  options: Omit<SaveSendOptions, "gzip" | "stringify"> & {
    /** The key field's key — a row answered is the one asked when its value is the key. */
    keyFieldKey?: string;
  },
): Promise<
  { state: "found"; row: unknown } | { state: "absent" } | { state: "unknown"; reason: string }
> {
  const resolve: EndpointTemplateResolver = (text) => {
    const withKey = text.replace(/\{\{\s*key\s*\}\}/g, encodeURIComponent(key));
    return /\{\{/.test(withKey) ? options.resolve?.(withKey) : withKey;
  };
  try {
    const parts = buildEndpointRequest(
      options.endpoint,
      options.signal ?? new AbortController().signal,
      resolve,
    );
    const response = await (options.fetch ?? fetch)(parts.url, {
      method: "GET",
      headers: parts.headers,
      signal: parts.signal,
    });
    if (response.status === 404 || response.status === 410) return { state: "absent" };
    if (!response.ok) return { state: "unknown", reason: `HTTP ${response.status}` };
    const answer = await readAnswer(response, options.parse);
    const path = options.endpoint.responseMapping?.dataPath;
    const row = path?.trim()
      ? path
          .trim()
          .split(".")
          .reduce<unknown>(
            (current, part) =>
              current !== null && typeof current === "object"
                ? (current as Record<string, unknown>)[part]
                : undefined,
            answer.body,
          )
      : answer.body;
    const answered = (Array.isArray(row) ? row : [row]).filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );
    // (An empty answer: no such row.)
    if (!answered.length) return { state: "absent" };
    const keyOf = (item: Record<string, unknown>) => {
      const value = options.keyFieldKey ? item[options.keyFieldKey] : undefined;
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : undefined;
    };
    const mine = answered.filter((item) => keyOf(item) === key);
    if (mine.length === 1) return { state: "found", row: mine[0] };
    // (One row that does not tell its key is the row asked; any other answer names no row.)
    if (answered.length === 1 && keyOf(answered[0]!) === undefined)
      return { state: "found", row: answered[0] };
    return {
      state: "unknown",
      reason: `확인 조회가 그 행을 가리지 못함 (${answered.length}행 응답)`,
    };
  } catch (error) {
    return { state: "unknown", reason: error instanceof Error ? error.message : String(error) };
  }
}
