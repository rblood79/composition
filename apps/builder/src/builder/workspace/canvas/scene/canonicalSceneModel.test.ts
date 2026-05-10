// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildCanonicalSceneModel } from "./canonicalSceneModel";

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
});
