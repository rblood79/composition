import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CanvasSceneNode } from "./canvasSceneNode";
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
    // synthetic 노드 타입은 CanvasSceneNode → CanvasLayoutNode 로 이름이 바뀌었다.
    // 계약(캐시 엔트리가 synthetic map 을 보유)은 동일 — 현재 심볼로 앵커.
    expect(source).toMatch(
      /syntheticElementsMap: Map<string, CanvasLayoutNode> \| null;/,
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
    } as CanvasSceneNode;
    const first = {
      id: "first",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 10,
      props: {},
      // order_num 은 canonical 에서 제거됨 — 본 테스트는 source order 우선을 검증하려고
      // 의도적 decoy(10)를 둔다. 값 보존 위해 unknown 경유 cast.
    } as unknown as CanvasSceneNode;
    const second = {
      id: "second",
      type: "Box",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
      props: {},
    } as unknown as CanvasSceneNode;

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
