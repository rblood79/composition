import "fake-indexeddb/auto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-254 Phase 0 (G0 — the oracle): the title and description of the five containers (Dialog ·
 * Popover · Card · InlineAlert · Tooltip) as the build before the conversion resolves them.
 *
 * Oracle: `fixtures/adr254-container-parts.json`, written by the build before Phase 1 (main
 * `1b51bcfe5`) with `ADR254_WRITE=1`.
 * - `records`: each title / description record of the container (by its path from the instance
 *   root) — its binding, size, slot, text and the resolved `visual` · `layout` the Canvas draws
 *   and the DOM inlines.
 * - `dom`: the markup of the three containers that render DOM (Popover · Tooltip are closed
 *   overlays — no element): the Dialog (its section, as DialogTrigger mounts it when open), the
 *   Card and the InlineAlert. Generated ids are normalized; the inline style is kept so a value
 *   change shows in the markup.
 */
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/adr254-container-parts.json",
);
const BODY = "project:node:home-body" as NodeId;
const CONTAINER = "project:node:container" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

/** The containers and the prop combinations each is rendered with. */
const CASES: Record<string, Record<string, Record<string, string>>> = {
  dialog: { default: {} },
  popover: { default: {} },
  tooltip: { default: {} },
  card: {
    default: {},
    "size sm": { size: "sm" },
    "size lg": { size: "lg" },
    "variant secondary": { variant: "secondary" },
    "variant tertiary": { variant: "tertiary" },
    "variant quiet": { variant: "quiet" },
    "title, description": { title: "Ttl", description: "Desc" },
  },
  "inline-alert": {
    default: {},
    "size sm": { size: "sm" },
    "size lg": { size: "lg" },
    "variant neutral": { variant: "neutral" },
    "variant positive": { variant: "positive" },
    "variant notice": { variant: "notice" },
    "variant negative": { variant: "negative" },
    "title, description": { title: "Ttl", description: "Desc" },
  },
};
/** The containers whose title / description renders DOM, and the record their markup is. */
const DOM_ROOT: Record<string, (root: CatalogConsumerNode) => boolean> = {
  dialog: (record) => record.bindingId === "dialog",
  card: () => true,
  "inline-alert": () => true,
};
/** A title or a description record. */
const isPart = (record: CatalogConsumerNode) =>
  record.bindingId === "heading" || record.bindingId === "description";

async function render(type: string, authored: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr254-parts" as EntryId<"project">,
        name: "ADR-254 parts",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr254-parts-${Math.random()}`),
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
          id: CONTAINER,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [CONTAINER],
      newId: workspace.newId,
    }),
  );
  for (const [key, value] of Object.entries(authored))
    try {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: CONTAINER }],
          props: { [key]: set(value) },
        }),
      );
    } catch {
      return undefined;
    }
  const records = workspace.root.canvasInputs;
  const root = [...records.values()].find(
    (record) => record.sourceId === CONTAINER,
  )!;
  return { workspace, root };
}

/** The container's title / description records by their path (child indexes) from the root. */
function partRecords(
  workspace: CatalogWorkspace,
  root: CatalogConsumerNode,
): Record<string, unknown> {
  const records = workspace.root.canvasInputs;
  const found: Record<string, unknown> = {};
  const walk = (record: CatalogConsumerNode, path: string) => {
    if (isPart(record))
      found[path] = {
        binding: record.bindingId,
        size: record.props.size,
        slot: record.props.slot,
        text: record.props.children,
        hidden: record.hidden,
        visual: record.visual,
        layout: record.layout,
      };
    record.children.forEach((id, index) =>
      walk(records.get(id)!, `${path}/${index}`),
    );
  };
  walk(root, "");
  return found;
}

/** A markup's elements, their attributes (sorted, ids normalized) and text, in order. */
function normalize(html: string): string {
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => attribute.name !== "data-catalog-id")
      .map((attribute) =>
        ["id", "for", "aria-labelledby", "aria-describedby"].includes(
          attribute.name,
        )
          ? attribute.name
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

function domMarkup(
  type: string,
  workspace: CatalogWorkspace,
  root: CatalogConsumerNode,
): string | undefined {
  const pick = DOM_ROOT[type];
  if (!pick) return undefined;
  const records = workspace.root.domInputs;
  const find = (
    record: CatalogConsumerNode,
  ): CatalogConsumerNode | undefined =>
    pick(record)
      ? record
      : record.children
          .map((id) => find(records.get(id)!))
          .find((found) => found !== undefined);
  const target = find(records.get(root.id)!)!;
  return normalize(
    renderToStaticMarkup(renderCatalogDom(workspace.root, target.id)),
  );
}

describe("ADR-254 — the containers' title and description", () => {
  const write = process.env.ADR254_WRITE === "1";
  const fixture: Record<string, { records: unknown; dom?: string }> =
    !write && existsSync(FIXTURE)
      ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<
          string,
          { records: unknown; dom?: string }
        >)
      : {};
  const written: typeof fixture = {};

  for (const [type, cases] of Object.entries(CASES))
    for (const [name, authored] of Object.entries(cases))
      it(`${type} — ${name}`, async () => {
        const rendered = await render(type, authored);
        if (!rendered) {
          if (!write) expect(fixture[`${type}/${name}`]).toBeUndefined();
          return;
        }
        const { workspace, root } = rendered;
        const value = {
          records: partRecords(workspace, root),
          dom: domMarkup(type, workspace, root),
        };
        if (write) {
          written[`${type}/${name}`] = value;
          return;
        }
        expect(value).toEqual(fixture[`${type}/${name}`]);
      });

  it.runIf(write)("writes the fixture (the build before Phase 1)", () => {
    writeFileSync(FIXTURE, `${JSON.stringify(written, null, 1)}\n`);
  });
});
