import { createContext, useContext } from "react";
import type { VariableDef, VisibleVariable } from "@composition/shared";
import type { Variable as VariableType } from "../../../../types/builder/data.types";
import { setPanelWorkspacePanelVisibility } from "../../../layout/panelWorkspaceVisibility";
import { useStateSectionFocus } from "../../properties/state/stateSectionFocus";

export interface VariableIndexGroup {
  pageId: string;
  title: string;
  entries: Array<
    | { kind: "doc"; entry: VisibleVariable; ownerLabel: string | null }
    | { kind: "legacy"; variable: VariableType; conflict: boolean }
  >;
}

export interface VariableIndexView {
  /** Places that use a variable (setState rules · `{$name}` templates that resolve to it). */
  usageCount: (variableId: string) => number;
  /** Page and element variables by page (page variables, element variables, then legacy). */
  groups: VariableIndexGroup[];
  pageTitle: (pageId: string) => string;
}

/**
 * ADR-248 Phase 4e-4e: the Data panel Variables tab's document side (ADR-214 Phase 5) — the
 * page/element variable index, usage counts, jump to an owner, and moving a legacy page-scoped
 * data-store variable onto its page. The catalog workspace provides it (no default).
 */
export interface DataVariablesHost {
  useView(
    legacyPageVariables: readonly VariableType[],
    projectDefs: readonly VariableDef[],
  ): VariableIndexView;
  jumpToOwner(entry: VisibleVariable): void;
  /** Move a legacy page variable onto its page; false = nothing moved. */
  migrateLegacyToPage(variable: VariableType): Promise<boolean>;
  /**
   * The Variable editor's page facts (a legacy page-scoped variable): the open page (Scope → page
   * and "Assign to current page" take it) and the owner page's title.
   */
  usePageContext(ownerPageId: string | undefined): {
    currentPageId: string | null;
    ownerTitle: string | undefined;
  };
}

/** Open Properties on the owner with its State section on the variable. */
export function focusVariableOwner(ownerNodeId: string, variableId: string) {
  setPanelWorkspacePanelVisibility("properties", true);
  useStateSectionFocus.getState().requestFocus(ownerNodeId, variableId);
}

export const DataVariablesHostContext = createContext<DataVariablesHost | null>(
  null,
);

/** Old-store tests only (`dataVariablesHost.store.ts`, removed with the old store): the host without a provider. */
let testFallback: DataVariablesHost | null = null;
export function setDataVariablesHostTestFallback(
  host: DataVariablesHost | null,
): void {
  testFallback = host;
}

export function useDataVariablesHost(): DataVariablesHost {
  const host = useContext(DataVariablesHostContext) ?? testFallback;
  if (!host) throw new Error("Data variables host is not provided");
  return host;
}
