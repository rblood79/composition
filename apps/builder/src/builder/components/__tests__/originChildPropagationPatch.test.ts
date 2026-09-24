import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { repairOriginChildPropagationPatches } from "../originChildRefs";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";

/**
 * 2026-09-24 Compare Mode 실측 — 그룹 origin 의 상속 항목 라벨이 Preview "Checkbox"/"Radio" vs Canvas
 * "Option 1"/"Option 2".
 *
 * 조합 origin 자식 ref seed (`convertToRef`) 가 root `children` → Label 전파를 "전파로 설명되는 차이" 로 보고
 * descendants patch 를 뺐다. 해소기는 전파를 다시 걸지 않아 해석된 Label = origin 값 ("Checkbox") 이고, Preview
 * 는 그 자식을 그린다 (Canvas 는 read-time 전파로 root 값). 불변식: sub-part 가 아닌 자식의 전파값은 patch 로
 * 실려 해석 트리에서 root 값과 같다 — 새 문서 (seed) · 기존 문서 (repair) 모두.
 */

type ResolvedNode = CanonicalNode & { children?: ResolvedNode[] };

afterEach(() => {
  vi.restoreAllMocks();
});

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find<T extends CanonicalNode>(
  nodes: readonly T[],
  id: string,
): T | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find((node.children ?? []) as T[], id);
    if (hit) return hit;
  }
  return undefined;
}

function mapNodes(
  document: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = fn(node);
      return next.children ? { ...next, children: visit(next.children) } : next;
    });
  return { ...document, children: visit(document.children) };
}

const ITEMS = [
  ["component-checkboxgroup__2", "Option 1"],
  ["component-checkboxgroup__3", "Option 2"],
  ["component-radiogroup__2", "Option 1"],
  ["component-radiogroup__3", "Option 2"],
] as const;

function resolvedLabelText(document: CompositionDocument, itemId: string) {
  const resolved = resolveCanonicalDocument(document) as ResolvedNode[];
  const item = find(resolved, itemId);
  const label = item?.children?.find((child) => child.type === "Label");
  return {
    root: (item?.props as { children?: unknown } | undefined)?.children,
    label: (label?.props as { children?: unknown } | undefined)?.children,
  };
}

/** 정정 전 seed 모양 — 항목 ref 의 Label patch 에서 전파값 (`children`) 을 뺀다. */
function stripLabelPatches(document: CompositionDocument): CompositionDocument {
  const ids = new Set<string>(ITEMS.map(([id]) => id));
  return mapNodes(document, (node) => {
    if (!ids.has(node.id)) return node;
    const descendants = (node as { descendants?: Record<string, object> })
      .descendants;
    if (!descendants) return node;
    const next = Object.fromEntries(
      Object.entries(descendants).map(([path, patch]) => {
        const { children: _children, ...rest } = patch as Record<
          string,
          unknown
        >;
        return [path, rest];
      }),
    );
    return { ...node, descendants: next } as CanonicalNode;
  });
}

describe("조합 origin 자식 ref — 전파값 patch (그룹 항목 Label)", () => {
  it("새 문서: 해석된 Label 이 항목 root `children` 과 같다", () => {
    const document = seedDocument();
    for (const [id, text] of ITEMS) {
      expect(resolvedLabelText(document, id)).toEqual({
        root: text,
        label: text,
      });
    }
  });

  it("정정 전 문서 (patch 누락) 는 hydration repair 가 채운다 · 두 번째 pass 는 같은 객체", () => {
    const before = stripLabelPatches(seedDocument());
    // 정정 전 모양이 실제로 발산하는지 (반례 확인) — Label 은 origin 글자.
    expect(resolvedLabelText(before, ITEMS[0][0]).label).toBe("Checkbox");
    expect(resolvedLabelText(before, ITEMS[2][0]).label).toBe("Radio");

    const repaired = ensureReusableCompositeOrigins(before);
    for (const [id, text] of ITEMS) {
      expect(resolvedLabelText(repaired, id)).toEqual({
        root: text,
        label: text,
      });
    }
    expect(repairOriginChildPropagationPatches(repaired)).toBe(repaired);
  });

  it("patch 에 이미 있는 값 (사용자 편집) 은 건드리지 않는다", () => {
    const edited = mapNodes(seedDocument(), (node) =>
      node.id === ITEMS[0][0]
        ? ({
            ...node,
            descendants: { "component-checkbox__1": { children: "Custom" } },
          } as CanonicalNode)
        : node,
    );
    const repaired = repairOriginChildPropagationPatches(edited);
    expect(resolvedLabelText(repaired, ITEMS[0][0]).label).toBe("Custom");
  });
});
