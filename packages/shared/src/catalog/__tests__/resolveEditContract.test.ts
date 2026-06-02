import { describe, expect, it } from "vitest";

import {
  resolveEditContract,
  UNIVERSAL_STYLE_CONTRACTS,
} from "../resolvers/resolveEditContract";
import { getCatalogEntry } from "../componentCatalog";
import type { CanonicalNode } from "../../types/composition-document.types";

/**
 * ADR-912 1A-(4) — resolveEditContract 단일 진입점 증명 (G-slice 일부 + 계약 단위).
 *
 * 검증 축:
 * - (A) semantic source = getCatalogEntry(type).binding.props.accepts (Button)
 * - (B) universal style source = UNIVERSAL_STYLE_CONTRACTS (모든 노드 공유, 분기 0)
 * - origin discriminant = write 라우팅 단일 진실 (semantic / style)
 * - isOverridden / currentValue 우선순위 (override ?? base)
 * - section 필터로 Properties view / Style view 분리 (HC#2 두 view 단일 호출)
 */
describe("resolveEditContract — semantic ∪ universal style (ADR-912 1A-(4))", () => {
  const node = (props: Record<string, unknown>): CanonicalNode => ({
    id: "n1",
    type: "Button",
    props,
  });

  it("(A) semantic 필드는 Button accepts 에서 나오고 origin:'semantic'", () => {
    const { fields } = resolveEditContract(node({}));
    const semantic = fields.filter((f) => f.origin === "semantic");
    // Button.binding accepts: children/variant/size/fillStyle/type/isPending/isDisabled
    const keys = semantic.map((f) => f.key);
    expect(keys).toContain("variant");
    expect(keys).toContain("size");
    expect(keys).toContain("fillStyle");
    expect(keys).toContain("children");

    // accepts 와 1:1 — 임의 분기 없이 source 그대로.
    const accepts =
      getCatalogEntry("Button")?.kind === "primitive"
        ? (
            getCatalogEntry("Button") as {
              binding: { props: { accepts: object } };
            }
          ).binding.props.accepts
        : {};
    expect(keys.sort()).toEqual(Object.keys(accepts).sort());
  });

  it("(B) universal style 필드는 모든 노드 공유 + origin:'style' (컴포넌트 분기 0)", () => {
    const { fields } = resolveEditContract(node({}));
    const style = fields.filter((f) => f.origin === "style");
    const keys = style.map((f) => f.key).sort();
    expect(keys).toEqual(Object.keys(UNIVERSAL_STYLE_CONTRACTS).sort());
  });

  it("semantic: isOverridden = props[k] 존재, currentValue = override ?? default", () => {
    // variant 명시 → overridden, currentValue = "secondary"
    const withVariant = resolveEditContract(
      node({ variant: "secondary" }),
    ).fields.find((f) => f.key === "variant");
    expect(withVariant?.origin).toBe("semantic");
    expect(withVariant?.isOverridden).toBe(true);
    expect(withVariant?.currentValue).toBe("secondary");

    // variant 미명시 → not overridden, currentValue = contract.default("primary")
    const noVariant = resolveEditContract(node({})).fields.find(
      (f) => f.key === "variant",
    );
    expect(noVariant?.isOverridden).toBe(false);
    expect(noVariant?.currentValue).toBe("primary");
    expect(noVariant?.baseValue).toBe("primary");
  });

  it("style: base = theme rule(ComponentRuleSize), override 가 base 덮음", () => {
    // size="sm" 의 fontSize base 는 theme rule(TokenRef 미해소). override 없으면 base 가 current.
    const baseOnly = resolveEditContract(node({ size: "sm" })).fields.find(
      (f) => f.key === "fontSize" && f.origin === "style",
    );
    expect(baseOnly?.isOverridden).toBe(false);
    // 1A scope: base 는 TokenRef 미해소 통과 (resolveMergedStyle 과 같은 경계).
    expect(baseOnly?.baseValue).toBe("{typography.text-xs}");
    expect(baseOnly?.currentValue).toBe("{typography.text-xs}");

    // props.style.fontSize override → overridden, current = override(구체값).
    const overridden = resolveEditContract(
      node({ size: "sm", style: { fontSize: "20px" } }),
    ).fields.find((f) => f.key === "fontSize" && f.origin === "style");
    expect(overridden?.isOverridden).toBe(true);
    expect(overridden?.currentValue).toBe("20px");
    // base 는 그대로 보존 (reset 시 복귀 기준).
    expect(overridden?.baseValue).toBe("{typography.text-xs}");
  });

  it("style: base 없는 키(backgroundColor)는 override-only (base undefined)", () => {
    const bg = resolveEditContract(
      node({ size: "md", style: { backgroundColor: "#f00" } }),
    ).fields.find((f) => f.key === "backgroundColor");
    expect(bg?.origin).toBe("style");
    expect(bg?.baseValue).toBeUndefined();
    expect(bg?.isOverridden).toBe(true);
    expect(bg?.currentValue).toBe("#f00");
  });

  it("HC#2: section 필터로 Properties view / Style view 단일 호출 분리", () => {
    const { fields } = resolveEditContract(node({}));
    // Properties view = semantic origin (content/appearance/state/locale)
    const propsView = fields.filter((f) => f.origin === "semantic");
    // Style view = style origin (typography/appearance/transform/layout)
    const styleView = fields.filter((f) => f.origin === "style");
    // 두 view 모두 비어있지 않음 + 같은 호출 1번에서 나옴 (단일 진입점).
    expect(propsView.length).toBeGreaterThan(0);
    expect(styleView.length).toBeGreaterThan(0);
    expect(propsView.length + styleView.length).toBe(fields.length);
  });

  it("reset round-trip: style override 제거 시 base 복귀 (currentValue base 로)", () => {
    const before = resolveEditContract(
      node({ size: "sm", style: { fontSize: "20px" } }),
    ).fields.find((f) => f.key === "fontSize" && f.origin === "style");
    expect(before?.currentValue).toBe("20px");

    // reset = props.style.fontSize 삭제 (delete 등가).
    const after = resolveEditContract(
      node({ size: "sm", style: {} }),
    ).fields.find((f) => f.key === "fontSize" && f.origin === "style");
    expect(after?.isOverridden).toBe(false);
    expect(after?.currentValue).toBe("{typography.text-xs}"); // base 복귀
  });

  it("rule 미등록 type (frame) → semantic 없음, universal style base undefined", () => {
    const frameNode: CanonicalNode = {
      id: "f",
      type: "frame" as CanonicalNode["type"],
      props: { style: { backgroundColor: "#abc" } },
    };
    const { fields } = resolveEditContract(frameNode);
    // frame 은 primitive accepts 없음 → semantic 0. universal style 은 전부 존재(분기 0).
    const semantic = fields.filter((f) => f.origin === "semantic");
    const style = fields.filter((f) => f.origin === "style");
    expect(semantic.length).toBe(0);
    expect(style.length).toBe(Object.keys(UNIVERSAL_STYLE_CONTRACTS).length);
    // override 키만 반영.
    const bg = style.find((f) => f.key === "backgroundColor");
    expect(bg?.isOverridden).toBe(true);
    expect(bg?.currentValue).toBe("#abc");
  });
});
