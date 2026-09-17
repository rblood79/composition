import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
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
 * Pagination preview chrome (2026-09-18, ADR-223 후속 1) — `renderPagination` 이 `.react-aria-Pagination`
 * 을 안 붙여 생성 Pagination.css (catalog `containerStyles` flex · space-between · gap · align-items)
 * 전량이 preview 에 dead 였다. Skia 는 같은 containerStyles 를 `resolveCatalogContainerBase` 로 읽어
 * 5 버튼을 폭 전체에 space-between, DOM 은 인라인 row 만 있어 붙어 나열됐다 (live G3 기록).
 *
 * 수리 = `catalogChrome("Pagination", …)` 배선 (Nav 동형). 같이 잰다: catalog `staticSelectors` 의
 * `.react-aria-Button[data-current]` 계열은 self-compose 하는 shared `Pagination.tsx` (publish) 의
 * `.pagination-controls` 구조용이라 canonical 자식 Button (preview) 에는 닿으면 안 된다 — 닿으면 factory
 * 의 accent "1" 버튼이 DOM 만 `--bg-overlay` 로 바뀌어 Skia (accent) 와 갈린다. 실측 (2026-09-18): Button 배경은
 * `@layer utilities` 의 `.button-base { background: var(--button-color) }` 가 소유해 `@layer components` 의 그
 * 선택자는 canonical Button 에 실효 0 — 이 케이스는 그 층 관계가 바뀌면 잡는 가드다.
 */

const roots: Root[] = [];
let host: HTMLElement | undefined;
let nav: HTMLElement | undefined;
let buttons: HTMLElement[] = [];
let accentAlone: HTMLElement | undefined;

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
}

beforeAll(async () => {
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "pagination-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:480px;";
  document.body.appendChild(host);

  const tree = await paletteCreationTree("Pagination", "pg-preview");
  const mounted = await mountProductionRoot(host, roots, tree.elements);
  if (!mounted) throw new Error("Pagination: DOM root 없음");
  await twoFrames();
  nav = host.querySelector<HTMLElement>("nav[data-element-id]") ?? undefined;
  if (!nav) throw new Error("Pagination: nav 없음");
  buttons = [...nav.querySelectorAll<HTMLElement>(".react-aria-Button")];

  // 대조군: Pagination 밖의 accent Button 1개 (같은 번들) — 자식 "1" 의 배경이 이것과 같아야 한다.
  const button = await paletteCreationTree("Button", "pg-button");
  const btnRoot = button.elements[0];
  btnRoot.props = { ...btnRoot.props, variant: "accent", size: "sm" };
  const btnMounted = await mountProductionRoot(host, roots, [btnRoot]);
  await twoFrames();
  accentAlone =
    (btnMounted?.matches(".react-aria-Button")
      ? btnMounted
      : btnMounted?.querySelector<HTMLElement>(".react-aria-Button")) ??
    undefined;
  if (!accentAlone) throw new Error("대조군 accent Button 없음");
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("pagination-bundle")?.remove();
});

describe("Pagination preview chrome — 생성 Pagination.css 가 canonical nav 에 닿는다", () => {
  it("nav 가 react-aria-Pagination + data-size/data-variant 를 단다", () => {
    expect(nav!.classList.contains("react-aria-Pagination")).toBe(true);
    expect(nav!.dataset.size).toBe("md");
    expect(nav!.dataset.variant).toBe("default");
  });

  it("catalog containerStyles (flex · space-between · gap 8 · align center) 가 computed 에 실린다", () => {
    const cs = getComputedStyle(nav!);
    expect(cs.display).toBe("flex");
    expect(cs.justifyContent).toBe("space-between");
    expect(cs.gap).toBe("8px");
    expect(cs.alignItems).toBe("center");
  });

  it("5 버튼이 폭 전체에 space-between — 마지막 버튼 오른쪽 = nav 오른쪽", () => {
    expect(buttons).toHaveLength(5);
    const n = nav!.getBoundingClientRect();
    const last = buttons[4].getBoundingClientRect();
    expect(Math.abs(last.right - n.right)).toBeLessThanOrEqual(1);
    expect(n.width).toBeGreaterThanOrEqual(400);
  });

  it("자식 accent Button '1' 의 배경이 독립 accent Button 과 같다 (publish 용 [data-current] 선택자가 canonical 자식에 안 닿는다)", () => {
    const one = buttons.find((b) => b.textContent?.trim() === "1");
    expect(one).toBeDefined();
    expect(getComputedStyle(one!).backgroundColor).toBe(
      getComputedStyle(accentAlone!).backgroundColor,
    );
    expect(getComputedStyle(one!).color).toBe(
      getComputedStyle(accentAlone!).color,
    );
  });
});
