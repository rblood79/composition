import { describe, expect, it } from "vitest";
import React, { isValidElement } from "react";

import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderDatePicker } from "../DateRenderers";
import {
  renderCheckboxGroup,
  renderRadioGroup,
  renderSearchField,
} from "../FormRenderers";
import {
  renderDisclosure,
  renderMeter,
  renderProgressBar,
} from "../LayoutRenderers";
import { renderComboBox } from "../SelectionRenderers";
import { resolvePropagatedText } from "../utils/propagatedLabel";

/**
 * ADR-923 r17m1·r17m3 — composite parent 의 propagation 대상 텍스트를 Preview 가 engine 과 같은 경계로
 * 읽는지 (undefined 만 자식 폴백, "" 는 비움) · Disclosure 가 헤더 자식 텍스트를 계약으로 읽는지.
 * 렌더러 반환 element 트리에서 첫 `label`/`title` prop 을 찾아 단언 (RAC DOM 렌더 불요).
 */
function makeContext(children: PreviewElement[] = []): RenderContext {
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
  };
}

function findProp(node: React.ReactNode, key: string): unknown {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      for (const n of node) {
        const v = findProp(n, key);
        if (v !== undefined) return v;
      }
    }
    return undefined;
  }
  const props = node.props as Record<string, unknown>;
  if (key in props) return props[key];
  return findProp(props.children as React.ReactNode, key);
}

const el = (
  type: string,
  props: Record<string, unknown>,
  id = `${type}-1`,
  parent_id?: string,
): PreviewElement =>
  ({ id, type, props, parent_id }) as unknown as PreviewElement;

describe("resolvePropagatedText — propagation engine 과 같은 경계", () => {
  it('parent 가 undefined 가 아니면 그대로 ("" 포함, 배열은 이어붙임), undefined 면 자식 계약, 없으면 fallback', () => {
    const child = { type: "Label", props: { children: "Stale" } };
    expect(resolvePropagatedText("Changed", child)).toBe("Changed");
    expect(resolvePropagatedText("", child)).toBe("");
    expect(resolvePropagatedText(null, child)).toBe("");
    expect(resolvePropagatedText(["a", "b"], child)).toBe("ab");
    expect(resolvePropagatedText(undefined, child)).toBe("Stale");
    expect(resolvePropagatedText(undefined, undefined, "Date Picker")).toBe(
      "Date Picker",
    );
    expect(resolvePropagatedText(undefined, undefined)).toBe("");
  });
});

describe('ADR-923 r17m1 — composite renderer 의 label = parent 우선, "" 는 비움', () => {
  const cases: Array<
    [string, (e: PreviewElement, c: RenderContext) => React.ReactNode]
  > = [
    ["CheckboxGroup", renderCheckboxGroup],
    ["RadioGroup", renderRadioGroup],
    ["SearchField", renderSearchField],
    ["ProgressBar", renderProgressBar],
    ["Meter", renderMeter],
    ["ComboBox", renderComboBox],
    ["DatePicker", renderDatePicker],
  ];
  for (const [type, render] of cases) {
    it(`${type}: parent "Changed" 가 stale 자식을 이기고, parent "" 는 stale 자식으로 되살아나지 않는다`, () => {
      const parent = el(type, { label: "Changed" });
      const stale = el(
        "Label",
        { children: "Stale" },
        `${type}-label`,
        parent.id,
      );
      expect(findProp(render(parent, makeContext([stale])), "label")).toBe(
        "Changed",
      );
      const emptied = el(type, { label: "" });
      const emptiedLabel = findProp(
        render(emptied, makeContext([stale])),
        "label",
      );
      expect(emptiedLabel === "" || emptiedLabel === undefined).toBe(true);
      // legacy: parent 부재 → 자식 텍스트
      const legacy = el(type, {});
      expect(findProp(render(legacy, makeContext([stale])), "label")).toBe(
        "Stale",
      );
    });
  }
});

describe("ADR-923 r17m3 — Disclosure 제목 = 헤더 자식의 텍스트 원천 계약", () => {
  it("헤더 `{children}` 은 그대로, AI `{title}` 만 있는 헤더는 계약상 내용 없음 → 'Section'", () => {
    const disclosure = el("Disclosure", {});
    const header = el(
      "DisclosureHeader",
      { children: "Hdr" },
      "hdr",
      disclosure.id,
    );
    expect(
      findProp(renderDisclosure(disclosure, makeContext([header])), "title"),
    ).toBe("Hdr");
    const aiHeader = el(
      "DisclosureHeader",
      { title: "AI Title" },
      "hdr2",
      disclosure.id,
    );
    expect(
      findProp(renderDisclosure(disclosure, makeContext([aiHeader])), "title"),
    ).toBe("Section");
  });
});
