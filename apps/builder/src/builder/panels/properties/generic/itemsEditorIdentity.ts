export interface ItemEditorIdentity {
  key: string;
  target: string | number;
}

/** 원본 데이터의 ID는 선택 시 생성하지 않는다. 없는/중복 ID는 배열 위치로 편집한다. */
export function resolveItemEditorIdentities(
  items: readonly Record<string, unknown>[],
): ItemEditorIdentity[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (typeof item.id === "string" && item.id.length > 0)
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  return items.map((item, index) => {
    const id = item.id;
    return typeof id === "string" && counts.get(id) === 1
      ? { key: `id:${id}`, target: id }
      : { key: `position:${index}`, target: index };
  });
}
