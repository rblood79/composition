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
  resolveSlotComposition,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";
import { CanonicalNodeRenderer } from "@/preview/components/CanonicalNodeRenderer";
import { resolveCanonicalDocument } from "@/resolvers/canonical";
import { ensureReusableCompositeOrigins } from "@/builder/components/reusableCompositeOrigins";
import { ensureListBoxTemplateOrigins } from "@/builder/components/listbox/listBoxTemplateOrigins";
import {
  createGridListTemplateResolver,
  indexTemplateOriginRecords,
  resolveTemplateOriginRootStyle,
} from "@/preview/utils/itemTemplates";
import { resolveCollectionRowPositions } from "@/builder/workspace/canvas/scene/collectionVirtualization";
import { mountPreviewNode, stubRenderContext } from "./adr923PreviewLeg";

/**
 * ADR-150 Phase 1 · G1 (b)(c) — **실 브라우저 DOM oracle**: 스크롤 소유자 데이터 목록을 production Preview
 * 경로 (CanonicalNodeRenderer) 로 그려 모든 행 (카드) 의 owner 기준 y · 높이와 `scrollHeight − clientHeight`
 * 를 잰다. 비교 대상은 Canvas 가상화가 spacer · 스크롤 범위를 만드는 행 위치 단일 소스
 * (`resolveCollectionRowPositions` — window map 과 같은 plan) 다. Canvas 실제 layout 이 이 값과 같은지는
 * live (`apps/builder/scripts/adr150-p1-row-positions-live.mjs`) 가 잰다 — 두 단계로 Canvas = DOM.
 *
 * 반례 입력 (round 3 h2): 단일 줄인데 description 유무가 교대해 행 높이가 둘로 갈린다. DOM ListBox ·
 * GridList 는 가상화하지 않으면 100 행에서 자르므로 (`useResolvedCollectionItems` windowLimit) 100 행 이하로 둔다.
 * 측정 조건: headless Chromium (vitest browser) · Pretendard 로드 뒤 · owner scrollTop 0.
 */

const LISTBOX_ROWS = Array.from({ length: 100 }, (_, i) => ({
  id: `r${i}`,
  label: `Row ${i}`,
  ...(i % 2 ? { description: "Short description" } : {}),
}));

// 2 열: 시각 행 r 이 홀수면 그 행 첫 카드만 description (한 장만 있어도 행이 늘어난다 — grid stretch).
const GRID_CARDS = Array.from({ length: 100 }, (_, i) => ({
  id: `g${i}`,
  label: `Card ${i}`,
  ...(Math.floor(i / 2) % 2 === 1 && i % 2 === 0
    ? { description: `detail ${i}` }
    : {}),
}));

function makeDoc(): CompositionDocument {
  // production hydration 과 같은 항목 origin (ListBox · GridList) — 없으면 DOM 이 legacy 평문 행을 그린다.
  return ensureListBoxTemplateOrigins(
    ensureReusableCompositeOrigins({
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
                  id: "p1-lb",
                  type: "ListBox",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: { data: LISTBOX_ROWS },
                  },
                  props: {
                    style: {
                      width: "400px",
                      height: "400px",
                      overflowY: "auto",
                    },
                  },
                  // ADR-146 data-bound 템플릿 모양 — 항목 origin 을 가리키는 template anchor.
                  children: [
                    {
                      id: "p1-lb-anchor",
                      type: "ref",
                      ref: "component-listbox-item-default",
                      props: {},
                      metadata: {
                        type: "legacy-element-props",
                        templateRole: "listbox-item-template-anchor",
                      },
                    },
                  ],
                },
                {
                  id: "p1-gl",
                  type: "GridList",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: { data: GRID_CARDS },
                  },
                  props: {
                    layout: "grid",
                    columns: 2,
                    style: {
                      width: "400px",
                      height: "300px",
                      overflowY: "auto",
                    },
                  },
                },
                {
                  // gap 축 반례 — DOM 은 style.gap 을 읽는다 (Canvas 행 묶음도 같은 축, ADR-150 A2').
                  id: "p1-gl-gap",
                  type: "GridList",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: { data: GRID_CARDS.slice(0, 40) },
                  },
                  props: {
                    layout: "grid",
                    columns: 2,
                    style: {
                      width: "400px",
                      height: "300px",
                      overflowY: "auto",
                      gap: "20px",
                    },
                  },
                },
              ] as unknown as CanonicalNode[],
            },
          ],
        },
      ],
    } as CompositionDocument),
  );
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

const roots: Root[] = [];
const hosts: HTMLElement[] = [];
let doc: CompositionDocument;
const owners: Record<string, HTMLElement | null> = {};

async function mountOwner(
  resolved: ResolvedNode[],
  id: string,
  top: number,
  itemSelector: string,
): Promise<HTMLElement | null> {
  const host = document.createElement("div");
  host.style.cssText = `position:absolute;top:${top}px;left:0;width:400px;`;
  document.body.appendChild(host);
  hosts.push(host);
  const byId = indexTemplateOriginRecords(resolved);
  const resolver = createGridListTemplateResolver(byId);
  // production Preview (App.tsx templateSlotCompositions) 와 같은 ListBox 항목 origin 입력.
  const listBoxOrigin = byId.get("component-listbox-item-default");
  const ctx = {
    ...stubRenderContext([], "page", true),
    listBoxTemplateSlotComposition: listBoxOrigin
      ? resolveSlotComposition(listBoxOrigin.children)
      : null,
    listBoxRowTemplateStyles: {
      base: resolveTemplateOriginRootStyle(listBoxOrigin),
      selected: resolveTemplateOriginRootStyle(
        byId.get("component-listbox-item-selected"),
      ),
    },
    resolveGridListTemplate: resolver.forOwner,
    resolveGridListRowTemplateChildren: resolver.rowTemplateChildrenForOwner,
  };
  await mountPreviewNode(
    host,
    roots,
    React.createElement(CanonicalNodeRenderer, {
      node: findResolved(resolved, id)!,
      renderContext: ctx,
      cutoverPrimitives: getCatalogCutoverTypes(),
    }),
  );
  // dataBinding 행은 effect 뒤에 채워진다.
  for (let i = 0; i < 40; i++) {
    if (host.querySelector(itemSelector)) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  return host.querySelector<HTMLElement>(
    itemSelector === ".react-aria-ListBoxItem"
      ? ".react-aria-ListBox"
      : ".react-aria-GridList",
  );
}

beforeAll(async () => {
  await Promise.all(
    ["400", "600"].map((w) => document.fonts.load(`${w} 16px Pretendard`)),
  );
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr150-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  doc = makeDoc();
  const resolved = resolveCanonicalDocument(doc) as ResolvedNode[];
  owners.listbox = await mountOwner(
    resolved,
    "p1-lb",
    0,
    ".react-aria-ListBoxItem",
  );
  owners.gridlist = await mountOwner(
    resolved,
    "p1-gl",
    500,
    ".react-aria-GridListItem",
  );
  owners.gridlistGap = await mountOwner(
    resolved,
    "p1-gl-gap",
    900,
    ".react-aria-GridListItem",
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  for (const h of hosts) h.remove();
  document.getElementById("adr150-bundle")?.remove();
});

function domRows(owner: HTMLElement, itemSelector: string) {
  const base = owner.getBoundingClientRect();
  return [...owner.querySelectorAll<HTMLElement>(itemSelector)].map((el) => {
    const r = el.getBoundingClientRect();
    return { y: r.top - base.top + owner.scrollTop, h: r.height };
  });
}

describe("ADR-150 G1 (b)(c) — 행 위치 단일 소스 = 실 브라우저 DOM (±1)", () => {
  it("ListBox 100 행 (description 교대 32 · 50): 모든 행 y · 높이 · 스크롤 범위", () => {
    const owner = owners.listbox;
    expect(owner).not.toBeNull();
    const rows = domRows(owner!, ".react-aria-ListBoxItem");
    expect(rows).toHaveLength(100);
    const positions = resolveCollectionRowPositions({
      doc,
      collections: [],
      scrollTops: new Map(),
      ownerId: "p1-lb",
    })!;
    expect(new Set(positions.heights).size).toBe(2);
    const worst = rows.reduce(
      (acc, row, j) => {
        const dy = Math.abs(
          row.y - (positions.leadingExtent + positions.tops[j]),
        );
        const dh = Math.abs(row.h - positions.heights[j]);
        return { dy: Math.max(acc.dy, dy), dh: Math.max(acc.dh, dh) };
      },
      { dy: 0, dh: 0 },
    );
    console.log(
      "[ADR-150 G1 listbox]",
      JSON.stringify({
        worst,
        domMaxScroll: owner!.scrollHeight - owner!.clientHeight,
        maxScrollTop: positions.maxScrollTop,
        last: rows[99],
        predictedLast: positions.leadingExtent + positions.tops[99],
      }),
    );
    expect(worst.dy).toBeLessThanOrEqual(1);
    expect(worst.dh).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        owner!.scrollHeight - owner!.clientHeight - positions.maxScrollTop,
      ),
    ).toBeLessThanOrEqual(1);
  });

  it.each([
    ["gridlist", "p1-gl", 100, "시각 행 50 · 76 교대, gap 기본 12"],
    ["gridlistGap", "p1-gl-gap", 40, "style.gap 20px"],
  ] as const)(
    "GridList 2 열 (%s · %s · %i 카드 — %s): 모든 카드 y · 행 높이 · 스크롤 범위",
    (key, ownerId, count, _note) => {
      const owner = owners[key];
      expect(owner).not.toBeNull();
      const cards = domRows(owner!, ".react-aria-GridListItem");
      expect(cards).toHaveLength(count);
      const positions = resolveCollectionRowPositions({
        doc,
        collections: [],
        scrollTops: new Map(),
        ownerId,
      })!;
      expect(positions.columns).toBe(2);
      expect(positions.heights).toHaveLength(count / 2);
      const worst = cards.reduce(
        (acc, card, j) => {
          const r = Math.floor(j / 2);
          const dy = Math.abs(
            card.y - (positions.leadingExtent + positions.tops[r]),
          );
          const dh = Math.abs(card.h - positions.heights[r]);
          return { dy: Math.max(acc.dy, dy), dh: Math.max(acc.dh, dh) };
        },
        { dy: 0, dh: 0 },
      );
      console.log(
        `[ADR-150 G1 ${key}]`,
        JSON.stringify({
          worst,
          domMaxScroll: owner!.scrollHeight - owner!.clientHeight,
          maxScrollTop: positions.maxScrollTop,
          heights: positions.heights.slice(0, 4),
          domFirst: cards.slice(0, 4),
        }),
      );
      expect(worst.dy).toBeLessThanOrEqual(1);
      expect(worst.dh).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          owner!.scrollHeight - owner!.clientHeight - positions.maxScrollTop,
        ),
      ).toBeLessThanOrEqual(1);
    },
  );
});
