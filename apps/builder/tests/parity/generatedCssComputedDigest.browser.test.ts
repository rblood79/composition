import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { useStore } from "@/builder/stores";
import { allPaletteCreationTrees } from "./adr923ProductionTrees";
import { mountProductionRoot } from "./adr923PreviewLeg";
import { commands } from "@vitest/browser/context";

/**
 * 생성 CSS 변경의 computed-style 오라클 — 팔레트 전수를 production `styles/index.css` 로
 * 마운트해 요소별 computed style 전부 (custom property 포함) 를 digest 로 찍는다.
 *
 * 사용: 변경 전 `VITE_CSS_DIGEST_OUT=tests/parity/.artifacts/before.txt` 로 한 번, 변경 후
 * `after.txt` 로 한 번 돌려 diff 한다 (Icon 은 아이콘이 무작위라 제외). 정적 selector 비교는
 * 캐스케이드 교차 규칙 (같은 특이도의 뒤 규칙 · `[data-size]` 특이도 승격) 을 놓친다
 * (메모리 reference-devtools-styles-pane-flicker…). `VITE_CSS_DIGEST_DUMP=<type>` 이면 그 root
 * 의 property 전량도 적는다. env 없이는 아무것도 쓰지 않고 통과만 한다.
 *
 * 2026-09-18: 생성기가 단일 defaultSize 의 `[data-size]` 블록 8 + 빈 state 블록 117 을 생략한
 * 변경을 이걸로 판정 — 538 요소 digest 전후 동일 (3 run 일치).
 */
vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

const roots: Root[] = [];
let host: HTMLElement | undefined;
const lines: string[] = [];

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function digestOf(el: Element): string {
  const cs = getComputedStyle(el);
  const parts: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i];
    parts.push(`${p}:${cs.getPropertyValue(p)}`);
  }
  return hash(parts.join(";"));
}

beforeAll(async () => {
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "digest-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:600px;";
  document.body.appendChild(host);

  await document.fonts.ready;
  await twoFrames();
  const trees = await allPaletteCreationTrees("digest");
  for (const tree of trees) {
    const rootEl = await mountProductionRoot(host, roots, tree.elements).catch(
      (e: unknown) => {
        lines.push(`${tree.type} ERR ${String(e)}`);
        return null;
      },
    );
    if (!rootEl) continue;
    await twoFrames();
    const all = [rootEl, ...Array.from(rootEl.querySelectorAll("*"))];
    all.forEach((el, i) => {
      const cls =
        el.className && typeof el.className === "string"
          ? el.className.split(/\s+/)[0]
          : "";
      lines.push(
        `${tree.type}#${i} ${el.tagName.toLowerCase()}.${cls} ${digestOf(el)}`,
      );
      if (import.meta.env.VITE_CSS_DIGEST_DUMP === tree.type && i === 0) {
        const cs = getComputedStyle(el);
        for (let k = 0; k < cs.length; k++) {
          lines.push(`DUMP ${cs[k]}=${cs.getPropertyValue(cs[k])}`);
        }
      }
    });
  }
  const out = (import.meta.env.VITE_CSS_DIGEST_OUT as string | undefined) ?? "";
  if (out) await commands.writeFile(out, lines.sort().join("\n") + "\n");
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("digest-bundle")?.remove();
});

describe("css digest (임시 오라클)", () => {
  it("digest 를 찍는다", () => {
    expect(lines.length).toBeGreaterThan(0);
  });
});
