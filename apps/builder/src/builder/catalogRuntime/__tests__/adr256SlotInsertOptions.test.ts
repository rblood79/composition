import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { catalogChildKind } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import type {
  DefinitionId,
  EntryId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import {
  catalogSlotCommands,
  catalogSlotInsertOptions,
  catalogSlotPosition,
  catalogSlotTarget,
} from "../slots";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 G1 — the slot section's insert list is the position's children kind (ADR-256 Decision 4),
 * checked like the insert: re-runs the F3 probe (each slot of each built-in origin) and requires
 * that every listed choice goes in, and that a position taking items lists only its items.
 * (Before: every slot listed the same 5 primitives; Tabs · Table · TableView · CheckboxGroup ·
 * RadioGroup · TagGroup refused all 5 — `NESTING_NOT_ALLOWED`.)
 */
const PROJECT = "project:project:adr256-slots" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;

const templates = new Map(
  REUSABLE_ORIGIN_TEMPLATES.map((template) => [template.id, template]),
);

/** Slot positions inside an origin's own template (path from the root, the root excluded). */
function slotPaths(rootId: LibraryTemplateId): LibraryTemplateId[][] {
  const out: LibraryTemplateId[][] = [];
  const walk = (id: LibraryTemplateId, path: LibraryTemplateId[]) => {
    const template = templates.get(id);
    if (!template) return;
    if (template.slot && path.length > 1) out.push(path);
    for (const child of template.children) walk(child, [...path, child]);
  };
  walk(rootId, [rootId]);
  return out;
}

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Slots" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-slots-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  return { workspace, graph: workspace.runtime.graph, library };
}

const ORIGINS = [
  "tabs",
  "table",
  "tableview",
  "checkboxgroup",
  "radiogroup",
  "taggroup",
  "card",
];

describe("ADR-256 G1 — slot insert list = children kind", () => {
  it("every listed choice goes in; an items position lists only its items", async () => {
    const { workspace, graph, library } = await open();
    const report: string[] = [];
    const empty: string[] = [];
    let positions = 0;
    for (const name of ORIGINS) {
      const definitionId =
        `lib:definition:origin-component-${name}` as DefinitionId;
      const origin = library.definitions.get(
        definitionId as `lib:definition:${string}`,
      ) as { templateRootId?: LibraryTemplateId } | undefined;
      expect(origin?.templateRootId, name).toBeTruthy();
      const instance = workspace.newId("node") as NodeId;
      const entry: NodeEntry = {
        kind: "node",
        id: instance,
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [entry],
          rootIds: [instance],
          newId: workspace.newId,
        }),
      );
      for (const templatePath of slotPaths(origin!.templateRootId!)) {
        positions += 1;
        const target = {
          kind: "descendant" as const,
          ownerId: instance,
          address: { instances: [instance], templatePath },
        };
        const type = definitionTypeName(
          graph,
          templates.get(templatePath[templatePath.length - 1])!.definitionId,
        );
        const options = catalogSlotInsertOptions(graph, target);
        if (!options.length) empty.push(`${name} ${type}`);
        const kind = catalogChildKind(type);
        for (const option of options) {
          if (kind.kind === "items")
            expect(
              kind.items,
              `${name} ${type} lists ${option.label}`,
            ).toContain(definitionTypeName(graph, option.definitionId));
          try {
            workspace.execute(
              catalogSlotCommands.fill(
                target,
                option.definitionId,
                workspace.newId,
              ),
            );
            workspace.undo();
          } catch (error) {
            report.push(
              `${name} ${type} ← ${option.label}: ${(error as Error).message}`,
            );
          }
        }
      }
    }
    expect(positions).toBeGreaterThanOrEqual(10);
    expect(report).toEqual([]);
    // ADR-256 Phase 10: the Card takes the S2 structure — its Content holds its title · description
    // Text nodes (no binding to the card's props), so every slot position opens (F3 closed).
    expect(empty).toEqual([]);
  });

  // ADR-256 F4 — the slot on an origin's root (ListBox · Toolbar · Form …) fills from the instance.
  it("an instance fills its component's root slot from its own selection", async () => {
    const { workspace, graph } = await open();
    const place = (name: string) => {
      const instance = workspace.newId("node") as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              kind: "node",
              id: instance,
              definitionId:
                `lib:definition:origin-component-${name}` as DefinitionId,
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [instance],
          newId: workspace.newId,
        }),
      );
      return { kind: "node" as const, id: instance };
    };
    const toolbar = place("toolbar");
    expect(catalogSlotPosition(graph, toolbar)?.slot.name).toBe("Actions");
    const options = catalogSlotInsertOptions(graph, toolbar);
    const button = options.find((option) => option.label === "Button");
    expect(button).toBeTruthy();
    workspace.execute(
      catalogSlotCommands.fill(
        catalogSlotTarget(graph, toolbar)!,
        button!.definitionId,
        workspace.newId,
      ),
    );
    // The first fill makes the template's 4 actions the instance's own, then appends the Button.
    const fill = catalogSlotPosition(graph, toolbar)?.fillIds ?? [];
    expect(fill).toHaveLength(5);
    const added = graph.getEntry(fill[4]);
    expect(
      added?.kind === "node" && definitionTypeName(graph, added.definitionId),
    ).toBe("Button");

    const listbox = place("listbox");
    expect(
      catalogSlotInsertOptions(graph, listbox).map((option) =>
        definitionTypeName(graph, option.definitionId),
      ),
    ).toEqual(["ListBoxItem", "ListBoxSection", "Section", "Header"]);
    // A plain page node has no slot position.
    expect(catalogSlotPosition(graph, { kind: "node", id: BODY })).toBe(
      undefined,
    );
  });
});
