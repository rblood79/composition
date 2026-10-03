/**
 * ADR-013 Quick Connect — the store-free part (ADR-248 4e-7): the precheck result, the Table column
 * plan and its mode, and the run input. The catalog host and the Creator read these; the old
 * store execution (`quickConnect.ts`) re-exports them.
 */
import type {
  DataField,
  DataTableCreate,
} from "../../../../types/builder/data.types";
import type { QuickConnectTarget } from "../types/editorTypes";

export type QuickConnectPrecheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "context" | "binding-changed" };

export interface TableColumnPlan {
  tableId: string;
  /** plain Table 의 TableHeader id · ref instance 는 `<instance>/<origin 안 경로>` (ADR-241) */
  tableHeaderId: string;
  pageId: string | null;
  /** 기존 Column 자식 — 순서 그대로 (instance 는 자기 열 · 없으면 origin 열) */
  existing: { id: string; key: string; label: string }[];
  /** ADR-241 Phase 2 — ref instance Table: 열은 instance 자기 열 (`descendants` mode C) 로 쓴다 */
  instance?: boolean;
}

/** 기존 컬럼 중 새 schema 에 같은 key 가 없는 것 — 실행 전에 사용자에게 보인다 (§4 재연결). */
export function unmatchedColumnKeys(
  plan: TableColumnPlan,
  schema: readonly Pick<DataField, "key">[],
): string[] {
  const keys = new Set(schema.map((f) => f.key));
  return plan.existing.filter((c) => !keys.has(c.key)).map((c) => c.key);
}

export type QuickConnectColumnMode = "none" | "create" | "preserve" | "replace";

export function resolveColumnMode(
  plan: TableColumnPlan | null,
  replaceColumns: boolean,
): QuickConnectColumnMode {
  if (!plan) return "none";
  if (plan.existing.length === 0) return "create";
  return replaceColumns ? "replace" : "preserve";
}

export interface ExecuteQuickConnectInput {
  input: DataTableCreate;
  target: QuickConnectTarget;
  projectId: string;
  /** Table 재연결 — 기존 컬럼을 새 schema 로 전면 교체 (명시적 선택일 때만 true) */
  replaceColumns?: boolean;
}
