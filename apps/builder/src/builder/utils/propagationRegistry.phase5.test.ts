/**
 * ADR-914 Phase 5 — Propagation Facet Proof (Switch proof family)
 *
 * `createPropagationOnlySpec` shadow ComponentSpec wrapper 를 제거하고 rule 배열을
 * `registerPropagationRules` 로 직접 등록했을 때, forwardIndex/reverseIndex 가
 * **byte-identical** 임을 증명한다 (Gate: parent prop edit → child diff 0).
 *
 * 핵심 invariant:
 *  1. order 보존 — getPropagationRules 의 rule 순서/내용이 shadow spec 경로와 동일.
 *  2. reverse index 정합 — getParentTagsForChild(childTag) 에 parent 포함.
 *  3. skipIfSet/styleValue/asStyle/override/parentProp optional 필드 무손실.
 *  4. registered tag set 에 proof family 포함 (entry propagation facet 정합).
 *
 * 실행: pnpm vitest propagationRegistry.phase5
 */

import type { ComponentSpec, PropagationRule, Shape } from "@composition/specs";
import { describe, it, expect, beforeEach } from "vitest";

import {
  registerPropagationSpec,
  registerPropagationRules,
  getPropagationRules,
  getParentTagsForChild,
  getRegisteredPropagationTags,
  _resetPropagationRegistry,
} from "./propagationRegistry";

// ── proof family Switch 의 정본 rules (propagationRegistry.ts switchPropagationRules verbatim) ──
const SWITCH_RULES: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "children",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

// shadow ComponentSpec wrapper (구 createPropagationOnlySpec 와 동형) — 비교 oracle 용.
const noopShapes = (): Shape[] => [];
function makeShadowSpec(
  name: string,
  rules: PropagationRule[],
): ComponentSpec<Record<string, unknown>> {
  return {
    name,
    element: "div",
    propagation: { rules },
    defaultVariant: "default",
    defaultSize: "md",
    variants: {},
    sizes: {},
    states: {},
    render: { shapes: noopShapes },
  };
}

describe("ADR-914 Phase 5 — Switch propagation rule-only 등록 parity", () => {
  beforeEach(() => {
    _resetPropagationRegistry();
  });

  it("rule-only 등록 == shadow spec 등록 (forwardIndex byte-identical)", () => {
    // 경로 A: 구 shadow ComponentSpec wrapper.
    _resetPropagationRegistry();
    registerPropagationSpec("Switch", makeShadowSpec("Switch", SWITCH_RULES));
    const viaShadow = getPropagationRules("Switch");

    // 경로 B: Phase 5 rule-only adapter.
    _resetPropagationRegistry();
    registerPropagationRules("Switch", SWITCH_RULES);
    const viaRules = getPropagationRules("Switch");

    // 두 경로 결과가 deep-equal (order + 모든 필드 보존).
    expect(viaRules).toEqual(viaShadow);
    // 정본 rules 와도 byte-identical (order 보존).
    expect(viaRules).toEqual(SWITCH_RULES);
  });

  it("order 보존 — rule 순서가 size → children", () => {
    registerPropagationRules("Switch", SWITCH_RULES);
    const rules = getPropagationRules("Switch");
    expect(rules).toBeDefined();
    expect(rules!.map((r) => r.parentProp)).toEqual(["size", "children"]);
  });

  it("필드 무손실 — override / childProp / childPath 정확", () => {
    registerPropagationRules("Switch", SWITCH_RULES);
    const rules = getPropagationRules("Switch")!;
    // rule[0]: size → Label (override, childProp 없음).
    expect(rules[0]).toEqual({
      parentProp: "size",
      childPath: "Label",
      override: true,
    });
    // rule[1]: children → Label.children (override).
    expect(rules[1]).toEqual({
      parentProp: "children",
      childPath: "Label",
      childProp: "children",
      override: true,
    });
  });

  it("reverse index 정합 — Label 의 parent 에 switch 포함", () => {
    registerPropagationRules("Switch", SWITCH_RULES);
    const parents = getParentTagsForChild("Label");
    expect(parents).toBeDefined();
    // childPath 가 string("Label") 이므로 reverse index 에 등록됨 (lowercase).
    expect(parents!.has("switch")).toBe(true);
  });

  it("registered tag set 에 switch 포함 (entry propagation facet 정합)", () => {
    registerPropagationRules("Switch", SWITCH_RULES);
    expect(getRegisteredPropagationTags().has("switch")).toBe(true);
  });

  it("shadow spec 과 rule-only 가 같은 registry 에 공존 (reset 없이)", () => {
    // 27 family(shadow) + proof family(rule-only) 혼재 상태 = 실제 Phase 5 후 모듈 상태.
    registerPropagationSpec(
      "Card",
      makeShadowSpec("Card", [
        { parentProp: "size", childPath: "CardHeader", override: true },
      ]),
    );
    registerPropagationRules("Switch", SWITCH_RULES);

    // 두 등록 경로 모두 forwardIndex 에 반영.
    expect(getPropagationRules("Card")).toBeDefined();
    expect(getPropagationRules("Switch")).toEqual(SWITCH_RULES);
    expect(getRegisteredPropagationTags().has("card")).toBe(true);
    expect(getRegisteredPropagationTags().has("switch")).toBe(true);
  });
});
