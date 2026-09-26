// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { buildCanvasSceneGraph } from "./canvasSceneNode";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import { toCollectionRowProjectionId } from "../../../projection/renderProjectionIds";

/**
 * ADR-233 Phase 1 — Tabs 의 Tab 항목 템플릿 origin (ADR-229 Tag 선례 복제).
 *
 * Tab 은 ADR-066 뒤 `items [{id,title}]` 데이터로만 만들어지고, 행 projection 이 Tab catalog rule +
 * items 로만 Tab 을 합성했다 (`templateOriginId: null`). 이 스위트는 `component-tabs` root `slot` 이
 * 가리키는 Tab 항목 origin (Default · Selected) 의 root style · label slot style · fills 가 Tab 행에
 * 실리는지 고정한다. 선택 판정 (`selectedKey ?? defaultSelectedKey`) 은 그대로다.
 */

const ITEMS = [
  { id: "t1", title: "One" },
  { id: "t2", title: "Two" },
  { id: "t3", title: "Three" },
];

function tabItemOrigin(
  id: string,
  variant: "default" | "selected",
  input: {
    style?: Record<string, unknown>;
    labelStyle?: Record<string, unknown>;
    fills?: unknown[];
  },
): CanonicalNode {
  return {
    id,
    type: "Tab",
    reusable: true,
    props: { title: "{label}", style: input.style ?? {} },
    ...(input.fills ? { fills: input.fills } : {}),
    children: [
      {
        id: `${id}__label`,
        type: "Text",
        props: {
          slot: "label",
          children: "{label}",
          ...(input.labelStyle ? { style: input.labelStyle } : {}),
        },
        metadata: { slotRole: "label" },
      } as unknown as CanonicalNode,
    ],
    metadata: { type: "tab-template-origin", variant },
  } as CanonicalNode;
}

function tabsNode(
  id: string,
  input: { reusable?: boolean; slot?: string[]; selectedKey?: string },
): CanonicalNode {
  const selectedKey = input.selectedKey ?? "t2";
  return {
    id,
    type: "Tabs",
    ...(input.reusable ? { reusable: true } : {}),
    ...(input.slot ? { slot: input.slot } : {}),
    props: { items: ITEMS, defaultSelectedKey: selectedKey },
    children: [
      {
        id: `${id}__list`,
        type: "TabList",
        // propagation 뒤 모양 (production) — items/selectedKey 가 TabList 에 실린다.
        props: { items: ITEMS, defaultSelectedKey: selectedKey },
      },
      {
        id: `${id}__panels`,
        type: "TabPanels",
        props: {},
        children: ITEMS.map((item) => ({
          id: `${id}__panel-${item.id}`,
          type: "TabPanel",
          props: { itemId: item.id },
        })),
      },
    ],
  } as CanonicalNode;
}

function makeDoc(input: {
  origins: CanonicalNode[];
  slot?: string[];
  instance?: boolean;
  plainSlot?: string[];
}): CompositionDocument {
  const origin = tabsNode("component-tabs", {
    reusable: true,
    slot: input.slot,
  });
  const pageChildren: CanonicalNode[] = input.instance
    ? [
        {
          id: "tabs-inst",
          type: "ref",
          ref: "component-tabs",
          props: {},
        } as CanonicalNode,
      ]
    : // plain Tabs 도 자기 root slot 을 먼저 읽는다 (Tag 선례 — slot 없으면 표준 origin id 상수).
      [tabsNode("tabs-1", { slot: input.plainSlot ?? input.slot })];
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "body-components",
            type: "Body",
            props: {},
            children: [...input.origins, origin],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          { id: "body-1", type: "Body", props: {}, children: pageChildren },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

const SLOT = ["component-tab-item-default", "component-tab-item-selected"];

function defaultOrigins(): CanonicalNode[] {
  return [
    tabItemOrigin("component-tab-item-default", "default", {
      // 저작 layout 키 (display/gap/width) 는 Tab 행에 싣지 않는다 (Tag 선례).
      style: {
        display: "flex",
        gap: 4,
        width: "fit-content",
        paddingLeft: 20,
        paddingRight: 20,
      },
      labelStyle: { fontWeight: 700 },
      fills: [
        {
          id: "f1",
          type: "color",
          enabled: true,
          opacity: 1,
          color: "#11223344",
        },
      ],
    }),
    tabItemOrigin("component-tab-item-selected", "selected", {
      style: { borderColor: "#ff0000" },
    }),
  ];
}

function tabsOf(doc: CompositionDocument, tabListId: string) {
  const graph = buildCanvasSceneGraph(doc, { activeBreakpoint: "desktop" });
  const byKey = (key: string) =>
    graph.nodesMap.get(toCollectionRowProjectionId("tab", tabListId, key));
  return { graph, t1: byKey("t1")!, t2: byKey("t2")!, t3: byKey("t3")! };
}

describe("ADR-233 Phase 1 — Tab 항목 템플릿 origin (Skia 행 projection)", () => {
  it("plain Tabs — Tab 행에 default origin root style (layout 키 제외) + label typography · fills · templateOriginId", () => {
    const { t1, t2 } = tabsOf(
      makeDoc({ origins: defaultOrigins(), slot: SLOT }),
      "tabs-1__list",
    );
    expect(t1.projection).toMatchObject({
      kind: "tab-row",
      templateOriginId: "component-tab-item-default",
    });
    expect(t1.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      // 생성 CSS Tab 고정 높이 (md 29) 를 하한으로 — DOM 과 같은 shared 규칙.
      minHeight: 29,
      paddingLeft: 20,
      paddingRight: 20,
      fontWeight: 700,
    });
    expect(t1.fills).toEqual([
      {
        id: "f1",
        type: "color",
        enabled: true,
        opacity: 1,
        color: "#11223344",
      },
    ]);
    // 선택 판정 불변 — defaultSelectedKey t2 → selected origin overlay.
    expect(t2.props._isSelected).toBe(true);
    expect(t2.projection).toMatchObject({
      templateOriginId: "component-tab-item-selected",
    });
    expect(t2.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      // 생성 CSS Tab 고정 높이 (md 29) 를 하한으로 — DOM 과 같은 shared 규칙.
      minHeight: 29,
      paddingLeft: 20,
      paddingRight: 20,
      fontWeight: 700,
      borderColor: "#ff0000",
    });
  });

  it("ref instance — synthetic TabList 는 master `component-tabs.slot` 을 읽는다", () => {
    // instance 의 synthetic 자식 projection 은 `buildCanonicalSceneModel` (ref 해소 뒤 pass) 이 붙인다.
    const model = buildCanonicalSceneModel(
      makeDoc({ origins: defaultOrigins(), slot: SLOT, instance: true }),
      { activeBreakpoint: "desktop" },
    );
    const byKey = (key: string) =>
      model.sceneNodesMap.get(
        toCollectionRowProjectionId(
          "tab",
          "tabs-inst/component-tabs__list",
          key,
        ),
      )!;
    expect(byKey("t1").projection).toMatchObject({
      templateOriginId: "component-tab-item-default",
    });
    expect(byKey("t1").props.style).toMatchObject({
      paddingLeft: 20,
      fontWeight: 700,
    });
    expect(byKey("t2").projection).toMatchObject({
      templateOriginId: "component-tab-item-selected",
    });
  });

  it("slot 이 origin 순서를 바꾸면 그 순서를 따른다 (slot[0] = default)", () => {
    const origins = [
      ...defaultOrigins(),
      tabItemOrigin("custom-tab-item", "default", {
        style: { paddingLeft: 3 },
      }),
    ];
    const { t1 } = tabsOf(
      makeDoc({
        origins,
        slot: ["custom-tab-item", "component-tab-item-selected"],
      }),
      "tabs-1__list",
    );
    expect(t1.projection).toMatchObject({
      templateOriginId: "custom-tab-item",
    });
    expect(t1.props.style).toMatchObject({ paddingLeft: 3 });
  });

  it("plain Tabs 에 slot 이 없으면 표준 origin id 상수로 해석한다", () => {
    const doc = makeDoc({ origins: defaultOrigins(), slot: SLOT });
    const plain = doc.children[1].children![0].children![0] as CanonicalNode;
    delete (plain as { slot?: unknown }).slot;
    const { t1, t2 } = tabsOf(doc, "tabs-1__list");
    expect(t1.projection).toMatchObject({
      templateOriginId: "component-tab-item-default",
    });
    expect(t2.projection).toMatchObject({
      templateOriginId: "component-tab-item-selected",
    });
  });

  it("origin 이 문서에 없으면 종전 Tab (style = fit-content 만 · templateOriginId null · fills 없음)", () => {
    const { t1 } = tabsOf(makeDoc({ origins: [] }), "tabs-1__list");
    expect(t1.props.style).toEqual({ width: "fit-content" });
    expect(t1.projection).toMatchObject({ templateOriginId: null });
    expect(t1.fills).toBeUndefined();
  });
});
