// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  buildCanvasSceneGraph,
  buildCanvasScenePageIndex,
  resolveGridListTemplateOriginId,
  resolveTagItemTemplateStyle,
  resolveTagTemplateOriginIds,
  type CollectionWindowResolution,
} from "./canvasSceneNode";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import type { CanonicalNode } from "@composition/shared";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
  toListBoxSpacerProjectionId,
  toCollectionRowProjectionId,
  toCollectionRowsGroupProjectionId,
  toCollectionCellProjectionId,
} from "../../../projection/renderProjectionIds";

/**
 * page + reusable frame 적용 시나리오 회귀 차단 test.
 *
 * ADR-116 canonical format 전환 후 legacy 경로 제거 중 발견된 회귀:
 * - page Properties 패널에서 Frame 등록 → page 투명 / Frame slot 사라짐 / Layers body 중복
 * - root cause: scene graph ↔ canonical document SSOT 정합 gap 3-layer
 *   (isPagePlaceholderNode / getNodeScope / includeReusableFrames option)
 *
 * 동일 회귀 재발 차단을 위한 fixture.
 */
describe("buildCanvasSceneGraph — page + reusable frame 시나리오", () => {
  function makeBoundPageDocument(): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body-1",
              type: "Body",
              props: {},
              children: [
                {
                  id: "frame-slot-1",
                  type: "Text",
                  props: { children: "frame slot" },
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          name: "Page 1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
        },
      ],
    } as unknown as CompositionDocument;
  }

  it("includeReusableFrames=true: master frame 이 nodesMap 에 등록되어 ref resolution lookup 이 가능하다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    // master 가 nodesMap 에 있어야 resolveCanonicalRefMaster 가 lookup 가능
    expect(graph.nodesMap.has("layout-frame-1")).toBe(true);
    // page-bound ref 도 scene 에 포함 (isPagePlaceholderNode 에서 제외됨)
    expect(graph.nodesMap.has("page-1")).toBe(true);
  });

  it("includeReusableFrames=false (default): master frame 이 nodesMap 에서 제외되어 Layers 중복을 차단한다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc);

    // master 는 일반 view 에서 보이면 안 됨 (Layers body 중복 차단)
    expect(graph.nodesMap.has("layout-frame-1")).toBe(false);
  });

  it("getNodeScope: frame-bound page ref 가 page scope 를 유지한다 (descendants 의 pageId 상속)", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    const pageRef = graph.nodesMap.get("page-1");
    // page ref 자체는 pageId scope = "page-1"
    expect(pageRef?.pageId).toBe("page-1");
    expect(pageRef?.layoutId).toBeNull();
  });

  it("buildCanvasScenePageIndex: master frame children 은 layoutId scope 이므로 pageIndex 에서 제외된다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    const pageIndex = buildCanvasScenePageIndex(graph);

    // master children (layoutId scope, pageId=null) 은 pageIndex 진입 금지
    // (Skia 가 master 를 직접 렌더하지 않고 synthetic 경로만 사용)
    const page1Elements = pageIndex.elementsByPage.get("page-1") ?? new Set();
    expect(page1Elements.has("frame-body-1")).toBe(false);
    expect(page1Elements.has("frame-slot-1")).toBe(false);
  });

  it("일반 page (frame 미적용) 는 includeReusableFrames 옵션 영향 없이 정상 scene 등록된다", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                { id: "text-1", type: "Text", props: { children: "Hi" } },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graphDefault = buildCanvasSceneGraph(doc);
    const graphWithFrames = buildCanvasSceneGraph(doc, {
      includeReusableFrames: true,
    });

    // page (non-reusable frame) 는 두 모드 모두에서 동일하게 등록
    expect(graphDefault.nodesMap.has("body-1")).toBe(true);
    expect(graphDefault.nodesMap.has("text-1")).toBe(true);
    expect(graphWithFrames.nodesMap.has("body-1")).toBe(true);
    expect(graphWithFrames.nodesMap.has("text-1")).toBe(true);
  });

  it("projects data-bound ListBox items as ListBoxItem scene nodes", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: {
                    items: [
                      { id: "aardvark", label: "Aardvark" },
                      { id: "cat", label: "Cat" },
                    ],
                  },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const rowsGroup = graph.nodesMap.get(
      toListBoxRowsGroupProjectionId("listbox-1"),
    );
    const aardvark = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    expect(rowsGroup).toMatchObject({
      type: "Rows",
      parentId: "listbox-1",
      projection: {
        kind: "listbox-rows",
        listBoxId: "listbox-1",
      },
    });
    expect(aardvark).toMatchObject({
      type: "ListBoxItem",
      parentId: rowsGroup?.id,
      props: {
        children: "Aardvark",
        textValue: "Aardvark",
      },
      projection: {
        kind: "listbox-row",
        listBoxId: "listbox-1",
        itemKey: "aardvark",
        templateAnchorId: "template-anchor",
      },
    });
    // ADR-147 (이중 렌더 방지): projected 행은 render.shapes 로 자체 렌더하므로
    //   canonical `ref` 를 갖지 않는다(가지면 resolveCanonicalRefTree 가 origin 의
    //   composed children placeholder 를 행마다 확장 → 데이터 위 {label}/{description} 겹침).
    //   origin 참조는 projection.templateOriginId 로 보존된다.
    expect(aardvark?.ref).toBeUndefined();
  });

  // 2026-07-20 (Selected variant 배선): selected 행은 slot 등록의 Selected origin
  //   props.style 을 overlay 하고, 보편 selection 축(isSelected — listbox_item escape 판독 축)
  //   을 주입한다. 구 주입이 _isSelected 뿐이라 Skia selected row-bg/check 가 죽은 분기였다.
  it("selected 행에 Selected variant origin style overlay + isSelected 보편 축 주입", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                  props: {},
                },
                {
                  id: "component-listbox-item-selected",
                  type: "ListBoxItem",
                  reusable: true,
                  metadata: { variant: "selected" },
                  props: {
                    style: { backgroundColor: "var(--accent-subtle)" },
                  },
                  // Style 패널 Background 편집 채널 (canonical fills) — 행 fills 운반 검증.
                  fills: [
                    {
                      id: "f1",
                      type: "color",
                      color: "#FF3366FF",
                      enabled: true,
                      opacity: 1,
                    },
                  ],
                },
                {
                  id: "listbox-1",
                  type: "ListBox",
                  slot: [
                    "component-listbox-item-default",
                    "component-listbox-item-selected",
                  ],
                  props: {
                    selectedKey: "cat",
                    items: [
                      { id: "aardvark", label: "Aardvark" },
                      { id: "cat", label: "Cat" },
                    ],
                  },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const selectedRow = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "cat"),
    );
    const normalRow = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    expect(selectedRow?.props.isSelected).toBe(true);
    expect(selectedRow?.props._isSelected).toBe(true);
    expect(
      (selectedRow?.props.style as Record<string, unknown>).backgroundColor,
    ).toBe("var(--accent-subtle)");

    expect(normalRow?.props.isSelected).toBe(false);
    expect(
      (normalRow?.props.style as Record<string, unknown>).backgroundColor,
    ).toBeUndefined();

    // fills 채널 (Style 패널 Background 편집 저장소): selected 행에만 Selected origin
    //   fills 가 실린다 — buildSpecNodeData fills→hex6 배경 변환 재사용 경로.
    expect(selectedRow?.fills).toEqual([
      {
        id: "f1",
        type: "color",
        color: "#FF3366FF",
        enabled: true,
        opacity: 1,
      },
    ]);
    expect(normalRow?.fills).toBeUndefined();
  });

  // 2026-07-22 (사용자 보고): origin ListBoxItem 에 width:50% 를 주면 CSS(DOM) 행은 50% 로
  //   렌더되나 Skia 는 행 width 를 무조건 100% 로 강제해 parity 위반. projection 이 origin
  //   width 를 존중하고, 미지정 시에만 100% 기본값을 쓰는지 검증.
  it("origin ListBoxItem 의 명시 width(50%)를 projected 행에 존중 (미지정 시 100% 기본)", () => {
    const makeDoc = (originWidth: string | undefined): CompositionDocument =>
      ({
        version: "composition-1.0",
        children: [
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
                  {
                    id: "component-listbox-item-default",
                    type: "ListBoxItem",
                    reusable: true,
                    props:
                      originWidth == null
                        ? {}
                        : { style: { width: originWidth } },
                  },
                  {
                    id: "listbox-1",
                    type: "ListBox",
                    slot: ["component-listbox-item-default"],
                    props: {
                      items: [
                        { id: "aardvark", label: "Aardvark" },
                        { id: "cat", label: "Cat" },
                      ],
                    },
                    children: [
                      {
                        id: "template-anchor",
                        type: "ref",
                        ref: "component-listbox-item-default",
                        props: {},
                        metadata: {
                          type: "legacy-element-props",
                          templateRole: "listbox-item-template-anchor",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }) as unknown as CompositionDocument;

    const widthOf = (doc: CompositionDocument): unknown => {
      const graph = buildCanvasSceneGraph(doc);
      const row = graph.nodesMap.get(
        toListBoxRowProjectionId("listbox-1", "aardvark"),
      );
      return (row?.props.style as Record<string, unknown>).width;
    };

    // origin width:50% → 행이 50% 존중 (Skia↔CSS parity)
    expect(widthOf(makeDoc("50%"))).toBe("50%");
    // origin width 미지정 → 기본 100% (기존 stretch 동작 보존)
    expect(widthOf(makeDoc(undefined))).toBe("100%");
  });

  // 2026-07-22 (사용자 보고): ref 인스턴스가 자체 gap override 를 안 주면 CSS 는 origin ListBox 의
  //   gap 을 상속하나 Skia 는 instance scene style + catalog fallback 만 읽어 origin gap(10)을 놓치고
  //   catalog default(2)로 떨어졌다. instance own → origin → catalog 순 fallback 검증.
  it("ref 인스턴스 ListBox: 자체 gap 없으면 origin rowGap 상속, 있으면 자체 우선", () => {
    const makeGapDoc = (instanceRowGap?: number): CompositionDocument => {
      const items = [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ];
      return {
        version: "composition-1.0",
        children: [
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
                  {
                    id: "component-listbox-item-default",
                    type: "ListBoxItem",
                    reusable: true,
                    props: {},
                  },
                  {
                    id: "component-listbox",
                    type: "ListBox",
                    reusable: true,
                    slot: ["component-listbox-item-default"],
                    props: { style: { rowGap: 10 }, items },
                  },
                  {
                    id: "inst-lb",
                    type: "ref",
                    ref: "component-listbox",
                    props:
                      instanceRowGap != null
                        ? { style: { rowGap: instanceRowGap }, items }
                        : { items },
                    children: [
                      {
                        id: "ta",
                        type: "ref",
                        ref: "component-listbox-item-default",
                        props: {},
                        metadata: {
                          type: "legacy-element-props",
                          templateRole: "listbox-item-template-anchor",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as CompositionDocument;
    };

    const rowGapOf = (doc: CompositionDocument): unknown => {
      const graph = buildCanvasSceneGraph(doc);
      const rowsGroup = graph.nodesMap.get(
        toListBoxRowsGroupProjectionId("inst-lb"),
      );
      return (rowsGroup?.props.style as Record<string, unknown>).rowGap;
    };

    // 인스턴스 자체 gap 없음 → origin rowGap 10 상속 (Skia↔CSS parity)
    expect(rowGapOf(makeGapDoc(undefined))).toBe(10);
    // 인스턴스 자체 gap 5 → 자체 우선(override)
    expect(rowGapOf(makeGapDoc(5))).toBe(5);
  });

  // 2026-07-21: reusable ListBoxItem origin 의 label slot 자식(Text)은 leaf scene 노드로 서는데
  //   catalog Text(400)로 렌더돼 collection label 정본 600(catalog {Item}.textWeight + CSS
  //   [slot=label]{600} + instance escape)과 어긋났다(사용자 보고). render-time 에 600 주입해 정합.
  it("reusable ListBoxItem origin 의 label slot 자식은 fontWeight 600 주입 (description 은 400 유지)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "origin-lbi",
                  type: "ListBoxItem",
                  reusable: true,
                  props: {},
                  children: [
                    {
                      id: "lbl",
                      type: "Text",
                      props: { slot: "label", children: "{label}" },
                      metadata: { slotRole: "label" },
                    },
                    {
                      id: "desc",
                      type: "Text",
                      props: { slot: "description", children: "{description}" },
                      metadata: { slotRole: "description" },
                    },
                    {
                      id: "lbl-explicit",
                      type: "Text",
                      props: {
                        slot: "label",
                        style: { fontWeight: 400 },
                        children: "{label2}",
                      },
                      metadata: { slotRole: "label" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const styleOf = (id: string): Record<string, unknown> =>
      (graph.nodesMap.get(id)?.props?.style ?? {}) as Record<string, unknown>;

    // label(명시 fontWeight 없음) → render-time 600 주입 (origin·instance·CSS 정합).
    expect(styleOf("lbl").fontWeight).toBe(600);
    // description slot 은 미주입 (catalog Text 400 유지 = DOM 대칭).
    expect(styleOf("desc").fontWeight).toBeUndefined();
    // 자식이 명시 fontWeight 를 가지면 그 값 보존 (사용자 편집 우선).
    expect(styleOf("lbl-explicit").fontWeight).toBe(400);
  });

  // ADR-912 단계 4 C1: GridList projection (ListBox 동형, origin/anchor 없음).
  it("projects data-bound GridList items as GridListItem scene nodes", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "gridlist-1",
                  type: "GridList",
                  props: {
                    layout: "grid",
                    columns: 2,
                    items: [
                      {
                        id: "desert",
                        label: "Desert Sunset",
                        description: "PNG",
                      },
                      {
                        id: "hiking",
                        label: "Hiking Trail",
                        description: "JPEG",
                      },
                    ],
                  },
                  // GridList factory children:[] — origin/anchor 인프라 없음.
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const rowsGroup = graph.nodesMap.get(
      toCollectionRowsGroupProjectionId("gridlist", "gridlist-1"),
    );
    const desert = graph.nodesMap.get(
      toCollectionRowProjectionId("gridlist", "gridlist-1", "desert"),
    );

    expect(rowsGroup).toMatchObject({
      type: "Rows",
      parentId: "gridlist-1",
      projection: {
        kind: "gridlist-rows",
        listBoxId: "gridlist-1",
        // GridList 은 origin/anchor 없음 → null.
        templateAnchorId: null,
        templateOriginId: null,
      },
    });
    expect(desert).toMatchObject({
      type: "GridListItem",
      parentId: rowsGroup?.id,
      props: {
        children: "Desert Sunset",
        description: "PNG",
        textValue: "Desert Sunset",
      },
      projection: {
        kind: "gridlist-row",
        listBoxId: "gridlist-1",
        itemKey: "desert",
        templateAnchorId: null,
        templateOriginId: null,
      },
    });
    // 이중 렌더 방지: projected 카드는 GridListItem.spec.render.shapes 로 자체 렌더 → canonical ref 없음.
    expect(desert?.ref).toBeUndefined();
  });

  it("windows large data-bound GridList collections (hard 100 limit, ADR-912 C1)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "gridlist-1",
                  type: "GridList",
                  props: {
                    items: Array.from({ length: 10_000 }, (_, index) => ({
                      id: `card-${index}`,
                      label: `Card ${index}`,
                    })),
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const projectedCards = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "gridlist-row",
    );
    // window limit 100 — 10k 카드 중 100개만 projected (bounded viewport work).
    expect(projectedCards).toHaveLength(100);
  });

  it("propagates the template anchor layout style onto projected rows (ADR-147)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: [{ id: "aardvark", label: "Aardvark" }] },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {
                        style: {
                          paddingLeft: 24,
                          paddingTop: 8,
                          rowGap: 8,
                        },
                      },
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const aardvark = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    // anchor 의 layout style 이 행에 전파되되, width 는 항상 100% 로 고정된다.
    expect(aardvark?.props.style).toMatchObject({
      paddingLeft: 24,
      paddingTop: 8,
      rowGap: 8,
      width: "100%",
    });
  });

  it("resolves owner responsive rowGap onto the projected rowsGroup at the active breakpoint (ADR-154 Bug3)", () => {
    // mobile/tablet 편집은 owner.responsive.styles 로 저장된다. scene collection projection 이
    //   raw(desktop) style 만 읽으면 projected row gap 이 desktop 값으로 떨어진다(Skia 만 미반영,
    //   Preview 는 @media 로 반영 → D3 비대칭). activeBreakpoint 를 주입해 layout/render 경로와
    //   동일 merge 로 override 를 흡수하는지 검증.
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: [{ id: "aardvark", label: "Aardvark" }] },
                  // base(desktop) rowGap 없음 — mobile override 만 존재.
                  responsive: { styles: { rowGap: { mobile: 12 } } },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const rowGapAt = (bp?: "desktop" | "tablet" | "mobile") => {
      const graph = buildCanvasSceneGraph(
        doc,
        bp ? { activeBreakpoint: bp } : {},
      );
      const rowsGroup = graph.nodesMap.get(
        toListBoxRowsGroupProjectionId("listbox-1"),
      );
      return (rowsGroup?.props.style as Record<string, unknown> | undefined)
        ?.rowGap;
    };

    // mobile: responsive override(12)가 rowsGroup rowGap 에 반영.
    expect(rowGapAt("mobile")).toBe(12);
    // desktop / 미지정: responsive 미적용 → catalog 기본값(≠12, base rowGap 부재).
    expect(rowGapAt("desktop")).not.toBe(12);
    expect(rowGapAt()).not.toBe(12);
  });

  it("suppresses the template anchor from the visible scene when data-bound (ADR-147 이중 렌더 방지)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: [{ id: "aardvark", label: "Aardvark" }] },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);

    // 데이터 바인딩 행 projection 은 존재해야 한다.
    expect(
      graph.nodesMap.get(toListBoxRowProjectionId("listbox-1", "aardvark")),
    ).toBeDefined();
    // template anchor 자체는 가시 scene 에서 제외(projection 이 단일 렌더러).
    expect(graph.nodesMap.get("template-anchor")).toBeUndefined();
  });

  it("keeps the template anchor visible when the ListBox is not data-bound", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-empty",
                  type: "ListBox",
                  props: {},
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);

    // projection 행이 없으므로(데이터 없음) anchor 는 가시 scene 에 유지된다.
    expect(graph.nodesMap.get("template-anchor")).toBeDefined();
  });

  // Option B (anchor-less): in-instance template anchor 가 없어도 projected 행은
  //   component 정의의 origin(component-listbox-item-default) style 을 상속해야 한다.
  //   anchor 가 없으면 templateOriginId 를 default origin 상수(또는 master.slot[0])로 해석한다.
  it("resolves projected row style from the component origin when there is no in-instance anchor (Option B)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: [{ id: "aardvark", label: "Aardvark" }] },
                  // anchor-less: 자식 없음 (Option B)
                },
              ],
            },
            // Components 시스템 origin — 행 template style 의 SSOT.
            {
              id: "component-listbox-item-default",
              type: "ListBoxItem",
              reusable: true,
              props: { style: { paddingLeft: 24, paddingTop: 8, rowGap: 8 } },
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const aardvark = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    expect(aardvark).toBeDefined();
    expect(aardvark?.props.style).toMatchObject({
      paddingLeft: 24,
      paddingTop: 8,
      rowGap: 8,
      width: "100%",
    });
  });

  // Option B: 실제 instance 는 ref(component-listbox) bare ref 다. anchor 없이도
  //   master component 의 slot[0] = default ListBoxItem origin 에서 행 template 을 해석한다.
  it("resolves the row template from the ListBox master component slot for a bare ref instance (Option B)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  // bare ref instance — 자식 없음 (Option B 통일 구조)
                  id: "listbox-1",
                  type: "ref",
                  ref: "component-listbox",
                  props: { items: [{ id: "cat", label: "Cat" }] },
                },
              ],
            },
            // master component + slot 정의
            {
              id: "component-listbox",
              type: "ListBox",
              reusable: true,
              slot: ["component-listbox-item-default"],
              props: { items: [] },
            },
            {
              id: "component-listbox-item-default",
              type: "ListBoxItem",
              reusable: true,
              props: { style: { paddingLeft: 16 } },
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const cat = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "cat"),
    );

    expect(cat).toBeDefined();
    expect(cat?.props.style).toMatchObject({ paddingLeft: 16, width: "100%" });
  });

  it("projects ListBox rows from dataBinding before props.items seed data", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: {
                      data: [
                        {
                          id: "runtime-aardvark",
                          label: "Runtime Aardvark",
                        },
                      ],
                    },
                  },
                  props: {
                    items: [{ id: "seed-cat", label: "Seed Cat" }],
                  },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);

    expect(
      graph.nodesMap.get(
        toListBoxRowProjectionId("listbox-1", "runtime-aardvark"),
      ),
    ).toMatchObject({
      type: "ListBoxItem",
      props: {
        children: "Runtime Aardvark",
        textValue: "Runtime Aardvark",
      },
    });
    expect(
      graph.nodesMap.has(toListBoxRowProjectionId("listbox-1", "seed-cat")),
    ).toBe(false);
  });

  it("keeps reusable origin ListBoxItem slot children in the scene (ADR-148 후속 2026-07-17 — 더블클릭 drill/편집 대상)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "lbi-origin",
                  type: "ListBoxItem",
                  reusable: true,
                  props: { children: "{label}", description: "{description}" },
                  children: [
                    {
                      id: "lbi-origin__icon",
                      type: "Icon",
                      props: { slot: "icon", iconName: "{icon}" },
                      metadata: { type: "listbox-item-slot", slotRole: "icon" },
                    },
                    {
                      id: "lbi-origin__label",
                      type: "Text",
                      props: { slot: "label", children: "{label}" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "label",
                      },
                    },
                    {
                      id: "lbi-origin__description",
                      type: "Text",
                      props: { slot: "description", children: "{description}" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "description",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    // ListBoxItem 자체는 scene 에 존재(listbox_item escape 가 shell paint)
    expect(graph.nodesMap.get("lbi-origin")).toBeDefined();
    // reusable origin 의 slot 조합 자식(Icon/Label/Description)은 실 scene 노드로 선다 —
    //   더블클릭 drill/선택/편집 대상 (Card origin 동형). 이중 렌더는 escape `_hasChildren`
    //   shell gating 이 차단 (2026-07-17 — 구 접힘 계약은 비-reusable item 한정으로 축소).
    expect(graph.nodesMap.has("lbi-origin__icon")).toBe(true);
    expect(graph.nodesMap.has("lbi-origin__label")).toBe(true);
    expect(graph.nodesMap.has("lbi-origin__description")).toBe(true);
  });

  it("propagates the resolved origin ListBoxItem style onto projected rows (ADR-147 Layer 3)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: [{ id: "aardvark", label: "Aardvark" }] },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
                // origin 정의(스타일 보유) — anchor 가 raw ref(style 없음)여도 행에 전파되어야 함
                {
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                  props: {
                    children: "{label}",
                    description: "{description}",
                    style: { paddingTop: 12, paddingBottom: 12 },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    const aardvark = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    // origin 의 style(paddingTop/Bottom 12) 이 행에 전파, width 는 100% 고정.
    expect(aardvark?.props.style).toMatchObject({
      paddingTop: 12,
      paddingBottom: 12,
      width: "100%",
    });
    // origin 에 slot 조합 자식이 없으면 `_slots` 미주입 — legacy flat-props 동작(BC).
    expect(aardvark?.props._slots).toBeUndefined();
  });

  it("projects the origin slot composition onto rows as `_slots` (ADR-148 Phase 0 — 구성·스타일 배선)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: {
                    items: [
                      { id: "aardvark", label: "Aardvark", icon: "star" },
                    ],
                  },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
                // origin — icon slot 자식이 제거된 상태 + label slot 자식에 style.
                {
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                  props: { children: "{label}", description: "{description}" },
                  children: [
                    {
                      id: "component-listbox-item-default__label",
                      type: "Text",
                      props: {
                        slot: "label",
                        children: "{label}",
                        style: { fontWeight: 700, color: "#ff0000" },
                      },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "label",
                      },
                    },
                    {
                      id: "component-listbox-item-default__description",
                      type: "Text",
                      props: { slot: "description", children: "{description}" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "description",
                        optional: true,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    const aardvark = graph.nodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );
    const slots = aardvark?.props._slots as
      | {
          order: string[];
          slots: Record<string, { style?: Record<string, unknown> }>;
        }
      | undefined;

    // 구성: origin slot 자식의 존재·순서 그대로 — icon 은 제거 상태라 구성에 없음.
    expect(slots?.order).toEqual(["label", "description"]);
    expect(slots?.slots.icon).toBeUndefined();
    // 스타일: slot 자식 props.style 이 구성에 실려 escape/DOM emit 이 overlay 소비.
    expect(slots?.slots.label?.style).toMatchObject({
      fontWeight: 700,
      color: "#ff0000",
    });
  });

  it("projects the GridListItem origin slot composition + origin style onto cards (ADR-148 Phase 4)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "gridlist-1",
                  type: "GridList",
                  props: {
                    items: [
                      {
                        id: "aardvark",
                        label: "Aardvark",
                        description: "A desc",
                      },
                    ],
                  },
                },
                // origin — anchor-less 단일 리터럴 (component-gridlist-item-default).
                //   description slot 자식 제거 + label slot 자식 style + origin style.
                {
                  id: "component-gridlist-item-default",
                  type: "GridListItem",
                  reusable: true,
                  props: {
                    children: "{label}",
                    description: "{description}",
                    style: { paddingTop: 20 },
                  },
                  children: [
                    {
                      id: "component-gridlist-item-default__label",
                      type: "Text",
                      props: {
                        slot: "label",
                        children: "{label}",
                        style: { color: "#00ff00" },
                      },
                      metadata: {
                        type: "gridlist-item-slot",
                        slotRole: "label",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    const card = graph.nodesMap.get(
      toCollectionRowProjectionId("gridlist", "gridlist-1", "aardvark"),
    );
    const slots = card?.props._slots as
      | {
          order: string[];
          slots: Record<string, { style?: Record<string, unknown> }>;
        }
      | undefined;

    // 구성: description slot 자식이 제거된 origin → 구성에 없음 (카드 1줄 gating 근거).
    expect(slots?.order).toEqual(["label"]);
    expect(slots?.slots.description).toBeUndefined();
    expect(slots?.slots.label?.style).toMatchObject({ color: "#00ff00" });
    // origin style overlay + 카드 폭은 layout 산식 우선 (stack = 100%).
    expect(card?.props.style).toMatchObject({
      paddingTop: 20,
      width: "100%",
    });
    // owner GridList scene props 에도 주입 (layout §1.55c gating — Layer D 대칭).
    const owner = graph.nodesMap.get("gridlist-1");
    expect(owner?.props._slots).toBeDefined();
    // reusable origin 의 slot 자식은 실 scene 노드로 선다 (Card origin 동형 — 더블클릭
    //   drill/편집 대상, 2026-07-17). 이중 렌더 차단은 escape `_hasChildren` shell gating.
    expect(
      graph.nodesMap.get("component-gridlist-item-default__label"),
    ).toBeDefined();
  });

  it("unfolds slot children of reusable origins only — non-reusable items stay folded (더블클릭 drill, 2026-07-17)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                // Components 페이지 origin (reusable) — slot 자식이 authoring 표면.
                {
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                  props: { children: "{label}", description: "{description}" },
                  children: [
                    {
                      id: "component-listbox-item-default__label",
                      type: "Text",
                      props: { slot: "label", children: "{label}" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "label",
                      },
                    },
                    {
                      id: "component-listbox-item-default__description",
                      type: "Text",
                      props: { slot: "description", children: "{description}" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "description",
                      },
                    },
                  ],
                },
                // 비-reusable item 의 slot 자식은 기존 접힘 유지 (escape 가 flat props 로
                //   내용을 그리므로 실 노드로 서면 이중 렌더).
                {
                  id: "plain-item-1",
                  type: "ListBoxItem",
                  props: { children: "Aardvark" },
                  children: [
                    {
                      id: "plain-item-1__label",
                      type: "Text",
                      props: { slot: "label", children: "Aardvark" },
                      metadata: {
                        type: "listbox-item-slot",
                        slotRole: "label",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    // origin slot 자식 = 실 scene 노드 (interaction map 에 승격 → 더블클릭 drill 가능).
    const label = graph.nodesMap.get("component-listbox-item-default__label");
    const description = graph.nodesMap.get(
      "component-listbox-item-default__description",
    );
    expect(label).toBeDefined();
    expect(description).toBeDefined();
    expect(label?.parentId).toBe("component-listbox-item-default");
    const originChildren =
      graph.childrenByParent.get("component-listbox-item-default") ?? [];
    expect(originChildren.map((c) => c.id)).toEqual([
      "component-listbox-item-default__label",
      "component-listbox-item-default__description",
    ]);

    // 비-reusable item 의 slot 자식은 접힘 유지.
    expect(graph.nodesMap.get("plain-item-1")).toBeDefined();
    expect(graph.nodesMap.get("plain-item-1__label")).toBeUndefined();
  });

  // ADR-162 Phase 1 — 접기는 카드 단위: 자식이 전부 slot 역할일 때만 접는다. 비-slot 자식 (Image ·
  //   역할 없는 label Text) 이 섞인 비-reusable 카드 (detach · legacy) 는 자식 수만큼 `_hasChildren` 이라
  //   escape 가 shell 만 그리는데, slot 자식만 접으면 description 을 아무도 그리지 않는다.
  it("folds a non-reusable card only when every child is a slot child (ADR-162 Phase 1)", () => {
    const text = (id: string, slot: string | null, children: string) => ({
      id,
      type: "Text",
      props: slot ? { slot, children } : { children },
    });
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "mixed-card",
                  type: "GridListItem",
                  props: { children: "Docs", description: "12 files" },
                  children: [
                    text("mixed-card__label", null, "Docs"),
                    text("mixed-card__description", "description", "12 files"),
                    { id: "mixed-card__image", type: "Image", props: { alt: "x" } },
                  ],
                },
                {
                  id: "slot-card",
                  type: "GridListItem",
                  props: { children: "Docs", description: "12 files" },
                  children: [
                    text("slot-card__label", "label", "Docs"),
                    text("slot-card__description", "description", "12 files"),
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    expect(
      (graph.childrenByParent.get("mixed-card") ?? []).map((c) => c.id),
    ).toEqual([
      "mixed-card__label",
      "mixed-card__description",
      "mixed-card__image",
    ]);
    // 전부 slot 이면 종전대로 접힘 (escape 가 flat props 로 그린다 — BC).
    expect(graph.childrenByParent.get("slot-card") ?? []).toEqual([]);
  });

  it("projects a data-bound Table into 2D RowsGroup → Row → Cell tree (ADR-912 C1)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "table-1",
                  type: "Table",
                  props: {
                    columns: [
                      { id: "name", label: "Name", width: 120 },
                      { id: "role", label: "Role", width: 80 },
                    ],
                    rows: [
                      { id: "r1", cells: { name: "John", role: "Admin" } },
                      { id: "r2", cells: { name: "Jane", role: "Editor" } },
                    ],
                  },
                  // Table factory 는 빈 TableHeader/TableBody(spec 없음 → Skia 미렌더) 자식 생성.
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);

    const rowsGroup = graph.nodesMap.get(
      toCollectionRowsGroupProjectionId("table", "table-1"),
    );
    expect(rowsGroup).toMatchObject({
      type: "Rows",
      parentId: "table-1",
      projection: { kind: "table-rows", listBoxId: "table-1" },
    });

    // header 행 (rowKey __header__) + data 행 r1 — TableRow 노드.
    const headerRow = graph.nodesMap.get(
      toCollectionRowProjectionId("table", "table-1", "__header__"),
    );
    // header 여부는 projection metadata 가 보유 (구 `props._isHeader` 는 소비처 0 으로 소멸).
    expect(headerRow).toMatchObject({
      type: "TableRow",
      parentId: rowsGroup?.id,
      projection: { kind: "table-row", listBoxId: "table-1", isHeader: true },
    });

    const dataRow = graph.nodesMap.get(
      toCollectionRowProjectionId("table", "table-1", "r1"),
    );
    expect(dataRow).toMatchObject({
      type: "TableRow",
      projection: { kind: "table-row", itemKey: "r1", isHeader: false },
    });

    // header 셀: label = column.label, cell: row.cells[columnId].
    // ADR-912 Pattern B (TableCell catalog cutover, 2026-06-13): header/data 굵기와 컬럼 폭은
    // `_isHeader`/`_columnWidth` 대신 보편 D3 style 채널(fontWeight 600/400, width)로 주입된다 —
    // buildCatalogShapes 가 셀 종류를 모른 채 그리게 하기 위함 (컴포넌트 식별 분기 0).
    const headerNameCell = graph.nodesMap.get(
      toCollectionCellProjectionId("table", "table-1", "__header__", "name"),
    );
    expect(headerNameCell).toMatchObject({
      type: "TableCell",
      parentId: headerRow?.id,
      props: { children: "Name", style: { width: 120, fontWeight: 600 } },
      projection: { kind: "table-cell", columnId: "name", isHeader: true },
    });

    const dataRoleCell = graph.nodesMap.get(
      toCollectionCellProjectionId("table", "table-1", "r1", "role"),
    );
    expect(dataRoleCell).toMatchObject({
      type: "TableCell",
      parentId: dataRow?.id,
      props: { children: "Admin", style: { width: 80, fontWeight: 400 } },
      projection: { kind: "table-cell", columnId: "role", itemKey: "r1" },
    });

    // projected 노드는 자체 렌더 → canonical ref 없음 (비영속).
    expect(dataRoleCell?.ref).toBeUndefined();
  });

  it("array 셀 → Tag 칩 placeholder (cap+overflow) / object 셀 → 휴리스틱 label (ADR-159 P5)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "table-1",
                  type: "Table",
                  props: {
                    columns: [
                      { id: "skills", label: "Skills", width: 160 },
                      { id: "owner", label: "Owner", width: 120 },
                    ],
                    rows: [
                      {
                        id: "r1",
                        cells: {
                          skills: ["ts", "rust", "go", "sql"],
                          owner: { name: "Kim", city: "Seoul" },
                        },
                      },
                    ],
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);

    // array 셀: TableCell 은 flex 컨테이너(텍스트 없음) + Tag 자식 칩 (cap 3 + "+1").
    const skillsCellId = toCollectionCellProjectionId(
      "table",
      "table-1",
      "r1",
      "skills",
    );
    const skillsCell = graph.nodesMap.get(skillsCellId);
    expect(skillsCell).toMatchObject({
      type: "TableCell",
      props: { style: { width: 160, display: "flex" } },
      projection: { kind: "table-cell", columnId: "skills", itemKey: "r1" },
    });
    expect(skillsCell?.props.children).toBeUndefined();
    expect(graph.nodesMap.get(`${skillsCellId}::tag-0`)).toMatchObject({
      type: "Tag",
      parentId: skillsCellId,
      props: { children: "ts" },
      projection: { kind: "table-cell", columnId: "skills" },
    });
    expect(graph.nodesMap.get(`${skillsCellId}::tag-2`)).toMatchObject({
      props: { children: "go" },
    });
    // cap(3) 초과분은 "+N" 칩 1개로 축약, 그 뒤 칩 없음.
    expect(graph.nodesMap.get(`${skillsCellId}::tag-3`)).toMatchObject({
      props: { children: "+1" },
    });
    expect(graph.nodesMap.get(`${skillsCellId}::tag-4`)).toBeUndefined();

    // object 셀: 휴리스틱 label 텍스트 (구 "[object Object]" 개선).
    const ownerCell = graph.nodesMap.get(
      toCollectionCellProjectionId("table", "table-1", "r1", "owner"),
    );
    expect(ownerCell).toMatchObject({
      type: "TableCell",
      props: { children: "Kim" },
    });
  });

  it("windows large data-bound Table data rows (100 limit, header 별도, ADR-912 C1)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "table-1",
                  type: "Table",
                  props: {
                    columns: [{ id: "name", label: "Name", width: 120 }],
                    rows: Array.from({ length: 10_000 }, (_, index) => ({
                      id: `r${index}`,
                      cells: { name: `Name ${index}` },
                    })),
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const projectedRows = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "table-row",
    );
    const dataRows = projectedRows.filter(
      (node) =>
        node.projection?.kind === "table-row" && !node.projection.isHeader,
    );
    const headerRows = projectedRows.filter(
      (node) =>
        node.projection?.kind === "table-row" && node.projection.isHeader,
    );
    // data 행 window limit 100 (bounded viewport work) + header 행 1개.
    expect(dataRows).toHaveLength(100);
    expect(headerRows).toHaveLength(1);
  });

  // ─── TagGroup owner-first fallback (Add Tag Skia 미반영 회귀) ────────────────
  //
  // 버그: Inspector ItemsManager "Add Tag"(store.addItem)는 TagGroup.props.items 만
  //   갱신하고 TagGroup→TagList propagation 을 트리거하지 않는다. DOM 은
  //   TagGroup.props.items 를 직접 소비해 즉시 반영되지만, Skia projection 은 stale
  //   TagList.props.items(factory 초기값)를 읽어 새 chip 이 누락됐다.
  //   수정: resolveDataBoundTagProjection 이 dataBinding 없을 때 owner TagGroup.items 를
  //   우선(override:true propagation 정본을 Skia 시점 방어적 복원). 아래 2 테스트로 고정.

  it("TagGroup chip projection 이 owner TagGroup.props.items 를 우선한다 (stale TagList.items 무시)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "taggroup-1",
                  type: "TagGroup",
                  // owner(TagGroup) = 최신 5개 (Add Tag 로 "New Tag" 추가된 상태)
                  props: {
                    items: [
                      { id: "chocolate", label: "Chocolate" },
                      { id: "mint", label: "Mint" },
                      { id: "strawberry", label: "Strawberry" },
                      { id: "vanilla", label: "Vanilla" },
                      { id: "new-tag", label: "New Tag" },
                    ],
                  },
                  children: [
                    { id: "label-1", type: "Label", props: {}, children: [] },
                    {
                      id: "taglist-1",
                      type: "TagList",
                      // 자식 TagList = stale 4개 (propagation 미실행 factory 초기값)
                      props: {
                        items: [
                          { id: "chocolate", label: "Chocolate" },
                          { id: "mint", label: "Mint" },
                          { id: "strawberry", label: "Strawberry" },
                          { id: "vanilla", label: "Vanilla" },
                        ],
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const chips = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "tag-row",
    );
    // stale TagList.items(4) 가 아니라 owner TagGroup.items(5) 로 chip 이 그려진다.
    expect(chips).toHaveLength(5);
    const labels = chips.map(
      (c) => (c.props as { children?: unknown }).children,
    );
    expect(labels).toContain("New Tag");

    // 새 chip 이 rowsGroup 아래에 정상 부착되는지도 확인.
    const newTagChip = graph.nodesMap.get(
      toCollectionRowProjectionId("tag", "taglist-1", "new-tag"),
    );
    expect(newTagChip).toMatchObject({
      type: "Tag",
      parentId: toCollectionRowsGroupProjectionId("tag", "taglist-1"),
      props: { children: "New Tag" },
      projection: { kind: "tag-row", listBoxId: "taglist-1" },
    });
  });

  it("owner TagGroup 이 없으면 TagList.props.items 로 회귀한다 (fallback 안전)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                // 독립 TagList (부모 TagGroup 없음) — owner lookup 실패 → TagList.items 사용
                {
                  id: "taglist-orphan",
                  type: "TagList",
                  props: {
                    items: [
                      { id: "a", label: "A" },
                      { id: "b", label: "B" },
                    ],
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc);
    const chips = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "tag-row",
    );
    expect(chips).toHaveLength(2);
  });

  // ─── TagGroup dataBinding 도 owner 소유다 (Skia↔DOM 비대칭 회귀) ─────────────
  //
  // `dataBinding` 은 owner TagGroup 에 걸린다 — Inspector 의 Data 필드가 TagGroup 의
  // 것이고, DOM wrapper 도 `TagGroup` 이 `useCollectionData({ dataBinding })` 로
  // 소비한다. 그런데 Skia projection 은 자식 TagList 노드에서만 binding 을 찾아
  // owner 의 값을 못 보고 정적 items 로 회귀했다 — DOM 은 바인딩 행을, 캔버스는
  // 정적 chip 을 그리는 D3 비대칭 (2026-09-09 live 실측).
  //
  // items 축은 이미 owner-first 인데 binding 축만 빠져 있던 것이라, 같은 owner
  // lookup 을 binding 에도 적용한다.
  it("TagGroup chip projection 이 owner TagGroup 의 dataBinding 을 읽는다", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "taggroup-bound",
                  type: "TagGroup",
                  props: { items: [{ id: "stale", label: "Stale" }] },
                  // 실제 저장 위치 — props 가 아니라 extension (PROPS_FORBIDDEN_KEYS).
                  "x-composition": {
                    dataBinding: { source: "dataTable", name: "tags_dt" },
                  },
                  children: [
                    {
                      id: "taglist-bound",
                      type: "TagList",
                      props: {
                        items: [
                          { id: "a", label: "Stale A" },
                          { id: "b", label: "Stale B" },
                        ],
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, {
      collections: [
        {
          name: "tags_dt",
          useMockData: true,
          mockData: [
            { id: 1, label: "ALPHA" },
            { id: 2, label: "BRAVO" },
            { id: 3, label: "CHARLIE" },
          ],
        },
      ] as never,
    });

    const chips = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "tag-row",
    );
    expect(chips).toHaveLength(3);
    expect(
      chips.map((c) => (c.props as { children?: unknown }).children),
    ).toEqual(["ALPHA", "BRAVO", "CHARLIE"]);
  });

  it("owner 에 dataBinding 이 없으면 기존 items 경로 그대로 (회귀 0)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
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
                {
                  id: "taggroup-plain",
                  type: "TagGroup",
                  props: {
                    items: [
                      { id: "a", label: "A" },
                      { id: "b", label: "B" },
                    ],
                  },
                  children: [
                    {
                      id: "taglist-plain",
                      type: "TagList",
                      props: { items: [{ id: "stale", label: "Stale" }] },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graph = buildCanvasSceneGraph(doc, {
      collections: [
        { name: "tags_dt", useMockData: true, mockData: [{ id: 1 }] },
      ] as never,
    });
    const chips = [...graph.nodesMap.values()].filter(
      (node) => node.projection?.kind === "tag-row",
    );
    expect(
      chips.map((c) => (c.props as { children?: unknown }).children),
    ).toEqual(["A", "B"]);
  });

  // ─── TagList chip gap = catalog SSOT (Skia↔CSS gap 비대칭 회귀) ───────────────
  //
  // 버그: appendTagRowProjection 이 rowsGroup gap 을 `props.gap ?? 4` 하드코딩으로 설정해
  //   catalog TagList.sizes.gap(sm/md=4, lg=6)을 무시. md 는 우연히 4 로 일치했으나 lg 에서
  //   배치 gap(4)과 layout height 계산(resolveTagChipMetric=6)이 비대칭 → CSS(catalog 반영 후 6)
  //   와도 어긋남. 수정: resolveTagListGap(size) read-through 로 size 별 catalog gap 정합.

  function buildTagGroupDoc(tagGroupSize: string): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
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
                {
                  id: "taggroup-1",
                  type: "TagGroup",
                  props: {
                    size: tagGroupSize,
                    items: [
                      { id: "a", label: "A" },
                      { id: "b", label: "B" },
                    ],
                  },
                  children: [
                    { id: "label-1", type: "Label", props: {}, children: [] },
                    {
                      id: "taglist-1",
                      type: "TagList",
                      props: {
                        size: tagGroupSize,
                        items: [
                          { id: "a", label: "A" },
                          { id: "b", label: "B" },
                        ],
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }

  function rowsGroupGap(size: string): { rowGap: unknown; columnGap: unknown } {
    const graph = buildCanvasSceneGraph(buildTagGroupDoc(size));
    const rowsGroup = graph.nodesMap.get(
      toCollectionRowsGroupProjectionId("tag", "taglist-1"),
    );
    const style = (rowsGroup?.props as { style?: Record<string, unknown> })
      ?.style;
    return { rowGap: style?.rowGap, columnGap: style?.columnGap };
  }

  it("TagList chip rowsGroup gap 이 catalog TagList.sizes.gap 을 size 별로 반영한다 (md=4)", () => {
    const { rowGap, columnGap } = rowsGroupGap("md");
    expect(rowGap).toBe(4);
    expect(columnGap).toBe(4);
  });

  it("TagList chip rowsGroup gap 이 lg 에서 catalog gap=6 을 반영한다 (하드코딩 4 회귀 차단)", () => {
    const { rowGap, columnGap } = rowsGroupGap("lg");
    expect(rowGap).toBe(6);
    expect(columnGap).toBe(6);
  });
});

describe("buildCanvasSceneGraph — Background(fills) 운반 (2026-07-15)", () => {
  const COLOR_FILL = {
    id: "f1",
    type: "color",
    enabled: true,
    opacity: 1,
    blendMode: "normal",
    color: "#112233FF",
  };

  function makeFillsDocument(
    node: Record<string, unknown>,
  ): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          props: {},
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [node],
        },
      ],
    } as unknown as CompositionDocument;
  }

  it("canonical 1차 필드 fills 를 scene node 로 운반한다", () => {
    const graph = buildCanvasSceneGraph(
      makeFillsDocument({
        id: "box-1",
        type: "Box",
        props: {},
        fills: [COLOR_FILL],
      }),
    );
    expect(graph.nodesMap.get("box-1")?.fills).toEqual([COLOR_FILL]);
  });

  it("1차 필드가 없으면 metadata.legacyProps.fills 로 fallback 한다 (구 문서)", () => {
    const graph = buildCanvasSceneGraph(
      makeFillsDocument({
        id: "box-legacy",
        type: "Box",
        props: {},
        metadata: {
          type: "legacy-element-props",
          legacyProps: { id: "box-legacy", fills: [COLOR_FILL], type: "Box" },
        },
      }),
    );
    expect(graph.nodesMap.get("box-legacy")?.fills).toEqual([COLOR_FILL]);
  });

  it("fills 미보유 노드는 scene node 에 fills 필드를 만들지 않는다", () => {
    const graph = buildCanvasSceneGraph(
      makeFillsDocument({ id: "box-plain", type: "Box", props: {} }),
    );
    const node = graph.nodesMap.get("box-plain");
    expect(node).toBeDefined();
    expect("fills" in (node as object)).toBe(false);
  });
});

// ── ADR-150 A2: ListBox 가상화 window 투영 (ListBox 선행 proof) ────────────────

describe("buildCanvasSceneGraph — ADR-150 A2 ListBox 가상화 window", () => {
  function buildListBoxDoc(itemCount: number): CompositionDocument {
    const items = Array.from({ length: itemCount }, (_, i) => ({
      id: `k${i}`,
      label: `Item ${i}`,
    }));
    return {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items },
                  children: [
                    {
                      id: "template-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }

  const projectedRows = (graph: ReturnType<typeof buildCanvasSceneGraph>) =>
    graph.nodes.filter((n) => n.projection?.kind === "listbox-row");

  it("window {94,116} of 1000 → window 행 22개만 투영 + leading/trailing spacer + 절대 rowIndex", () => {
    const doc = buildListBoxDoc(1000);
    const resolution: CollectionWindowResolution = {
      window: { startIndex: 94, endIndex: 116 },
      rowHeight: 40,
      totalRows: 1000,
    };
    const graph = buildCanvasSceneGraph(doc, {
      collectionWindows: new Map([["listbox-1", resolution]]),
    });

    // window 밖 행은 투영 노드로 존재하지 않음 (10k → 22).
    const rows = projectedRows(graph);
    expect(rows).toHaveLength(22);
    // 첫/끝 행의 rowIndex 는 절대 index (post-slice 0 이 아님).
    expect(rows[0].projection).toMatchObject({ itemKey: "k94", rowIndex: 94 });
    expect(rows[21].projection).toMatchObject({
      itemKey: "k115",
      rowIndex: 115,
    });
    expect(
      graph.nodesMap.get(toListBoxRowProjectionId("listbox-1", "k0")),
    ).toBe(undefined);

    // leading spacer = startIndex * rowHeight = 94*40 = 3760.
    const lead = graph.nodesMap.get(
      toListBoxSpacerProjectionId("listbox-1", "lead"),
    );
    expect(lead).toMatchObject({
      type: "Box",
      projection: { kind: "listbox-spacer", position: "lead" },
      props: { style: { height: 3760, flexShrink: 0 } },
    });
    expect("fills" in (lead as object)).toBe(false);

    // trailing spacer = (totalRows - endIndex) * rowHeight = (1000-116)*40 = 35360.
    const trail = graph.nodesMap.get(
      toListBoxSpacerProjectionId("listbox-1", "trail"),
    );
    expect(trail).toMatchObject({
      projection: { kind: "listbox-spacer", position: "trail" },
      props: { style: { height: 35360 } },
    });

    // 총 content height = leadingSpacer + window 행 + trailingSpacer = totalRows*rowHeight.
    const leadH = (lead?.props.style as { height: number }).height;
    const trailH = (trail?.props.style as { height: number }).height;
    expect(leadH + 22 * 40 + trailH).toBe(1000 * 40);
  });

  it("window {0,16} → startIndex 0 이면 leading spacer 없음, trailing spacer 만", () => {
    const doc = buildListBoxDoc(1000);
    const graph = buildCanvasSceneGraph(doc, {
      collectionWindows: new Map([
        [
          "listbox-1",
          {
            window: { startIndex: 0, endIndex: 16 },
            rowHeight: 40,
            totalRows: 1000,
          },
        ],
      ]),
    });
    expect(projectedRows(graph)).toHaveLength(16);
    expect(
      graph.nodesMap.get(toListBoxSpacerProjectionId("listbox-1", "lead")),
    ).toBeUndefined();
    const trail = graph.nodesMap.get(
      toListBoxSpacerProjectionId("listbox-1", "trail"),
    );
    // (1000-16)*40 = 39360.
    expect((trail?.props.style as { height: number }).height).toBe(39360);
  });

  it("collectionWindows 미제공 → legacy 정적 cap(100) + spacer 없음 (BC)", () => {
    const doc = buildListBoxDoc(150);
    const graph = buildCanvasSceneGraph(doc);
    expect(projectedRows(graph)).toHaveLength(100);
    expect(
      graph.nodesMap.get(toListBoxSpacerProjectionId("listbox-1", "lead")),
    ).toBeUndefined();
    expect(
      graph.nodesMap.get(toListBoxSpacerProjectionId("listbox-1", "trail")),
    ).toBeUndefined();
  });
});

// ADR-161 Phase 3 — GridList 컨테이너 origin master slot[0] 해석 (리터럴 하드코딩 제거).
describe("resolveGridListTemplateOriginId — 컨테이너 origin slot 소비", () => {
  const asNode = (n: Record<string, unknown>): CanonicalNode =>
    n as unknown as CanonicalNode;
  const docWith = (
    nodes: Record<string, unknown>[],
  ): (() => Map<string, CanonicalNode>) => {
    const map = new Map<string, CanonicalNode>();
    for (const n of nodes) map.set(n.id as string, asNode(n));
    return () => map;
  };

  it("ref 인스턴스 → master(component-gridlist) 의 slot[0] 을 해석한다", () => {
    const getDoc = docWith([
      {
        id: "component-gridlist",
        type: "GridList",
        slot: ["component-gridlist-item-default"],
      },
    ]);
    const instance = asNode({
      id: "gl-1",
      type: "ref",
      ref: "component-gridlist",
    });
    expect(resolveGridListTemplateOriginId(instance, getDoc)).toBe(
      "component-gridlist-item-default",
    );
  });

  it("커스텀 slot[0] 을 존중한다 (컨테이너 origin authoritative)", () => {
    const getDoc = docWith([
      {
        id: "component-gridlist",
        type: "GridList",
        slot: ["custom-gridlist-item"],
      },
    ]);
    const instance = asNode({
      id: "gl-1",
      type: "ref",
      ref: "component-gridlist",
    });
    expect(resolveGridListTemplateOriginId(instance, getDoc)).toBe(
      "custom-gridlist-item",
    );
  });

  it("origin GridList 자신(non-ref) → 자신의 slot[0]", () => {
    const origin = asNode({
      id: "component-gridlist",
      type: "GridList",
      slot: ["component-gridlist-item-default"],
    });
    expect(resolveGridListTemplateOriginId(origin, docWith([]))).toBe(
      "component-gridlist-item-default",
    );
  });

  it("slot 미등록(legacy 문서) → 표준 default item origin 상수 fallback", () => {
    const getDoc = docWith([{ id: "component-gridlist", type: "GridList" }]);
    const instance = asNode({
      id: "gl-1",
      type: "ref",
      ref: "component-gridlist",
    });
    expect(resolveGridListTemplateOriginId(instance, getDoc)).toBe(
      "component-gridlist-item-default",
    );
  });
});

// ADR-159 P2 — 행 텍스트 `{field}` 템플릿 보간 (Skia projection 배선).
//   소스 precedence(§2-3-1): slot text > item children/textValue > 휴리스틱(compile null).
describe("buildCanvasSceneGraph — ADR-159 행 텍스트 템플릿 보간", () => {
  const users = [
    { id: "u1", num: 7, name: "Kim", email: "kim@x.io" },
    { id: "u2", num: 8, name: "Lee", email: "lee@x.io" },
  ];

  function buildListBoxDoc(
    anchor: Record<string, unknown>,
  ): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
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
                {
                  id: "listbox-1",
                  type: "ListBox",
                  props: { items: users },
                  children: [anchor],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }

  const slotText = (
    id: string,
    role: "label" | "description",
    text: string,
  ): Record<string, unknown> => ({
    id,
    type: "Text",
    props: { slot: role, children: text },
    metadata: { type: "listbox-item-slot", slotRole: role },
  });

  const anchorWith = (
    children: Record<string, unknown>[],
    props: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: "template-anchor",
    type: "ListBoxItem",
    props,
    children,
    metadata: {
      type: "legacy-element-props",
      templateRole: "listbox-item-template-anchor",
    },
  });

  const rowOf = (
    graph: ReturnType<typeof buildCanvasSceneGraph>,
    key: string,
  ) => graph.nodesMap.get(toListBoxRowProjectionId("listbox-1", key));

  it("slot text {num}/{email} → 행 children/description/textValue 보간", () => {
    const doc = buildListBoxDoc(
      anchorWith([
        slotText("t-label", "label", "No.{num}"),
        slotText("t-desc", "description", "{email}"),
      ]),
    );
    const graph = buildCanvasSceneGraph(doc);
    expect(rowOf(graph, "u1")?.props).toMatchObject({
      children: "No.7",
      description: "kim@x.io",
      textValue: "No.7",
    });
    expect(rowOf(graph, "u2")?.props).toMatchObject({
      children: "No.8",
      description: "lee@x.io",
    });
  });

  it("토큰 없는 slot text → 휴리스틱 유지 + role 별 독립 판정 (G3 BC)", () => {
    const doc = buildListBoxDoc(
      anchorWith([
        slotText("t-label", "label", "Static Label"),
        slotText("t-desc", "description", "{email}"),
      ]),
    );
    const graph = buildCanvasSceneGraph(doc);
    // label: 토큰 없음 → compile null → 기존 휴리스틱 (name) — literal 텍스트로 대체하지 않음.
    // description: 토큰 있음 → 보간. (role 별 독립)
    expect(rowOf(graph, "u1")?.props).toMatchObject({
      children: "Kim",
      description: "kim@x.io",
    });
  });

  it("seed 템플릿 {label}/{description} → 가상 필드로 휴리스틱과 bit-동일 (BC)", () => {
    const doc = buildListBoxDoc(
      anchorWith([
        slotText("t-label", "label", "{label}"),
        slotText("t-desc", "description", "{description}"),
      ]),
    );
    const graph = buildCanvasSceneGraph(doc);
    // items 에 label/description 필드가 없어도 가상 필드가 휴리스틱 산출(name / "")을 공급.
    expect(rowOf(graph, "u1")?.props).toMatchObject({
      children: "Kim",
      description: "",
    });
  });

  it("slot 자식 없는 flat anchor 의 item-level children 템플릿도 보간 (§2-3-1 커버리지)", () => {
    const doc = buildListBoxDoc(anchorWith([], { children: "{num} — {name}" }));
    const graph = buildCanvasSceneGraph(doc);
    expect(rowOf(graph, "u1")?.props).toMatchObject({
      children: "7 — Kim",
      textValue: "7 — Kim",
    });
  });

  it("템플릿 소스 전무(anchor 자식/props 없음) → 기존 휴리스틱 (BC)", () => {
    const doc = buildListBoxDoc(anchorWith([]));
    const graph = buildCanvasSceneGraph(doc);
    expect(rowOf(graph, "u1")?.props).toMatchObject({
      children: "Kim",
      description: "",
    });
  });

  it("GridList origin slot text 템플릿 → 카드 children 보간 (ListBox 동형)", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "gl-item-template",
          type: "GridListItem",
          reusable: true,
          props: {},
          children: [
            {
              id: "gl-t-label",
              type: "Text",
              props: { slot: "label", children: "#{num} {name}" },
              metadata: { type: "listbox-item-slot", slotRole: "label" },
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
                {
                  id: "gridlist-1",
                  type: "GridList",
                  slot: ["gl-item-template"],
                  props: { items: users, layout: "stack" },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const graph = buildCanvasSceneGraph(doc);
    const card = graph.nodesMap.get(
      toCollectionRowProjectionId("gridlist", "gridlist-1", "u1"),
    );
    expect(card?.props).toMatchObject({
      children: "#7 Kim",
      textValue: "#7 Kim",
    });
  });
});

/**
 * ADR-228 — catalog 파생 origin 의 ref instance 는 명시 patch 만 갖는다 (props {}). scene 층의
 * projection gate (Breadcrumbs `props.items`) 가 raw instance props 를 읽으면 crumb 이 0 이 되어
 * Skia 폭 0 (live 실측 2026-09-21) — scene node 는 origin 기본 props 위에 instance override 를
 * 얹어야 한다 (`resolveCanonicalRefElement` 와 같은 merge).
 */
describe("buildCanvasSceneGraph — ADR-228 ref instance 의 origin props 상속", () => {
  const items = [
    { id: "c1", label: "Home", href: "/" },
    { id: "c2", label: "Category", href: "/category" },
    { id: "c3", label: "Page" },
  ];
  function makeDoc(
    instanceProps: Record<string, unknown>,
  ): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "page-components",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-components" },
          children: [
            {
              id: "page-components-body",
              type: "body",
              props: {},
              children: [
                {
                  id: "component-breadcrumbs",
                  type: "Breadcrumbs",
                  name: "Breadcrumbs",
                  reusable: true,
                  props: { size: "M", isDisabled: false, items },
                  metadata: { type: "catalog-origin", systemOwned: true },
                },
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
              type: "body",
              props: {},
              children: [
                {
                  id: "inst",
                  type: "ref",
                  ref: "component-breadcrumbs",
                  name: "Breadcrumbs",
                  props: instanceProps,
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }

  it("props {} instance 도 origin items 로 crumb projection 행 3 을 낸다 (scene type = origin type)", () => {
    const graph = buildCanvasSceneGraph(makeDoc({}));
    const inst = graph.nodesMap.get("inst");
    expect(inst?.type).toBe("Breadcrumbs");
    expect((inst?.props as { items?: unknown[] }).items).toHaveLength(3);
    const crumbs = [...graph.nodesMap.keys()].filter((id) =>
      id.startsWith("projection:breadcrumb-row:inst:"),
    );
    expect(crumbs).toHaveLength(3);
  });

  it("instance override 는 origin 값을 덮고 style 은 deep-merge 된다", () => {
    const graph = buildCanvasSceneGraph(
      makeDoc({ size: "L", style: { marginTop: 4 } }),
    );
    const inst = graph.nodesMap.get("inst");
    expect(inst?.props.size).toBe("L");
    expect(inst?.props.isDisabled).toBe(false);
    expect(inst?.props.style).toEqual({ marginTop: 4 });
  });
});

// ─── ADR-229 Phase 1 — TagGroup chip item template origin read-through ────────────────
//
// chip 은 `items[]` 데이터로만 합성됐고 template origin 이 없었다 (`templateOriginId: null`).
//   이제 TagList 의 `slot: [default, selected]` (ref instance 면 master TagGroup 의 TagList 자식)
//   에서 item origin 을 읽어 chip 에 root style · fills · slot 존재 gating · label typography 를
//   주입한다 — ListBox 행 `appendListBoxRowProjection` 의 templateAnchorStyle/_slots 동형.
describe("ADR-229 Phase 1 — TagGroup chip item template origin", () => {
  const ITEMS = [
    { id: "a", label: "A", icon: "star", avatar: "https://x/a.png" },
    { id: "b", label: "B", icon: "inbox" },
    { id: "c", label: "C" },
  ];

  function slotChildren(
    originId: string,
    roles: ReadonlyArray<"icon" | "avatar" | "label">,
    labelStyle?: Record<string, unknown>,
    iconStyle?: Record<string, unknown>,
  ): CanonicalNode[] {
    return roles.map((role) => {
      if (role === "icon") {
        return {
          id: `${originId}__icon`,
          type: "Icon",
          props: { slot: "icon", iconName: "{icon}", ...(iconStyle ? { style: iconStyle } : {}) },
          metadata: { slotRole: "icon", optional: true },
        } as unknown as CanonicalNode;
      }
      if (role === "avatar") {
        return {
          id: `${originId}__avatar`,
          type: "Avatar",
          props: { slot: "avatar", src: "{avatar}" },
          metadata: { slotRole: "avatar", optional: true },
        } as unknown as CanonicalNode;
      }
      return {
        id: `${originId}__label`,
        type: "Text",
        props: { slot: "label", children: "{label}", ...(labelStyle ? { style: labelStyle } : {}) },
        metadata: { slotRole: "label" },
      } as unknown as CanonicalNode;
    });
  }

  function tagOrigins(input: {
    defaultStyle?: Record<string, unknown>;
    defaultRoles?: ReadonlyArray<"icon" | "avatar" | "label">;
    labelStyle?: Record<string, unknown>;
    iconStyle?: Record<string, unknown>;
    defaultFills?: unknown[];
    selectedStyle?: Record<string, unknown>;
  }): CanonicalNode[] {
    return [
      {
        id: "component-tag-item-default",
        type: "Tag",
        reusable: true,
        props: { children: "{label}", style: input.defaultStyle ?? {} },
        ...(input.defaultFills ? { fills: input.defaultFills } : {}),
        children: slotChildren(
          "component-tag-item-default",
          input.defaultRoles ?? ["icon", "avatar", "label"],
          input.labelStyle,
          input.iconStyle,
        ),
        metadata: { type: "tag-template-origin", variant: "default" },
      },
      {
        id: "component-tag-item-selected",
        type: "Tag",
        reusable: true,
        props: { children: "{label}", style: input.selectedStyle ?? {} },
        // seed 규약: selected 도 같은 slot 자식 (차이는 root style 뿐) — fixture 도 같은 구성.
        children: slotChildren(
          "component-tag-item-selected",
          input.defaultRoles ?? ["icon", "avatar", "label"],
          input.labelStyle,
          input.iconStyle,
        ),
        metadata: { type: "tag-template-origin", variant: "selected" },
      },
    ] as CanonicalNode[];
  }

  function makeDoc(input: {
    origins: CanonicalNode[];
    tagListSlot?: string[] | undefined;
    instance?: boolean;
    /** slot 보유자 — 기본 root (ListBox 동형, Phase 2 정정) · "tagList" 는 Phase 1 당일 legacy 폴백. */
    slotOn?: "root" | "tagList";
  }): CompositionDocument {
    const slotOn = input.slotOn ?? "root";
    const rootSlot =
      input.tagListSlot && slotOn === "root" ? { slot: input.tagListSlot } : {};
    const listSlot =
      input.tagListSlot && slotOn === "tagList" ? { slot: input.tagListSlot } : {};
    const tagGroupOrigin: CanonicalNode = {
      id: "component-taggroup",
      type: "TagGroup",
      reusable: true,
      props: { items: ITEMS, selectedKeys: ["b"], selectionMode: "multiple" },
      ...rootSlot,
      children: [
        { id: "component-taggroup__1", type: "Label", props: {} },
        {
          id: "component-taggroup__2",
          type: "TagList",
          // selectedKeys 는 propagation 으로 TagList 에 실린다 (production 모양).
          props: { selectedKeys: ["b"] },
          ...listSlot,
        },
      ],
    } as CanonicalNode;
    const pageChildren: CanonicalNode[] = input.instance
      ? [
          {
            id: "tg-inst",
            type: "ref",
            ref: "component-taggroup",
            props: {},
          } as CanonicalNode,
        ]
      : [
          {
            id: "taggroup-1",
            type: "TagGroup",
            props: { items: ITEMS, selectedKeys: ["b"], selectionMode: "multiple" },
            ...rootSlot,
            children: [
              { id: "label-1", type: "Label", props: {} },
              {
                id: "taglist-1",
                type: "TagList",
                props: { selectedKeys: ["b"] },
                ...listSlot,
              },
            ],
          } as CanonicalNode,
        ];
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
              children: [...input.origins, tagGroupOrigin],
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

  function chipsOf(doc: CompositionDocument, tagListId: string) {
    const graph = buildCanvasSceneGraph(doc, { activeBreakpoint: "desktop" });
    const byKey = (key: string) =>
      graph.nodesMap.get(toCollectionRowProjectionId("tag", tagListId, key))!;
    return {
      graph,
      tagList: graph.nodesMap.get(tagListId)!,
      a: byKey("a"),
      b: byKey("b"),
      c: byKey("c"),
    };
  }

  it("plain TagGroup — TagList slot[0] 의 origin root style 을 chip style 에 (layout 키 제외) · fills · templateOriginId 로 주입한다", () => {
    const doc = makeDoc({
      origins: tagOrigins({
        defaultStyle: {
          display: "flex",
          gap: 4,
          width: "fit-content",
          paddingLeft: 20,
          paddingRight: 20,
          borderRadius: 999,
        },
        defaultFills: [
          { id: "f1", type: "color", enabled: true, opacity: 1, color: "#11223344" },
        ],
        selectedStyle: { borderColor: "#ff0000" },
      }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
    });
    const { a, b, tagList } = chipsOf(doc, "taglist-1");
    expect(a.projection).toMatchObject({
      kind: "tag-row",
      templateOriginId: "component-tag-item-default",
    });
    // height:auto — layout 의 catalog size 축 fallback (Tag md height 30) 을 풀어 DOM 처럼
    //   line-height + padding + border 로 자라게 한다 (template 이 있을 때만).
    expect(a.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 999,
    });
    expect(a.fills).toEqual(doc.children[0].children![0].children![0].fills);
    // selected chip = default 위에 selected origin overlay (ListBox Selected 동형).
    expect(b.props._isSelected).toBe(true);
    expect(b.projection).toMatchObject({
      templateOriginId: "component-tag-item-selected",
    });
    expect(b.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 999,
      borderColor: "#ff0000",
    });
    // layout (fold/높이 추정) 이 같은 template 을 읽도록 TagList props 에도 주입.
    expect(tagList.props._tagTemplateStyle).toEqual({
      paddingLeft: 20,
      paddingRight: 20,
      borderRadius: 999,
    });
    expect(tagList.props._slots).toMatchObject({
      order: ["icon", "avatar", "label"],
    });
  });

  it("slot 존재 gating — origin 에 Avatar slot 이 없으면 chip 의 avatar 데이터를 버리고 icon 은 남긴다 · icon slot 만 없으면 avatar 는 그대로", () => {
    const noAvatar = makeDoc({
      origins: tagOrigins({ defaultRoles: ["icon", "label"] }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
    });
    const chips1 = chipsOf(noAvatar, "taglist-1");
    expect(chips1.a.props.avatar).toBeUndefined();
    expect(chips1.a.props.icon).toBe("star");
    expect(chips1.c.props.icon).toBeUndefined();

    const noIcon = makeDoc({
      origins: tagOrigins({ defaultRoles: ["avatar", "label"] }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
    });
    const chips2 = chipsOf(noIcon, "taglist-1");
    expect(chips2.a.props.avatar).toBe("https://x/a.png");
    expect(chips2.a.props.icon).toBeUndefined();
    expect(chips2.b.props.icon).toBeUndefined();
  });

  it("label slot typography 는 chip root 로 fold 되고 icon slot 의 fontSize 는 `_leadingSlotSize` 로 실린다", () => {
    const doc = makeDoc({
      origins: tagOrigins({
        labelStyle: { fontSize: 18, fontWeight: 700, color: "#123456" },
        iconStyle: { fontSize: 20 },
      }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
    });
    const { a, b, c, tagList } = chipsOf(doc, "taglist-1");
    expect(a.props.style).toMatchObject({
      fontSize: 18,
      fontWeight: 700,
      color: "#123456",
      // lineHeight 는 Tag rule md 비율 (20/14, unitless 배율) 로 같이 — DOM line-height 비율 토큰과 정합.
      lineHeight: 20 / 14,
    });
    // icon 만 있는 chip → icon slot fontSize. avatar 가 이기는 chip 은 avatar slot 의 width (없으면 미주입).
    expect(b.props._leadingSlotSize).toBe(20);
    expect(a.props._leadingSlotSize).toBeUndefined();
    // leading 데이터가 없는 chip 은 크기도 싣지 않는다 (폭 shift 0 유지).
    expect(c.props._leadingSlotSize).toBeUndefined();
    expect(tagList.props._tagTemplateStyle).toMatchObject({
      fontSize: 18,
      lineHeight: 20 / 14,
    });
  });

  it("ref instance — synthetic TagList 는 master(component-taggroup) 의 TagList slot 으로 같은 origin 을 읽는다", () => {
    const doc = makeDoc({
      origins: tagOrigins({ defaultStyle: { paddingLeft: 20 } }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
      instance: true,
    });
    // instance 의 synthetic 자식 projection 은 `buildCanonicalSceneModel` (ref 해소 뒤 pass) 이 붙인다.
    const model = buildCanonicalSceneModel(doc, { activeBreakpoint: "desktop" });
    const byKey = (key: string) =>
      model.sceneNodesMap.get(
        toCollectionRowProjectionId("tag", "tg-inst/component-taggroup__2", key),
      )!;
    const a = byKey("a");
    const b = byKey("b");
    expect(a.projection).toMatchObject({
      templateOriginId: "component-tag-item-default",
    });
    expect(a.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      paddingLeft: 20,
    });
    expect(b.projection).toMatchObject({
      templateOriginId: "component-tag-item-selected",
    });
  });

  it("legacy — TagList 에 slot 이 없으면 표준 origin id 로 안전망 해석, origin 도 없으면 chip 은 종전 그대로 (BC)", () => {
    const withOrigins = makeDoc({
      origins: tagOrigins({ defaultStyle: { paddingLeft: 20 } }),
      tagListSlot: undefined,
    });
    expect(chipsOf(withOrigins, "taglist-1").a.props.style).toEqual({
      width: "fit-content",
      height: "auto",
      paddingLeft: 20,
    });

    const noOrigins = makeDoc({ origins: [], tagListSlot: undefined });
    const { a, tagList } = chipsOf(noOrigins, "taglist-1");
    expect(a.props.style).toEqual({ width: "fit-content" });
    expect(a.props.avatar).toBe("https://x/a.png");
    expect(a.props.icon).toBe("star");
    expect(a.projection).toMatchObject({ templateOriginId: null });
    expect(tagList.props._tagTemplateStyle).toBeUndefined();
    expect(tagList.props._slots).toBeUndefined();
  });

  it("resolveTagTemplateOriginIds / resolveTagItemTemplateStyle 단위 계약", () => {
    const nodes = new Map<string, CanonicalNode>();
    const doc = makeDoc({
      origins: tagOrigins({
        defaultStyle: { display: "flex", paddingLeft: 20 },
        labelStyle: { fontSize: 18 },
      }),
      tagListSlot: ["component-tag-item-default", "component-tag-item-selected"],
    });
    const walk = (n: CanonicalNode) => {
      nodes.set(n.id, n);
      n.children?.forEach(walk);
    };
    doc.children.forEach(walk);
    const get = () => nodes;
    // owner TagGroup root 의 slot (부모 탐색) 이 정본.
    expect(resolveTagTemplateOriginIds(nodes.get("taglist-1")!, get, null)).toEqual({
      defaultOriginId: "component-tag-item-default",
      selectedOriginId: "component-tag-item-selected",
    });
    // slot 순서가 뒤집혀도 selected 는 metadata.variant 로 찾는다 (root slot 을 뒤집어 대조).
    const flippedNodes = new Map(nodes);
    flippedNodes.set("taggroup-1", {
      ...nodes.get("taggroup-1")!,
      slot: ["component-tag-item-selected", "component-tag-item-default"],
    } as CanonicalNode);
    expect(
      resolveTagTemplateOriginIds(nodes.get("taglist-1")!, () => flippedNodes, null),
    ).toEqual({
      defaultOriginId: "component-tag-item-selected",
      selectedOriginId: "component-tag-item-selected",
    });
    // legacy 폴백 — root slot 없이 TagList 자식만 slot 을 가진 문서 (Phase 1 당일 시드).
    const legacyNodes = new Map<string, CanonicalNode>(nodes);
    const legacyList = { ...nodes.get("taglist-1")!, slot: ["component-tag-item-default", "component-tag-item-selected"] } as CanonicalNode;
    const legacyOwner = (({ slot: _s, ...rest }) => rest)(nodes.get("taggroup-1")! as CanonicalNode & { slot?: unknown });
    legacyNodes.set("taggroup-1", { ...(legacyOwner as CanonicalNode), children: [nodes.get("label-1")!, legacyList] });
    legacyNodes.set("taglist-1", legacyList);
    expect(resolveTagTemplateOriginIds(legacyList, () => legacyNodes, null)).toEqual({
      defaultOriginId: "component-tag-item-default",
      selectedOriginId: "component-tag-item-selected",
    });
    expect(
      resolveTagItemTemplateStyle(nodes.get("component-tag-item-default"), "desktop"),
    ).toEqual({ paddingLeft: 20, fontSize: 18 });
    expect(resolveTagItemTemplateStyle(undefined, "desktop")).toBeNull();
  });
});
