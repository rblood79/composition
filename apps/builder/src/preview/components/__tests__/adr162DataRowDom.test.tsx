import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getCatalogCutoverTypes,
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
