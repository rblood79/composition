/**
 * A field's Label record — in its S2 `FieldLabel` row (every labelled origin holds one,
 * 2026-11-18) or, for a field placed without the row, a direct child.
 */
export function fieldLabelRecord<T extends { children: readonly string[] }>(
  records: ReadonlyMap<string, T>,
  typeOf: (record: T) => string,
  field: { children: readonly string[] },
): T | undefined {
  for (const id of field.children) {
    const child = records.get(id);
    if (!child) continue;
    if (typeOf(child) === "Label") return child;
    if (typeOf(child) === "FieldLabel") {
      const inRow = fieldLabelRecord(records, typeOf, child);
      if (inRow) return inRow;
    }
  }
  return undefined;
}
