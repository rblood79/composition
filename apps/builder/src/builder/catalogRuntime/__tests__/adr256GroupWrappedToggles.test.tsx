// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  detachInstances,
  groupNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Codex Round 20 H2: RAC's group context (`CheckboxGroupStateContext` · `RadioGroupStateContext` ·
 * `ToggleGroupStateContext`) reaches every toggle below the group — a RAC `Group` the author puts
 * between keeps the toggle in the group (RAC 1.21.0 sets the context only in the group itself). So
 * a wrapped item stays one of the group's values (Preview) and takes the group's states (Canvas).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(origin: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-wrapped" as EntryId<"project">,
        name: "Group wrapped",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-wrapped-${Math.random()}`),
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
          id: GROUP,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  workspace.execute(detachInstances({ ids: [GROUP], newId: workspace.newId }));
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const target = (id: string) => workspace.positionOfRecord(id)!.target;
  return { workspace, root, of, target };
}

describe("Codex Round 20 H2 — a RAC Group around a group's toggle", () => {
  it.each([
    ["checkboxgroup", "CheckboxGroup", "Checkbox", "input[type=checkbox]"],
    ["radiogroup", "RadioGroup", "Radio", "input[type=radio]"],
    ["togglebuttongroup", "ToggleButtonGroup", "ToggleButton", "button"],
  ])(
    "%s: the wrapped item stays selected in the Preview and takes the group's disabled state on the Canvas",
    async (origin, groupType, part, selector) => {
      const { workspace, root, of, target } = await open(origin);
      const first = of(part)[0]!;
      const source = first.sourceId;
      workspace.execute(
        setFields({
          targets: [target(first.id)],
          props: { isSelected: set(true) },
        }),
      );
      const wrapper = workspace.newId("node");
      workspace.execute(
        groupNodes({
          ids: [(target(of(part)[0]!.id) as { id: NodeId }).id],
          group: {
            kind: "node",
            id: wrapper,
            definitionId: "lib:definition:type-Group",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setFields({
          targets: [target(of(groupType)[0]!.id)],
          props: { isDisabled: set(true) },
        }),
      );
      const item = of(part).find((record) => record.sourceId === source)!;
      // (Its unwrapped sibling — the same group's item as before.)
      const sibling = of(part).find((record) => record.sourceId !== source)!;
      expect(root.typeOf(root.canvasInputs.get(item.parentId)!)).toBe("Group");
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(
          root,
          [...root.domInputs.values()].find((r) => r.sourceId === GROUP)!.id,
        ),
      );
      const get = (id: string) => root.canvasInputs.get(id);
      const typeOf = (record: Parameters<typeof root.typeOf>[0]) =>
        root.typeOf(record);
      const read = (record: typeof item) => {
        const own = host.querySelector(`[data-catalog-id="${record.id}"]`)!;
        const control =
          part === "ToggleButton" ? own : own.querySelector(selector)!;
        return {
          selected:
            part === "ToggleButton"
              ? (control.getAttribute("aria-pressed") ??
                control.getAttribute("aria-checked"))
              : String(control.hasAttribute("checked")),
          domDisabled: control.hasAttribute("disabled"),
          canvasDisabled: catalogStateValue(record, "isDisabled", get, typeOf),
        };
      };
      const wrapped = read(item);
      const unwrapped = read(sibling);
      // Preview: still the group's selected value. Canvas · Preview: the group's disabled state, as
      // its unwrapped sibling's.
      expect(wrapped.selected).toBe("true");
      expect(unwrapped.selected).toBe("false");
      expect(unwrapped.domDisabled).toBe(true);
      expect({
        domDisabled: wrapped.domDisabled,
        canvasDisabled: wrapped.canvasDisabled,
      }).toEqual({
        domDisabled: unwrapped.domDisabled,
        canvasDisabled: unwrapped.canvasDisabled,
      });
    },
  );

  it.each([
    ["checkboxgroup", "Checkbox", "input[type=checkbox]"],
    ["radiogroup", "Radio", "input[type=radio]"],
    ["togglebuttongroup", "ToggleButton", "button"],
  ])(
    "%s in an open view: selecting the wrapped item later reaches the Preview",
    async (origin, part, selector) => {
      const { workspace, root, of, target } = await open(origin);
      const source = of(part)[0]!.sourceId;
      workspace.execute(
        groupNodes({
          ids: [(target(of(part)[0]!.id) as { id: NodeId }).id],
          group: {
            kind: "node",
            id: workspace.newId("node"),
            definitionId: "lib:definition:type-Group",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
          newId: workspace.newId,
        }),
      );
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      const host = document.body.appendChild(document.createElement("div"));
      const reactRoot = createRoot(host);
      await act(async () => {
        reactRoot.render(
          renderCatalogDom(
            root,
            [...root.domInputs.values()].find((r) => r.sourceId === GROUP)!.id,
          ),
        );
      });
      const selected = () => {
        const item = of(part).find((record) => record.sourceId === source)!;
        const own = host.querySelector(`[data-catalog-id="${item.id}"]`)!;
        const control =
          part === "ToggleButton" ? own : own.querySelector(selector)!;
        return part === "ToggleButton"
          ? (control.getAttribute("aria-pressed") ??
              control.getAttribute("aria-checked"))
          : String((control as HTMLInputElement).checked);
      };
      const before = selected();
      await act(async () => {
        workspace.execute(
          setFields({
            targets: [
              target(of(part).find((record) => record.sourceId === source)!.id),
            ],
            props: { isSelected: set(true) },
          }),
        );
      });
      expect([before, selected()]).toEqual(["false", "true"]);
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  );
});
