/* eslint-disable no-console */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import previewAppSource from "@/preview/App.tsx?raw";
import { Calendar } from "@composition/shared/components/Calendar";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";
import { INLINE_BLOCK_TAG_CLASSIFICATION } from "@/builder/workspace/canvas/layout/engines/utils";
import { resolveDefaultDisplay } from "@/builder/workspace/canvas/layout/engines/defaultDisplay";
import {
  layoutTree,
  paletteCreationTree,
  type ProductionTree,
} from "./adr923ProductionTrees";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 round 29 (r29m2) — **CalendarGrid Q4**: `calendargrid` 의 hand 값 (현재 `inline-block`) 과
 * DOM 정합 후보 (`block`) 를 production 경로로 잰다.
 *
 * 1. **production 트리 (팔레트 Calendar → factory: Calendar > CalendarHeader + CalendarGrid)** 를
 *    `calculateFullTreeLayout` 으로 돌려 wasm 경계 batch 의 부모 Calendar display (catalog top-level
 *    `flex` column) 와 CalendarGrid display (현재 `inline-block`) 를 캡처하고, CalendarGrid 에
 *    `display:block` / `inline-block` 을 명시한 mutation 과 **layout map 전체가 동일**함을 단언 —
 *    flex 부모 아래에서 outer display 는 inert 다 (엔진 blockify). 즉 Phase 5 가 어느 값을 배선해도
 *    production 트리의 결과는 같다.
 * 2. **대조군 (자유 배치 — 팔레트가 만들지 않는 형태, AI/import writer 만 도달)**: block div 아래
 *    CalendarGrid + Button. 현재 값 (inline-block) 은 Button 이 옆에 붙고 `block` 은 아래로 내려간다 →
 *    축이 살아 있는 유일한 형태. DOM 은 이 형태를 Preview `resolveHtmlTag` 로 `<div>` (block) 에 그린다.
 * 3. **DOM leg (ground truth)**: 실 번들 CSS 로 shared `Calendar` 를 렌더 — RAC CalendarGrid 는 `<table>`
 *    (computed `table`, outer block-level) 이고 부모 `.calendar-grids` 는 `flex` — production 트리에서
 *    grid 의 outer display 가 inert 한 것은 DOM 도 같다. 상자 치수는 기록 (§9).
 *
 * 판정: `handDisplay` = 현재 값 `inline-block` (배선 시 동작 무변경), `domDisplay` = `block` (전환 후보,
 * production 트리 diff 0 · 자유 배치 형태는 DOM `<div>` 와 정합) — Phase 5 Q4 분류 목록.
 */

function boxesOf(run: ReturnType<typeof layoutTree>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, l] of run.layout) {
    out[id] = [l.x, l.y, l.width, l.height].map((v) => Math.round(v * 100) / 100);
  }
  return out;
}

function withGridDisplay(
  tree: ProductionTree,
  display: string | undefined,
): Element[] {
  return tree.elements.map((el) => {
    if (el.type !== "CalendarGrid") return el;
    const props = { ...(el.props as Record<string, unknown>) };
    const style = { ...((props.style as Record<string, unknown>) ?? {}) };
    if (display === undefined) delete style.display;
    else style.display = display;
    props.style = style;
    return { ...el, props } as Element;
  });
}

describe("ADR-923 r29m2 — CalendarGrid Q4 (production 경로 측정)", () => {
  let calendar: ProductionTree;
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(async () => {
    await initCompositionEngineWasm();
    useStore.setState({ elements: [], elementsMap: new Map() } as never);
    calendar = await paletteCreationTree("Calendar", "adr923-q4-calendar");
    const style = document.createElement("style");
    style.id = "adr923-q4-bundle";
    style.textContent = bundleCss;
    document.head.appendChild(style);
  });

  afterAll(() => {
    root?.unmount();
    host?.remove();
    document.getElementById("adr923-q4-bundle")?.remove();
  });

  it("production Calendar 트리: 부모 flex · CalendarGrid inline-block 도달, outer display mutation 은 inert", () => {
    const grid = calendar.elements.find((el) => el.type === "CalendarGrid");
    const header = calendar.elements.find((el) => el.type === "CalendarHeader");
    expect(grid, "factory CalendarGrid").toBeTruthy();
    expect(header, "factory CalendarHeader").toBeTruthy();

    const current = layoutTree(calendar.root.id, calendar.elements, 400, -1);
    const parent = current.batch.get(calendar.root.id)!;
    const gridBatch = current.batch.get(grid!.id)!;
    expect(parent.style.display).toBe("flex");
    expect(parent.style.flexDirection).toBe("column");
    expect(gridBatch.style.display).toBe("inline-block");
    expect(INLINE_BLOCK_TAG_CLASSIFICATION.calendargrid.handDisplay).toBe(
      gridBatch.style.display,
    );
    expect(resolveDefaultDisplay("calendargrid")).toBe("inline-block");

    const asBlock = layoutTree(
      calendar.root.id,
      withGridDisplay(calendar, "block"),
      400,
      -1,
    );
    const asInlineBlock = layoutTree(
      calendar.root.id,
      withGridDisplay(calendar, "inline-block"),
      400,
      -1,
    );
    expect(asBlock.batch.get(grid!.id)!.style.display).toBe("block");
    expect(boxesOf(asBlock)).toEqual(boxesOf(current));
    expect(boxesOf(asInlineBlock)).toEqual(boxesOf(current));

    const g = current.layout.get(grid!.id)!;
    const c = current.layout.get(calendar.root.id)!;
    console.log(
      `ADR923Q4 engine Calendar ${c.width}x${c.height} · CalendarGrid ${g.width}x${g.height} @(${g.x},${g.y}) · header ${current.layout.get(header!.id)!.width}x${current.layout.get(header!.id)!.height}`,
    );
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);
  });

  it("대조군 — 자유 배치 (block div > CalendarGrid + Button): 축이 살아 있는 형태에서만 값이 갈린다", () => {
    const make = (display: string | undefined): Element[] => {
      const div = {
        id: "q4-free-root",
        type: "div",
        props: { style: { width: 400 } },
        parent_id: null,
      } as unknown as Element;
      const gridProps: Record<string, unknown> = {
        ...(getDefaultProps("CalendarGrid") as Record<string, unknown>),
      };
      if (display !== undefined) gridProps.style = { display };
      const grid = {
        id: "q4-free-grid",
        type: "CalendarGrid",
        props: gridProps,
        parent_id: div.id,
      } as unknown as Element;
      const button = {
        id: "q4-free-button",
        type: "Button",
        props: { children: "OK" },
        parent_id: div.id,
      } as unknown as Element;
      return [div, grid, button];
    };
    const current = layoutTree("q4-free-root", make(undefined), 400, -1);
    const asBlock = layoutTree("q4-free-root", make("block"), 400, -1);
    const gridNow = current.layout.get("q4-free-grid")!;
    const btnNow = current.layout.get("q4-free-button")!;
    const gridBlock = asBlock.layout.get("q4-free-grid")!;
    const btnBlock = asBlock.layout.get("q4-free-button")!;
    console.log(
      `ADR923Q4 free-form current grid ${gridNow.width}x${gridNow.height} button @(${btnNow.x},${btnNow.y}) · block grid ${gridBlock.width}x${gridBlock.height} button @(${btnBlock.x},${btnBlock.y})`,
    );
    // 현재 값: grid 가 inline-level 이라 Button 이 같은 줄 (y 동일) / block: Button 이 grid 아래
    expect(btnNow.y).toBeLessThan(btnBlock.y);
    expect(btnBlock.y).toBeGreaterThanOrEqual(gridBlock.y + gridBlock.height - 1);
    expect(btnNow.x).toBeGreaterThan(gridNow.x);
    // DOM 은 이 형태를 Preview 가 `<div>` (block) 로 그린다 — 정적 사실 고정
    expect(previewAppSource).toMatch(
      /case "CalendarGrid":\s*\n\s*return "div";/,
    );
  });

  it("DOM leg — RAC CalendarGrid 는 <table> (outer block-level), 부모 .calendar-grids 는 flex", async () => {
    host = document.createElement("div");
    host.style.cssText =
      "position:absolute;top:0;left:0;width:400px;margin:0;padding:0;";
    document.body.appendChild(host);
    root = createRoot(host);
    await new Promise<void>((resolve) => {
      root!.render(
        React.createElement(Calendar, { "aria-label": "ADR-923 Q4" }),
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const cal = host.querySelector(".react-aria-Calendar") as HTMLElement | null;
    const grids = host.querySelector(".calendar-grids") as HTMLElement | null;
    const grid = host.querySelector(".react-aria-CalendarGrid") as HTMLElement | null;
    const header = host.querySelector(".react-aria-Calendar > header") as HTMLElement | null;
    expect(cal, ".react-aria-Calendar").toBeTruthy();
    expect(grids, ".calendar-grids").toBeTruthy();
    expect(grid, ".react-aria-CalendarGrid").toBeTruthy();
    expect(grid!.tagName).toBe("TABLE");
    expect(getComputedStyle(grid!).display).toBe("table");
    expect(getComputedStyle(grids!).display).toBe("flex");
    expect(getComputedStyle(cal!).display).toBe("flex");
    const r = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      const h = host!.getBoundingClientRect();
      return `${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x - h.x)},${Math.round(b.y - h.y)})`;
    };
    console.log(
      `ADR923Q4 dom Calendar ${r(cal!)} · .calendar-grids ${r(grids!)} · CalendarGrid(table) ${r(grid!)} · header ${header ? r(header) : "n/a"}`,
    );
    expect(grid!.getBoundingClientRect().width).toBeGreaterThan(0);
  });
});
