/**
 * ImportPreview — ADR-212 Phase 5 (UX-3/M2). CSV·JSON 가져오기 staging.
 *
 * 파싱된 행 + 기존 스키마 → 열별 매핑 (기존/새/무시) · 전체 교체 vs 뒤에 추가 를 고르고, 한
 * DataChange (`importPlanToOps`: 새 열 add_field → replace_rows/insert_rows) 로 적용한다.
 * 모달이 아니라 격자 위 인라인 staging (스냅 패널 어법 HC2). 쓰기는 상위 `write` (applyDataChange).
 */
import type { IntakeSource } from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import { useMemo, useState } from "react";
import type { DataOp } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { useI18n } from "../../../../i18n";
import { Section } from "../../../components/panel/Section";
import { PropertySegment } from "../../../components/property/PropertySegment";
import type { DataField } from "../../../../types/builder/data.types";
import { CompactSelect } from "../editors/CompactSelect";
import {
  importPlanReport,
  importPlanToOps,
  planImport,
  type ImportColumnAction,
} from "../utils/importPlan";
import "./ImportPreview.css";

export interface ImportPreviewProps {
  rows: Record<string, unknown>[];
  /** ADR-313 — the source kind (JSON · CSV / tab text) the file told. */
  source: IntakeSource;
  schema: readonly DataField[];
  collectionId: string;
  rowCount: number;
  write: (ops: DataOp[]) => Promise<boolean>;
  onDone: (importedRows: number | null) => void;
}

export function ImportPreview({
  rows,
  source,
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
  const base = useMemo(
    () => planImport(rows, schema, source),
    [rows, schema, source],
  );
  const [actions, setActions] = useState<Record<string, ImportColumnAction>>(
    () => Object.fromEntries(base.columns.map((c) => [c.sourceKey, c.action])),
  );
  // ADR-313 G3 — what the import does not read as the target types (per source column): a JSON
  // value of another type stays as is (counted), a text that does not read is emptied.
  const report = useMemo(() => importPlanReport(base), [base]);
  const countsOf = (key: string) =>
    (
      [
        ["intakeTypeMismatch", report.typeMismatch[key]],
        ["intakeUnread", report.unread[key]],
        ["intakePrecision", report.precision[key]],
      ] as const
    )
      .filter(([, count]) => !!count)
      .map(([label, count]) => dt(label, { count: count! }))
      .join(" · ");
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
    <Section
      title={dt("importTitle")}
      collapsible={false}
      className="datatable-import"
      badge={
        <span className="datatable-import-count">
          {dt("importRows", { count: rows.length })}
        </span>
      }
    >
      <div className="datatable-import-cols">
        {base.columns.map((col) => (
          <div className="datatable-import-col" key={col.sourceKey}>
            <span className="datatable-import-col-key">{col.sourceKey}</span>
            <span className="datatable-import-col-type">{col.type}</span>
            {countsOf(col.sourceKey) ? (
              <span className="datatable-import-col-counts">
                {countsOf(col.sourceKey)}
              </span>
            ) : null}
            <CompactSelect
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
      <PropertySegment
        label={dt("importMode")}
        value={mode}
        onChange={(m) => setMode(m as typeof mode)}
        options={[
          { value: "replace", label: dt("importModeReplace") },
          { value: "append", label: dt("importModeAppend") },
        ]}
      />
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
    </Section>
  );
}
