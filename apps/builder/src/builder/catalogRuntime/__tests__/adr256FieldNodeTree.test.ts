// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement, type ElementType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  Calendar,
  ComboBox,
  DateInput,
  DatePicker,
  DateRangePicker,
  DateSegment,
  FieldError,
  Form,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
} from "react-aria-components";
import { describe, expect, it } from "vitest";
import { catalogDomRendersNode, renderCatalogDom } from "../domBinding";
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
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 2 (G2) — a field draws its node tree: the RAC field and its children in order,
 * each by its own binding in the field's context. (1) The Preview DOM has the structure of the
 * reference example (react-aria.adobe.com TextField — Decision 11: tags, nesting, order, text,
 * `slot`, role · aria and where the aria links point; not ids, classes, inline style, `data-*`).
 * (2) A free child the author puts in a field is drawn in its place. (3) An empty authored error
 * message leaves RAC's own validation message (Decision 7).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, props: Record<string, string | boolean>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-field" as EntryId<"project">,
        name: "Field",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-field-${Math.random()}`),
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
  return { workspace, field };
}

/**
 * Decision 11 structure: tag · attributes that are structure · text, aria links as positions.
 * Known difference outside the field family, collapsed here and recorded in the breakdown: our
 * Icon element is `div.react-aria-Icon > svg` where the reference's lucide glyph is the `svg`.
 */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  for (const icon of [...host.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  const all = [...host.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? `missing:${id}` : `#${index}`;
  };
  const KEEP = /^(role|slot|type|aria-.*|disabled|required|readonly)$/;
  const LINKS = new Set([
    "aria-labelledby",
    "aria-describedby",
    "aria-controls",
    "for",
  ]);
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

describe("ADR-256 Phase 2 — a field draws its node tree", () => {
  it("TextField has the reference example's structure (Decision 11)", async () => {
    const { workspace, field } = await open("textfield", {
      label: "Name",
      description: "Your full name",
      placeholder: "",
    });
    const actual = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field().id),
    );
    // react-aria.adobe.com TextField (G0 example 5): Label · Input · Description · FieldError.
    const reference = renderToStaticMarkup(
      createElement(
        TextField,
        null,
        createElement(Label, null, "Name"),
        createElement(Input),
        createElement(Text, { slot: "description" }, "Your full name"),
        createElement(FieldError),
      ),
    );
    expect(structure(actual)).toBe(structure(reference));
  });

  it("NumberField has the reference example's structure: Group > Input + stepper Buttons", async () => {
    const { workspace, field } = await open("numberfield", {
      label: "Width",
      description: "",
    });
    const actual = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field().id),
    );
    const glyph = () => createElement("svg", { "aria-hidden": "true" });
    // react-aria.adobe.com NumberField (G0 example 6).
    const reference = renderToStaticMarkup(
      createElement(
        NumberField,
        {
          // The same state as the catalog field (its document writes these — no value: S2 empty
          // input, 2026-10-10).
          minValue: field().props.minValue as number | undefined,
          isDisabled: false,
        },
        createElement(Label, null, "Width"),
        createElement(
          Group,
          null,
          createElement(Input),
          createElement(Button, { slot: "decrement" }, glyph()),
          createElement(Button, { slot: "increment" }, glyph()),
        ),
        createElement(FieldError),
      ),
    );
    expect(structure(actual)).toBe(structure(reference));
  });

  it("Select has the reference example's structure: Button(SelectValue + glyph) · Popover > ListBox (ADR-256 Phase 6c)", async () => {
    const { workspace, field } = await open("select", {
      label: "Animal",
      description: "Pick one",
    });
    const actual = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field().id),
    );
    // react-aria.adobe.com Select (vanilla starter): Label · Button > SelectValue + glyph ·
    // Text[description] · FieldError · Popover[hideArrow] > ListBox (closed — RAC's hidden select
    // lists the items).
    const reference = renderToStaticMarkup(
      createElement(
        Select,
        { placeholder: "Choose an option..." },
        createElement(Label, null, "Animal"),
        createElement(
          Button,
          null,
          createElement(SelectValue),
          createElement("svg", { "aria-hidden": "true" }),
        ),
        createElement(Text, { slot: "description" }, "Pick one"),
        createElement(FieldError),
        createElement(
          Popover,
          null,
          createElement(
            ListBox,
            null,
            ...["Aardvark", "Cat", "Dog", "Kangaroo"].map((name) =>
              createElement(ListBoxItem, { key: name, id: name }, name),
            ),
          ),
        ),
      ),
    );
    expect(structure(actual)).toBe(structure(reference));
    // Its parts are its own elements (the G3 harness measures them); the closed Popover has none.
    const kids = field().children.map((id) =>
      workspace.root.domInputs.get(id)!,
    );
    expect(
      kids.map((kid) => [
        workspace.root.typeOf(kid),
        catalogDomRendersNode(workspace.root, kid.id),
      ]),
    ).toEqual([
      ["Label", true],
      ["Button", true],
      ["Description", true],
      ["FieldError", true],
      ["Popover", false],
    ]);
  });

  it("ComboBox has the reference example's structure: Group(Input + Button) · Popover > ListBox (ADR-256 Phase 6d)", async () => {
    const { workspace, field } = await open("combobox", {
      label: "Animal",
      description: "Pick one",
    });
    const actual = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field().id),
    );
    // react-aria.adobe.com ComboBox (API anatomy): Label · Group > Input + Button(glyph) ·
    // Text[description] · FieldError · Popover[hideArrow] > ListBox (closed — RAC's collection
    // gathers the items in its hidden template).
    const reference = renderToStaticMarkup(
      createElement(
        ComboBox,
        null,
        createElement(Label, null, "Animal"),
        createElement(
          Group,
          null,
          createElement(Input, { placeholder: "Type or select..." }),
          createElement(
            Button,
            null,
            createElement("svg", { "aria-hidden": "true" }),
          ),
        ),
        createElement(Text, { slot: "description" }, "Pick one"),
        createElement(FieldError),
        createElement(
          Popover,
          null,
          createElement(
            ListBox,
            null,
            ...["Aardvark", "Cat", "Dog", "Kangaroo"].map((name) =>
              createElement(ListBoxItem, { key: name, id: name }, name),
            ),
          ),
        ),
      ),
    );
    expect(structure(actual)).toBe(structure(reference));
    // Its parts are its own elements (the G3 harness measures them); the closed Popover has none.
    const kids = field().children.map((id) =>
      workspace.root.domInputs.get(id)!,
    );
    expect(
      kids.map((kid) => [
        workspace.root.typeOf(kid),
        catalogDomRendersNode(workspace.root, kid.id),
      ]),
    ).toEqual([
      ["Label", true],
      ["Group", true],
      ["Description", true],
      ["FieldError", true],
      ["Popover", false],
    ]);
  });

  it.each([
    ["datepicker", "Date Picker"],
    ["daterangepicker", "Date Range"],
  ])(
    "%s has the reference example's structure: Group(DateInput + Button) · Popover > calendar (ADR-256 Phase 6e)",
    async (type, label) => {
      const { workspace, field } = await open(type, { description: "Pick" });
      const actual = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field().id),
      );
      const input = (slot?: string) =>
        createElement(
          DateInput as ElementType,
          slot ? { slot } : null,
          ((segment: Parameters<typeof DateSegment>[0]["segment"]) =>
            createElement(DateSegment, { segment })) as never,
        );
      const button = createElement(
        Button,
        null,
        createElement("svg", { "aria-hidden": "true" }),
      );
      // react-aria.adobe.com DatePicker · DateRangePicker (API anatomy · vanilla starter): Label ·
      // Group > DateInput (a range: start · end) + Button(glyph) · Text[description] · FieldError ·
      // Popover[hideArrow] > Calendar / RangeCalendar (closed — nothing drawn). Known difference,
      // recorded in the breakdown: the range's separator is the template's Text node (`span`, kept
      // out of the name as the starter's — `aria-hidden`, ADR-256 후속 10), where the vanilla
      // starter's sits inside a `div.date-fields`.
      const reference = renderToStaticMarkup(
        createElement(
          (type === "datepicker" ? DatePicker : DateRangePicker) as never,
          null,
          createElement(Label, null, label),
          type === "datepicker"
            ? createElement(Group, null, input(), button)
            : createElement(
                Group,
                null,
                input("start"),
                createElement("span", { "aria-hidden": "true" }, "–"),
                input("end"),
                button,
              ),
          createElement(Text, { slot: "description" }, "Pick"),
          createElement(FieldError),
          createElement(
            Popover as ElementType,
            { hideArrow: true },
            createElement(Calendar as ElementType),
          ),
        ),
      );
      expect(structure(actual)).toBe(structure(reference));
      // Its parts are its own elements; the closed Popover has none (and the Canvas hides it).
      const kids = field().children.map((id) =>
        workspace.root.domInputs.get(id)!,
      );
      expect(
        kids.map((kid) => [
          workspace.root.typeOf(kid),
          catalogDomRendersNode(workspace.root, kid.id),
        ]),
      ).toEqual([
        ["Label", true],
        ["Group", true],
        ["Description", true],
        ["FieldError", true],
        ["Popover", false],
      ]);
      const popover = [...workspace.root.canvasInputs.values()].find(
        (item) =>
          item.parentId === field().id &&
          workspace.root.typeOf(item) === "Popover",
      );
      expect(popover?.hidden).toBe(true);
      // The range picker's calendar is RAC's RangeCalendar (RAC's DateRangePicker gives its context
      // to that one only).
      const calendar = workspace.root.domInputs.get(
        workspace.root.domInputs.get(popover!.id)!.children[0]!,
      )!;
      expect(workspace.root.typeOf(calendar)).toBe(
        type === "datepicker" ? "Calendar" : "RangeCalendar",
      );
    },
  );

  it("a stepper Button with no text but a glyph stays (Decision 7 — no value condition)", async () => {
    const { workspace, field } = await open("numberfield", { label: "" });
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field().id),
    );
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)];
    expect(buttons).toHaveLength(2);
    for (const [, inner] of buttons) expect(inner).toContain("<svg");
  });

  it.each([
    "textfield",
    "textarea",
    "numberfield",
    "searchfield",
    "colorfield",
    "datefield",
    "timefield",
    // ADR-256 Phase 6c · 6d · 6e: a picker draws its node tree too.
    "select",
    "combobox",
    "datepicker",
    "daterangepicker",
  ])(
    "%s: a free child the author puts in is drawn in its place (Canvas and DOM)",
    async (type) => {
      const { workspace, field } = await open(type, { label: "Field" });
      workspace.execute(
        detachInstances({ ids: [FIELD], newId: workspace.newId }),
      );
      const icon = "project:node:free-icon" as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: FIELD },
          index: 1,
          entries: [
            {
              kind: "node",
              id: icon,
              definitionId: "lib:definition:type-Icon",
              children: [],
              props: { iconName: set("search") },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [icon],
          newId: workspace.newId,
        }),
      );
      // (A Select's RAC collection renders its children once more in a hidden `<template>` to
      // gather the items — not the drawn tree.)
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field().id),
      ).replace(/<template>[\s\S]*?<\/template>/g, "");
      const marked = [...html.matchAll(/data-catalog-id="([^"]+)"/g)].map(
        (match) => match[1]!,
      );
      // The Icon is the field's second drawn child: after the Label, before the control.
      const iconAt = marked.findIndex((id) => id.endsWith(icon));
      const labelAt = marked.findIndex((id) =>
        workspace.root.domInputs.get(id)
          ? workspace.root.typeOf(workspace.root.domInputs.get(id)!) === "Label"
          : false,
      );
      expect(iconAt, html).toBeGreaterThan(labelAt);
      expect(html).toContain("<svg");
      const record = [...workspace.root.canvasInputs.values()].find(
        (item) => item.sourceId === icon,
      );
      expect(record && !record.hidden).toBe(true);
    },
  );

  it.each(["select", "combobox"])(
    "%s: a ListBox the author puts beside the Popover shows on both sides — RAC draws it in the picker's context (ADR-256 Phase 6c · 6d)",
    async (type) => {
      const { workspace, field } = await open(type, { label: "Field" });
      workspace.execute(
        detachInstances({ ids: [FIELD], newId: workspace.newId }),
      );
      const list = "project:node:free-list" as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: FIELD },
          entries: [
            {
              kind: "node",
              id: list,
              definitionId: "lib:definition:origin-component-listbox",
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [list],
          newId: workspace.newId,
        }),
      );
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field().id),
      ).replace(/<template>[\s\S]*?<\/template>/g, "");
      const host = document.createElement("div");
      host.innerHTML = html;
      const drawn = [...host.querySelectorAll('[role="listbox"]')].map(
        (element) => element.getAttribute("data-catalog-id"),
      );
      expect(drawn.some((id) => id?.endsWith(list))).toBe(true);
      const record = [...workspace.root.canvasInputs.values()].find(
        (item) => item.sourceId === list,
      );
      expect(record && !record.hidden).toBe(true);
      // The Popover's own list stays closed on the Canvas.
      const popover = [...workspace.root.canvasInputs.values()].find(
        (item) =>
          item.parentId === field().id &&
          workspace.root.typeOf(item) === "Popover",
      );
      expect(popover?.hidden).toBe(true);
    },
  );

  it.each([
    ["datepicker", "calendar"],
    ["daterangepicker", "rangecalendar"],
  ])(
    "%s: a %s the author puts beside the Popover shows on both sides, in the picker's state (ADR-256 Phase 6e)",
    async (type, calendarType) => {
      const { workspace, field } = await open(type, {
        label: "Field",
        size: "L",
        isDisabled: true,
      });
      workspace.execute(
        detachInstances({ ids: [FIELD], newId: workspace.newId }),
      );
      const calendar = "project:node:free-calendar" as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: FIELD },
          entries: [
            {
              kind: "node",
              id: calendar,
              definitionId: `lib:definition:origin-component-${calendarType}`,
              children: [],
              // (Its own visible duration — ADR-256 Phase 9: RAC's picker context carries none.)
              props: { visibleDuration: set({ months: 2 }) },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [calendar],
          newId: workspace.newId,
        }),
      );
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field().id),
      );
      const drawn = [...host.querySelectorAll("[data-catalog-id]")].find(
        (element) => element.getAttribute("data-catalog-id")?.endsWith(calendar),
      );
      expect(drawn).toBeDefined();
      // RAC's calendar context (the picker's disabled state — the node does not override it to
      // false), the picker's size and the calendar's own visible duration.
      expect(drawn!.hasAttribute("data-disabled")).toBe(true);
      expect(drawn!.getAttribute("data-size")).toBe("L");
      expect(drawn!.querySelectorAll("table")).toHaveLength(2);
      const record = [...workspace.root.canvasInputs.values()].find(
        (item) => item.sourceId === calendar,
      );
      expect(record && !record.hidden).toBe(true);
    },
  );

  it("an empty authored error message leaves RAC's validation message", async () => {
    const { workspace, field } = await open("textfield", {
      label: "Email",
      name: "email",
      errorMessage: "",
    });
    const html = renderToStaticMarkup(
      createElement(
        Form,
        { validationErrors: { email: "Server rejected this email" } },
        renderCatalogDom(workspace.root, field().id) as ReactElement,
      ),
    );
    expect(html).toMatch(
      /class="react-aria-FieldError"[^>]*>Server rejected this email</,
    );
  });
});
