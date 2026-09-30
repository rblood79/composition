import { moveNodes } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NodeId } from "../../../../../packages/shared/src/catalog/document/types";
import type { ShortcutId } from "../config/keyboardShortcuts";
import { catalogCanvasMenuItems, type CatalogMenuHost } from "./canvasMenu";
import { catalogComponentCommands } from "./componentActions";
import type { CatalogWorkspace } from "./workspace";

const PAGE_GRID = "catalog:root";
const isNodeSource = (id: string) => id.startsWith("project:node:");

/** The Canvas menu host over the open workspace (a refused command reports, never throws). */
export function catalogMenuHost(
  workspace: CatalogWorkspace,
  onError: (error: unknown) => void = () => {},
): CatalogMenuHost {
  return {
    graph: workspace.runtime.graph,
    records: workspace.root.domInputs,
    selection: () => workspace.session.getSnapshot().selection,
    execute: (command: CatalogCommand) => {
      try {
        workspace.execute(command);
      } catch (error) {
        onError(error);
      }
    },
    newId: workspace.newId,
    clipboard: {
      get: () => workspace.clipboard,
      set: (value) => {
        workspace.clipboard = value;
      },
    },
  };
}

/** The shortcuts the catalog Builder runs over the document (the global keyboard + header menu). */
export type CatalogShortcutId = Extract<
  ShortcutId,
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "delete"
  | "deleteAlt"
  | "group"
  | "ungroup"
  | "bringToFront"
  | "bringForward"
  | "sendBackward"
  | "sendToBack"
  | "arrowUp"
  | "arrowDown"
  | "arrowLeft"
  | "arrowRight"
  | "nextElement"
  | "prevElement"
  | "selectAll"
  | "detachInstance"
>;

/** The page body record of the open page (where a paste without a selection goes). */
function pageBodyRecord(workspace: CatalogWorkspace): string | undefined {
  const { pageId } = workspace.session.getSnapshot();
  const page = pageId && workspace.runtime.graph.getEntry(pageId);
  const body = page && page.kind === "page" ? page.children[0] : undefined;
  return body ? workspace.root.recordsOfSource(body)[0] : undefined;
}

/** The record whose children the current selection level is (the context, else the page body). */
function levelRecord(workspace: CatalogWorkspace): string | undefined {
  const { editingContext } = workspace.session.getSnapshot();
  return editingContext
    ? workspace.root.recordsOfSource(editingContext)[0]
    : pageBodyRecord(workspace);
}

/** The one selected element record (not a page body), if exactly one. */
function singleElement(workspace: CatalogWorkspace) {
  const selection = workspace.session.getSnapshot().selection;
  if (selection.length !== 1) return undefined;
  const record = workspace.root.domInputs.get(selection[0].identity);
  return record && record.parentId !== PAGE_GRID ? record : undefined;
}

/**
 * ADR-248 Phase 4e-5: what a document shortcut does in the open project — undo/redo, the selection
 * commands the Canvas context menu plans (copy · cut · paste · duplicate · delete · group ·
 * ungroup · z-order; a refused command is not run), sibling reorder by arrow (one element),
 * sibling selection by Tab, select all of the current level, detach an instance. Returns whether
 * it ran (false = nothing to do).
 */
export function runCatalogShortcut(
  workspace: CatalogWorkspace,
  id: CatalogShortcutId,
  onError: (error: unknown) => void = () => {},
): boolean {
  const host = catalogMenuHost(workspace, onError);
  const menuItem = (itemId: string) => {
    const items = catalogCanvasMenuItems(host, "canvas-element", undefined);
    const found = items.find(
      (item) => item.kind === "action" && item.id === itemId,
    );
    return found?.kind === "action" ? found : undefined;
  };
  const runMenu = (itemId: string) => {
    const item = menuItem(itemId);
    if (!item) return false;
    item.run();
    return true;
  };

  switch (id) {
    case "undo":
      return !!workspace.undo();
    case "redo":
      return !!workspace.redo();
    case "copy":
      return runMenu("copy");
    case "cut": {
      const copy = menuItem("copy");
      const remove = menuItem("delete");
      if (!copy || !remove) return false;
      copy.run();
      remove.run();
      return true;
    }
    case "paste": {
      if (runMenu("paste")) return true;
      if (!workspace.clipboard) return false;
      const body = pageBodyRecord(workspace);
      const item = catalogCanvasMenuItems(host, "canvas-empty", body).find(
        (entry) => entry.kind === "action" && entry.id === "paste",
      );
      if (item?.kind !== "action") return false;
      item.run();
      return true;
    }
    case "duplicate":
      return runMenu("duplicate");
    case "delete":
    case "deleteAlt":
      return runMenu("delete");
    case "group":
      return runMenu("group");
    case "ungroup":
      return runMenu("ungroup");
    case "bringToFront":
      return runMenu("bring-to-front");
    case "bringForward":
      return runMenu("bring-forward");
    case "sendBackward":
      return runMenu("send-backward");
    case "sendToBack":
      return runMenu("send-to-back");
    case "arrowUp":
    case "arrowLeft":
    case "arrowDown":
    case "arrowRight": {
      // One step among the siblings (the flow order is the children order, ADR-118).
      const record = singleElement(workspace);
      const parent = record && workspace.root.domInputs.get(record.parentId);
      if (
        !record ||
        !parent ||
        !isNodeSource(parent.sourceId) ||
        !isNodeSource(record.sourceId)
      )
        return false;
      const index = parent.children.indexOf(record.id);
      const to = index + (id === "arrowUp" || id === "arrowLeft" ? -1 : 1);
      if (to < 0 || to > parent.children.length - 1) return false;
      host.execute(
        moveNodes({
          ids: [record.sourceId as NodeId],
          parent: { kind: "node", id: parent.sourceId as NodeId },
          index: to,
          newId: workspace.newId,
          label: "Reorder",
        }),
      );
      return true;
    }
    case "nextElement":
    case "prevElement": {
      const record = singleElement(workspace);
      const parent = record && workspace.root.domInputs.get(record.parentId);
      if (!record || !parent || parent.children.length < 2) return false;
      const index = parent.children.indexOf(record.id);
      const step = id === "nextElement" ? 1 : -1;
      const next =
        parent.children[
          (index + step + parent.children.length) % parent.children.length
        ];
      workspace.selectRecords([next]);
      return true;
    }
    case "selectAll": {
      const level = levelRecord(workspace);
      const children = level
        ? (workspace.root.domInputs.get(level)?.children ?? [])
        : [];
      if (!children.length) return false;
      workspace.selectRecords(children);
      return true;
    }
    case "detachInstance": {
      const record = singleElement(workspace);
      const selected = workspace.session.getSnapshot().selection[0];
      if (!record || selected?.target.kind !== "node") return false;
      const command = catalogComponentCommands.detach(
        selected.target.id,
        workspace.newId,
      );
      try {
        command(workspace.runtime.graph);
      } catch {
        return false;
      }
      host.execute(command);
      return true;
    }
  }
}
