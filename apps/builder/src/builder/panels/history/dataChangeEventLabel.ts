import type { DataOp } from "@composition/shared";
import type { DataChangeHistoryPayload } from "../../stores/utils/dataChange";

/**
 * ADR-248 4e-7: a data change's history label — the catalog history and the old History panel
 * both use it (moved out of `historyEntryLabel.ts`, which reads the old canonical events).
 */
/** 표시 시점 해소기 — 이 모듈은 순수 `.ts` 라 훅을 못 쓴다 (ADR-200 어법). */
export type TranslateFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/** The label of a recorded data change (the old `data` entry's, and the catalog history's). */
export function dataChangeEventLabel(
  event: DataChangeHistoryPayload | undefined,
  t: TranslateFn,
): string {
  const ops = event?.change.ops ?? [];
  if (event?.change.label) return event.change.label;
  if (ops.length !== 1) {
    return ops.length === 0
      ? t("history.entryData")
      : t("history.entryDataCount", { count: ops.length });
  }
  const op: DataOp = ops[0];
  switch (op.op) {
    case "set_cell":
      return t("history.entryDataCell");
    case "insert_rows":
      return t("history.entryDataRowsInsert", { count: op.rows.length });
    case "remove_rows":
      return t("history.entryDataRowsRemove", { count: op.rowIndexes.length });
    case "replace_rows":
      return t("history.entryDataRowsReplace", { count: op.rows.length });
    case "add_field":
      return t("history.entryDataFieldAdd", { key: op.field.key });
    case "update_field": {
      const inverse = event?.inverse.find(
        (candidate): candidate is Extract<DataOp, { op: "update_field" }> =>
          candidate.op === "update_field" && candidate.fieldId === op.fieldId,
      );
      const from = inverse?.patch.key;
      if (
        op.patch.key !== undefined &&
        from !== undefined &&
        from !== op.patch.key
      )
        return t("history.entryDataFieldRename", { from, to: op.patch.key });
      return t("history.entryDataFieldUpdate", {
        key: op.patch.key ?? from ?? op.fieldId,
      });
    }
    case "remove_field": {
      const inverse = event?.inverse.find(
        (candidate): candidate is Extract<DataOp, { op: "add_field" }> =>
          candidate.op === "add_field",
      );
      return t("history.entryDataFieldRemove", {
        key: inverse?.field.key ?? op.fieldId,
      });
    }
    case "create_collection":
      return t("history.entryDataCollectionCreate", { name: op.name });
    case "delete_collection": {
      const inverse = event?.inverse.find(
        (
          candidate,
        ): candidate is Extract<DataOp, { op: "create_collection" }> =>
          candidate.op === "create_collection",
      );
      return t("history.entryDataCollectionDelete", {
        name: inverse?.name ?? op.collectionId,
      });
    }
    case "update_collection":
      return t("history.entryDataCollectionUpdate", {
        name: op.patch.name ?? op.collectionId,
      });
    case "set_source":
      return t("history.entryDataSource");
    // ADR-213 Phase 4 — endpoint 정의 · 요소 바인딩도 data entry 로 온다
    case "define_endpoint":
      return t("history.entryDataEndpoint", { name: op.endpoint.name });
    case "delete_endpoint":
      return t("history.entryDataEndpoint", { name: op.endpointId });
    case "bind_element":
      return t("history.entryDataBinding", {
        name: op.collectionId ?? op.elementId,
      });
    default:
      return t("history.entryData");
  }
}
