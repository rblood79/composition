import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { TextField } from "@composition/shared/components/TextField";
import { TextArea } from "@composition/shared/components/TextArea";
import { NumberField } from "@composition/shared/components/NumberField";
import { DateField } from "@composition/shared/components/DateField";
import { TimeField } from "@composition/shared/components/TimeField";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import type { Element } from "@/types/core/store.types";
import { layoutTree, paletteCreationTree } from "./adr923ProductionTrees";
import { buildSpecNodeData } from "@/builder/workspace/canvas/skia/buildSpecNodeData";
import type { CanvasSceneNode } from "@/builder/workspace/canvas/scene/canvasSceneNode";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 5 후속 — **FieldError 상태 투영** (breakdown "Phase 5 후속" 3항, HC2 r31m1 `fieldErrorStates`).
 *
 * DOM 은 RAC `FieldError` 가 `isInvalid` 일 때만 `<span>` 을 렌더하고 (`errorMessage` 가 비어 있어도 빈
 * span:block 이 남는다 — RAC 는 children "" 를 null 로 보지 않는다), 글자는 parent `errorMessage` 다.
 * Canvas 의 FieldError 자식은 factory 가 `children:""` + `display:none` 으로 만들고 아무도 parent 상태를
 * 읽지 않았다. 이 테스트는 **같은 production 상태 짝** (parent top-level props 만 다른 4 조합) 을 5 field
 * 가족에서 양쪽으로 재고, 상자 유무 · display · 높이 · y · parent 높이 증분을 대조한다.
 *
 * 케이스는 production 이 운반하는 키만 쓴다 (Inspector writer 가 쓰는 parent top-level `isInvalid` ·
 * `errorMessage`). 자식 FieldError 노드는 손대지 않는다 — Inspector 가 아닌 writer (AI · import · canonical
 * patch) 경로가 read-time propagation 만으로 같은 답을 내야 한다.
 */
const FIELD_TYPES = [
  "TextField",
  "TextArea",
  "NumberField",
  "DateField",
  "TimeField",
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const SHARED: Record<
  FieldType,
  React.ComponentType<Record<string, unknown>>
> = {
  TextField: TextField as React.ComponentType<Record<string, unknown>>,
  TextArea: TextArea as React.ComponentType<Record<string, unknown>>,
  NumberField: NumberField as React.ComponentType<Record<string, unknown>>,
  DateField: DateField as React.ComponentType<Record<string, unknown>>,
  TimeField: TimeField as React.ComponentType<Record<string, unknown>>,
};

interface StateCase {
  id: string;
  isInvalid: boolean;
  errorMessage: string;
}
const STATES: readonly StateCase[] = [
  { id: "valid-empty", isInvalid: false, errorMessage: "" },
  { id: "valid-text", isInvalid: false, errorMessage: "required" },
  { id: "invalid-empty", isInvalid: true, errorMessage: "" },
  { id: "invalid-text", isInvalid: true, errorMessage: "required" },
];

interface Leg {
  /** FieldError 상자가 있는가 (DOM: 요소 존재 · Canvas: wasm 경계 display ≠ none) */
  present: boolean;
  display: string;
  height: number;
  y: number;
  rootHeight: number;
  /** 글자 크기 (px) — DOM 은 computed, Canvas 는 Skia text shape */
  fontSize: number;
  /** 줄 높이 (px) — DOM 은 computed, Canvas 는 Skia text shape */
  lineHeight: number;
}
interface Measured {
  type: FieldType;
  state: string;
  dom: Leg;
  canvas: Leg;
}

const measured: Measured[] = [];
/** 옛 문서 (FieldError 자식에 인라인 fontSize 12) 의 invalid-text 캔버스 leg */
const measuredLegacy: Array<{ type: FieldType; canvas: Leg }> = [];
let host: HTMLElement | undefined;
const roots: Root[] = [];

async function renderDom(type: FieldType, state: StateCase): Promise<Leg> {
  const mount = document.createElement("div");
  mount.style.cssText = "width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(
      React.createElement(SHARED[type], {
        label: "Name",
        isInvalid: state.isInvalid,
        errorMessage: state.errorMessage,
      }),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const root = mount.firstElementChild as HTMLElement | null;
  if (!root) throw new Error(`${type}: DOM root 없음`);
  const rootRect = root.getBoundingClientRect();
  const fe = mount.querySelector(
    ".react-aria-FieldError",
  ) as HTMLElement | null;
  if (!fe) {
    return {
      present: false,
      display: "(없음)",
      height: 0,
      y: 0,
      rootHeight: rootRect.height,
      fontSize: 0,
      lineHeight: 0,
    };
  }
  const feRect = fe.getBoundingClientRect();
  const feCs = getComputedStyle(fe);
  const rootCs = getComputedStyle(root);
  console.log(
    `ADR923FE-CSS ${type} fe font=${feCs.fontSize} lh=${feCs.lineHeight} · root font=${rootCs.fontSize} lh=${rootCs.lineHeight}`,
  );
  return {
    present: true,
    display: feCs.display,
    height: feRect.height,
    y: feRect.top - rootRect.top,
    rootHeight: rootRect.height,
    fontSize: parseFloat(feCs.fontSize),
    lineHeight: parseFloat(feCs.lineHeight),
  };
}

async function runCanvas(
  type: FieldType,
  state: StateCase,
  /**
   * 옛 문서 재현 — factory 가 심던 인라인 글자 크기 + 사용자가 Typography 패널로 줄 수 있는 인라인
   * 줄 높이를 FieldError 자식에 얹는다 (r2 feh1 · round 3 fe2h1). 둘 다 DOM 에 도달할 채널이 없다.
   */
  legacyChildFontSize?: number,
): Promise<Leg> {
  const tree = await paletteCreationTree(type, `fe-state-${type}-${state.id}`);
  const els = tree.elements.map((el) => {
    if (el.id === tree.root.id) {
      return {
        ...el,
        props: {
          ...el.props,
          label: "Name",
          isInvalid: state.isInvalid,
          errorMessage: state.errorMessage,
        },
      } as Element;
    }
    if (el.type === "FieldError" && legacyChildFontSize != null) {
      return {
        ...el,
        props: {
          ...el.props,
          style: {
            ...((el.props?.style ?? {}) as Record<string, unknown>),
            fontSize: legacyChildFontSize,
            lineHeight: "10px",
            // 잔여 1 (판정 A): read-only sub-part — 간격·색 인라인도 DOM 미도달, Canvas 가 무시해야 한다
            marginTop: 30,
            padding: 9,
            color: "rgb(1, 2, 3)",
          },
        },
      } as Element;
    }
    return el;
  });
  const fe = els.find((el) => el.type === "FieldError");
  if (!fe) throw new Error(`${type}: production 트리에 FieldError 자식 없음`);
  const run = layoutTree(tree.root.id, els, 400, -1, "fe-state");
  const batch = run.batch.get(fe.id);
  const box = run.layout.get(fe.id);
  const rootBox = run.layout.get(tree.root.id);
  const display = batch
    ? String(batch.style.display ?? "(없음)")
    : "(batch 없음)";
  if (batch && display !== "none") {
    console.log(
      `ADR923FE-BATCH ${type}/${state.id} ${JSON.stringify({
        fontSize: batch.style.fontSize,
        lineHeight: batch.style.lineHeight,
        height: batch.style.height,
        feProps: fe.props,
      })}`,
    );
  }
  // Skia leg — layout batch 와 같은 요소를 그리는 shape 생산자. text shape 의 fontSize/lineHeight 가
  //   DOM computed 와 같아야 글자·줄 높이가 세 표면에서 같다 (ADR-923 후속 r2 fem1 gate).
  const skiaMap = new Map<string, CanvasSceneNode>(
    els.map((el) => [el.id, el as unknown as CanvasSceneNode]),
  );
  const findText = (
    n: { text?: { fontSize: number; lineHeight?: number; content: string } | undefined; children?: unknown[] } | null,
  ): { fontSize: number; lineHeight?: number; content: string } | undefined => {
    if (!n) return undefined;
    if (n.text?.content) return n.text;
    for (const c of (n.children ?? []) as typeof n[]) {
      const found = findText(c);
      if (found) return found;
    }
    return undefined;
  };
  const skiaNode = box
    ? buildSpecNodeData({
        element: fe as unknown as CanvasSceneNode,
        layout: box,
        theme: "light",
        elementsMap: skiaMap,
      })
    : null;
  const skiaText = findText(
    skiaNode as unknown as Parameters<typeof findText>[0],
  );
  return {
    present: display !== "none" && display !== "(batch 없음)",
    display,
    height: box?.height ?? 0,
    y: box?.y ?? 0,
    rootHeight: rootBox?.height ?? 0,
    fontSize: skiaText?.fontSize ?? 0,
    lineHeight: skiaText?.lineHeight ?? 0,
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr923-fe-state-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:400px;";
  document.body.appendChild(host);

  for (const type of FIELD_TYPES) {
    for (const state of STATES) {
      const dom = await renderDom(type, state);
      const canvas = await runCanvas(type, state);
      measured.push({ type, state: state.id, dom, canvas });
    }
  }
  for (const type of FIELD_TYPES) {
    measuredLegacy.push({
      type,
      canvas: await runCanvas(type, STATES[3], 12),
    });
  }
  for (const m of measured) {
    console.log(
      `ADR923FE ${m.type} ${m.state} dom=${JSON.stringify(m.dom)} canvas=${JSON.stringify(m.canvas)}`,
    );
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-fe-state-bundle")?.remove();
});

describe("ADR-923 Phase 5 후속 — FieldError 상태 투영 (5 field × 4 상태, 같은 production 상태 짝)", () => {
  it("상자 유무 — DOM 은 isInvalid 일 때만 FieldError 를 렌더한다 (errorMessage 무관); Canvas 도 같은 조건에서만 상자를 낸다", () => {
    for (const m of measured) {
      const tag = `${m.type}/${m.state}`;
      expect(m.dom.present, `${tag} dom`).toBe(m.state.startsWith("invalid"));
      expect(m.canvas.present, `${tag} canvas`).toBe(m.dom.present);
    }
  });

  it("상자가 있을 때 — Canvas display 는 block, 높이는 DOM 과 1px 안, y 는 valid 상태 parent 높이 + gap (양쪽 같은 offset)", () => {
    for (const m of measured.filter((x) => x.dom.present)) {
      const tag = `${m.type}/${m.state}`;
      expect(m.dom.display, `${tag} dom display`).toBe("block");
      expect(m.canvas.display, `${tag} canvas display`).toBe("block");
      expect(
        Math.abs(m.canvas.height - m.dom.height),
        `${tag} height canvas ${m.canvas.height} dom ${m.dom.height}`,
      ).toBeLessThanOrEqual(1);
      // y 는 앞선 형제 (Label + Input) 높이에 실린다 — TextArea 본체 높이는 FieldError 와 무관한 기존
      //   격차 (Canvas 106 vs DOM 96, evidence 기록) 가 있어 절대 y 대신 valid 상태 parent 높이 기준
      //   offset (= column gap) 으로 FieldError 배치만 격리해 잰다.
      const base = measured.find(
        (x) => x.type === m.type && x.state === "valid-empty",
      )!;
      const domOffset = m.dom.y - base.dom.rootHeight;
      const canvasOffset = m.canvas.y - base.canvas.rootHeight;
      expect(
        Math.abs(canvasOffset - domOffset),
        `${tag} y offset canvas ${canvasOffset} dom ${domOffset}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("글자 metric — Skia text shape 의 font-size·line-height 가 DOM computed 와 같다", () => {
    // DOM 실측 (2026-09-03): TextField/TextArea 14 → 21, Number/Date/TimeField 12 → 18. font-size 는
    //   parent delegation hint, line-height 는 `:root { line-height: 1.5 }` 상속 (활성 bundle 에
    //   `.react-aria-FieldError` 줄 높이 규칙 없음 — catalog rule 의 16 은 DOM 이 안 읽는다).
    const rows = measured.filter(
      (x) => x.dom.present && x.state === "invalid-text",
    );
    expect(rows.length).toBe(FIELD_TYPES.length);
    for (const m of rows) {
      const tag = `${m.type}/${m.state}`;
      expect(
        m.canvas.fontSize,
        `${tag} font-size skia ${m.canvas.fontSize} dom ${m.dom.fontSize}`,
      ).toBe(m.dom.fontSize);
      expect(
        Math.abs(m.canvas.lineHeight - m.dom.lineHeight),
        `${tag} line-height skia ${m.canvas.lineHeight} dom ${m.dom.lineHeight}`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  it("옛 문서 — FieldError 자식의 인라인 fontSize 12 · lineHeight 10px 이 있어도 Canvas 는 DOM 과 같다 (publish 는 RAC 자체 FieldError 를 그려 인라인 채널이 없다)", () => {
    for (const { type, canvas } of measuredLegacy) {
      const dom = measured.find(
        (m) => m.type === type && m.state === "invalid-text",
      )!.dom;
      expect(canvas.fontSize, `${type} legacy font-size`).toBe(dom.fontSize);
      expect(
        Math.abs(canvas.lineHeight - dom.lineHeight),
        `${type} legacy line-height canvas ${canvas.lineHeight} dom ${dom.lineHeight}`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(canvas.height - dom.height),
        `${type} legacy height canvas ${canvas.height} dom ${dom.height}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("parent 높이 증분 — invalid 로 바뀔 때 늘어나는 높이 (gap + FieldError) 가 양쪽 같다", () => {
    for (const type of FIELD_TYPES) {
      const base = measured.find(
        (m) => m.type === type && m.state === "valid-empty",
      )!;
      for (const state of ["invalid-empty", "invalid-text"]) {
        const m = measured.find((x) => x.type === type && x.state === state)!;
        const domDelta = m.dom.rootHeight - base.dom.rootHeight;
        const canvasDelta = m.canvas.rootHeight - base.canvas.rootHeight;
        expect(
          Math.abs(canvasDelta - domDelta),
          `${type}/${state} Δroot canvas ${canvasDelta} dom ${domDelta}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});
