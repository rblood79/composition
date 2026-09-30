import "fake-indexeddb/auto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { I18nProvider } from "../../../i18n";
import { CatalogItemRolesSection } from "../../panels/properties/catalog/CatalogItemRolesSection";
import { catalogItemRoleCommand, catalogItemRoles } from "../itemRoles";
import { CatalogWorkspaceProvider } from "../react";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e item roles: a collection item's role children (their `slot` prop) switch
 * on and off through `enabled` — a template position's descendant patch, one step each; a role the
 * library switches off by default is listed off and switching it on writes `enabled: true`.
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:roles" as EntryId<"project">,
        name: "Roles",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-roles-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const id = "project:node:collection" as NodeId;
  const node: NodeEntry = {
    kind: "node",
    id,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  return { workspace, graph: workspace.runtime.graph, id };
}

/** The first ListBoxItem position under the page (breadth first). */
function firstItem(graph: CatalogGraph): CatalogPosition {
  let level = pagePositions(graph, HOME);
  while (level.length) {
    const found = level.find(
      (position) =>
        definitionTypeName(graph, position.definitionId) === "ListBoxItem",
    );
    if (found) return found;
    level = level.flatMap((position) => childPositions(graph, position));
  }
  throw new Error("no item");
}
const shown = (graph: CatalogGraph, item: CatalogPosition) =>
  childPositions(graph, item).map(
    (child) => child.target.kind === "descendant" && child.sourceId,
  );

describe("ADR-248 Phase 4e-4e item roles", () => {
  it("a ListBox item lists icon · label (required) · description; switching the icon off is one patch step, undo restores", async () => {
    const { workspace, graph, id } = await open("ListBox");
    const item = firstItem(graph);
    const roles = catalogItemRoles(graph, item)!;
    expect(roles.itemType).toBe("ListBoxItem");
    expect(
      roles.rows.map((row) => [row.role, row.required, row.enabled]),
    ).toEqual([
      ["icon", false, true],
      ["label", true, true],
      ["description", false, true],
    ]);
    const before = shown(graph, item);
    const depth = workspace.runtime.historyDepth.undo;
    workspace.execute(catalogItemRoleCommand(roles.rows[0]!, false));
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(catalogItemRoles(graph, item)!.rows[0]).toMatchObject({
      role: "icon",
      enabled: false,
    });
    expect(shown(graph, item)).toEqual(
      before.filter((source) => !String(source).endsWith("__icon")),
    );
    // Switching it on again clears the write (the template shows it).
    workspace.execute(
      catalogItemRoleCommand(catalogItemRoles(graph, item)!.rows[0]!, true),
    );
    const owner = graph.getEntry(id);
    expect(
      owner?.kind === "node" &&
        owner.descendantOverrides.some(
          (override) =>
            override.kind === "patch" && override.enabled !== undefined,
        ),
    ).toBe(false);
    workspace.undo();
    workspace.undo();
    expect(shown(graph, item)).toEqual(before);
  });

  it("a Select item's icon is off by default (library patch): listed off, switching it on writes enabled true", async () => {
    const { workspace, graph, id } = await open("Select");
    const item = firstItem(graph);
    const icon = catalogItemRoles(graph, item)!.rows.find(
      (row) => row.role === "icon",
    )!;
    expect(icon).toMatchObject({ enabled: false, inheritedEnabled: false });
    workspace.execute(catalogItemRoleCommand(icon, true));
    const owner = graph.getEntry(id);
    expect(
      owner?.kind === "node" &&
        owner.descendantOverrides.find(
          (override) => override.kind === "patch" && override.enabled === true,
        ),
    ).toBeTruthy();
    expect(
      catalogItemRoles(graph, item)!.rows.find((row) => row.role === "icon"),
    ).toMatchObject({ enabled: true });
  });

  it("a non-item position has no role section; the default child listing still hides switched-off positions", async () => {
    const { workspace, graph } = await open("ListBox");
    const [listBox] = pagePositions(graph, HOME)[0]
      ? childPositions(graph, pagePositions(graph, HOME)[0]!)
      : [];
    expect(catalogItemRoles(graph, listBox!)).toBeNull();
    const item = firstItem(graph);
    const roles = catalogItemRoles(graph, item)!;
    workspace.execute(catalogItemRoleCommand(roles.rows[2]!, false));
    expect(childPositions(graph, item).some((child) => child.disabled)).toBe(
      false,
    );
    expect(
      childPositions(graph, item, { includeDisabled: true }).filter(
        (child) => child.disabled,
      ),
    ).toHaveLength(1);
  });

  it("the Properties section shows the item's roles; the icon switch hides it (one step)", async () => {
    const { workspace, graph } = await open("ListBox");
    const item = firstItem(graph);
    expect(workspace.positionOfRecord(item.identity)?.identity).toBe(
      item.identity,
    );
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogItemRolesSection identity={item.identity} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const icon = screen.getByRole("switch", { name: /icon/i });
    expect((icon as HTMLInputElement).checked).toBe(true);
    const depth = workspace.runtime.historyDepth.undo;
    act(() => {
      fireEvent.click(icon);
    });
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(
      (screen.getByRole("switch", { name: /icon/i }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      document.querySelector('[data-item-role="label"]'),
    ).not.toBeNull();
  });
});
