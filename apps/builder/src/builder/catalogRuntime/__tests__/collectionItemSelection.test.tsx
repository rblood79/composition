// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
  setHtmlId,
  setSiteSettings,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { SEGMENTED_INDICATOR_BORDER } from "../../../../../../packages/shared/src/catalog/rule/segmentedControl";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-13 (사용자 「static으로 추가된 listboxitem 인경우 상태 선택 selected, default 등을
 * 선택할수있어야하지않나」 → 「권장안 1진행해. listbox만 문제가 아니라 동일한 패턴 이더 있다 모두
 * 수정해」): a static collection item picks its selection in the Design panel — its Selected
 * (`isSelected`, as a Tag's) starts its collection's RAC selection (`defaultSelectedKeys`; a Tabs'
 * `defaultSelectedKey`), and the Canvas paints the same items selected. Before, ListBox read a
 * `selectedKey` nothing could write, and GridList · Tree · Table · Menu started from none.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:collection" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(
  definition: string,
  item: string,
  ownerProps: Record<string, unknown> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:item-selection" as EntryId<"project">,
        name: "Item selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `item-selection-${Math.random()}`),
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
          definitionId:
            `lib:definition:origin-component-${definition}` as DefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(ownerProps).map(([key, value]) => [key, set(value)]),
          ),
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
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const items = () => of(item);
  const target = (id: string) => workspace.positionOfRecord(id)!.target;
  const select = (index: number, value = true) =>
    workspace.execute(
      setFields({
        targets: [target(items()[index]!.id)],
        props: { isSelected: set(value) },
      }),
    );
  const canvasSelected = () =>
    items().map((record) =>
      catalogStateValue(
        record,
        "isSelected",
        (id) => root.canvasInputs.get(id),
        (record) => root.typeOf(record),
      ),
    );
  // (The Table origin's body is empty — rows come from its "+", as the author adds them.)
  const addRows = async (count: number) => {
    const { catalogItemInsertChoices } = await import("../itemInsert");
    for (let index = 0; index < count; index++) {
      const choice = catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(of("TableBody")[0]!.id)!,
      ).find((option) => option.type === "Row")!;
      workspace.execute(choice.build());
    }
  };
  return { workspace, root, of, items, select, canvasSelected, addRows };
}

async function mount(
  root: Awaited<ReturnType<typeof open>>["root"],
  type: string,
) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const record = [...root.domInputs.values()].find(
    (r) => root.typeOf(r) === type,
  )!;
  await act(async () => reactRoot.render(renderCatalogDom(root, record.id)));
  const close = async () => {
    await act(async () => reactRoot.unmount());
    host.remove();
  };
  return { host, close };
}

const selectedOf = (elements: Iterable<Element>, attribute = "aria-selected") =>
  [...elements].map((element) => element.getAttribute(attribute) === "true");

describe("a collection item's Selected starts its collection's selection (Canvas = Preview)", () => {
  it("SegmentedControl의 긴 Label은 기본 줄임을 사용하고 사용자 변경과 Undo를 반영한다", async () => {
    const { workspace, root, items, of } = await open(
      "segmentedcontrol",
      "SegmentedControlItem",
      { isJustified: true },
    );
    let dom: Awaited<ReturnType<typeof mount>> | undefined;
    let canvas: ReturnType<typeof bindCatalogCanvas> | undefined;
    try {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: OWNER }],
          sizing: { width: set(220) },
        }),
      );
      const item = items()[0]!;
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(item.id)!.target],
          props: {
            label: set(
              "아주 긴 Label과 English text가 제한된 폭 안에서 잘립니다",
            ),
          },
        }),
      );
      const label = () =>
        of("Text").find(
          (node) => root.canvasInputs.get(node.parentId)?.parentId === item.id,
        )!;
      expect(label().visual).toMatchObject({
        minWidth: 0,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      });
      canvas = bindCatalogCanvas(root, root.pageRootRecords());
      expect(getSkiaNode(label().id)?.text).toMatchObject({
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        clipText: true,
      });
      dom = await mount(root, "SegmentedControl");
      const text = dom.host.querySelector<HTMLElement>(
        `[data-catalog-id="${label().id}"]`,
      )!;
      expect(text.style.textOverflow).toBe("ellipsis");
      await dom.close();
      dom = undefined;
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(label().id)!.target],
          visual: { textOverflow: set("clip") },
        }),
      );
      expect(label().visual.textOverflow).toBe("clip");
      workspace.undo();
      expect(label().visual.textOverflow).toBe("ellipsis");
    } finally {
      await dom?.close();
      canvas?.dispose();
      workspace.dispose();
    }
  });

  it("SegmentedControl의 기본 모서리와 작성 모서리를 실제 Canvas 도형에 반영한다", async () => {
    const { workspace, root, of } = await open(
      "segmentedcontrol",
      "SegmentedControlItem",
    );
    const group = () => of("SegmentedControl")[0]!;
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    const radiusOf = () => {
      binding.update();
      return getSkiaNode(group().id)?.box?.borderRadius;
    };
    try {
      expect(radiusOf()).toBe(8);
      for (const radius of [18, 0]) {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: OWNER }],
            visual: { radius: set(radius) },
          }),
        );
        expect(radiusOf()).toBe(radius);
        workspace.undo();
        expect(radiusOf()).toBe(8);
      }
    } finally {
      binding.dispose();
      workspace.dispose();
    }
  });

  it.each(["horizontal", "vertical"])(
    "SegmentedControl Justified는 %s 축의 항목을 균등 배치하고 Undo로 복원한다",
    async (orientation) => {
      const { workspace, root, items } = await open(
        "segmentedcontrol",
        "SegmentedControlItem",
        { orientation },
      );
      const target = { kind: "node" as const, id: OWNER };
      const axis = orientation === "horizontal" ? "width" : "height";
      const lengths = () =>
        items().map((node) => root.getGeometry([node.id]).get(node.id)![axis]);
      try {
        workspace.execute(
          setFields({
            targets: [target],
            sizing: { width: set(440), height: set(180) },
          }),
        );
        const initial = lengths();
        workspace.execute(
          setFields({ targets: [target], props: { isJustified: set(true) } }),
        );
        expect(items().map((node) => node.derivedProps?._justified)).toEqual([
          true,
          true,
        ]);
        expect(lengths()[0]).toBeCloseTo(lengths()[1], 3);
        expect(lengths()[0]).toBeCloseTo(
          ((axis === "width" ? 440 : 180) - 4) / 2,
          3,
        );
        workspace.undo();
        expect(lengths()).toEqual(initial);
        workspace.redo();
        expect(lengths()[0]).toBeCloseTo(lengths()[1], 3);
      } finally {
        workspace.dispose();
      }
    },
  );

  it("SegmentedControl Justified의 Hug 폭에서도 항목 폭을 균등하게 만든다", async () => {
    const { workspace, root, items } = await open(
      "segmentedcontrol",
      "SegmentedControlItem",
    );
    const widths = () =>
      items().map((node) => root.getGeometry([node.id]).get(node.id)!.width);
    let dom: Awaited<ReturnType<typeof mount>> | undefined;
    try {
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(items()[0].id)!.target],
          sizing: { width: set(40) },
        }),
      );
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(items()[1].id)!.target],
          sizing: { width: set(120) },
        }),
      );
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: OWNER }],
          props: { isJustified: set(true) },
        }),
      );
      expect(widths()[0]).toBeCloseTo(widths()[1], 3);
      expect(widths()[0]).toBeCloseTo(80, 3);
      dom = await mount(root, "SegmentedControl");
      expect(
        dom.host
          .querySelector('[role="radiogroup"]')
          ?.hasAttribute("data-justified"),
      ).toBe(true);
    } finally {
      await dom?.close();
      workspace.dispose();
    }
  });

  it("SegmentedControl의 CJK 기본 행간과 사용자 행간이 DOM에도 반영된다", async () => {
    const { workspace, root, items } = await open(
      "segmentedcontrol",
      "SegmentedControlItem",
    );
    let dom: Awaited<ReturnType<typeof mount>> | undefined;
    try {
      workspace.execute(setSiteSettings({ patch: { lang: "ko-KR" } }));
      expect(items()[0].visual.lineHeight).toBe(1.5);
      dom = await mount(root, "SegmentedControl");
      expect(
        (dom.host.querySelector('[role="radio"]') as HTMLElement).style
          .lineHeight,
      ).toBe("1.5");
      await dom.close();
      dom = undefined;
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(items()[0].id)!.target],
          visual: { lineHeight: set(2) },
        }),
      );
      dom = await mount(root, "SegmentedControl");
      expect(
        (dom.host.querySelector('[role="radio"]') as HTMLElement).style
          .lineHeight,
      ).toBe("2");
    } finally {
      await dom?.close();
      workspace.dispose();
    }
  });

  it("SegmentedControl의 disabled 테두리와 사용자 편집은 같은 부품 정본을 따른다", async () => {
    const { workspace, root, of } = await open(
      "segmentedcontrol",
      "SegmentedControlItem",
    );
    const indicator = () => of("SelectionIndicator")[0];
    const group = { kind: "node" as const, id: OWNER };
    try {
      expect(indicator().visual.borderColor).toBe(
        SEGMENTED_INDICATOR_BORDER.default,
      );
      workspace.execute(
        setFields({ targets: [group], props: { isDisabled: set(true) } }),
      );
      expect(indicator().visual.borderColor).toBe(
        SEGMENTED_INDICATOR_BORDER.isDisabled,
      );
      workspace.undo();
      expect(indicator().visual.borderColor).toBe(
        SEGMENTED_INDICATOR_BORDER.default,
      );
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(indicator().id)!.target],
          visual: { borderColor: set("#123456") },
        }),
      );
      workspace.execute(
        setFields({ targets: [group], props: { isDisabled: set(true) } }),
      );
      expect(indicator().visual.borderColor).toBe("#123456");
    } finally {
      workspace.dispose();
    }
  });

  it.each([{}, { defaultSelectedKey: "second" }])(
    "SegmentedControl의 작성 HTML id는 RAC 선택 key를 바꾸지 않는다 (%j)",
    async (props) => {
      const { workspace, root, items, canvasSelected } = await open(
        "segmentedcontrol",
        "SegmentedControlItem",
        props,
      );
      let dom: Awaited<ReturnType<typeof mount>> | undefined;
      try {
        for (const [index, item] of items().entries()) {
          const target = workspace.positionOfRecord(item.id)!.target;
          expect(target.kind).toBe("node");
          if (target.kind === "node")
            workspace.execute(
              setHtmlId({ id: target.id, htmlId: `custom-segment-${index}` }),
            );
        }
        const expected = props.defaultSelectedKey
          ? [false, true]
          : [true, false];
        expect(canvasSelected()).toEqual(expected);
        dom = await mount(root, "SegmentedControl");
        expect(
          selectedOf(
            dom.host.querySelectorAll('[role="radio"]'),
            "aria-checked",
          ),
        ).toEqual(expected);
        expect(
          dom.host.querySelectorAll(".react-aria-SelectionIndicator"),
        ).toHaveLength(1);
      } finally {
        await dom?.close();
        workspace.dispose();
      }
    },
  );

  it.each([
    {
      definition: "listbox",
      owner: "ListBox",
      item: "ListBoxItem",
      rows: '[role="option"]',
    },
    {
      definition: "gridlist",
      owner: "GridList",
      item: "GridListItem",
      rows: '[role="row"]',
    },
    {
      definition: "table",
      owner: "Table",
      item: "Row",
      rows: 'tbody [role="row"]',
    },
  ])(
    "$owner: the items set Selected, while it selects",
    async ({ definition, owner, item, rows }) => {
      const { root, items, select, canvasSelected, addRows } = await open(
        definition,
        item,
        { selectionMode: "multiple" },
      );
      if (owner === "Table") await addRows(3);
      expect(items().length).toBeGreaterThanOrEqual(2);
      select(1);
      const expected = items().map((_, index) => index === 1);
      expect(canvasSelected()).toEqual(expected);
      const dom = await mount(root, owner);
      expect(selectedOf(dom.host.querySelectorAll(rows))).toEqual(expected);
      await dom.close();
    },
  );

  it.each([
    { definition: "listbox", owner: "ListBox", item: "ListBoxItem" },
    { definition: "gridlist", owner: "GridList", item: "GridListItem" },
  ])(
    "$owner selecting nothing shows no selected item (RAC), on the Canvas too",
    async ({ definition, owner, item }) => {
      const { root, items, select, canvasSelected } = await open(
        definition,
        item,
        { selectionMode: "none" },
      );
      select(0);
      expect(canvasSelected()).toEqual(items().map(() => false));
      const dom = await mount(root, owner);
      expect(dom.host.querySelectorAll('[aria-selected="true"]')).toHaveLength(
        0,
      );
      await dom.close();
    },
  );

  it("Tree: a TreeItem set Selected (its default single selection)", async () => {
    const { root, items, select, canvasSelected } = await open(
      "tree",
      "TreeItem",
    );
    // (The first row — the top-level `item-1`; `items()` lists its nested item first.)
    const first = items().findIndex((record) => record.props.id === "item-1");
    select(first);
    expect(canvasSelected()).toEqual(
      items().map((_, index) => index === first),
    );
    const dom = await mount(root, "Tree");
    const rows = [...dom.host.querySelectorAll('[role="row"]')];
    expect(rows[0]!.getAttribute("data-key")).toBe("item-1");
    expect(selectedOf(rows)).toEqual(rows.map((_, index) => index === 0));
    await dom.close();
  });

  it("Menu: a MenuItem set Selected is checked while the Menu selects", async () => {
    const { root, items, select, canvasSelected } = await open(
      "menu",
      "MenuItem",
      { selectionMode: "multiple" },
    );
    select(1);
    const expected = items().map((_, index) => index === 1);
    expect(canvasSelected()).toEqual(expected);
    const dom = await mount(root, "Menu");
    expect(
      selectedOf(
        dom.host.querySelectorAll('[role="menuitemcheckbox"]'),
        "aria-checked",
      ),
    ).toEqual(expected);
    await dom.close();
  });

  it("Tabs: the first Tab set Selected is the selected Tab (single)", async () => {
    const { root, items, select, canvasSelected } = await open("tabs", "Tab");
    select(1);
    const expected = items().map((_, index) => index === 1);
    expect(canvasSelected()).toEqual(expected);
    const dom = await mount(root, "Tabs");
    expect(selectedOf(dom.host.querySelectorAll('[role="tab"]'))).toEqual(
      expected,
    );
    await dom.close();
  });
});
