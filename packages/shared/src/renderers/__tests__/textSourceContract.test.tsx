import { describe, expect, it } from "vitest";
import React, { isValidElement } from "react";
import { resolveTextSourceText } from "@composition/specs";

import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderMenu, renderTreeItem } from "../CollectionRenderers";
import {
  renderDescription,
  renderFieldError,
  renderLabel,
} from "../FormRenderers";
import { renderButton, renderDisclosureHeader } from "../LayoutRenderers";
import { renderGridListItem, renderListBoxItem } from "../SelectionRenderers";
import { resolveColumnHeaderLabel } from "../TableRenderer";

/**
 * ADR-923 Phase 3 r15m1 — Preview 렌더러의 텍스트가 타입별 텍스트 원천 계약 (`resolveTextSourceText`,
 * Skia · 레이아웃과 같은 단일 지점) 과 같은지 고정한다. AI `create_element`/`update_element` 는
 * 열린 props 를 검증 없이 병합·저장하므로 (writer 인벤토리가 놓친 경로) 세 표면 중 하나라도 다른
 * 순서를 들고 있으면 그 조합에 도달한다 — round 14 까지 Preview 는 렌더러마다 달랐다 (ListBoxItem
 * `label || children`, Column `children || label`, TreeItem `title || label || value || children`,
 * FieldError `text` 만).
 *
 * 렌더러 반환 React element 트리에서 문자열 leaf 를 모아 비교한다 (RAC item 은 부모 collection
 * context 없이 DOM 렌더가 안 되므로 element 트리 단언).
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

function collectText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return collectText(props.children);
  }
  return "";
}

const el = (
  type: string,
  props: Record<string, unknown>,
  id = `${type}-1`,
): PreviewElement => ({ id, type, props }) as unknown as PreviewElement;

const LONG = "AI wrote a long label into an open props object";

describe("ADR-923 r15m1 — Preview 렌더러 텍스트 = 텍스트 원천 계약 (AI 열린 props 조합)", () => {
  it("ListBoxItem / GridListItem: label → children (collection 데이터 SSOT)", () => {
    for (const [type, render] of [
      ["ListBoxItem", renderListBoxItem],
      ["GridListItem", renderGridListItem],
    ] as const) {
      for (const props of [
        { label: "Aardvark", children: "C" },
        { children: "C" },
        { label: "L", text: "T" },
      ]) {
        const out = collectText(render(el(type, props), makeContext()));
        expect(out, `${type} ${JSON.stringify(props)}`).toBe(
          resolveTextSourceText(type, props),
        );
      }
    }
    expect(
      collectText(
        renderListBoxItem(
          el("ListBoxItem", { label: "Aardvark", children: "C" }),
          makeContext(),
        ),
      ),
    ).toBe("Aardvark");
  });

  it("TreeItem: children 만 — AI title/label/value 는 세 표면 모두 읽지 않는다 (종전 Preview 만 title 우선)", () => {
    const props = { children: "Node 1", title: LONG, label: "L", value: "V" };
    const node = renderTreeItem(el("TreeItem", props), makeContext());
    const title = (node as React.ReactElement<{ title?: string }>).props.title;
    expect(title).toBe(resolveTextSourceText("TreeItem", props));
    expect(title).toBe("Node 1");
    // 계약 밖 키만 있으면 내용 없음 → "" (r18m1: 기본 글자 없음 — Skia 는 "" 면 text 를 안 그린다).
    const only = renderTreeItem(
      el("TreeItem", { title: "T" }, "tree-x"),
      makeContext(),
    );
    expect((only as React.ReactElement<{ title?: string }>).props.title).toBe(
      "",
    );
  });

  it("Column: children 만 — 데이터 컬럼 (label+children 동일 기록) 은 불변, AI label 만 있으면 '' (r18m1 기본 글자 없음)", () => {
    expect(resolveColumnHeaderLabel({ children: "Name", label: "Name" })).toBe(
      "Name",
    );
    expect(resolveColumnHeaderLabel({ children: "Name", label: LONG })).toBe(
      resolveTextSourceText("Column", { children: "Name", label: LONG }),
    );
    expect(resolveColumnHeaderLabel({ label: LONG })).toBe("");
    // inspector 로 children 을 고친 데이터 컬럼: stale label 이 아니라 children (Skia 도 동일).
    expect(
      resolveColumnHeaderLabel({ children: "Edited", label: "Name" }),
    ).toBe("Edited");
  });

  it("Menu: label → children (factory 가 둘 다 쓴다)", () => {
    const props = { label: "Menu", children: "Menu", items: [] };
    const node = renderMenu(el("Menu", props), makeContext());
    expect((node as React.ReactElement<{ label?: string }>).props.label).toBe(
      resolveTextSourceText("Menu", props),
    );
  });

  it("Label / Description / FieldError: children → text (텍스트 leaf 군; FieldError 는 종전 text 만)", () => {
    for (const [type, render] of [
      ["Label", renderLabel],
      ["Description", renderDescription],
      ["FieldError", renderFieldError],
    ] as const) {
      for (const props of [
        { children: "C", text: "T", label: "L" },
        { children: "", text: "T" },
        { text: "Pencil" },
        { children: "Edited", text: "stale" },
      ]) {
        const out = collectText(
          render(el(type, props, `${type}-x`), makeContext()),
        );
        expect(out, `${type} ${JSON.stringify(props)}`).toBe(
          resolveTextSourceText(type, props),
        );
      }
    }
  });

  it("DisclosureHeader / Button: children 만 — AI label/title/text 는 읽지 않는다", () => {
    const dh = { children: "Section 1", title: LONG };
    expect(
      collectText(
        renderDisclosureHeader(el("DisclosureHeader", dh), makeContext()),
      ),
    ).toBe(resolveTextSourceText("DisclosureHeader", dh));
    const btn = { children: "Button", label: LONG, text: "T" };
    expect(collectText(renderButton(el("Button", btn), makeContext()))).toBe(
      resolveTextSourceText("Button", btn),
    );
    expect(collectText(renderButton(el("Button", btn), makeContext()))).toBe(
      "Button",
    );
  });
});
