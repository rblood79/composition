import type { ApiEndpointDefinition } from "../types/collection.types";

/** 앱 runtime 공통 API 실행. Chart/List는 CollectionDataProvider 서비스만 소비한다. */
export async function executeCollectionEndpoint(endpoint: ApiEndpointDefinition, signal: AbortSignal): Promise<unknown> {
  if (endpoint.executionMode === "server") throw new Error("서버 API 실행 서비스가 연결되지 않았습니다");
  const url = new URL(`${endpoint.baseUrl}${endpoint.path}`, window.location.href);
  for (const param of endpoint.queryParams ?? []) if (param.key) url.searchParams.append(param.key, param.value);
  const headers = Array.isArray(endpoint.headers)
    ? Object.fromEntries(endpoint.headers.filter((header) => header.enabled && header.key).map((header) => [header.key, header.value]))
    : endpoint.headers;
  const method = endpoint.method ?? "GET";
  const timeout = endpoint.timeout ?? 30000;
  const requestSignal = timeout > 0 && Number.isFinite(timeout) ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : signal;
  const response = await fetch(url, {method, headers, signal: requestSignal,
    body: method !== "GET" && method !== "HEAD" && endpoint.bodyType !== "none" ? endpoint.bodyTemplate : undefined});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  const dataPath = endpoint.responseMapping?.dataPath;
  const mapped = dataPath ? dataPath.split(".").reduce((value, key) => value?.[key], result) : result;
  if (mapped == null) return [];
  return mapped;
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
