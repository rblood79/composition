import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import {
  CatalogCompositionRoot,
  type CatalogConsumerNode,
} from "../compositionRoot";
import { TAILWIND_PALETTE } from "@composition/rendering";
import { catalogTextMetrics } from "../boxModel";
import { catalogRuleShapes } from "../ruleShapes";
import { catalogNodeState } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3 resting-state presence: nodes a component keeps closed/unselected get no
 * layout box (`display: none`), and a value change of the presence scope (Tabs selection)
 * re-derives exactly the dependent panels — the same inputs as a freshly built root.
 */
class StyleLayoutEngine implements LayoutEngineAPI {
  private next = 1;
  readonly styles = new Map<number, Record<string, unknown>>();
  readonly byElement = new Map<string, number>();
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    return (
      JSON.parse(json) as {
        elementId?: string;
        style: Record<string, unknown>;
      }[]
    ).map((node) => {
      const handle = this.next++;
      this.styles.set(handle, node.style);
      return handle;
    });
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("not used");
  }
  createNodeRaw(json: string) {
    const handle = this.next++;
    this.styles.set(handle, JSON.parse(json));
    return handle;
  }
  updateStyleRaw(handle: number, json: string) {
    this.styles.set(handle, JSON.parse(json));
  }
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {}
  getLayoutsBatch() {
    return new Map();
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}

async function open(
  definitionId: DefinitionId,
  name: string,
  project: { children?: NodeId[]; nodes?: NodeEntry[] } = {},
) {
  const library = await buildCodeCatalogLibrary();
  const projectId = "project:project:presence" as const;
  const pageId = "project:page:main" as const;
  const nodeId = "project:node:subject" as NodeId;
  const subject: NodeEntry = {
    kind: "node",
    id: nodeId,
    definitionId,
    children: project.children ?? [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 2,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name,
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [nodeId],
      },
      [nodeId]: subject,
      ...Object.fromEntries(
        (project.nodes ?? []).map((entry) => [entry.id, entry]),
      ),
    },
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr248-presence-${name}`),
  );
  const engine = new StyleLayoutEngine();
  const root = new CatalogCompositionRoot(runtime, engine, {
    width: 1440,
    height: 900,
  });
  const typeOf = (node: CatalogConsumerNode) =>
    node.ruleId ??
    runtime.graph.getDefinition(node.definitionId as DefinitionId)?.name ??
    "";
  const byType = (type: string) =>
    [...root.canvasInputs.values()].filter((input) => typeOf(input) === type);
  const fresh = () =>
    new Map(
      new CatalogCompositionRoot(runtime, new StyleLayoutEngine(), {
        width: 1440,
        height: 900,
      }).canvasInputs,
    );
  return { root, runtime, engine, nodeId, typeOf, byType, fresh };
}

describe("ADR-248 Phase 3 resting-state presence", () => {
  it("shows only the selected TabPanel and follows a selection edit incrementally", async () => {
    const scene = await open(
      "lib:definition:origin-component-tabs" as DefinitionId,
      "tabs",
    );
    const panels = scene.byType("TabPanel");
    expect(panels.map((panel) => panel.hidden === true)).toEqual([false, true]);
    const tabs = scene.byType("Tabs")[0];
    const notified: string[] = [];
    for (const id of scene.root.canvasInputs.keys())
      scene.root.subscribeCanvas(id, () => notified.push(id));
    // Disabling the first tab moves RAC's default selection to the next enabled tab.
    scene.root.dispatch("disable first tab", [
      {
        kind: "upsertDescendant",
        id: scene.nodeId,
        override: {
          kind: "patch",
          address: {
            instances: [scene.nodeId],
            templatePath: [
              "lib:template:component-tabs",
              "lib:template:component-tabs__1",
              "lib:template:component-tabs__1__tab-1",
            ] as never,
          },
          props: { isDisabled: { kind: "set", value: true } },
        },
      },
    ]);
    const after = scene.byType("TabPanel");
    expect(after.map((panel) => panel.hidden === true)).toEqual([true, false]);
    // Only the edited Tab and the two panels changed; the result equals a fresh root.
    const firstTab = [...scene.root.canvasInputs.values()].find(
      (input) =>
        input.sourceId === "lib:template:component-tabs__1__tab-1" ||
        input.collapsedSourceIds?.includes(
          "lib:template:component-tabs__1__tab-1",
        ),
    )!;
    expect(firstTab.id).not.toBe(tabs.id);
    // The selection moves to the second Tab: it is `data-selected` now (its indicator and paint).
    const tabInputs = scene.byType("Tab");
    expect(tabInputs.map((tab) => tab.derivedProps?._isSelected)).toEqual([
      false,
      true,
    ]);
    // Their label Texts take the item color (`[data-selected] { color: var(--fg) }` moves).
    const labels = tabInputs.flatMap((tab) => tab.children);
    expect(
      labels.map((id) => scene.root.canvasInputs.get(id)!.derivedProps?.color),
    ).toEqual([TAILWIND_PALETTE.neutral[600], TAILWIND_PALETTE.neutral[900]]);
    expect(new Set(notified)).toEqual(
      new Set([
        ...tabInputs.map((tab) => tab.id),
        ...labels,
        ...panels.map((panel) => panel.id),
      ]),
    );
    expect(new Map(scene.root.canvasInputs)).toEqual(scene.fresh());
  });

  it("repaints the other Tab's label Text when a value edit moves the Tabs' selection", async () => {
    const id = (name: string) => `project:node:${name}` as NodeId;
    const entry = (
      name: string,
      type: string,
      props: NodeEntry["props"] = {},
      children: NodeId[] = [],
    ): NodeEntry => ({
      kind: "node",
      id: id(name),
      definitionId: catalogTypeDefinitionId(type) as DefinitionId,
      children,
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const tab = (name: string) => [
      entry(name, "Tab", {}, [id(`${name}-label`)]),
      entry(`${name}-label`, "Text", {
        children: { kind: "set", value: name },
      }),
    ];
    const scene = await open(
      "lib:definition:type-Tabs" as DefinitionId,
      "tabs-value",
      {
        children: [id("list")],
        nodes: [
          entry("list", "TabList", {}, [id("one"), id("two")]),
          ...tab("one"),
          ...tab("two"),
        ],
      },
    );
    const input = (name: string) =>
      [...scene.root.canvasInputs.values()].find(
        (node) => node.sourceId === id(name),
      )!;
    const colors = () =>
      ["one-label", "two-label"].map((name) => input(name).derivedProps?.color);
    expect(colors()).toEqual([
      TAILWIND_PALETTE.neutral[900],
      TAILWIND_PALETTE.neutral[600],
    ]);
    const notified: string[] = [];
    for (const key of scene.root.canvasInputs.keys())
      scene.root.subscribeCanvas(key, () => notified.push(key));
    scene.root.dispatch("disable first tab", [
      {
        kind: "patchNodeProp",
        id: id("one"),
        key: "isDisabled",
        write: { kind: "set", value: true },
      },
    ]);
    expect(colors()).toEqual([
      TAILWIND_PALETTE.neutral[600],
      TAILWIND_PALETTE.neutral[900],
    ]);
    expect(notified).toContain(input("two-label").id);
    expect(new Map(scene.root.canvasInputs)).toEqual(scene.fresh());
  });

  it("paints RAC `data-selected`: a selected Tag's selected variant over the typed default variant, a selected Tab's indicator (state origin and Tabs' selected key)", async () => {
    const shapesOf = (
      scene: Awaited<ReturnType<typeof open>>,
      type: string,
      input = scene.byType(type)[0],
    ) =>
      catalogRuleShapes({
        node: input.derivedProps
          ? { ...input, props: { ...input.props, ...input.derivedProps } }
          : input,
        rect: { width: 120, height: 30 },
        rule: scene.runtime.graph.library.rules.get(type as never)!,
        type,
        authoredVisual: {},
        state: catalogNodeState(input.displayState),
      });
    const accentRect = (shapes: ReturnType<typeof catalogRuleShapes>) =>
      shapes.filter(
        (shape) =>
          (shape.type === "rect" || shape.type === "roundRect") &&
          (shape as { fill?: unknown }).fill === "{color.accent}",
      );
    // Tag: the typed `variant: "default"` is not an authored choice; DOM `[data-selected]` wins.
    const tag = await open(
      "lib:definition:origin-component-tag-item-default" as DefinitionId,
      "tag-selected",
    );
    expect(tag.byType("Tag")[0].props.variant).toBe("default");
    expect(accentRect(shapesOf(tag, "Tag")).length).toBeGreaterThan(0);
    const tagUnselected = await open(
      "lib:definition:origin-component-tag-item-default--unselected" as DefinitionId,
      "tag-unselected",
    );
    expect(accentRect(shapesOf(tagUnselected, "Tag"))).toEqual([]);
    // Tab state origin: selected → the 3px bottom indicator; its hover variant is a hovered Tab.
    const tab = await open(
      "lib:definition:origin-component-tab-item-default" as DefinitionId,
      "tab-selected",
    );
    // Bottom edge of the size box (md height 29), full width.
    expect(accentRect(shapesOf(tab, "Tab"))).toEqual([
      expect.objectContaining({ x: 0, y: 26, height: 3, width: 120 }),
    ]);
    const tabHover = await open(
      "lib:definition:origin-component-tab-item-default--hover" as DefinitionId,
      "tab-hover",
    );
    expect(accentRect(shapesOf(tabHover, "Tab"))).toEqual([]);
    // Tabs: the Tab its selected key picks draws the indicator, the others none.
    const tabs = await open(
      "lib:definition:origin-component-tabs" as DefinitionId,
      "tabs-indicator",
    );
    expect(
      tabs
        .byType("Tab")
        .map((input) => accentRect(shapesOf(tabs, "Tab", input)).length),
    ).toEqual([1, 0]);
    // Collections decide their items' selection like the DOM binding: TagGroup none (its Tags are
    // instances of the selected Tag origin), ListBox its `selectedKey`.
    const tagGroup = await open(
      "lib:definition:origin-component-taggroup" as DefinitionId,
      "taggroup-selection",
    );
    const tagInputs = tagGroup.byType("Tag");
    expect(tagInputs.length).toBeGreaterThan(1);
    expect(tagInputs.map((input) => input.derivedProps?._isSelected)).toEqual(
      tagInputs.map(() => false),
    );
    expect(
      tagInputs.map(
        (input) => accentRect(shapesOf(tagGroup, "Tag", input)).length,
      ),
    ).toEqual(tagInputs.map(() => 0));
    const listBox = await open(
      "lib:definition:origin-component-listbox" as DefinitionId,
      "listbox-selection",
    );
    const items = listBox.byType("ListBoxItem");
    expect(items.length).toBeGreaterThan(1);
    expect(items.map((input) => input.derivedProps?._isSelected)).toEqual(
      items.map(() => false),
    );
    // The ListBoxItem origin's own background is its selected look (old state layer: the resting
    // `--unselected` layer removes it): shown by the selected origin only — not by its resting
    // variant, nor by its instances inside a ListBox (the collection's selection decides).
    expect(items.map((input) => input.visual.backgroundColor)).toEqual(
      items.map(() => undefined),
    );
    const itemVisual = async (definition: string) =>
      (await open(definition as DefinitionId, definition)).byType(
        "ListBoxItem",
      )[0].visual.backgroundColor;
    expect(
      await itemVisual("lib:definition:origin-component-listbox-item-default"),
    ).toBe("var(--accent-subtle)");
    for (const variant of ["unselected", "hover", "pressed"])
      expect(
        await itemVisual(
          `lib:definition:origin-component-listbox-item-default--${variant}`,
        ),
      ).toBeUndefined();
  });

  it("paints a Tab/Tag label Text in its item's color (`.react-aria-Tab/Tag .react-aria-Text { color: inherit }`)", async () => {
    const labelColors = (
      scene: Awaited<ReturnType<typeof open>>,
      type: string,
    ) =>
      scene.byType(type).map((item) => {
        const label = item.children
          .map((id) => scene.root.canvasInputs.get(id)!)
          .find((child) => scene.typeOf(child) === "Text")!;
        return catalogTextMetrics(label, item).color;
      });
    const origin = async (suffix: string) => {
      const name = `origin-component-${suffix}`;
      return open(`lib:definition:${name}` as DefinitionId, name);
    };
    const neutral = TAILWIND_PALETTE.neutral[900];
    const subdued = TAILWIND_PALETTE.neutral[600];
    // Tab: rule text (neutral-subdued), `[data-hovered]` textHover, `[data-selected] { color: var(--fg) }`.
    expect(labelColors(await origin("tab-item-default"), "Tab")).toEqual([
      neutral,
    ]);
    expect(
      labelColors(await origin("tab-item-default--unselected"), "Tab"),
    ).toEqual([subdued]);
    expect(labelColors(await origin("tab-item-default--hover"), "Tab")).toEqual(
      [neutral],
    );
    // Tabs: the selected key's Tab label only.
    expect(labelColors(await origin("tabs"), "Tab")).toEqual([
      neutral,
      subdued,
    ]);
    // Tag: the chip text (`--tag-text`) — `[data-selected]` on-accent.
    expect(labelColors(await origin("tag-item-default"), "Tag")).toEqual([
      "#ffffff",
    ]);
    expect(
      labelColors(await origin("tag-item-default--unselected"), "Tag"),
    ).toEqual([neutral]);
    const tagGroup = labelColors(await origin("taggroup"), "Tag");
    expect(tagGroup).toEqual(tagGroup.map(() => neutral));
  });

  it("keeps collapsed TreeItem children and closed trigger overlays out of layout", async () => {
    const tree = await open(
      "lib:definition:origin-component-tree" as DefinitionId,
      "tree",
    );
    const items = tree.byType("TreeItem");
    const nested = items.filter(
      (item) =>
        tree.typeOf(tree.root.canvasInputs.get(item.parentId)!) === "TreeItem",
    );
    expect(nested.length).toBeGreaterThan(0);
    for (const item of items)
      expect(item.hidden === true).toBe(nested.includes(item));
    const nestedHandleStyles = [...tree.engine.styles.values()].filter(
      (style) => style.display === "none",
    );
    expect(nestedHandleStyles.length).toBe(nested.length);

    const select = await open(
      "lib:definition:origin-component-select" as DefinitionId,
      "select",
    );
    const listItems = select.byType("ListBoxItem");
    expect(listItems.length).toBeGreaterThan(0);
    expect(listItems.every((item) => item.hidden)).toBe(true);
    expect(select.byType("SelectTrigger").every((node) => !node.hidden)).toBe(
      true,
    );
  });

  it("re-derives panel presence on a value-only Tab edit (incremental path)", async () => {
    const id = (name: string) => `project:node:${name}` as NodeId;
    const entry = (
      name: string,
      type: string,
      children: string[] = [],
      props: NodeEntry["props"] = {},
    ): NodeEntry => ({
      kind: "node",
      id: id(name),
      definitionId: `lib:definition:type-${type}` as DefinitionId,
      children: children.map(id),
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const scene = await open(
      "lib:definition:type-Tabs" as DefinitionId,
      "tabs-project",
      {
        children: [id("list"), id("panels")],
        nodes: [
          entry("list", "TabList", ["tab-a", "tab-b"]),
          entry("tab-a", "Tab"),
          entry("tab-b", "Tab"),
          entry("panels", "TabPanels", ["panel-a", "panel-b"]),
          entry("panel-a", "TabPanel"),
          entry("panel-b", "TabPanel"),
        ],
      },
    );
    const panelHidden = () =>
      scene.byType("TabPanel").map((panel) => panel.hidden === true);
    expect(panelHidden()).toEqual([false, true]);
    const tabSelected = () =>
      scene.byType("Tab").map((tab) => tab.derivedProps?._isSelected);
    expect(tabSelected()).toEqual([true, false]);
    const notified: string[] = [];
    for (const key of scene.root.canvasInputs.keys())
      scene.root.subscribeCanvas(key, () => notified.push(key));
    scene.root.dispatch("disable tab a", [
      {
        kind: "patchNodeProp",
        id: id("tab-a"),
        key: "isDisabled",
        write: { kind: "set", value: true },
      },
    ]);
    expect(panelHidden()).toEqual([true, false]);
    expect(scene.root.metrics.traversedWholeInputGraph).toBe(false);
    const byId = (name: string) =>
      [...scene.root.canvasInputs.values()].find(
        (input) => input.sourceId === id(name),
      )!.id;
    expect(tabSelected()).toEqual([false, true]);
    expect(new Set(notified)).toEqual(
      new Set([byId("tab-a"), byId("tab-b"), byId("panel-a"), byId("panel-b")]),
    );
    expect(new Map(scene.root.canvasInputs)).toEqual(scene.fresh());
    // Hidden panel → `display: none` layout input; shown panel → its own style.
    const displays = [...scene.engine.styles.values()].filter(
      (style) => style.display === "none",
    );
    expect(displays.length).toBeGreaterThan(0);
  });
  it("paints a crumb label in the crumb's text color, the current one in accent (Preview Link color)", async () => {
    const id = (name: string) => `project:node:${name}` as NodeId;
    const entry = (
      name: string,
      type: string,
      props: NodeEntry["props"] = {},
      children: NodeId[] = [],
    ): NodeEntry => ({
      kind: "node",
      id: id(name),
      definitionId: catalogTypeDefinitionId(type) as DefinitionId,
      children,
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const crumb = (name: string) => [
      entry(name, "Breadcrumb", {}, [id(`${name}-label`), id(`${name}-sep`)]),
      entry(`${name}-label`, "Text", {
        children: { kind: "set", value: name },
      }),
      entry(`${name}-sep`, "Icon", {
        slot: { kind: "set", value: "separator" },
        iconName: { kind: "set", value: "chevron-right" },
      }),
    ];
    const scene = await open(
      "lib:definition:type-Breadcrumbs" as DefinitionId,
      "breadcrumb-color",
      {
        children: [id("home"), id("page")],
        nodes: [...crumb("home"), ...crumb("page")],
      },
    );
    const input = (name: string) =>
      [...scene.root.canvasInputs.values()].find(
        (node) => node.sourceId === id(name),
      )!;
    const color = (name: string) =>
      catalogTextMetrics(input(name), input(name.replace(/-label$/, ""))).color;
    // `.react-aria-Link .react-aria-Text { color: inherit }`: the Link's color — catalog
    // `Breadcrumb.colors.text` (neutral-subdued), the current crumb's `[data-current]` accent.
    expect(color("home-label")).toBe(TAILWIND_PALETTE.neutral[600]);
    expect(color("page-label")).toBe("var(--accent)");
  });

  it("derives the calendar heading from the Calendar, not its header child, and lays the header out around it", async () => {
    const id = (name: string) => `project:node:${name}` as NodeId;
    const entry = (
      name: string,
      type: string,
      props: NodeEntry["props"] = {},
    ): NodeEntry => ({
      kind: "node",
      id: id(name),
      definitionId: `lib:definition:type-${type}` as DefinitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const scene = await open(
      "lib:definition:type-Calendar" as DefinitionId,
      "calendar-project",
      {
        children: [id("header"), id("grid")],
        nodes: [
          // The header child's own text/locale are what the old Canvas painted; RAC reads neither.
          entry("header", "CalendarHeader", {
            children: { kind: "set", value: "2026년 9월" },
            locale: { kind: "set", value: "ko-KR" },
          }),
          entry("grid", "CalendarGrid"),
        ],
      },
    );
    const title = (locale: string) =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    // The Calendar sets no locale: the rendering environment's (the DOM consumer's provider).
    const measured: string[] = [];
    const build = (engine: StyleLayoutEngine) =>
      new CatalogCompositionRoot(
        scene.runtime,
        engine,
        { width: 1440, height: 900 },
        undefined,
        undefined,
        (text) => {
          measured.push(text);
          return { width: 120, minWidth: 70, height: 21 };
        },
        "ja-JP",
      );
    const engine = new StyleLayoutEngine();
    const root = build(engine);
    const header = () =>
      [...root.canvasInputs.values()].find(
        (input) => input.sourceId === id("header"),
      )!;
    expect(header().derivedProps?.children).toBe(title("ja-JP"));
    expect(measured).not.toContain("2026년 9월");
    // Header row: two nav buttons (height + spacing-xs: md 34, lg 40 — 4e-11 resets the generic
    // Button `min-width`) + two gaps + the heading's min-content, as tall as the buttons (md 30,
    // lg 36) until the heading wraps.
    const headerStyle = (height: number) =>
      [...engine.styles.values()].filter(
        (style) =>
          style.contentHeight === height && style.contentMinWidth !== undefined,
      );
    const row = 2 * 34 + 2 * Number(header().visual.gap ?? 0) + 70;
    expect(headerStyle(30)).toEqual([
      expect.objectContaining({ contentMinWidth: row, contentMaxWidth: row }),
    ]);
    root.dispatch("calendar size", [
      {
        kind: "patchNodeProp",
        id: scene.nodeId,
        key: "size",
        write: { kind: "set", value: "lg" },
      },
    ]);
    expect(new Map(root.canvasInputs)).toEqual(
      new Map(build(new StyleLayoutEngine()).canvasInputs),
    );
    const lgRow = 2 * 40 + 2 * Number(header().visual.gap ?? 0) + 70;
    expect(headerStyle(36)).toEqual([
      expect.objectContaining({
        contentMinWidth: lgRow,
        contentMaxWidth: lgRow,
      }),
    ]);
    expect(header().derivedProps?.children).toBe(title("ja-JP"));
  });

  it("paints a Button's Icon and Text in the Button's text color in every state (Preview `.button-base > *` inherit)", async () => {
    const id = (name: string) => `project:node:${name}` as NodeId;
    const entry = (
      name: string,
      type: string,
      props: NodeEntry["props"] = {},
    ): NodeEntry => ({
      kind: "node",
      id: id(name),
      definitionId: catalogTypeDefinitionId(type) as DefinitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const scene = await open(
      "lib:definition:type-Button" as DefinitionId,
      "button-child-color",
      {
        children: [id("icon"), id("label")],
        nodes: [
          entry("icon", "Icon", { iconName: { kind: "set", value: "star" } }),
          entry("label", "Text", {
            children: { kind: "set", value: "Button" },
          }),
        ],
      },
    );
    const colors = (state?: "hover" | "pressed") => {
      const root = new CatalogCompositionRoot(
        scene.runtime,
        new StyleLayoutEngine(),
        { width: 1440, height: 900 },
        state,
      );
      const inputs = [...root.canvasInputs.values()];
      const of = (name: string) =>
        inputs.find((node) => node.sourceId === id(name))!;
      return [
        of("subject").visual.color,
        of("icon").visual.color,
        of("label").visual.color,
      ];
    };
    for (const state of [undefined, "hover", "pressed"] as const) {
      const [button, icon, label] = colors(state);
      expect([icon, label]).toEqual([button, button]);
    }
  });

  it("measures a DateInput as the RAC segment row: padded editable parts, literals, and a range's start/end pair around `–`", async () => {
    // Fake measurer: 10px per character, so the expected widths read off the segment text.
    const measure = (text: string) => ({ width: text.length * 10, height: 20 });
    const widthOf = async (definition: string) => {
      const scene = await open(
        definition as DefinitionId,
        `segments-${definition}`,
      );
      const engine = new StyleLayoutEngine();
      const root = new CatalogCompositionRoot(
        scene.runtime,
        engine,
        { width: 1440, height: 900 },
        undefined,
        undefined,
        measure,
        "en-US",
      );
      const input = [...root.canvasInputs.values()].find(
        (node) => node.bindingId === "dateinput",
      )!;
      const trigger = root.canvasInputs.get(input.parentId)!;
      const style = [...engine.styles.values()].filter(
        (entry) => typeof entry.contentMinWidth === "number",
      );
      return { style, gap: Number(trigger.visual.gap ?? 0) };
    };
    // en-US `mm/dd/yyyy`: 10 characters + 3 editable parts × `0 2px` padding.
    const row = 10 * 10 + 3 * 2 * 2;
    const picker = await widthOf("lib:definition:origin-component-datepicker");
    expect(picker.style.some((entry) => entry.contentMinWidth === row)).toBe(
      true,
    );
    const range = await widthOf(
      "lib:definition:origin-component-daterangepicker",
    );
    expect(range.gap).toBeGreaterThan(0);
    expect(
      range.style.some(
        (entry) => entry.contentMinWidth === 2 * row + 2 * range.gap + 10,
      ),
    ).toBe(true);
  });

  it("paints a picker's DateInput as segment text inside the trigger box and its icon from the picker's `iconName` (DOM self-compose)", async () => {
    const pickerScene = async (definition: string) => {
      const scene = await open(
        definition as DefinitionId,
        `paint-${definition}`,
      );
      const input = scene.byType("DateInput")[0]!;
      const shapes = catalogRuleShapes({
        node: input.derivedProps
          ? { ...input, props: { ...input.props, ...input.derivedProps } }
          : input,
        rect: { width: 200, height: 20 },
        rule: scene.runtime.graph.library.rules.get("DateInput" as never)!,
        type: "DateInput",
        authoredVisual: {},
      });
      return { scene, shapes, icon: () => scene.byType("SelectIcon")[0]! };
    };
    const texts = (shapes: ReturnType<typeof catalogRuleShapes>) =>
      shapes.flatMap((shape) =>
        shape.type === "text" ? [(shape as { text: string }).text] : [],
      );
    const boxes = (shapes: ReturnType<typeof catalogRuleShapes>) =>
      shapes.filter(
        (shape) => shape.type === "roundRect" || shape.type === "border",
      );
    const iconName = (node: CatalogConsumerNode) =>
      node.derivedProps?.iconName ?? node.props.iconName;

    // DatePicker: the SelectTrigger draws the box; the DateInput only its segments.
    const picker = await pickerScene(
      "lib:definition:origin-component-datepicker",
    );
    expect(boxes(picker.shapes)).toEqual([]);
    expect(texts(picker.shapes)).toHaveLength(1);
    expect(iconName(picker.icon())).toBe("calendar");
    // The owner's icon edit reaches the trigger icon (incremental = fresh).
    picker.scene.root.dispatch("picker icon", [
      {
        kind: "patchNodeProp",
        id: picker.scene.nodeId,
        key: "iconName",
        write: { kind: "set", value: "clock" },
      },
    ]);
    expect(iconName(picker.icon())).toBe("clock");
    expect(new Map(picker.scene.root.canvasInputs)).toEqual(
      picker.scene.fresh(),
    );

    // DateRangePicker: one typed DateInput is RAC's start/end pair.
    const range = await pickerScene(
      "lib:definition:origin-component-daterangepicker",
    );
    expect(boxes(range.shapes)).toEqual([]);
    expect(texts(range.shapes)[0]).toContain("–");
    expect(iconName(range.icon())).toBe("calendar");

    // A standalone DateField's DateInput stays its own field box.
    const field = await pickerScene(
      "lib:definition:origin-component-datefield",
    );
    expect(boxes(field.shapes).length).toBeGreaterThan(0);
  });

  it("sizes a glyph by its authored fontSize over the size scale's iconSize (Preview renderIcon)", async () => {
    const scene = await open(
      "lib:definition:type-Icon" as DefinitionId,
      "glyph-project",
    );
    const base = (engine: StyleLayoutEngine) =>
      [...engine.styles.values()].find(
        (style) => typeof style.contentMinWidth === "number",
      )?.contentMinWidth;
    const scale = scene.byType("Icon")[0]!.visual.iconSize;
    expect(base(scene.engine)).toBe(scale);
    scene.root.dispatch("icon font size", [
      {
        kind: "patchNodeVisual",
        id: scene.nodeId,
        key: "fontSize",
        write: { kind: "set", value: 18 },
      },
    ]);
    expect(18).not.toBe(scale);
    expect(
      [...scene.engine.styles.values()].some(
        (style) => style.contentMinWidth === 18 && style.contentHeight === 18,
      ),
    ).toBe(true);
  });
});
