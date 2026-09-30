import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { DataChange, DataOp, VisibleVariable } from "@composition/shared";
import type {
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogLegacyVariableMove,
  catalogVariableIndex,
  catalogVariableUsageCounter,
} from "../../../catalogRuntime/dataVariables";
import { dataChangeEffect } from "../../../catalogRuntime/dataHistory";
import { catalogVariableNameConflict } from "../../../catalogRuntime/stateVariables";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import {
  focusVariableOwner,
  type DataVariablesHost,
  type VariableIndexGroup,
} from "./dataVariablesHost";

interface DataStoreAccess {
  apply(
    change: DataChange,
    options: { record: false },
  ): Promise<{ applied: DataOp[]; inverse: DataOp[] }>;
}

/**
 * ADR-248 Phase 4e-4e: the Variables tab over the catalog document — the index and usage read the
 * `stateVariable` and interaction records; jumping selects the owner (a page's body) on its page;
 * moving a legacy page variable is one history entry (document part = the page variable and the
 * rules that set it, outside effect = removing the data-store definition).
 */
export function createCatalogDataVariablesHost(
  workspace: CatalogWorkspace,
  store: DataStoreAccess,
  label: string,
): DataVariablesHost {
  const graph = () => workspace.runtime.graph;
  const isPage = (id: string) => graph().getEntry(id)?.kind === "page";
  return {
    useView(legacyPageVariables, projectDefs) {
      const subscribe = useCallback(
        (notify: () => void) =>
          workspace.runtime.subscribeSteps(() => notify()),
        [],
      );
      const revision = useSyncExternalStore(subscribe, () => graph().revision);
      const pageTitle = useCallback(
        (pageId: string) => {
          void revision;
          const page = graph().getEntry(pageId);
          return page?.kind === "page" ? page.name : pageId;
        },
        [revision],
      );
      const usageCount = useMemo(() => {
        void revision;
        return catalogVariableUsageCounter(graph(), projectDefs);
      }, [projectDefs, revision]);
      const groups = useMemo<VariableIndexGroup[]>(() => {
        void revision;
        const byPage = new Map<string, VariableIndexGroup>();
        const groupFor = (pageId: string) => {
          let group = byPage.get(pageId);
          if (!group) {
            group = { pageId, title: pageTitle(pageId), entries: [] };
            byPage.set(pageId, group);
          }
          return group;
        };
        for (const item of catalogVariableIndex(graph())) {
          const { variable } = item;
          const entry: VisibleVariable = {
            def: {
              id: variable.id,
              name: variable.name,
              type: variable.valueType as VisibleVariable["def"]["type"],
              defaultValue: variable.defaultValue,
            },
            owner:
              item.ownerLabel === null
                ? { kind: "page", pageId: item.pageId }
                : { kind: "element", elementId: variable.ownerId },
          };
          groupFor(item.pageId).entries.push({
            kind: "doc",
            entry,
            ownerLabel: item.ownerLabel,
          });
        }
        for (const variable of legacyPageVariables) {
          if (variable.owner?.kind !== "page") continue;
          const pageId = variable.owner.pageId;
          // A page id no catalog page has cannot take the variable.
          const conflict =
            !isPage(pageId) ||
            !!catalogVariableNameConflict(
              graph(),
              pageId as EntryId<"page">,
              variable.name,
            );
          groupFor(pageId).entries.push({ kind: "legacy", variable, conflict });
        }
        return [...byPage.values()].sort((a, b) =>
          a.title.localeCompare(b.title),
        );
      }, [legacyPageVariables, pageTitle, revision]);
      return { usageCount, groups, pageTitle };
    },
    jumpToOwner(entry) {
      const owner = entry.owner;
      if (owner.kind === "project") return;
      const page =
        owner.kind === "page" ? graph().getEntry(owner.pageId) : undefined;
      const nodeId: string | undefined =
        owner.kind === "page"
          ? page?.kind === "page"
            ? page.children[0]
            : undefined
          : owner.elementId;
      if (!nodeId) return;
      let pageId: string | undefined;
      for (let at: string | undefined = nodeId; at; at = graph().ownerOf(at))
        if (isPage(at)) pageId = at;
      if (!pageId) return;
      workspace.session.setPage(pageId as EntryId<"page">);
      workspace.revealPage(pageId as EntryId<"page">);
      const [record] = workspace.root.recordsOfSource(nodeId as NodeId);
      if (record) workspace.selectRecords([record]);
      focusVariableOwner(
        owner.kind === "page" ? owner.pageId : owner.elementId,
        entry.def.id,
      );
    },
    async migrateLegacyToPage(variable) {
      if (variable.owner?.kind !== "page") return false;
      const move = catalogLegacyVariableMove(
        graph(),
        {
          id: variable.id,
          name: variable.name,
          type: variable.type,
          defaultValue: variable.defaultValue,
          pageId: variable.owner.pageId,
        },
        workspace.newId,
      );
      if ("refused" in move) return false;
      const removed = await store.apply(
        {
          ops: [
            {
              op: "define_variable",
              variableId: variable.id,
              definition: null,
            },
          ],
          origin: "user",
        },
        { record: false },
      );
      try {
        workspace.recordExternal(
          label,
          dataChangeEffect(
            {
              change: { ops: removed.applied, origin: "user", label },
              inverse: removed.inverse,
            },
            store.apply,
          ),
          move.command,
        );
      } catch (error) {
        await store.apply(
          { ops: removed.inverse, origin: "user" },
          { record: false },
        );
        throw error;
      }
      return true;
    },
  };
}
