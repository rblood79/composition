import { createContext, useContext } from "react";
import type { DataTable } from "../../../../types/builder/data.types";
import type { QuickConnectTarget } from "../types/editorTypes";
import type {
  ExecuteQuickConnectInput,
  QuickConnectPrecheck,
  TableColumnPlan,
} from "../utils/quickConnectPlan";

/**
 * ADR-248 Phase 4e-4e: quick connect's document side (ADR-013 — create a table from the Properties
 * Data row and connect it): capture the target, recheck it, plan its Table columns, create +
 * connect as one history entry, read the binding back. The catalog workspace provides it (no
 * default).
 */
export interface QuickConnectHost {
  capture(elementId: string): QuickConnectTarget | null;
  precheck(target: QuickConnectTarget, projectId: string): QuickConnectPrecheck;
  planColumns(target: QuickConnectTarget): TableColumnPlan | null;
  execute(input: ExecuteQuickConnectInput): Promise<DataTable>;
  readBack(elementId: string, collectionId: string): boolean;
}

export const QuickConnectHostContext = createContext<QuickConnectHost | null>(
  null,
);

/** Old-store tests only (`quickConnectHost.store.ts`, removed with the old store): the host without a provider. */
let testFallback: QuickConnectHost | null = null;
export function setQuickConnectHostTestFallback(
  host: QuickConnectHost | null,
): void {
  testFallback = host;
}

export function useQuickConnectHost(): QuickConnectHost {
  const host = useContext(QuickConnectHostContext) ?? testFallback;
  if (!host) throw new Error("Quick connect host is not provided");
  return host;
}
