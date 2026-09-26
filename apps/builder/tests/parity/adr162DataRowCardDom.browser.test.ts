import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Root } from "react-dom/client";
import React from "react";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
// production 과 같은 글꼴 (main.tsx).
import "pretendard/dist/web/static/pretendard.css";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { useStore } from "@/builder/stores";
import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";
import { CanonicalNodeRenderer } from "@/preview/components/CanonicalNodeRenderer";
import { resolveCanonicalDocument } from "@/resolvers/canonical";
import { ensureReusableCompositeOrigins } from "@/builder/components/reusableCompositeOrigins";
import {
  createGridListTemplateResolver,
  indexTemplateOriginRecords,
} from "@/preview/utils/itemTemplates";
import { mountPreviewNode, stubRenderContext } from "./adr923PreviewLeg";

/**
 * ADR-162 Phase 3 · G2 (b) — **Preview DOM oracle**: 항목 origin (production `component-gridlist-item-default`)
 * 에 Image (48×48, 역할 없는 자식) 를 넣은 데이터 GridList (static collection dataBinding 3 행 · 폭 400 —
 * 정적 `items` 는 ADR-234 가 자식 instance 로 옮기므로 production 데이터 목록은 dataBinding) 를 production Preview 경로
 * (CanonicalNodeRenderer → renderGridList items 경로 → `renderGridListRowTemplate`) 로 그려 카드 · 자식 상자를
 * 잰다. Canvas leg 는 실제 builder live (`apps/builder/scripts/adr162-p2-data-rows-live.mjs`, 2026-09-26) 의
 * layout map 값 — 같은 문서 모양의 Canvas 상자가 아래 `CANVAS` 다.
 */

const CANVAS = {
  container: { w: 400, h: 264 },
  card: { w: 194, h: 126 },
  // 카드 원점 기준
  label: { x: 17, y: 13, w: 160, h: 24 },
  description: { x: 17, y: 39, w: 160, h: 24 },
  image: { x: 17, y: 65, w: 48, h: 48 },
  secondRowY: 138,
} as const;

const ITEMS = [
  { id: "r1", label: "Row One", description: "first row" },
  { id: "r2", label: "Row Two", description: "second row" },
  { id: "r3", label: "Row Three", description: "third row" },
];

const roots: Root[] = [];
let host: HTMLElement | undefined;
let gridList: HTMLElement | null = null;

function makeDoc(): CompositionDocument {
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
                id: "g2-gl",
                type: "GridList",
                dataBinding: {
                  type: "collection",
                  source: "static",
                  config: { data: ITEMS },
                },
                props: { style: { width: "400px" } },
              },
            ] as unknown as CanonicalNode[],
          },
        ],
      },
    ],
  } as CompositionDocument);
  const origin = findNode(doc.children, "component-gridlist-item-default");
  if (!origin) throw new Error("GridListItem origin 없음");
  origin.children = [
    ...(origin.children ?? []),
    {
      id: "g2-image",
      type: "Image",
      props: {
        alt: "{label}",
        style: { width: "48px", height: "48px", backgroundColor: "#e11d48" },
      },
    } as unknown as CanonicalNode,
  ];
  return doc;
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
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

const rel = (el: Element, base: Element) => {
  const r = el.getBoundingClientRect();
  const b = base.getBoundingClientRect();
  return { x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height };
};

beforeAll(async () => {
  await Promise.all(
    ["400", "600"].map((w) => document.fonts.load(`${w} 16px Pretendard`)),
  );
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr162-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const resolved = resolveCanonicalDocument(makeDoc()) as ResolvedNode[];
  const resolver = createGridListTemplateResolver(
    indexTemplateOriginRecords(resolved),
  );
  const ctx = {
    ...stubRenderContext([], "page", true),
    resolveGridListTemplate: resolver.forOwner,
    resolveGridListRowTemplateChildren: resolver.rowTemplateChildrenForOwner,
  };
  await mountPreviewNode(
    host,
    roots,
    React.createElement(CanonicalNodeRenderer, {
      node: findResolved(resolved, "g2-gl")!,
      renderContext: ctx,
      cutoverPrimitives: getCatalogCutoverTypes(),
    }),
  );
  gridList = host.querySelector<HTMLElement>(".react-aria-GridList");
  // dataBinding 행은 effect 뒤에 채워진다 — 카드가 설 때까지 (최대 2 초).
  for (let i = 0; i < 40; i++) {
    if (gridList?.querySelector(".react-aria-GridListItem")) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr162-bundle")?.remove();
});

describe("ADR-162 G2 (b) — 펼친 데이터 카드 Skia 상자 = DOM 상자 (±1)", () => {
  it("컨테이너 · 카드 · 둘째 시각 행 위치", () => {
    expect(gridList).not.toBeNull();
    const cards = [
      ...gridList!.querySelectorAll<HTMLElement>(".react-aria-GridListItem"),
    ];
    expect(cards, gridList!.outerHTML.slice(0, 600)).toHaveLength(3);
    const box = gridList!.getBoundingClientRect();
    const card0 = rel(cards[0]!, gridList!);
    const card2 = rel(cards[2]!, gridList!);
    const got = {
      container: { w: box.width, h: box.height },
      card: { w: card0.w, h: card0.h },
      secondRowY: card2.y,
    };
    const off = [
      Math.abs(got.container.w - CANVAS.container.w),
      Math.abs(got.container.h - CANVAS.container.h),
      Math.abs(got.card.w - CANVAS.card.w),
      Math.abs(got.card.h - CANVAS.card.h),
      Math.abs(got.secondRowY - CANVAS.secondRowY),
    ];
    expect(Math.max(...off), JSON.stringify(got)).toBeLessThanOrEqual(1);
  });

  it("카드 안 label · 설명 · Image 상자와 글자", () => {
    const card = gridList!.querySelector<HTMLElement>(
      ".react-aria-GridListItem",
    )!;
    const texts = [...card.querySelectorAll<HTMLElement>(".react-aria-Text")];
    const label = texts.find((t) => t.getAttribute("slot") !== "description")!;
    const description = card.querySelector<HTMLElement>(
      '[slot="description"]',
    )!;
    // src 없는 Image 는 DOM 에서 `role="img"` 자리표시 상자 (alt = aria-label).
    const image = card.querySelector<HTMLElement>('[role="img"]')!;
    expect(image, card.innerHTML.slice(0, 900)).not.toBeNull();
    expect(label.textContent).toBe("Row One");
    expect(description.textContent).toBe("first row");
    expect(image.getAttribute("aria-label")).toBe("Row One");
    const got = {
      label: rel(label, card),
      description: rel(description, card),
      image: rel(image, card),
    };
    const off: string[] = [];
    for (const key of ["label", "description", "image"] as const) {
      for (const axis of ["x", "y", "w", "h"] as const) {
        if (Math.abs(got[key][axis] - CANVAS[key][axis]) > 1) {
          off.push(
            `${key}.${axis} dom ${got[key][axis]} canvas ${CANVAS[key][axis]}`,
          );
        }
      }
    }
    expect(off, JSON.stringify(got)).toEqual([]);
  });
});
