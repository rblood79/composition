/**
 * DataSurfaceBody — ADR-288 Decision 1: the Data panel's body (the old `DataTableEditorPanel`
 * content, moved as is). `dataTableEditorStore.mode` says what it draws: a table's creator or
 * grid, an API's creator or form, the variable creator, or the project's variable table. The
 * header's close goes back to the list (the panel itself stays). The table's settings are not a
 * body view any more (ADR-288 G6 수정 9, 사용자 2026-10-28 「설정 버튼 제거」 · Supabase 대조) —
 * they open from the list row's ⋮ → «Edit table…» (`components/TableSettingsPopover`).
 *
 * ⚡ `key={getModeKey(mode)}` on the caller remounts the body per mode (state resets without
 * effects).
 */
import { useMemo } from "react";
import { FileEdit, Globe, Table2, Variable } from "lucide-react";
import { useDataStore } from "../../stores/data";
import {
  DataTableCreator,
  DataTableEditor,
  ApiEndpointEditor,
  ApiEndpointCreator,
  VariableCreator,
} from "./editors";
import { VariableList } from "./components/VariableList";
import { EmptyState } from "../../components/feedback/EmptyState";
import { PanelHeader } from "../../components/panel/PanelHeader";
import { PanelContents } from "../../components/panel/PanelContents";
import type { DataTableEditorMode } from "./types/editorTypes";
import { iconProps } from "../../../utils/ui/uiConstants";
import { translateKey, useOptionalI18n } from "../../../i18n";

interface DataSurfaceBodyProps {
  mode: NonNullable<DataTableEditorMode>;
  /** Back to the list (the body empties; in a narrow panel the list shows again). */
  close: () => void;
}

export function DataSurfaceBody({ mode, close }: DataSurfaceBodyProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const updateCollection = useDataStore((state) => state.updateCollection);

  const dataTablesMap = useDataStore((state) => state.collections);
  const apiEndpointsMap = useDataStore((state) => state.apiEndpoints);
  const collections = useMemo(
    () => Array.from(dataTablesMap.values()),
    [dataTablesMap],
  );
  const apiEndpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );

  const title = (): string => {
    switch (mode.type) {
      case "table-create":
        return localize("creatorTitle", "Data Table Creator");
      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        return dataTable?.name || localize("tableEditor", "Table Editor");
      }
      case "api-create":
        return localize("newApi", "New API");
      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        return endpoint?.name || localize("apiEditor", "API Editor");
      }
      case "variable-create":
        return localize("newVariable", "New Variable");
      case "variables":
        return localize("variables", "Variables");
    }
  };

  const icon = (() => {
    switch (mode.type) {
      case "table-create":
      case "table-edit":
        return <Table2 {...iconProps} />;
      case "api-create":
      case "api-edit":
        return <Globe {...iconProps} />;
      case "variable-create":
      case "variables":
        return <Variable {...iconProps} />;
    }
  })();

  // table-edit: title double-click rename (Airtable tab rename) — the settings popover keeps a name field too
  const onTitleCommit =
    mode.type === "table-edit"
      ? (next: string) => {
          const name = next.trim();
          if (name === "") return;
          void updateCollection(mode.tableId, { name }).catch((error) => {
            console.error("이름 업데이트 실패:", error);
          });
        }
      : undefined;

  const content = () => {
    switch (mode.type) {
      case "table-create":
        return (
          <DataTableCreator
            projectId={mode.projectId}
            connect={mode.connect}
            onClose={close}
          />
        );
      case "table-edit": {
        const dataTable = collections.find((t) => t.id === mode.tableId);
        if (!dataTable)
          return (
            <EmptyState
              icon={<Table2 size={32} />}
              message={localize("tableNotFound", "Table not found")}
            />
          );
        return (
          <DataTableEditor dataTable={dataTable} onClose={close} />
        );
      }
      case "api-create":
        return (
          <ApiEndpointCreator projectId={mode.projectId} onClose={close} />
        );
      case "api-edit": {
        const endpoint = apiEndpoints.find((e) => e.id === mode.endpointId);
        if (!endpoint)
          return (
            <EmptyState
              icon={<Globe size={32} />}
              message={localize("apiNotFound", "API not found")}
            />
          );
        return (
          <ApiEndpointEditor
            endpoint={endpoint}
            onClose={close}
            initialTab={mode.initialTab}
          />
        );
      }
      case "variable-create":
        return <VariableCreator projectId={mode.projectId} onClose={close} />;
      case "variables":
        return <VariableList projectId={mode.projectId} />;
    }
  };

  return (
    <div className="datatable-body" data-mode={mode.type}>
      <PanelHeader
        className="datatable-body-header"
        icon={icon ?? <FileEdit {...iconProps} />}
        title={title()}
        onTitleCommit={onTitleCommit}
        onClose={close}
      />
      <PanelContents className="datatable-body-contents">
        {content()}
      </PanelContents>
    </div>
  );
}

/** A key per mode — the body remounts when the mode (or its target) changes. */
export function dataSurfaceModeKey(
  mode: NonNullable<DataTableEditorMode>,
): string {
  switch (mode.type) {
    case "table-create":
      // ADR-013 — another connect target (the Data row of another element) starts the inputs over
      return `table-create-${mode.projectId}-${mode.connect?.elementId ?? ""}`;
    case "table-edit":
      return `table-edit-${mode.tableId}`;
    case "api-create":
      return `api-create-${mode.projectId}`;
    case "api-edit":
      return `api-edit-${mode.endpointId}`;
    case "variable-create":
      return `variable-create-${mode.projectId}`;
    case "variables":
      return `variables-${mode.projectId}`;
  }
}
