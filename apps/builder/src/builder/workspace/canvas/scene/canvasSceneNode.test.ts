// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  buildCanvasSceneGraph,
  buildCanvasScenePageIndex,
} from "./canvasSceneNode";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
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
    // window limit 100 — 10k 카드 중 100개만 projected (60fps 보호).
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

  it("suppresses ListBoxItem slot composed children from the visible scene (ADR-147 render.shapes 단일 렌더러)", () => {
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

    // ListBoxItem 자체는 scene 에 존재(render.shapes 가 렌더)
    expect(graph.nodesMap.get("lbi-origin")).toBeDefined();
    // slot 조합 자식(Icon/Label/Description)은 가시 scene 에서 제외 — stacked 중복 렌더 방지
    expect(graph.nodesMap.has("lbi-origin__icon")).toBe(false);
    expect(graph.nodesMap.has("lbi-origin__label")).toBe(false);
    expect(graph.nodesMap.has("lbi-origin__description")).toBe(false);
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
    expect(headerRow).toMatchObject({
      type: "TableRow",
      parentId: rowsGroup?.id,
      props: { _isHeader: true },
      projection: { kind: "table-row", listBoxId: "table-1", isHeader: true },
    });

    const dataRow = graph.nodesMap.get(
      toCollectionRowProjectionId("table", "table-1", "r1"),
    );
    expect(dataRow).toMatchObject({
      type: "TableRow",
      props: { _isHeader: false },
      projection: { kind: "table-row", itemKey: "r1", isHeader: false },
    });

    // header 셀: label = column.label, cell: row.cells[columnId].
    const headerNameCell = graph.nodesMap.get(
      toCollectionCellProjectionId("table", "table-1", "__header__", "name"),
    );
    expect(headerNameCell).toMatchObject({
      type: "TableCell",
      parentId: headerRow?.id,
      props: { children: "Name", _isHeader: true, _columnWidth: 120 },
      projection: { kind: "table-cell", columnId: "name", isHeader: true },
    });

    const dataRoleCell = graph.nodesMap.get(
      toCollectionCellProjectionId("table", "table-1", "r1", "role"),
    );
    expect(dataRoleCell).toMatchObject({
      type: "TableCell",
      parentId: dataRow?.id,
      props: { children: "Admin", _isHeader: false, _columnWidth: 80 },
      projection: { kind: "table-cell", columnId: "role", itemKey: "r1" },
    });

    // projected 노드는 자체 렌더 → canonical ref 없음 (비영속).
    expect(dataRoleCell?.ref).toBeUndefined();
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
    // data 행 window limit 100 (60fps 보호) + header 행 1개.
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
});
