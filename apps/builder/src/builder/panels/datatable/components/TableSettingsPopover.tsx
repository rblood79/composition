/**
 * TableSettingsPopover — ADR-288 G6 수정 9 (사용자 2026-10-28 「설정 버튼 제거하고 배치」 ·
 * Supabase Table Editor 대조 2026-10-29: table settings live in the list row's ⋮ → «Edit table…»,
 * not behind a gear over the grid). The popover is the column editor's part (288 px, RAC Popover +
 * Dialog) anchored to the row; its body is `SettingsEditor` (ADR-218 data source: Use table data ·
 * API endpoint · Execution policy · Interval) with the handlers that used to sit in
 * `DataTableEditor` — applyDataChange only (HC1), name through updateCollection.
 *
 * G6 수정 12 (사용자 「popover 내에 스타일들이 빌더의 디자인패턴 ui 가 전혀 적용이 안 되었다」): the
 * body is a panel `Section` (the `.section` scope — form-controls · panel-system rules reach a
 * portal only under it) with `.fieldset-row` rows of the 7-column grid ([6][ ] · [3][3][ ]) and the
 * inspector parts (`PropertyInput` · `PropertySwitch` · `PropertySelect`) — no local form CSS.
 */

import { useCallback, useMemo, type RefObject } from "react";
import { Dialog } from "react-aria-components/Dialog";
import { Popover } from "react-aria-components/Popover";
import { useDataStore } from "../../../stores/data";
import type {
  ApiEndpoint,
  DataTable,
  ExecutionPolicy,
} from "../../../../types/builder/data.types";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { Section } from "../../../components/panel/Section";
import { findLinkedApi } from "../utils/collectionBadgeStatus";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import "./TableSettingsPopover.css";

export interface TableSettingsPopoverProps {
  table: DataTable;
  /** The row's actions cell — the popover anchors under it. */
  triggerRef: RefObject<Element | null>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TableSettingsPopover({
  table,
  triggerRef,
  isOpen,
  onOpenChange,
}: TableSettingsPopoverProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  return (
    <Popover
      triggerRef={triggerRef}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="bottom end"
      className="react-aria-Popover datatable-settings-popover"
    >
      <Dialog
        className="react-aria-Dialog datatable-settings-dialog"
        aria-label={`${localize("tableSettings", "Table settings")} ${table.name}`}
      >
        <TableSettings table={table} />
      </Dialog>
    </Popover>
  );
}

/** The settings with their store handlers — the popover's content. */
export function TableSettings({ table }: { table: DataTable }) {
  const updateCollection = useDataStore((state) => state.updateCollection);
  const applyDataChange = useDataStore((state) => state.applyDataChange);
  const apiEndpointsMap = useDataStore((state) => state.apiEndpoints);
  const endpoints = useMemo(
    () => Array.from(apiEndpointsMap.values()),
    [apiEndpointsMap],
  );

  // ADR-218 — 실행 정책 변경 (applyDataChange only, HC1). manual = 필드 제거(null).
  const handlePolicyChange = useCallback(
    async (mode: "auto" | "manual" | "interval", intervalSec?: number) => {
      const policy =
        mode === "manual"
          ? null
          : mode === "interval"
            ? { mode, intervalSec: intervalSec ?? 30 }
            : { mode };
      try {
        await applyDataChange({
          ops: [{ op: "set_execution_policy", collectionId: table.id, policy }],
          origin: "user",
        });
      } catch (error) {
        console.error("실행 정책 변경 실패:", error);
      }
    },
    [table.id, applyDataChange],
  );

  // ADR-218 — endpoint 연결 (set_source{endpointId}, cardinality 0..1). "" = 해제.
  const handleEndpointChange = useCallback(
    async (endpointId: string) => {
      try {
        await applyDataChange({
          ops: [
            {
              op: "set_source",
              collectionId: table.id,
              source: endpointId === "" ? "manual" : "api",
              endpointId,
            },
          ],
          origin: "user",
        });
      } catch (error) {
        console.error("엔드포인트 연결 실패:", error);
      }
    },
    [table.id, applyDataChange],
  );

  const handleUseMockDataToggle = useCallback(
    async (checked: boolean) => {
      try {
        await updateCollection(table.id, { useMockData: checked });
      } catch (error) {
        console.error("useMockData 업데이트 실패:", error);
      }
    },
    [table.id, updateCollection],
  );

  const handleNameChange = useCallback(
    async (name: string) => {
      try {
        await updateCollection(table.id, { name });
      } catch (error) {
        console.error("이름 업데이트 실패:", error);
      }
    },
    [table.id, updateCollection],
  );

  return (
    <SettingsEditor
      name={table.name}
      useMockData={table.useMockData}
      executionPolicy={table.executionPolicy}
      endpoints={endpoints}
      linkedEndpointId={findLinkedApi(table, endpoints)?.id ?? ""}
      onNameChange={handleNameChange}
      onUseMockDataChange={handleUseMockDataToggle}
      onEndpointChange={handleEndpointChange}
      onPolicyChange={handlePolicyChange}
    />
  );
}

// ============================================
// Settings Editor (moved as is from editors/DataTableEditor.tsx)
// ============================================

interface SettingsEditorProps {
  name: string;
  useMockData: boolean;
  executionPolicy?: ExecutionPolicy;
  endpoints: ApiEndpoint[];
  linkedEndpointId: string;
  onNameChange: (name: string) => void;
  onUseMockDataChange: (checked: boolean) => void;
  onEndpointChange: (endpointId: string) => void;
  onPolicyChange: (
    mode: "auto" | "manual" | "interval",
    intervalSec?: number,
  ) => void;
}

export function SettingsEditor({
  name,
  useMockData,
  executionPolicy,
  endpoints,
  linkedEndpointId,
  onNameChange,
  onUseMockDataChange,
  onEndpointChange,
  onPolicyChange,
}: SettingsEditorProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const policyMode = executionPolicy?.mode ?? "manual";
  // PropertyInput keeps its own draft and follows the value prop (undo · rename from the list),
  // committing on blur / Enter only when the text changed.
  const interval = executionPolicy?.intervalSec ?? 30;

  const endpointOptions = [
    { value: "", label: localize("endpointNone", "Not connected") },
    ...endpoints.map((ep) => ({ value: ep.id, label: ep.name })),
  ];
  const policyOptions = [
    { value: "manual", label: localize("policyManual", "Manual") },
    { value: "auto", label: localize("policyAuto", "Auto") },
    { value: "interval", label: localize("policyInterval", "Interval") },
  ];

  return (
    <Section
      id="datatable-table-settings"
      title={localize("tableSettings", "Table settings")}
      collapsible={false}
      className="datatable-settings-section"
    >
      <div className="fieldset-row" data-wide>
        <PropertyInput
          label={localize("tableName", "Table Name")}
          value={name}
          onChange={(next) => {
            const trimmed = next.trim();
            if (trimmed !== "" && trimmed !== name) onNameChange(trimmed);
          }}
        />
      </div>
      <div className="fieldset-row" data-wide>
        <PropertySwitch
          label={localize("fields.useTableData", "Use Table Data")}
          isSelected={useMockData}
          onChange={onUseMockDataChange}
        />
      </div>
      {/* ADR-218 — 데이터 소스: API 엔드포인트 연결 + 실행 정책 */}
      <div className="fieldset-row" data-wide>
        <PropertySelect
          label={localize("dataEndpoint", "API endpoint")}
          value={linkedEndpointId}
          options={endpointOptions}
          optionValueMode="literal"
          onChange={onEndpointChange}
        />
      </div>
      <div
        className="fieldset-row"
        data-wide={policyMode === "interval" ? undefined : true}
      >
        <PropertySelect
          label={localize("executionPolicy", "Execution policy")}
          value={policyMode}
          options={policyOptions}
          optionValueMode="literal"
          onChange={(mode) =>
            onPolicyChange(mode as "auto" | "manual" | "interval", interval)
          }
        />
        {policyMode === "interval" && (
          <PropertyInput
            label={localize("intervalSeconds", "Interval (seconds)")}
            type="number"
            min={1}
            value={interval}
            onChange={(next) =>
              onPolicyChange("interval", Math.max(1, Number(next) || 1))
            }
          />
        )}
      </div>
    </Section>
  );
}
