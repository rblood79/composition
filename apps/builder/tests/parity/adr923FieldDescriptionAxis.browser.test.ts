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
 * ADR-923 Phase 5 후속 착수 10 (2026-09-04, 사용자 판단) — **field 의 description 축**.
 *
 * `description` 은 binding 이 공개한 D2 편집 속성이고 (`TextField.binding.ts` props.accepts.description),
 * DOM 은 그것을 실제로 그린다 — `{description && <Text slot="description">{description}</Text>}`
 * (`TextField.tsx` 외 13 컴포넌트 동형, rendererMap 은 `element.props.description` 을 그대로 넘긴다).
 * 시각은 parent rule 의 delegation (`[slot="description"]` — 생성 CSS `.react-aria-{Parent} [slot="description"]`
 * 가 size 별 hint 변수를 주고 base.css 가 `--text-xs` 로 받는다) 이 정한다.
 *
 * 그런데 **Canvas 에는 그 상자가 없다**: factory 는 field 에 Description 자식을 만들지 않고
 * (`FormComponents.ts` 의 Description 자식은 Toast 것뿐), layout 의 가시 자식 집합
 * (`FIELD_VISIBLE_CHILD_TAGS`) 에도 Description 이 없다. 그래서 같은 canonical 문서가 DOM 에서는 한 줄
 * 더 높고 Canvas 에서는 낮다 — D3 비대칭.
 *
 * 제품 계약 (사용자 판단): **parent `description` 이 텍스트 SSOT** 이고 field 안의 description 줄은
 * parent 가 소유하는 read-only sub-part 다. 기존 문서에 자식이 없으므로 Canvas 는 **합성 노드**로 그린다
 * (Checkbox/Radio/Switch 의 synthetic Label 선례) — 문서 migration 없음.
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

const LABEL = "Name";
const DESCRIPTION = "Helper text";

interface Box {
  w: number;
  h: number;
  y: number;
}
interface Leg {
  root: Box;
  desc: Box | null;
  descFontSize: number | null;
}

const dom = new Map<FieldType, Leg>();
const domNoDesc = new Map<FieldType, Leg>();
const canvas = new Map<FieldType, Leg>();
const canvasNoDesc = new Map<FieldType, Leg>();
let host: HTMLElement | undefined;
const roots: Root[] = [];

function rect(el: HTMLElement | null, rootTop: number): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, y: r.top - rootTop };
}

async function renderDom(type: FieldType, withDesc: boolean): Promise<Leg> {
  const mount = document.createElement("div");
  mount.style.cssText = "width:400px;";
  host!.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(
      React.createElement(SHARED[type], {
        label: LABEL,
        ...(withDesc ? { description: DESCRIPTION } : {}),
      }),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const root = mount.firstElementChild as HTMLElement | null;
  if (!root) throw new Error(`${type}: DOM root 없음`);
  const rootRect = root.getBoundingClientRect();
  const descEl = mount.querySelector<HTMLElement>('[slot="description"]');
  return {
    root: { w: rootRect.width, h: rootRect.height, y: 0 },
    desc: rect(descEl, rootRect.top),
    descFontSize: descEl ? parseFloat(getComputedStyle(descEl).fontSize) : null,
  };
}

/** Canvas production 트리 — root props 에 label(+description) 만 얹는다 (자식은 factory 그대로). */
async function runCanvas(type: FieldType, withDesc: boolean): Promise<Leg> {
  const tree = await paletteCreationTree(type, `fd-desc-${type}`);
  const els = tree.elements.map((el) =>
    el.id === tree.root.id
      ? ({
          ...el,
          props: {
            ...el.props,
            label: LABEL,
            ...(withDesc ? { description: DESCRIPTION } : {}),
          },
        } as Element)
      : el,
  );
  const run = layoutTree(tree.root.id, els, 400, -1, `desc-${type}`);
  const rootBox = run.layout.get(tree.root.id);
  // 합성 description 노드 id 는 `${parentId}__syndesc` (implicitStyles).
  const descBox = run.layout.get(`${tree.root.id}__syndesc`);
  return {
    root: { w: rootBox?.width ?? 0, h: rootBox?.height ?? 0, y: 0 },
    desc: descBox
      ? { w: descBox.width, h: descBox.height, y: descBox.y }
      : null,
    descFontSize: null,
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  const style = document.createElement("style");
  style.id = "adr923-field-desc-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  // Preview iframe 의 전역 reset — production 과 같은 문자열.
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  for (const type of FIELD_TYPES) {
    dom.set(type, await renderDom(type, true));
    domNoDesc.set(type, await renderDom(type, false));
    canvas.set(type, await runCanvas(type, true));
    canvasNoDesc.set(type, await runCanvas(type, false));
  }
});

afterAll(async () => {
  for (const r of roots) r.unmount();
  host?.remove();
  document.getElementById("adr923-field-desc-bundle")?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr923-field-description-axis.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        rows: FIELD_TYPES.map((t) => ({
          type: t,
          dom: dom.get(t),
          domNoDesc: domNoDesc.get(t),
          canvas: canvas.get(t),
          canvasNoDesc: canvasNoDesc.get(t),
        })),
      },
      null,
      2,
    ),
  );
});

describe("ADR-923 — field description 축 (parent 소유 read-only sub-part)", () => {
  it("캡처 — 5 field 양쪽 leg", () => {
    for (const t of FIELD_TYPES) {
      const d = dom.get(t)!;
      const c = canvas.get(t)!;
      console.log(
        `ADR923DESC ${t} dom root=${d.root.h} desc=${d.desc ? `${d.desc.w}x${d.desc.h}@${d.desc.y} fs=${d.descFontSize}` : "없음"} | canvas root=${c.root.h} desc=${c.desc ? `${c.desc.w}x${c.desc.h}@${c.desc.y}` : "없음"}`,
      );
    }
    expect(dom.size).toBe(FIELD_TYPES.length);
  });

  it("DOM 은 parent description 으로 한 줄을 그린다 (전제 확인)", () => {
    for (const t of FIELD_TYPES) {
      expect(dom.get(t)!.desc, `${t} DOM description 상자`).not.toBeNull();
      expect(domNoDesc.get(t)!.desc, `${t} description 없을 때`).toBeNull();
      expect(
        dom.get(t)!.root.h,
        `${t} DOM root 높이 (description 유무)`,
      ).toBeGreaterThan(domNoDesc.get(t)!.root.h);
    }
  });

  it("Canvas 도 같은 줄을 그린다 — 상자와 root 높이가 DOM 과 1px 안", () => {
    for (const t of FIELD_TYPES) {
      const d = dom.get(t)!;
      const c = canvas.get(t)!;
      expect(c.desc, `${t} Canvas description 상자`).not.toBeNull();
      expect(
        Math.abs(c.desc!.h - d.desc!.h),
        `${t} description Δh (canvas ${c.desc!.h} vs dom ${d.desc!.h})`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(c.desc!.y - d.desc!.y),
        `${t} description Δy (canvas ${c.desc!.y} vs dom ${d.desc!.y})`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(c.root.h - d.root.h),
        `${t} root Δh (canvas ${c.root.h} vs dom ${d.root.h})`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("description 이 없으면 Canvas 도 줄을 만들지 않는다 (대조군)", () => {
    for (const t of FIELD_TYPES) {
      expect(
        canvasNoDesc.get(t)!.desc,
        `${t} description 없을 때 Canvas 상자`,
      ).toBeNull();
      expect(
        Math.abs(canvasNoDesc.get(t)!.root.h - domNoDesc.get(t)!.root.h),
        `${t} root Δh (description 없음)`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
