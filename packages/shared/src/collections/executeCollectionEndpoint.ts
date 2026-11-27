import type { ApiEndpointDefinition } from "../types/collection.types";
import type { IntakeCollection } from "./intake/queryItems";

export type { IntakeCollection } from "./intake/queryItems";

/**
 * ADR-313 — the intake modules load with the first request (HC3: this module is on the Builder's
 * first screen through `collectionSnapshot`; the converter is not).
 */
const intake = () =>
  Promise.all([
    import("./intake/parseJsonLossless"),
    import("./intake/queryItems"),
    import("./intake/outgoing"),
  ]).then(([lossless, query, outgoing]) => ({ ...lossless, ...query, ...outgoing }));

/** ADR-313 F5 — a response body read keeping the integers past 2^53 (a Java `Long` key) as their text. */
async function responseJson(response: Response): Promise<unknown> {
  const { parseJsonLossless } = await intake();
  return parseJsonLossless(await response.text());
}

/** The collections the intake reads — a list, or a reader of the current ones (a session's). */
export type IntakeCollections = readonly IntakeCollection[] | (() => readonly IntakeCollection[]);

/** The collection an endpoint fills (`targetCollectionId`), as the intake reads it. */
export function targetCollectionOf(endpoint: ApiEndpointDefinition, collections: IntakeCollections): IntakeCollection | undefined {
  if (!endpoint.targetCollectionId) return undefined;
  const list = typeof collections === "function" ? collections() : collections;
  return list.find((item) => item.id === endpoint.targetCollectionId);
}


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
// (ADR-310 Phase 7 — `page` · `pageSize`: a paged list's page, its rows a page. ADR-322 Phase 6
//  (사용자 결정 4) — `parentKey`: a Cascader level's items, asked by their parent's key — empty =
//  the first level.)
export const ENDPOINT_LOAD_ARGUMENTS = ["cursor", "filterText", "sortDescriptor", "page", "pageSize", "parentKey"] as const;
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

/**
 * ADR-325 Decision 2 — a query request's identity, from the parts it is fetched with: the method,
 * the address (a URL cursor followed as is — `loadCollectionEndpoint`'s target — or the page a
 * template · a view parameter puts in it) and the view's body. Two requests with one key are the
 * same request. `undefined` while a template does not resolve.
 */
export function endpointRequestKey(endpoint: ApiEndpointDefinition, resolve: EndpointTemplateResolver | undefined, cursor?: string, extra?: EndpointRequestExtra): string | undefined {
  let parts: ReturnType<typeof resolvedEndpointParts>;
  try {
    parts = resolvedEndpointParts(endpoint, resolve);
  } catch {
    return undefined;
  }
  const params = new URLSearchParams([...parts.query, ...(extra?.query ?? [])].map(([key, value]) => [key, value])).toString();
  const address = `${endpoint.baseUrl}${parts.path}${params ? `?${params}` : ""}`;
  const followed = cursor && !endpointReadsTemplate(endpoint, "cursor") && /^(https?:)?\//.test(cursor);
  const target = followed ? new URL(cursor, new URL(address, "http://localhost/")).href : address;
  // (A cursor the request carries nowhere visible — a template's · a view's page is in the address.)
  const page = cursor !== undefined && !followed && !address.includes(encodeURIComponent(cursor)) ? `#${cursor}` : "";
  return `${(endpoint.method ?? "GET").toUpperCase()} ${target}${page}${extra?.body === undefined ? "" : ` ${JSON.stringify(extra.body)}`}`;
}

/** The request body: a view's JSON over the endpoint's body template object, else the template. */
function requestBody(endpoint: ApiEndpointDefinition, extra: EndpointRequestExtra | undefined, stringifyJsonLossless: (value: unknown) => string): string | undefined {
  if (extra?.body === undefined) return endpoint.bodyType !== "none" ? endpoint.bodyTemplate : undefined;
  let base: unknown;
  try {
    base = endpoint.bodyTemplate ? JSON.parse(endpoint.bodyTemplate) : undefined;
  } catch {
    base = undefined;
  }
  // (ADR-313 Decision 5 — a big integer key goes as a literal, not a quoted text.)
  return stringifyJsonLossless(base && typeof base === "object" && !Array.isArray(base) ? {...base, ...(extra.body as object)} : extra.body);
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
  const body = requestBody(endpoint, extra, (await intake()).stringifyJsonLossless);
  const response = await fetch(target, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" ? body : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await responseJson(response);
  const cursorPath = endpoint.responseMapping?.cursorPath;
  const next = cursorPath ? readPath(result, cursorPath) : undefined;
  const selectedPath = endpoint.responseMapping?.selectedKeysPath;
  const selected = selectedPath ? readPath(result, selectedPath) : undefined;
  // (ADR-284 Decision 3 — the query's whole count, when the response holds it. The Data panel keeps
  // it under `pagination` — read when the top-level one is absent.)
  const totalPath = endpoint.responseMapping?.totalPath ?? (endpoint.responseMapping as {pagination?: {totalPath?: string}} | undefined)?.pagination?.totalPath;
  // (ADR-291 Decision 6 — no `totalPath`: the whole count may be a header, json-server's `X-Total-Count`.)
  const serialization = endpoint.querySerialization;
  const totalHeader = totalPath ? null : response.headers.get(serialization?.totalHeader ?? "X-Total-Count");
  const total = totalPath ? Number(readPath(result, totalPath)) : totalHeader === null ? NaN : Number(totalHeader);
  const items = mappedItems(endpoint, result);
  // (ADR-291 Decision 6 — a `suffix` format paging by number (`pageSize`, no `cursorPath`): a full
  // page means a next one — the cursor is the next page number.)
  const pageSize = serialization?.kind === "suffix" ? serialization.pageSize : undefined;
  const numbered = !cursorPath && pageSize !== undefined && Array.isArray(items) && items.length >= pageSize
    ? String((Number(cursor ?? "1") || 1) + 1) : undefined;
  return {
    items,
    ...(Number.isFinite(total) && total >= 0 ? {total} : {}),
    ...(typeof next === "string" && next !== "" ? {cursor: next} : typeof next === "number" ? {cursor: String(next)} : numbered !== undefined ? {cursor: numbered} : {}),
    // (The load's `selectedKeys` — an array of keys or `"all"`; anything else is none.)
    ...(selected === "all" ? {selectedKeys: "all" as const} : Array.isArray(selected) ? {selectedKeys: selected.map(String)} : {}),
  };
}

/**
 * ADR-320 사용자 결정 9 — a field's candidate values from a `body` endpoint that answers `facet`
 * (`querySerialization.facets`): the request is the view's `where` and `facet` (`extra.body` —
 * `serializeViewQueries` with a `facet` item), the response `{ items: [{ value, count }],
 * nextCursor }` at its top (not the rows' `responseMapping`). An item without a whole count is
 * kept with `NaN` (shown without one); a response of another shape is refused.
 */
export async function loadCollectionFacet(endpoint: ApiEndpointDefinition, signal: AbortSignal, resolve?: EndpointTemplateResolver, extra?: EndpointRequestExtra): Promise<{items: {value: unknown; count: number}[]; cursor?: string}> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal, resolve, extra);
  const body = requestBody(endpoint, extra, (await intake()).stringifyJsonLossless);
  const response = await fetch(url, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" ? body : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await responseJson(response) as {items?: unknown; nextCursor?: unknown} | null;
  const items = result && typeof result === "object" ? result.items : undefined;
  if (!Array.isArray(items)) throw new Error("FACET_RESPONSE: no items");
  const next = result!.nextCursor;
  return {
    items: items.flatMap((item) => item !== null && typeof item === "object" && "value" in item
      ? [{value: (item as {value: unknown}).value, count: Number((item as {count?: unknown}).count ?? NaN)}] : []),
    ...(typeof next === "string" && next !== "" ? {cursor: next} : typeof next === "number" ? {cursor: String(next)} : {}),
  };
}

/** 앱 runtime 공통 API 실행. Chart/List는 CollectionDataProvider 서비스만 소비한다. */
export async function executeCollectionEndpoint(endpoint: ApiEndpointDefinition, signal: AbortSignal, resolve?: EndpointTemplateResolver): Promise<unknown> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal, resolve);
  const response = await fetch(url, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" && endpoint.bodyType !== "none" ? endpoint.bodyTemplate : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return mappedItems(endpoint, await responseJson(response));
}

/**
 * S2 `Form` `validationErrors` (S2 체크리스트 부록 D.3 2단계, 2026-11-23) — a submit the endpoint
 * refused: its HTTP status (absent = the request went through but its response held field errors) and
 * the field errors the response held at `responseMapping.errorsPath` (each field `name` → its
 * messages). The Form shows them on its fields (S2: until the user changes each field).
 */
export class EndpointSubmitError extends Error {
  readonly status: number | undefined;
  readonly validationErrors: Readonly<Record<string, readonly string[]>> | undefined;
  constructor(message: string, status: number | undefined, validationErrors?: Readonly<Record<string, readonly string[]>>) {
    super(message);
    this.name = "EndpointSubmitError";
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

/**
 * The field errors a response holds at `path` (S2 `validationErrors` — a field `name` → a message
 * or messages, as Zod's `flatten().fieldErrors`): only text messages; none = undefined.
 */
export function endpointFieldErrors(body: unknown, path: string | undefined): Record<string, string[]> | undefined {
  if (!path?.trim()) return undefined;
  const value = readPath(body, path.trim());
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const errors: Record<string, string[]> = {};
  for (const [name, messages] of Object.entries(value as Record<string, unknown>)) {
    const texts = (Array.isArray(messages) ? messages : [messages]).filter((message): message is string => typeof message === "string" && message.trim() !== "");
    if (texts.length) errors[name] = texts;
  }
  return Object.keys(errors).length ? errors : undefined;
}

/** A submit response's JSON body (none · not JSON · not parsed = undefined). */
async function submitResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined;
  if (!/json/i.test(response.headers.get("content-type") ?? "")) return undefined;
  const text = await response.text();
  if (!text.trim()) return undefined;
  const { parseJsonLossless } = await intake();
  try {
    return parseJsonLossless(text);
  } catch {
    return undefined;
  }
}

/**
 * ADR-281 Decision 5 — a Form's submit to an endpoint: one fetch per call (never shared — two Forms
 * submitting different bodies to one endpoint send both), the body as JSON. Success is
 * `response.ok`: `204`, an empty body or a non-JSON `Content-Type` resolve `undefined`, JSON its
 * value (a body that does not parse resolves `undefined` too — the server took the request). A
 * `GET` · `HEAD` endpoint cannot carry a body: refused. `responseMapping` is the query's, not used —
 * but its `errorsPath`: a refused response (or an ok one holding field errors) rejects with
 * `EndpointSubmitError` carrying them (S2 `validationErrors`).
 */
export async function submitCollectionEndpoint(endpoint: ApiEndpointDefinition, body: unknown, signal: AbortSignal): Promise<unknown> {
  const {url, headers, method, signal: requestSignal} = buildEndpointRequest(endpoint, signal);
  if (method === "GET" || method === "HEAD") throw new Error(`${method} endpoint 는 body 를 보낼 수 없습니다`);
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
  const { stringifyJsonLossless } = await intake();
  const response = await fetch(url, {method, headers, signal: requestSignal, body: body === undefined ? undefined : stringifyJsonLossless(body)});
  const errorsPath = endpoint.responseMapping?.errorsPath;
  if (!response.ok) {
    const errors = errorsPath ? endpointFieldErrors(await submitResponseBody(response), errorsPath) : undefined;
    throw new EndpointSubmitError(`HTTP ${response.status}: ${response.statusText}`, response.status, errors);
  }
  const result = await submitResponseBody(response);
  const errors = endpointFieldErrors(result, errorsPath);
  if (errors) throw new EndpointSubmitError("입력 값 오류", undefined, errors);
  return result;
}

/**
 * The submit service over a project's endpoints (by id — no request sharing). ADR-313 Decision 5 — a
 * body to an endpoint that fills a collection (`targetCollectionId`) is written back with its fields'
 * notations (a Form's values are texts: read first, then written back).
 */
export function createCollectionEndpointSubmitter(endpoints: ApiEndpointDefinition[], collections: IntakeCollections = []) {
  return async (id: string, body: unknown, signal?: AbortSignal): Promise<unknown> => {
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) throw new Error(`API Endpoint '${id}'을 찾을 수 없습니다`);
    const { outgoingRecord } = await intake();
    const outgoing = outgoingRecord(body, targetCollectionOf(endpoint, collections)?.schema, "text");
    return submitCollectionEndpoint(endpoint, outgoing, signal ?? new AbortController().signal);
  };
}

/**
 * 같은 provider의 동시 consumer는 요청을 공유하고, 마지막 consumer가 떠날 때 취소한다. ADR-313 — 응답은
 * endpoint 가 채우는 collection (`targetCollectionId`) 의 schema 로 진입 변환한다.
 */
export function createCollectionEndpointExecutor(endpoints: ApiEndpointDefinition[], collections: IntakeCollections = []) {
  const pending = new Map<string, {controller: AbortController; promise: Promise<unknown>; consumers: Set<symbol>}>();
  return async (id: string, signal?: AbortSignal): Promise<unknown> => {
    if (signal?.aborted) throw signal.reason;
    const endpoint = endpoints.find((item) => item.id === id);
    if (!endpoint) throw new Error(`API Endpoint '${id}'을 찾을 수 없습니다`);
    let request = pending.get(id);
    if (!request) {
      const controller = new AbortController();
      const target = targetCollectionOf(endpoint, collections);
      const promise = executeCollectionEndpoint(endpoint, controller.signal).then(async (items) => (await intake()).intakeQueryItems(items, target)).finally(() => {
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
