import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { migrateFieldInlineLayout } from "../fieldInlineLayoutMigration";

/**
 * ADR-913 후속 (2026-06-19) — field family inline display/flexDirection strip migration 가드.
 *
 * 기존 직렬화 프로젝트의 NumberField/SearchField 등은 factory 가 박은 inline
 * display:flex/flexDirection:column 을 보유한다. 이 inline 충돌 값이 labelPosition="side"
 * 전환을 차단(CSS specificity + Skia spread)했다. 본 migration 은 hydration 시점에 field
 * family 의 inline display/flexDirection 을 strip 한다(그 외 inline 보존, 멱등).
 */

function node(
  type: string,
  id: string,
  props: Record<string, unknown> = {},
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    type,
    id,
    props,
    ...(children ? { children } : {}),
  } as CanonicalNode;
}

function doc(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children } as CompositionDocument;
}

function findNode(
  nodes: readonly CanonicalNode[],
  predicate: (n: CanonicalNode) => boolean,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (predicate(n)) return n;
    const found = findNode(n.children ?? [], predicate);
    if (found) return found;
  }
  return undefined;
}

describe("migrateFieldInlineLayout", () => {
  it("NumberField inline display/flexDirection 을 strip (그 외 inline 보존)", () => {
    const input = doc([
      node("NumberField", "nf1", {
        labelPosition: "side",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 4,
        },
      }),
    ]);

    const out = migrateFieldInlineLayout(input);
    const nf = findNode(out.children, (n) => n.id === "nf1");
    const style = (nf?.props as { style?: Record<string, unknown> })?.style;

    expect(style?.display, "display strip").toBeUndefined();
    expect(style?.flexDirection, "flexDirection strip").toBeUndefined();
    // 그 외 inline 보존
    expect(style?.width).toBe("100%");
    expect(style?.gap).toBe(4);
  });

  it("5 field family type 모두 strip 대상 (TextField/TextArea/NumberField/SearchField/ColorField)", () => {
    const input = doc(
      ["TextField", "TextArea", "NumberField", "SearchField", "ColorField"].map(
        (t) =>
          node(t, `${t}-1`, {
            style: { display: "flex", flexDirection: "column", width: "100%" },
          }),
      ),
    );

    const out = migrateFieldInlineLayout(input);
    for (const t of [
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "ColorField",
    ]) {
      const n = findNode(out.children, (x) => x.id === `${t}-1`);
      const style = (n?.props as { style?: Record<string, unknown> })?.style;
      expect(style?.display, `${t} display strip`).toBeUndefined();
      expect(style?.flexDirection, `${t} flexDirection strip`).toBeUndefined();
    }
  });

  it("멱등 — strip 할 게 없으면 동일 참조 반환", () => {
    const clean = doc([
      node("NumberField", "nf1", { style: { width: "100%", gap: 4 } }),
    ]);
    expect(migrateFieldInlineLayout(clean)).toBe(clean);

    // 이미 strip 된 결과를 재실행해도 동일 참조 (2회 멱등)
    const dirty = doc([
      node("NumberField", "nf2", {
        style: { display: "flex", flexDirection: "column", width: "100%" },
      }),
    ]);
    const once = migrateFieldInlineLayout(dirty);
    expect(migrateFieldInlineLayout(once)).toBe(once);
  });

  it("field family 가 아닌 노드의 inline display/flexDirection 은 보존 (오인 strip 방지)", () => {
    const input = doc([
      node("Form", "form1", {
        style: { display: "flex", flexDirection: "column" },
      }),
      node("Button", "btn1", { style: { display: "flex" } }),
    ]);

    const out = migrateFieldInlineLayout(input);
    // field family 아님 → 변경 없음 → 동일 참조
    expect(out).toBe(input);
  });

  it("중첩된 field family 도 strip (DFS)", () => {
    const input = doc([
      node("body", "root", {}, [
        node("Form", "form1", {}, [
          node("NumberField", "nf-nested", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
          }),
        ]),
      ]),
    ]);

    const out = migrateFieldInlineLayout(input);
    const nf = findNode(out.children, (n) => n.id === "nf-nested");
    const style = (nf?.props as { style?: Record<string, unknown> })?.style;
    expect(style?.display).toBeUndefined();
    expect(style?.flexDirection).toBeUndefined();
    expect(style?.gap).toBe(4);
  });
});
