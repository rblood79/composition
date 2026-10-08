// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
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
  setHtmlId,
} from "../../../../../../packages/shared/src/catalog/commands";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 후속 3: a Select's `selectionMode` (the Properties' Single · Multiple) reaches RAC's
 * Select — with `multiple` its ListBox keeps several options selected and the trigger's
 * SelectValue lists them (RAC's own list format), as the reference's multi-select Select.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function mounted(selectionMode?: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-select-mode" as EntryId<"project">,
        name: "Select mode",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-select-mode-${Math.random()}`),
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
          id: FIELD,
          definitionId: "lib:definition:origin-component-select",
          children: [],
          props: {
            label: set("Animal"),
            ...(selectionMode ? { selectionMode: set(selectionMode) } : {}),
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = [...root.domInputs.values()].find(
    (record) => record.sourceId === FIELD,
  )!;
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
    reactRoot.render(renderCatalogDom(root, field.id));
  });
  const trigger = host.querySelector<HTMLElement>("button")!;
  const options = () => [
    ...document.body.querySelectorAll<HTMLElement>(
      '.react-aria-Popover [role="option"]',
    ),
  ];
  return {
    trigger,
    options,
    press: () => act(async () => trigger.click()),
    choose: (index: number) => act(async () => options()[index]!.click()),
    value: () =>
      host.querySelector(".react-aria-SelectValue")?.textContent ?? "",
    unmount: async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("ADR-256 후속 3 — a Select's selectionMode reaches RAC", () => {
  it("multiple: two options stay selected and the trigger lists both", async () => {
    const view = await mounted("multiple");
    await view.press();
    await view.choose(0);
    // RAC keeps a multi-select's popover open after a choice.
    await view.choose(1);
    const selected = view
      .options()
      .map((option) => option.hasAttribute("data-selected"));
    expect(selected.slice(0, 2)).toEqual([true, true]);
    const labels = view
      .options()
      .slice(0, 2)
      .map((option) => option.textContent ?? "");
    for (const label of labels) expect(view.value()).toContain(label);
    await view.unmount();
  });

  it("single (default): a second choice replaces the first", async () => {
    const view = await mounted();
    await view.press();
    await view.choose(0);
    await view.press();
    await view.choose(1);
    await view.press();
    expect(
      view.options().map((option) => option.hasAttribute("data-selected")),
    ).toEqual([false, true, false, false]);
    await view.unmount();
  });
});

/**
 * ADR-256 후속 5: RAC gives a Select's `id` to its trigger. After a detach the trigger Button is
 * the author's node with an id of its own (`button_1`) — two ids for one element, which RAC's id
 * merging swapped forever in an open Preview (React "Maximum update depth exceeded"). The Select's
 * id is the trigger's; the Button's own applies only while the Select has none.
 */
describe("ADR-256 후속 5 — a detached Select in an open view", () => {
  it("detach, then the Select's id cleared and set again: no update loop; the trigger follows the Select's id", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId:
            "project:project:adr256-select-detach" as EntryId<"project">,
          name: "Select detach",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr256-select-detach-${Math.random()}`),
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
            id: FIELD,
            definitionId: "lib:definition:origin-component-select",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
            metadata: { htmlId: "animal" },
          } as NodeEntry,
        ],
        rootIds: [FIELD],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const body = [...root.domInputs.values()].find(
      (record) => record.sourceId === BODY,
    )!;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => {
      reactRoot.render(renderCatalogDom(root, body.id));
    });
    // (The loop never settles: outside `act` so the test sees its warnings instead of hanging.)
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
    const loops: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((message) => {
      if (String(message).includes("Maximum update depth")) loops.push("loop");
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 600));
    const trigger = () =>
      host.querySelector<HTMLElement>(".react-aria-Select button")!;
    const buttonId = () =>
      [...root.domInputs.values()].find(
        (record) =>
          root.typeOf(record) === "Button" &&
          root.domInputs.get(record.parentId)?.sourceId === FIELD,
      )!;
    workspace.execute(
      detachInstances({ ids: [FIELD], newId: workspace.newId }),
    );
    reactRoot.render(renderCatalogDom(root, body.id));
    await settle();
    expect(buttonId().htmlId).toBeTruthy();
    expect(trigger().id).toBe("animal");
    workspace.execute(setHtmlId({ id: FIELD, htmlId: "" }));
    await settle();
    // (Without the Select's id the trigger is the Button's own.)
    expect(trigger().id).toBe(buttonId().htmlId);
    workspace.execute(setHtmlId({ id: FIELD, htmlId: "pet" }));
    await settle();
    expect(trigger().id).toBe("pet");
    spy.mockRestore();
    expect(loops).toEqual([]);
    reactRoot.unmount();
    host.remove();
  });
});
