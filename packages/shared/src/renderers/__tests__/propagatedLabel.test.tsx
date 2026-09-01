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
  renderDisclosureHeader,
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

describe("ADR-923 r17m3 → r18m1 — Disclosure 제목 = parent `title` 다리 + 헤더 자식 계약, 기본 글자 없음", () => {
  const titleOf = (parent: PreviewElement, header?: PreviewElement) =>
    findProp(
      renderDisclosure(parent, makeContext(header ? [header] : [])),
      "title",
    );
  it("헤더 `{children}` 은 그대로; AI `{title}` 만 있는 헤더는 계약상 내용 없음 → '' (종전 'Section')", () => {
    const disclosure = el("Disclosure", {});
    expect(
      titleOf(
        disclosure,
        el("DisclosureHeader", { children: "Hdr" }, "hdr", disclosure.id),
      ),
    ).toBe("Hdr");
    expect(
      titleOf(
        disclosure,
        el("DisclosureHeader", { title: "AI Title" }, "hdr2", disclosure.id),
      ),
    ).toBe("");
  });
  it("r18m1: 사용자가 비운 헤더 `{children: ''}` 은 '' — Skia 가 text shape 를 안 그리듯 Preview 도 'Section' 으로 되살리지 않는다", () => {
    const disclosure = el("Disclosure", {});
    expect(
      titleOf(
        disclosure,
        el("DisclosureHeader", { children: "" }, "hdr3", disclosure.id),
      ),
    ).toBe("");
  });
  it("parent `title` 은 헤더 자식보다 우선 (registry 다리 — engine 경계와 동일), '' 는 비움, 헤더 없으면 ''", () => {
    const header = el(
      "DisclosureHeader",
      { children: "Stale" },
      "hdr4",
      "Disclosure-p",
    );
    expect(
      titleOf(el("Disclosure", { title: "Parent" }, "Disclosure-p"), header),
    ).toBe("Parent");
    expect(
      titleOf(el("Disclosure", { title: "" }, "Disclosure-p"), header),
    ).toBe("");
    expect(titleOf(el("Disclosure", { title: "Orphan" }, "Disclosure-p"))).toBe(
      "",
    );
  });
  it("legacy `Heading` 헤더는 registry 대상이 아니라 계약만 (parent title 무시)", () => {
    const heading = el("Heading", { children: "H" }, "h", "Disclosure-p");
    expect(
      titleOf(el("Disclosure", { title: "Parent" }, "Disclosure-p"), heading),
    ).toBe("H");
  });
  it("단독 DisclosureHeader 도 기본 글자 없음", () => {
    expect(
      findProp(
        renderDisclosureHeader(
          el("DisclosureHeader", { children: "" }),
          makeContext(),
        ),
        "children",
      ),
    ).toBe("");
  });
});
