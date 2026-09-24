import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import React from "react";
import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";
import { CanonicalNodeRenderer } from "@/preview/components/CanonicalNodeRenderer";
import { resolveCanonicalDocument } from "@/resolvers/canonical";
import { ensureReusableCompositeOrigins } from "@/builder/components/reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "@/builder/components/menu/menuTemplateOrigins";
import {
  mountPreviewNode,
  mountProductionRoot,
  stubRenderContext,
} from "./adr923PreviewLeg";

/**
 * ADR-238 Phase 2 · G5 (section 가족, G0 개정 — Preview 구조 판정) — **Preview DOM oracle**: section 이 섞인 정적
 * ListBox · GridList (stack) 를 production 경로 (rendererMap `renderListBox` / `renderGridList` 의 `items` 경로 =
 * 238 전 Preview) 로 그려 section · Header · 항목 상자를 잰다. Canvas leg (live layout map) 가 이관 뒤 같은 상자를
 * 내는지는 `adr238-live-exercise.mjs` 가 이 수치와 대조한다.
 */

const roots: Root[] = [];
let host: HTMLElement | undefined;

type Box = { x: number; y: number; w: number; h: number; text: string };
const measured: Record<string, Box[]> = {};
/** 이관 뒤 (canonical section 노드 → CanonicalNodeRenderer) 경로의 같은 상자. */
const migrated: Record<string, Box[]> = {};

function migratedDoc(): CompositionDocument {
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
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
                { id: "m-lb", type: "ListBox", props: { items: SECTIONS, label: "L" } },
                {
                  id: "m-gl",
                  type: "GridList",
                  props: { items: SECTIONS, layout: "stack", label: "G" },
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
const headerStyles: Record<string, Record<string, string>> = {};

function el(
  id: string,
  type: string,
  props: Record<string, unknown>,
  parent: string | null = null,
): Element {
  return {
    id,
    customId: id,
    type,
    props,
    parent_id: parent,
    page_id: "p",
    order_num: 0,
  } as unknown as Element;
}

const SECTIONS = [
  {
    id: "s1",
    type: "section",
    header: "Fruit",
    items: [
      { id: "apple", label: "Apple" },
      { id: "pear", label: "Pear" },
    ],
  },
  {
    id: "s2",
    type: "section",
    header: "Veg",
    items: [{ id: "kale", label: "Kale" }],
  },
];

function boxes(root: HTMLElement, selector: string): Box[] {
  const base = root.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      x: Math.round((r.x - base.x) * 100) / 100,
      y: Math.round((r.y - base.y) * 100) / 100,
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      text: (n.textContent ?? "").trim(),
    };
  });
}

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
}

beforeAll(async () => {
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr238-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  await mountProductionRoot(host, roots, [
    el("lb", "ListBox", { items: SECTIONS, label: "L" }),
  ]);
  await mountProductionRoot(host, roots, [
    el("gl", "GridList", { items: SECTIONS, layout: "stack", label: "G" }),
  ]);
  await twoFrames();

  const lb = host.querySelector<HTMLElement>(".react-aria-ListBox")!;
  const gl = host.querySelector<HTMLElement>(".react-aria-GridList")!;
  measured.listbox = boxes(lb, ":scope");
  measured.listboxSection = boxes(lb, ".react-aria-ListBoxSection");
  measured.listboxHeader = boxes(lb, ".react-aria-Header");
  measured.listboxItem = boxes(lb, ".react-aria-ListBoxItem");
  measured.gridlist = boxes(gl, ":scope");
  measured.gridlistSection = boxes(gl, ".react-aria-GridListSection");
  measured.gridlistHeader = boxes(gl, ".react-aria-GridListHeader");
  measured.gridlistItem = boxes(gl, ".react-aria-GridListItem");
  for (const [key, node] of [
    ["listboxHeader", lb.querySelector<HTMLElement>(".react-aria-Header")!],
    ["gridlistHeader", gl.querySelector<HTMLElement>(".react-aria-GridListHeader")!],
  ] as const) {
    const cs = getComputedStyle(node);
    headerStyles[key] = {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      color: cs.color,
      background: cs.backgroundColor,
      padding: cs.padding,
      margin: cs.margin,
      display: cs.display,
    };
    console.log(`ADR238-DOM-STYLE ${key} ${JSON.stringify(headerStyles[key])}`);
  }
  const resolved = resolveCanonicalDocument(migratedDoc()) as ResolvedNode[];
  const migratedHost = document.createElement("div");
  migratedHost.style.cssText = "position:absolute;top:600px;left:0;width:400px;";
  document.body.appendChild(migratedHost);
  for (const id of ["m-lb", "m-gl"]) {
    await mountPreviewNode(
      migratedHost,
      roots,
      React.createElement(CanonicalNodeRenderer, {
        node: findResolved(resolved, id)!,
        renderContext: stubRenderContext([], "page", true),
        cutoverPrimitives: getCatalogCutoverTypes(),
      }),
    );
  }
  await twoFrames();
  const mlb = migratedHost.querySelector<HTMLElement>(".react-aria-ListBox")!;
  const mgl = migratedHost.querySelector<HTMLElement>(".react-aria-GridList")!;
  migrated.listboxSection = boxes(mlb, ".react-aria-ListBoxSection");
  migrated.listboxHeader = boxes(mlb, ".react-aria-Header");
  migrated.listboxItem = boxes(mlb, ".react-aria-ListBoxItem");
  migrated.gridlistSection = boxes(mgl, ".react-aria-GridListSection");
  migrated.gridlistHeader = boxes(mgl, ".react-aria-GridListHeader");
  migrated.gridlistItem = boxes(mgl, ".react-aria-GridListItem");
  for (const [key, list] of Object.entries(migrated)) {
    console.log(`ADR238-DOM-MIGRATED ${key} ${JSON.stringify(list)}`);
  }
  for (const [key, list] of Object.entries(measured)) {
    console.log(`ADR238-DOM ${key} ${JSON.stringify(list)}`);
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr238-bundle")?.remove();
});

describe("ADR-238 G5 — section 목록 Preview DOM oracle (238 전 items 경로)", () => {
  it("ListBox: section 2 · Header 글자 · 항목 3 순서", () => {
    expect(measured.listboxSection).toHaveLength(2);
    expect(measured.listboxHeader.map((b) => b.text)).toEqual(["Fruit", "Veg"]);
    expect(measured.listboxItem.map((b) => b.text)).toEqual([
      "Apple",
      "Pear",
      "Kale",
    ]);
  });

  it("GridList: section 2 · Header 글자 · 항목 3 순서", () => {
    expect(measured.gridlistSection).toHaveLength(2);
    expect(measured.gridlistHeader.map((b) => b.text)).toEqual([
      "Fruit",
      "Veg",
    ]);
    expect(measured.gridlistItem.map((b) => b.text)).toEqual([
      "Apple",
      "Pear",
      "Kale",
    ]);
  });
});

describe("ADR-238 G5 — 이관 뒤 Preview DOM = 이관 전 (section 가족)", () => {
  it("ListBox · GridList: section · Header · 항목 상자 (x·y·w·h) 와 글자가 같다", () => {
    for (const key of [
      "listboxSection",
      "listboxHeader",
      "listboxItem",
      "gridlistSection",
      "gridlistHeader",
      "gridlistItem",
    ]) {
      expect(migrated[key], key).toEqual(measured[key]);
    }
  });
});
