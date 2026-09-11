/**
 * ImportPreview — ADR-212 Phase 5 (UX-3/M2). CSV·JSON 가져오기 staging.
 *
 * 파싱된 행 + 기존 스키마 → 열별 매핑 (기존/새/무시) · 전체 교체 vs 뒤에 추가 를 고르고, 한
 * DataChange (`importPlanToOps`: 새 열 add_field → replace_rows/insert_rows) 로 적용한다.
 * 모달이 아니라 격자 위 인라인 staging (스냅 패널 어법 HC2). 쓰기는 상위 `write` (applyDataChange).
 */
import { useMemo, useState } from "react";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { useI18n } from "../../../../i18n";
import type { DataField } from "../../../../types/builder/data.types";
import { PropertySelect } from "../../../components";
import {
  importPlanToOps,
  planImport,
  type ImportColumnAction,
} from "../utils/importPlan";
import "./ImportPreview.css";

export interface ImportPreviewProps {
  rows: Record<string, unknown>[];
  schema: readonly DataField[];
  collectionId: string;
  rowCount: number;
  write: (ops: DataOp[]) => Promise<boolean>;
  onDone: (importedRows: number | null) => void;
}

export function ImportPreview({
  rows,
  schema,
  collectionId,
  rowCount,
  write,
  onDone,
}: ImportPreviewProps) {
  const { t } = useI18n();
  const dt = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => t(`datatable.${key}`, params);
  const base = useMemo(() => planImport(rows, schema), [rows, schema]);
  const [actions, setActions] = useState<Record<string, ImportColumnAction>>(
    () => Object.fromEntries(base.columns.map((c) => [c.sourceKey, c.action])),
  );
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    const plan = {
      ...base,
      columns: base.columns.map((c) => ({
        ...c,
        action: actions[c.sourceKey] ?? c.action,
      })),
    };
    const ops = importPlanToOps(plan, {
      collectionId,
      mode,
      ...(mode === "append" ? { at: rowCount } : {}),
    });
    const ok = await write(ops);
    setBusy(false);
    onDone(ok ? rows.length : null);
  };

  return (
    <div
      className="datatable-import"
      role="group"
      aria-label={dt("importTitle")}
    >
      <div className="datatable-import-head">
        <span className="datatable-import-title">{dt("importTitle")}</span>
        <span className="datatable-import-count">
          {dt("importRows", { count: rows.length })}
        </span>
      </div>
      <div className="datatable-import-cols">
        {base.columns.map((col) => (
          <div className="datatable-import-col" key={col.sourceKey}>
            <span className="datatable-import-col-key">{col.sourceKey}</span>
            <span className="datatable-import-col-type">{col.type}</span>
            <PropertySelect
              value={actions[col.sourceKey] ?? col.action}
              onChange={(v) =>
                setActions((prev) => ({
                  ...prev,
                  [col.sourceKey]: v as ImportColumnAction,
                }))
              }
              options={[
                { value: "existing", label: dt("importActionExisting") },
                { value: "new", label: dt("importActionNew") },
                { value: "ignore", label: dt("importActionIgnore") },
              ]}
              aria-label={`${dt("importAction")} ${col.sourceKey}`}
            />
          </div>
        ))}
      </div>
      <div
        className="datatable-import-mode"
        role="radiogroup"
        aria-label={dt("importAction")}
      >
        {(["replace", "append"] as const).map((m) => (
          <label key={m} className="datatable-import-mode-opt">
            <input
              type="radio"
              name="import-mode"
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {dt(m === "replace" ? "importModeReplace" : "importModeAppend")}
          </label>
        ))}
      </div>
      <div className="datatable-import-actions">
        <Button className="control-button" onPress={() => onDone(null)}>
          {dt("importCancel")}
        </Button>
        <Button
          className="control-button"
          data-variant="primary"
          onPress={() => void apply()}
          isDisabled={busy}
        >
          {dt("importApply")}
        </Button>
      </div>
    </div>
  );
}
