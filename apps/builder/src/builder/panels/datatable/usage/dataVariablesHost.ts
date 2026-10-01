import { createContext, useCallback, useContext, useMemo } from "react";
import {
  collectDocumentVariables,
  collectVariableUsages,
  findCanonicalNodeById,
  findVariableNameConflict,
  isBodyType,
  isVariableDefList,
  resolveAncestorChainIds,
  type VariableDef,
  type VisibleVariable,
} from "@composition/shared";
import type { Variable as VariableType } from "../../../../types/builder/data.types";
import { useStore } from "../../../stores";
import {
  getActiveCanonicalDocument,
  useActiveCanonicalDocument,
} from "../../../stores/canonical/canonicalElementsBridge";
import { useDataStore } from "../../../stores/data";
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
 * data-store variable onto its page. The store host reads the old canonical document; the catalog
 * workspace provides its own.
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

export const STORE_DATA_VARIABLES_HOST: DataVariablesHost = {
  usePageContext(ownerPageId) {
    const currentPageId = useStore((state) => state.currentPageId);
    const ownerTitle = useStore((state) =>
      ownerPageId
        ? state.pages.find((page) => page.id === ownerPageId)?.title
        : undefined,
    );
    return { currentPageId, ownerTitle };
  },
  useView(legacyPageVariables, projectDefs) {
    const doc = useActiveCanonicalDocument();
    const pages = useStore((state) => state.pages);
    // 정의당 문서 전체 순회 — 같은 문서·정의 집합이면 한 번만 (렌더마다 정의 수 × 순회 방지)
    const usageCount = useMemo(() => {
      const counts = new Map<string, number>();
      return (variableId: string) => {
        let count = counts.get(variableId);
        if (count === undefined) {
          count = collectVariableUsages(
            doc,
            doc?.events,
            variableId,
            projectDefs,
          ).length;
          counts.set(variableId, count);
        }
        return count;
      };
    }, [doc, projectDefs]);
    const pageTitle = useCallback(
      (pageId: string) =>
        pages.find((page) => page.id === pageId)?.title ??
        (doc ? findCanonicalNodeById(doc, pageId)?.name : undefined) ??
        pageId,
      [doc, pages],
    );
    const groups = useMemo<VariableIndexGroup[]>(() => {
      const byPage = new Map<string, VariableIndexGroup>();
      const groupFor = (pageId: string) => {
        let group = byPage.get(pageId);
        if (!group) {
          group = { pageId, title: pageTitle(pageId), entries: [] };
          byPage.set(pageId, group);
        }
        return group;
      };
      for (const entry of collectDocumentVariables(doc)) {
        if (entry.owner.kind === "page") {
          groupFor(entry.owner.pageId).entries.push({
            kind: "doc",
            entry,
            ownerLabel: null,
          });
        } else if (entry.owner.kind === "element" && doc) {
          const chain = resolveAncestorChainIds(doc, entry.owner.elementId);
          const pageId = chain[chain.length - 1] ?? "";
          const node = findCanonicalNodeById(doc, entry.owner.elementId);
          const ownerLabel = node?.name ?? node?.type ?? entry.owner.elementId;
          groupFor(pageId).entries.push({ kind: "doc", entry, ownerLabel });
        }
      }
      for (const variable of legacyPageVariables) {
        if (variable.owner?.kind !== "page") continue;
        const conflict =
          findVariableNameConflict(
            doc,
            { kind: "page", pageId: variable.owner.pageId },
            variable.name,
            projectDefs,
            variable.id,
          ) !== null;
        groupFor(variable.owner.pageId).entries.push({
          kind: "legacy",
          variable,
          conflict,
        });
      }
      return [...byPage.values()].sort((a, b) =>
        a.title.localeCompare(b.title),
      );
    }, [doc, legacyPageVariables, pageTitle, projectDefs]);
    return { usageCount, groups, pageTitle };
  },
  jumpToOwner(entry) {
    const doc = getActiveCanonicalDocument();
    const owner = entry.owner;
    if (owner.kind === "project" || !doc) return;
    const pageId =
      owner.kind === "page"
        ? owner.pageId
        : (resolveAncestorChainIds(doc, owner.elementId).slice(-1)[0] ?? null);
    if (!pageId) return;
    const store = useStore.getState();
    const targetId =
      owner.kind === "element"
        ? owner.elementId
        : (store.pageElementsSnapshot[pageId]?.find((element) =>
            isBodyType(element.type),
          )?.id ?? null);
    const activate = () => {
      const latest = useStore.getState();
      const selectId =
        targetId ??
        latest.pageElementsSnapshot[pageId]?.find((element) =>
          isBodyType(element.type),
        )?.id ??
        null;
      latest.activatePage(pageId, selectId);
      focusVariableOwner(
        owner.kind === "page" ? pageId : owner.elementId,
        entry.def.id,
      );
    };
    if (store.lazyLoadingEnabled && !store.isPageLoaded(pageId)) {
      void store.lazyLoadPageElements(pageId).then(activate);
    } else {
      activate();
    }
  },
  async migrateLegacyToPage(variable) {
    const doc = getActiveCanonicalDocument();
    if (variable.owner?.kind !== "page" || !doc) return false;
    const pageId = variable.owner.pageId;
    const pageNode = findCanonicalNodeById(doc, pageId);
    const current = isVariableDefList(pageNode?.state) ? pageNode.state : [];
    const def: VariableDef = {
      id: variable.id,
      name: variable.name,
      type: variable.type,
      ...(variable.defaultValue !== undefined
        ? { defaultValue: variable.defaultValue }
        : {}),
    };
    if (!useStore.getState().setPageState(pageId, [...current, def]))
      return false;
    await useDataStore.getState().deleteVariable(variable.id);
    return true;
  },
};

export const DataVariablesHostContext = createContext<DataVariablesHost | null>(
  null,
);

export function useDataVariablesHost(): DataVariablesHost {
  return useContext(DataVariablesHostContext) ?? STORE_DATA_VARIABLES_HOST;
}
