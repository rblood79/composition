// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FieldError,
  Form,
  Input,
  Label,
  Text,
  TextField,
} from "react-aria-components";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
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

/** Decision 11 structure: tag · attributes that are structure · text, aria links as positions. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const all = [...host.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? `missing:${id}` : `#${index}`;
  };
  const KEEP = /^(role|slot|type|aria-.*|disabled|required|readonly)$/;
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

  it.each(["textfield", "textarea", "colorfield", "datefield", "timefield"])(
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
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field().id),
      );
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
