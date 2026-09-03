import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { TextField } from "@composition/shared/components/TextField";
import { TextArea } from "@composition/shared/components/TextArea";
import { NumberField } from "@composition/shared/components/NumberField";
import { DateField } from "@composition/shared/components/DateField";
import { TimeField } from "@composition/shared/components/TimeField";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
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
 * ADR-923 Phase 5 후속 — field 자식 **Label · Input · DateInput 의 read-only sub-part** (2026-09-03 판정 A,
 * FieldError 잔여 1 과 같은 소유권).
 *
 * DOM (`FormRenderers`·`DateRenderers`) 은 parent props 로 self-compose 하고 canonical 자식을 읽지 않는다 —
 * 자식에 준 인라인 style (color·fontSize·margin·padding·width·fontWeight) 은 어떤 채널로도 DOM 에 닿지
 * 않는다. Canvas 가 그 인라인을 반영하면 Canvas 만 갈린다. 이 테스트는 5 field 의 production 트리를
 * (1) 깨끗한 상태와 (2) Label·입력 자식에 인라인 junk 를 얹은 상태로 돌려, Label 상자 · 입력 상자 ·
 * root 높이가 DOM 과 1px 안에서 같은지 본다 — (2) 가 (1) 과 같아야 sub-part 계약이 성립한다.
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

/** DOM 에서 입력 컨트롤 상자를 찾는 selector — RAC 가 그리는 실제 요소 */
const DOM_CONTROL: Record<FieldType, string> = {
  TextField: "input.react-aria-Input",
  TextArea: "textarea",
  NumberField: ".react-aria-Group",
  DateField: ".react-aria-DateInput",
  TimeField: ".react-aria-DateInput",
};
/** Canvas production 트리에서 입력 컨트롤 자식 type (factory) */
const CANVAS_CONTROL: Record<FieldType, readonly string[]> = {
  TextField: ["Input"],
  TextArea: ["Input"],
  NumberField: ["SelectTrigger"],
  DateField: ["DateInput"],
  TimeField: ["DateInput"],
};

interface Box {
  w: number;
  h: number;
  y: number;
}
interface Leg {
  root: Box;
  label: Box | null;
  control: Box | null;
}

const JUNK_TARGET_TYPES = ["Label", "Input", "DateInput"] as const;
const JUNK_STYLE = {
  color: "rgb(1, 2, 3)",
  fontSize: 30,
  fontWeight: 900,
  marginTop: 30,
  padding: 9,
  width: 50,
  lineHeight: 10,
};

const dom = new Map<FieldType, Leg>();
const canvasClean = new Map<FieldType, Leg>();
const canvasJunk = new Map<FieldType, Leg>();
let host: HTMLElement | undefined;
const roots: Root[] = [];

function rect(el: HTMLElement | null, rootTop: number): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, y: r.top - rootTop };
}

async function renderDom(type: FieldType): Promise<Leg> {
  const mount = document.createElement("div");
  mount.style.cssText = "width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(React.createElement(SHARED[type], { label: "Name" }));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const root = mount.firstElementChild as HTMLElement | null;
  if (!root) throw new Error(`${type}: DOM root 없음`);
  const rootRect = root.getBoundingClientRect();
  return {
    root: { w: rootRect.width, h: rootRect.height, y: 0 },
    label: rect(mount.querySelector(".react-aria-Label"), rootRect.top),
    control: rect(mount.querySelector(DOM_CONTROL[type]), rootRect.top),
  };
}

async function runCanvas(type: FieldType, junk: boolean): Promise<Leg> {
  const tree = await paletteCreationTree(type);
  const els = tree.elements.map((el) => {
    if (el.id === tree.root.id) {
      return { ...el, props: { ...el.props, label: "Name" } } as Element;
    }
    // junk 대상 = 판정 A 의 sub-part 토큰 (Label · Input · DateInput). NumberField 의 SelectTrigger 래퍼는
    //   delegation 표에 없는 별개 가족이라 범위 밖 (후속 기록).
    const isTarget =
      el.id !== tree.root.id && JUNK_TARGET_TYPES.includes(el.type);
    if (junk && isTarget) {
      return {
        ...el,
        props: {
          ...el.props,
          style: {
            ...((el.props?.style ?? {}) as Record<string, unknown>),
            ...JUNK_STYLE,
          },
        },
      } as Element;
    }
    return el;
  });
  const label = els.find((el) => el.type === "Label");
  const control = els.find(
    (el) => el.id !== tree.root.id && CANVAS_CONTROL[type].includes(el.type),
  );
  const run = layoutTree(tree.root.id, els, 400, -1, "fe-subpart");
  const toBox = (id: string | undefined): Box | null => {
    if (!id) return null;
    const b = run.layout.get(id);
    return b ? { w: b.width, h: b.height, y: b.y } : null;
  };
  const rootBox = run.layout.get(tree.root.id);
  return {
    root: { w: rootBox?.width ?? 0, h: rootBox?.height ?? 0, y: 0 },
    label: toBox(label?.id),
    control: toBox(control?.id),
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr923-fe-subpart-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  // Preview iframe 의 전역 reset (`* { box-sizing: border-box }` 등) — production 과 같은 문자열.
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:400px;";
  document.body.appendChild(host);
  for (const type of FIELD_TYPES) {
    dom.set(type, await renderDom(type));
    canvasClean.set(type, await runCanvas(type, false));
    canvasJunk.set(type, await runCanvas(type, true));
    console.log(
      `ADR923SUB ${type} dom=${JSON.stringify(dom.get(type))} clean=${JSON.stringify(canvasClean.get(type))} junk=${JSON.stringify(canvasJunk.get(type))}`,
    );
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-fe-subpart-bundle")?.remove();
});

function expectBox(
  label: string,
  a: Box | null,
  b: Box | null,
  keys: ReadonlyArray<keyof Box> = ["w", "h", "y"],
  tol = 1,
): void {
  expect(a, `${label} (canvas)`).not.toBeNull();
  expect(b, `${label} (dom)`).not.toBeNull();
  for (const k of keys) {
    expect(
      Math.abs(a![k] - b![k]),
      `${label} ${k} canvas ${a![k]} dom ${b![k]}`,
    ).toBeLessThanOrEqual(tol);
  }
}

describe("ADR-923 field 자식 Label · Input · DateInput — read-only sub-part", () => {
  it("sub-part 계약 — Label·Input·DateInput 자식에 인라인 junk 를 얹어도 Canvas 상자 (Label · 컨트롤 · root) 가 clean 과 같다", () => {
    for (const type of FIELD_TYPES) {
      const c = canvasClean.get(type)!;
      const j = canvasJunk.get(type)!;
      expect(j, `${type} junk`).toEqual(c);
    }
  });

  it("baseline DOM 대조 — Label 상자 (w·h·y) · 컨트롤 높이·y · root 높이가 1px 안 (TextArea 본체 포함 — rows 3 = 70/96)", () => {
    for (const type of FIELD_TYPES) {
      const d = dom.get(type)!;
      const c = canvasClean.get(type)!;
      expectBox(`${type} label`, c.label, d.label);
      expectBox(`${type} control`, c.control, d.control, ["h", "y"]);
      expect(
        Math.abs(c.root.h - d.root.h),
        `${type} root height canvas ${c.root.h} dom ${d.root.h}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("입력 컨트롤 폭 — DOM 은 Preview 전역 reset (border-box) 아래 root 폭 100%, Canvas 도 root 폭 100% (양쪽 같은 값)", () => {
    // 종전 "DOM 426 > root 400 content-box overflow" 기록은 DOM leg 이 production Preview 의
    //   `* { box-sizing: border-box }` (preview/baseStyles.ts) 를 안 실은 하니스 누락이었다
    //   (2026-09-03 live: Preview TextField root 342 = Input 342, Canvas 342 = 342).
    for (const type of FIELD_TYPES) {
      const d = dom.get(type)!;
      const c = canvasClean.get(type)!;
      expect(
        Math.abs(d.control!.w - d.root.w),
        `${type} dom control width (${d.control!.w}) vs root (${d.root.w})`,
      ).toBeLessThanOrEqual(1);
      expect(c.control!.w, `${type} canvas control width`).toBe(c.root.w);
      expect(
        Math.abs(d.control!.w - c.control!.w),
        `${type} dom vs canvas control width`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
