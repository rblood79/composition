import type { Page } from "../../../types/builder/unified.types";

export interface PageQueryResult {
  /** 트리에 넘길 페이지 — 일치 페이지 + 그 조상 (계층 유지), 원래 순서 보존 */
  pages: Page[];
  /** 일치 페이지를 드러내려고 펼쳐야 하는 조상 id */
  expandIds: Set<string>;
  /** 실제 일치한 페이지 수 (조상 제외) */
  matchCount: number;
  /** 정규화된 질의 — 빈 문자열이면 필터 없음 */
  query: string;
}

export function normalizePageQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * 제목·slug 부분 일치 (대소문자 무시) 로 페이지를 거른다.
 * 일치한 페이지의 조상은 함께 남겨 PageTree 가 계층을 그대로 그릴 수 있게 하고,
 * 그 조상 id 를 `expandIds` 로 돌려줘 일치 항목이 접힌 채 숨지 않게 한다.
 */
export function filterPagesByQuery(
  pages: readonly Page[],
  rawQuery: string,
): PageQueryResult {
  const query = normalizePageQuery(rawQuery);
  if (!query) {
    return {
      pages: pages as Page[],
      expandIds: new Set(),
      matchCount: pages.length,
      query,
    };
  }

  const byId = new Map(pages.map((page) => [page.id, page] as const));
  const keep = new Set<string>();
  const expandIds = new Set<string>();
  let matchCount = 0;

  for (const page of pages) {
    const haystack = `${page.title ?? ""}\n${page.slug ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) continue;

    matchCount += 1;
    keep.add(page.id);

    let parentId = page.parent_id ?? null;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      keep.add(parentId);
      expandIds.add(parentId);
      parentId = byId.get(parentId)?.parent_id ?? null;
    }
  }

  return {
    pages: pages.filter((page) => keep.has(page.id)),
    expandIds,
    matchCount,
    query,
  };
}
