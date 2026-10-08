// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  detachInstances,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 후속 7: a base origin whose root shows a display state (the palette Checkbox · Switch ·
 * Radio · ToggleButton · Tree item show `selected`).
 * - Detach keeps what the instance showed: the display state becomes the props it stands for
 *   (`isSelected: true`) on the owned root, instead of refusing (`POSITION_HAS_DISPLAY_STATE`).
 * - Inside its RAC group (CheckboxGroup · RadioGroup · ToggleButtonGroup) an item's selection is
 *   the group's, as a collection item's is its collection's: the item template's selected display
 *   is not forced there — the Canvas and the Preview show the group's value (none by default).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(origin: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-display" as EntryId<"project">,
        name: "Display state",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-display-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

describe("ADR-256 후속 7 — a display-state origin", () => {
  // (A Radio is placed only inside a RadioGroup — its nested instance stays an instance there.)
  it.each(["checkbox", "switch", "togglebutton", "tree-item-default"])(
    "%s: detach succeeds and the owned root keeps the selection it showed",
    async (origin) => {
      const workspace = await place(origin);
      const root = workspace.root;
      const record = () =>
        [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
      const shown = record().props.isSelected;
      workspace.execute(
        detachInstances({ ids: [PLACED], newId: workspace.newId }),
      );
      const entry = workspace.runtime.graph.getEntry(PLACED) as NodeEntry;
      expect(entry.definitionId.startsWith("lib:definition:type-")).toBe(true);
      expect(record().props.isSelected).toBe(shown);
      // (A TreeItem has no `isSelected` of its own — its Tree's keys select it.)
      if (origin !== "tree-item-default") {
        expect(shown).toBe(true);
        expect(entry.props.isSelected).toEqual({ kind: "set", value: true });
      }
    },
  );

  it.each([
    ["checkboxgroup", "Checkbox", 'input[type="checkbox"]'],
    ["radiogroup", "Radio", 'input[type="radio"]'],
    ["togglebuttongroup", "ToggleButton", "button"],
  ] as const)(
    "%s: its items show the group's value (none) on the Canvas and in the Preview",
    async (origin, itemType, control) => {
      const workspace = await place(origin);
      const root = workspace.root;
      const items = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === itemType,
      );
      expect(items.length).toBeGreaterThan(1);
      expect(items.map((r) => r.props.isSelected === true)).toEqual(
        items.map(() => false),
      );
      expect(items.map((r) => r.displayState ?? null)).toEqual(
        items.map(() => null),
      );
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      const host = document.body.appendChild(document.createElement("div"));
      const reactRoot = createRoot(host);
      const group = [...root.domInputs.values()].find(
        (r) => r.sourceId === PLACED,
      )!;
      await act(async () => {
        reactRoot.render(renderCatalogDom(root, group.id));
      });
      const controls = [...host.querySelectorAll(control)];
      expect(controls.length).toBe(items.length);
      expect(host.querySelectorAll("[data-selected]")).toHaveLength(0);
      // No Radio chosen: every Radio is in the Tab order (RAC reads a `""` value as chosen).
      if (origin === "radiogroup")
        expect(
          controls.map((input) => (input as HTMLInputElement).tabIndex),
        ).toEqual(controls.map(() => 0));
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  );
});
