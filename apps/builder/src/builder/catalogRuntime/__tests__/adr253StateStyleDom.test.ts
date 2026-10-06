import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 G1 (state values in the Preview): a state value the document wrote — an origin's
 * override, an instance's own — reaches the DOM element in that state. The record carries the
 * values of each state (`stateVisual`), and a Button draws them through RAC's render state.
 */
const BODY = "project:node:home-body" as NodeId;
const origin = (name: string) =>
  `lib:definition:origin-component-${name}` as LibraryDefinitionId;
const BUTTON = origin("button");
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
        projectId: "project:project:adr253-state" as EntryId<"project">,
        name: "ADR-253 state",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-state-${Math.random()}`),
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
  const write = (state: StateName, key: string, value: string) =>
    workspace.execute(
      setLibraryDefault({
        definitionId: BUTTON,
        scope: "stateRules",
        state,
        key,
        write: set(value),
        newId: workspace.newId,
      }),
    );
  const buttons = (records: ReadonlyMap<string, CatalogConsumerNode>) =>
    [...records.values()].filter((record) => record.bindingId === "button");
  const placedButton = (
    records: ReadonlyMap<string, CatalogConsumerNode>,
    name: string,
  ) => buttons(records).find((record) => record.sourceId === node(name))!;
  const mount = async (name: string) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => {
      reactRoot.render(
        renderCatalogDom(
          workspace.root,
          placedButton(workspace.root.domInputs, name).id,
          { today: () => undefined },
        ),
      );
    });
    const element = host.querySelector("button")!;
    const pointer = (type: string) => {
      const Pointer = (globalThis as { PointerEvent?: typeof MouseEvent })
        .PointerEvent;
      const init = { bubbles: true, pointerType: "mouse", button: 0 };
      if (Pointer)
        element.dispatchEvent(new Pointer(`pointer${type}`, init as never));
      element.dispatchEvent(new MouseEvent(`mouse${type}`, init));
    };
    return {
      element,
      hover: () => act(async () => pointer("over")),
      leave: () => act(async () => pointer("out")),
      unmount: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  return { workspace, write, buttons, placedButton, mount };
}

describe("ADR-253 G1 — a state value the document wrote reaches the Preview", () => {
  it("the record carries each state's values: the origin's override, under an instance's own", async () => {
    const { workspace, write, buttons, placedButton } = await open({
      button: { of: BUTTON },
      toolbar: { of: origin("toolbar") },
      authored: {
        of: BUTTON,
        stateRules: { hover: { backgroundColor: set("#abcdef") } },
      },
    });
    expect(
      placedButton(workspace.root.domInputs, "button").stateVisual,
    ).toBeUndefined();
    write("hover", "backgroundColor", "#123456");
    write("pressed", "backgroundColor", "#654321");
    for (const records of [
      workspace.root.domInputs,
      workspace.root.canvasInputs,
    ]) {
      const record = placedButton(records, "button");
      expect(record.stateVisual).toEqual({
        hover: { backgroundColor: "#123456" },
        pressed: { backgroundColor: "#654321" },
      });
      // The rest value stays the record's own.
      expect(record.visual.backgroundColor).not.toBe("#123456");
      // Instances inside another origin's template.
      const nested = buttons(records).filter((item) =>
        String(item.sourceId).includes("component-toolbar"),
      );
      expect(nested.length).toBeGreaterThan(0);
      for (const item of nested)
        expect(item.stateVisual?.hover, String(item.sourceId)).toEqual({
          backgroundColor: "#123456",
        });
      // An instance's own state value stays over the origin's.
      expect(placedButton(records, "authored").stateVisual?.hover).toEqual({
        backgroundColor: "#abcdef",
      });
    }
  });

  it("the Preview's Button takes the hover value while hovered, and releases it after", async () => {
    const { write, mount } = await open({ button: { of: BUTTON } });
    write("hover", "backgroundColor", "#123456");
    write("hover", "color", "#00ff00");
    const mounted = await mount("button");
    const { element } = mounted;
    expect(element.style.backgroundColor).toBe("");
    await mounted.hover();
    expect(element.hasAttribute("data-hovered")).toBe(true);
    expect(element.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(element.style.color).toBe("rgb(0, 255, 0)");
    await mounted.leave();
    expect(element.hasAttribute("data-hovered")).toBe(false);
    expect(element.style.backgroundColor).toBe("");
    expect(element.style.color).toBe("");
    await mounted.unmount();
  });

  it("a mounted Button follows a later edit of the state value alone", async () => {
    const { write, mount } = await open({ button: { of: BUTTON } });
    write("hover", "backgroundColor", "#123456");
    const mounted = await mount("button");
    await act(async () => {
      write("hover", "backgroundColor", "#00ff00");
    });
    await mounted.hover();
    expect(mounted.element.style.backgroundColor).toBe("rgb(0, 255, 0)");
    await mounted.unmount();
  });

  it("a disabled Button takes the origin's disabled value", async () => {
    const { workspace, write, mount } = await open({
      button: { of: BUTTON },
      enabled: { of: BUTTON },
    });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: node("button") }],
        props: { isDisabled: set(true) },
      }),
    );
    write("disabled", "backgroundColor", "#445566");
    const disabled = await mount("button");
    expect(disabled.element.style.backgroundColor).toBe("rgb(68, 85, 102)");
    await disabled.unmount();
    const enabled = await mount("enabled");
    expect(enabled.element.style.backgroundColor).toBe("");
    await enabled.unmount();
  });

  it("a Button without state values keeps a plain style object", async () => {
    const { mount } = await open({ button: { of: BUTTON } });
    const mounted = await mount("button");
    await mounted.hover();
    expect(mounted.element.hasAttribute("data-hovered")).toBe(true);
    expect(mounted.element.style.backgroundColor).toBe("");
    await mounted.unmount();
  });
});
