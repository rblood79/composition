import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";
import {
  createGridListTemplateResolver,
  indexTemplateOriginRecords,
} from "../../utils/itemTemplates";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { ensureReusableCompositeOrigins } from "../../../builder/components/reusableCompositeOrigins";

/**
 * ADR-162 Phase 3 — Preview 데이터 GridList 카드 = 항목 origin 자식 (행 데이터로 보간).
 *
 * origin 에 역할 없는 자식 (Image) 이 있으면 Canvas 처럼 DOM 도 origin 자식을 행마다 그린다 — 글자 ·
 * 속성의 `{field}` 는 행 데이터로 채운다. 자식이 전부 slot 이면 종전 label · 설명 두 칸 (BC).
 */

afterEach(cleanup);

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
        props: withImage
          ? { children: "{label}" }
          : { slot: "label", children: "{label}" },
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
              props: { alt: "{label} 사진", src: "data:image/png;base64,AA" },
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
            children: [origin("card-image", true), origin("card-slots", false)],
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

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderOwner(id: string) {
  const resolved = resolveCanonicalDocument(makeDoc()) as ResolvedNode[];
  const resolver = createGridListTemplateResolver(
    indexTemplateOriginRecords(resolved),
  );
  const ctx = {
    childrenByParent: new Map(),
    renderElement: () => null,
    updateElementProps: () => {},
    resolveGridListTemplate: resolver.forOwner,
    resolveGridListRowTemplateChildren: resolver.rowTemplateChildrenForOwner,
  } as unknown as RenderContext;
  return render(
    <CanonicalNodeRenderer
      node={findResolved(resolved, id)!}
      renderContext={ctx}
      cutoverPrimitives={getCatalogCutoverTypes()}
    />,
  );
}

describe("ADR-162 Phase 3 — Preview 데이터 행 = 항목 origin 자식", () => {
  it("역할 없는 자식이 있는 origin — 행마다 label · 설명 · Image (속성까지 행 데이터)", () => {
    const { container } = renderOwner("gl-image");
    const cards = [
      ...container.querySelectorAll<HTMLElement>(".react-aria-GridListItem"),
    ];
    expect(cards).toHaveLength(2);
    ITEMS.forEach((item, i) => {
      const card = cards[i]!;
      expect(card.textContent, item.id).toContain(item.label);
      expect(
        card.querySelector('[slot="description"]')?.textContent,
        item.id,
      ).toBe(item.description);
      expect(card.querySelector("img")?.getAttribute("alt"), item.id).toBe(
        `${item.label} 사진`,
      );
      expect(card.textContent, item.id).not.toContain("{label}");
    });
  });

  it("자식이 전부 slot 인 origin — 종전 label · 설명 두 칸 (Image 없음)", () => {
    const { container } = renderOwner("gl-slots");
    const cards = [
      ...container.querySelectorAll<HTMLElement>(".react-aria-GridListItem"),
    ];
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("Alpha");
    expect(cards[0]?.querySelector("img")).toBeNull();
  });
});

describe("ADR-162 — 팔레트 GridList (변형 항목 origin) Preview 데이터 행", () => {
  it("master slot[0] = `--unselected` 변형 origin 이어도 해석기가 기본 origin 자식 (Image 포함) 을 행 템플릿으로 준다", () => {
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
              type: "body",
              children: [
                {
                  id: "gl-pal",
                  type: "ref",
                  ref: "component-gridlist",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: { data: ITEMS },
                  },
                  props: {},
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument);
    const find = (nodes: readonly CanonicalNode[]): CanonicalNode | undefined => {
      for (const n of nodes) {
        if (n.id === "component-gridlist-item-default") return n;
        const hit = find(n.children ?? []);
        if (hit) return hit;
      }
      return undefined;
    };
    const origin = find(doc.children)!;
    origin.children = [
      ...(origin.children ?? []),
      {
        id: "pal-image",
        type: "Image",
        props: { alt: "{label} 사진", src: "data:image/png;base64,AA" },
      } as unknown as CanonicalNode,
    ];
    // Preview 해석기 — 팔레트 instance (`_resolvedFrom` = master) 의 slot[0] 변형 origin 을 해석된 트리에서
    //   읽는다. (legacy `{type:"collection"}` 바인딩은 Preview 가 상속 정적 카드 (Path 3) 를 그리는 별도 경로라
    //   DOM 렌더 대신 해석기 결과를 본다 — production 바인딩 `{source:"dataTable"}` 은 Path 1.)
    const resolved = resolveCanonicalDocument(doc) as ResolvedNode[];
    const resolver = createGridListTemplateResolver(
      indexTemplateOriginRecords(resolved),
    );
    const kids = (resolver.rowTemplateChildrenForOwner({
      _resolvedFrom: "component-gridlist",
    }) ?? []) as { type?: string }[];
    expect(kids.map((k) => k.type)).toContain("Image");
  });
});
