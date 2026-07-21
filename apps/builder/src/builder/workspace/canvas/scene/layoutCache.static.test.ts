import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CanvasSceneNode } from "./canvasSceneNode";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import { buildPageChildrenMap, createPageLayoutSignature } from "./layoutCache";

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

  // 2026-07-21 사용자 보고: origin ListBoxItem label/description size 편집 시 instance 행
  //   fontSize 는 escape 로 live 렌더되지만 텍스트 영역 **높이**는 새로고침 후에만 반영됐다.
  //   근본 원인 = projection 이 주입한 `props._slots`(slot fontSize 보유)로 행 높이를 산출하는데
  //   (utils.ts resolveListBoxItemRowHeightFromStyle), `_slots` 가 LAYOUT_PROP_KEYS 에 없어 행
  //   레이아웃 시그니처가 불변 → 캐시 히트로 높이 stale. `_slots` 추가로 시그니처가 fontSize 를
  //   반영해 캐시 무효화되는지 회귀 가드 (fix 전엔 두 시그니처 동일 → FAIL).
  it("invalidates layout signature when projected _slots label fontSize changes", () => {
    const makeRow = (labelFontSize: number): CanvasLayoutNode =>
      ({
        id: "listbox__row__a",
        type: "ListBoxItem",
        page_id: "page-1",
        parent_id: "rows",
        props: {
          children: "Item A",
          _slots: {
            order: ["label"],
            slots: {
              label: { role: "label", style: { fontSize: labelFontSize } },
            },
          },
          style: { width: "100%" },
        },
      }) as unknown as CanvasLayoutNode;

    const sigSmall = createPageLayoutSignature(null, [makeRow(14)]);
    const sigLarge = createPageLayoutSignature(null, [makeRow(30)]);
    expect(sigSmall).not.toBe(sigLarge);
  });
});
