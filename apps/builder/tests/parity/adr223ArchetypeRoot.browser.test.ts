import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import beforeCardCss from "./fixtures/adr223-before-Card.css?inline";
import beforeTabCss from "./fixtures/adr223-before-Tab.css?inline";
import beforeToolbarCss from "./fixtures/adr223-before-Toolbar.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { useStore } from "@/builder/stores";
import { paletteCreationTree } from "./adr923ProductionTrees";
import { mountProductionRoot } from "./adr923PreviewLeg";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-223 G2-B (2026-09-18) — **실제 shared 컴포넌트** (팔레트 production 트리 → preview `rendererMap`
 * 실렌더 + production `index.css`) 로 archetype 미지정 base 중립화의 root 상자와 DOM interaction 을 잰다.
 *
 * G2-A 의 합성 고정-box fixture 는 정렬 축만 격리한다 — Card 와 `Tabs > TabList > Tab` 은 실제 자식
 * (CardPreview/CardHeader/… · RAC Tab 텍스트) 과 컨텍스트 (TabList 안의 Tab) 가 있어야 상자가 나온다.
 *
 * arm 두 개를 같은 트리에 순차 적용한다:
 *   - after  = 현재 번들 (Phase 1 생성 CSS — 중립 base + rootSelectors["&"] interaction)
 *   - before = 같은 번들 뒤에 Phase 0 before-arm 생성 CSS (`fixtures/adr223-before-{Card,Tab}.css`,
 *              main `0dc554e6a` 의 파일 그대로) 를 덧붙인 것. 같은 특이도의 뒤 선언이 이기므로 root 규칙은
 *              before 파일이 정한다 (Card 는 뒤따르는 수동 CSS 가 없고, Tab 은 `TabsIndicator.css` 가
 *              `position: relative` 만 재선언 — 순서 뒤집힘의 실효 0).
 *
 * 통과 조건 (ADR-223 G2-B): root box Δ ≤ 1px · Card `cursor:pointer` 유지 + user-select/transition 제거 ·
 * Tab `cursor:pointer` / `user-select:none` / transition 유지. Card 의 rootSelectors 를 지우면 Card cursor
 * 케이스가, Tab 의 rootSelectors 를 지우면 Tab 세 케이스가 RED 다.
 */

type Kind = "Card" | "Tab" | "Toolbar";

interface Probe {
  rect: { w: number; h: number };
  cursor: string;
  userSelect: string;
  transitionProperty: string;
}

const roots: Root[] = [];
let host: HTMLElement | undefined;
let beforeStyle: HTMLStyleElement | undefined;
const probes: Record<"after" | "before", Record<Kind, Probe>> = {
  after: {} as Record<Kind, Probe>,
  before: {} as Record<Kind, Probe>,
};

function probe(el: HTMLElement): Probe {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    rect: { w: r.width, h: r.height },
    cursor: cs.cursor,
    userSelect: cs.userSelect,
    transitionProperty: cs.transitionProperty,
  };
}

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
}

beforeAll(async () => {
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr223-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  const card = await paletteCreationTree("Card", "adr223-card");
  const tabs = await paletteCreationTree("Tabs", "adr223-tabs");
  const toolbar = await paletteCreationTree("Toolbar", "adr223-toolbar");
  const cardMount = await mountProductionRoot(host, roots, card.elements);
  const tabsMount = await mountProductionRoot(host, roots, tabs.elements);
  const toolbarMount = await mountProductionRoot(host, roots, toolbar.elements);
  if (!cardMount || !tabsMount || !toolbarMount)
    throw new Error("DOM root 없음");

  const cardRoot = host.querySelector<HTMLElement>(".react-aria-Card");
  const tabRoot = host.querySelector<HTMLElement>(
    ".react-aria-Tabs .react-aria-TabList .react-aria-Tab",
  );
  const toolbarRoot = host.querySelector<HTMLElement>(".react-aria-Toolbar");
  if (!cardRoot) throw new Error("Card: .react-aria-Card 없음");
  if (!toolbarRoot) throw new Error("Toolbar: .react-aria-Toolbar 없음");
  if (!tabRoot) throw new Error("Tabs: TabList 안 .react-aria-Tab 없음");

  probes.after.Card = probe(cardRoot);
  probes.after.Tab = probe(tabRoot);
  probes.after.Toolbar = probe(toolbarRoot);

  beforeStyle = document.createElement("style");
  beforeStyle.id = "adr223-before-arm";
  beforeStyle.textContent = `${beforeCardCss}\n${beforeTabCss}\n${beforeToolbarCss}`;
  document.head.appendChild(beforeStyle);
  await twoFrames();
  probes.before.Card = probe(cardRoot);
  probes.before.Tab = probe(tabRoot);
  probes.before.Toolbar = probe(toolbarRoot);
  beforeStyle.remove();
  await twoFrames();

  for (const arm of ["after", "before"] as const) {
    for (const t of ["Card", "Tab", "Toolbar"] as const) {
      const p = probes[arm][t];
      console.log(
        `ADR223G2B ${arm} ${t} → ${p.rect.w}×${p.rect.h} cursor:${p.cursor} user-select:${p.userSelect} transition:${p.transitionProperty}`,
      );
    }
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr223-bundle")?.remove();
});

describe("ADR-223 G2-B — 실제 Card · Tabs>TabList>Tab root (production index.css)", () => {
  it("before arm 이 실제로 버튼 어법을 실었다 (대조군 유효성)", () => {
    expect(probes.before.Card.userSelect).toBe("none");
    expect(probes.before.Card.transitionProperty).toMatch(/background/);
    expect(probes.before.Tab.userSelect).toBe("none");
    expect(probes.before.Toolbar.userSelect).toBe("none");
  });

  it("Toolbar (reusable origin 실트리): 버튼 어법 제거 — cursor auto · user-select auto · transition 없음", () => {
    const p = probes.after.Toolbar;
    expect(p.cursor).toBe("auto");
    expect(p.userSelect).not.toBe("none");
    expect(p.transitionProperty).not.toMatch(/background/);
  });

  it.each(["Card", "Tab", "Toolbar"] as const)(
    "%s root box — before ↔ after Δ ≤ 1px",
    (t) => {
      const a = probes.after[t].rect;
      const b = probes.before[t].rect;
      expect(
        Math.abs(a.w - b.w),
        `${t}.w after=${a.w} before=${b.w}`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(a.h - b.h),
        `${t}.h after=${a.h} before=${b.h}`,
      ).toBeLessThanOrEqual(1);
      expect(a.w).toBeGreaterThan(0);
      expect(a.h).toBeGreaterThan(0);
    },
  );

  it("Card: cursor:pointer 는 rootSelectors 로 유지, user-select/transition 은 제거", () => {
    const p = probes.after.Card;
    expect(p.cursor).toBe("pointer");
    expect(p.userSelect).not.toBe("none");
    expect(p.transitionProperty).not.toMatch(/background/);
  });

  it("Tab: cursor:pointer · user-select:none · transition 세 선언이 rootSelectors 로 유지", () => {
    const p = probes.after.Tab;
    expect(p.cursor).toBe("pointer");
    expect(p.userSelect).toBe("none");
    expect(p.transitionProperty).toMatch(/background/);
    expect(p.transitionProperty).toMatch(/border-color/);
    expect(p.transitionProperty).toMatch(/transform/);
  });
});
