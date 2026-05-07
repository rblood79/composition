export interface OrderedElementLike {
  id: string;
  order_num?: number | null;
}

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

export function compareElementsByOrderThenSource<T extends OrderedElementLike>(
  left: T,
  right: T,
  sourceIndexById?: ReadonlyMap<string, number>,
): number {
  const orderDiff = (left.order_num ?? 0) - (right.order_num ?? 0);
  if (orderDiff !== 0) return orderDiff;

  if (sourceIndexById) {
    const sourceDiff =
      (sourceIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (sourceIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    if (sourceDiff !== 0) return sourceDiff;
  }

  return left.id.localeCompare(right.id);
}

export function sortElementsByOrderThenSource<T extends OrderedElementLike>(
  elements: readonly T[],
  sourceElements: readonly { id: string }[] = elements,
): T[] {
  const sourceIndexById = createElementSourceIndex(sourceElements);
  return [...elements].sort((left, right) =>
    compareElementsByOrderThenSource(left, right, sourceIndexById),
  );
}
