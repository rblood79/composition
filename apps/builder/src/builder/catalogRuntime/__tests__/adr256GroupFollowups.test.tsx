// @vitest-environment jsdom
import "fake-indexeddb/auto";
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
 * Codex Round 21 (range-outside findings, 2026-10-09): RAC's group context (`CheckboxGroupStateContext` · `RadioGroupStateContext` ·
 * `ToggleGroupStateContext`) and the group's size reach every toggle below the group: a toggle placed
 * inside another item is one of the group's values, and a RAC `Group` (or frame) around an item
 * keeps the group's size on it (the size reaches through layout containers, as the context does).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(origin: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-followups" as EntryId<"project">,
        name: "Group followups",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-followups-${Math.random()}`),
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

const wrap = (
  workspace: Awaited<ReturnType<typeof open>>["workspace"],
  id: NodeId,
  definitionId = "lib:definition:type-Group",
) =>
  workspace.execute(
    groupNodes({
      ids: [id],
      group: {
        kind: "node",
        id: workspace.newId("node"),
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      } as NodeEntry,
      newId: workspace.newId,
    }),
  );

describe("Codex Round 21 — the group's size through a Group around its item", () => {
  it.each([
    ["checkboxgroup", "CheckboxGroup", "Checkbox"],
    ["radiogroup", "RadioGroup", "Radio"],
    ["togglebuttongroup", "ToggleButtonGroup", "ToggleButton"],
  ])(
    "%s: the wrapped item takes the group's size (and its change)",
    async (origin, groupType, part) => {
      const { workspace, root, of, target } = await open(origin);
      workspace.execute(
        setFields({
          targets: [target(of(groupType)[0]!.id)],
          props: { size: set("lg") },
        }),
      );
      const source = of(part)[0]!.sourceId;
      wrap(workspace, (target(of(part)[0]!.id) as { id: NodeId }).id);
      const sizes = () => {
        const canvas = of(part).find((r) => r.sourceId === source)!;
        const dom = [...root.domInputs.values()].find(
          (r) => r.id === canvas.id,
        )!;
        return [canvas.props.size, dom.props.size];
      };
      expect(
        root.typeOf(
          root.canvasInputs.get(
            of(part).find((r) => r.sourceId === source)!.parentId,
          )!,
        ),
      ).toBe("Group");
      expect(sizes()).toEqual(["lg", "lg"]);
      workspace.execute(
        setFields({
          targets: [target(of(groupType)[0]!.id)],
          props: { size: set("sm") },
        }),
      );
      expect(sizes()).toEqual(["sm", "sm"]);
    },
  );

  it("a frame around a Checkbox passes the group's size too", async () => {
    const { workspace, of, target } = await open("checkboxgroup");
    workspace.execute(
      setFields({
        targets: [target(of("CheckboxGroup")[0]!.id)],
        props: { size: set("lg") },
      }),
    );
    const source = of("Checkbox")[0]!.sourceId;
    wrap(
      workspace,
      (target(of("Checkbox")[0]!.id) as { id: NodeId }).id,
      "lib:definition:type-frame",
    );
    expect(of("Checkbox").find((r) => r.sourceId === source)!.props.size).toBe(
      "lg",
    );
  });
});

describe("Codex Round 21 — a toggle inside another item is one of the group's", () => {
  it.each([
    [
      "checkboxgroup",
      "CheckboxGroup",
      "Checkbox",
      "checkbox",
      "input[type=checkbox]",
    ],
    ["radiogroup", "RadioGroup", "Radio", "radio", "input[type=radio]"],
  ])(
    "%s: a selected item inside the first item is selected (Preview · Canvas)",
    async (origin, groupType, part, childOrigin, selector) => {
      const { workspace, root, of, target } = await open(origin);
      const childId = workspace.newId("node");
      workspace.execute(
        insertNodes({
          parent: target(of(part)[0]!.id),
          entries: [
            {
              kind: "node",
              id: childId,
              definitionId: `lib:definition:origin-component-${childOrigin}`,
              children: [],
              props: { isSelected: set(true), value: set("nested") },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [childId],
          newId: workspace.newId,
        }),
      );
      const child = of(part).find((r) => r.sourceId === childId)!;
      const group = of(groupType)[0]!;
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, group.id));
      const input = host
        .querySelector(`[data-catalog-id="${child.id}"]`)!
        .querySelector(selector)!;
      expect(input.hasAttribute("checked")).toBe(true);
      expect(
        catalogStateValue(
          child,
          "isSelected",
          (id) => root.canvasInputs.get(id),
          (record) => root.typeOf(record),
        ),
      ).toBe(true);
    },
  );
});
