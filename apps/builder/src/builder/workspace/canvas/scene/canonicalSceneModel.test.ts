// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildCanonicalSceneModel } from "./canonicalSceneModel";

describe("buildCanonicalSceneModel", () => {
  it("builds Skia scene input maps from canonical children source order", () => {
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
              type: "body",
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
    };

    const model = buildCanonicalSceneModel(document);

    expect(model.elements.map((element) => element.id)).toEqual([
      "body-1",
      "second",
      "first",
    ]);
    expect(model.elements.every((element) => !("order_num" in element))).toBe(
      true,
    );
    expect(model.elementsMap.get("first")?.page_id).toBe("page-1");
    expect(
      model.childrenByParent.get("body-1")?.map((element) => element.id),
    ).toEqual(["second", "first"]);
    expect([
      ...(model.pageIndex.elementsByPage.get("page-1") ?? new Set()),
    ]).toEqual(["body-1", "second", "first"]);
  });

  it("does not route Skia scene model through canonicalElementSnapshot helper", async () => {
    const source = await readFile(
      resolve(__dirname, "canonicalSceneModel.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain(
      ["getCanonicalElements", "SnapshotFromDocument"].join(""),
    );
  });
});
