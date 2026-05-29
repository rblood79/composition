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
});
