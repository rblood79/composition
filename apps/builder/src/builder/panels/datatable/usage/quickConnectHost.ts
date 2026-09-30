import { createContext, useContext } from "react";
import type { DataTable } from "../../../../types/builder/data.types";
import type { QuickConnectTarget } from "../types/editorTypes";
import {
  captureQuickConnectTarget,
  executeQuickConnect,
  planTableColumns,
  precheckQuickConnectTarget,
  readBackQuickConnect,
  type ExecuteQuickConnectInput,
  type QuickConnectPrecheck,
  type TableColumnPlan,
} from "../utils/quickConnect";

/**
 * ADR-248 Phase 4e-4e: quick connect's document side (ADR-013 — create a table from the Properties
 * Data row and connect it): capture the target, recheck it, plan its Table columns, create +
 * connect as one history entry, read the binding back. The store host is the old element store's;
 * the catalog workspace provides its own.
 */
export interface QuickConnectHost {
  capture(elementId: string): QuickConnectTarget | null;
  precheck(target: QuickConnectTarget, projectId: string): QuickConnectPrecheck;
  planColumns(target: QuickConnectTarget): TableColumnPlan | null;
  execute(input: ExecuteQuickConnectInput): Promise<DataTable>;
  readBack(elementId: string, collectionId: string): boolean;
}

export const STORE_QUICK_CONNECT_HOST: QuickConnectHost = {
  capture: captureQuickConnectTarget,
  precheck: precheckQuickConnectTarget,
  planColumns: planTableColumns,
  execute: executeQuickConnect,
  readBack: readBackQuickConnect,
};

export const QuickConnectHostContext = createContext<QuickConnectHost | null>(
  null,
);

export function useQuickConnectHost(): QuickConnectHost {
  return useContext(QuickConnectHostContext) ?? STORE_QUICK_CONNECT_HOST;
}
