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
import { inlineFontPx } from "./support/inlineFontPx";
import { s2LineHeight } from "@composition/rendering";

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
  // (Not the Card — ADR-256 Phase 10, 사용자 결정 「S2 그대로」: its title · description are Text nodes
  // in its S2 Content, no longer Heading · Description instances — `adr256CardS2.test.tsx`.)
  "inline-alert": {
    default: {},
    "size sm": { size: "S" },
    "size lg": { size: "L" },
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

type PartRecord = {
  binding: string;
  size?: string;
  slot?: string;
  text?: string;
  hidden?: true;
  visual: Record<string, unknown>;
  layout: Record<string, unknown>;
};
type PartsOf = { records: Record<string, PartRecord>; dom?: string };

/**
 * The line height each size gives a converted InlineAlert part (ADR-254 G0 change list): the
 * Heading rule at the alert's size, the Description rule one step above — they replace the alert
 * rule's 1.4 · 1.5. The font sizes stay (14/16/18 · 12/14/16).
 */
// (ADR-295 Phase 3: the S2 line-height formula of the font size — 사용자 결정 2.)
const INLINE_ALERT_LINE_HEIGHT: Record<
  string,
  { heading: number; description: number }
> = {
  S: { heading: 18 / 14, description: 16 / 12 },
  M: { heading: 20 / 16, description: 18 / 14 },
  L: { heading: 22 / 18, description: 20 / 16 },
};
const MARGINS = ["marginTop", "marginRight", "marginBottom", "marginLeft"];
/** A markup without inline style (the structure — the values are asserted on their own). */
const structureOf = (markup: string) => markup.replace(/ style=[^>]*>/g, ">");

/**
 * ADR-254 Phase 2 (G0 · G2): what the conversion keeps and what it changes on purpose.
 * - Structure: the oracle's, but the Dialog — its title is RAC's `Heading slot="title"` (RAC
 *   renders it at level 2 with an id) and names the dialog (`aria-labelledby` for `aria-label`).
 * - Values: every title / description keeps its font size and color (and its weight, `"600"` now
 *   the rule's number), but the InlineAlert's: its title is the Heading rule's (weight 600, its
 *   line height) and its description the Description rule's one step up (its line height); the
 *   alert rule's zero margins are the parts' own (the DOM writes `0` for `0px`).
 * - Canvas ↔ DOM: each part element inlines its record's font size, weight and color — the Card's
 *   description too (the CardContent drew it without its node's style before).
 */
function expectSinceConversion(
  type: string,
  authored: Record<string, string>,
  now: PartsOf,
  before: PartsOf,
) {
  const alertSize = authored.size ?? "M";
  // ADR-255: a Popover · Tooltip origin is its trigger and its overlay — the parts sit one level
  // down (in the overlay, `__overlay`, after the trigger Button). ADR-256 Phase 8a: after the
  // overlay's first child, its OverlayArrow.
  const moved = type === "popover" || type === "tooltip";
  const pathNow = (path: string) => {
    // ADR-256 Phase 8b: the Dialog origin's Dialog is in its Modal (`/1` → `/1/0`).
    if (type === "dialog") return `/1/0${path.slice(2)}`;
    // ADR-256 Phase 10: the InlineAlert's description is in its S2 Content (`/1` → `/1/0`).
    if (type === "inline-alert") return path === "/1" ? "/1/0" : path;
    if (!moved) return path;
    // ADR-278: after the arrow, the parts sit in the `content` slot's region frame (`/1/1/N`).
    const [first, ...rest] = path.slice(1).split("/");
    return `/1/1/${Number(first)}${rest.map((step) => `/${step}`).join("")}`;
  };
  expect(Object.keys(now.records)).toEqual(
    Object.keys(before.records).map(pathNow),
  );
  for (const [path, was] of Object.entries(before.records)) {
    const part = now.records[pathNow(path)]!;
    expect(part.binding).toBe(was.binding);
    expect(part.text).toBe(was.text);
    expect(part.visual.fontSize).toBe(was.visual.fontSize);
    expect(part.visual.color).toBe(was.visual.color);
    if (type === "inline-alert") {
      const heading = part.binding === "heading";
      expect(part.size).toBe(
        heading
          ? alertSize
          : ({ S: "M", M: "L", L: "XL" } as Record<string, string>)[alertSize],
      );
      expect(Number(part.visual.fontWeight)).toBe(heading ? 600 : 400);
      expect(part.visual.lineHeight).toBeCloseTo(
        INLINE_ALERT_LINE_HEIGHT[alertSize]![
          heading ? "heading" : "description"
        ],
        6,
      );
      // (S2 icon, 2026-10-13: an alert with an icon places its title clear of it — stretched,
      // the icon's size as its end margin; `inlineAlertIcon.test.tsx`.)
      const iconPlaced =
        heading && authored.variant !== "neutral"
          ? { alignSelf: "stretch", marginRight: "20px" }
          : {};
      expect(part.layout).toEqual({
        ...Object.fromEntries(
          Object.entries(was.layout).filter(([key]) => !MARGINS.includes(key)),
        ),
        ...iconPlaced,
      });
      continue;
    }
    expect(part.size).toBe(was.size);
    expect(part.slot).toBe(
      type === "dialog" && part.binding === "heading" ? "title" : was.slot,
    );
    expect(Number(part.visual.fontWeight)).toBe(Number(was.visual.fontWeight));
    // ADR-295 Phase 3: the line is the S2 formula of the same font size (사용자 결정 2) — the oracle's
    //   build had the old fixed ladder (14 → 20).
    const fontSize = Number(part.visual.fontSize);
    expect(Number(part.visual.lineHeight) * fontSize).toBeCloseTo(
      s2LineHeight(fontSize),
      6,
    );
    expect(part.layout).toEqual(was.layout);
  }
  if (before.dom === undefined) {
    expect(now.dom).toBeUndefined();
    return;
  }
  const expected =
    type === "dialog"
      ? structureOf(before.dom)
          .replace("<section aria-label=Dialog ", "<section aria-labelledby ")
          .replace(
            "<h3 class=react-aria-Heading>Dialog Title</>",
            "<h2 class=react-aria-Heading id slot=title>Dialog Title</>",
          )
          // ADR-276: a Button's words are its Text{label} child (`span.react-aria-Text`).
          .replace(
            "slot=close>Close</>",
            "slot=close><span class=react-aria-Text data-size=M slot=label>Close</></>",
          )
          // ADR-278: the description is the `content` slot's default content — the placed
          // instance's own node (2026-10-14), which carries its DOM id like any owned node.
          .replace(
            "<span class=react-aria-Text slot=description>Dialog content goes here.</>",
            "<span class=react-aria-Text id slot=description>Dialog content goes here.</>",
          )
      : type === "inline-alert"
        ? // ADR-256 Phase 10: S2 `InlineAlert > Heading + Content` — the description sits in a
          // Content (`div.react-aria-Content`); the template's slot names without a provider
          // (`label` · `description`) are gone (the Description's own default slot stays).
          // Its root carries S2's alert role (`staticAttrs`, 2026-10-09 — the oracle's build
          // dropped the binding's `role="alert"` · `aria-live`).
          structureOf(before.dom)
            .replace(
              /(<span class=react-aria-Text slot=description>.*?<\/>)/,
              "<div class=react-aria-Content data-size=M data-variant=default>$1</>",
            )
            .replace(
              /^<div (class=react-aria-InlineAlert [^>]*) id>/,
              "<div aria-live=polite $1 id role=alert>",
            )
            // S2 fillStyle (2026-10-10 · S2 names 2026-10-13): the template root carries the
            // default border.
            .replace(
              "class=react-aria-InlineAlert data-size",
              "class=react-aria-InlineAlert data-fill-style=border data-size",
            )
        : structureOf(before.dom);
  // S2 InlineAlert's variant icon (2026-10-13 — `inlineAlertIcon.test.tsx` checks its box and
  // glyph): before the parts, named by the variant's string; the parts compare without it.
  const ICON =
    /<svg aria-label=(\w+) class=inline-alert-icon [^>]*>(?:<(?:path|circle) [^>]*><\/>)*<\/>/;
  const nowStructure = structureOf(now.dom!);
  if (type === "inline-alert")
    expect(ICON.exec(nowStructure)?.[1]).toBe(
      (
        {
          informative: "Information",
          positive: "Success",
          notice: "Warning",
          negative: "Error",
        } as Record<string, string>
      )[authored.variant ?? "informative"],
    );
  expect(nowStructure.replace(ICON, "")).toBe(expected);
  // Each part element inlines its record's values (the Canvas draws the same record).
  for (const part of Object.values(now.records)) {
    const element = new RegExp(
      `<(?:h2|h3|span|div) [^>]*>${part.text}</>`,
    ).exec(now.dom!)?.[0];
    expect(element, `${part.binding}: ${part.text}`).toBeDefined();
    expect(inlineFontPx(element!)).toBe(Number(part.visual.fontSize));
    expect(element).toContain(`font-weight:${Number(part.visual.fontWeight)}`);
    expect(element).toContain(`color:${part.visual.color}`);
  }
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
        expectSinceConversion(
          type,
          authored,
          value as PartsOf,
          fixture[`${type}/${name}`] as PartsOf,
        );
      });

  it.runIf(write)("writes the fixture (the build before Phase 1)", () => {
    writeFileSync(FIXTURE, `${JSON.stringify(written, null, 1)}\n`);
  });
});
