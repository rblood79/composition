import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Element } from "../../../../types/core/store.types";
import { buildPageChildrenMap } from "./layoutCache";

describe("layoutCache filtered children republish contract", () => {
  it("republishes cached filtered and synthetic children on page layout cache hit", async () => {
    const source = await readFile(
      resolve(__dirname, "layoutCache.ts"),
      "utf-8",
    );

    expect(source).toMatch(/getPublishedFilteredChildrenMap/);
    expect(source).toMatch(/getPublishedSyntheticElementsMap/);
    expect(source).toMatch(/publishFilteredChildrenMap/);
    expect(source).toMatch(/publishSyntheticElementsMap/);
    expect(source).toMatch(
      /filteredChildIdsMap: Map<string, string\[]> \| null;/,
    );
    expect(source).toMatch(
      /syntheticElementsMap: Map<string, Element> \| null;/,
    );
    expect(source).toMatch(/rootKey: string;/);
    expect(source).toMatch(
      /publishFilteredChildrenMap\(\s*cachedEntry\.filteredChildIdsMap,\s*cachedEntry\.rootKey,\s*\);/,
    );
    expect(source).toMatch(
      /publishSyntheticElementsMap\(\s*cachedEntry\.syntheticElementsMap,\s*cachedEntry\.rootKey,\s*\);/,
    );
    expect(source).toMatch(
      /const filteredChildIdsMap = getPublishedFilteredChildrenMap\(rootKey\);/,
    );
    expect(source).toMatch(
      /const syntheticElementsMap = getPublishedSyntheticElementsMap\(rootKey\);/,
    );
  });

  it("preserves page element source order instead of sorting by legacy order_num", () => {
    const body = {
      id: "body",
      type: "body",
      page_id: "page-1",
      parent_id: null,
      props: {},
    } as Element;
    const first = {
      id: "first",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 10,
      props: {},
    } as Element;
    const second = {
      id: "second",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
      props: {},
    } as Element;

    const childrenMap = buildPageChildrenMap({
      bodyElement: body,
      elementById: new Map([
        [body.id, body],
        [first.id, first],
        [second.id, second],
      ]),
      pageElements: [first, second],
    });

    expect(childrenMap.get(body.id)?.map((element) => element.id)).toEqual([
      first.id,
      second.id,
    ]);
  });
});
