import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PreviewElement, RenderContext } from "@composition/shared";
import { rendererMap } from "@composition/shared/renderers";

import * as DataDefs from "../factories/definitions/DataComponents";
import * as DateColorDefs from "../factories/definitions/DateColorComponents";
import * as DisplayDefs from "../factories/definitions/DisplayComponents";
import * as FormDefs from "../factories/definitions/FormComponents";
import * as GroupDefs from "../factories/definitions/GroupComponents";
import * as LayoutDefs from "../factories/definitions/LayoutComponents";
import * as NavigationDefs from "../factories/definitions/NavigationComponents";
import * as OverlayDefs from "../factories/definitions/OverlayComponents";
import * as SelectionDefs from "../factories/definitions/SelectionComponents";
import type {
  ComponentCreationContext,
  ComponentDefinition,
} from "../factories/types";
import { resolvePropagatedProps } from "./propagationEngine";
import { getPropagationRules } from "./propagationRegistry";

/**
 * ADR-923 Phase 3 r16m1 — composite parent 의 `label` 은 텍스트 원천 계약 (`resolveTextSourceText`,
 * 노드 자기 텍스트) 이 아니라 **propagation registry 가 canonical Label 자식으로 잇는 다리** 다:
 * Preview 는 parent props 로 RAC 를 self-compose (`renderColorField` `label={element.props.label}`),
 * Skia (`applyParentPropagationProps`) · 레이아웃 (`resolvePropagatedProps`) · Inspector store 쓰기
 * (`buildPropagationUpdates`) 는 registry 의 `label → Label.children (override)` 로 자식을 patch 한다.
 * ColorField 만 이 규칙이 없었고 (spec 시절부터 size 만) factory parent 에 `label` 도 없어 —
 * Inspector/AI 가 parent `label` 을 쓰면 Preview "Changed Color" / Skia·레이아웃 "Color" (Codex r16m1).
 *
 * 게이트는 특정 타입이 아니라 **factory 가 직접 Label 자식 (문자열 children) 을 만드는 모든 가족** 을
 * sweep 한다: (i) registry 에 `→ Label.children` 규칙 존재 (ii) 생성 시점 parent SSOT 값 == Label
 * 자식 텍스트 (iii) parent 변경이 자식에 도달 (Skia·레이아웃이 쓰는 `resolvePropagatedProps`).
 */
const ctx = {
  parentElement: null,
  pageId: "page-test",
  elements: [],
  layoutId: null,
  doc: undefined,
} as unknown as ComponentCreationContext;

type DefinitionFactory = (
  context: ComponentCreationContext,
) => ComponentDefinition;

function collectDefinitions(): Array<{
  name: string;
  def: ComponentDefinition;
}> {
  const modules: Record<string, unknown>[] = [
    DataDefs,
    DateColorDefs,
    DisplayDefs,
    FormDefs,
    GroupDefs,
    LayoutDefs,
    NavigationDefs,
    OverlayDefs,
    SelectionDefs,
  ];
  const out: Array<{ name: string; def: ComponentDefinition }> = [];
  for (const mod of modules) {
    for (const [name, value] of Object.entries(mod)) {
      if (!/^create\w+Definition$/.test(name) || typeof value !== "function") {
        continue;
      }
      out.push({ name, def: (value as DefinitionFactory)(ctx) });
    }
  }
  return out;
}

function labelChildText(def: ComponentDefinition): string | undefined {
  const label = def.children?.find((c) => c.type === "Label");
  const text = (label?.props as Record<string, unknown> | undefined)?.children;
  return typeof text === "string" && text !== "" ? text : undefined;
}

describe("ADR-923 r16m1 — composite parent label ↔ canonical Label 자식 다리 (factory sweep)", () => {
  const withLabel = collectDefinitions().filter(
    ({ def }) => labelChildText(def) !== undefined,
  );

  it("sweep 대상 = 직접 Label 자식 (문자열 children) 을 만드는 factory 20 가족 (정확한 집합 — 문서 수치와 동일, r17l1)", () => {
    expect([...new Set(withLabel.map(({ def }) => def.type))].sort()).toEqual([
      "Checkbox",
      "CheckboxGroup",
      "ColorField",
      "ComboBox",
      "DateField",
      "DatePicker",
      "DateRangePicker",
      "Meter",
      "NumberField",
      "ProgressBar",
      "Radio",
      "RadioGroup",
      "SearchField",
      "Select",
      "Slider",
      "Switch",
      "TagGroup",
      "TextArea",
      "TextField",
      "TimeField",
    ]);
  });

  it("모든 가족: registry `→ Label.children` 규칙 + 생성 시 parent SSOT == Label 텍스트 + 변경 도달", () => {
    const failures: string[] = [];
    for (const { def } of withLabel) {
      const type = def.type;
      const childText = labelChildText(def)!;
      const rule = (getPropagationRules(type) ?? []).find(
        (r) =>
          r.childPath === "Label" &&
          r.childProp === "children" &&
          typeof r.parentProp === "string",
      );
      if (!rule) {
        failures.push(`${type}: registry 에 → Label.children 규칙 없음`);
        continue;
      }
      if (rule.override !== true) {
        failures.push(
          `${type}: ${rule.parentProp} → Label.children 이 override 아님`,
        );
      }
      const parentValue = (def.parent.props as Record<string, unknown>)[
        rule.parentProp!
      ];
      if (parentValue !== childText) {
        failures.push(
          `${type}: factory parent.${rule.parentProp} (${JSON.stringify(parentValue)}) ≠ Label 자식 (${JSON.stringify(childText)})`,
        );
      }
      const patch = resolvePropagatedProps(
        type,
        { [rule.parentProp!]: "Changed" },
        "Label",
        { children: childText },
      );
      if (patch?.children !== "Changed") {
        failures.push(
          `${type}: parent ${rule.parentProp} 변경이 Label 자식에 도달하지 않음 (${JSON.stringify(patch)})`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});

/**
 * Codex r16m1 반례 그대로 — ColorField `{label: "Changed Color"}` 를 Preview (RAC self-compose DOM) 와
 * Skia·레이아웃 (`resolvePropagatedProps` 가 factory Label 자식 "Color" 에 준 patch) 에 넣어 같은
 * 텍스트인지.
 */
describe("ADR-923 r16m1 — ColorField label: Preview DOM == Skia·레이아웃 Label 자식", () => {
  function previewContext(children: PreviewElement[] = []): RenderContext {
    const byParent = new Map<string, PreviewElement[]>();
    for (const c of children) {
      if (!c.parent_id) continue;
      byParent.set(c.parent_id, [...(byParent.get(c.parent_id) ?? []), c]);
    }
    return {
      elements: children,
      elementsById: new Map(children.map((c) => [c.id, c])),
      childrenByParent: byParent,
      updateElementProps: () => {},
      batchUpdateElementProps: () => {},
      setElements: () => {},
      renderElement: () => null,
    } as unknown as RenderContext;
  }
  const renderColorField = rendererMap.ColorField!;
  it("Inspector/AI 가 parent label 을 바꾸면 세 표면이 같은 글자", () => {
    const props = { label: "Changed Color", labelPosition: "top" };
    const element = {
      id: "cf-1",
      type: "ColorField",
      props,
    } as unknown as PreviewElement;
    const { container } = render(
      <>{renderColorField(element, previewContext())}</>,
    );
    const previewLabel = container.querySelector("label")?.textContent ?? "";
    expect(previewLabel).toContain("Changed Color");

    const factoryLabel = labelChildText(
      DateColorDefs.createColorFieldDefinition(ctx),
    );
    const patch = resolvePropagatedProps("ColorField", props, "Label", {
      children: factoryLabel,
    });
    expect(patch?.children).toBe("Changed Color");
  });
  it("생성 시점: factory parent label 이 있어 Preview 도 Label 자식과 같은 'Color' 를 보인다", () => {
    const def = DateColorDefs.createColorFieldDefinition(ctx);
    const parentProps = def.parent.props as Record<string, unknown>;
    expect(parentProps.label).toBe(labelChildText(def));
    const element = {
      id: "cf-2",
      type: "ColorField",
      props: parentProps,
    } as unknown as PreviewElement;
    const { container } = render(
      <>{renderColorField(element, previewContext())}</>,
    );
    expect(container.querySelector("label")?.textContent ?? "").toContain(
      "Color",
    );
  });
  it("CheckboxGroup/RadioGroup: parent label 우선 (propagation 방향) — Label 자식은 legacy 폴백", () => {
    for (const type of ["CheckboxGroup", "RadioGroup"]) {
      const parent = {
        id: `${type}-1`,
        type,
        props: { label: "Changed Group" },
      } as unknown as PreviewElement;
      const staleLabel = {
        id: `${type}-1-label`,
        type: "Label",
        parent_id: parent.id,
        props: { children: "Checkbox Group" },
      } as unknown as PreviewElement;
      const { container } = render(
        <>{rendererMap[type]!(parent, previewContext([staleLabel]))}</>,
      );
      expect(container.textContent).toContain("Changed Group");
      expect(container.textContent).not.toContain("Checkbox Group");
      const patch = resolvePropagatedProps(type, parent.props, "Label", {
        children: "Checkbox Group",
      });
      expect(patch?.children).toBe("Changed Group");

      // legacy: parent label 없음 → Label 자식 텍스트
      const legacy = { ...parent, props: {} } as unknown as PreviewElement;
      const legacyRender = render(
        <>{rendererMap[type]!(legacy, previewContext([staleLabel]))}</>,
      );
      expect(legacyRender.container.textContent).toContain("Checkbox Group");
    }
  });
  it('r17m1: parent `label: ""` 는 비움 — Preview 가 stale Label 자식으로 되살리지 않고 Skia·레이아웃도 "" 를 자식에 override', () => {
    for (const type of ["CheckboxGroup", "RadioGroup"]) {
      const parent = {
        id: `${type}-e`,
        type,
        props: { label: "" },
      } as unknown as PreviewElement;
      const staleLabel = {
        id: `${type}-e-label`,
        type: "Label",
        parent_id: parent.id,
        props: { children: "Stale Group" },
      } as unknown as PreviewElement;
      const { container } = render(
        <>{rendererMap[type]!(parent, previewContext([staleLabel]))}</>,
      );
      expect(container.textContent).not.toContain("Stale Group");
      const patch = resolvePropagatedProps(type, parent.props, "Label", {
        children: "Stale Group",
      });
      expect(patch?.children).toBe("");
    }
  });
});
