import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import {
  LIBRARY_CONTRACT_VERSION,
  type EntryId,
  type NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogAbsentByValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { catalogTextKey } from "../canvasText";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { catalogHasOwnText } from "../textBinding";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-276 — the palette Button origin is the IconButton template (`Button > Icon{icon} +
 * Text{label}`) with two omission rules: an unfilled `{icon}` draws no glyph, an empty `label`
 * has no Text node (`presentWhen: "nonEmptyText"`). Label and icon are the instance's `label` ·
 * `icon` props; the nested Button positions of other origins keep their text as `label`.
 */
const PROJECT = "project:project:adr276" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const LABEL = "lib:template:component-button__label";
const ICON = "lib:template:component-button__icon";

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-276" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr276-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const host = {
    graph: workspace.runtime.graph,
    get records() {
      return workspace.root.domInputs;
    },
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
    pageContent: () => ({ kind: "node" as const, id: BODY }),
    newId: workspace.newId,
  };
  const add = (type: string, props?: Record<string, unknown>) => {
    const command = catalogPaletteInsertCommand(host, type, props);
    if (!command) throw new Error(`no place for ${type}`);
    return workspace.execute(command).plan.selectAfter![0] as NodeId;
  };
  /** The drawn records of a template source inside an instance, in document order. */
  const parts = (instance: NodeId, sourceId: string): CatalogConsumerNode[] =>
    [...workspace.root.domInputs.values()].filter(
      (record) =>
        record.sourceId === sourceId && record.instancePath.includes(instance),
    );
  const write = (id: NodeId, props: Record<string, string | undefined>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            value === undefined
              ? { kind: "remove" as const }
              : { kind: "set" as const, value },
          ]),
        ),
        label: "edit",
      }),
    );
  return { workspace, add, parts, write };
}

describe("ADR-276 Button origin template", () => {
  it("raises the library contract (an older document is refused, not converted)", () => {
    expect(LIBRARY_CONTRACT_VERSION).toBe(43);
  });

  it("is the IconButton template: Icon{icon} + Text{label}, no own children string", () => {
    const root = REUSABLE_ORIGIN_TEMPLATES.find(
      (template) => template.id === "lib:template:component-button",
    )!;
    expect(root.children).toEqual([ICON, LABEL]);
    expect(root.props.children).toBeUndefined();
    const icon = REUSABLE_ORIGIN_TEMPLATES.find((t) => t.id === ICON)!;
    const label = REUSABLE_ORIGIN_TEMPLATES.find((t) => t.id === LABEL)!;
    expect(icon.props).toMatchObject({ slot: "icon", iconName: "{icon}" });
    expect(label.props).toMatchObject({ slot: "label", children: "{label}" });
    expect(label.presentWhen).toBe("nonEmptyText");
    const definition = REUSABLE_ORIGIN_DEFINITIONS.find(
      (d) => d.id === "lib:definition:origin-component-button",
    )!;
    expect(definition.accepts).toMatchObject({
      label: "string",
      icon: "string",
    });
    expect(definition.defaults.label).toBe("Button");
    expect(definition.defaults.icon).toBeUndefined();
    const toggle = REUSABLE_ORIGIN_TEMPLATES.find(
      (template) => template.id === "lib:template:component-togglebutton",
    )!;
    expect(toggle.children).toEqual([
      "lib:template:component-togglebutton__icon",
      "lib:template:component-togglebutton__label",
    ]);
    expect(toggle.props.children).toBeUndefined();
  });

  it("keeps every nested Button position's text as its label (none loses its words)", () => {
    // The value each position showed before ADR-276 (its own `children` then) — the oracle is
    // the library before the change, copied here (breakdown §2b).
    const expected: Record<string, string> = {
      "lib:template:component-toolbar__button-1": "Action 1",
      "lib:template:component-toolbar__button-2": "Action 2",
      "lib:template:component-toolbar__button-3": "Action 3",
      "lib:template:component-pagination__1": "←",
      "lib:template:component-pagination__2": "1",
      "lib:template:component-pagination__3": "2",
      "lib:template:component-pagination__4": "3",
      "lib:template:component-pagination__5": "→",
      "lib:template:component-buttongroup__1": "Cancel",
      "lib:template:component-buttongroup__2": "Save",
      "lib:template:component-menu__trigger": "Menu",
      "lib:template:component-numberfield__2_2": "",
      "lib:template:component-numberfield__2_3": "",
      "lib:template:component-searchfield__2_3": "",
      "lib:template:component-select__2": "",
      "lib:template:component-calendarmonthpicker__trigger": "",
      "lib:template:component-calendaryearpicker__trigger": "",
      "lib:template:component-dialog__1": "Open Dialog",
      "lib:template:component-dialog__2_3_1": "Close",
      "lib:template:component-popover__trigger": "Open Popover",
      "lib:template:component-contextualhelp__trigger": "",
      "lib:template:component-tooltip__trigger": "Hover me",
      "lib:template:component-fieldbutton": "",
      "lib:template:component-togglebuttongroup__1": "Toggle 1",
      "lib:template:component-togglebuttongroup__2": "Toggle 2",
    };
    const nested = REUSABLE_ORIGIN_TEMPLATES.filter(
      (template) =>
        template.definitionId === "lib:definition:origin-component-button" ||
        template.definitionId ===
          "lib:definition:origin-component-togglebutton",
    );
    // 27 Button + 7 ToggleButton positions; the 9 state variants carry no text of their own.
    expect(nested).toHaveLength(34);
    const labels = Object.fromEntries(
      nested
        .filter((template) => !template.displayState)
        .map((template) => [template.id, template.props.label]),
    );
    expect(labels).toEqual(expected);
    for (const template of nested)
      expect(template.props.children).toBeUndefined();
  });

  it("draws a new Button as its Text child, hides the unfilled icon, and edits both as props", async () => {
    const { add, parts, write, workspace } = await open();
    const button = add("Button");
    const [label] = parts(button, LABEL);
    expect(label?.props.children).toBe("Button");
    expect(catalogAbsentByValue(label!)).toBe(false);
    const [icon] = parts(button, ICON);
    expect(icon?.hidden).toBe(true);
    // The root record has no text of its own — the double-click edits the Text child.
    const root = [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === button,
    )!;
    expect(root.props.children).toBeUndefined();
    expect(
      catalogHasOwnText(
        workspace.runtime.graph.library,
        workspace.root.domInputs,
        root.id,
        catalogTextKey,
      ),
    ).toBe(false);
    // Label: one prop, one step; the icon: a glyph, then none again (no child commands).
    write(button, { label: "Saved" });
    expect(parts(button, LABEL)[0]?.props.children).toBe("Saved");
    write(button, { icon: "star" });
    expect(parts(button, ICON)[0]).toMatchObject({
      props: { iconName: "star" },
    });
    expect(parts(button, ICON)[0]?.hidden).toBeUndefined();
    expect(parts(button, LABEL)).toHaveLength(1);
    expect(parts(button, LABEL)[0]?.props.children).toBe("Saved");
    write(button, { icon: undefined });
    expect(parts(button, ICON)[0]?.hidden).toBe(true);
    expect(parts(button, LABEL)[0]?.props.children).toBe("Saved");
    // icon-only (user decision 2): an empty label has no Text node.
    write(button, { label: "" });
    expect(catalogAbsentByValue(parts(button, LABEL)[0]!)).toBe(true);
    expect(workspace.runtime.graph.getEntry(button)).toMatchObject({
      children: [],
    });
  });

  it("sizes the Text child by the Button's size (the part rule, not a fixed template value)", async () => {
    const { add, parts, write } = await open();
    const button = add("Button");
    const medium = parts(button, LABEL)[0]!.visual.fontSize;
    write(button, { size: "XL" });
    const large = parts(button, LABEL)[0]!.visual.fontSize;
    expect(typeof medium).toBe("number");
    expect(large as number).toBeGreaterThan(medium as number);
  });

  it("keeps a glyph-only host's trigger without a Text and a worded host's words", async () => {
    const { add, parts } = await open();
    const numberField = add("NumberField");
    for (const record of parts(numberField, LABEL))
      expect(catalogAbsentByValue(record)).toBe(true);
    const select = add("Select");
    for (const record of parts(select, LABEL))
      expect(catalogAbsentByValue(record)).toBe(true);
    const pagination = add("Pagination");
    expect(
      parts(pagination, LABEL).map((record) => record.props.children),
    ).toEqual(["←", "1", "2", "3", "→"]);
    const tooltip = add("Tooltip");
    expect(parts(tooltip, LABEL).map((r) => r.props.children)).toEqual([
      "Hover me",
    ]);
  });
});
