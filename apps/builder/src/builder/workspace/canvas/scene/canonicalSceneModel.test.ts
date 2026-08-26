// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getPageElements } from "../../../stores/utils/elementIndexer";
import { buildPageDataMap } from "./buildSceneIndex";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import { toPageFrameElementId } from "./resolvePageWithFrame";
import { toListBoxRowProjectionId } from "../../../projection/renderProjectionIds";

describe("buildCanonicalSceneModel — ADR-127 Phase 2 (canonical-native)", () => {
  it("builds canonical-native node maps from canonical children source order", () => {
    const document: CompositionDocument = {
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
                  id: "second",
                  type: "Button",
                  props: { children: "Second" },
                },
                {
                  id: "first",
                  type: "Button",
                  props: { children: "First" },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const model = buildCanonicalSceneModel(document);

    // ADR-127 Phase 2 — primary export 가 nodes (CanonicalNode[]) + nodesMap
    expect(model.nodes.map((node) => node.id)).toEqual([
      "page-1",
      "body-1",
      "second",
      "first",
    ]);
    expect(model.nodesMap.get("first")?.type).toBe("Button");
    expect(model.nodesMap.get("body-1")?.type).toBe("Body");

    // childrenByParent: parent id → CanonicalNode[] (children 배열 순서 보존)
    expect(
      model.childrenByParent.get("body-1")?.map((node) => node.id),
    ).toEqual(["second", "first"]);
    expect(
      model.childrenByParent.get("page-1")?.map((node) => node.id),
    ).toEqual(["body-1"]);

    // sceneNodes 는 renderable canonical node projection 이며 flat legacy
    // projection 없이 page scope 를 보존한다.
    expect(model.sceneNodes.map((node) => node.id)).toEqual([
      "body-1",
      "second",
      "first",
    ]);
    expect(model.sceneNodesMap.get("second")?.parentId).toBe("body-1");
    expect(model.sceneNodesMap.get("second")?.pageId).toBe("page-1");
    expect(
      model.sceneChildrenByParent.get("body-1")?.map((node) => node.id),
    ).toEqual(["second", "first"]);

    // pageIndex 는 sceneNodes 에서 직접 derive 된다.
    expect([
      ...(model.pageIndex.elementsByPage.get("page-1") ?? new Set()),
    ]).toEqual(["body-1", "second", "first"]);
  });

  it("propagates the frame layoutId onto scene nodes", () => {
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { layoutId: "frame-1" },
          children: [
            {
              id: "frame-body-1",
              type: "body",
              props: {},
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const model = buildCanonicalSceneModel(document);
    const body = model.sceneNodesMap.get("frame-body-1");

    expect(body?.layoutId).toBe("frame-1");
    expect(body?.pageId).toBeNull();
    expect(body?.page_id).toBeNull();
  });

  it("does not route Skia scene model through canonicalElementSnapshot helper", async () => {
    const source = await readFile(
      resolve(__dirname, "canonicalSceneModel.ts"),
      "utf-8",
    );

    // ADR-127 Phase 2 — buildCanonicalSceneModel 은 자체 traversal
    // (flattenCanonicalDocumentNodes) 사용. canonicalElementSnapshot helper 미경유.
    expect(source).not.toContain(
      ["getCanonicalElements", "SnapshotFromDocument"].join(""),
    );
    expect(source).not.toContain("canonicalDocumentToElements");
  });

  it("resolves bound page ref descendants before deriving pageIndex", () => {
    const document: CompositionDocument = {
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
                  id: "frame-text-1",
                  type: "Text",
                  props: { children: "inside" },
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

    const model = buildCanonicalSceneModel(document);
    const pageElements = getPageElements(
      model.pageIndex,
      "page-1",
      model.sceneNodesMap,
    );

    const bodyElement = pageElements.find(
      (element) => element.type.toLowerCase() === "body",
    );

    expect(bodyElement).toBeDefined();
    expect(bodyElement?.type).toBe("Body");
    expect(bodyElement?.id).toBe("page-1/frame-body-1");
    expect(pageElements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bodyElement!.id, type: "Body" }),
      ]),
    );
    expect(model.sceneNodesMap.has(bodyElement!.id)).toBe(true);
  });

  it("keeps page-owned body descendants when a bound page ref materializes frame slots", () => {
    const document: CompositionDocument = {
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
              type: "body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-content",
                  type: "frame",
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  props: {},
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
          descendants: {
            content: {
              children: [
                {
                  id: "page-body-1",
                  type: "body",
                  props: { style: { width: 390, height: 844 } },
                },
              ],
            },
          },
        },
      ],
    } as unknown as CompositionDocument;

    const model = buildCanonicalSceneModel(document);
    const pageData = buildPageDataMap(
      [
        {
          id: "page-1",
          project_id: "project-1",
          slug: "page-1",
          title: "Page 1",
          layout_id: "frame-1",
        } as never,
      ],
      model.pageIndex,
      model.sceneNodesMap,
    ).get("page-1");

    expect(
      model.sceneChildrenByParent.get("page-1")?.map((node) => node.id),
    ).toEqual(expect.arrayContaining(["page-body-1", "page-1/frame-body-1"]));
    expect(pageData?.bodyElement?.id).toBe("page-body-1");
    expect(pageData?.pageElements.map((element) => element.id)).toContain(
      toPageFrameElementId("page-1", "slot-content"),
    );
    expect(pageData?.pageElements.map((element) => element.id)).not.toContain(
      "page-1",
    );
  });

  it("keeps page ref instance descendants under the projected frame Slot", () => {
    const document: CompositionDocument = {
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
              type: "body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-content",
                  type: "frame",
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  props: {},
                },
              ],
            },
          ],
        },
        {
          id: "button-origin",
          type: "Button",
          reusable: true,
          props: { children: "Origin" },
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
          descendants: {
            "frame-body-1/slot-content": {
              children: [
                {
                  id: "button-1",
                  type: "Button",
                  props: { children: "Button" },
                },
                {
                  id: "button-4",
                  type: "ref",
                  ref: "button-origin",
                },
              ],
            },
          },
        },
      ],
    } as unknown as CompositionDocument;

    const model = buildCanonicalSceneModel(document);
    const pageData = buildPageDataMap(
      [
        {
          id: "page-1",
          project_id: "project-1",
          slug: "page-1",
          title: "Page 1",
          layout_id: "frame-1",
        } as never,
      ],
      model.pageIndex,
      model.sceneNodesMap,
    ).get("page-1");
    const projectedSlotId = toPageFrameElementId("page-1", "slot-content");
    const pageButton = pageData?.pageElements.find(
      (element) => element.id === "button-1",
    );
    const instanceButton = pageData?.pageElements.find(
      (element) => element.id === "button-4",
    );

    expect(pageButton?.parent_id).toBe(projectedSlotId);
    expect(instanceButton?.parent_id).toBe(projectedSlotId);
    expect(pageButton?.parentId).toBe(projectedSlotId);
    expect(instanceButton?.parentId).toBe(projectedSlotId);
  });

  it("projects rows for a ListBox ref instance of the Components origin", () => {
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "component-listbox-item-default",
          type: "ListBoxItem",
          reusable: true,
          props: { children: "{label}", description: "{description}" },
        },
        {
          id: "component-listbox",
          type: "ListBox",
          reusable: true,
          props: {
            orientation: "vertical",
            selectionMode: "single",
            items: [],
          },
          slot: ["component-listbox-item-default"],
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
                  id: "listbox-1",
                  type: "ref",
                  ref: "component-listbox",
                  name: "ListBox",
                  props: {
                    items: [{ id: "aardvark", label: "Aardvark" }],
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
                        originRef: "component-listbox-item-default",
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

    const model = buildCanonicalSceneModel(document);
    const listBox = model.sceneNodesMap.get("listbox-1");
    const row = model.sceneNodesMap.get(
      toListBoxRowProjectionId("listbox-1", "aardvark"),
    );

    expect(listBox).toMatchObject({
      id: "listbox-1",
      type: "ListBox",
      ref: "component-listbox",
    });
    expect(row).toMatchObject({
      type: "ListBoxItem",
      parentId: "projection:listbox-rows:listbox-1",
      props: {
        children: "Aardvark",
        textValue: "Aardvark",
      },
    });
  });
  it("does not clone the origin's own row projection into a ListBox ref instance (origin items ≠ instance items)", () => {
    // 재현 (2026-08-26 live): Components 페이지 origin `component-listbox` 가 자기 items(Inbox/Starred/Archive)를
    // 가지면 origin 에 rows projection 이 생기고, ref 해석기가 master 의 scene 자식을 복제하면서 그 projection 까지
    // `{instance}/projection:listbox-rows:component-listbox/...` 로 인스턴스 아래에 실어 Skia owner 가 320(=164+156)
    // 이 됐다. DOM 은 인스턴스 items 3행만 렌더 → 비대칭. projection 은 owner 파생이라 ref 로 상속되면 안 된다.
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "component-listbox-item-default",
          type: "ListBoxItem",
          reusable: true,
          props: { children: "{label}", description: "{description}" },
        },
        {
          id: "component-listbox",
          type: "ListBox",
          reusable: true,
          props: {
            orientation: "vertical",
            selectionMode: "single",
            items: [
              { id: "inbox", label: "Inbox" },
              { id: "starred", label: "Starred" },
              { id: "archive", label: "Archive" },
            ],
          },
          slot: ["component-listbox-item-default"],
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
                  id: "listbox-1",
                  type: "ref",
                  ref: "component-listbox",
                  name: "ListBox",
                  props: {
                    items: [
                      { id: "aardvark", label: "Aardvark" },
                      { id: "cat", label: "Cat" },
                      { id: "kangaroo", label: "Kangaroo" },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const model = buildCanonicalSceneModel(document);
    const instanceChildren = model.sceneChildrenByParent.get("listbox-1") ?? [];

    // 인스턴스 직계 = 자기 rows group 하나뿐 — origin projection 복제본(`listbox-1/projection:...`) 없음
    expect(instanceChildren.map((node) => node.id)).toEqual([
      "projection:listbox-rows:listbox-1",
    ]);
    expect(
      model.sceneNodes.filter((node) => node.id.startsWith("listbox-1/")),
    ).toEqual([]);
    // origin 자신의 projection 은 그대로 유지 (Components 페이지 렌더)
    expect(
      model.sceneNodesMap.get(toListBoxRowProjectionId("component-listbox", "inbox")),
    ).toMatchObject({ type: "ListBoxItem", props: { children: "Inbox" } });
    // 인스턴스 행은 인스턴스 items 3개만
    expect(
      (model.sceneChildrenByParent.get("projection:listbox-rows:listbox-1") ?? []).map(
        (node) => node.props?.children,
      ),
    ).toEqual(["Aardvark", "Cat", "Kangaroo"]);
  });
});

