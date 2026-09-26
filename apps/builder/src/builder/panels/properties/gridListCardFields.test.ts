// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../../components/reusableCompositeOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../components/templateItemOriginIds";
import { readGridListCardFields } from "./gridListCardFields";
import { fieldsFromOwner } from "./hooks/useOwnerCollectionColumns";

/**
 * ADR-162 Phase 5 — 「카드 필드」 절 입력 목록. 선택된 데이터 GridList 의 항목 origin (Canvas 와 같은 해석)
 * 자손의 연결 가능 prop 을 문서 순서로 나열하고, 컬럼은 선택된 GridList 의 데이터에서 온다.
 */

const ITEMS = [{ id: "r1", title: "One", photo: "https://x/1.png" }];

function collect(
  nodes: readonly CanonicalNode[],
  byId: Map<string, CanonicalNode>,
) {
  for (const node of nodes) {
    byId.set(node.id, node);
    collect(node.children ?? [], byId);
  }
  return byId;
}

function makeDoc() {
  const doc = ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [
          {
            id: "body-home",
            type: "body" as CanonicalNode["type"],
            children: [
              {
                id: "gl-data",
                type: "GridList",
                dataBinding: {
                  type: "collection",
                  source: "static",
                  config: { data: ITEMS },
                },
                props: {},
              },
              { id: "gl-plain", type: "GridList", props: {} },
              {
                id: "gl-custom",
                type: "GridList",
                slot: ["my-card"],
                dataBinding: {
                  type: "collection",
                  source: "static",
                  config: { data: ITEMS },
                },
                props: {},
              },
              {
                id: "my-card",
                type: "GridListItem",
                reusable: true,
                props: {},
                children: [
                  {
                    id: "my-card-link",
                    type: "Link",
                    name: "More",
                    props: { children: "{title}" },
                  },
                ],
              },
            ] as unknown as CanonicalNode[],
          },
        ],
      },
    ],
  } as CompositionDocument);
  const byId = collect(doc.children, new Map());
  const origin = byId.get(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID)!;
  const image = {
    id: "p5-image",
    type: "Image",
    props: { alt: "{title}" },
  } as unknown as CanonicalNode;
  origin.children = [...(origin.children ?? []), image];
  byId.set(image.id, image);
  return byId;
}

describe("ADR-162 Phase 5 — 데이터 GridList 「카드 필드」", () => {
  const byId = makeDoc();

  it("기본 origin — label · 설명 Text 의 children 과 Image src · alt (값 없는 src 도 연결 대상)", () => {
    const read = readGridListCardFields("gl-data", byId)!;
    expect(read.originId).toBe(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
    const rows = read.rows.map((r) => [r.nodeId, r.key, r.value]);
    expect(rows.slice(-2)).toEqual([
      ["p5-image", "src", ""],
      ["p5-image", "alt", "{title}"],
    ]);
    const textRows = read.rows.filter((r) => r.nodeId !== "p5-image");
    expect(textRows.map((r) => r.key)).toEqual(["children", "children"]);
    expect(textRows.map((r) => r.value)).toEqual(["{label}", "{description}"]);
  });

  it("컬럼 = 선택된 GridList 의 데이터 키", () => {
    const read = readGridListCardFields("gl-data", byId)!;
    expect(fieldsFromOwner(read.owner, [])?.map((f) => f.key)).toEqual([
      "id",
      "title",
      "photo",
    ]);
  });

  it("slot 에 custom origin 을 둔 GridList — 그 origin 자손을 읽는다", () => {
    const read = readGridListCardFields("gl-custom", byId)!;
    expect(read.originId).toBe("my-card");
    expect(read.rows.map((r) => [r.nodeLabel, r.key])).toEqual([
      ["More", "children"],
      ["More", "href"],
    ]);
  });

  it("데이터 없는 GridList · GridList 가 아닌 선택 — null (절 미노출)", () => {
    expect(readGridListCardFields("gl-plain", byId)).toBeNull();
    expect(readGridListCardFields("p5-image", byId)).toBeNull();
  });
});
