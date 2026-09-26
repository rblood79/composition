// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import { toCollectionRowProjectionId } from "../../../projection/renderProjectionIds";

/**
 * ADR-162 Phase 2 — 데이터 GridList 행 = 항목 origin 의 가상 instance.
 *
 * 항목 origin 에 역할 없는 자식 (Image) 이 있으면 데이터 행도 정적 카드처럼 origin 자식을 펼친다 (해석기
 * `materializeSyntheticDescendants` 가 행의 `ref` 를 보고 복제) — 글자 자식은 행 데이터로 `{field}` 보간된
 * 값을 `descendants` 로 받는다. 펼친 자식은 행 projection 을 물려받아 클릭이 owner GridList 로 간다.
 * 자식이 전부 slot 이면 종전대로 자식 없는 행 (escape 가 카드 전체 — BC).
 */

const ITEMS = [
  { id: "a", label: "Alpha", description: "desc A" },
  { id: "b", label: "Beta", description: "desc B" },
];

function origin(id: string, withImage: boolean) {
  return {
    id,
    type: "GridListItem",
    reusable: true,
    props: { children: "{label}", description: "{description}" },
    children: [
      {
        id: `${id}__label`,
        type: "Text",
        props: { children: "{label}" },
      },
      {
        id: `${id}__description`,
        type: "Text",
        props: { slot: "description", children: "{description}" },
      },
      ...(withImage
        ? [
            {
              id: `${id}__image`,
              type: "Image",
              props: { alt: "{label} 사진", style: { width: 48, height: 48 } },
            },
          ]
        : []),
    ],
  };
}

function makeDoc(): CompositionDocument {
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
            children: [
              origin("card-image", true),
              {
                ...origin("card-slots", false),
                children: origin("card-slots", false).children.map((c, i) =>
                  i === 0
                    ? { ...c, props: { slot: "label", children: "{label}" } }
                    : c,
                ),
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
            type: "Body",
            props: {},
            children: [
              {
                id: "gl-image",
                type: "GridList",
                slot: ["card-image"],
                props: { items: ITEMS },
              },
              {
                id: "gl-slots",
                type: "GridList",
                slot: ["card-slots"],
                props: { items: ITEMS },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

describe("ADR-162 Phase 2 — 데이터 행 = 항목 origin 가상 instance (Canvas)", () => {
  const model = buildCanonicalSceneModel(makeDoc());
  const kidsOf = (ownerId: string, key: string) =>
    model.sceneChildrenByParent.get(
      toCollectionRowProjectionId("gridlist", ownerId, key),
    ) ?? [];

  it("역할 없는 자식이 있는 origin — 행마다 label · 설명 · Image 를 펼치고 글자는 행 데이터", () => {
    for (const [key, item] of [
      ["a", ITEMS[0]],
      ["b", ITEMS[1]],
    ] as const) {
      const kids = kidsOf("gl-image", key);
      expect(
        kids.map((k) => k.type),
        key,
      ).toEqual(["Text", "Text", "Image"]);
      expect(kids[0]?.props.children, key).toBe(item.label);
      expect(kids[1]?.props.children, key).toBe(item.description);
      expect(kids[2]?.props.alt, key).toBe(`${item.label} 사진`);
    }
  });

  it("펼친 자식은 행 projection 을 물려받는다 (클릭 → owner GridList)", () => {
    const kids = kidsOf("gl-image", "a");
    expect(kids).toHaveLength(3);
    for (const kid of kids) {
      expect(kid.projection?.kind, kid.id).toBe("gridlist-row");
      expect(
        (kid.projection as { listBoxId?: string } | undefined)?.listBoxId,
      ).toBe("gl-image");
    }
  });

  it("펼친 GridList 는 컨테이너 높이 공식을 끄는 신호를 받는다 (slot-only 는 안 받는다)", () => {
    expect(
      model.sceneNodesMap.get("gl-image")?.props._expandedTemplateRows,
    ).toBe(true);
    expect(
      model.sceneNodesMap.get("gl-slots")?.props._expandedTemplateRows,
    ).toBeUndefined();
  });

  it("자식이 전부 slot 인 origin — 행은 자식 없이 escape 가 그린다 (BC)", () => {
    expect(kidsOf("gl-slots", "a")).toEqual([]);
  });
});
