// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { nodePosition } from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { canNest } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import { CATALOG_CONTEXTUAL_HELP_FIELDS } from "../../../../../../packages/shared/src/domain/componentTraits";
import { catalogLabelSuffix } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import {
  catalogContextualHelp,
  catalogContextualHelpCommand,
  type CatalogContextualHelpKind,
} from "../contextualHelpCommand";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-259 Phase 3 (G3) — S2 `contextualHelp`. One Design command wraps a field's Label in a label
 * row (FieldLabel) with a ContextualHelp origin instance after it, and takes both out again. The
 * DOM is the G0 oracle's (`adr259-s2-oracle.json`): the help button named by its variant's string,
 * labelled by the field's label + itself, detached from the field's Button context; its Popover a
 * dialog named by its title Heading. The Canvas draws the button (S2 quiet XS · S) and not the
 * closed Popover; the label row stands in the Label's place in the field's layout.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(
  readFileSync(
    join(here, "../../../../tests/fixtures/adr259-s2-oracle.json"),
    "utf8",
  ),
) as {
  contextualHelp: Record<
    string,
    {
      inField: {
        buttonAriaLabel: string;
        buttonLabelledBy: string[];
        buttonName: string;
        buttonSlot: string | null;
        buttonExpandedClosed: string;
      };
      opened: {
        buttonExpandedOpen: string;
        dialogRole: string;
        dialogLabelledBy: string[];
        dialogName: string;
        headingLevel: string;
      };
      standalone: {
        buttonAriaLabel: string;
        buttonLabelledBy: string[] | null;
        buttonName: string;
      };
    }
  >;
};
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const FIELDS = [...CATALOG_CONTEXTUAL_HELP_FIELDS];

// jsdom has no observers (RAC collections' load-more sentinel reads one).
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const observerGlobals = globalThis as Record<string, unknown>;
observerGlobals.IntersectionObserver ??= NoopObserver;
observerGlobals.ResizeObserver ??= NoopObserver;

async function open(
  type: string,
  label: string,
  extra: Record<string, unknown> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: `project:project:adr259h-${label}` as EntryId<"project">,
        name: "ADR-259",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr259h-${label}-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, type);
  const accepts = (
    library.definitions.get(definitionId) as {
      accepts?: Record<string, unknown>;
    }
  )?.accepts;
  const props = Object.fromEntries(
    Object.entries({
      ...(accepts && "label" in accepts ? { label: "Price" } : {}),
      ...extra,
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, { kind: "set", value }]),
  ) as NodeEntry["props"];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId,
          children: [],
          props,
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const field = () => nodePosition(graph, ROOT);
  const state = () => catalogContextualHelp(graph, field())!;
  const setHelp = (kind: CatalogContextualHelpKind) =>
    workspace.execute(
      catalogContextualHelpCommand({
        field: field(),
        kind,
        newId: workspace.newId,
      }),
    );
  const root = workspace.root;
  const recordsOf = (recordType: string) =>
    [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === recordType,
    );
  const render = async (recordId?: string) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id =
      recordId ?? recordsOf(type).find((r) => r.parentId !== undefined)!.id;
    await act(async () => reactRoot.render(renderCatalogDom(root, id)));
    return {
      host,
      done: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  return { workspace, graph, state, setHelp, root, recordsOf, render, library };
}

function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.getAttribute("aria-hidden") === "true") return "";
  const label = node.getAttribute("aria-label");
  if (label) return label;
  return [...node.childNodes].map(textOf).join("");
}
function nameOf(el: Element): string {
  const ids = el.getAttribute("aria-labelledby");
  if (!ids) return el.getAttribute("aria-label") ?? "";
  return ids
    .split(/\s+/)
    .map((id) => {
      const ref = el.ownerDocument.getElementById(id);
      return ref === el
        ? (el.getAttribute("aria-label") ?? "")
        : ref
          ? textOf(ref).replace(/ /g, " ").trim()
          : "";
    })
    .filter(Boolean)
    .join(" ");
}
function labelledByShape(el: Element, roles: Record<string, Element | null>) {
  const ids = el.getAttribute("aria-labelledby")?.split(/\s+/);
  if (!ids) return null;
  return ids.map((id) => {
    const ref = el.ownerDocument.getElementById(id);
    if (ref === el) return "self";
    for (const [role, node] of Object.entries(roles))
      if (node && ref === node) return role;
    return ref ? `other:${ref.tagName.toLowerCase()}` : "missing";
  });
}

describe("ADR-259 Phase 3 — contextual help", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  for (const type of FIELDS)
    it(`${type}: one step in · the label row in the Label's place · the button is the oracle's · one undo out`, async () => {
      const { workspace, state, setHelp, root, recordsOf, render } = await open(
        type,
        type,
      );
      expect(state().kind).toBe("none");
      const recordsBefore = root.canvasInputs.size;
      const fieldRecord = recordsOf(type).find((r) => r.parentId)!;
      const labelIndex = fieldRecord.children.findIndex(
        (id) => root.typeOf(root.canvasInputs.get(id)!) === "Label",
      );

      setHelp("help");
      expect(state().kind).toBe("help");
      const row = recordsOf("FieldLabel")[0]!;
      expect(row, "label row").toBeDefined();
      const field = root.canvasInputs.get(row.parentId!)!;
      expect(field.children.indexOf(row.id)).toBe(labelIndex);
      expect(
        row.children.map((id) => root.typeOf(root.canvasInputs.get(id)!)),
      ).toEqual(["Label", "ContextualHelp"]);

      const oracle = ORACLE.contextualHelp.help.inField;
      const { host, done } = await render();
      const button = host.querySelector<HTMLElement>("[data-contextual-help]")!;
      expect(button, "help button").not.toBeNull();
      const label = host.querySelector(".react-aria-Label");
      const rowEl = host.querySelector(".react-aria-FieldLabel");
      expect(rowEl?.contains(label!), "the Label in the row").toBe(true);
      expect(rowEl?.contains(button), "the button in the row").toBe(true);
      expect({
        ariaLabel: button.getAttribute("aria-label"),
        labelledBy: labelledByShape(button, { label }),
        name: nameOf(button).replace("Price", "Name"),
        slot: button.getAttribute("slot"),
        expanded: button.getAttribute("aria-expanded"),
      }).toEqual({
        ariaLabel: oracle.buttonAriaLabel,
        labelledBy: oracle.buttonLabelledBy,
        name: oracle.buttonName,
        slot: oracle.buttonSlot,
        expanded: oracle.buttonExpandedClosed,
      });
      await done();

      workspace.undo();
      expect(state().kind).toBe("none");
      expect(root.canvasInputs.size).toBe(recordsBefore);
    });
  for (const type of FIELDS)
    it(`${type}: removing the help unwraps the label row (the Label back in its place)`, async () => {
      const { state, setHelp, root, recordsOf } = await open(
        type,
        `${type}-out`,
      );
      const fieldRecord = () => recordsOf(type).find((r) => r.parentId)!;
      const types = () =>
        fieldRecord().children.map((id) =>
          root.typeOf(root.canvasInputs.get(id)!),
        );
      const before = types();
      const recordsBefore = root.canvasInputs.size;
      setHelp("info");
      setHelp("none");
      expect(state().kind).toBe("none");
      expect(types()).toEqual(before);
      expect(recordsOf("FieldLabel")).toHaveLength(0);
      expect(recordsOf("ContextualHelp")).toHaveLength(0);
      expect(root.canvasInputs.size).toBe(recordsBefore);
    });

  it("a label row whose help was deleted (Layers): Help puts one back in it, None unwraps it", async () => {
    const { workspace, state, setHelp, root, recordsOf } = await open(
      "TextField",
      "row-left",
    );
    const types = () =>
      recordsOf("TextField")
        .find((r) => r.parentId)!
        .children.map((id) => root.typeOf(root.canvasInputs.get(id)!));
    const before = types();
    setHelp("help");
    const help = state().help!;
    workspace.execute(removeTargets({ targets: [help.target] }));
    expect(state().kind).toBe("none");
    expect(recordsOf("FieldLabel")).toHaveLength(1);

    setHelp("info");
    expect(state().kind).toBe("info");
    expect(recordsOf("FieldLabel"), "no nested label row").toHaveLength(1);
    expect(
      recordsOf("FieldLabel")[0]!.children.map((id) =>
        root.typeOf(root.canvasInputs.get(id)!),
      ),
    ).toEqual(["Label", "ContextualHelp"]);
    workspace.undo();
    expect(state().kind).toBe("none");
    expect(
      recordsOf("FieldLabel")[0]!.children.map((id) =>
        root.typeOf(root.canvasInputs.get(id)!),
      ),
    ).toEqual(["Label"]);
    workspace.redo();
    expect(state().kind).toBe("info");

    workspace.execute(removeTargets({ targets: [state().help!.target] }));
    setHelp("none");
    expect(recordsOf("FieldLabel")).toHaveLength(0);
    expect(types()).toEqual(before);
  });

  it("variant: help ↔ info is one step — the glyph and the button name follow", async () => {
    const { workspace, state, setHelp, recordsOf, render } = await open(
      "TextField",
      "variant",
    );
    setHelp("help");
    const glyph = () => recordsOf("Icon")[0]!.props.iconName;
    expect(glyph()).toBe("circle-question-mark");
    setHelp("info");
    expect(state().kind).toBe("info");
    expect(glyph()).toBe("info");
    const { host, done } = await render();
    const button = host.querySelector<HTMLElement>("[data-contextual-help]")!;
    const oracle = ORACLE.contextualHelp.info.inField;
    expect(button.getAttribute("aria-label")).toBe(oracle.buttonAriaLabel);
    expect(nameOf(button).replace("Price", "Name")).toBe(oracle.buttonName);
    expect(button.querySelector("svg"), "the glyph").not.toBeNull();
    await done();
    workspace.undo();
    expect(state().kind).toBe("help");
    expect(glyph()).toBe("circle-question-mark");
  });

  it("opened: the Popover is a dialog named by its title Heading (S2 `ContextualHelpPopover`)", async () => {
    const { setHelp, render } = await open("TextField", "opened");
    setHelp("help");
    const { host, done } = await render();
    const button = host.querySelector<HTMLElement>("[data-contextual-help]")!;
    await act(async () => {
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
      button.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }),
      );
      button.click();
    });
    const oracle = ORACLE.contextualHelp["help:title-slot"].opened;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
    expect(dialog, "the opened Popover").not.toBeNull();
    const heading = dialog.querySelector(".react-aria-Heading");
    if (process.env.ADR259_DUMP) console.log(dialog.outerHTML.slice(0, 1500));
    expect({
      expanded: button.getAttribute("aria-expanded"),
      role: dialog.getAttribute("role"),
      labelledBy: labelledByShape(dialog, { heading }),
      name: nameOf(dialog),
      headingLevel: heading?.tagName.toLowerCase(),
    }).toEqual({
      expanded: oracle.buttonExpandedOpen,
      role: oracle.dialogRole,
      labelledBy: oracle.dialogLabelledBy,
      name: "Need help?",
      headingLevel: oracle.headingLevel,
    });
    await done();
  });

  it("standalone (the palette's): named by its variant alone", async () => {
    const { root, recordsOf, render } = await open("ContextualHelp", "alone");
    const help = recordsOf("ContextualHelp")[0]!;
    const { host, done } = await render(help.id);
    const button = host.querySelector<HTMLElement>("[data-contextual-help]")!;
    const oracle = ORACLE.contextualHelp.help.standalone;
    expect({
      ariaLabel: button.getAttribute("aria-label"),
      labelledBy: button.getAttribute("aria-labelledby"),
      name: nameOf(button),
    }).toEqual({
      ariaLabel: oracle.buttonAriaLabel,
      labelledBy: oracle.buttonLabelledBy,
      name: oracle.buttonName,
    });
    // The closed Popover takes no Canvas box (`TRIGGER_OVERLAY_CHILDREN`).
    const popover = recordsOf("Popover")[0]!;
    const box = root.getGeometry([popover.id]).get(popover.id);
    expect(!box || box.width === 0, "closed Popover").toBe(true);
    await done();
  });

  it("disabled ComboBox: its help opens (detached from the field's Button context), its picker stays disabled", async () => {
    const { setHelp, render } = await open("ComboBox", "disabled", {
      isDisabled: true,
    });
    setHelp("help");
    const { host, done } = await render();
    const help = host.querySelector<HTMLElement>("[data-contextual-help]")!;
    expect(help.hasAttribute("disabled")).toBe(false);
    const picker = [...host.querySelectorAll<HTMLElement>("button")].find(
      (el) => el !== help,
    )!;
    expect(picker.hasAttribute("disabled")).toBe(true);
    await act(async () => help.click());
    expect(
      document.querySelector("[role=dialog]"),
      "help opened",
    ).not.toBeNull();
    await done();
  });

  for (const [size, box] of [
    ["S", 20],
    ["M", 20],
    ["L", 24],
    ["XL", 24],
  ] as const)
    it(`Canvas: the help button is S2's quiet ${box}px square at a ${size} field (Field.tsx:182)`, async () => {
      const { setHelp, root, recordsOf, render } = await open(
        "TextField",
        `size-${size}`,
        { size },
      );
      setHelp("help");
      const button = recordsOf("Button")[0]!;
      const geometry = root.getGeometry([button.id]).get(button.id)!;
      expect([geometry.width, geometry.height]).toEqual([box, box]);
      const { host, done } = await render();
      const el = host.querySelector<HTMLElement>("[data-contextual-help]")!;
      expect([
        el.style.width,
        el.style.height,
        el.style.minWidth,
        el.style.borderWidth,
      ]).toEqual([`${box}px`, `${box}px`, "0px", "0px"]);
      await done();
    });

  for (const position of ["top", "side"] as const)
    it(`Canvas: the label row stands in the Label's place (${position})`, async () => {
      const { setHelp, root, recordsOf, render } = await open(
        "TextField",
        `place-${position}`,
        { labelPosition: position },
      );
      const box = (record: { id: string }) =>
        root.getGeometry([record.id]).get(record.id)!;
      const input = () => recordsOf("Input")[0]!;
      const labelBefore = box(recordsOf("Label")[0]!);
      const inputBefore = box(input());
      setHelp("help");
      const row = box(recordsOf("FieldLabel")[0]!);
      const inputAfter = box(input());
      // (The Preview draws the row too — a side field's grid holds it in the label column.)
      const { host, done } = await render();
      expect(
        host.querySelector(".react-aria-FieldLabel .react-aria-Label"),
        "the row in the DOM",
      ).not.toBeNull();
      await done();
      expect(row.x).toBe(labelBefore.x);
      if (position === "top") {
        expect(row.y).toBe(labelBefore.y);
        expect(inputAfter.y).toBeGreaterThanOrEqual(row.y + row.height);
      } else {
        // The label column holds the row, centered on the Input's line (the field rule's side
        // Label block reaches it — `align-self: center`); the Input stays in the second column.
        expect(row.y).toBe((inputAfter.height - row.height) / 2);
        expect(inputAfter.x).toBeGreaterThanOrEqual(row.x + row.width);
        expect(inputAfter.y).toBe(inputBefore.y);
      }
    });

  it("the Label in the row is still the field's: its necessity mark follows the field (Canvas · DOM)", async () => {
    const { workspace, setHelp, root, recordsOf, render } = await open(
      "TextField",
      "required",
    );
    setHelp("help");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ROOT }],
        props: { isRequired: { kind: "set", value: true } },
      }),
    );
    const label = recordsOf("Label")[0]!;
    expect(root.typeOf(root.canvasInputs.get(label.parentId!)!)).toBe(
      "FieldLabel",
    );
    expect(
      catalogLabelSuffix(
        label,
        (id) => root.canvasInputs.get(id),
        (r) => root.typeOf(r),
      ),
      "Canvas suffix",
    ).not.toBe("");
    const { host, done } = await render();
    const labelEl = host.querySelector(".react-aria-Label")!;
    expect(labelEl.children.length, "DOM necessity mark").toBeGreaterThan(0);
    await done();
  });

  it("ColorSlider: the Label in the row still shows its channel's name (RAC ColorSlider)", async () => {
    const { setHelp, render } = await open("ColorSlider", "channel", {
      label: undefined,
    });
    const before = await render();
    const name = before.host.querySelector(".react-aria-Label")?.textContent;
    await before.done();
    expect(name, "a channel name").toBeTruthy();
    setHelp("help");
    const after = await render();
    expect(after.host.querySelector(".react-aria-Label")?.textContent).toBe(
      name,
    );
    await after.done();
  });

  it("TagGroup: the Label in the row still names its grid (RAC TagGroup label slot)", async () => {
    const { setHelp, render } = await open("TagGroup", "tags");
    setHelp("help");
    const { host, done } = await render();
    const grid = host.querySelector("[role=grid]")!;
    const label = host.querySelector(".react-aria-Label")!;
    expect(grid.getAttribute("aria-labelledby")?.split(/\s+/)).toContain(
      label.id,
    );
    // (Named by its visible Label — no fallback name over it.)
    expect(host.querySelector('[aria-label="Price"]')).toBeNull();
    await done();
  });

  it("a ContextualHelp node of its own (not an origin instance): a variant edit re-reads its glyph", async () => {
    const { workspace, library, recordsOf } = await open("TextField", "own");
    const ids = ["help", "button", "glyph"].map(
      (name) => `project:node:own-${name}` as NodeId,
    );
    const entry = (
      id: NodeId,
      definitionId: string,
      children: NodeId[],
      props: Record<string, unknown> = {},
    ) =>
      ({
        kind: "node",
        id,
        definitionId,
        children,
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    void library;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          entry(ids[0], "lib:definition:type-ContextualHelp", [ids[1]], {
            variant: "help",
          }),
          entry(ids[1], "lib:definition:type-Button", [ids[2]]),
          entry(ids[2], "lib:definition:type-Icon", []),
        ],
        rootIds: [ids[0]],
        newId: workspace.newId,
      }),
    );
    const glyph = () =>
      recordsOf("Icon").find((r) => r.sourceId === ids[2])!.props.iconName;
    expect(glyph()).toBe("circle-question-mark");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ids[0] }],
        props: { variant: { kind: "set", value: "info" } },
      }),
    );
    expect(glyph()).toBe("info");
  });

  it("a ContextualHelp's Popover takes S2's Content · Footer (their owners)", () => {
    for (const child of ["Content", "Footer"])
      expect(
        canNest("Popover", child, ["Popover", "ContextualHelp", "body"]),
        child,
      ).toBe(true);
  });
});
