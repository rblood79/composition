import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import { catalogThemeState } from "../../../builder/catalogRuntime/theme";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import {
  catalogPreviewRuntime,
  CatalogPreviewView,
} from "../catalogPreviewApp";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * ADR-250: a Disclosure or Tree expanded or collapsed in the Preview is the Preview's runtime state
 * — the document (and so the Canvas) keeps its declared value. The user's click and an interaction
 * rule write the same runtime value; a Builder change of the declared value brings the Preview back
 * to it.
 */
const BODY = "project:node:home-body" as NodeId;
const HOME = "project:page:home" as EntryId<"page">;

let library: CatalogLibrary | undefined;
async function open(types: readonly string[]) {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:expansion" as EntryId<"project">,
        name: "Expansion",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr250-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogThemeState,
    },
  );
  const ids = types.map(
    (type) => `project:node:${type.toLowerCase()}` as NodeId,
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: types.map(
        (type, index) =>
          ({
            kind: "node",
            id: ids[index]!,
            definitionId: catalogPaletteDefinitionId(library!, type),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          }) as NodeEntry,
      ),
      rootIds: ids,
      newId: workspace.newId,
    }),
  );
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => act(() => flushes.splice(0).forEach((run) => run()));
  channel.setView(HOME);
  channel.onReady();
  const runtime = catalogPreviewRuntime(session, { show: () => {} });
  const view = render(
    <CatalogPreviewView session={session} runtime={runtime} />,
  );
  /** The Builder document's own record of a node (what the Canvas reads). */
  const builderProps = (id: NodeId) =>
    workspace.root.domInputs.get(workspace.root.recordsOfSource(id)[0]!)!.props;
  return { workspace, session, runtime, view, flush, ids, builderProps };
}

const rows = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="row"]')].map((row) =>
    row.getAttribute("data-key"),
  );
const expandButton = (container: HTMLElement, key: string) =>
  container.querySelector(
    `[role="row"][data-key="${key}"] button[slot="chevron"]`,
  ) as HTMLElement;

describe("ADR-250 Preview expansion is runtime state", () => {
  it("a Tree item expands and collapses in the Preview; the document keeps its declared keys", async () => {
    const { view, workspace, ids, builderProps } = await open(["Tree"]);
    const historyBefore = workspace.history.getSnapshot().labels.length;
    expect(rows(view.container)).toEqual(["item-1", "item-2"]);
    act(() => {
      fireEvent.click(expandButton(view.container, "item-1"));
    });
    expect(rows(view.container).length).toBeGreaterThan(2);
    expect(
      view.container
        .querySelector('[role="row"][data-key="item-1"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("true");
    act(() => {
      fireEvent.click(expandButton(view.container, "item-1"));
    });
    expect(rows(view.container)).toEqual(["item-1", "item-2"]);
    // Nothing reached the document: no history step, the Canvas's record unchanged.
    expect(workspace.history.getSnapshot().labels.length).toBe(historyBefore);
    expect(builderProps(ids[0]!).expandedKeys).toBeUndefined();
    view.unmount();
  });

  it("a Builder change of the declared keys brings the Preview back to them", async () => {
    const { view, workspace, ids, flush } = await open(["Tree"]);
    act(() => {
      fireEvent.click(expandButton(view.container, "item-1"));
    });
    expect(rows(view.container).length).toBeGreaterThan(2);
    const expandedRows = rows(view.container).length;
    // The Builder declares item-1 collapsed-and-item-2 … : set, then clear the declaration.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ids[0]! }],
        props: { expandedKeys: { kind: "set", value: [] } },
        label: "Edit properties",
      }),
    );
    flush();
    expect(rows(view.container)).toEqual(["item-1", "item-2"]);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ids[0]! }],
        props: { expandedKeys: { kind: "set", value: ["item-1"] } },
        label: "Edit properties",
      }),
    );
    flush();
    expect(rows(view.container).length).toBe(expandedRows);
    view.unmount();
  });

  it("an interaction rule and the user's click write the same runtime value", async () => {
    const { view, workspace, session, ids, flush } = await open([
      "Tree",
      "Button",
    ]);
    const [tree, button] = ids as [NodeId, NodeId];
    const owner = { ownerId: button };
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onPress",
            {
              opcode: "capability",
              targetId: tree,
              capabilityId: "expand",
              value: "item-1",
            },
            workspace.newId,
          ),
        ],
        "Rules",
      ),
    );
    flush();
    const press = () =>
      act(() => {
        fireEvent.click(
          view.container.querySelector(
            `[data-catalog-id$="${button}"]`,
          ) as HTMLElement,
        );
      });
    press();
    expect(rows(view.container).length).toBeGreaterThan(2);
    // The user collapses what the rule expanded …
    act(() => {
      fireEvent.click(expandButton(view.container, "item-1"));
    });
    expect(rows(view.container)).toEqual(["item-1", "item-2"]);
    // … and the rule expands it again (one value, not two that drift apart).
    press();
    expect(rows(view.container).length).toBeGreaterThan(2);
    expect(session.root!.recordsOfSource(tree)).toHaveLength(1);
    view.unmount();
  });

  it("a Disclosure collapses in the Preview only; a Builder change of isExpanded is followed", async () => {
    const { view, workspace, ids, flush, builderProps } = await open([
      "Disclosure",
    ]);
    const header = () =>
      view.container.querySelector(
        '.react-aria-Disclosure button[slot="trigger"]',
      ) as HTMLElement;
    const expanded = () =>
      view.container
        .querySelector(".react-aria-Disclosure")
        ?.hasAttribute("data-expanded");
    const declare = (isExpanded: boolean) => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: ids[0]! }],
          props: { isExpanded: { kind: "set", value: isExpanded } },
          label: "Edit properties",
        }),
      );
      flush();
    };
    const historyBefore = workspace.history.getSnapshot().labels.length;
    expect(expanded()).toBe(true);
    act(() => {
      fireEvent.click(header());
    });
    expect(expanded()).toBe(false);
    expect(workspace.history.getSnapshot().labels.length).toBe(historyBefore);
    expect(builderProps(ids[0]!).isExpanded).not.toBe(false);
    // The Builder declares it collapsed, then expanded: the Preview follows each declaration.
    declare(false);
    expect(expanded()).toBe(false);
    declare(true);
    expect(expanded()).toBe(true);
    // The user collapses it again; the declaration stays expanded.
    act(() => {
      fireEvent.click(header());
    });
    expect(expanded()).toBe(false);
    expect(builderProps(ids[0]!).isExpanded).toBe(true);
    view.unmount();
  });
  it("a Disclosure in a DisclosureGroup: the click stays in the Preview, the group follows each Builder declaration", async () => {
    const { view, workspace, flush } = await open(["DisclosureGroup"]);
    const expanded = () =>
      [...view.container.querySelectorAll(".react-aria-Disclosure")].map(
        (disclosure) => disclosure.hasAttribute("data-expanded"),
      );
    const first = workspace.root
      .recordsOfSource("project:node:disclosuregroup" as NodeId)
      .flatMap((group) => workspace.root.domInputs.get(group)!.children)[0]!;
    const target = workspace.itemOfRecord(first)!.target;
    const declare = (isExpanded: boolean) => {
      workspace.execute(
        setFields({
          targets: [target],
          props: { isExpanded: { kind: "set", value: isExpanded } },
          label: "Edit properties",
        }),
      );
      flush();
    };
    const historyBefore = workspace.history.getSnapshot().labels.length;
    expect(expanded()).toEqual([true, true]);
    act(() => {
      fireEvent.click(
        view.container.querySelector(
          '.react-aria-Disclosure button[slot="trigger"]',
        ) as HTMLElement,
      );
    });
    expect(expanded()).toEqual([false, true]);
    expect(workspace.history.getSnapshot().labels.length).toBe(historyBefore);
    // The Builder declares it collapsed, then expanded: the group follows each declaration.
    declare(false);
    expect(expanded()).toEqual([false, true]);
    declare(true);
    expect(expanded()).toEqual([true, true]);
    view.unmount();
  });
});
