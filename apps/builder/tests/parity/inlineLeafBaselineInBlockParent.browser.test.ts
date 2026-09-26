import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
// production 과 같은 글꼴 (main.tsx) — 대체 글꼴은 굵기마다 ascent 가 달라 baseline 이 굵기에 따라 흔들린다.
import "pretendard/dist/web/static/pretendard.css";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { Label } from "@composition/shared/components/Field";
import { Button } from "@composition/shared/components/Button";
import { ToggleButton } from "@composition/shared/components/ToggleButton";
import { Badge } from "@composition/shared/components/Badge";
import { Link } from "@composition/shared/components/Link";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import { layoutTree, paletteCreationTree } from "./adr923ProductionTrees";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * 2026-09-26 (LOW 조사 2-a, 사용자 지시 "1번부터 2번까지 진행해") — block 부모 한 줄의 inline leaf baseline.
 *
 * 글자를 그리는 inline-flex leaf (Button · ToggleButton · Badge · Link) 는 텍스트 leaf 목록 밖이라
 * `leafBaseline` 을 받지 못했고, 엔진 인라인 흐름은 baseline 원천이 없는 atomic inline 을 아래 margin
 * 가장자리로 폴백한다 (CSS 와 같은 규칙 — 결함은 입력 공급 쪽). 그래서 같은 줄의 Label 이 (높이 −
 * 글자 baseline) 만큼 내려가고 줄이 부풀었다 (Label + Button md: Canvas 부모 37.4 · Label y 17.4 /
 * DOM 30 · 4.2). production: Frame display block 에 팔레트 Label + Button 을 넣으면 된다.
 *
 * 같은 배치를 두 렌더러로 재서 부모 높이 · Label y 를 비교한다. 폭 400.
 */
const LEAVES = ["Button", "ToggleButton", "Badge", "Link"] as const;
type LeafType = (typeof LEAVES)[number];

const DOM_LEAF: Record<
  LeafType,
  React.ComponentType<Record<string, unknown>>
> = {
  Button: Button as unknown as React.ComponentType<Record<string, unknown>>,
  ToggleButton: ToggleButton as unknown as React.ComponentType<
    Record<string, unknown>
  >,
  Badge: Badge as unknown as React.ComponentType<Record<string, unknown>>,
  Link: Link as unknown as React.ComponentType<Record<string, unknown>>,
};

interface Leg {
  parentH: number;
  labelY: number;
  leafY: number;
}
interface Measured {
  type: LeafType;
  text: string;
  dom: Leg;
  canvas: Leg;
}

/**
 * 부모 strut 잔차 (별도 원인, 이번 수리 밖 — 2026-09-26 기록): DOM 은 부모의 상속 line-height (root 1.5 →
 * 16px 기준 24) 로 strut 을 두지만 엔진 strut 은 컨테이너 자기 lineHeight 만 본다 (`packages/engine/src/
 * tree.rs` `strut_line_height`). 글자 leaf 가 strut 보다 낮은 Badge (22) · Link (20) 만 줄 전체가 그만큼
 * 갈린다 (부모 높이 · 두 상자 y 가 같이 밀림). 두 상자의 상대 정렬 (baseline) 은 이 잔차와 무관하게 같다.
 */
const KNOWN_STRUT_GAP: Partial<Record<LeafType, number>> = {
  Badge: 2,
  Link: 4,
};

const measured: Measured[] = [];
let host: HTMLElement | undefined;
const roots: Root[] = [];

function leafText(root: Element): string {
  const props = root.props as Record<string, unknown>;
  for (const key of ["children", "text", "label"]) {
    if (typeof props[key] === "string" && props[key]) return props[key];
  }
  return "";
}

async function runCanvas(type: LeafType): Promise<{ leg: Leg; text: string }> {
  const tree = await paletteCreationTree(type, `inline-baseline-${type}`);
  const frameId = `inline-baseline-frame-${type}`;
  const labelId = `inline-baseline-label-${type}`;
  const frame = {
    id: frameId,
    type: "frame",
    props: { style: { display: "block", width: "400px" } },
    parent_id: null,
  } as unknown as Element;
  const label = {
    id: labelId,
    type: "Label",
    props: { children: "Name" },
    parent_id: frameId,
  } as unknown as Element;
  const els = [
    frame,
    label,
    ...tree.elements.map((el) =>
      el.id === tree.root.id ? ({ ...el, parent_id: frameId } as Element) : el,
    ),
  ];
  const run = layoutTree(frameId, els, 400, -1, "inline-baseline");
  const f = run.layout.get(frameId);
  const l = run.layout.get(labelId);
  const b = run.layout.get(tree.root.id);
  if (!f || !l || !b) throw new Error(`${type}: Canvas 상자 없음`);
  return {
    leg: { parentH: f.height, labelY: l.y, leafY: b.y },
    text: leafText(tree.root),
  };
}

async function renderDom(type: LeafType, text: string): Promise<Leg> {
  const mount = document.createElement("div");
  mount.style.cssText = "display:block;width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  const Leaf = DOM_LEAF[type];
  await new Promise<void>((resolve) => {
    rt.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Label, null, "Name"),
        React.createElement(Leaf, null, text),
      ),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const base = mount.getBoundingClientRect();
  const [labelEl, leafEl] = [...mount.children] as HTMLElement[];
  if (!labelEl || !leafEl) throw new Error(`${type}: DOM 자식 없음`);
  return {
    parentH: base.height,
    labelY: labelEl.getBoundingClientRect().top - base.top,
    leafY: leafEl.getBoundingClientRect().top - base.top,
  };
}

beforeAll(async () => {
  await initEngineWasm();
  await Promise.all(
    ["400", "600"].map((w) => document.fonts.load(`${w} 14px Pretendard`)),
  );
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "inline-baseline-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:400px;";
  document.body.appendChild(host);
  for (const type of LEAVES) {
    const { leg: canvas, text } = await runCanvas(type);
    const dom = await renderDom(type, text);
    measured.push({ type, text, dom, canvas });
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("inline-baseline-bundle")?.remove();
});

describe("block 부모 한 줄의 Label + 글자 inline leaf — baseline 정렬 (두 렌더러)", () => {
  it("Label 과 leaf 의 상대 정렬 (labelY − leafY) 이 DOM 과 같다 (±1)", () => {
    const off = measured
      .filter(
        (m) =>
          Math.abs(
            m.canvas.labelY - m.canvas.leafY - (m.dom.labelY - m.dom.leafY),
          ) > 1,
      )
      .map(
        (m) =>
          `${m.type} "${m.text}" canvas ${JSON.stringify(m.canvas)} dom ${JSON.stringify(m.dom)}`,
      );
    expect(off).toEqual([]);
  });

  it("부모 높이 · Label y 가 DOM 과 같다 (±1, 부모 strut 잔차는 KNOWN_STRUT_GAP)", () => {
    const off = measured
      .filter((m) => {
        const tol = KNOWN_STRUT_GAP[m.type] ?? 1;
        return (
          Math.abs(m.canvas.parentH - m.dom.parentH) > tol ||
          Math.abs(m.canvas.labelY - m.dom.labelY) > tol
        );
      })
      .map(
        (m) =>
          `${m.type} canvas ${JSON.stringify(m.canvas)} dom ${JSON.stringify(m.dom)}`,
      );
    expect(off).toEqual([]);
  });
});
