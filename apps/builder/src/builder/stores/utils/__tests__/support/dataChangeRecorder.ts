import {
  setDataHistoryRecorder,
  setDocumentVariableNamesReader,
} from "../../dataChange";

/**
 * ADR-248 4e-9 C: the data change tests' wiring — the history recorder hands each applied change to
 * `addEntry` as one data entry (payload + affected ids), and the document holds no variable names
 * unless a test sets them. The app installs the catalog's (`CatalogBuilderCore`); the old store's
 * wiring went with the old store.
 */
export function installTestDataChangeRecorder(
  addEntry: (entry: {
    type: "data";
    elementId: string;
    elementIds: string[];
    data: { dataChangeEvent: unknown };
  }) => void,
): void {
  setDocumentVariableNamesReader(() => new Set<string>());
  setDataHistoryRecorder((payload, affectedIds) =>
    addEntry({
      type: "data",
      elementId: affectedIds[0] ?? "",
      elementIds: affectedIds,
      data: { dataChangeEvent: payload },
    }),
  );
}
