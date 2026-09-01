import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { migrateColorFieldParentLabel } from "../colorFieldParentLabelMigration";

/**
 * ADR-923 r16m1 (2026-09-01) — 기존 문서의 ColorField parent `label` 보충 가드.
 * factory 가 parent label 없이 Label 자식 "Color" 만 만들던 문서는 Preview 무라벨 / Skia "Color" 였다.
 * migration 은 parent label 이 없을 때만 Label 자식 텍스트로 채우고, 있으면(빈 문자열 포함) 보존한다.
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

const legacyColorField = (id = "cf") =>
  node("ColorField", id, { labelPosition: "top" }, [
    node("Label", `${id}-label`, { children: "Color" }),
    node("Input", `${id}-input`, { placeholder: "#000000" }),
  ]);

describe("migrateColorFieldParentLabel", () => {
  it("parent label 이 없으면 Label 자식 텍스트로 채운다 (중첩 포함)", () => {
    const input = doc([
      node("body", "body", {}, [node("Frame", "f", {}, [legacyColorField()])]),
    ]);
    const out = migrateColorFieldParentLabel(input);
    expect(out).not.toBe(input);
    const cf = findNode(out.children, (n) => n.id === "cf")!;
    expect(cf.props).toEqual({ labelPosition: "top", label: "Color" });
    // 자식은 그대로
    expect(findNode(out.children, (n) => n.id === "cf-label")!.props).toEqual({
      children: "Color",
    });
  });
  it("parent label 이 있으면 보존 (사용자가 비운 빈 문자열 포함) — 멱등", () => {
    const kept = doc([
      node("ColorField", "a", { label: "Brand" }, [
        node("Label", "a-l", { children: "Color" }),
      ]),
      node("ColorField", "b", { label: "" }, [
        node("Label", "b-l", { children: "Color" }),
      ]),
    ]);
    expect(migrateColorFieldParentLabel(kept)).toBe(kept);
    const once = migrateColorFieldParentLabel(doc([legacyColorField()]));
    expect(migrateColorFieldParentLabel(once)).toBe(once);
  });
  it("Label 자식이 없거나 비었으면 채우지 않는다; 다른 type 은 대상 아님", () => {
    const untouched = doc([
      node("ColorField", "x", {}, [node("Input", "x-i", {})]),
      node("ColorField", "y", {}, [node("Label", "y-l", { children: "" })]),
      node("TextField", "t", {}, [node("Label", "t-l", { children: "Text" })]),
    ]);
    expect(migrateColorFieldParentLabel(untouched)).toBe(untouched);
  });
});
