import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { NumberField } from "@composition/shared/components/NumberField";
import { Select } from "@composition/shared/components/Select";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { SearchField } from "@composition/shared/components/SearchField";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { Meter } from "@composition/shared/components/Meter";
import { ProgressBar } from "@composition/shared/components/ProgressBar";
import { Slider } from "@composition/shared/components/Slider";
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
 * ADR-923 Phase 5 후속 — **SelectTrigger 래퍼 · 그룹 Label · 래퍼 아래 DateInput 의 read-only sub-part**
 * (2026-09-03 판정 A × 2 — FieldError · field Label/Input 과 같은 소유권).
 *
 * DOM 렌더러는 canonical SelectTrigger 를 SelectValue 손자를 찾는 경로로만 쓰고 그 style 은 읽지 않으며
 * (래퍼 상자는 parent rule delegation 이 그린다), 그룹 (Meter · ProgressBar · Slider …) 은 parent `label` 로
 * RAC Label 을 self-compose 한다. 자식에 준 인라인 style 은 어떤 채널로도 DOM 에 닿지 않는다. 이 테스트는
 * 9 컴포넌트의 production 트리를 (1) 깨끗한 상태와 (2) sub-part 자식에 인라인 junk 를 얹은 상태로 돌려
 * 컨트롤 상자 · Label 상자 · root 가 같은지 본다 — (2) 가 (1) 과 같아야 sub-part 계약이 성립한다.
 */
const WRAPPER_TYPES = [
  "NumberField",
  "Select",
  "ComboBox",
  "SearchField",
  "DatePicker",
  "DateRangePicker",
] as const;
const GROUP_TYPES = ["Meter", "ProgressBar", "Slider"] as const;
const ALL_TYPES = [...WRAPPER_TYPES, ...GROUP_TYPES] as const;
type AnyType = (typeof ALL_TYPES)[number];

const SHARED: Record<AnyType, React.ComponentType<Record<string, unknown>>> = {
  NumberField: NumberField as React.ComponentType<Record<string, unknown>>,
  Select: Select as React.ComponentType<Record<string, unknown>>,
  ComboBox: ComboBox as React.ComponentType<Record<string, unknown>>,
  SearchField: SearchField as React.ComponentType<Record<string, unknown>>,
  DatePicker: DatePicker as React.ComponentType<Record<string, unknown>>,
  DateRangePicker: DateRangePicker as React.ComponentType<
    Record<string, unknown>
  >,
  Meter: Meter as React.ComponentType<Record<string, unknown>>,
  ProgressBar: ProgressBar as React.ComponentType<Record<string, unknown>>,
  Slider: Slider as React.ComponentType<Record<string, unknown>>,
};

const DOM_PROPS: Record<AnyType, Record<string, unknown>> = {
  NumberField: { label: "Name" },
  Select: { label: "Name" },
  ComboBox: { label: "Name" },
  SearchField: { label: "Name" },
  DatePicker: { label: "Name" },
  DateRangePicker: { label: "Name" },
  Meter: { label: "Name", value: 50 },
  ProgressBar: { label: "Name", value: 50 },
  Slider: { label: "Name", defaultValue: 50 },
};

/** DOM 에서 래퍼 (입력 상자) 를 찾는 selector — parent rule delegation 이 그리는 실제 요소 */
const DOM_CONTROL: Partial<Record<AnyType, string>> = {
  NumberField: ".react-aria-Group",
  Select: "button.react-aria-Button",
  ComboBox: ".combobox-container",
  SearchField: ".searchfield-container",
  DatePicker: ".react-aria-Group",
  DateRangePicker: ".react-aria-Group",
};

/**
 * junk 대상 = 판정 A 의 sub-part: 래퍼 6 은 SelectTrigger (+ picker 의 DateInput), 그룹 3 은 Label,
 * Select · ComboBox · SearchField 는 **SelectValue 의 style 축** (2026-09-04 판정 A — 텍스트 축은 자식 유지).
 */
const JUNK_TARGETS: Record<AnyType, readonly string[]> = {
  NumberField: ["SelectTrigger"],
  Select: ["SelectTrigger", "SelectValue"],
  ComboBox: ["SelectTrigger", "SelectValue"],
  SearchField: ["SelectTrigger", "SelectValue"],
  DatePicker: ["SelectTrigger", "DateInput"],
  DateRangePicker: ["SelectTrigger", "DateInput"],
  Meter: ["Label"],
  ProgressBar: ["Label"],
  Slider: ["Label"],
};
const JUNK_STYLE = {
  color: "rgb(1, 2, 3)",
  fontSize: 30,
  fontWeight: 900,
  marginTop: 30,
  padding: 9,
  width: 50,
  height: 7,
  lineHeight: 10,
  gap: 40,
  borderRadius: 40,
  backgroundColor: "rgb(4, 5, 6)",
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
  /** SelectValue (값/placeholder leaf) — style 축만 sub-part (2026-09-04 판정 A). */
  value: Box | null;
}

const dom = new Map<AnyType, Leg>();
const canvasClean = new Map<AnyType, Leg>();
const canvasJunk = new Map<AnyType, Leg>();
let host: HTMLElement | undefined;
const roots: Root[] = [];

function rect(el: HTMLElement | null, rootTop: number): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, y: r.top - rootTop };
}

async function renderDom(type: AnyType): Promise<Leg> {
  const mount = document.createElement("div");
  mount.style.cssText = "width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(React.createElement(SHARED[type], DOM_PROPS[type]));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  // Select · ComboBox 는 첫 자식이 RAC 의 숨은 요소 (0×0) 라 `.react-aria-{type}` root 를 잡는다.
  const root =
    (mount.querySelector(`.react-aria-${type}`) as HTMLElement | null) ??
    (mount.firstElementChild as HTMLElement | null);
  if (!root) throw new Error(`${type}: DOM root 없음`);
  const rootRect = root.getBoundingClientRect();
  const controlSel = DOM_CONTROL[type];
  return {
    root: { w: rootRect.width, h: rootRect.height, y: 0 },
    label: rect(mount.querySelector(".react-aria-Label"), rootRect.top),
    control: controlSel
      ? rect(mount.querySelector(controlSel), rootRect.top)
      : null,
    value: rect(
      mount.querySelector(
        ".react-aria-SelectValue, .react-aria-Input, input",
      ) as HTMLElement | null,
      rootRect.top,
    ),
  };
}

async function runCanvas(type: AnyType, junk: boolean): Promise<Leg> {
  const tree = await paletteCreationTree(type);
  const targets = JUNK_TARGETS[type];
  const els = tree.elements.map((el) => {
    if (el.id === tree.root.id) {
      return {
        ...el,
        props: { ...el.props, ...DOM_PROPS[type] },
      } as Element;
    }
    if (junk && targets.includes(el.type)) {
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
  const label = els.find((el) => el.id !== tree.root.id && el.type === "Label");
  const control = els.find(
    (el) => el.id !== tree.root.id && el.type === "SelectTrigger",
  );
  const value = els.find(
    (el) => el.id !== tree.root.id && el.type === "SelectValue",
  );
  const run = layoutTree(tree.root.id, els, 400, -1, "wrapper-subpart");
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
    value: toBox(value?.id),
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr923-wrapper-subpart-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  // Preview iframe 의 전역 reset (`* { box-sizing: border-box }` 등) — production 과 같은 문자열.
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:400px;";
  document.body.appendChild(host);
  for (const type of ALL_TYPES) {
    dom.set(type, await renderDom(type));
    canvasClean.set(type, await runCanvas(type, false));
    canvasJunk.set(type, await runCanvas(type, true));
    console.log(
      `ADR923WRAP ${type} dom=${JSON.stringify(dom.get(type))} clean=${JSON.stringify(canvasClean.get(type))} junk=${JSON.stringify(canvasJunk.get(type))}`,
    );
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-wrapper-subpart-bundle")?.remove();
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

describe("ADR-923 SelectTrigger 래퍼 · 그룹 Label · picker DateInput — read-only sub-part", () => {
  it("sub-part 계약 — 래퍼·Label·DateInput 자식에 인라인 junk 를 얹어도 Canvas 상자 (컨트롤 · Label · root) 가 clean 과 같다", () => {
    for (const type of ALL_TYPES) {
      const c = canvasClean.get(type)!;
      const j = canvasJunk.get(type)!;
      expect(j, `${type} junk`).toEqual(c);
    }
  });

  it("baseline DOM 대조 — 래퍼 6 은 컨트롤 높이·y · root 높이, 그룹 3 은 Label 상자 (w·h·y) 가 1px 안", () => {
    for (const type of WRAPPER_TYPES) {
      const d = dom.get(type)!;
      const c = canvasClean.get(type)!;
      expectBox(`${type} control`, c.control, d.control, ["h", "y"]);
      expect(
        Math.abs(c.root.h - d.root.h),
        `${type} root height canvas ${c.root.h} dom ${d.root.h}`,
      ).toBeLessThanOrEqual(1);
    }
    for (const type of GROUP_TYPES) {
      const d = dom.get(type)!;
      const c = canvasClean.get(type)!;
      expectBox(`${type} label`, c.label, d.label);
    }
  });

  it("SelectValue 는 style 축만 sub-part (판정 A, 2026-09-04) — Canvas 값 상자가 junk 에 불변이고 DOM 값 상자와 높이가 같다", () => {
    for (const type of ["Select", "ComboBox", "SearchField"] as const) {
      const c = canvasClean.get(type)!;
      const j = canvasJunk.get(type)!;
      const d = dom.get(type)!;
      expect(c.value, `${type} canvas value 상자`).not.toBeNull();
      expect(
        JSON.stringify(j.value),
        `${type} SelectValue junk == clean`,
      ).toBe(JSON.stringify(c.value));
      if (d.value) {
        expect(
          Math.abs(d.value.h - c.value!.h),
          `${type} value Δh (dom ${d.value.h} vs canvas ${c.value!.h})`,
        ).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("래퍼 폭 — Canvas 래퍼는 root 폭 100% (implicit 주입이 유일 채널); DOM 래퍼도 Preview 전역 reset (border-box) 아래 root 폭 100% (양쪽 같은 값)", () => {
    // 종전 "DOM 418 ≥ root 400 content-box overflow" 기록은 하니스 누락 (preview/baseStyles.ts 주석).
    for (const type of WRAPPER_TYPES) {
      const d = dom.get(type)!;
      const c = canvasClean.get(type)!;
      expect(c.control!.w, `${type} canvas control width`).toBe(c.root.w);
      expect(
        Math.abs(d.control!.w - d.root.w),
        `${type} dom control width (${d.control!.w}) vs root (${d.root.w})`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(d.control!.w - c.control!.w),
        `${type} dom vs canvas control width`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
