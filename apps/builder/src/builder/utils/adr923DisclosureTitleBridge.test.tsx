import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreviewElement, RenderContext } from "@composition/shared";
import { rendererMap } from "@composition/shared/renderers";

import { resolvePropagatedProps } from "./propagationEngine";
import { getPropagationRules } from "./propagationRegistry";

/**
 * ADR-923 r18m1 (2026-09-01) — Disclosure parent `title` 은 propagation registry 가 헤더 자식
 * `children` 으로 잇는 다리 (Card `title → CardHeader.Heading.children` · round 16 ColorField label
 * 다리 동형). 종전엔 규칙이 없어 binding 이 D2 편집 surface 로 선언한 Inspector Title 이 어느
 * 표면에도 닿지 않았고, 헤더 없는 legacy 형태에선 Preview 만 parent title 을 읽었다. 세 표면 (Preview
 * · Skia/레이아웃 `resolvePropagatedProps` · Inspector `buildPropagationUpdates`) 이 같은 registry 와
 * 같은 경계 (parent `undefined` 만 자식, `""` 는 비움) 를 쓴다.
 */
function previewContext(children: PreviewElement[]): RenderContext {
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

const header = (parentId: string, children: string): PreviewElement =>
  ({
    id: `${parentId}-hdr`,
    type: "DisclosureHeader",
    parent_id: parentId,
    props: { children },
  }) as unknown as PreviewElement;

describe("ADR-923 r18m1 — Disclosure title 다리", () => {
  it("registry: `title → DisclosureHeader.children` override (Card 동형)", () => {
    const rules = getPropagationRules("Disclosure") ?? [];
    expect(rules).toContainEqual({
      parentProp: "title",
      childPath: "DisclosureHeader",
      childProp: "children",
      override: true,
    });
  });

  it("engine (Skia·레이아웃): parent title 이 헤더 children 을 override, '' 도 override, undefined 는 skip", () => {
    expect(
      resolvePropagatedProps(
        "Disclosure",
        { title: "Changed" },
        "DisclosureHeader",
        {
          children: "Section Title",
        },
      )?.children,
    ).toBe("Changed");
    expect(
      resolvePropagatedProps("Disclosure", { title: "" }, "DisclosureHeader", {
        children: "Section Title",
      })?.children,
    ).toBe("");
    expect(
      resolvePropagatedProps("Disclosure", {}, "DisclosureHeader", {
        children: "Section Title",
      })?.children,
    ).toBeUndefined();
  });

  it("Preview: parent title 우선 · '' 는 비움 (stale 헤더로 되살리지 않음) · undefined 는 헤더 자식", () => {
    const changed = {
      id: "d1",
      type: "Disclosure",
      props: { title: "Changed" },
    } as unknown as PreviewElement;
    const r1 = render(
      <>
        {rendererMap.Disclosure!(
          changed,
          previewContext([header("d1", "Section Title")]),
        )}
      </>,
    );
    expect(r1.container.textContent).toContain("Changed");
    expect(r1.container.textContent).not.toContain("Section Title");

    const emptied = {
      id: "d2",
      type: "Disclosure",
      props: { title: "" },
    } as unknown as PreviewElement;
    const r2 = render(
      <>
        {rendererMap.Disclosure!(
          emptied,
          previewContext([header("d2", "Stale")]),
        )}
      </>,
    );
    expect(r2.container.textContent).not.toContain("Stale");
    expect(r2.container.textContent).not.toContain("Section");

    const legacy = {
      id: "d3",
      type: "Disclosure",
      props: {},
    } as unknown as PreviewElement;
    const r3 = render(
      <>
        {rendererMap.Disclosure!(
          legacy,
          previewContext([header("d3", "Own Header")]),
        )}
      </>,
    );
    expect(r3.container.textContent).toContain("Own Header");
  });
});
