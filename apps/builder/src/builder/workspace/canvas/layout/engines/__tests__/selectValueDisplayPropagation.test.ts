/**
 * Select/ComboBox 선택값이 캔버스에 반영되는지 — Skia SelectValue 표시 텍스트 채널
 * (2026-08-22, design-data 감사 §1-1 Select/ComboBox 행).
 *
 * **막으려던 상태**: DOM 은 RAC SelectValue 가 내부 selection state 에서 라벨을 그려 늘
 * 맞았는데, Skia 는 owner 의 `placeholder` 를 그대로 SelectValue `children` 으로 받는
 * propagation rule 하나뿐이라 옵션을 골라도 캔버스가 계속 placeholder 를 그렸다. 같은
 * 문서를 두 consumer 가 다르게 그리는 D3 비대칭.
 *
 * **채널을 잘못 짚기 쉬운 자리다** — 후보가 셋인데 하나만 Skia 에 닿는다:
 *  - `applyImplicitStyles` SelectValue 분기: **layout 노드만** 만든다 (2026-08-22 라이브에서
 *    여기에 넣었다가 캔버스가 안 바뀌어 드러났다)
 *  - `propagationEngine.resolvePropagatedProps`: **직계 자식 1단계**만 매칭해서 중첩 경로
 *    `["SelectTrigger","SelectValue"]` 를 아예 건너뛴다 (layout fallback 경로)
 *  - `propagationRegistry` 의 rule + `buildSpecNodeData.applyParentPropagationProps`:
 *    중첩 경로를 매칭하는 **Skia 경로** — 여기가 정본이다
 *
 * 그래서 registry 의 rule 정의를 직접 본다. 표시값 우선순위 자체는 shared
 * `resolveSelectDisplayValue` 테스트가 보고, 무효화 체인(layer A/B)은
 * `selectDisplayInvalidation.test.ts` 가 본다.
 */

import { describe, expect, it } from "vitest";
import { getPropagationRules } from "../../../../../utils/propagationRegistry";
import type { PropagationRule } from "@composition/specs";

const ITEMS = [
  { id: "opt-1", value: "us-west-2", label: "US West (Oregon)" },
  { id: "opt-2", value: "eu-central-1", label: "EU (Frankfurt)" },
];

/** owner 의 SelectValue `children` rule — 중첩 경로라 배열 childPath 여야 한다. */
function childrenRule(owner: string): PropagationRule {
  const rule = getPropagationRules(owner)?.find(
    (r) =>
      r.childProp === "children" &&
      Array.isArray(r.childPath) &&
      r.childPath[r.childPath.length - 1] === "SelectValue",
  );
  expect(rule, `${owner} 의 SelectValue children rule`).toBeDefined();
  return rule!;
}

/** rule 이 실제로 낼 값 (buildSpecNodeData.resolvePropagationValue 와 같은 순서). */
const display = (owner: string, ownerProps: Record<string, unknown>) => {
  const rule = childrenRule(owner);
  const parentValue = ownerProps[rule.parentProp!];
  return rule.transform ? rule.transform(parentValue, ownerProps) : parentValue;
};

describe("SelectValue 표시 텍스트 — propagation rule", () => {
  it("Select/ComboBox 둘 다 중첩 경로 + override 로 선언된다", () => {
    for (const owner of ["Select", "ComboBox"]) {
      const rule = childrenRule(owner);
      expect(rule.childPath).toEqual(["SelectTrigger", "SelectValue"]);
      // 자식에 stale children 이 남아 있어도 새 표시값이 이겨야 한다.
      expect(rule.override).toBe(true);
      expect(rule.transform).toBeTypeOf("function");
    }
  });

  it("선택 전에는 placeholder 가 그대로 내려간다", () => {
    expect(display("Select", { items: ITEMS, placeholder: "지역 선택" })).toBe(
      "지역 선택",
    );
    expect(
      display("ComboBox", { items: ITEMS, placeholder: "지역 선택" }),
    ).toBe("지역 선택");
  });

  it("선택하면 라벨이 내려간다", () => {
    expect(
      display("Select", {
        items: ITEMS,
        placeholder: "지역 선택",
        selectedKey: "opt-2",
        selectedValue: "eu-central-1",
      }),
    ).toBe("EU (Frankfurt)");
  });

  it("ComboBox 자유 입력도 같은 채널로 내려간다", () => {
    expect(
      display("ComboBox", {
        items: ITEMS,
        placeholder: "지역 선택",
        inputValue: "직접 입력",
      }),
    ).toBe("직접 입력");
  });

  it("ComboBox 의 placeholder attribute 채널은 그대로 남는다 (다른 자리)", () => {
    const attrRule = getPropagationRules("ComboBox")?.find(
      (r) => r.childProp === "placeholder",
    );
    expect(attrRule).toBeDefined();
    expect(attrRule!.transform).toBeUndefined();
  });
});
