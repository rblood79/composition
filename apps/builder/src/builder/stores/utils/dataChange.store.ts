import { collectDocumentVariableNames } from "@composition/shared";
import { getActiveCanonicalDocument } from "../canonical/canonicalElementsBridge";
import { historyManager } from "../history";
import {
  setDataHistoryRecorder,
  setDocumentVariableNamesReader,
} from "./dataChange";

/**
 * ADR-248 4e-7: the old element store's data change wiring — page/element variable names from the
 * old canonical document and the history entry in the old history manager. The catalog Builder
 * installs its own (`CatalogBuilderCore`); old-store tests import this module. Goes with the old
 * store.
 */
export function installStoreDataChangeWiring(): void {
  setDocumentVariableNamesReader(() =>
    collectDocumentVariableNames(getActiveCanonicalDocument()),
  );
  setDataHistoryRecorder((payload, affectedIds) =>
    historyManager.addEntry({
      type: "data",
      elementId: affectedIds[0] ?? "",
      elementIds: affectedIds,
      data: { dataChangeEvent: payload },
    }),
  );
}

installStoreDataChangeWiring();
