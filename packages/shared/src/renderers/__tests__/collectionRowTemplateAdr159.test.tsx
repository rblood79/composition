/**
 * ADR-159 P3 — DOM renderer 행 텍스트 `{field}` 템플릿 (Skia projection 대칭).
 *
 * G2: 보간은 shared fieldTemplate 단일 resolver 경유 (구 ad-hoc resolveTemplateText 제거).
 * G3: 토큰 없는 소스는 휴리스틱 fallback — literal 을 행 텍스트로 표시하지 않음 (Skia 동일).
 * precedence(§2-3-1): slot child text > template item props(children/textValue).
 */

import { describe, expect, it } from "vitest";
import React, { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderListBox, renderGridList } from "../SelectionRenderers";

function makeContext(
  children: Map<string, PreviewElement[]>,
  elements: PreviewElement[],
): RenderContext {
  return {
    elements,
    elementsById: new Map(elements.map((el) => [el.id, el])),
    childrenByParent: children,
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

/** renderItemFunction 산출 행에서 slot content fragment 의 텍스트 노드들을 수집. */
function collectRowTexts(row: unknown): string[] {
  const rowChildren = (
    row as {
      props: { children: (s: { isSelected: boolean }) => React.ReactNode };
    }
  ).props.children({ isSelected: false });
  const texts: string[] = [];
  const walk = (node: React.ReactNode): void => {
    if (node == null || typeof node === "boolean") return;
    if (typeof node === "string") {
      texts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (isValidElement(node)) {
      walk((node.props as { children?: React.ReactNode }).children);
    }
  };
  walk(rowChildren);
  return texts;
}

const staticBinding = {
  type: "collection",
  source: "static",
  config: { data: [{ id: "u1", num: 7, name: "Kim", email: "kim@x.io" }] },
} as PreviewElement["dataBinding"];

describe("ADR-159 P3 — renderListBox 행 템플릿", () => {
  it("slot child text {num} 이 item children {name} 을 supersede (precedence 1)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: staticBinding,
      props: {},
    };
    const anchor: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: { children: "{name}" },
      parent_id: "listbox",
    };
    const slotLabel: PreviewElement = {
      id: "slot-label",
      type: "Text",
      props: { slot: "label", children: "No.{num}" },
      parent_id: "template-anchor",
    };
    const ctx = makeContext(
      new Map([
        ["listbox", [anchor]],
        ["template-anchor", [slotLabel]],
      ]),
      [listBox, anchor, slotLabel],
    );
    const rendered = renderListBox(listBox, ctx);
    const renderFn = (rendered as { props: { children: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    expect(typeof renderFn).toBe("function");
    const texts = collectRowTexts(
      renderFn({ id: "u1", num: 7, name: "Kim", email: "kim@x.io" }),
    );
    expect(texts).toContain("No.7");
    expect(texts).not.toContain("Kim");
  });

  it("item-level children 템플릿 (slot 자식 없음) — flat 커버리지 (§2-3-1)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: staticBinding,
      props: {},
    };
    const anchor: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: { children: "{num} — {email}" },
      parent_id: "listbox",
    };
    const ctx = makeContext(new Map([["listbox", [anchor]]]), [
      listBox,
      anchor,
    ]);
    const rendered = renderListBox(listBox, ctx);
    const renderFn = (rendered as { props: { children: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    const texts = collectRowTexts(
      renderFn({ id: "u1", num: 7, name: "Kim", email: "kim@x.io" }),
    );
    expect(texts).toContain("7 — kim@x.io");
  });

  it("토큰 없는 템플릿 → 휴리스틱 label (literal 미표시 — G3, Skia 대칭)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: staticBinding,
      props: {},
    };
    const anchor: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: { children: "Static Label" },
      parent_id: "listbox",
    };
    const ctx = makeContext(new Map([["listbox", [anchor]]]), [
      listBox,
      anchor,
    ]);
    const rendered = renderListBox(listBox, ctx);
    const renderFn = (rendered as { props: { children: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    const texts = collectRowTexts(
      renderFn({ id: "u1", num: 7, name: "Kim", email: "kim@x.io" }),
    );
    expect(texts).toContain("Kim");
    expect(texts).not.toContain("Static Label");
  });

  it("seed 템플릿 {label} → 가상 필드로 휴리스틱과 동일 (BC)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: staticBinding,
      props: {},
    };
    const anchor: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: { children: "{label}", description: "{description}" },
      parent_id: "listbox",
    };
    const ctx = makeContext(new Map([["listbox", [anchor]]]), [
      listBox,
      anchor,
    ]);
    const rendered = renderListBox(listBox, ctx);
    const renderFn = (rendered as { props: { children: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    // label 필드 없는 행 → 가상 필드 label = 휴리스틱(name).
    const texts = collectRowTexts(
      renderFn({ id: "u1", num: 7, name: "Kim", email: "kim@x.io" }),
    );
    expect(texts).toContain("Kim");
  });
});

describe("ADR-159 P3 — renderGridList 카드 템플릿", () => {
  it("템플릿 모드에서 행 데이터 보간 (구 literal props.label 반복 표시 제거)", () => {
    const gridList: PreviewElement = {
      id: "gridlist",
      type: "GridList",
      // isPropertyBinding 형식 (source+name, no type) → hasValidTemplate 경로.
      dataBinding: {
        source: "dataTable",
        name: "users",
      } as unknown as PreviewElement["dataBinding"],
      props: {},
    };
    const template: PreviewElement = {
      id: "gl-template",
      type: "GridListItem",
      props: {},
      parent_id: "gridlist",
    };
    const slotLabel: PreviewElement = {
      id: "gl-slot-label",
      type: "Text",
      props: { slot: "label", children: "#{num} {name}" },
      parent_id: "gl-template",
    };
    const ctx = makeContext(
      new Map([
        ["gridlist", [template]],
        ["gl-template", [slotLabel]],
      ]),
      [gridList, template, slotLabel],
    );
    const rendered = renderGridList(gridList, ctx);
    const renderFn = (rendered as { props: { children: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    expect(typeof renderFn).toBe("function");
    const card = renderFn({ id: "u1", num: 7, name: "Kim" });
    const cardChildren = (card as { props: { children: React.ReactNode } })
      .props.children;
    const texts: string[] = [];
    const walk = (node: React.ReactNode): void => {
      if (node == null || typeof node === "boolean") return;
      if (typeof node === "string") {
        texts.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (isValidElement(node)) {
        walk((node.props as { children?: React.ReactNode }).children);
      }
    };
    walk(cardChildren);
    expect(texts).toContain("#7 Kim");
  });
});
