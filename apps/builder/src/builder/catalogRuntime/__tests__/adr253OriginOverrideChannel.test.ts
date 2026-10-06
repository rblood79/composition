import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  StateName,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 Phase 1 (G1): a project override of a library origin reaches every instance of that
 * origin — the record each consumer draws (the instance's template root), for instances placed
 * on a page and instances inside another origin's template, in the base style and in each state.
 */
const BODY = "project:node:home-body" as NodeId;
const origin = (name: string) =>
  `lib:definition:origin-component-${name}` as LibraryDefinitionId;
const BUTTON = origin("button");
const BUTTON_TYPE = "lib:definition:type-Button";
const node = (name: string) => `project:node:${name}` as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(
  placed: Readonly<
    Record<string, Partial<NodeEntry> & { of: LibraryDefinitionId }>
  >,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr253-channel" as EntryId<"project">,
        name: "ADR-253 channel",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-channel-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const entries = Object.entries(placed).map(
    ([name, { of, ...fields }]): NodeEntry => ({
      kind: "node",
      id: node(name),
      definitionId: of,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...fields,
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: entries.map((entry) => entry.id),
      newId: workspace.newId,
    }),
  );
  const write = (
    scope: "defaults" | "visual" | "stateRules",
    key: string,
    value: string | number,
    state?: StateName,
    definitionId: LibraryDefinitionId = BUTTON,
  ) =>
    workspace.execute(
      setLibraryDefault({
        definitionId,
        scope,
        key,
        write: set(value),
        newId: workspace.newId,
        ...(state ? { state } : {}),
      }),
    );
  return { workspace, write };
}

/** The record a consumer draws for an instance: the innermost template root it collapses into. */
function drawn(
  workspace: CatalogWorkspace,
  resolved: ResolvedCatalogNode,
): ResolvedCatalogNode {
  let current = resolved;
  for (;;) {
    const definition = workspace.runtime.graph.getDefinition(
      current.definitionId,
    );
    const first = current.children[0];
    if (
      definition?.mode !== "composite" ||
      !first ||
      first.sourceId !== definition.templateRootId
    )
      return current;
    current = first;
  }
}
/** Every drawn record of a type under a resolved node. */
function drawnOf(
  workspace: CatalogWorkspace,
  resolved: ResolvedCatalogNode,
  type: string,
): ResolvedCatalogNode[] {
  const root = drawn(workspace, resolved);
  if (root.definitionId === `lib:definition:type-${type}`) return [root];
  return root.children.flatMap((child) => drawnOf(workspace, child, type));
}
const buttons = (workspace: CatalogWorkspace, resolved: ResolvedCatalogNode) =>
  drawnOf(workspace, resolved, "Button");
const resolve = (
  workspace: CatalogWorkspace,
  name: string,
  state?: StateName,
) => resolveCatalogNode(workspace.runtime.graph, node(name), state);

describe("ADR-253 Phase 1 — an origin's override reaches its instances", () => {
  it("base style: a placed instance and the instances inside other origins draw the origin's override", async () => {
    const { workspace, write } = await open({
      button: { of: BUTTON },
      toolbar: { of: origin("toolbar") },
      group: { of: origin("buttongroup") },
      pagination: { of: origin("pagination") },
    });
    write("visual", "paddingTop", 77);
    write("visual", "backgroundColor", "#ff0000");
    for (const name of ["button", "toolbar", "group", "pagination"]) {
      const found = buttons(workspace, resolve(workspace, name));
      expect(found.length, name).toBeGreaterThan(0);
      for (const record of found)
        expect(
          [record.visual.paddingTop, record.visual.backgroundColor],
          `${name} ${record.sourceId}`,
        ).toEqual([77, "#ff0000"]);
    }
    // The Canvas and DOM records are the same drawn record.
    const placed = [...workspace.root.canvasInputs.values()].find(
      (record) => record.sourceId === node("button"),
    )!;
    expect(placed.visual.paddingTop).toBe(77);
    const dom = [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === node("button"),
    )!;
    expect(dom.visual.backgroundColor).toBe("#ff0000");
  });

  it("an instance's own value stays over the origin's override", async () => {
    const { workspace, write } = await open({
      plain: { of: BUTTON },
      authored: { of: BUTTON, visual: { paddingTop: set(5) } },
    });
    write("visual", "paddingTop", 77);
    expect(
      drawn(workspace, resolve(workspace, "plain")).visual.paddingTop,
    ).toBe(77);
    expect(
      drawn(workspace, resolve(workspace, "authored")).visual.paddingTop,
    ).toBe(5);
  });

  it("value order: the parent's rule, then the origin's override, then the template position's own value", async () => {
    const { workspace, write } = await open({
      checkbox: { of: origin("checkbox") },
      group: { of: origin("checkboxgroup") },
      card: { of: origin("card") },
      cards: { of: origin("cardview") },
    });
    const inGroup = () =>
      drawnOf(workspace, resolve(workspace, "group"), "Checkbox");
    const inView = () =>
      drawnOf(workspace, resolve(workspace, "cards"), "Card");
    // The group's rule gives its Checkbox a min height; the CardView template gives each Card
    // position a width of its own.
    expect(inGroup().map((record) => record.visual.minHeight)).toEqual([
      20, 20,
    ]);
    expect(inView().map((record) => record.visual.width)).toEqual([
      200, 200, 200,
    ]);
    write("visual", "minHeight", 41, undefined, origin("checkbox"));
    write("visual", "width", 300, undefined, origin("card"));
    // The Checkbox origin's override is over the value its parent's rule gives the part.
    expect(inGroup().map((record) => record.visual.minHeight)).toEqual([
      41, 41,
    ]);
    // A template position's own value (the written difference) stays over the origin's override.
    expect(inView().map((record) => record.visual.width)).toEqual([
      200, 200, 200,
    ]);
    expect(drawn(workspace, resolve(workspace, "card")).visual.width).toBe(300);
  });

  it("state style: the drawn root takes the origin's state override in that state", async () => {
    const { workspace, write } = await open({
      button: { of: BUTTON },
      toolbar: { of: origin("toolbar") },
      hovered: { of: origin("button--hover") },
      authored: {
        of: BUTTON,
        stateRules: { hover: { backgroundColor: set("#abcdef") } },
      },
    });
    write("stateRules", "backgroundColor", "#123456", "hover");
    // At rest nothing changes.
    expect(
      drawn(workspace, resolve(workspace, "button")).visual.backgroundColor,
    ).not.toBe("#123456");
    // A placed instance, hovered.
    expect(
      drawn(workspace, resolve(workspace, "button", "hover")).visual
        .backgroundColor,
    ).toBe("#123456");
    // Instances inside another origin's template, hovered.
    const nested = buttons(workspace, resolve(workspace, "toolbar", "hover"));
    expect(nested.length).toBeGreaterThan(0);
    for (const record of nested)
      expect(record.visual.backgroundColor, String(record.sourceId)).toBe(
        "#123456",
      );
    // The origin's hover state variant (its root is an instance of the origin, shown hovered).
    expect(
      drawn(workspace, resolve(workspace, "hovered")).visual.backgroundColor,
    ).toBe("#123456");
    // An instance's own state value stays over the origin's.
    expect(
      drawn(workspace, resolve(workspace, "authored", "hover")).visual
        .backgroundColor,
    ).toBe("#abcdef");
    // The other states keep theirs.
    expect(
      drawn(workspace, resolve(workspace, "button", "pressed")).visual
        .backgroundColor,
    ).not.toBe("#123456");
  });
});
