import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { Checkbox, Radio, RadioGroup, Slider } from "@composition/shared";
import { getElementForTag } from "@composition/specs";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";
import { getPaletteItems } from "@/builder/panels/components/paletteItems";
import {
  allPaletteCreationTrees,
  layoutTree,
  type LayoutRun,
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
 * ADR-923 Phase 5 — **HC2 판정표 (G4 후반)**: Phase 0 §A 가 남긴 "Canvas 전용 display override" 33 rule
 * (Q4 후보 13 · DOM 충돌 3 · DOM 선언 없음 17) 을 production 형태로 캡처해 outer display 가 DOM 과 같은지
 * 판정한다. Canvas 값 = 팔레트 생성 트리 (`adr923ProductionTrees`) 안의 해당 type 노드가 wasm 경계에
 * 보내는 `display` (팔레트에 없는 sub-part 는 그 부모의 production 트리에서, 어디에도 없으면 standalone
 * `getDefaultProps` leaf). DOM 값 = Phase 0 §A 파일 사실 (candidates) / live computed (DOM 충돌 3 —
 * 실 번들 CSS 로 shared 컴포넌트 렌더) / Preview 태그 (`getElementForTag`) 의 UA 기본값 (선언 없음 17).
 * 판정은 `HC2` 표로 고정 — 미판정 0 이 게이트다. 상세: evidence/923-phase5-cutover.md §HC2.
 */

const CANDIDATES = [
  "Button",
  "ToggleButton",
  "Menu",
  "FileTrigger",
  "Skeleton",
  "ColorPicker",
  "ColorSlider",
  "ColorSwatchPicker",
  "GridList",
  "Label",
  "Slot",
  "Tag",
  "TagList",
] as const;
const DOM_CONFLICTS = ["Checkbox", "Radio", "SliderOutput"] as const;
const UNDECLARED = [
  "Avatar",
  "Breadcrumb",
  "CalendarHeader",
  "DisclosureHeader",
  "FieldError",
  "IllustratedMessage",
  "MeterTrack",
  "MeterValue",
  "ProgressBarTrack",
  "ProgressBarValue",
  "ProgressCircle",
  "StatusLight",
  "TableHeader",
  "TableBody",
  "TailSwatch",
  "TextArea",
  "Tree",
] as const;
const ALL = [...CANDIDATES, ...DOM_CONFLICTS, ...UNDECLARED];

interface Capture {
  type: string;
  form: string; // "palette" | "subpart:<owner>" | "standalone"
  canvas: string; // wasm 경계 display
  domTag: string;
  uaDisplay: string;
  live?: string;
}

function outerOf(display: string): string {
  const d = display.trim().toLowerCase();
  if (d === "none" || d === "contents") return d;
  if (d.startsWith("inline")) return "inline";
  if (d.startsWith("table")) return d === "table" ? "block" : d;
  return "block";
}

let trees: ProductionTree[];
const runs = new Map<string, LayoutRun>();
const captures: Capture[] = [];
let root: Root | undefined;
let host: HTMLElement | undefined;
const live: Record<string, string> = {};

function runOf(tree: ProductionTree): LayoutRun {
  let r = runs.get(tree.name);
  if (!r) {
    r = layoutTree(tree.root.id, tree.elements, 400, -1, "hc2");
    runs.set(tree.name, r);
  }
  return r;
}

function uaDisplayOf(tag: string): string {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  const d = getComputedStyle(el).display;
  el.remove();
  return d;
}

function standalone(type: string): ProductionTree {
  const el = {
    id: `hc2-standalone-${type}`,
    type,
    props: getDefaultProps(type),
    parent_id: null,
  } as unknown as Element;
  return {
    name: `standalone ${type}`,
    arm: "palette:none",
    type,
    root: el,
    elements: [el],
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  trees = await allPaletteCreationTrees("hc2");
  const palette = new Set(getPaletteItems().map((p) => p.type));

  for (const type of ALL) {
    let form = "standalone";
    let node: Element | undefined;
    let owner: ProductionTree | undefined;
    if (palette.has(type)) {
      owner = trees.find((t) => t.type === type && t.root.type === type);
      if (owner) {
        node = owner.root;
        form = "palette";
      }
    }
    if (!node) {
      for (const t of trees) {
        const hit = t.elements.find((el) => el.type === type);
        if (hit) {
          owner = t;
          node = hit;
          form = `subpart:${t.type}`;
          break;
        }
      }
    }
    if (!node || !owner) {
      owner = standalone(type);
      node = owner.root;
    }
    const run = runOf(owner);
    const b = run.batch.get(node.id);
    const tag = String(
      getElementForTag(type, node.props as Record<string, unknown>) ?? "div",
    );
    captures.push({
      type,
      form,
      canvas: b ? String(b.style.display ?? "(없음)") : "(batch 없음)",
      domTag: tag,
      uaDisplay: uaDisplayOf(tag),
    });
  }

  // DOM 충돌 3 — live computed (실 번들 CSS)
  const style = document.createElement("style");
  style.id = "adr923-hc2-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);
  root = createRoot(host);
  await new Promise<void>((resolve) => {
    root!.render(
      React.createElement(
        "div",
        null,
        React.createElement(Checkbox, { children: "Check" }),
        React.createElement(
          RadioGroup,
          { label: "Group" },
          React.createElement(Radio, { value: "a", children: "A" }),
        ),
        React.createElement(Slider, { label: "Slide", defaultValue: 30 }),
      ),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  for (const [type, sel] of [
    ["Checkbox", ".react-aria-Checkbox"],
    ["Radio", ".react-aria-Radio"],
    ["SliderOutput", ".react-aria-SliderOutput"],
  ] as const) {
    const el = host.querySelector(sel) as HTMLElement | null;
    live[type] = el ? getComputedStyle(el).display : "(없음)";
    const c = captures.find((x) => x.type === type)!;
    c.live = live[type];
  }
});

afterAll(async () => {
  root?.unmount();
  host?.remove();
  document.getElementById("adr923-hc2-bundle")?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr923-hc2-capture.json",
    JSON.stringify({ measuredAt: new Date().toISOString(), captures }, null, 2),
  );
});

describe("ADR-923 Phase 5 — HC2 판정표 (Canvas 전용 display override 33 rule)", () => {
  it("캡처 — 33 rule 전부 production 형태의 경계 display · Preview 태그 UA 기본값 · DOM 충돌 3 의 live computed", () => {
    for (const c of captures) {
      console.log(
        `ADR923HC2 ${c.type} form=${c.form} canvas=${c.canvas} tag=${c.domTag} ua=${c.uaDisplay}${c.live ? ` live=${c.live}` : ""} outer(canvas)=${outerOf(c.canvas)}`,
      );
    }
    expect(captures).toHaveLength(33);
    expect(captures.filter((c) => c.canvas.startsWith("("))).toEqual([]);
  });
});
