// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogOwnerDecidedProps } from "../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14 (사용자 「한쪽만 반영되는 칸 고쳐」): a prop the Design panel offers changes the Canvas
 * and the Preview alike — each case below reached one side only.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:owner" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(
  origin: string,
  props: Record<string, string | boolean>,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:one-sided" as EntryId<"project">,
        name: "One sided",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `one-sided-${Math.random()}`),
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
          id: OWNER,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === OWNER)!;
  const html = () => renderToStaticMarkup(renderCatalogDom(root, owner().id));
  const canvas = (type: string) =>
    [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === type,
    );
  // (The Design panel's edit: the selected record's target — an instance's template root.)
  const edit = (patch: Record<string, string | boolean>) => {
    workspace.selectRecords([owner().id]);
    const [selected] = workspace.session.getSnapshot().selection;
    workspace.execute(
      setFields({
        targets: [selected!.target],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  };
  if (Object.keys(props).length) edit(props);
  return { workspace, root, html, canvas, edit };
}

/** The opening tag of each element of `className` in `html`. */
const tags = (html: string, className: string) =>
  html.match(new RegExp(`<[a-z]+[^>]*class="${className}"[^>]*>`, "g")) ?? [];

describe("a prop reaches the Canvas and the Preview alike", () => {
  it("Form size: the DOM carries the size the Canvas draws", async () => {
    const { html, canvas } = await open("form", { size: "L" });
    const [tag] = tags(html(), "react-aria-Form");
    expect(tag).toContain('data-size="L"');
    const [form] = canvas("Form");
    expect(form!.props.size).toBe("L");
    // (The L gap — the generated `[data-size="L"]` block's 20, not M's 16.)
    expect(form!.visual.gap).toBe(20);
  });

  it("Breadcrumbs size: its crumbs take it (the separator glyph), not edited on a crumb", async () => {
    const { canvas, root } = await open("breadcrumbs", { size: "L" });
    const crumbs = canvas("Breadcrumb");
    expect(crumbs.length).toBeGreaterThan(1);
    for (const crumb of crumbs) {
      expect(crumb.props.size).toBe("L");
      expect(crumb.visual.iconSize).toBe(18);
      expect(catalogOwnerDecidedProps(root, crumb)?.owner).toBe("Breadcrumbs");
    }
  });

  it("Tabs size · density: the TabList takes the Tabs' on both sides, and is not edited on it", async () => {
    const { html, canvas, root } = await open("tabs", {
      size: "L",
      density: "compact",
    });
    const [list] = canvas("TabList");
    expect(list!.props).toMatchObject({ size: "L", density: "compact" });
    expect(list!.visual.gap).toBe(0);
    const [tag] = tags(html(), "react-aria-TabList");
    expect(tag).toContain('data-size="L"');
    expect(tag).toContain('data-density="compact"');
    const decided = catalogOwnerDecidedProps(root, list!);
    expect(decided?.owner).toBe("Tabs");
    expect(decided?.keys.has("size")).toBe(true);
  });

  it("ToggleButtonGroup Emphasized · Disabled reach the Canvas buttons; the group is not dimmed twice", async () => {
    const emphasized = await open("togglebuttongroup", { isEmphasized: true });
    for (const button of emphasized.canvas("ToggleButton"))
      expect(button.props.isEmphasized).toBe(true);
    const disabled = await open("togglebuttongroup", {});
    disabled.edit({ isDisabled: true });
    const buttons = disabled.canvas("ToggleButton");
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      expect(button.props.isDisabled).toBe(true);
      expect(button.visual.opacity).toBe(0.38);
    }
    expect(disabled.canvas("ToggleButtonGroup")[0]!.visual.opacity ?? 1).toBe(
      1,
    );
    // (Off again: the buttons' own value.)
    disabled.edit({ isDisabled: false });
    for (const button of disabled.canvas("ToggleButton"))
      expect(button.props.isDisabled).toBe(false);
  });

  it("GridList Quiet: its items paint the quiet variant on both sides", async () => {
    const { html, canvas } = await open("gridlist", { isQuiet: true });
    const items = canvas("GridListItem");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.props.variant).toBe("quiet");
    const found = tags(html(), "react-aria-GridListItem");
    expect(found.length).toBe(items.length);
    for (const tag of found) expect(tag).toContain('data-variant="quiet"');
  });

  it("Link Quiet: the Canvas text has no underline (the rule's `[data-quiet]` block)", async () => {
    const underline = async (props: Record<string, string | boolean>) => {
      const { workspace, canvas } = await open("link", props);
      const [link] = canvas("Link");
      return catalogRuleShapes({
        node: link!,
        rect: { width: 60, height: 20 },
        rule: workspace.runtime.graph.library.rules.get("Link" as never)!,
        type: "Link",
        authoredVisual: {},
      })
        .filter((shape) => shape.type === "text")
        .map((shape) => (shape as { textDecoration?: string }).textDecoration);
    };
    expect(await underline({})).toContain("underline");
    expect(await underline({ isQuiet: true })).not.toContain("underline");
  });
});
