import type { ApiEndpointDefinition } from "../types/collection.types";

/**
 * Resolves the `{{ }}` templates of an endpoint's path · query values (`/users/{{ params.id }}`) —
 * the Preview · publish session's state (route params, variables). `undefined`: a name it cannot
 * read.
 */
export type EndpointTemplateResolver = (text: string) => string | undefined;

const TEMPLATE = /\{\{[^}]*\}\}/;

/**
 * `useAsyncList`'s `load({cursor, filterText, sortDescriptor})` arguments — names a query
 * endpoint's templates read (`?page={{ cursor }}` · `?q={{ filterText }}` ·
 * `?sort={{ sortDescriptor.column }}`). Not given yet (the first page, no text) = empty: the query
 * parameter is left out.
 */
export const ENDPOINT_LOAD_ARGUMENTS = ["cursor", "filterText", "sortDescriptor"] as const;
const LOAD_ARGUMENT = new RegExp(`\\{\\{\\s*(?:${ENDPOINT_LOAD_ARGUMENTS.join("|")})\\b`);

/** Whether an endpoint's path · query read a template (and so a load argument or the route). */
export function endpointReadsTemplate(endpoint: ApiEndpointDefinition, loadArgument?: (typeof ENDPOINT_LOAD_ARGUMENTS)[number]): boolean {
  const texts = [endpoint.path ?? "", ...(endpoint.queryParams ?? []).map((param) => param.value ?? "")];
  return texts.some((text) => loadArgument ? new RegExp(`\\{\\{\\s*${loadArgument}\\b`).test(text) : TEMPLATE.test(text));
}

/**
 * An endpoint's path and query with their templates resolved. A template nothing resolves (the
 * Builder has no route) is refused — the request would carry `{{ … }}` literally.
 */
function resolvedEndpointParts(endpoint: ApiEndpointDefinition, resolve: EndpointTemplateResolver | undefined) {
  const read = (text: string) => {
    if (!TEMPLATE.test(text)) return text;
    const value = resolve?.(text);
    if (value === undefined) throw new Error(`${endpoint.name ?? endpoint.id}: ${TEMPLATE.exec(text)![0]} 를 풀 수 없습니다 (경로 param · 변수는 Preview 에서 읽는다)`);
    return value;
  };
  return {
    path: read(endpoint.path ?? ""),
    // (A load argument not given yet is empty — that parameter is not sent.)
    query: (endpoint.queryParams ?? []).filter((param) => param.key)
      .map((param) => [param.key, read(param.value ?? ""), LOAD_ARGUMENT.test(param.value ?? "")] as const)
      .filter(([, value, loadArgument]) => !loadArgument || value !== "")
      .map(([key, value]) => [key, value] as const),
  };
}

/**
 * ADR-284 — what a view adds to a query request (`serializeViewQueries`): query parameters after
 * the endpoint's own, or the body JSON (merged over the endpoint's body template object).
 */
export interface EndpointRequestExtra {
  query?: readonly (readonly [string, string])[];
  body?: unknown;
}

/** The URL an endpoint asks for with its templates resolved — `undefined` while one does not resolve. */
export function resolvedEndpointUrl(endpoint: ApiEndpointDefinition, resolve: EndpointTemplateResolver, extra?: EndpointRequestExtra): string | undefined {
  try {
    const {path, query} = resolvedEndpointParts(endpoint, resolve);
    const all = [...query, ...(extra?.query ?? [])];
    return `${endpoint.baseUrl}${path}?${new URLSearchParams(all.map(([key, value]) => [key, value])).toString()}${extra?.body === undefined ? "" : `#${JSON.stringify(extra.body)}`}`;
  } catch {
    return undefined;
  }
}

/** The request body: a view's JSON over the endpoint's body template object, else the template. */
function requestBody(endpoint: ApiEndpointDefinition, extra?: EndpointRequestExtra): string | undefined {
  if (extra?.body === undefined) return endpoint.bodyType !== "none" ? endpoint.bodyTemplate : undefined;
  let base: unknown;
  try {
    base = endpoint.bodyTemplate ? JSON.parse(endpoint.bodyTemplate) : undefined;
  } catch {
    base = undefined;
  }
  return JSON.stringify(base && typeof base === "object" && !Array.isArray(base) ? {...base, ...(extra.body as object)} : extra.body);
}

/** An endpoint's request parts (URL · headers · method · timeout signal) — the query and the submit share them. */
export function buildEndpointRequest(endpoint: ApiEndpointDefinition, signal: AbortSignal, resolve?: EndpointTemplateResolver, extra?: EndpointRequestExtra) {
  if (endpoint.executionMode === "server") throw new Error("서버 API 실행 서비스가 연결되지 않았습니다");
  const {path, query} = resolvedEndpointParts(endpoint, resolve);
  const url = new URL(`${endpoint.baseUrl}${path}`, window.location.href);
  for (const [key, value] of [...query, ...(extra?.query ?? [])]) url.searchParams.append(key, value);
  const headers: Record<string, string> = {...(Array.isArray(endpoint.headers)
    ? Object.fromEntries(endpoint.headers.filter((header) => header.enabled && header.key).map((header) => [header.key, header.value]))
    : endpoint.headers)};
  const method = (endpoint.method ?? "GET").toUpperCase();
  const timeout = endpoint.timeout ?? 30000;
  const requestSignal = timeout > 0 && Number.isFinite(timeout) ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal;
  return {url, headers, method, signal: requestSignal};
}

/** A query response's items (`responseMapping.dataPath`) — none = `[]`. */
function mappedItems(endpoint: ApiEndpointDefinition, result: unknown): unknown {
  const dataPath = endpoint.responseMapping?.dataPath;
  const mapped = dataPath ? readPath(result, dataPath) : result;
  return mapped ?? [];
}
function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (current !== null && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), value);
}

/**
 * `useAsyncList.load` — one page of a query endpoint: its items and the next `cursor`
 * (`responseMapping.cursorPath`; none = the last page). A `cursor` given is the load argument the
 * templates read; a URL cursor on an endpoint that reads none is fetched as is (the reference's
 * `fetch(cursor || url)`).
 */
export async function loadCollectionEndpoint(endpoint: ApiEndpointDefinition, signal: AbortSignal, resolve?: EndpointTemplateResolver, cursor?: string, extra?: EndpointRequestExtra): Promise<{items: unknown; cursor?: string; selectedKeys?: string[] | "all"; total?: number}> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal, resolve, extra);
  const target = cursor && !endpointReadsTemplate(endpoint, "cursor") && /^(https?:)?\//.test(cursor) ? new URL(cursor, url) : url;
  const body = requestBody(endpoint, extra);
  const response = await fetch(target, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" ? body : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  const cursorPath = endpoint.responseMapping?.cursorPath;
  const next = cursorPath ? readPath(result, cursorPath) : undefined;
  const selectedPath = endpoint.responseMapping?.selectedKeysPath;
  const selected = selectedPath ? readPath(result, selectedPath) : undefined;
  // (ADR-284 Decision 3 — the query's whole count, when the response holds it. The Data panel keeps
  // it under `pagination` — read when the top-level one is absent.)
  const totalPath = endpoint.responseMapping?.totalPath ?? (endpoint.responseMapping as {pagination?: {totalPath?: string}} | undefined)?.pagination?.totalPath;
  const total = totalPath ? Number(readPath(result, totalPath)) : NaN;
  return {
    items: mappedItems(endpoint, result),
    ...(Number.isFinite(total) && total >= 0 ? {total} : {}),
    ...(typeof next === "string" && next !== "" ? {cursor: next} : typeof next === "number" ? {cursor: String(next)} : {}),
    // (The load's `selectedKeys` — an array of keys or `"all"`; anything else is none.)
    ...(selected === "all" ? {selectedKeys: "all" as const} : Array.isArray(selected) ? {selectedKeys: selected.map(String)} : {}),
  };
}

/** 앱 runtime 공통 API 실행. Chart/List는 CollectionDataProvider 서비스만 소비한다. */
export async function executeCollectionEndpoint(endpoint: ApiEndpointDefinition, signal: AbortSignal, resolve?: EndpointTemplateResolver): Promise<unknown> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal, resolve);
  const response = await fetch(url, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" && endpoint.bodyType !== "none" ? endpoint.bodyTemplate : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return mappedItems(endpoint, await response.json());
}

/**
 * ADR-281 Decision 5 — a Form's submit to an endpoint: one fetch per call (never shared — two Forms
 * submitting different bodies to one endpoint send both), the body as JSON. Success is
 * `response.ok`: `204`, an empty body or a non-JSON `Content-Type` resolve `undefined`, JSON its
 * value (a body that does not parse resolves `undefined` too — the server took the request). A
 * `GET` · `HEAD` endpoint cannot carry a body: refused. `responseMapping` is the query's, not used.
 */
export async function submitCollectionEndpoint(endpoint: ApiEndpointDefinition, body: unknown, signal: AbortSignal): Promise<unknown> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal);
  if (method === "GET" || method === "HEAD") throw new Error(`${method} endpoint 는 body 를 보낼 수 없습니다`);
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {method, headers, signal: requestSignal, body: body === undefined ? undefined : JSON.stringify(body)});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined;
  if (!/json/i.test(response.headers.get("content-type") ?? "")) return undefined;
  const text = await response.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The submit service over a project's endpoints (by id — no request sharing). */
export function createCollectionEndpointSubmitter(endpoints: ApiEndpointDefinition[]) {
  return async (id: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) throw new Error(`API Endpoint '${id}'을 찾을 수 없습니다`);
    return submitCollectionEndpoint(endpoint, body, signal ?? new AbortController().signal);
  };
}

/** 같은 provider의 동시 consumer는 요청을 공유하고, 마지막 consumer가 떠날 때 취소한다. */
export function createCollectionEndpointExecutor(endpoints: ApiEndpointDefinition[]) {
  const pending = new Map<string, {controller: AbortController; promise: Promise<unknown>; consumers: Set<symbol>}>();
  return async (id: string, signal?: AbortSignal): Promise<unknown> => {
    if (signal?.aborted) throw signal.reason;
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) throw new Error(`API Endpoint '${id}'을 찾을 수 없습니다`);
    let request = pending.get(id);
    if (!request) {
      const controller = new AbortController();
      const promise = executeCollectionEndpoint(endpoint, controller.signal).finally(() => {
        if (pending.get(id)?.controller === controller) pending.delete(id);
      });
      request = {controller, promise, consumers: new Set()};
      pending.set(id, request);
    }
    const token = Symbol(id);
    request.consumers.add(token);
    const current = request;
    return new Promise((resolve, reject) => {
      const release = () => {
        signal?.removeEventListener("abort", abort);
        current.consumers.delete(token);
        if (!current.consumers.size && pending.get(id) === current) {
          pending.delete(id);
          current.controller.abort();
        }
      };
      const abort = () => { release(); reject(signal?.reason); };
      signal?.addEventListener("abort", abort, {once: true});
      current.promise.then(resolve, reject).finally(release);
    });
  };
}
