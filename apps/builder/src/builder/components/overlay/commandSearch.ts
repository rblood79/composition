/**
 * 명령 검색 필터 — 명령 팔레트와 전체 메뉴 (ADR-249 §4-4 · R7) 가 같은 필드로
 * 거른다: 라벨 · id · 분류 · 단축키 표기. 표면마다 기준이 갈리면 같은 검색어가
 * 한쪽에서만 걸린다.
 */
export interface CommandSearchFields {
  label: string;
  id: string;
  category: string;
  shortcut: string;
}

/** 빈 검색어 (공백만 포함) 는 전부 통과한다. */
export function matchesCommandSearch(
  fields: CommandSearchFields,
  search: string,
): boolean {
  if (!search.trim()) return true;
  const query = search.toLowerCase();
  return (
    fields.label.toLowerCase().includes(query) ||
    fields.id.toLowerCase().includes(query) ||
    fields.category.toLowerCase().includes(query) ||
    fields.shortcut.toLowerCase().includes(query)
  );
}
