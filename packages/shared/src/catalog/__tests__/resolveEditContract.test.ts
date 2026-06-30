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

  // ── ADR-912 단계 2 회귀: size/variant 옵션 theme rule 파생 (버그2) ──
  // Why: kind:"size"/"variant" PropContract 는 options 미선언(theme rule = source).
  // 구 경로(inspectorFields.ts → theme.resolveDimensionOptions)의 파생을 신 경로로 미이식하면
  // options=undefined → GenericFieldRenderer ?? [] → PropertySizeToggle 빈 드롭다운.
  describe("size/variant 옵션 파생 (ADR-912 단계 2 회귀 — 버그2)", () => {
    it("kind:'size' field 의 options 가 theme rule.sizes 키에서 파생 (비어있지 않음)", () => {
      const size = resolveEditContract(node({})).fields.find(
        (f) => f.key === "size" && f.origin === "semantic",
      );
      expect(size?.kind).toBe("size");
      // 발효 type 의 size 드롭다운이 빈 배열이면 안 됨 (버그2 회귀 가드).
      expect(size?.options).toBeDefined();
      expect(size?.options?.length ?? 0).toBeGreaterThan(0);
      // Button rule.sizes = xs~xl. value 집합 정합.
      const values = (size?.options ?? []).map((o) => o.value);
      expect(values).toContain("md");
      expect(values).toContain("xs");
      expect(values).toContain("xl");
      // 라벨: md→M / sm→S / xl→XL (SIZE_DISPLAY_LABELS 동형).
      const md = (size?.options ?? []).find((o) => o.value === "md");
      expect(md?.label).toBe("M");
    });

    it("kind:'variant' field 의 options 가 theme rule.variants 키에서 파생", () => {
      const variant = resolveEditContract(node({})).fields.find(
        (f) => f.key === "variant" && f.origin === "semantic",
      );
      expect(variant?.kind).toBe("variant");
      expect(variant?.options?.length ?? 0).toBeGreaterThan(0);
      const values = (variant?.options ?? []).map((o) => o.value);
      // Button rule.variants 에 primary 포함 (defaultVariant).
      expect(values).toContain("primary");
      // 라벨: 첫 글자 대문자 (primary→Primary).
      const primary = (variant?.options ?? []).find(
        (o) => o.value === "primary",
      );
      expect(primary?.label).toBe("Primary");
    });

    it("enum kind 는 contract.options 를 그대로 통과 (theme 미경유)", () => {
      // Button.binding 의 type(enum) accepts → 고정 options 보존.
      const accepts =
        getCatalogEntry("Button")?.kind === "primitive"
          ? (
              getCatalogEntry("Button") as {
                binding: {
                  props: { accepts: Record<string, { kind: string }> };
                };
              }
            ).binding.props.accepts
          : {};
      const enumKey = Object.entries(accepts).find(
        ([, c]) => c.kind === "enum",
      )?.[0];
      if (enumKey) {
        const enumField = resolveEditContract(node({})).fields.find(
          (f) => f.key === enumKey,
        );
        // enum 은 contract 가 직접 제공 → 파생 거치지 않고 그대로.
        expect(enumField?.options).toBeDefined();
      }
    });

    it("rule 미등록 type 의 size/variant 는 options undefined (override-only 보존)", () => {
      // frame 은 rule 없음 → universal style 에 size/variant kind 가 있어도 파생 source 없음.
      const frameNode: CanonicalNode = {
        id: "f2",
        type: "frame" as CanonicalNode["type"],
        props: {},
      };
      const { fields } = resolveEditContract(frameNode);
      const sizeVariantStyle = fields.filter(
        (f) =>
          f.origin === "style" && (f.kind === "size" || f.kind === "variant"),
      );
      // rule 미등록 → 파생 불가 → undefined (예외 없이 graceful).
      for (const f of sizeVariantStyle) {
        expect(f.options).toBeUndefined();
      }
    });
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

  // ADR-912 회귀 복원: collection 의 items field(kind:"items-manager") schema 가
  //   ResolvedField.itemsManager 로 통과되어야 GenericFieldRenderer 가 ItemsManager UI 를
  //   렌더(정적 items 추가/제거 — RSP Dynamic collections). 통과 누락 시 schema=undefined → null.
  it("ListBox items field 가 kind:'items-manager' + itemsManager schema 통과", () => {
    const listBoxNode: CanonicalNode = {
      id: "lb1",
      type: "ListBox" as CanonicalNode["type"],
      props: {},
    };
    const items = resolveEditContract(listBoxNode).fields.find(
      (f) => f.key === "items" && f.origin === "semantic",
    );
    expect(items?.kind).toBe("items-manager");
    expect(items?.itemsManager).toBeDefined();
    expect(items?.itemsManager?.itemsKey).toBe("items");
    expect(items?.itemsManager?.itemTypeName).toBe("ListBoxItem");
    expect(items?.itemsManager?.itemSchema.some((s) => s.key === "label")).toBe(
      true,
    );
    // ListBox 는 allowSections:true (Add Section UI).
    expect(items?.itemsManager?.allowSections).toBe(true);
  });

  // ── RadioGroup value 를 자식 Radio value 기반 select 로 (2026-06-30) ──
  // Why(전수조사): "어느 항목이 선택/활성인가" 기능이 단일항목(isSelected boolean)과
  //   그룹 사이에서 갈렸다. RadioGroup 만 value 를 string 자유입력으로 노출 → 사용자가
  //   존재하지 않는 key 를 칠 수 있어 선택이 깨짐. RAC 의 value 는 string 타입이되
  //   유효 선택은 자식 <Radio value> 집합으로 제약(reference RadioGroup.md) → 자식 value
  //   목록 기반 select 가 정합. catalog enum 정적 options 로는 표현 불가 → deriveOptions
  //   에 RadioGroup 전용 자식 파생 분기 추가(variant/size theme 파생 선례 동형).
  describe("RadioGroup value 자식 Radio 기반 select (2026-06-30)", () => {
    const radioGroup = (
      children: CanonicalNode[],
      props: Record<string, unknown> = {},
    ): CanonicalNode => ({
      id: "rg1",
      type: "RadioGroup" as CanonicalNode["type"],
      props,
      children,
    });

    const radio = (
      id: string,
      value: string | undefined,
      label?: string,
    ): CanonicalNode => ({
      id,
      type: "Radio" as CanonicalNode["type"],
      props: {
        ...(value !== undefined ? { value } : {}),
        ...(label !== undefined ? { children: label } : {}),
      },
    });

    it("value field 가 kind:'enum' 로 노출 (string 자유입력 아님)", () => {
      const node = radioGroup([
        radio("r1", "a", "Apple"),
        radio("r2", "b", "Banana"),
      ]);
      const value = resolveEditContract(node).fields.find(
        (f) => f.key === "value" && f.origin === "semantic",
      );
      expect(value?.kind).toBe("enum");
    });

    it("options 가 자식 Radio value 에서 파생 (label = Radio children, fallback = value)", () => {
      const node = radioGroup([
        radio("r1", "a", "Apple"),
        radio("r2", "b"), // label 없음 → value 자체가 라벨
      ]);
      const value = resolveEditContract(node).fields.find(
        (f) => f.key === "value" && f.origin === "semantic",
      );
      expect(value?.options).toEqual([
        { value: "a", label: "Apple" },
        { value: "b", label: "b" },
      ]);
    });

    it("value 없는 Radio 는 옵션에서 제외 (선택 불가능 — RAC value 매칭)", () => {
      const node = radioGroup([
        radio("r1", "a", "Apple"),
        radio("r2", undefined, "라벨만"), // value 없음 → 선택 식별 불가
        radio("r3", "c", "Cherry"),
      ]);
      const value = resolveEditContract(node).fields.find(
        (f) => f.key === "value",
      );
      const values = (value?.options ?? []).map((o) => o.value);
      expect(values).toEqual(["a", "c"]);
    });

    it("자식 Radio 없으면 options 빈 배열 (graceful — 빈 그룹)", () => {
      const node = radioGroup([]);
      const value = resolveEditContract(node).fields.find(
        (f) => f.key === "value",
      );
      expect(value?.kind).toBe("enum");
      expect(value?.options).toEqual([]);
    });

    it("currentValue 우선순위 보존 (override value ?? default)", () => {
      const node = radioGroup(
        [radio("r1", "a", "Apple"), radio("r2", "b", "Banana")],
        { value: "b" },
      );
      const value = resolveEditContract(node).fields.find(
        (f) => f.key === "value",
      );
      expect(value?.isOverridden).toBe(true);
      expect(value?.currentValue).toBe("b");
    });
  });
});
