// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "react-aria-components/Button";
import { Label } from "react-aria-components/Label";
import { Tag, TagGroup, TagList } from "react-aria-components/TagGroup";
import { Text } from "react-aria-components/Text";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5d (G2) — a TagGroup is the reference's (react-aria.adobe.com TagGroup):
 * `TagGroup > Label + TagList > Tag (text + Button[slot=remove] while allowsRemoving) +
 * Text[description] + Text[errorMessage]`. The remove button is a node of the Tag origin shown
 * by the Tag's state (`showWhen allowsRemoving` — the TagGroup's); the hint texts are the
 * Description · FieldError part nodes, each there while it has text.
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:tags" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function open(props: Record<string, string | boolean> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-tags" as EntryId<"project">,
        name: "Tags",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-tags-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: "lib:definition:origin-component-taggroup",
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const group = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === GROUP)!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === GROUP)!.id,
      ),
    );
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const edit = (values: Record<string, string | boolean>) =>
    workspace.root.execute(
      setFields({
        targets: [workspace.positionOfRecord(group().id)!.target],
        props: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { workspace, root, html, of, edit };
}

/**
 * Decision 11 structure: tag · role · slot · aria links as positions · text. Known differences
 * collapsed here: our Icon is `div.react-aria-Icon > svg` (the reference's glyph is the svg); the
 * TagList node's chip box (`div.tag-list-wrapper` around RAC's TagList, no role) and its `maxRows`
 * measuring mirror inside it (`inert`, hidden).
 */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  for (const icon of [...host.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const mirror of [...host.querySelectorAll("[inert]")]) mirror.remove();
  for (const box of [...host.querySelectorAll("div.tag-list-wrapper")])
    box.replaceWith(...box.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  const group = host.querySelector(".react-aria-TagGroup")!;
  const all = [...group.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "missing" : `#${index}`;
  };
  const LINKS = new Set(["aria-labelledby", "aria-describedby"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          /^(role|slot|aria-(?!labelledby|describedby).*)$/.test(
            attribute.name,
          ) || LINKS.has(attribute.name),
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
  return walk(group);
}

const TAGS = ["Chocolate", "Mint", "Strawberry", "Vanilla"];
/** Remove buttons inside the RAC TagGroup (SSR also writes RAC's collection template). */
const removeIn = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelectorAll(".react-aria-TagGroup button[slot=remove]")
    .length;
};
const glyph = () => createElement("svg", { "aria-hidden": "true" });

describe("ADR-256 Phase 5d — TagGroup is the reference's node tree", () => {
  it("has the reference structure: Label · TagList > Tag (text + remove Button) · description · error", async () => {
    const { html } = await open({
      allowsRemoving: true,
      description: "Pick flavors",
      errorMessage: "Too many",
    });
    const reference = renderToStaticMarkup(
      createElement(
        TagGroup,
        { selectionMode: "multiple", onRemove: () => {} },
        createElement(Label, null, "Tag Group"),
        createElement(
          TagList,
          null,
          ...TAGS.map((text) =>
            createElement(
              Tag,
              { key: text, id: text, textValue: text },
              // (Our label is a Text node — a span around the reference's text.)
              createElement("span", null, text),
              createElement(Button, { slot: "remove" }, glyph()),
            ),
          ),
        ),
        createElement(Text, { slot: "description" }, "Pick flavors"),
        createElement(Text, { slot: "errorMessage" }, "Too many"),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("the remove buttons follow the TagGroup's allowsRemoving (Canvas and DOM)", async () => {
    const { html, of, edit } = await open();
    const removeButtons = () =>
      of("Button").filter((button) => button.props.slot === "remove");
    expect(removeButtons()).toHaveLength(TAGS.length);
    expect(removeButtons().every((button) => button.hidden === true)).toBe(
      true,
    );
    expect(removeIn(html())).toBe(0);
    edit({ allowsRemoving: true });
    expect(removeButtons().every((button) => button.hidden !== true)).toBe(
      true,
    );
    expect(removeIn(html())).toBe(TAGS.length);
    edit({ allowsRemoving: false });
    expect(removeButtons().every((button) => button.hidden === true)).toBe(
      true,
    );
  });

  it("the remove glyph takes the chip's text color, not the button's paint", async () => {
    const { of, html } = await open({ allowsRemoving: true });
    const label = of("Text").find((text) => text.props.children === "Mint")!;
    const glyphs = of("Icon").filter((icon) => icon.props.iconName === "x");
    expect(glyphs).toHaveLength(TAGS.length);
    for (const icon of glyphs)
      expect(icon.derivedProps?.color).toBe(label.derivedProps?.color);
    expect(html()).not.toMatch(/stroke="#ffffff"/i);
  });

  it("the chip with a remove button: label + gap + 2 + 18 − (padding 12 → 4) wider", async () => {
    const { root, of, edit } = await open();
    const width = () => {
      const tag = of("Tag")[0]!;
      return root.getGeometry([tag.id]).get(tag.id)!.width;
    };
    const plain = width();
    edit({ allowsRemoving: true });
    expect(width() - plain).toBe(4 + 2 + 18 - 8);
  });

  it("an empty description or error message is not there (Canvas and DOM)", async () => {
    const { html, of, edit } = await open();
    const hints = () => [...of("Description"), ...of("FieldError")];
    expect(hints().every((hint) => hint.hidden === true)).toBe(true);
    expect(html()).not.toContain('slot="description"');
    expect(html()).not.toContain('slot="errorMessage"');
    edit({ description: "Pick", errorMessage: "Wrong" });
    expect(hints().every((hint) => hint.hidden !== true)).toBe(true);
    expect(html()).toContain('slot="description"');
    expect(html()).toMatch(
      /<span[^>]*class="react-aria-FieldError"[^>]*slot="errorMessage"[^>]*>Wrong<\/span>/,
    );
  });
});
