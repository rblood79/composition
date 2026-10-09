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
 * `ToggleGroupStateContext`) and the group's size reach every toggle below the group: a RAC `Group`
 * (or frame) around an item keeps the group's size on it (the size reaches through layout
 * containers, as the context does). A toggle is never inside another of its type (사용자 2026-10-09 —
 * like a button in a button), while a group takes its items.
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
          props: { size: set("L") },
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
      expect(sizes()).toEqual(["L", "L"]);
      workspace.execute(
        setFields({
          targets: [target(of(groupType)[0]!.id)],
          props: { size: set("S") },
        }),
      );
      expect(sizes()).toEqual(["S", "S"]);
    },
  );

  it("a frame around a Checkbox passes the group's size too", async () => {
    const { workspace, of, target } = await open("checkboxgroup");
    workspace.execute(
      setFields({
        targets: [target(of("CheckboxGroup")[0]!.id)],
        props: { size: set("L") },
      }),
    );
    const source = of("Checkbox")[0]!.sourceId;
    wrap(
      workspace,
      (target(of("Checkbox")[0]!.id) as { id: NodeId }).id,
      "lib:definition:type-frame",
    );
    expect(of("Checkbox").find((r) => r.sourceId === source)!.props.size).toBe(
      "L",
    );
  });
});

describe("Codex Round 21 — no toggle inside another of its type; a group takes its items", () => {
  const entry = (
    workspace: Awaited<ReturnType<typeof open>>["workspace"],
    definition: string,
  ) => {
    const id = workspace.newId("node");
    return {
      id,
      node: {
        kind: "node",
        id,
        definitionId: `lib:definition:${definition}`,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      } as NodeEntry,
    };
  };
  const insert = (
    workspace: Awaited<ReturnType<typeof open>>["workspace"],
    parent: ReturnType<Awaited<ReturnType<typeof open>>["target"]>,
    definition: string,
  ) => {
    const { id, node } = entry(workspace, definition);
    try {
      workspace.execute(
        insertNodes({
          parent,
          entries: [node],
          rootIds: [id],
          newId: workspace.newId,
        }),
      );
      return "ok";
    } catch (error) {
      return (error as { code?: string }).code ?? String(error);
    }
  };

  it.each([
    ["checkboxgroup", "Checkbox", "origin-component-checkbox", "Checkbox"],
    ["radiogroup", "Radio", "origin-component-radio", "Radio"],
    ["checkbox", "Checkbox", "origin-component-checkbox", "Checkbox"],
    ["switch", "Switch", "origin-component-switch", "Switch"],
    ["taggroup", "Tag", "type-Tag", "Tag"],
  ])(
    "%s: a %s inside another %s is refused (also through a frame)",
    async (origin, part, definition) => {
      const { workspace, of, target } = await open(origin);
      expect(insert(workspace, target(of(part)[0]!.id), definition)).toBe(
        "NESTING_NOT_ALLOWED",
      );
      // (Through a frame inside the item too — the item is an ancestor.)
      const frame = entry(workspace, "type-frame");
      workspace.execute(
        insertNodes({
          parent: target(of(part)[0]!.id),
          entries: [frame.node],
          rootIds: [frame.id],
          newId: workspace.newId,
        }),
      );
      expect(insert(workspace, target(of("frame")[0]!.id), definition)).toBe(
        "NESTING_NOT_ALLOWED",
      );
    },
  );

  it.each([
    ["checkboxgroup", "CheckboxGroup", "origin-component-checkbox"],
    ["checkboxgroup", "CheckboxItems", "origin-component-checkbox"],
    ["radiogroup", "RadioGroup", "origin-component-radio"],
    ["radiogroup", "RadioItems", "origin-component-radio"],
    ["togglebuttongroup", "ToggleButtonGroup", "origin-component-togglebutton"],
    ["taggroup", "TagList", "type-Tag"],
    ["buttongroup", "ButtonGroup", "origin-component-button"],
    ["avatargroup", "AvatarGroup", "origin-component-avatar"],
  ])(
    "%s: the %s takes another item",
    async (origin, parentType, definition) => {
      const { workspace, of, target } = await open(origin);
      expect(insert(workspace, target(of(parentType)[0]!.id), definition)).toBe(
        "ok",
      );
    },
  );
});

describe("Codex Round 21 — an item put straight in its group takes the group's size", () => {
  it.each([
    ["checkboxgroup", "CheckboxGroup", "Checkbox", "checkbox"],
    ["radiogroup", "RadioGroup", "Radio", "radio"],
  ])(
    "%s: an item added straight in the %s (not its items box) follows the group's size and its change",
    async (origin, groupType, part, childOrigin) => {
      const { workspace, root, of, target } = await open(origin);
      const groupSize = (size: string) =>
        workspace.execute(
          setFields({
            targets: [target(of(groupType)[0]!.id)],
            props: { size: set(size) },
          }),
        );
      groupSize("L");
      const childId = workspace.newId("node");
      workspace.execute(
        insertNodes({
          parent: target(of(groupType)[0]!.id),
          entries: [
            {
              kind: "node",
              id: childId,
              definitionId: `lib:definition:origin-component-${childOrigin}`,
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [childId],
          newId: workspace.newId,
        }),
      );
      const sizes = () => {
        const canvas = of(part).find((r) => r.sourceId === childId)!;
        return [
          root.typeOf(root.canvasInputs.get(canvas.parentId)!),
          canvas.props.size,
          root.domInputs.get(canvas.id)!.props.size,
        ];
      };
      expect(sizes()).toEqual([groupType, "L", "L"]);
      groupSize("S");
      expect(sizes()).toEqual([groupType, "S", "S"]);
    },
  );
});

describe("Codex Round 21 — the group's size change reaches an item in another container", () => {
  it("a Checkbox in a Form inside the CheckboxGroup follows the group's size change", async () => {
    const { workspace, root, of, target } = await open("checkboxgroup");
    const node = (id: NodeId, definitionId: string) =>
      ({
        kind: "node",
        id,
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const formId = workspace.newId("node");
    workspace.execute(
      insertNodes({
        parent: target(of("CheckboxGroup")[0]!.id),
        entries: [node(formId, "lib:definition:type-Form")],
        rootIds: [formId],
        newId: workspace.newId,
      }),
    );
    const childId = workspace.newId("node");
    workspace.execute(
      insertNodes({
        parent: target(of("Form")[0]!.id),
        entries: [node(childId, "lib:definition:origin-component-checkbox")],
        rootIds: [childId],
        newId: workspace.newId,
      }),
    );
    const size = () => {
      const canvas = of("Checkbox").find((r) => r.sourceId === childId)!;
      return [canvas.props.size, root.domInputs.get(canvas.id)!.props.size];
    };
    for (const value of ["L", "S"]) {
      workspace.execute(
        setFields({
          targets: [target(of("CheckboxGroup")[0]!.id)],
          props: { size: set(value) },
        }),
      );
      expect(size()).toEqual([value, value]);
    }
  });
});
