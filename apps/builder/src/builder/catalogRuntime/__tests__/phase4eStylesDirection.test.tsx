import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { LayoutSection } from "../../panels/styles/sections/LayoutSection";
import { StylesHostContext } from "../../panels/styles/stylesHostContext";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e: Styles' Direction offers no Block for a container whose axis is a group prop
 * (ToggleButtonGroup · Toolbar orientation, RadioGroup · CheckboxGroup label position — block has
 * no prop value). The old section decided it from the old store's elements (empty in the catalog
 * Builder); it reads the Styles host's component type.
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(cleanup);
// jsdom has no Web Animations (the toggle group's selection indicator asks for them).
(Element.prototype as { getAnimations?: () => Animation[] }).getAnimations ??=
  () => [];

describe("ADR-248 Phase 4e Styles Direction", () => {
  it("disables Block for a direction-driven group, not for a frame", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:direction" as EntryId<"project">,
          name: "Direction",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-direction-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1440, height: 900 },
        autosaveSchedule: () => {},
      },
    );
    const add = (type: string) => {
      workspace.session.clearSelection();
      const command = catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          get records() {
            return workspace.root.domInputs;
          },
          selection: () => workspace.session.getSnapshot().selection,
          itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
          pageContent: () => ({ kind: "node", id: BODY }),
          newId: workspace.newId,
        },
        type,
      );
      if (!command) throw new Error(`no place for ${type}`);
      return workspace.execute(command).plan.selectAfter![0];
    };
    const group = add("ToggleButtonGroup");
    const frame = add("frame");
    const host = createCatalogStylesHost(workspace);
    render(
      <CatalogWorkspaceProvider workspace={workspace}>
        <StylesHostContext.Provider value={host}>
          <LayoutSection />
        </StylesHostContext.Provider>
      </CatalogWorkspaceProvider>,
    );
    const select = (source: NodeId) =>
      act(() =>
        workspace.selectRecords([workspace.root.recordsOfSource(source)[0]]),
      );
    const blockDisabled = () =>
      screen
        .getByRole("radio", { name: "Block" })
        .hasAttribute("data-disabled");

    select(group);
    expect(blockDisabled()).toBe(true);
    select(frame);
    expect(blockDisabled()).toBe(false);
  });

  /**
   * ADR-251 G3: the RadioGroup's two axes have two nodes — the group's Direction is its
   * `labelPosition`, its RadioItems wrapper's Direction is the group's `orientation` (one history
   * step on the group, undone as one).
   */
  it.each(["RadioGroup", "CheckboxGroup"])(
    "%s: the items wrapper's Direction writes the group orientation",
    async (type) => {
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:direction" as EntryId<"project">,
            name: "Direction",
          }),
          await buildCodeCatalogLibrary(),
        ),
        new CatalogStorage(indexedDB, `adr251-direction-${Math.random()}`),
        {
          engine: await nodeLayoutEngine(),
          viewport: { width: 1440, height: 900 },
          autosaveSchedule: () => {},
        },
      );
      const command = catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          get records() {
            return workspace.root.domInputs;
          },
          selection: () => workspace.session.getSnapshot().selection,
          itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
          pageContent: () => ({ kind: "node", id: BODY }),
          newId: workspace.newId,
        },
        type,
      )!;
      const group = workspace.execute(command).plan.selectAfter![0];
      const host = createCatalogStylesHost(workspace);
      render(
        <CatalogWorkspaceProvider workspace={workspace}>
          <StylesHostContext.Provider value={host}>
            <LayoutSection />
          </StylesHostContext.Provider>
        </CatalogWorkspaceProvider>,
      );
      const groupRecord = () => workspace.root.recordsOfSource(group)[0];
      const wrapperRecord = () =>
        workspace.root.domInputs
          .get(groupRecord())!
          .children.find(
            (id) =>
              workspace.root.domInputs.get(id)?.bindingId ===
              `${type.toLowerCase().replace("group", "")}items`,
          )!;
      const prop = (key: string) =>
        workspace.readModel.propSource({ kind: "node", id: group }, key).value;
      const selected = (name: string) =>
        screen.getByRole("radio", { name }).hasAttribute("data-selected");
      const blockDisabled = () =>
        screen
          .getByRole("radio", { name: "Block" })
          .hasAttribute("data-disabled");

      act(() => workspace.selectRecords([wrapperRecord()]));
      expect(blockDisabled()).toBe(true);
      expect(selected("Column")).toBe(true);
      const steps = workspace.history.getSnapshot().labels.length;
      act(() => {
        fireEvent.click(screen.getByRole("radio", { name: "Row" }));
      });
      expect(prop("orientation")).toBe("horizontal");
      expect(prop("labelPosition")).toBe("top");
      expect(workspace.history.getSnapshot().labels.length).toBe(steps + 1);
      expect(selected("Row")).toBe(true);
      // The wrapper record now lays its items out in a row (the group rule's horizontal block).
      expect(
        workspace.root.layoutInputs.get(wrapperRecord())?.layout.flexDirection,
      ).toBe("row");

      // The group's own Direction stays its label position.
      act(() => workspace.selectRecords([groupRecord()]));
      expect(selected("Column")).toBe(true);
      act(() => {
        fireEvent.click(screen.getByRole("radio", { name: "Row" }));
      });
      expect(prop("labelPosition")).toBe("side");
      expect(prop("orientation")).toBe("horizontal");

      act(() => workspace.undo());
      act(() => workspace.undo());
      expect(prop("orientation")).toBe("vertical");
      expect(prop("labelPosition")).toBe("top");
      workspace.dispose();
    },
  );
});
