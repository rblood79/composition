import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
  routeIndicatorFillStyle,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";
import {
  createTabTemplateResolver,
  indexTemplateOriginRecords,
} from "../../utils/itemTemplates";
import { buildSpecNodeData } from "../../../builder/workspace/canvas/skia/buildSpecNodeData";
import {
  buildStateVariantProjection,
  collectStateVariantCss,
} from "../../../builder/components/stateVariantResolution";
import { buildCanvasSceneGraph } from "../../../builder/workspace/canvas/scene/canvasSceneNode";
import { toCollectionRowProjectionId } from "../../../builder/projection/renderProjectionIds";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";

/**
 * ADR-233 리뷰 round 3 — h1 (Radio 채움 영역) · m2 (Tabs 마다 자기 slot).
 *
 * h1: catalog 정본은 Radio `fill.default.selected` 를 선택 표시 색으로 정의하고 Skia `radio` primitive
 *   도 root 배경색을 선택 점에만 칠한다 (행 배경 없음). DOM 은 같은 색을 RAC 행 배경이 아니라
 *   `--radio-color` (Radio.css 가 선택 표시를 그리는 변수) 로 보내야 두 leg 가 같은 곳을 칠한다.
 *   상태 변형 CSS · instance inline 두 경로 모두.
 * m2: 문서 Tabs 는 자기 slot, ref instance 는 master slot 으로 Tab 항목 template 을 고른다 (Canvas
 *   `resolveTabTemplateOriginIds` 와 같은 규칙). 종전 Preview 는 문서 전역 1개만 써서 사용자 slot 을
 *   무시했다 (Canvas 47 ↔ Preview 20).
 */

afterEach(cleanup);

const RED = "#ff0000";
const redFill = {
  id: "red",
  type: "color",
  color: RED,
  enabled: true,
  opacity: 1,
};

function skiaFills(data: ReturnType<typeof buildSpecNodeData>) {
  return {
    root: Array.from(data?.box?.fillColor ?? []),
    children: (data?.children ?? []).map((child) =>
      Array.from(child.box?.fillColor ?? []),
    ),
  };
}

const isRed = (rgba: number[]) =>
  rgba[0] === 1 && rgba[1] === 0 && rgba[2] === 0 && (rgba[3] ?? 1) > 0;

function renderRadio(node: ResolvedNode, css = "") {
  return render(
    <>
      <style>{css}</style>
      <CanonicalNodeRenderer
        node={node}
        cutoverPrimitives={getCatalogCutoverTypes()}
        renderContext={
          {
            childrenByParent: new Map(),
            renderElement: () => null,
          } as unknown as RenderContext
        }
      />
    </>,
  );
}

describe("ADR-233 round 3 h1 — Radio 채움 = 선택 표시 (두 leg 같은 영역)", () => {
  it("Radio/Selected fills — Skia 는 선택 점만, 상태 CSS 는 --radio-color (행 background 0)", () => {
    const master = {
      id: "component-radio",
      type: "Radio",
      reusable: true,
      props: { value: "r" },
    } as unknown as CanonicalNode;
    const variant = {
      id: "component-radio--selected",
      type: "Radio",
      reusable: true,
      props: { style: {} },
      fills: [redFill],
      metadata: { variant: "selected", variantOf: master.id },
    } as unknown as CanonicalNode;
    const byId = new Map([
      [master.id, master],
      [variant.id, variant],
    ]);
    const projection = buildStateVariantProjection(master, undefined, (id) =>
      byId.get(id),
    );
    const node = {
      id: "instance-radio",
      type: "Radio",
      props: {
        value: "r",
        children: "Radio",
        isSelected: true,
        _stateVariants: projection,
      },
      parent_id: null,
      page_id: "page-1",
    };

    const skia = skiaFills(
      buildSpecNodeData({
        element: node,
        layout: { x: 0, y: 0, width: 120, height: 24 },
        theme: "light",
        elementsMap: new Map([[node.id, node]]),
      } as never),
    );
    expect(isRed(skia.root)).toBe(false);
    expect(skia.children.filter(isRed)).toHaveLength(1); // 선택 점

    const css = collectStateVariantCss({
      version: "composition-1.0",
      children: [master, variant],
    } as CompositionDocument);
    expect(css).toMatch(/--radio-color:#ff0000/i);
    expect(css).not.toMatch(/background/i);

    const { container } = renderRadio(node as unknown as ResolvedNode, css);
    const radio = container.querySelector(".react-aria-Radio")!;
    expect(radio.getAttribute("data-state-origin")).toBe(master.id);
    expect(radio.hasAttribute("data-selected")).toBe(true);
    expect(radio.getAttribute("style") ?? "").not.toMatch(/background/);
  });

  it("Radio 자기 fills (plain · 변형 origin 자신) — DOM inline 은 --radio-color, Skia 는 선택 점", () => {
    const node = {
      id: "plain-radio",
      type: "Radio",
      props: { value: "r", children: "Radio", isSelected: true },
      fills: [redFill],
      parent_id: null,
      page_id: "page-1",
    };
    const skia = skiaFills(
      buildSpecNodeData({
        element: node,
        layout: { x: 0, y: 0, width: 120, height: 24 },
        theme: "light",
        elementsMap: new Map([[node.id, node]]),
      } as never),
    );
    expect(isRed(skia.root)).toBe(false);
    expect(skia.children.filter(isRed)).toHaveLength(1);

    const { container } = renderRadio(node as unknown as ResolvedNode);
    const radio = container.querySelector<HTMLElement>(".react-aria-Radio")!;
    expect(radio.style.backgroundColor).toBe("");
    expect(radio.style.getPropertyValue("--radio-color").toLowerCase()).toBe(
      RED,
    );
  });

  it("표 밖 타입은 행 background 그대로 — shared 표 (`INDICATOR_FILL_CSS_VAR`) 가 경계", () => {
    const style = { backgroundColor: RED, paddingLeft: 4 };
    expect(routeIndicatorFillStyle("Checkbox", style)).toBe(style);
    expect(routeIndicatorFillStyle("Button", style)).toBe(style);
    expect(routeIndicatorFillStyle("Radio", style)).toEqual({
      paddingLeft: 4,
      "--radio-color": RED,
    });
  });
});

// ── m2 ─────────────────────────────────────────────────────────────────────

const ITEMS = [
  { id: "t1", title: "One" },
  { id: "t2", title: "Two" },
];

function tabItemOrigin(
  id: string,
  variant: "default" | "selected",
  style: Record<string, unknown>,
): CanonicalNode {
  return {
    id,
    type: "Tab",
    reusable: true,
    props: { title: "{label}", style },
    children: [
      {
        id: `${id}__label`,
        type: "Text",
        props: { slot: "label", children: "{label}" },
        metadata: { slotRole: "label" },
      },
    ],
    metadata: { type: "tab-template-origin", variant },
  } as unknown as CanonicalNode;
}

function tabsNode(
  id: string,
  input: { reusable?: boolean; slot?: string[] },
): CanonicalNode {
  return {
    id,
    type: "Tabs",
    ...(input.reusable ? { reusable: true } : {}),
    ...(input.slot ? { slot: input.slot } : {}),
    props: { items: ITEMS, defaultSelectedKey: "t2" },
    children: [
      {
        id: `${id}__list`,
        type: "TabList",
        props: { items: ITEMS, defaultSelectedKey: "t2" },
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
  } as unknown as CanonicalNode;
}

const STANDARD_SLOT = [
  "component-tab-item-default",
  "component-tab-item-selected",
];

function makeTabsDoc(): CompositionDocument {
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
            children: [
              tabItemOrigin("component-tab-item-default", "default", {
                paddingLeft: 20,
              }),
              tabItemOrigin("component-tab-item-selected", "selected", {}),
              tabItemOrigin("user-tab-default", "default", { paddingLeft: 47 }),
              tabsNode("component-tabs", {
                reusable: true,
                slot: STANDARD_SLOT,
              }),
            ],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [
              // 사용자 slot 을 가진 문서 Tabs · slot 없는 문서 Tabs · 표준 instance
              tabsNode("tabs-user", {
                slot: ["user-tab-default", STANDARD_SLOT[1]],
              }),
              tabsNode("tabs-plain", {}),
              {
                id: "tabs-inst",
                type: "ref",
                ref: "component-tabs",
                props: {},
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

function canvasTabPaddingLeft(
  doc: CompositionDocument,
  tabListId: string,
): unknown {
  const graph = buildCanvasSceneGraph(doc, { activeBreakpoint: "desktop" });
  const row = graph.nodesMap.get(
    toCollectionRowProjectionId("tab", tabListId, "t1"),
  );
  return (row?.props.style as Record<string, unknown> | undefined)?.paddingLeft;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

describe("ADR-233 round 3 m2 — Preview Tabs 는 자기 slot 의 template", () => {
  it("사용자 slot 47 · slot 없음 20 · instance (master slot) 20 — Canvas 와 Preview DOM 이 Tabs 마다 같다", () => {
    const doc = makeTabsDoc();
    const expected = {
      "tabs-user": 47,
      "tabs-plain": 20,
    } as const;
    expect(canvasTabPaddingLeft(doc, "tabs-user__list")).toBe(47);
    expect(canvasTabPaddingLeft(doc, "tabs-plain__list")).toBe(20);

    const resolved = resolveCanonicalDocument(doc) as ResolvedNode[];
    const resolver = createTabTemplateResolver(
      indexTemplateOriginRecords(resolved),
    );
    const ctx = {
      childrenByParent: new Map(),
      renderElement: () => null,
      updateElementProps: () => {},
      // App 이 문서 전역 기본값으로 넣는 값 — Tabs 마다 resolveTabTemplate 이 덮는다.
      tabTemplate: resolver.forSlot(STANDARD_SLOT),
      resolveTabTemplate: resolver.forOwner,
    } as unknown as RenderContext;

    const domPadding = (id: string) => {
      const node = findResolved(resolved, id)!;
      const { container, unmount } = render(
        <CanonicalNodeRenderer
          node={node}
          renderContext={ctx}
          cutoverPrimitives={getCatalogCutoverTypes()}
        />,
      );
      const tab = container.querySelector<HTMLElement>(
        '.react-aria-Tab[data-key="t1"]',
      );
      const value = tab?.style.paddingLeft;
      unmount();
      return value;
    };
    for (const [id, px] of Object.entries(expected)) {
      expect(domPadding(id), id).toBe(`${px}px`);
    }
    expect(domPadding("tabs-inst")).toBe("20px");
  });
});
