import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";
import type { RenderContext } from "../../types/index";

/**
 * 2026-09-24 Compare Mode 실측 — CheckboxGroup origin 의 두 Checkbox (같은 `component-checkbox` origin 의 instance)
 * 가 Preview 에서 둘 다 "Option 2" 를 그렸다.
 *
 * 해석 노드 id 는 instance 안에서 로컬이라 두 항목의 Label 이 같은 id (`component-checkbox__1`) 다. delegating
 * 렌더 경로의 `recursiveRenderElement` 가 요소를 id map 으로 해석 노드에 되돌려 마지막 Label 로 덮였다. 불변식:
 * 같은 origin 의 instance 형제가 있어도 각 항목은 자기 Label 을 그린다.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderedTexts(
  document: CompositionDocument,
  hostId: string,
  selector: string,
): string[] {
  const node = findResolved(
    resolveCanonicalDocument(document) as ResolvedNode[],
    hostId,
  )!;
  const { container } = render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
  const texts = Array.from(container.querySelectorAll(selector)).map(
    (el) => el.textContent?.trim() ?? "",
  );
  cleanup();
  return texts;
}

describe("delegating Preview 렌더 — 같은 origin instance 형제의 로컬 id 중복", () => {
  it("CheckboxGroup origin — 두 Checkbox 가 각자 Label 을 그린다", () => {
    const document = seedDocument();
    // 전제 확인: 두 항목의 Label 해석 id 가 같다 (로컬 id).
    const group = findResolved(
      resolveCanonicalDocument(document) as ResolvedNode[],
      "component-checkboxgroup",
    )!;
    const labelIds = (group.children ?? [])
      .filter((child: CanonicalNode) => child.type === "Checkbox")
      .map((child) => child.children?.[0]?.id);
    expect(new Set(labelIds).size).toBe(1);

    expect(
      renderedTexts(
        document,
        "component-checkboxgroup",
        ".react-aria-Checkbox",
      ),
    ).toEqual(["Option 1", "Option 2"]);
  });

  it("RadioGroup origin — 두 Radio 가 각자 Label 을 그린다", () => {
    expect(
      renderedTexts(
        seedDocument(),
        "component-radiogroup",
        ".react-aria-Radio",
      ),
    ).toEqual(["Option 1", "Option 2"]);
  });
});
