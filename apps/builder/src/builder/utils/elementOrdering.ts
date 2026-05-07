export function createElementSourceIndex<T extends { id: string }>(
  elements: readonly T[],
): Map<string, number> {
  const sourceIndexById = new Map<string, number>();
  elements.forEach((element, index) => {
    if (!sourceIndexById.has(element.id)) {
      sourceIndexById.set(element.id, index);
    }
  });
  return sourceIndexById;
}

export function compareElementsBySource<T extends { id: string }>(
  left: T,
  right: T,
  sourceIndexById?: ReadonlyMap<string, number>,
): number {
  if (sourceIndexById) {
    const sourceDiff =
      (sourceIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (sourceIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (sourceDiff !== 0) return sourceDiff;
  }

  return left.id.localeCompare(right.id);
}

export function sortElementsBySource<T extends { id: string }>(
  elements: readonly T[],
  sourceElements: readonly { id: string }[] = elements,
): T[] {
  const sourceIndexById = createElementSourceIndex(sourceElements);
  return [...elements].sort((left, right) =>
    compareElementsBySource(left, right, sourceIndexById),
  );
}
