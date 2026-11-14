// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  detachInstances,
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
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/** S2 1.8.2: 그룹에 지정한 staticColor가 자식의 값보다 우선한다. */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tbg-static" as EntryId<"project">,
        name: "ToggleButtonGroup staticColor",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `tbg-static-${Math.random()}`),
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
          definitionId: "lib:definition:origin-component-togglebuttongroup",
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
  const edit = (id: string, props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [target(id)],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  const paint = () => {
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    const out = of("ToggleButton").map((button) => {
      const node = getSkiaNode(button.id);
      return {
        fill: node?.box?.fillColor,
        text: node?.text?.color,
      };
    });
    binding.dispose();
    return out;
  };
  return { root, of, edit, paint };
}

describe("ToggleButtonGroup staticColor — Canvas", () => {
  it.each(["white", "black"])(
    "the group's %s reaches its ToggleButtons (derived value, paint changes)",
    async (color) => {
      const { of, edit, paint } = await open();
      const before = paint();
      edit(of("ToggleButtonGroup")[0]!.id, { staticColor: color });
      expect(
        of("ToggleButton").map((button) => button.derivedProps?.staticColor),
      ).toEqual([color, color]);
      const fromGroup = paint();
      expect(fromGroup).not.toEqual(before);
      // (none — the theme paint again; `auto` is S2 `autoStaticColor`, 2026-11-14)
      edit(of("ToggleButtonGroup")[0]!.id, { staticColor: "" });
      expect(paint()).toEqual(before);
    },
  );

  it("the group's explicit staticColor wins over a child's value", async () => {
    const { of, edit } = await open();
    const [first] = of("ToggleButton");
    edit(first!.id, { staticColor: "black" });
    edit(of("ToggleButtonGroup")[0]!.id, { staticColor: "white" });
    expect(
      of("ToggleButton").map((button) => button.derivedProps?.staticColor),
    ).toEqual(["white", "white"]);
  });

  // (2026-11-14: the group's `auto` is S2 `autoStaticColor` — the page base, black in the light theme.)
  it("back to auto: the group's auto resolves for every child over its own value", async () => {
    const { of, edit } = await open();
    const group = of("ToggleButtonGroup")[0]!.id;
    const [first] = of("ToggleButton");
    edit(first!.id, { staticColor: "white" });
    edit(group, { staticColor: "white" });
    edit(group, { staticColor: "auto" });
    expect(
      of("ToggleButton").map((button) => button.derivedProps?.staticColor),
    ).toEqual(["black", "black"]);
  });
});
