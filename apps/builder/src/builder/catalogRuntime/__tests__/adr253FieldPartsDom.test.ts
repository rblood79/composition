import "fake-indexeddb/auto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { cssVarColor } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
  StateName,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogSubpartOwnerType } from "../subpart";
import { catalogRuleShapes } from "../ruleShapes";
import { catalogAuthoredVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 Phase 3 (G3 — DOM 구조 대조): a field's parts are drawn from its part nodes (instances
 * of the part origins), and the document the Preview renders is the one the field composed from
 * its own props before.
 *
 * Oracle: `fixtures/adr253-field-dom.json` — the same catalog documents rendered by the build
 * before Phase 3 (main `1d66260dd`; written there with `ADR253_WRITE_DOM=1`). Structure =
 * elements, their attributes and text, in order; generated ids, the catalog markers and inline
 * style are not structure (what the parts draw is judged by the Canvas ↔ DOM comparison). Nor is
 * the `data-size` of a field's control: the Input node's element carries the field's size for the
 * Input rule's own sheet (before, the field's sheet sized it through variables).
 */
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/adr253-field-dom.json",
);
const TYPES = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
  "checkboxgroup",
  "radiogroup",
  "meter",
  "progressbar",
  "slider",
  "taggroup",
] as const;
const CASES: Record<string, Record<string, string | boolean>> = {
  default: {},
  required: { isRequired: true },
  "required, label indicator": {
    isRequired: true,
    necessityIndicator: "label",
  },
  "optional, label indicator": { necessityIndicator: "label" },
  "no label": { label: "" },
  description: { description: "Help text" },
  invalid: { isInvalid: true, errorMessage: "Not valid" },
  "side label": { labelPosition: "side" },
  "size sm": { size: "sm" },
  "size xl": { size: "xl" },
  disabled: { isDisabled: true },
  "read only": { isReadOnly: true },
  quiet: { isQuiet: true },
};
/**
 * Cases whose document differs from the fixture on purpose (Phase 3 — FieldError · Description):
 * the Preview did not render these fields' `description` · `errorMessage` at all (the Select ·
 * ComboBox binding and the groups' never passed them). They are part nodes now, drawn like every
 * other field's.
 */
const SHOWN_SINCE: Record<
  string,
  { selector: string; text: string; node: RegExp }
> = {
  "select/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-select__description$/,
  },
  "select/invalid": {
    selector: ".react-aria-FieldError",
    text: "Not valid",
    node: /component-select__error$/,
  },
  "combobox/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-combobox__description$/,
  },
  "combobox/invalid": {
    selector: ".react-aria-FieldError",
    text: "Not valid",
    node: /component-combobox__error$/,
  },
  "checkboxgroup/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-checkboxgroup__description$/,
  },
  "radiogroup/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-radiogroup__description$/,
  },
};
/** Fields with `isQuiet`, and whether their box is a part instance (a range picker's is its Group). */
const QUIET_BOX_PARTS: Record<string, boolean> = {
  textfield: true,
  textarea: true,
  numberfield: true,
  searchfield: true,
  colorfield: true,
  combobox: true,
  datefield: true,
  timefield: true,
  datepicker: true,
};
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const LABEL_ORIGIN =
  "lib:definition:origin-component-label" as LibraryDefinitionId;
const DESCRIPTION_ORIGIN =
  "lib:definition:origin-component-description" as LibraryDefinitionId;
const FIELD_ERROR_ORIGIN =
  "lib:definition:origin-component-fielderror" as LibraryDefinitionId;
const INPUT_ORIGIN =
  "lib:definition:origin-component-input" as LibraryDefinitionId;
/** Fields whose control is their Input node (an instance of the Input origin). */
const INPUT_TYPES = ["textfield", "textarea", "colorfield"] as const;
/**
 * The ColorField's Input node has a placeholder (`#000000`, drawn on the Canvas); the Preview's
 * own composition left it out. The node's element shows it.
 */
const INPUT_PLACEHOLDER_SINCE: Record<string, string> = {
  colorfield: " placeholder=#000000",
  numberfield: " placeholder=0",
};
/**
 * ADR-256 Phase 3 — a Checkbox · Radio is RAC `CheckboxField` · `RadioField` around a
 * `CheckboxButton` · `RadioButton` (the reference), applied to the fixture: the item's
 * `label.react-aria-<Type>` becomes a `div.react-aria-<Type>` (RAC's field state) holding a
 * `label.react-aria-<Type>Button` (the pressable — RAC puts the same state on it); no
 * `slot="selection"` (none outside a collection). A Radio's ring is the reference's `div.indicator`
 * element (was the label's `::before`). The item's text is its own element — before, RAC's `Label`
 * took the group's label context (its id).
 */
const TOGGLE_FIELD_STATE =
  /^data-(disabled|indeterminate|invalid|readonly|required|selected)=/;
function toggleFieldMarkup(text: string, type: "Checkbox" | "Radio"): string {
  return text
    .replace(
      new RegExp(`<label class=react-aria-${type} ([^>]*)>`, "g"),
      (_tag, list: string) => {
        const attributes = list.split(" ");
        const field = attributes.filter(
          (attribute) =>
            !attribute.startsWith("data-react-aria-pressable=") &&
            !attribute.startsWith("slot="),
        );
        const button = attributes
          .filter(
            (attribute) =>
              TOGGLE_FIELD_STATE.test(attribute) ||
              attribute === "data-rac=" ||
              attribute.startsWith("data-react-aria-pressable="),
          )
          .sort();
        return `<div class=react-aria-${type} ${field.join(" ")}><label class=react-aria-${type}Button ${button.join(" ")}>`;
      },
    )
    .replace(
      /<span class=react-aria-Label id>(Option \d)<\/><\/>/g,
      `${type === "Radio" ? "<div class=indicator></>" : ""}<span class=react-aria-Label>$1</></></>`,
    );
}
/**
 * ADR-256 Phase 5d: a Tag's label is a plain Text (no `slot="label"` — the reference's children),
 * and the Tag is named by it (`textValue` → RAC's `aria-label` · `aria-labelledby`).
 */
function tagGroupMarkup(text: string): string {
  // Codex Round 20 H1: no styled outer div — the RAC TagGroup is the node's box — and the maxRows
  // measuring mirror sits in the TagList node's chip box.
  const outer = text.match(
    /^<div >(<div aria-hidden=true class=react-aria-TagList [^>]*>(?:<span class=react-aria-Tag>[^<]*<\/>)*<\/>)?<template ><\/>([\s\S]*)<\/>$/,
  );
  if (outer)
    text = `<template ></>\n${outer[2]!.replace(
      "<div class=tag-list-wrapper>",
      `<div class=tag-list-wrapper>${outer[1] ?? ""}`,
    )}`;
  // (Without a visible label the group is named — RAC needs a name, as the other fields.)
  if (!text.includes("class=react-aria-Label"))
    text = text.replace(
      "aria-describedby aria-labelledby aria-live=off",
      "aria-describedby aria-label=Tag group aria-live=off",
    );
  return text.replace(
    /<div aria-selected=(\w+) class=react-aria-Tag ([^>]*)><div aria-colindex=1 role=gridcell><span class=react-aria-Text data-size=(\w+) slot=label>([^<]*)</g,
    (_match, selected, rest, size, label) =>
      // (A Tag has no `variant` — RAC · S2 Tag has none; its selection is the group's, 2026-10-09.)
      `<div aria-label=${label} aria-labelledby aria-selected=${selected} class=react-aria-Tag ${rest.replace(" data-variant=default", "")}><div aria-colindex=1 role=gridcell><span class=react-aria-Text data-size=${size}>${label}<`,
  );
}
/** Side label hint indent at md: the label column (11rem = 176) + the field's own md gap. */
const SIDE_INDENT: Record<string, number> = {
  textfield: 182,
  textarea: 182,
  numberfield: 182,
  searchfield: 184,
  select: 182,
  combobox: 182,
  datefield: 182,
  timefield: 182,
  datepicker: 180,
  daterangepicker: 180,
};
/** Fields whose Description · FieldError are part nodes. */
const HINT_TYPES = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
  "checkboxgroup",
  "radiogroup",
] as const;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const BUTTON_NODE_MARKS = [
  "data-variant",
  "data-fill-style",
  "data-size",
  "data-static-color",
];
/**
 * Fields whose control is a wrapper around part nodes (the Group of a NumberField): an Input
 * instance and Button instances. A Button's glyph is its Icon node — the Canvas glyph — where the
 * shared component drew its own svg, so the glyph markup is left out of the structure on both
 * sides and asserted on its own.
 */
const WRAPPED_TYPES = [
  "numberfield",
  "combobox",
  "searchfield",
  "select",
  "datepicker",
  "daterangepicker",
];
/**
 * What a date field's part nodes write differently from the component's own composition
 * (ADR-253), applied to the fixture: the DateInput's box is the DateInput rule's sheet (no
 * `inset` utility class); a range picker's separator is a Text node.
 */
const DATE_PART_MARKUP: Record<string, readonly (readonly [string, string])[]> =
  {
    datefield: [
      ["class=react-aria-DateInput inset", "class=react-aria-DateInput"],
    ],
    timefield: [
      ["class=react-aria-DateInput inset", "class=react-aria-DateInput"],
    ],
    daterangepicker: [
      [
        "<span aria-hidden=true>\u2013</>",
        "<span aria-hidden=true class=react-aria-Text>\u2013</>",
      ],
    ],
  };
/**
 * ADR-256 후속 7: a group's items show the group's value — none by default (before, each item's
 * template showed the palette Checkbox's / Radio's `selected` display state, every box checked
 * and the first Radio picked). Applied to the fixture: the selection marks go, and with no Radio
 * chosen every Radio is in the Tab order (RAC `useRadio`).
 */
const groupItemsUnselected = (type: string, text: string) =>
  type === "checkboxgroup" || type === "radiogroup"
    ? (type === "radiogroup"
        ? text.replace(/tabindex=-1/g, "tabindex=0")
        : text
      )
        .replace(/ data-selected=true/g, "")
        .replace(/data-selected=true /g, "")
        .replace(/ checked=/g, "")
        .replace(
          /<svg aria-hidden=true class=lucide lucide-check [^>]*><path [^>]*><\/><\/>/g,
          "",
        )
    : text;
/**
 * A field's control Group that only places its parts (ADR-256 Phase 6b — a RAC Group carries no
 * fill, border or padding of its own; before, a `plain` SelectTrigger zeroed them).
 */
const expectPaintsNothing = (visual: Readonly<Record<string, unknown>>) => {
  expect([undefined, "transparent"]).toContain(visual.fill);
  for (const key of ["borderWidth", "paddingX", "paddingY"] as const)
    expect([undefined, 0]).toContain(visual[key]);
};
/**
 * ADR-256 Phase 6b: a SearchField's control box is a RAC Group node (its container class kept for
 * the SearchField rule's selector) — RAC's SearchField gives it the field's disabled · invalid.
 */
const fieldGroupMarkup = (markup: string, container: string) => {
  // (The field's root — after a RAC collection's hidden `<template>` line, if any.)
  const root = /^<div [^>]*>/m.exec(markup)?.[0] ?? "";
  const state = ["data-disabled=true", "data-invalid=true"]
    .filter((attribute) => root.includes(` ${attribute}`))
    .map((attribute) => ` ${attribute}`)
    .join("");
  return markup.replace(
    `<div class=${container}>`,
    `<div class=react-aria-Group ${container}${state} data-rac= role=group>`,
  );
};
const searchFieldGroupMarkup = (markup: string) =>
  fieldGroupMarkup(markup, "searchfield-container");
/**
 * ADR-256 Phase 6d: a ComboBox draws its node tree in RAC's ComboBox — its control box is its RAC
 * Group node (the ComboBox rule's container class kept), RAC's ComboBox gives it the field's
 * disabled · invalid; a quiet ComboBox's root carries `data-quiet` as every node-tree field's does
 * (the shared component's binding dropped `isQuiet`). The closed Popover draws nothing.
 */
const comboBoxGroupMarkup = (markup: string, quiet: boolean) => {
  const grouped = fieldGroupMarkup(markup, "combobox-container");
  return quiet
    ? grouped.replace(
        /(<div class=react-aria-ComboBox[^>]*data-label-position=\w+)/,
        "$1 data-quiet=true",
      )
    : grouped;
};
/**
 * ADR-256 Phase 6c: a Select draws its node tree in RAC's Select — the shared component's own
 * root mark `data-selection-mode` (no sheet reads it; RAC's Select has none) is gone.
 */
const selectNodeTreeMarkup = (markup: string) =>
  markup.replace(
    /(<div class=react-aria-Select[^>]*) data-selection-mode=single/,
    "$1",
  );
/**
 * ADR-256 Phase 6e: a DatePicker · DateRangePicker draws its node tree in RAC's picker — the shared
 * component's root mark `data-necessity-indicator` (the Form's mark — no field sheet reads it; no
 * node-tree field carries it) is gone, a quiet picker's root carries `data-quiet` as every node-tree
 * field's does, and a picker without a visible label is named (RAC needs a label or an
 * `aria-label` — before, it had no name). The closed Popover draws nothing.
 */
const datePickerNodeTreeMarkup = (
  markup: string,
  type: string,
  name: string,
) => {
  const root = new RegExp(
    `(<div class=react-aria-${type}[^>]*?) data-necessity-indicator=\\w+`,
  );
  const tree = markup.replace(root, "$1");
  if (name === "quiet")
    return tree.replace(
      new RegExp(
        `(<div class=react-aria-${type}[^>]*data-label-position=\\w+)`,
      ),
      "$1 data-quiet=true",
    );
  if (name !== "no label") return tree;
  // (RAC names the picker's Group by its `aria-label`; a DatePicker's segments name themselves by
  // it too, a range's keep their link to the Group.)
  if (type === "DateRangePicker")
    return tree.replace(
      "aria-describedby aria-labelledby class=react-aria-Group",
      "aria-describedby aria-label=Date Range class=react-aria-Group",
    );
  return tree
    .replace(
      "aria-describedby aria-labelledby class=react-aria-Group",
      "aria-describedby aria-label=Date Picker aria-labelledby class=react-aria-Group",
    )
    .replace(
      /aria-label=((?:month|day|year), ) aria-labelledby/g,
      "aria-label=$1Date Picker",
    );
};
/**
 * ADR-256 Phase 7a · 7b: a ProgressBar · Meter draws its node tree in RAC's component — the same
 * parts, and one without a visible label is named (RAC needs a label or an `aria-label` — before,
 * it had none).
 */
const progressNodeTreeMarkup = (markup: string, name: string, label: string) =>
  name === "no label"
    ? markup.replace(
        /^<div aria-labelledby (aria-valuemax)/,
        `<div aria-label=${label} $1`,
      )
    : markup;
/**
 * ADR-256 Phase 7c: a Slider draws its node tree in RAC's Slider — the track is its own bar (no
 * `.slider-track-bg` element), the fill is RAC's `SliderFill` (was the shared component's
 * `.slider-fill` div), and a Slider without a visible label is named (`aria-label`).
 */
const sliderNodeTreeMarkup = (markup: string, name: string) => {
  const disabled = /class=react-aria-Slider [^>]*data-disabled=true/.test(
    markup,
  );
  const tree = markup
    .replace(/<div class=slider-track-bg[^>]*><\/>/, "")
    .replace(
      /<div class=slider-fill[^>]*><\/>/,
      `<div class=react-aria-SliderFill ${disabled ? "data-disabled=true " : ""}data-orientation=horizontal data-rac=></>`,
    );
  return name === "no label"
    ? tree.replace(
        /^<div aria-labelledby (class=react-aria-Slider)/,
        "<div aria-label=Slider $1",
      )
    : tree;
};
/**
 * A Select's hidden native select lists the items of its ListBox node (ADR-253 Phase 4 — before,
 * the Preview's Select had no options at all): they are asserted on their own.
 */
const ITEM_OPTION = /<option value=[^ >]+>([^<]*)<\/>/g;
const withoutGlyphs = (structure: string) =>
  structure
    .replace(/<svg [^>]*>(?:<(?:path|circle) [^>]*><\/>)*<\/>/g, "")
    .replace(/<div class=react-aria-Icon(?: data-icon=[\w-]+)?><\/>/g, "")
    // (A SearchField's leading glyph: the component's own wrapper before, the Icon node now.)
    .replace(/<span aria-hidden=true class=search-icon><\/>/g, "")
    // (A Select's trigger glyph: the component's own chevron wrapper before, the Icon node now.)
    .replace(/<span aria-hidden=true class=select-chevron><\/>/g, "");

/** A document's structure: elements, their attributes (sorted) and text, in order. */
function normalize(html: string): string {
  const walk = (element: Element): string => {
    // (A DateInput node's element carries its size like an Input's; so does a range picker's
    // separator Text node.)
    const control =
      ["input", "textarea"].includes(element.tagName.toLowerCase()) ||
      element.classList.contains("react-aria-DateInput") ||
      (element.classList.contains("react-aria-Text") &&
        element.parentElement?.classList.contains("react-aria-Group") === true);
    // A Button node's element carries the Button rule's marks (`button-base` · `data-*`): what
    // its sheet reads, as an Input's `data-size`.
    const button = element.tagName.toLowerCase() === "button";
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          attribute.name !== "data-catalog-id" &&
          attribute.name !== "style" &&
          // (… and the quiet state of a quiet field's box — the part rule's `&[data-quiet]`.)
          !(control && ["data-size", "data-quiet"].includes(attribute.name)) &&
          !(button && BUTTON_NODE_MARKS.includes(attribute.name)),
      )
      .map((attribute) =>
        [
          "id",
          "for",
          "aria-labelledby",
          "aria-describedby",
          "aria-controls",
        ].includes(attribute.name)
          ? attribute.name
          : button && attribute.name === "class"
            ? `class=${attribute.value.replace(" button-base", "")}`
            : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1 ? walk(child as Element) : child.textContent,
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  const host = document.createElement("div");
  host.innerHTML = html;
  return [...host.children].map(walk).join("\n");
}

/** The field with the case's props (a prop the field does not take is left out), as the DOM. */
async function render(
  type: string,
  authored: Record<string, string | boolean>,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr253-parts" as EntryId<"project">,
        name: "ADR-253 parts",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-parts-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
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
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  for (const [key, value] of Object.entries(authored))
    try {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { [key]: set(value) },
        }),
      );
    } catch {
      return undefined;
    }
  const field = [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === FIELD,
  )!;
  const html = renderToStaticMarkup(
    // (A DateField · TimeField without a value shows its empty segments — RAC · RSP.)
    renderCatalogDom(workspace.root, field.id),
  );
  return { html, workspace, field };
}

/** Where the Canvas draws an Input node's text in its box: the start x and the end padding. */
function inputTextBand(workspace: CatalogWorkspace, id: string) {
  const root = workspace.root;
  const node = root.canvasInputs.get(id)!;
  const box = root.getGeometry([id]).get(id) as {
    width: number;
    height: number;
  };
  const text = catalogRuleShapes({
    node,
    rect: { width: box.width, height: box.height },
    rule: workspace.runtime.graph.library.rules.get("Input" as never)!,
    type: "Input",
    authoredVisual: catalogAuthoredVisual(root, node),
  }).find((shape) => shape.type === "text") as unknown as {
    x: number;
    paddingRight?: number;
  };
  return { x: text.x, paddingRight: text.paddingRight };
}

describe("ADR-253 Phase 3 — a field's DOM is the document it composed from its props before", () => {
  const write = process.env.ADR253_WRITE_DOM === "1";
  const fixture: Record<string, string> =
    !write && existsSync(FIXTURE)
      ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>)
      : {};
  const written: Record<string, string> = {};

  for (const type of TYPES)
    for (const [name, authored] of Object.entries(CASES))
      it(`${type} — ${name}`, async () => {
        const rendered = await render(type, authored);
        // The field does not take the case's prop: no such document.
        if (!rendered) {
          if (!write) expect(fixture[`${type}/${name}`]).toBeUndefined();
          return;
        }
        const markup = normalize(rendered.html);
        if (write) {
          written[`${type}/${name}`] = markup;
          return;
        }
        if (type === "select")
          expect(
            [...markup.matchAll(ITEM_OPTION)].map((match) => match[1]),
          ).toEqual(["Aardvark", "Cat", "Dog", "Kangaroo"]);
        const structure = markup.replace(ITEM_OPTION, "");
        const shown = SHOWN_SINCE[`${type}/${name}`];
        if (!shown) {
          const placeholder = INPUT_PLACEHOLDER_SINCE[type];
          if (placeholder) expect(structure).toContain(placeholder);
          const glyphless = WRAPPED_TYPES.includes(type)
            ? withoutGlyphs
            : type === "taggroup"
              ? // (React's `useId` follows the tree: without the outer div RAC's collection id moves.)
                (text: string) =>
                  text.replace(/react-aria-_R_\w+_/g, "react-aria-_R_")
              : (text: string) => text;
          const fixed = groupItemsUnselected(
            type,
            (DATE_PART_MARKUP[type] ?? []).reduce(
              (text, [before, after]) => text.replaceAll(before, after),
              fixture[`${type}/${name}`],
            ),
          );
          const expected =
            type === "checkboxgroup"
              ? toggleFieldMarkup(fixed, "Checkbox")
              : type === "radiogroup"
                ? toggleFieldMarkup(fixed, "Radio")
                : type === "taggroup"
                  ? tagGroupMarkup(fixed)
                  : type === "searchfield"
                    ? searchFieldGroupMarkup(fixed)
                    : type === "select"
                      ? selectNodeTreeMarkup(fixed)
                      : type === "slider"
                        ? sliderNodeTreeMarkup(fixed, name)
                        : type === "progressbar" || type === "meter"
                          ? progressNodeTreeMarkup(
                              fixed,
                              name,
                              type === "meter" ? "Meter" : "Progress",
                            )
                          : type === "combobox"
                            ? comboBoxGroupMarkup(fixed, name === "quiet")
                            : type === "datepicker"
                              ? datePickerNodeTreeMarkup(
                                  fixed,
                                  "DatePicker",
                                  name,
                                )
                              : type === "daterangepicker"
                                ? datePickerNodeTreeMarkup(
                                    fixed,
                                    "DateRangePicker",
                                    name,
                                  )
                                : fixed;
          expect(
            glyphless(
              placeholder ? structure.replace(placeholder, "") : structure,
            ),
          ).toBe(glyphless(expected));
          return;
        }
        // The hint the Preview left out before: the part node's element, described to the control.
        expect(structure).not.toBe(fixture[`${type}/${name}`]);
        const host = document.createElement("div");
        host.innerHTML = rendered.html;
        const hint = host.querySelector(shown.selector)!;
        expect(hint?.textContent).toBe(shown.text);
        expect(hint.getAttribute("data-catalog-id")).toMatch(shown.node);
        const describedBy = [...host.querySelectorAll("[aria-describedby]")]
          .flatMap((element) =>
            element.getAttribute("aria-describedby")!.split(" "),
          )
          .filter(Boolean);
        expect(describedBy).toContain(hint.id);
      });

  it.runIf(write)("writes the fixture (the build before Phase 3)", () => {
    writeFileSync(FIXTURE, `${JSON.stringify(written, null, 1)}\n`);
  });

  /** The Label element is the field's Label node (an instance of the Label origin). */
  for (const type of TYPES)
    it.skipIf(write)(
      `${type} — its Label element is its Label node`,
      async () => {
        const rendered = (await render(type, {}))!;
        const { workspace, field } = rendered;
        const label = field.children
          .map((id) => workspace.root.domInputs.get(id)!)
          .find((child) => child.bindingId === "label")!;
        expect(label.collapsedSourceIds).toEqual([
          "lib:template:component-label",
        ]);
        // Its resolved font is the element's inline style (the Canvas reads the same record).
        const tag = new RegExp(
          `<(?:label|span)[^>]*data-catalog-id="${label.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`,
        ).exec(rendered.html)?.[0];
        expect(tag).toBeDefined();
        expect(tag).toMatch(/font-weight:\s*500/);
        expect(tag).toContain(`font-size:${label.visual.fontSize}px`);
      },
    );

  /** The Label rule sizes the Label at its field's size (no field rule declares a Label font). */
  for (const type of TYPES)
    it.skipIf(write)(`${type} — its size sizes its Label`, async () => {
      const large = await render(type, { size: "lg" });
      const label = large!.field.children
        .map((id) => large!.workspace.root.canvasInputs.get(id)!)
        .find((child) => child.bindingId === "label")!;
      expect(label.props.size).toBe("lg");
      expect(label.visual.fontSize).toBe(16);
      expect(
        Number(label.visual.lineHeight) * Number(label.visual.fontSize),
      ).toBeCloseTo(24, 5);
      expect(label.visual.fontWeight).toBe(500);
    });

  /**
   * The Label origin is the one place every field's Label takes its style from: an edit there
   * reaches each field's Label on the Canvas and in the DOM, a second edit as well (a value-only
   * step), and a style written on one field's Label stays that Label's.
   */
  for (const type of TYPES)
    it.skipIf(write)(
      `${type} — its Label follows the Label origin, its own style on top`,
      async () => {
        const { workspace, field } = (await render(type, {}))!;
        const label = () => {
          const record = workspace.root.domInputs
            .get(field.id)!
            .children.map((id) => workspace.root.domInputs.get(id)!)
            .find((child) => child.bindingId === "label")!;
          return {
            dom: record,
            canvas: workspace.root.canvasInputs.get(record.id)!,
          };
        };
        const originColor = (value: string) =>
          workspace.execute(
            setLibraryDefault({
              definitionId: LABEL_ORIGIN,
              scope: "visual",
              key: "color",
              write: set(value),
              newId: workspace.newId,
            }),
          );
        for (const color of ["#ff0000", "#0000ff"]) {
          originColor(color);
          expect(label().canvas.visual.color).toBe(color);
          expect(label().dom.visual.color).toBe(color);
        }
        const html = () =>
          renderToStaticMarkup(renderCatalogDom(workspace.root, field.id));
        expect(html()).toMatch(
          /<(label|span)[^>]*style="[^"]*color:\s*#0000ff/,
        );
        // The Label's style is its own to edit (the Styles panel's target), its text the field's.
        const graph = workspace.runtime.graph;
        const records = workspace.root.domInputs;
        expect(
          catalogSubpartOwnerType(graph, records, label().dom.id, "style"),
        ).toBeNull();
        expect(
          catalogSubpartOwnerType(graph, records, label().dom.id, "all"),
        ).not.toBeNull();
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(label().dom.id)!.target],
            visual: { color: set("#00aa00") },
          }),
        );
        expect(label().canvas.visual.color).toBe("#00aa00");
        expect(html()).toMatch(
          /<(label|span)[^>]*style="[^"]*color:\s*#00aa00/,
        );
        // The origin edited again: the Label that wrote its own color keeps it.
        originColor("#123456");
        expect(label().canvas.visual.color).toBe("#00aa00");
      },
    );

  /**
   * The hint parts (FieldError · Description): instances of their origins. The Canvas shows the
   * Description while the field has one and the FieldError while the field is invalid with a
   * message — the DOM leaves both to RAC inside the field's context.
   */
  for (const type of HINT_TYPES)
    it.skipIf(write)(
      `${type} — its Description · FieldError are part nodes`,
      async () => {
        const { workspace, field } = (await render(type, {}))!;
        const part = (binding: string) => {
          const record = workspace.root.canvasInputs
            .get(field.id)!
            .children.map((id) => workspace.root.canvasInputs.get(id)!)
            .find((child) => child.bindingId === binding)!;
          return record;
        };
        const write = (props: Record<string, string | boolean>) =>
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: Object.fromEntries(
                Object.entries(props).map(([key, value]) => [key, set(value)]),
              ),
            }),
          );
        expect(part("description").collapsedSourceIds).toEqual([
          "lib:template:component-description",
        ]);
        expect(part("fielderror").collapsedSourceIds).toEqual([
          "lib:template:component-fielderror",
        ]);
        // At rest: neither shows.
        expect(part("description").hidden).toBe(true);
        expect(part("fielderror").hidden).toBe(true);
        write({ description: "Help text" });
        expect(part("description").hidden).toBeUndefined();
        expect(part("description").props.children).toBe("Help text");
        // Invalid without a message: nothing to show (RAC renders its own errors at run time).
        write({ isInvalid: true });
        expect(part("fielderror").hidden).toBe(true);
        write({ errorMessage: "Not valid" });
        expect(part("fielderror").hidden).toBeUndefined();
        expect(part("fielderror").props.children).toBe("Not valid");
        // Each is sized by its own rule at the field's size (md = text-xs).
        for (const binding of ["description", "fielderror"]) {
          expect(part(binding).props.size).toBe("md");
          expect(part(binding).visual.fontSize).toBe(12);
        }
        write({ size: "lg" });
        for (const binding of ["description", "fielderror"])
          expect(part(binding).visual.fontSize).toBe(14);
        // The origins are the one place their style comes from; the part's own style stays on top.
        for (const [origin, binding] of [
          [DESCRIPTION_ORIGIN, "description"],
          [FIELD_ERROR_ORIGIN, "fielderror"],
        ] as const) {
          for (const color of ["#ff0000", "#0000ff"]) {
            workspace.execute(
              setLibraryDefault({
                definitionId: origin,
                scope: "visual",
                key: "color",
                write: set(color),
                newId: workspace.newId,
              }),
            );
            expect(part(binding).visual.color).toBe(color);
            expect(
              workspace.root.domInputs.get(part(binding).id)!.visual.color,
            ).toBe(color);
          }
          expect(
            catalogSubpartOwnerType(
              workspace.runtime.graph,
              workspace.root.domInputs,
              part(binding).id,
              "style",
            ),
          ).toBeNull();
          expect(
            catalogSubpartOwnerType(
              workspace.runtime.graph,
              workspace.root.domInputs,
              part(binding).id,
              "all",
            ),
          ).not.toBeNull();
        }
        write({ description: "", isInvalid: false });
        expect(part("description").hidden).toBe(true);
        expect(part("fielderror").hidden).toBe(true);
        // The DOM: the same nodes' elements, with the origin's color.
        write({ description: "Help text", isInvalid: true });
        const html = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        for (const binding of ["description", "fielderror"]) {
          const id = part(binding).id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expect(html).toMatch(
            new RegExp(
              `<span[^>]*data-catalog-id="${id}"[^>]*style="[^"]*color:\\s*#0000ff`,
            ),
          );
        }
      },
    );

  /**
   * The control (Input): an instance of the Input origin, drawn in the DOM by its own node — a RAC
   * Input inside the field's context. Its box is the Input rule's sheet at the field's size
   * (`data-size`); the element's inline style carries only what the document wrote.
   */
  for (const type of INPUT_TYPES)
    it.skipIf(write)(`${type} — its control is its Input node`, async () => {
      const rendered = (await render(type, {}))!;
      const { workspace, field } = rendered;
      const input = () =>
        workspace.root.canvasInputs
          .get(field.id)!
          .children.map((id) => workspace.root.canvasInputs.get(id)!)
          .find((child) => child.ruleId === "Input")!;
      const element = (html: string) => {
        const host = document.createElement("div");
        host.innerHTML = html;
        return host.querySelector<HTMLElement>(
          `[data-catalog-id="${input().id}"]`,
        )!;
      };
      const html = () =>
        renderToStaticMarkup(renderCatalogDom(workspace.root, field.id));
      expect(input().collapsedSourceIds).toEqual([
        "lib:template:component-input",
      ]);
      // The element: the control RAC wires to the field (id ← the Label's `for`), sized by the
      // rule's sheet — no resolved box inline.
      const control = element(html());
      expect(control.tagName).toBe(type === "textarea" ? "TEXTAREA" : "INPUT");
      expect(control.getAttribute("data-size")).toBe("md");
      expect(control.getAttribute("style") ?? "").not.toMatch(
        /padding|border|background|font-size/,
      );
      // The Input rule sizes it at the field's size (no field rule declares an Input shape).
      expect(input().props.size).toBe("md");
      expect(input().visual).toMatchObject({
        paddingY: 4,
        paddingX: 12,
        fontSize: 14,
        radius: 6,
        borderWidth: 1,
      });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("lg") },
        }),
      );
      expect(input().props.size).toBe("lg");
      expect(input().visual).toMatchObject({
        paddingY: 8,
        paddingX: 16,
        fontSize: 16,
        radius: 8,
      });
      expect(
        Number(input().visual.lineHeight) * Number(input().visual.fontSize),
      ).toBeCloseTo(24, 5);
      expect(element(html()).getAttribute("data-size")).toBe("lg");
      // The Input origin is the one place its style comes from — a second edit as well — and it
      // reaches the element as inline style over the sheet.
      for (const color of ["#ff0000", "#0000ff"]) {
        workspace.execute(
          setLibraryDefault({
            definitionId: INPUT_ORIGIN,
            scope: "visual",
            key: "borderColor",
            write: set(color),
            newId: workspace.newId,
          }),
        );
        expect(input().visual.borderColor).toBe(color);
        expect(
          workspace.root.domInputs.get(input().id)!.visual.borderColor,
        ).toBe(color);
      }
      expect(element(html()).getAttribute("style")).toMatch(
        /border-color:\s*#0000ff/,
      );
      // Its style is its own to edit; its text (placeholder · type) is the field's.
      const graph = workspace.runtime.graph;
      const records = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, records, input().id, "style"),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(graph, records, input().id, "all"),
      ).not.toBeNull();
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(input().id)!.target],
          visual: { borderColor: set("#00aa00") },
        }),
      );
      expect(input().visual.borderColor).toBe("#00aa00");
      expect(element(html()).getAttribute("style")).toMatch(
        /border-color:\s*#00aa00/,
      );
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#123456"),
          newId: workspace.newId,
        }),
      );
      expect(input().visual.borderColor).toBe("#00aa00");
    });

  /**
   * A NumberField's control: the Group (the wrapper node — placement only) holds an instance of the
   * Input origin and two instances of the Button origin, each drawn in the DOM by its own node
   * inside the field's RAC context. The steppers keep what that context gives them (their slot's
   * press handlers, disabled at the value's limit or with the field).
   */
  it.skipIf(write)(
    "numberfield — its Group holds an Input instance and two Button instances",
    async () => {
      const { workspace, field } = (await render("numberfield", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "Group")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const html = () =>
        renderToStaticMarkup(renderCatalogDom(workspace.root, field.id));
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = html();
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      // The wrapper paints nothing; its parts are the origins' instances.
      expectPaintsNothing(wrapper().visual);
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Input",
        "Button",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        ["lib:template:component-input"],
        ["lib:template:component-button"],
        ["lib:template:component-button"],
      ]);
      const [input, decrement, increment] = parts();
      // Canvas: the Input fills the Group; a stepper is as wide as the control is high and
      // overlaps its neighbour's border by 1px; its glyph (an Icon node) is centered in it.
      const group = rect(wrapper().id);
      expect(group.height).toBe(30);
      expect(rect(input.id)).toMatchObject({ height: 30 });
      for (const stepper of [decrement, increment]) {
        expect(rect(stepper.id)).toMatchObject({ width: 30, height: 30 });
        expect(stepper.props).toMatchObject({
          variant: "secondary",
          size: "md",
        });
        const glyph = records.get(stepper.children[0]!)!;
        expect(typeOf(glyph.id)).toBe("Icon");
        expect(glyph.visual.iconSize).toBe(18);
        // (A record's box is from its parent's.)
        const icon = rect(glyph.id);
        expect(icon).toMatchObject({ x: 6, width: 18 });
        expect(icon.y * 2 + icon.height).toBe(30);
      }
      expect(rect(decrement.id).x).toBe(
        rect(input.id).x + rect(input.id).width - 1,
      );
      expect(rect(increment.id).x + 30).toBe(group.width);
      // The square corners on the touching sides are written on the template positions.
      expect(input.visual).toMatchObject({
        radius: 6,
        radiusTopRight: 0,
        radiusBottomRight: 0,
      });
      expect(decrement.visual.radius).toBe(0);
      expect(increment.visual).toMatchObject({
        radiusTopLeft: 0,
        radiusBottomLeft: 0,
      });
      // DOM: the Group's children are those nodes' elements, in order.
      const groupElement = host().querySelector(".react-aria-Group")!;
      expect(
        [...groupElement.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const stepperElements = () => [
        ...host().querySelectorAll<HTMLElement>(".react-aria-Group > button"),
      ];
      expect(stepperElements().map((button) => button.slot)).toEqual([
        "decrement",
        "increment",
      ]);
      for (const button of stepperElements()) {
        expect(button.getAttribute("data-variant")).toBe("secondary");
        expect(button.getAttribute("data-size")).toBe("md");
        expect(button.querySelector(".react-aria-Icon svg")).not.toBeNull();
      }
      // Their paint is the Button rule's sheet (hover · pressed · disabled change it): no rest
      // color inline.
      for (const button of stepperElements())
        expect(button.getAttribute("style") ?? "").not.toMatch(
          /background-color|border-color|(^|;)color:/,
        );
      // RAC's context reaches them (nothing the document did not write is passed): the value 0 is
      // the minimum — decrease is disabled, increase is not; a disabled field disables both.
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([true, false]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { minValue: set(-5) as never, isDisabled: set(false) },
        }),
      );
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([false, false]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(true) },
        }),
      );
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([true, true]);
      // A disabled field fades once, at its root (as the Canvas draws it): its steppers keep
      // their rest paint and do not fade again.
      for (const button of stepperElements()) {
        expect(button.getAttribute("style")).toMatch(
          /background-color:\s*#fafafa/,
        );
        expect(button.getAttribute("style")).toMatch(/opacity:\s*1(;|$)/);
      }
      expect(parts().map((part) => part.visual.opacity)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      // The field's size reaches the parts through the wrapper.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl"), isDisabled: set(false) },
        }),
      );
      expect(parts().map((part) => part.props.size)).toEqual([
        "xl",
        "xl",
        "xl",
      ]);
      expect(rect(parts()[1]!.id)).toMatchObject({ width: 54, height: 54 });
      expect(records.get(parts()[1]!.children[0]!)!.visual.iconSize).toBe(28);
      expect(rect(parts()[0]!.id).height).toBe(54);
      // The origins are where their style comes from: the Button origin's reaches the steppers,
      // the Input origin's the value — on the Canvas and in the DOM.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(
        parts().map((part) => part.visual.fill ?? part.visual.borderColor),
      ).toEqual(["#0000ff", "#ff0000", "#ff0000"]);
      for (const button of stepperElements())
        expect(button.getAttribute("style")).toMatch(
          /--button-color:\s*#ff0000/,
        );
      expect(
        host()
          .querySelector(".react-aria-Group > input")!
          .getAttribute("style"),
      ).toMatch(/border-color:\s*#0000ff/);
      // The Input's text (placeholder · type) is the field's; its style and a stepper's are their
      // own; the wrapper stays the field's.
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "all")).toBe(
        "NumberField",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, wrapper().id, "style")).toBe(
        "NumberField",
      );
    },
  );

  /**
   * A ComboBox's control: the container (the wrapper node — placement only) holds an instance of
   * the Input origin, which draws the box with room for the button at its end, and an instance of
   * the FieldButton origin (an instance of the Button origin with the field button's shape) laid
   * over that room. Both are drawn in the DOM by their own nodes inside the ComboBox's context.
   */
  it.skipIf(write)(
    "combobox — its container holds an Input instance and a FieldButton instance",
    async () => {
      const { workspace, field } = (await render("combobox", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "Group")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      expectPaintsNothing(wrapper().visual);
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Input",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        ["lib:template:component-input"],
        ["lib:template:component-fieldbutton", "lib:template:component-button"],
      ]);
      const [input, button] = parts();
      // Canvas: the Input is the whole control; the button is a square 4px inside its end.
      const group = rect(wrapper().id);
      expect(rect(input.id)).toMatchObject({
        x: 0,
        width: group.width,
        height: 30,
      });
      expect(input.visual).toMatchObject({ paddingX: 12, paddingRight: 34 });
      // (The end padding keeps the text clear of the button; its start stays the Input's own.)
      expect(inputTextBand(workspace, input.id)).toEqual({
        x: 12,
        paddingRight: 34,
      });
      expect(rect(button.id)).toMatchObject({
        x: group.width - 26,
        y: 4,
        width: 22,
        height: 22,
      });
      expect(button.visual).toMatchObject({
        fill: "var(--accent-subtle)",
        borderWidth: 0,
        radius: 4,
      });
      const glyph = records.get(button.children[0]!)!;
      expect(glyph.props.iconName).toBe("chevron-down");
      expect(rect(glyph.id)).toMatchObject({ x: 2, y: 2, width: 18 });
      // The field's `placeholder` and `iconName` reach the parts (template bindings).
      expect(input.props.placeholder).toBe("Type or select...");
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("Pick one"), iconName: set("search") },
        }),
      );
      expect(parts()[0]!.props.placeholder).toBe("Pick one");
      expect(records.get(parts()[1]!.children[0]!)!.props.iconName).toBe(
        "search",
      );
      // DOM: the container's children are those nodes' elements; the Input is the combobox RAC
      // wires, the button its trigger. The button's authored fill is the sheet's own variable,
      // so its hover and pressed colors derive from it.
      const container = host().querySelector(
        ".combobox-container:not(template *)",
      )!;
      expect(
        [...container.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const inputElement = container.querySelector("input")!;
      expect(inputElement.getAttribute("role")).toBe("combobox");
      expect(inputElement.getAttribute("placeholder")).toBe("Pick one");
      expect(inputElement.getAttribute("data-size")).toBe("md");
      const buttonElement = container.querySelector("button")!;
      expect(buttonElement.getAttribute("aria-haspopup")).toBe("listbox");
      const style = buttonElement.getAttribute("style")!;
      expect(style).toMatch(/--button-color:\s*var\(--accent-subtle\)/);
      expect(style).toMatch(/--button-color-hover:\s*initial/);
      expect(style).not.toMatch(/background-color|border-color/);
      // (The sheet gives every Button a border: the one the FieldButton removes is written out.)
      expect(style).toMatch(/border-width:\s*0(;|$)/);
      // The field's size reaches the parts.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(parts().map((part) => part.props.size)).toEqual(["xl", "xl"]);
      expect(rect(parts()[1]!.id)).toMatchObject({
        width: 46,
        height: 46,
        y: 4,
      });
      expect(parts()[0]!.visual.paddingRight).toBe(70);
      // The FieldButton origin is where the button's shape comes from; it is itself an instance
      // of the Button origin, whose style reaches it under the FieldButton's own.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-fieldbutton" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "color",
          write: set("#00aa00"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(parts()[1]!.visual).toMatchObject({
        fill: "#ff0000",
        color: "#00aa00",
      });
      const edited = host()
        .querySelector(".combobox-container:not(template *) button")!
        .getAttribute("style")!;
      expect(edited).toMatch(/--button-color:\s*#ff0000/);
      expect(edited).toMatch(/--button-text:\s*#00aa00/);
      // Edit axes: the Input's text is the field's, its style and the button's are their own.
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "all")).toBe(
        "ComboBox",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
    },
  );

  /**
   * A Select's control: RAC's trigger is the Button itself, so the trigger node is an instance of
   * the Button origin (secondary) — its paint and states are the Button rule's — holding the value
   * (RAC `SelectValue`, the field's own sub-part) and the glyph (an Icon node). The field places
   * it: full width, a smaller end padding beside the glyph, the value ↔ glyph gap.
   */
  it.skipIf(write)(
    "select — its trigger is a Button instance holding the value and the glyph",
    async () => {
      const { workspace, field } = (await render("select", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const trigger = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "Button")!;
      const parts = () => trigger().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      expect(trigger().collapsedSourceIds).toEqual([
        "lib:template:component-button",
      ]);
      expect(trigger().props).toMatchObject({ variant: "secondary" });
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "SelectValue",
        "Icon",
      ]);
      // Canvas: the trigger fills the field; the value fills the trigger up to the glyph, 4px
      // before it; the glyph sits 8px inside the end (the Button's own padding at the start).
      const width = rect(field.id).width;
      expect(rect(trigger().id)).toMatchObject({ x: 0, width });
      expect(trigger().visual).toMatchObject({
        width: "100%",
        minWidth: 0,
        paddingX: 12,
        paddingRight: 8,
        gap: 4,
        borderWidth: 1,
      });
      const [value, glyph] = parts();
      expect(rect(glyph.id)).toMatchObject({
        x: width - 1 - 8 - 18,
        width: 18,
        height: 18,
      });
      expect(rect(value.id)).toMatchObject({
        x: 13,
        width: width - 13 - 4 - 18 - 8 - 1,
      });
      expect(value.visual.fontSize).toBe(14);
      // (The value keeps its own weight: it does not take the trigger Button's 500.)
      expect(value.visual.fontWeight).toBe(400);
      // The field's `placeholder` and `iconName` reach the parts (template bindings — the value's
      // text; its own `placeholder` prop went 2026-10-09: RAC reads the Select's).
      expect(value.props).toMatchObject({
        children: "Choose an option...",
      });
      expect(glyph.props.iconName).toBe("chevron-down");
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("Pick one"), iconName: set("search") },
        }),
      );
      expect(parts()[0]!.props).toMatchObject({
        children: "Pick one",
      });
      expect(parts()[1]!.props.iconName).toBe("search");
      // DOM: the trigger element is the Button node's (RAC wires it as the Select's trigger); its
      // children are the value (RAC `SelectValue` — RAC writes the placeholder) and the glyph.
      const button = () => host().querySelector(".react-aria-Select > button")!;
      expect(button().getAttribute("data-catalog-id")).toBe(trigger().id);
      expect(button().getAttribute("aria-haspopup")).toBe("listbox");
      expect(button().className).toContain("button-base");
      expect(button().getAttribute("data-variant")).toBe("secondary");
      expect(
        [...button().children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const valueElement = button().querySelector(".react-aria-SelectValue")!;
      expect(valueElement.textContent).toBe("Pick one");
      expect(valueElement.hasAttribute("data-placeholder")).toBe(true);
      // (Its color is the trigger's, the placeholder paint the field sheet's: nothing inline.)
      expect(valueElement.getAttribute("style")).not.toMatch(/(^|;)\s*color:/);
      expect(valueElement.getAttribute("style")).toMatch(/font-weight:\s*400/);
      const style = button().getAttribute("style")!;
      expect(style).toMatch(/(^|;)width:\s*100%/);
      expect(style).toMatch(/padding-right:\s*8px/);
      expect(style).toMatch(/column-gap:\s*4px/);
      // (A Button's rest paint is its sheet's: hover, pressed and focus are the Button rule's.)
      expect(style).not.toMatch(/background-color|border-color|opacity/);
      // A disabled field: RAC disables the trigger; the root fades once.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(true) },
        }),
      );
      expect(button().hasAttribute("disabled")).toBe(true);
      expect(button().getAttribute("style")).toMatch(/opacity:\s*1(;|$)/);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(false) },
        }),
      );
      // The value's style is the node's own (the DOM draws that node): a style written on it
      // reaches the Canvas record and the DOM element. Only its text is the Select's.
      const valueId = parts()[0]!.id;
      expect(
        catalogSubpartOwnerType(
          workspace.runtime.graph,
          workspace.root.domInputs,
          valueId,
          "style",
        ),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(
          workspace.runtime.graph,
          workspace.root.domInputs,
          valueId,
          "all",
        ),
      ).toBe("Select");
      const writeValueSize = (fontSize: number | undefined) =>
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(valueId)!.target],
            visual: {
              fontSize:
                fontSize === undefined
                  ? { kind: "remove" as const }
                  : set(fontSize),
            },
          }),
        );
      writeValueSize(20);
      expect(parts()[0]!.visual.fontSize).toBe(20);
      expect(
        button()
          .querySelector(".react-aria-SelectValue")!
          .getAttribute("style"),
      ).toMatch(/font-size:\s*20px/);
      writeValueSize(undefined);
      expect(parts()[0]!.visual.fontSize).toBe(14);
      // The field's size reaches the trigger, and through it the glyph; the value follows the
      // field's size.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(trigger().props.size).toBe("xl");
      expect(trigger().visual).toMatchObject({
        paddingX: 24,
        paddingRight: 16,
      });
      expect(parts()[0]!.visual.fontSize).toBe(18);
      expect(parts()[1]!.visual.iconSize).toBe(28);
      // The Button origin is where the trigger's shape comes from.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(trigger().visual.fill).toBe("#0000ff");
      expect(button().getAttribute("style")).toMatch(
        /--button-color:\s*#0000ff/,
      );
      // Edit axes: the trigger is its own (an instance); so is the value's style (above).
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, trigger().id, "style"),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(graph, dom, trigger().id, "all"),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style"),
      ).toBeNull();
    },
  );

  /**
   * The date fields' control (ADR-253): the box is an instance of the DateInput origin — its
   * shape, size steps, states and RAC segments are the DateInput rule's. A DateField · TimeField
   * holds it directly; a DatePicker's Group (placement only) holds it with a FieldButton instance
   * laid over its end; a DateRangePicker's Group is the box, holding RAC's start/end pair (two
   * instances whose template positions carry no box) around a separator and a FieldButton.
   */
  it.skipIf(write)(
    "date fields — the box is a DateInput instance; a picker's button a FieldButton instance",
    async () => {
      const open = async (type: string) => {
        const { workspace, field } = (await render(type, {}))!;
        const records = workspace.root.canvasInputs;
        const typeOf = (id: string) =>
          workspace.runtime.graph.getDefinition(
            records.get(id)!.definitionId as LibraryDefinitionId,
          )!.name;
        const children = (id: string) =>
          records.get(id)!.children.map((child) => records.get(child)!);
        const wrapper = () =>
          children(field.id).find((child) => typeOf(child.id) === "Group")!;
        const host = () => {
          const element = document.createElement("div");
          element.innerHTML = renderToStaticMarkup(
            renderCatalogDom(workspace.root, field.id),
          );
          return element;
        };
        const rect = (id: string) =>
          workspace.root.getGeometry([id]).get(id) as {
            x: number;
            y: number;
            width: number;
            height: number;
          };
        const hidden = (id: string) =>
          (workspace.root.layoutInputs.get(id) as { hidden?: boolean })
            .hidden === true;
        return {
          workspace,
          field,
          records,
          typeOf,
          children,
          wrapper,
          host,
          rect,
          hidden,
        };
      };
      const setField = (
        workspace: CatalogWorkspace,
        props: Record<string, string | boolean>,
      ) =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: FIELD }],
            props: Object.fromEntries(
              Object.entries(props).map(([key, value]) => [key, set(value)]),
            ),
          }),
        );

      // DateField · TimeField: the DateInput node is the control.
      for (const type of ["datefield", "timefield"]) {
        const scene = await open(type);
        const input = () =>
          scene
            .children(scene.field.id)
            .find((child) => scene.typeOf(child.id) === "DateInput")!;
        expect(input().collapsedSourceIds).toEqual([
          "lib:template:component-dateinput",
        ]);
        expect(scene.rect(input().id)).toMatchObject({
          x: 0,
          width: scene.rect(scene.field.id).width,
        });
        expect(input().visual).toMatchObject({
          paddingX: 12,
          paddingY: 4,
          borderWidth: 1,
          radius: 6,
          minWidth: 150,
        });
        // DOM: the RAC DateInput is the node's element, sized by its `data-size`; its box is the
        // DateInput rule's sheet (nothing inline, no `inset` utility class).
        const element = scene
          .host()
          .querySelector(".react-aria-DateInput:not(template *)")!;
        expect(element.getAttribute("data-catalog-id")).toBe(input().id);
        expect(element.getAttribute("data-size")).toBe("md");
        expect(element.getAttribute("role")).toBe("group");
        expect(element.className).toBe("react-aria-DateInput");
        expect(element.getAttribute("style")).not.toMatch(
          /background|border|padding/,
        );
        expect(
          element.querySelectorAll(".react-aria-DateSegment").length,
        ).toBeGreaterThan(2);
        // The field's size reaches it.
        setField(scene.workspace, { size: "xl" });
        expect(input().props.size).toBe("xl");
        expect(input().visual).toMatchObject({ paddingX: 24, minWidth: 220 });
        // The DateInput origin is where its shape comes from.
        scene.workspace.execute(
          setLibraryDefault({
            definitionId:
              "lib:definition:origin-component-dateinput" as LibraryDefinitionId,
            scope: "visual",
            key: "borderColor",
            write: set("#0000ff"),
            newId: scene.workspace.newId,
          }),
        );
        expect(input().visual.borderColor).toBe("#0000ff");
        expect(
          scene
            .host()
            .querySelector(".react-aria-DateInput:not(template *)")!
            .getAttribute("style"),
        ).toMatch(/border-color:\s*#0000ff/);
        // Edit axes: the box is its own (an instance).
        expect(
          catalogSubpartOwnerType(
            scene.workspace.runtime.graph,
            scene.workspace.root.domInputs,
            input().id,
            "style",
          ),
        ).toBeNull();
      }

      // DatePicker: the Group places; the DateInput instance is the box, the FieldButton
      // instance a square 4px inside its end.
      const picker = await open("datepicker");
      expectPaintsNothing(picker.wrapper().visual);
      const pickerParts = () => picker.children(picker.wrapper().id);
      expect(pickerParts().map((part) => picker.typeOf(part.id))).toEqual([
        "DateInput",
        "Button",
      ]);
      expect(pickerParts().map((part) => part.collapsedSourceIds)).toEqual([
        ["lib:template:component-dateinput"],
        ["lib:template:component-fieldbutton", "lib:template:component-button"],
      ]);
      const group = picker.rect(picker.wrapper().id);
      expect(picker.rect(pickerParts()[0]!.id)).toMatchObject({
        x: 0,
        width: group.width,
      });
      expect(pickerParts()[0]!.visual).toMatchObject({
        paddingX: 12,
        paddingRight: 34,
        borderWidth: 1,
      });
      expect(picker.rect(pickerParts()[1]!.id)).toMatchObject({
        x: group.width - 26,
        width: 22,
        height: 22,
      });
      const pickerGlyph = () =>
        picker.records.get(pickerParts()[1]!.children[0]!)!;
      expect(pickerGlyph().props.iconName).toBe("calendar");
      setField(picker.workspace, { iconName: "clock" });
      expect(pickerGlyph().props.iconName).toBe("clock");
      const pickerGroup = () =>
        picker.host().querySelector(".react-aria-Group:not(template *)")!;
      expect(
        [...pickerGroup().children]
          .map((child) => child.getAttribute("data-catalog-id"))
          .filter(Boolean),
      ).toEqual(pickerParts().map((part) => part.id));
      expect(
        pickerGroup().querySelector("button")!.getAttribute("aria-haspopup"),
      ).toBe("dialog");
      // (No `showCalendarIcon` — 2026-10-09: the calendar button is the Button node itself.)
      expect(picker.hidden(pickerParts()[1]!.id)).toBe(false);

      // DateRangePicker: the Group is the box; the pair carries none.
      const range = await open("daterangepicker");
      expect(range.wrapper().visual).toMatchObject({
        borderWidth: 1,
        paddingLeft: 12,
        paddingRight: 3,
        paddingTop: 3,
      });
      expect(range.wrapper().visual.fill).not.toBe("transparent");
      const rangeParts = () => range.children(range.wrapper().id);
      expect(rangeParts().map((part) => range.typeOf(part.id))).toEqual([
        "DateInput",
        "Text",
        "DateInput",
        "Button",
      ]);
      const [start, separator, end, button] = rangeParts();
      expect([start.props.slot, end.props.slot]).toEqual(["start", "end"]);
      for (const part of [start, end])
        expect(part.visual).toMatchObject({
          fill: "transparent",
          borderWidth: 0,
          paddingX: 0,
          paddingY: 0,
          width: "auto",
        });
      expect(separator.props.children).toBe("–");
      expect(separator.visual).toMatchObject({
        color: "var(--fg-muted)",
        paddingX: 4,
        fontSize: 14,
      });
      // The end input takes the free space up to the button, 3px inside the Group's end.
      expect(end.layout).toMatchObject({ flexGrow: "1" });
      expect(start.layout.flexGrow).toBeUndefined();
      const rangeBox = range.rect(range.wrapper().id);
      expect(rangeBox.height).toBe(30);
      expect(range.rect(button.id)).toMatchObject({
        x: rangeBox.width - 1 - 3 - 22,
        y: 4,
        width: 22,
        height: 22,
      });
      const rangeGroup = range
        .host()
        .querySelector(".react-aria-Group:not(template *)")!;
      expect(
        [...rangeGroup.children]
          .map((child) => child.getAttribute("data-catalog-id"))
          .filter(Boolean),
      ).toEqual(rangeParts().map((part) => part.id));
      expect(
        [...rangeGroup.querySelectorAll(".react-aria-DateInput")].map(
          (element) => element.getAttribute("slot"),
        ),
      ).toEqual(["start", "end"]);
      expect(rangeGroup.querySelector(".react-aria-Text")!.textContent).toBe(
        "–",
      );
      // The field's size reaches the Group and through it the parts.
      setField(range.workspace, { size: "xl" });
      expect(rangeParts().map((part) => part.props.size)).toEqual([
        "xl",
        "xl",
        "xl",
        "xl",
      ]);
      expect(range.rect(rangeParts()[3]!.id)).toMatchObject({
        width: 46,
        height: 46,
      });
    },
  );

  /**
   * A SearchField's control: the container (the wrapper node — placement only) holds the search
   * glyph (an Icon node laid over the Input's start), an instance of the Input origin (the box —
   * rounded here) and the clear button, an instance of the Button origin laid over the Input's
   * end. The clear button shows while the field has a value (RAC's `data-empty`).
   */
  it.skipIf(write)(
    "searchfield — its container holds the glyph, an Input instance and a Button instance",
    async () => {
      const { workspace, field } = (await render("searchfield", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "Group")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      const layoutRecord = (id: string) =>
        workspace.root.layoutInputs.get(id) as { hidden?: boolean };
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Icon",
        "Input",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        undefined,
        ["lib:template:component-input"],
        ["lib:template:component-button"],
      ]);
      const [glyph, input, clear] = parts();
      // Canvas: the Input is the whole control, rounded, with room at both ends; the glyph sits
      // 8px inside its start, over it.
      const group = rect(wrapper().id);
      expect(rect(input.id)).toMatchObject({
        x: 0,
        width: group.width,
        height: 30,
      });
      expect(input.visual).toMatchObject({
        radius: 9999,
        paddingLeft: 32,
        paddingRight: 32,
      });
      // (Its text starts after that padding, clear of the glyph — as the DOM `padding-left` does.)
      expect(inputTextBand(workspace, input.id)).toEqual({
        x: 32,
        paddingRight: 32,
      });
      expect(rect(glyph.id)).toMatchObject({
        x: 8,
        y: 7,
        width: 16,
        height: 16,
      });
      expect(glyph.visual).toMatchObject({ iconSize: 16, zIndex: 1 });
      // An empty field shows no clear button (RAC `data-empty`); with a value it is a 16px
      // circle 8px inside the Input's end.
      expect(layoutRecord(clear.id).hidden).toBe(true);
      expect(input.derivedProps).toBeUndefined();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("abc"), placeholder: set("Find") },
        }),
      );
      // The Canvas draws the value in the Input's text (the DOM input shows it over the
      // placeholder); emptied, the placeholder is back.
      expect(parts()[1]!.derivedProps).toEqual({ placeholder: "abc" });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("") },
        }),
      );
      expect(parts()[1]!.derivedProps).toBeUndefined();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("abc") },
        }),
      );
      expect(parts()[1]!.derivedProps).toEqual({ placeholder: "abc" });
      const shown = parts()[2]!;
      expect(layoutRecord(shown.id).hidden).not.toBe(true);
      expect(rect(shown.id)).toMatchObject({
        x: group.width - 24,
        y: 7,
        width: 16,
        height: 16,
      });
      expect(shown.visual).toMatchObject({
        fill: "var(--fg-muted)",
        radius: 9999,
        borderWidth: 0,
      });
      expect(records.get(shown.children[0]!)!.visual.iconSize).toBe(12);
      expect(parts()[1]!.props.placeholder).toBe("Find");
      // DOM: the container's children are those nodes' elements; the Input is the searchbox RAC
      // wires (its `type` is RAC's), the Button the clear button RAC labels.
      const container = host().querySelector(".searchfield-container")!;
      expect(
        [...container.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const inputElement = container.querySelector("input")!;
      expect(inputElement.getAttribute("type")).toBe("search");
      expect(inputElement.getAttribute("placeholder")).toBe("Find");
      expect(inputElement.getAttribute("value")).toBe("abc");
      expect(inputElement.getAttribute("style")).toMatch(
        /border-radius:\s*9999px/,
      );
      const clearElement = container.querySelector("button")!;
      expect(clearElement.getAttribute("aria-label")).toBeTruthy();
      expect(clearElement.getAttribute("style")).toMatch(
        /--button-color:\s*var\(--fg-muted\)/,
      );
      // The field's sheet hides the clear button while the input is empty (`[data-empty]`, RAC's
      // run state): an inline display would keep it shown.
      expect(clearElement.getAttribute("style")).not.toMatch(
        /(^|;)\s*display:/,
      );
      // The Canvas reads the same color: `--fg-muted` is the `neutral-subdued` token's variable.
      expect(cssVarColor("var(--fg-muted)", "light")).toMatch(
        /^#[0-9a-f]{6}$/i,
      );
      expect(cssVarColor("var(--fg-muted)", "dark")).toMatch(/^#[0-9a-f]{6}$/i);
      expect(
        container.querySelector(".react-aria-Icon")!.getAttribute("style"),
      ).toMatch(/z-index:\s*1/);
      // The field's size reaches the parts.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(parts()[1]!.props.size).toBe("xl");
      expect(parts()[1]!.visual).toMatchObject({
        paddingLeft: 52,
        paddingRight: 52,
      });
      expect(rect(parts()[0]!.id)).toMatchObject({ x: 16, width: 22 });
      expect(rect(parts()[2]!.id)).toMatchObject({ width: 24, height: 24 });
      // The Input origin and the Button origin reach them (the Button's own shape stays).
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "color",
          write: set("#00aa00"),
          newId: workspace.newId,
        }),
      );
      expect(parts()[1]!.visual.borderColor).toBe("#0000ff");
      expect(parts()[2]!.visual).toMatchObject({
        color: "#00aa00",
        fill: "var(--fg-muted)",
      });
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "all")).toBe(
        "SearchField",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
    },
  );

  /**
   * A Button's paint is its rule's sheet, which changes it by state: the rest colors go inline
   * only when the document wrote them, or while the document disables the Button (the Canvas
   * draws a disabled Button at its rest paint, faded).
   */
  it.skipIf(write)(
    "button — its rest paint is the sheet's, inline only when authored or disabled",
    async () => {
      const style = async (authored: Record<string, string | boolean>) => {
        const { html } = (await render("button", authored))!;
        const host = document.createElement("div");
        host.innerHTML = html;
        return host.querySelector("button")!.getAttribute("style") ?? "";
      };
      const paint = /background-color|border-color|(^|;)color:/;
      expect(await style({})).not.toMatch(paint);
      expect(await style({ variant: "secondary" })).not.toMatch(paint);
      expect(await style({ fillStyle: "outline" })).not.toMatch(paint);
      expect(await style({ isDisabled: true })).toMatch(
        /background-color:\s*#171717/,
      );
      // An origin override is the document's: inline over the sheet.
      const { workspace, field } = (await render("button", {}))!;
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field.id),
      );
      const overridden = host.querySelector("button")!.getAttribute("style")!;
      // (As the sheet's own variable: its hover and pressed colors derive from it.)
      expect(overridden).toMatch(/--button-color:\s*#ff0000/);
      expect(overridden).toMatch(/--button-color-hover:\s*initial/);
      expect(overridden).not.toMatch(/background-color|border-color/);
    },
  );

  /**
   * An Input's height is its content: one line box + padding + border — with or without text
   * (the DOM `<input>` keeps its line box when it has no value and no placeholder).
   */
  it.skipIf(write)(
    "textfield — its Input keeps its line box without a placeholder",
    async () => {
      const { workspace, field } = (await render("textfield", {}))!;
      const height = () => {
        const input = workspace.root.canvasInputs
          .get(field.id)!
          .children.map((id) => workspace.root.canvasInputs.get(id)!)
          .find((child) => child.ruleId === "Input")!;
        return workspace.root.getGeometry([input.id]).get(input.id)!.height;
      };
      expect(height()).toBe(30);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("") },
        }),
      );
      expect(height()).toBe(30);
    },
  );

  /** A TextArea's Input node is its `<textarea rows>`: the field's `rows`, on both sides. */
  it.skipIf(write)("textarea — its rows size its Input node", async () => {
    const { workspace, field } = (await render("textarea", {}))!;
    const input = () =>
      workspace.root.canvasInputs
        .get(field.id)!
        .children.map((id) => workspace.root.canvasInputs.get(id)!)
        .find((child) => child.ruleId === "Input")!;
    const rows = () =>
      /<textarea[^>]*rows="(\d+)"/.exec(
        renderToStaticMarkup(renderCatalogDom(workspace.root, field.id)),
      )?.[1];
    // 3 rows × 20 + padding 8 + border 2.
    expect(input().visual.height).toBe(70);
    expect(rows()).toBe("3");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: { rows: set(5) },
      }),
    );
    expect(input().visual.height).toBe(110);
    expect(rows()).toBe("5");
  });

  /**
   * A side label field places its hints under the control: the label column's width plus the
   * field's gap, as the field's rule declares (`margin-inline-start: calc(label width + gap)`).
   * The Canvas lays the part out with it and the DOM element carries it (the text reset would
   * otherwise win over the field's stylesheet).
   */
  for (const [type, indent] of Object.entries(SIDE_INDENT))
    it.skipIf(write)(
      `${type} — side label: its hints are indented under the control`,
      async () => {
        const { workspace, field } = (await render(type, {
          labelPosition: "side",
          description: "Help text",
          isInvalid: true,
          errorMessage: "Not valid",
        }))!;
        const html = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        for (const binding of ["description", "fielderror"]) {
          const part = workspace.root.canvasInputs
            .get(field.id)!
            .children.map((id) => workspace.root.canvasInputs.get(id)!)
            .find((child) => child.bindingId === binding)!;
          expect(part.layout.marginLeft).toBe(`${indent}px`);
          expect(part.layout.flexBasis).toBe("100%");
          const id = part.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expect(html).toMatch(
            new RegExp(
              `<span[^>]*data-catalog-id="${id}"[^>]*style="[^"]*margin-left:${indent}px`,
            ),
          );
        }
      },
    );

  /**
   * A quiet field (RSP `isQuiet`): the part that draws its box — its Input / DateInput instance —
   * carries the quiet state (`data-quiet`, the part rule's `&[data-quiet]`), and follows the
   * field's prop. (A DateRangePicker takes no `isQuiet` — S2 has none.)
   */
  for (const [type, quiet] of Object.entries(QUIET_BOX_PARTS))
    it.skipIf(write)(
      `${type} — quiet: its box part ${quiet ? "carries" : "does not carry"} the quiet state`,
      async () => {
        const { workspace, field } = (await render(type, {}))!;
        const boxes = () => {
          const host = document.createElement("div");
          host.innerHTML = renderToStaticMarkup(
            renderCatalogDom(workspace.root, field.id),
          );
          return [
            ...host.querySelectorAll(
              "input[data-catalog-id], textarea[data-catalog-id], .react-aria-DateInput[data-catalog-id]",
            ),
          ];
        };
        const setQuiet = (value: boolean) =>
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: { isQuiet: set(value) },
            }),
          );
        expect(boxes().length).toBeGreaterThan(0);
        expect(boxes().filter((box) => box.hasAttribute("data-quiet"))).toEqual(
          [],
        );
        // The part's DOM record follows the field's prop (its element is re-rendered).
        let notified = 0;
        const stop = boxes().map((box) =>
          workspace.root.subscribeDom(
            box.getAttribute("data-catalog-id")!,
            () => notified++,
          ),
        );
        const shapes = (state?: StateName) =>
          boxes().map((box) => {
            const part = workspace.root.canvasInputs.get(
              box.getAttribute("data-catalog-id")!,
            )!;
            return catalogRuleShapes({
              node: { ...part, props: { ...part.props, ...part.derivedProps } },
              rect: { width: 200, height: 32 },
              rule: workspace.runtime.graph.library.rules.get(part.ruleId!)!,
              type: part.ruleId!,
              authoredVisual: catalogAuthoredVisual(workspace.root, part),
              state,
            });
          });
        const plainShapes = shapes();
        setQuiet(true);
        if (quiet)
          for (const drawn of shapes()) {
            expect(drawn.filter((s) => s.type === "border")).toEqual([]);
            expect(
              drawn.filter(
                (s) => s.type === "roundRect" && s.fill !== "transparent",
              ),
            ).toEqual([]);
            expect(
              drawn.some(
                (s) =>
                  s.type === "line" &&
                  s.y1 === 31.5 &&
                  s.y2 === 31.5 &&
                  s.strokeWidth === 1,
              ),
            ).toBe(true);
          }
        else expect(shapes()).toEqual(plainShapes);
        expect(boxes().map((box) => box.getAttribute("data-quiet"))).toEqual(
          boxes().map(() => (quiet ? "true" : null)),
        );
        expect(notified > 0).toBe(quiet);
        // The quiet state draws the corners (square): a rest radius the document wrote on the
        // part — a SearchField's pill — is not inline while it is quiet.
        if (type === "searchfield")
          expect(boxes()[0]!.getAttribute("style") ?? "").not.toMatch(
            /border-radius/,
          );
        if (quiet) {
          const colors = (state?: StateName) =>
            shapes(state).map(
              (items) => items.find((s) => s.type === "line")?.stroke,
            );
          expect(colors("hover")).not.toEqual(colors());
          expect(colors("focusVisible")).not.toEqual(colors());
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: { isInvalid: set(true) },
            }),
          );
          expect(colors()).toEqual(
            boxes().map(() => cssVarColor("var(--negative)", "light")),
          );
          expect(colors("hover")).toEqual(colors());
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: { isInvalid: set(false), isDisabled: set(true) },
            }),
          );
          expect(colors("hover")).toEqual(colors());
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: { isDisabled: set(false) },
            }),
          );
        }
        setQuiet(false);
        expect(shapes()).toEqual(plainShapes);
        if (type === "searchfield")
          expect(boxes()[0]!.getAttribute("style")).toMatch(
            /border-radius:\s*9999px/,
          );
        expect(boxes().filter((box) => box.hasAttribute("data-quiet"))).toEqual(
          [],
        );
        for (const off of stop) off();
      },
    );
});
