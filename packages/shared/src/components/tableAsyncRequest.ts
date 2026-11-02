import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ApiFetcher, DataMapping } from "./Table.runtime";

interface Page<T> {
  items: T[];
  total: number;
}

/** 요청 입력이 바뀌면 이전 응답을 폐기한다. 서비스 API가 취소를 지원하지 않아도 적용은 차단한다. */
export function useTableAsyncRequest<T>({
  enabled,
  service,
  customUrl,
  path,
  params,
  mapping,
  pageSize,
  mode,
  sort,
  mapResponse,
}: {
  enabled: boolean;
  service: ApiFetcher<unknown> | undefined;
  customUrl: string | undefined;
  path: string | undefined;
  params: Record<string, unknown> | undefined;
  mapping: DataMapping | undefined;
  pageSize: number;
  mode: string;
  sort?: { sortBy: string; desc: boolean };
  mapResponse: (response: unknown, mapping?: DataMapping) => Page<T>;
}) {
  // 정렬은 클라이언트에서 즉시 적용한다. 다음 페이지 요청에는 최신 정렬 인자를 보존한다.
  const latestSort = useRef(sort);
  useLayoutEffect(() => {
    latestSort.current = sort;
  }, [sort]);
  // 구조가 같은 inline props는 같은 요청이다. 함수인 service는 참조로 추적한다.
  const paramsKey = JSON.stringify(params ?? {});
  const mappingKey = JSON.stringify(mapping ?? null);
  const query = useMemo(
    () => ({
      enabled,
      service,
      customUrl,
      path,
      pageSize,
      mode,
      params: JSON.parse(paramsKey) as Record<string, unknown>,
      mapping: JSON.parse(mappingKey) as DataMapping | undefined,
    }),
    [enabled, service, customUrl, path, pageSize, mode, paramsKey, mappingKey],
  );
  const active = useRef<{
    controller: AbortController;
    pending: boolean;
    query: typeof query;
  } | null>(null);
  const [pending, setPending] = useState<{
    query: typeof query;
    loading: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const scope = { controller: new AbortController(), pending: false, query };
    active.current = scope;
    return () => {
      scope.controller.abort();
      if (active.current === scope) active.current = null;
    };
  }, [query]);

  const requestPage = useCallback(
    async (
      page: number,
      limit = query.pageSize,
    ): Promise<Page<T> | undefined> => {
      const scope = active.current;
      if (
        !scope ||
        scope.query !== query ||
        scope.pending ||
        !query.enabled ||
        !query.path ||
        (!query.service && !query.customUrl)
      )
        return undefined;
      const current = () =>
        active.current === scope && !scope.controller.signal.aborted;
      scope.pending = true;
      setPending({ query, loading: true });
      try {
        const input = { ...query.params, ...latestSort.current, page, limit };
        let response: unknown;
        if (query.customUrl) {
          const search = new URLSearchParams(
            Object.entries(input).map(([key, value]) => [key, String(value)]),
          );
          const result = await fetch(
            `${query.customUrl}${query.path}?${search}`,
            { signal: scope.controller.signal },
          );
          if (!result.ok)
            throw new Error(`HTTP ${result.status}: ${result.statusText}`);
          response = await result.json();
        } else {
          response = await query.service!(query.path, input);
        }
        if (!current()) return undefined;
        const result = mapResponse(response, query.mapping);
        const meta = (response as { __meta?: { totalItems?: number } } | null)
          ?.__meta;
        return { ...result, total: meta?.totalItems ?? result.total };
      } catch (error) {
        if (current()) console.error("[Table] API request failed:", error);
        return undefined;
      } finally {
        scope.pending = false;
        if (current()) setPending({ query, loading: false });
      }
    },
    [query, mapResponse],
  );
  return {
    requestPage,
    sourceKey: query,
    loading: pending?.query === query && pending.loading,
  };
}
