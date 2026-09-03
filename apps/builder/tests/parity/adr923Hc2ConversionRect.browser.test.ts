import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import type { Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import {
  layoutTree,
  paletteCreationTree,
  type ProductionTree,
} from "./adr923ProductionTrees";
import { mountPreviewNode, mountProductionRoot } from "./adr923PreviewLeg";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 5 후속 — **HC2 전환필요 5 의 rect 대조** (Skeleton · Avatar · StatusLight · TailSwatch · Slot).
 *
 * HC2 판정표 (`adr923Hc2DisplayJudgment`) 가 `전환필요(후속)` 로 둔 5 rule 은 palette 항목이면서 outer display 가
 * Canvas 와 DOM 에서 갈리는 케이스다. 수리는 catalog `structure.containerStyles.display` (잔존 spec Slot 은
 * `Slot.spec.ts` containerStyles) 를 DOM 실효값에 맞추는 것 — Skia 는 `resolveDefaultDisplay` 로 그 값을 읽고
 * DOM 은 preview `rendererMap` (LayoutRenderers / FormRenderers) 이 그린다. 두 leg 를 **같은 production props**
 * (팔레트 생성 트리 root) 로, **같은 부모** (block 400 — 팔레트가 body 에 놓는 형태, `createDefaultBodyProps`
 * display block) 아래에서 돌린다:
 *   - Canvas leg: `paletteCreationTree` root 를 block 400 래퍼의 자식으로 `layoutTree` — wasm 경계 display + rect.
 *   - DOM leg: `rendererMap[type]` 을 400px block mount 에 그림 (`adr923PreviewLeg`) — computed display + rect.
 * 단언 (CONVERTED 에 든 type 만 — 전환 commit 마다 한 항목씩 들어온다):
 *   - outer display 동치 (block-level ↔ inline-level 이 display 가 정하는 축)
 *   - block-level 이면 양쪽 폭 동치 (|Δw| ≤ 1 — 명시 폭이 없으면 부모 폭, Avatar 처럼 명시 폭이면 그 폭) ·
 *     inline-level 이면 양쪽 shrink-to-fit (< 부모 폭). inline 의
 *     Δw 는 텍스트 run 측정 차 (폰트 체인) 라 기록만 한다. 높이는 inner 렌더 차이 (Skia 합성 vs DOM 자식) 라 기록만.
 * 캡처 (5 전부) 는 `.artifacts/adr923-hc2-conversion-rect.json` — 전환 전·후 rect 는 evidence 표로 옮긴다.
 *
 * 참고 캡처 `sharedStatusLight`: shared `StatusLight.tsx` (`display:flex`, :87) 는 production 어느 표면도 쓰지 않는다
 * (preview = `renderStatusLight` inline-flex · publish = `createHtmlElement("div")`). HC2 종전 행이 이 컴포넌트를
 * live 로 재서 "flex" 로 둔 사실의 기록.
 */
const CONVERSION = [
  "Skeleton",
  "Avatar",
  "StatusLight",
  "TailSwatch",
  "Slot",
] as const;
type ConversionType = (typeof CONVERSION)[number];

/** 전환 commit 이 끝난 type — 단언 대상. 캡처는 CONVERSION 전부. */
const CONVERTED: readonly ConversionType[] = [
  "Skeleton",
  "Avatar",
  "StatusLight",
];

const HOST_W = 400;

interface Leg {
  display: string;
  w: number;
  h: number;
}
interface Pair {
  type: ConversionType;
  form: string;
  canvas: Leg;
  dom: Leg;
  domTag: string;
}

function outerOf(display: string): string {
  const d = display.trim().toLowerCase();
  if (d === "none" || d === "contents") return d;
  if (d.startsWith("inline")) return "inline";
  return "block";
}

const pairs = new Map<ConversionType, Pair>();
let sharedStatusLight = "(미캡처)";
let host: HTMLElement | undefined;
const roots: Root[] = [];

function legOf(el: HTMLElement | null): Leg {
  if (!el) return { display: "(없음)", w: -1, h: -1 };
  const r = el.getBoundingClientRect();
  return { display: getComputedStyle(el).display, w: r.width, h: r.height };
}

/** production root 를 block 400 래퍼 (팔레트가 body 에 놓는 형태) 아래에서 layout — 래퍼는 DOM mount 와 같은 상자. */
function canvasLeg(tree: ProductionTree): Leg {
  const wrapId = `hc2conv-host-${tree.type}`;
  const wrap = {
    id: wrapId,
    type: "div",
    props: { style: { display: "block", width: HOST_W } },
    parent_id: null,
  } as unknown as Element;
  const elements = [
    wrap,
    ...tree.elements.map((el) =>
      el.id === tree.root.id ? ({ ...el, parent_id: wrapId } as Element) : el,
    ),
  ];
  const run = layoutTree(wrapId, elements, HOST_W, -1, "hc2conv");
  const batch = run.batch.get(tree.root.id);
  const box = run.layout.get(tree.root.id);
  return {
    display: batch ? String(batch.style.display ?? "(없음)") : "(batch 없음)",
    w: box?.width ?? -1,
    h: box?.height ?? -1,
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });

  const style = document.createElement("style");
  style.id = "adr923-hc2-conversion-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  host = document.createElement("div");
  host.style.cssText = `position:absolute;top:0;left:0;width:${HOST_W}px;`;
  document.body.appendChild(host);

  let i = 0;
  for (const type of CONVERSION) {
    const tree = await paletteCreationTree(type, `hc2conv-${i++}`);
    const el = await mountProductionRoot(
      host,
      roots,
      tree.elements,
      type === "Slot" ? "layout" : "page",
    );
    pairs.set(type, {
      type,
      form: tree.arm,
      canvas: canvasLeg(tree),
      dom: legOf(el),
      domTag: el ? el.tagName.toLowerCase() : "(없음)",
    });
  }

  const sl = await mountPreviewNode(
    host,
    roots,
    React.createElement(StatusLight, { children: "On" }),
  );
  sharedStatusLight = sl ? getComputedStyle(sl).display : "(없음)";
});

afterAll(async () => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-hc2-conversion-bundle")?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr923-hc2-conversion-rect.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        converted: CONVERTED,
        sharedStatusLight,
        pairs: [...pairs.values()],
      },
      null,
      2,
    ),
  );
});

describe("ADR-923 Phase 5 후속 — HC2 전환필요 5 rect 대조 (Canvas production 트리 ↔ preview rendererMap, block 400 부모)", () => {
  it("캡처 — 5 type 전부 양쪽 leg 가 잡힌다", () => {
    for (const p of pairs.values()) {
      console.log(
        `ADR923HC2CONV ${p.type} form=${p.form} canvas=${p.canvas.display} ${p.canvas.w}x${p.canvas.h} dom=${p.domTag}:${p.dom.display} ${p.dom.w}x${p.dom.h}`,
      );
    }
    console.log(`ADR923HC2CONV sharedStatusLight=${sharedStatusLight}`);
    expect(pairs.size).toBe(CONVERSION.length);
    for (const p of pairs.values()) {
      expect(p.canvas.display, `${p.type} canvas`).not.toMatch(/^\(/);
      expect(p.dom.display, `${p.type} dom`).not.toMatch(/^\(/);
    }
  });

  for (const type of CONVERTED) {
    it(`${type} — outer display 동치 · block-level 은 부모 폭, inline-level 은 shrink-to-fit`, () => {
      const p = pairs.get(type)!;
      const outer = outerOf(p.dom.display);
      expect(outerOf(p.canvas.display), `${type} outer`).toBe(outer);
      if (outer === "block") {
        // block-level: 명시 폭이 없으면 양쪽 다 부모 폭, 명시 폭 (Avatar 32) 이면 양쪽 다 그 폭 — 폭 동치.
        expect(
          Math.abs(p.canvas.w - p.dom.w),
          `${type} Δw (block-level)`,
        ).toBeLessThanOrEqual(1);
      } else {
        expect(p.canvas.w, `${type} canvas shrink-to-fit`).toBeLessThan(HOST_W);
        expect(p.dom.w, `${type} dom shrink-to-fit`).toBeLessThan(HOST_W);
      }
    });
  }
});
