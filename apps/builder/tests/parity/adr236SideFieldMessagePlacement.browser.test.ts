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
import { SearchField } from "@composition/shared/components/SearchField";
import { Select } from "@composition/shared/components/Select";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
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
 * ADR-236 후속 (2026-09-26, 사용자 지시 "재현된 것 수리") — 라벨을 옆 (side) 에 둔 field 의 오류 문구 ·
 * 도움말 배치.
 *
 * 수리 전: Canvas 는 catalog 에 없는 규칙 (side 부모 wrap · FieldError/Description 폭 100% + 라벨 폭 +
 * 16 들여쓰기) 을 혼자 주입했고, DOM 은 nowrap 이라 문구가 입력칸 옆 세 번째 item 이 되어 입력칸을
 * 줄였다. 정본은 catalog side 변형 — 줄바꿈 + 문구를 입력칸 아래, 입력칸과 같은 x (라벨 폭 + 크기별
 * gap) 에. 두 렌더러가 같은 정본을 읽는다.
 *
 * 같은 production 상태 짝 (parent top-level props — labelPosition · isInvalid · errorMessage ·
 * description) 을 10 field 에서 양쪽으로 잰다. 폭 400.
 */
const FIELD_TYPES = [
  "TextField",
  "TextArea",
  "NumberField",
  "DateField",
  "TimeField",
  "SearchField",
  "Select",
  "ComboBox",
  "DatePicker",
  "DateRangePicker",
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
  SearchField: SearchField as React.ComponentType<Record<string, unknown>>,
  Select: Select as React.ComponentType<Record<string, unknown>>,
  ComboBox: ComboBox as React.ComponentType<Record<string, unknown>>,
  DatePicker: DatePicker as React.ComponentType<Record<string, unknown>>,
  DateRangePicker: DateRangePicker as React.ComponentType<
    Record<string, unknown>
  >,
};

interface StateCase {
  id: string;
  props: Record<string, unknown>;
}
const STATES: readonly StateCase[] = [
  {
    id: "invalid",
    props: { isInvalid: true, errorMessage: "Required field" },
  },
  { id: "description", props: { description: "Help text" } },
  {
    id: "both",
    props: {
      isInvalid: true,
      errorMessage: "Required field",
      description: "Help text",
    },
  },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Leg {
  rootH: number;
  label: Box | null;
  error: Box | null;
  description: Box | null;
}
interface Measured {
  type: FieldType;
  state: string;
  dom: Leg;
  canvas: Leg;
  /** DOM 에서 라벨 다음 형제 (입력칸 · 트리거 · 그룹) 의 x */
  domControlX: number;
}

/**
 * 알려진 높이 차 — 없음. 2026-09-26 까지 Select 만 도움말에 `.react-aria-Description` 을 붙여 generated
 * Description 줄 높이 (1.333 → md 16) 를 받았고, 다른 field 는 RAC Text 기본 클래스 (`.react-aria-Text` 1.5 →
 * 18) 라 Canvas 와 같았다. Select 도 같은 형태로 맞췄다.
 */
const KNOWN_HEIGHT_GAP: Record<string, number> = {};

const measured: Measured[] = [];
let host: HTMLElement | undefined;
const roots: Root[] = [];

const rel = (r: DOMRect, base: DOMRect): Box => ({
  x: Math.round(r.left - base.left),
  y: Math.round(r.top - base.top),
  w: Math.round(r.width),
  h: Math.round(r.height),
});

async function renderDom(
  type: FieldType,
  state: StateCase,
): Promise<{ leg: Leg; controlX: number }> {
  const mount = document.createElement("div");
  mount.style.cssText = "width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(
      React.createElement(SHARED[type], {
        label: "Name",
        labelPosition: "side",
        ...state.props,
      }),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  // field root = 라벨을 직계 자식으로 가진 요소 (Select · ComboBox 는 mount 첫 자식이 root 가 아니다)
  const root = mount.querySelector(
    ":scope *:has(> .react-aria-Label)",
  ) as HTMLElement | null;
  if (!root) throw new Error(`${type}: DOM root 없음`);
  const base = root.getBoundingClientRect();
  const pick = (sel: string) => {
    const el = root.querySelector(`:scope > ${sel}`) as HTMLElement | null;
    return el ? rel(el.getBoundingClientRect(), base) : null;
  };
  const label = pick(".react-aria-Label");
  const kids = [...root.children] as HTMLElement[];
  const labelIdx = kids.findIndex((k) =>
    k.classList.contains("react-aria-Label"),
  );
  // 라벨 다음의 흐름 안 형제 (RAC 숨은 select 등 absolute 요소 · 문구는 건너뜀)
  const control = kids
    .slice(labelIdx + 1)
    .find(
      (k) =>
        getComputedStyle(k).position !== "absolute" &&
        !k.classList.contains("react-aria-FieldError") &&
        k.getAttribute("slot") !== "description",
    );
  return {
    leg: {
      rootH: Math.round(base.height),
      label,
      error: pick(".react-aria-FieldError"),
      description: pick('[slot="description"]'),
    },
    controlX: control ? rel(control.getBoundingClientRect(), base).x : -1,
  };
}

async function runCanvas(type: FieldType, state: StateCase): Promise<Leg> {
  const tree = await paletteCreationTree(
    type,
    `adr236-side-${type}-${state.id}`,
  );
  const els = tree.elements.map((el) =>
    el.id === tree.root.id
      ? ({
          ...el,
          props: {
            ...el.props,
            label: "Name",
            labelPosition: "side",
            ...state.props,
          },
        } as Element)
      : el,
  );
  const run = layoutTree(tree.root.id, els, 400, -1, "adr236-side");
  const rootBox = run.layout.get(tree.root.id);
  const boxOf = (id: string | undefined): Box | null => {
    if (!id) return null;
    const b = run.layout.get(id);
    const batch = run.batch.get(id);
    if (!b || !rootBox || (batch && batch.style.display === "none")) {
      return null;
    }
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  };
  const direct = (t: string) =>
    els.find((el) => el.type === t && el.parent_id === tree.root.id)?.id;
  return {
    rootH: Math.round(rootBox?.height ?? 0),
    label: boxOf(direct("Label")),
    // canonical FieldError 자식이 없는 field (SearchField · Select · ComboBox · picker) 는 합성 오류 줄
    error: boxOf(direct("FieldError") ?? `${tree.root.id}__synerr`),
    description: boxOf(`${tree.root.id}__syndesc`),
  };
}

beforeAll(async () => {
  await initEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr236-side-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:400px;";
  document.body.appendChild(host);

  for (const type of FIELD_TYPES) {
    for (const state of STATES) {
      const { leg: dom, controlX } = await renderDom(type, state);
      const canvas = await runCanvas(type, state);
      measured.push({
        type,
        state: state.id,
        dom,
        canvas,
        domControlX: controlX,
      });
      console.log(
        `ADR236SIDE ${type}/${state.id} controlX=${controlX} dom=${JSON.stringify(dom)} canvas=${JSON.stringify(canvas)}`,
      );
    }
  }
});

afterAll(() => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr236-side-bundle")?.remove();
});

describe("ADR-236 후속 — side 라벨 field 의 오류 문구 · 도움말 배치 (10 field × 3 상태)", () => {
  it("DOM — 문구는 입력칸 아래 줄, 입력칸과 같은 x 에서 시작한다 (catalog side 변형)", () => {
    for (const m of measured) {
      const tag = `${m.type}/${m.state}`;
      for (const msg of [m.dom.error, m.dom.description]) {
        if (!msg) continue;
        expect(m.domControlX, `${tag} control`).toBeGreaterThan(0);
        expect(
          Math.abs(msg.x - m.domControlX),
          `${tag} x ${msg.x} vs control ${m.domControlX}`,
        ).toBeLessThanOrEqual(1);
        expect(msg.y, `${tag} 다음 줄`).toBeGreaterThanOrEqual(
          m.dom.label?.h ?? 0,
        );
      }
    }
  });

  it("Canvas — 문구 상자 유무 · x · y · 폭 · root 높이가 DOM 과 같다", () => {
    for (const m of measured) {
      const tag = `${m.type}/${m.state}`;
      for (const key of ["error", "description"] as const) {
        const dom = m.dom[key];
        const canvas = m.canvas[key];
        expect(!!canvas, `${tag} ${key} 유무`).toBe(!!dom);
        if (!dom || !canvas) continue;
        expect(
          Math.abs(canvas.x - dom.x),
          `${tag} ${key} x canvas ${canvas.x} dom ${dom.x}`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(canvas.w - dom.w),
          `${tag} ${key} w canvas ${canvas.w} dom ${dom.w}`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(canvas.y - dom.y),
          `${tag} ${key} y canvas ${canvas.y} dom ${dom.y}`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(canvas.h - dom.h),
          `${tag} ${key} h canvas ${canvas.h} dom ${dom.h}`,
        ).toBeLessThanOrEqual(KNOWN_HEIGHT_GAP[`${m.type}/${key}`] ?? 1);
      }
      expect(
        Math.abs(m.canvas.rootH - m.dom.rootH),
        `${tag} root h canvas ${m.canvas.rootH} dom ${m.dom.rootH}`,
      ).toBeLessThanOrEqual(2);
    }
  });
});
