/**
 * 필드 key 변경 시 행 값을 새 key 로 옮기는 순수 함수.
 *
 * Why (2026-09-11, 리서치 D2): 편집기의 handleUpdateField 가 schema 만 갱신해서
 * key 를 바꾸면 mockData · runtimeData 의 그 컬럼 값이 옛 key 아래에 고아로 남았다
 * (격자에는 빈 셀, 바인딩에는 undefined). 참조는 이름이므로 (ADR-152 재리뷰 전) 행도
 * 같이 옮긴다. 열 순서는 보존한다.
 */
export function renameRowKey<T extends Record<string, unknown>>(
  row: T,
  oldKey: string,
  newKey: string,
): Record<string, unknown> {
  if (oldKey === newKey || !(oldKey in row)) return row;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === oldKey) next[newKey] = v;
    else if (k === newKey)
      continue; // 새 key 가 이미 있으면 옛 값이 이긴다 (같은 컬럼)
    else next[k] = v;
  }
  return next;
}

export function renameRowsKey(
  rows: readonly Record<string, unknown>[] | undefined,
  oldKey: string,
  newKey: string,
): Record<string, unknown>[] | undefined {
  if (!rows || oldKey === newKey)
    return rows as Record<string, unknown>[] | undefined;
  return rows.map((row) => renameRowKey(row, oldKey, newKey));
}
