// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  catalogItemLinkOut,
  catalogLinkOutCardEndInset,
  catalogLinkOutGlyph,
} from "../../../../../../packages/shared/src/catalog/document/itemLinks";
import type {
  AuthoredValue,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogEditContract } from "../editContract";
import { catalogRuleShapes } from "../ruleShapes";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-259 Phase 1 (G1) — collection item links. Seven item types take S2 · RAC `href` · `target` ·
 * `rel` and pass them to RAC, whose DOM is the G0 oracle (`adr259-s2-oracle.json` — the installed
 * RAC's own output: `<a>` for ListBoxItem · Tab · MenuItem, `data-href` for the rest). A GridList's ·
 * Menu's `hideLinkOutIcon` reaches its items; an item opening a new tab draws S2's link-out glyph
 * in both consumers at one box.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(
  readFileSync(
    join(here, "../../../../tests/fixtures/adr259-s2-oracle.json"),
    "utf8",
  ),
) as {
  itemLinks: Record<string, Record<string, string | null>>;
  linkOut: Record<string, { svgCount: number }>;
};
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const LINK = { href: "/about", target: "_blank", rel: "noopener" };

/** Item type → the palette type whose origin holds it. */
const OWNER: Record<string, string> = {
  ListBoxItem: "ListBox",
  Tab: "Tabs",
  Tag: "TagGroup",
  TreeItem: "Tree",
  GridListItem: "GridList",
  Row: "Table",
  MenuItem: "Menu",
};

async function open(paletteType: string, label: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: `project:project:adr259-${label}` as EntryId<"project">,
        name: "ADR-259",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr259-${label}-${Math.random()}`),
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
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, paletteType),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const edit = (recordId: string, props: Record<string, AuthoredValue>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(recordId)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  const render = async (recordId: string) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, recordId)));
    return {
      host,
      done: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  return { workspace, root, of, edit, render };
}

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

describe("ADR-259 Phase 1 — item links", () => {
  for (const [type, ownerType] of Object.entries(OWNER))
    it(`${type}: href · target · rel reach RAC — the DOM is the oracle's`, async () => {
      const { root, of, edit, render } = await open(ownerType, type);
      // (A top item: a nested TreeItem is closed.)
      const item = of(type).find(
        (record) =>
          root.typeOf(root.canvasInputs.get(record.parentId)!) !== type,
      )!;
      expect(item, `${ownerType} holds a ${type}`).toBeDefined();
      edit(item.id, LINK);
      const updated = root.canvasInputs.get(item.id)!;
      expect(updated.props).toMatchObject(LINK);
      const owner = of(ownerType)[0];
      const { host, done } = await render(owner.id);
      const el = host.querySelector<HTMLElement>(
        `[data-catalog-id="${item.id}"]`,
      )!;
      expect(el, `${type} element`).not.toBeNull();
      const oracle = ORACLE.itemLinks[type];
      expect({
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute("href"),
        target: el.getAttribute("target"),
        rel: el.getAttribute("rel"),
        dataHref: el.getAttribute("data-href"),
        dataTarget: el.getAttribute("data-target"),
        dataRel: el.getAttribute("data-rel"),
      }).toEqual({
        tag: oracle.tag,
        href: oracle.href,
        target: oracle.target,
        rel: oracle.rel,
        dataHref: oracle.dataHref,
        dataTarget: oracle.dataTarget,
        dataRel: oracle.dataRel,
      });
      expect(el.hasAttribute("hidelinkouticon")).toBe(false);
      await done();
    });

  it("the Design panel edits a MenuItem's link (a rule-only type's contracts)", async () => {
    const { workspace, of } = await open("Menu", "menu-contract");
    const item = of("MenuItem")[0];
    const contract = catalogEditContract(
      workspace.runtime.graph,
      workspace.readModel,
      workspace.positionOfRecord(item.id)!.target,
    );
    expect(
      contract.fields
        .filter((field) => !field.editorHidden)
        .map((field) => field.key),
    ).toEqual(expect.arrayContaining(["href", "target", "rel"]));
  });

  for (const [type, ownerType, label] of [
    ["GridListItem", "GridList", "ListView"],
    ["MenuItem", "Menu", "Menu"],
  ] as const)
    it(`${type}: the link-out glyph shows as S2's (${label}) — href + _blank, not hidden`, async () => {
      const { root, of, edit, render } = await open(ownerType, `${type}-out`);
      const item = of(type)[0];
      const owner = of(ownerType)[0];
      const glyphs = async () => {
        const { host, done } = await render(owner.id);
        const el = host.querySelector(`[data-catalog-id="${item.id}"]`)!;
        const count = el.querySelectorAll(
          ":scope > .link-out svg, :scope > [role=gridcell] > .link-out svg",
        ).length;
        await done();
        return count;
      };
      const cases: Array<[string, Record<string, AuthoredValue>, boolean]> = [
        ["href+_blank", { href: "https://x.test", target: "_blank" }, false],
        ["href only", { href: "https://x.test", target: "_self" }, false],
        [
          "href+_blank hidden",
          { href: "https://x.test", target: "_blank" },
          true,
        ],
      ];
      for (const [name, props, hide] of cases) {
        edit(item.id, props);
        edit(owner.id, { hideLinkOutIcon: hide });
        const record = root.canvasInputs.get(item.id)!;
        expect(record.props.hideLinkOutIcon === true, name).toBe(hide);
        const count = await glyphs();
        expect(count, name).toBe(ORACLE.linkOut[`${label}:${name}`].svgCount);
        expect(catalogItemLinkOut(type, record.props), name).toBe(count === 1);
      }
    });

  it("GridListItem: the glyph box is one box in both consumers (layout padding · Canvas glyph · DOM glyph)", async () => {
    // (The S2 ListView row again — 2026-10-25 사용자 「GridList 를 S2 ListView 처럼 목록 행으로」; the
    // 10-13 reference card put the glyph in its bottom padding.)
    const { workspace, root, of, edit, render } = await open("GridList", "box");
    const item = of("GridListItem")[0];
    const owner = of("GridList")[0];
    const before = root.getGeometry([item.id]).get(item.id)!;
    const ownRight = 12; // GridListItem rule size M paddingX (the S2 ListView row)
    edit(item.id, { href: "https://x.test", target: "_blank" });
    const record = root.canvasInputs.get(item.id)!;
    const glyph = catalogLinkOutGlyph("GridListItem", record.props.size);
    expect(catalogLinkOutCardEndInset("GridListItem")).toBeUndefined();
    // The content box shrinks by the glyph and its gap (the end padding grew).
    const label = of("Text").find((text) => text.parentId === item.id)!;
    const labelBox = root.getGeometry([label.id]).get(label.id)!;
    const box = root.getGeometry([item.id]).get(item.id)!;
    expect(box.width).toBe(before.width);
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
      box.width - ownRight - glyph.size - glyph.gap + 0.5,
    );
    // Canvas glyph centre: at the row's end, vertically centred.
    const shapes = catalogRuleShapes({
      node: record,
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get("GridListItem" as never)!,
      type: "GridListItem",
      authoredVisual: {},
    });
    const icon = shapes.find(
      (shape) =>
        shape.type === "icon_font" &&
        (shape as { iconName?: string }).iconName === "external-link",
    ) as { x: number; y: number; fontSize: number } | undefined;
    expect(icon).toMatchObject({
      x: box.width - ownRight - glyph.size / 2,
      y: box.height / 2,
      fontSize: glyph.size,
    });
    // DOM glyph box.
    const { host, done } = await render(owner.id);
    const el = host.querySelector<HTMLElement>(
      `[data-catalog-id="${item.id}"]`,
    )!;
    const span = el.querySelector<HTMLElement>(
      ":scope > .link-out, :scope > [role=gridcell] > .link-out",
    )!;
    expect({
      paddingRight: el.style.paddingRight,
      position: el.style.position,
      right: span.style.right,
      width: span.style.width,
      top: span.style.top,
      ariaHidden: span.getAttribute("aria-hidden"),
    }).toEqual({
      paddingRight: `${ownRight + glyph.size + glyph.gap}px`,
      position: "relative",
      right: `${ownRight}px`,
      width: `${glyph.size}px`,
      top: "50%",
      ariaHidden: "true",
    });
    await done();
  });
});
