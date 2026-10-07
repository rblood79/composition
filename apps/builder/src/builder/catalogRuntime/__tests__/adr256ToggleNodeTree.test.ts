// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CheckboxButton,
  CheckboxField,
  FieldError,
  Label,
  RadioButton,
  RadioField,
  RadioGroup,
  SwitchButton,
  SwitchField,
  Text,
} from "react-aria-components";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { resolveDelegatedSubpartOwnerType } from "../../../../../../packages/shared/src/catalog/resolvers/resolveDelegatedChildFontSize";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 3 (G2) — a Checkbox is the reference's `CheckboxField > CheckboxButton (indicator +
 * text) + Description + FieldError` (Decision 3 · F8), drawn as its node tree (Decision 2).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, props: Record<string, string | boolean>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-toggle" as EntryId<"project">,
        name: "Toggle",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-toggle-${Math.random()}`),
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
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const field = () =>
    [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === FIELD,
    )!;
  const html = () =>
    renderToStaticMarkup(renderCatalogDom(workspace.root, field().id));
  const part = (type: string) =>
    [...workspace.root.canvasInputs.values()].find(
      (record) => workspace.root.typeOf(record) === type,
    )!;
  return { workspace, field, html, part };
}

/**
 * Decision 11 structure (tag · structural attributes · text · aria links as positions). Known
 * differences outside this phase, collapsed here and recorded in the breakdown: a text node is an
 * element of its own (`span` — a builder node needs one) where the reference writes bare text; the
 * glyph's markup (lucide vs the reference's polyline).
 */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  for (const text of [
    ...host.querySelectorAll(
      ":is(.react-aria-CheckboxButton, .react-aria-SwitchButton, .react-aria-RadioButton) > span.react-aria-Label",
    ),
  ])
    text.replaceWith(...text.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  const all = [...host.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    // (A link to an element RAC did not draw names no position — its generated id is not structure.)
    return index < 0 ? "missing" : `#${index}`;
  };
  const KEEP = /^(role|slot|type|aria-.*|disabled|required|readonly|checked)$/;
  const LINKS = new Set(["aria-labelledby", "aria-describedby", "for"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) => KEEP.test(attribute.name) || LINKS.has(attribute.name),
      )
      .map((attribute) =>
        LINKS.has(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...host.children].map(walk).join("\n");
}

/**
 * A Checkbox the author built from the parts (an origin instance's root shows a display state, so
 * it does not detach): `Checkbox > CheckboxButton > [CheckboxIndicator, Label]`.
 */
async function authored() {
  const opened = await open("checkbox", {});
  const { workspace } = opened;
  const id = (name: string) => `project:node:${name}` as NodeId;
  const node = (
    name: string,
    type: string,
    children: string[],
    props: Record<string, unknown> = {},
  ) =>
    ({
      kind: "node",
      id: id(name),
      definitionId: `lib:definition:type-${type}`,
      children: children.map(id),
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, set(value)]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("box", "Checkbox", ["box-button"]),
        node("box-button", "CheckboxButton", ["box-indicator", "box-text"]),
        node("box-indicator", "CheckboxIndicator", []),
        node("box-text", "Label", [], { children: "Own" }),
      ],
      rootIds: [id("box")],
      newId: workspace.newId,
    }),
  );
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        workspace.root,
        [...workspace.root.domInputs.values()].find(
          (record) => record.sourceId === id("box"),
        )!.id,
      ),
    );
  return { workspace, id, html };
}

describe("ADR-256 Phase 3 — Checkbox is CheckboxField > CheckboxButton", () => {
  it("has the reference example's structure (example 7 — with a description)", async () => {
    const { html } = await open("checkbox", {
      children: "Subscribe",
      description: "Get the newsletter",
      isSelected: true,
    });
    // react-aria.adobe.com Checkbox (G0 example 7).
    const reference = renderToStaticMarkup(
      createElement(
        CheckboxField,
        { defaultSelected: true },
        createElement(
          CheckboxButton,
          null,
          createElement(
            "div",
            { className: "indicator" },
            createElement("svg", { "aria-hidden": "true" }),
          ),
          "Subscribe",
        ),
        createElement(Text, { slot: "description" }, "Get the newsletter"),
        createElement(FieldError),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("an empty description is absent; an invalid Checkbox shows its error (Canvas and DOM)", async () => {
    const quiet = await open("checkbox", { description: "" });
    expect(quiet.part("Description").hidden).toBe(true);
    expect(quiet.part("FieldError").hidden).toBe(true);
    expect(quiet.html()).not.toContain('slot="description"');
    const invalid = await open("checkbox", {
      isInvalid: true,
      errorMessage: "Required",
    });
    expect(invalid.part("FieldError").hidden).toBeFalsy();
    expect(invalid.html()).toMatch(
      /class="react-aria-FieldError"[^>]*>Required</,
    );
  });

  it("a free child in the button is drawn in its place (Canvas and DOM)", async () => {
    const { workspace, id, html } = await authored();
    const icon = id("free-icon");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("box-button") },
        entries: [
          {
            kind: "node",
            id: icon,
            definitionId: "lib:definition:type-Icon",
            children: [],
            props: { iconName: set("star") },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [icon],
        newId: workspace.newId,
      }),
    );
    const markup = html();
    const button = markup.slice(
      markup.indexOf('class="react-aria-CheckboxButton"'),
      markup.indexOf("</label>"),
    );
    // The Icon is in the button, after the text.
    expect(button.indexOf(icon)).toBeGreaterThan(button.indexOf(">Own<"));
    expect(button).toContain("<svg");
    const record = [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === icon,
    );
    expect(record && !record.hidden).toBe(true);
  });

  it("the CheckboxButton is a part RAC needs: deleting it is refused", async () => {
    const { workspace, id } = await authored();
    let code: string | undefined;
    try {
      workspace.execute(
        removeTargets({ targets: [{ kind: "node", id: id("box-button") }] }),
      );
    } catch (error) {
      code = (error as { code?: string }).code;
    }
    expect(code).toBe("REQUIRED_PART_NOT_REMOVABLE");
  });

  it("the indicator's editing owner is the Checkbox, through its button", () => {
    expect(
      resolveDelegatedSubpartOwnerType(
        "CheckboxIndicator",
        "CheckboxButton",
        "Checkbox",
      ),
    ).toBe("Checkbox");
  });

  it("CheckboxGroup items are the group's values; the group label names the group only", async () => {
    const { html } = await open("checkboxgroup", { label: "Toppings" });
    const host = document.createElement("div");
    host.innerHTML = html();
    const group = host.querySelector('[role="group"]')!;
    const labelledBy = group.getAttribute("aria-labelledby")!;
    expect(host.querySelector(`#${CSS.escape(labelledBy)}`)?.textContent).toBe(
      "Toppings",
    );
    // No item text carries the group label's id (before: RAC `Label` in the group's context).
    expect(host.querySelectorAll(`[id="${labelledBy}"]`)).toHaveLength(1);
    const inputs = [...host.querySelectorAll('input[type="checkbox"]')];
    expect(inputs).toHaveLength(2);
    for (const input of inputs)
      expect(input.getAttribute("value")).toMatch(/__checkbox-\d$/);
    expect(
      host.querySelectorAll(
        "div.react-aria-Checkbox > label.react-aria-CheckboxButton",
      ),
    ).toHaveLength(2);
  });
});

describe("ADR-256 Phase 3 — Switch · Radio are *Field > *Button", () => {
  it("Switch has the reference structure: SwitchField > SwitchButton (track + text) + Description + FieldError", async () => {
    const { html } = await open("switch", {
      children: "Wi-Fi",
      description: "Connect automatically",
      isSelected: true,
    });
    const reference = renderToStaticMarkup(
      createElement(
        SwitchField,
        { defaultSelected: true },
        createElement(
          SwitchButton,
          null,
          createElement("div", { className: "indicator" }),
          "Wi-Fi",
        ),
        createElement(Text, { slot: "description" }, "Connect automatically"),
        createElement(FieldError),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("RadioGroup items have the reference structure: RadioField > RadioButton (ring + text)", async () => {
    const { html, field } = await open("radiogroup", { label: "Size" });
    const radios = [...html().matchAll(/value="([^"]+)"/g)].map((m) => m[1]!);
    const reference = renderToStaticMarkup(
      createElement(
        RadioGroup,
        { defaultValue: radios[0] },
        createElement(Label, null, "Size"),
        createElement(
          "div",
          { className: "radio-items" },
          ...radios.map((value, index) =>
            createElement(
              RadioField,
              { key: value, value },
              createElement(
                RadioButton,
                null,
                createElement("div", { className: "indicator" }),
                `Option ${index + 1}`,
              ),
            ),
          ),
        ),
        createElement(FieldError),
      ),
    );
    expect(field()).toBeDefined();
    expect(structure(html())).toBe(structure(reference));
  });

  it.each([
    ["checkbox", [], "component-checkbox"],
    ["switch", [], "component-switch"],
    // (A RadioGroup's Radio is an instance inside the group's template.)
    [
      "radiogroup",
      ["lib:template:component-radiogroup__2__radio-1"],
      "component-radio",
    ],
  ] as const)(
    "%s: the toggle's button is a part RAC needs — its origin position cannot be hidden",
    async (type, inner, origin) => {
      const { workspace } = await open(type, {});
      let code: string | undefined;
      try {
        workspace.execute(
          removeTargets({
            targets: [
              {
                kind: "descendant",
                ownerId: FIELD,
                address: {
                  instances: [FIELD, ...inner],
                  templatePath: [
                    `lib:template:${origin}`,
                    `lib:template:${origin}__button`,
                  ],
                },
              },
            ],
          } as never),
        );
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      expect(code).toBe("REQUIRED_PART_NOT_REMOVABLE");
    },
  );
});
