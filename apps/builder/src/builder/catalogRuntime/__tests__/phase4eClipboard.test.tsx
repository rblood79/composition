import "fake-indexeddb/auto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EditTarget,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { CatalogPropertyClipboardActions } from "../../panels/properties/catalog/CatalogPropertyClipboardActions";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { CatalogStyleClipboardShortcuts } from "../../panels/styles/catalog/CatalogStyleClipboardShortcuts";
import { StylesHostContext } from "../../panels/styles/stylesHostContext";
import { catalogEditContract } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import {
  catalogCopiedProperties,
  catalogPastePropertiesCommand,
} from "../propertyClipboard";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-5 property / style clipboard: Properties copy = the target's own semantic
 * values; paste = one step with the keys the target's contract offers (another type's props are
 * left out, unchanged = no step). Styles copy = the target's CSS view, paste = one style step that
 * reproduces it. ⌘⌥C / ⌘⌥V run them with the Properties / Styles panel active (JSON on the
 * system clipboard, as the old panels).
 */
const PROJECT = "project:project:clip" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const on = (name: string): EditTarget => ({ kind: "node", id: id(name) });
const node = (
  name: string,
  definitionId: string,
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

let clipboardText = "";
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: async (text: string) => {
      clipboardText = text;
    },
    readText: async () => clipboardText,
  },
});
afterEach(() => {
  clipboardText = "";
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Clip" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-clip-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("save", "lib:definition:origin-component-iconbutton", {
          label: { kind: "set", value: "Save" },
          isDisabled: { kind: "set", value: true },
        }),
        node("other", "lib:definition:origin-component-iconbutton"),
        node("a", "lib:definition:text", {
          children: { kind: "set", value: "Hello" },
        }),
        node("b", "lib:definition:text"),
      ],
      rootIds: [id("save"), id("other"), id("a"), id("b")],
      newId: (kind) => `project:${kind}:c${++n}` as never,
    }),
  );
  const contract = (target: EditTarget) =>
    catalogEditContract(workspace.runtime.graph, workspace.readModel, target);
  const value = (target: EditTarget, key: string) =>
    workspace.readModel.propSource(target, key).value;
  const select = (name: string) =>
    workspace.selectRecords([workspace.root.recordsOfSource(id(name))[0]]);
  const paste = (targets: EditTarget[], data: Record<string, unknown>) =>
    catalogPastePropertiesCommand(
      workspace.runtime.graph,
      workspace.readModel,
      targets,
      data,
    );
  return { workspace, contract, value, select, paste };
}
// A real key event carries the physical `code` — ⌥ shortcuts match it (macOS ⌥ changes `key`).
const cmdAlt = (key: string) => ({
  key,
  code: `Key${key.toUpperCase()}`,
  altKey: true,
  ...(navigator.platform.includes("Mac")
    ? { metaKey: true }
    : { ctrlKey: true }),
});

describe("ADR-248 Phase 4e-5 property / style clipboard", () => {
  it("properties: copy = own semantic values; paste = one step with the accepted keys; unchanged or foreign = no step", async () => {
    const { workspace, contract, value, paste } = await open();
    const copied = catalogCopiedProperties(contract(on("save")));
    expect(copied).toEqual({ label: "Save", isDisabled: true });
    const revision = workspace.runtime.graph.revision;
    workspace.execute(paste([on("other")], copied)!);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(value(on("other"), "label")).toBe("Save");
    expect(value(on("other"), "isDisabled")).toBe(true);
    expect(paste([on("other")], copied)).toBeUndefined();
    // A Text takes none of an icon button's props; a Text's copy reaches another Text.
    expect(paste([on("b")], copied)).toBeUndefined();
    const text = catalogCopiedProperties(contract(on("a")));
    expect(text).toEqual({ children: "Hello" });
    workspace.execute(paste([on("b")], { ...text, label: "x" })!);
    expect(value(on("b"), "children")).toBe("Hello");
    // Nothing own: nothing to copy.
    expect(catalogCopiedProperties(contract(on("b")))).toEqual({
      children: "Hello",
    });
    workspace.undo();
    expect(catalogCopiedProperties(contract(on("b")))).toEqual({});
  });

  it("styles: the CSS view of one target pasted on another is one step that reproduces it", async () => {
    const { workspace, select } = await open();
    const host = createCatalogStylesHost(workspace);
    select("a");
    host.updateStyles({
      backgroundColor: "#ff0000",
      paddingTop: "12px",
      width: "120px",
      opacity: "0.5",
    });
    const copied = host.readSelectedTarget().style;
    expect(copied).toMatchObject({
      backgroundColor: "#ff0000",
      width: "120px",
    });
    select("b");
    const revision = workspace.runtime.graph.revision;
    host.updateStyles(copied as Record<string, string>);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(host.readSelectedTarget().style).toEqual(copied);
  });

  it("⌘⌥C / ⌘⌥V: Properties buttons and keys, then Styles keys — both in the Design panel (id properties, ADR-252)", async () => {
    const { workspace, contract, value, select } = await open();
    function Harness({ target }: { target: EditTarget }) {
      return (
        <div data-panel-id="properties">
          <input readOnly data-testid="props-focus" />
          <CatalogPropertyClipboardActions
            contract={contract(target)}
            targets={[target]}
          />
        </div>
      );
    }
    const view = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <Harness target={on("save")} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy properties" }));
    });
    expect(JSON.parse(clipboardText)).toEqual({
      label: "Save",
      isDisabled: true,
    });
    view.rerender(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <Harness target={on("other")} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const panel = view.container.querySelector<HTMLElement>(
      '[data-panel-id="properties"]',
    )!;
    panel.tabIndex = -1;
    act(() => panel.focus());
    fireEvent.focusIn(panel);
    await act(async () => {
      fireEvent.keyDown(panel, cmdAlt("v"));
    });
    expect(value(on("other"), "label")).toBe("Save");
    view.unmount();

    // Styles: copy a's view, paste it on b (the Design panel's style tabs mount these keys).
    const host = createCatalogStylesHost(workspace);
    select("a");
    host.updateStyles({ color: "#00ff00", paddingTop: "8px" });
    const styles = render(
      <StylesHostContext.Provider value={host}>
        <div data-panel-id="properties" tabIndex={-1} data-testid="styles" />
        <CatalogStyleClipboardShortcuts />
      </StylesHostContext.Provider>,
    );
    const stylesPanel = styles.getByTestId("styles");
    act(() => stylesPanel.focus());
    fireEvent.focusIn(stylesPanel);
    await act(async () => {
      fireEvent.keyDown(stylesPanel, cmdAlt("c"));
    });
    expect(JSON.parse(clipboardText)).toMatchObject({
      color: "#00ff00",
    });
    select("b");
    await act(async () => {
      fireEvent.keyDown(stylesPanel, cmdAlt("v"));
    });
    expect(host.readSelectedTarget().style).toMatchObject({
      color: "#00ff00",
      paddingTop: "8px",
    });
    styles.unmount();
  });
});
