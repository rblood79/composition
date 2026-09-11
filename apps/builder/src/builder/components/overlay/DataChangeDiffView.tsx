/**
 * 데이터 proposal 승인 diff 뷰 — ADR-213 Phase 4 (AX-2 · R3 · R4, AgentReview 아트보드).
 *
 * `AgentCommandConfirmDialog` 가 `id === "data.propose"` 요청에 본문 대신 그린다. 요약은
 * `summarizeDataChange` (순수) 가 만들고 여기서는 문구만 붙인다: 테이블별 필드 추가/변경 ·
 * 행 삽입 수 + 샘플 3행 · 바인딩 변경 · endpoint 정의 (신규/변경) · "사용처 N" (152 역참조).
 * 되돌림 가능 표시는 다이얼로그 meta 줄 (undo: history) 이 이미 담당한다.
 */
import type { DataOp } from "@composition/shared";
import { useMemo } from "react";
import { useI18n } from "@/i18n";
import {
  summarizeDataChange,
  type DataChangeSummaryContext,
  type DataChangeSummaryItem,
  type RowSample,
} from "../../../services/ai/data/dataChangeSummary";
import { getDataToolReadModel } from "../../../services/ai/data/dataToolReadModel";
import { getAiToolReadModel } from "../../../services/ai/tools/canonicalToolReadModel";
import "./DataChangeDiffView.css";

/** store 에서 요약 컨텍스트를 읽는다 — 테스트는 `context` 를 직접 준다. */
export function readDataChangeSummaryContext(): DataChangeSummaryContext {
  const { collections, apiEndpoints, usage } = getDataToolReadModel();
  const { elementsById } = getAiToolReadModel();
  const elementTypes = new Map<string, string>();
  for (const [id, element] of elementsById) {
    if (typeof element.type === "string") elementTypes.set(id, element.type);
  }
  return {
    collections,
    usage,
    endpointIds: new Set(apiEndpoints.map((e) => e.id)),
    elementTypes,
  };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function SampleTable({ sample, label }: { sample: RowSample; label: string }) {
  return (
    <div className="data-diff-sample">
      <div className="data-diff-sample-label">{label}</div>
      <div className="data-diff-sample-scroll">
        <table>
          <thead>
            <tr>
              {sample.keys.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.rows.map((row, i) => (
              <tr key={i}>
                {sample.keys.map((key) => (
                  <td key={key}>{formatValue(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface DataChangeDiffViewProps {
  ops: readonly DataOp[];
  /** 생략하면 store 에서 읽는다 */
  context?: DataChangeSummaryContext;
}

export function DataChangeDiffView({ ops, context }: DataChangeDiffViewProps) {
  const { t } = useI18n();
  const summary = useMemo(
    () => summarizeDataChange(ops, context ?? readDataChangeSummaryContext()),
    [ops, context],
  );

  const line = (item: DataChangeSummaryItem): string => {
    switch (item.kind) {
      case "collection": {
        const name = item.collection.name;
        switch (item.op) {
          case "create_collection":
            return t("dataDiff.createCollection", {
              name,
              fieldCount: item.fieldCount ?? 0,
              rowCount: item.rowCount ?? 0,
            });
          case "update_collection":
            return t("dataDiff.updateCollection", { name });
          case "delete_collection":
            return t("dataDiff.deleteCollection", { name });
          case "set_source":
            return t("dataDiff.setSource", {
              name,
              source: item.source ?? "",
            });
        }
        break;
      }
      case "field": {
        const params = {
          name: item.collection.name,
          key: item.field.key,
          type: item.field.type ?? "",
        };
        switch (item.op) {
          case "add_field":
            return t("dataDiff.addField", params);
          case "update_field":
            return t("dataDiff.updateField", params);
          case "remove_field":
            return t("dataDiff.removeField", params);
        }
        break;
      }
      case "rows": {
        const params = { name: item.collection.name, count: item.rowCount };
        switch (item.op) {
          case "insert_rows":
            return t("dataDiff.insertRows", params);
          case "replace_rows":
            return t("dataDiff.replaceRows", params);
          case "remove_rows":
            return t("dataDiff.removeRows", params);
          case "set_cell":
            return t("dataDiff.setCell", {
              name: item.collection.name,
              row: item.cell?.rowIndex ?? 0,
              key: item.cell?.key ?? "",
            });
        }
        break;
      }
      case "endpoint": {
        const params = {
          name: item.endpoint.name,
          method: item.endpoint.method ?? "",
          url: item.endpoint.url ?? "",
        };
        if (item.op === "delete_endpoint")
          return t("dataDiff.deleteEndpoint", params);
        return t(
          item.endpoint.isNew
            ? "dataDiff.defineEndpointNew"
            : "dataDiff.defineEndpointUpdate",
          params,
        );
      }
      case "binding": {
        const element = item.element.type
          ? `${item.element.type} (${item.element.id})`
          : item.element.id;
        return item.collection
          ? t("dataDiff.bindElement", { element, name: item.collection.name })
          : t("dataDiff.unbindElement", { element });
      }
      case "variable":
        return t(
          item.removed ? "dataDiff.removeVariable" : "dataDiff.defineVariable",
          { name: item.name ?? item.variableId ?? "" },
        );
    }
    return (item as { op: string }).op;
  };

  const detail = (item: DataChangeSummaryItem): string | null => {
    if (item.kind === "field" && item.typeChange) {
      const type = t("dataDiff.typeChange", {
        from: item.typeChange.from ?? "",
        to: item.typeChange.to,
      });
      const used =
        item.usedBy && item.usedBy > 0
          ? t("dataDiff.usedBy", { count: item.usedBy })
          : t("dataDiff.usedByNone");
      return `${type} · ${used}`;
    }
    if (item.kind === "field" && item.op === "remove_field") {
      return item.usedBy && item.usedBy > 0
        ? t("dataDiff.usedBy", { count: item.usedBy })
        : t("dataDiff.usedByNone");
    }
    if (item.kind === "collection" && item.fields && item.fields.length > 0) {
      return t("dataDiff.fieldList", {
        fields: item.fields
          .map((f) => `${f.key}: ${f.type}${f.required ? " *" : ""}`)
          .join(" · "),
      });
    }
    if (item.kind === "endpoint" && item.endpoint.headerKeys.length > 0) {
      return t("dataDiff.headerKeys", {
        keys: item.endpoint.headerKeys.join(", "),
      });
    }
    if (item.kind === "binding" && item.fieldMap) {
      return t("dataDiff.fieldMap", {
        map: Object.entries(item.fieldMap)
          .map(([role, key]) => `${role}=${key}`)
          .join(", "),
      });
    }
    return null;
  };

  return (
    <div className="data-diff" data-testid="data-change-diff">
      <div className="data-diff-heading">
        <span>{t("dataDiff.heading")}</span>
        <span className="data-diff-count">
          {t("dataDiff.opsCount", { count: ops.length })}
        </span>
      </div>
      <ol className="data-diff-list">
        {summary.items.map((item, i) => {
          const extra = detail(item);
          const sample =
            (item.kind === "collection" || item.kind === "rows") && item.sample
              ? item.sample
              : null;
          const isNew =
            (item.kind === "collection" && item.collection.isNew) ||
            (item.kind === "endpoint" && item.endpoint.isNew);
          return (
            <li key={i} className="data-diff-item" data-op={item.op}>
              <div className="data-diff-line">
                <span className="data-diff-op">{item.op}</span>
                <span className="data-diff-text">{line(item)}</span>
                {isNew ? (
                  <span className="data-diff-badge">
                    {t("dataDiff.newBadge")}
                  </span>
                ) : null}
              </div>
              {extra ? <div className="data-diff-detail">{extra}</div> : null}
              {sample ? (
                <SampleTable
                  sample={sample}
                  label={t("dataDiff.sampleRows", {
                    count: sample.rows.length,
                  })}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {summary.usedBy.length > 0 ? (
        <ul className="data-diff-usage" data-testid="data-change-diff-usage">
          {summary.usedBy.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.name}</strong>:{" "}
              {t("dataDiff.usedBy", { count: entry.count })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
