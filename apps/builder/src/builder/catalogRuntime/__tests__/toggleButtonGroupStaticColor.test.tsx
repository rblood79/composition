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

/**
 * 2026-10-09 (사용자 「canvas 에 반영되게 수정해」): S2 ActionButtonGroup 의 `staticColor` 는 그룹
 * 자신의 칠이 아니라 자식 ToggleButton 에게 가는 값이다 — DOM 은 `ToggleButtonGroupStaticColorContext`
 * 로 자식의 `data-static-color` 를 정하고 (자식이 `auto` 가 아닌 값을 쓰면 자식 값), Canvas 도 같은
 * 값을 자식의 파생 값 (`derivedProps.staticColor`) 으로 받아 칠한다.
 */
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
      // The same paint as the buttons' own `staticColor` (the DOM's `data-static-color` either way).
      edit(of("ToggleButtonGroup")[0]!.id, { staticColor: "auto" });
      for (const button of of("ToggleButton"))
        edit(button.id, { staticColor: color });
      expect(paint()).toEqual(fromGroup);
    },
  );

  it("a ToggleButton's own non-auto staticColor wins over the group's (the DOM's `effectiveStaticColor`)", async () => {
    const { of, edit } = await open();
    const [first] = of("ToggleButton");
    edit(first!.id, { staticColor: "black" });
    edit(of("ToggleButtonGroup")[0]!.id, { staticColor: "white" });
    expect(
      of("ToggleButton").map((button) => button.derivedProps?.staticColor),
    ).toEqual([undefined, "white"]);
  });

  it("back to auto: no derived value", async () => {
    const { of, edit } = await open();
    const group = of("ToggleButtonGroup")[0]!.id;
    edit(group, { staticColor: "white" });
    edit(group, { staticColor: "auto" });
    expect(
      of("ToggleButton").map((button) => button.derivedProps?.staticColor),
    ).toEqual([undefined, undefined]);
  });
});
