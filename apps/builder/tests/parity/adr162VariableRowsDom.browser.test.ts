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
 * ADR-162 Phase 4 · G3 — **Preview DOM oracle** (실 브라우저 overflow scroll). 항목 origin 에 Image (48×48) 를
 * 넣은 2 열 데이터 GridList (100 카드 = 시각 행 50, 짧은 label 행 · 3 줄 label 행 교대, 높이 400 · overflow
 * auto) 를 production Preview 경로로 그려 카드 상자 · 시각 행 y · scrollHeight 를 잰다. DOM 은 가상화하지 않을
 * 때 100 항목에서 자르므로 (ADR-150 §3-3) 반례 규모는 100 카드다.
 *
 * 결과 상수 `DOM` 은 Canvas live (`apps/builder/scripts/adr162-p4-variable-rows-live.mjs`) 가 대조하는 값이다 —
 * 여기서는 DOM 자신이 그 상수와 같은지 (±1) 를 고정한다.
 */

export const G3_ITEMS = Array.from({ length: 100 }, (_, i) => ({
  id: `v${i}`,
  label:
    Math.floor(i / 2) % 2 === 1
      ? `Card ${i} long title that wraps across three lines`
      : `Card ${i}`,
  description: `detail ${i}`,
}));

const DOM = {
  shortCard: 126,
  longCard: 174,
  gap: 12,
  viewport: 400,
  scrollHeight: 8088,
} as const;

const roots: Root[] = [];
const hosts: HTMLElement[] = [];
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
                id: "g3-gl",
                type: "GridList",
                dataBinding: {
                  type: "collection",
                  source: "static",
                  config: { data: G3_ITEMS },
                },
                props: {
                  columns: 2,
                  style: { width: "400px", height: "400px", overflow: "auto" },
                },
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
      id: "g3-image",
      type: "Image",
      // alt 없음 — src 없는 Image 는 DOM 이 alt 글자를 상자 밖으로 넘겨 그려 scroll 범위를 늘린다 (Canvas
      //   는 아이콘 — 알려진 범위 밖 차이, ADR-162 Phase 3 곁가지). 행 높이 대조를 그 차이와 섞지 않는다.
      props: {
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

beforeAll(async () => {
  await Promise.all(
    ["400", "600"].map((w) => document.fonts.load(`${w} 16px Pretendard`)),
  );
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr162-g3-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);
  hosts.push(host);
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
      node: findResolved(resolved, "g3-gl")!,
      renderContext: ctx,
      cutoverPrimitives: getCatalogCutoverTypes(),
    }),
  );
  gridList = host.querySelector<HTMLElement>(".react-aria-GridList");
  for (let i = 0; i < 60; i++) {
    if ((gridList?.querySelectorAll(".react-aria-GridListItem").length ?? 0) >= 100) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
});

afterAll(() => {
  for (const r of roots) r.unmount();
  for (const h of hosts) h.remove();
  document.getElementById("adr162-g3-bundle")?.remove();
});

describe("ADR-162 Phase 4 · G3 — DOM oracle (가변 높이 카드 · 실 브라우저 overflow scroll)", () => {
  it("카드 높이 두 종류 · 시각 행 y = 누적합 · scrollHeight", () => {
    const cards = [
      ...gridList!.querySelectorAll<HTMLElement>(".react-aria-GridListItem"),
    ];
    const box = gridList!.getBoundingClientRect();
    const got = cards.map((c) => {
      const r = c.getBoundingClientRect();
      return { y: r.y - box.y + gridList!.scrollTop, h: r.height };
    });
    const summary = {
      count: cards.length,
      shortCard: got[0]?.h,
      longCard: got[2]?.h,
      scrollHeight: gridList!.scrollHeight,
      clientHeight: gridList!.clientHeight,
      padTop: getComputedStyle(gridList!).paddingTop,
      rowGap: getComputedStyle(gridList!).rowGap,
      firstY: got[0]?.y,
      lastBottom: got[99] ? got[99].y + got[99].h : null,
    };
    console.log("[G3 DOM]", JSON.stringify(summary));
    expect(cards).toHaveLength(100);
    // 시각 행 j 의 y = firstY + Σ_{i<j} (행 높이 + gap), 행 높이 = 짧은 / 긴 교대.
    const off: string[] = [];
    let y = got[0]!.y;
    for (let j = 0; j < 50; j += 1) {
      const rowH = j % 2 === 1 ? DOM.longCard : DOM.shortCard;
      for (const k of [2 * j, 2 * j + 1]) {
        if (Math.abs(got[k]!.y - y) > 1) off.push(`card ${k} y ${got[k]!.y} vs ${y}`);
        if (Math.abs(got[k]!.h - rowH) > 1) off.push(`card ${k} h ${got[k]!.h} vs ${rowH}`);
      }
      y += rowH + DOM.gap;
    }
    expect(off.slice(0, 8), JSON.stringify(summary)).toEqual([]);
    expect(Math.abs(gridList!.scrollHeight - DOM.scrollHeight)).toBeLessThanOrEqual(1);
  });
});
