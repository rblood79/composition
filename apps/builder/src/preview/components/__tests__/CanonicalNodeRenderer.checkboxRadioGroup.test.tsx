import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "@composition/shared";

import { DELEGATING_RAC_RENDERERS } from "../canonicalRendererRegistry";

/**
 * ADR-912 CheckboxItems/RadioItems 폐기 후속 (2026-06-15) — CheckboxGroup/RadioGroup
 * DELEGATING 위임 멤버십 회귀 가드.
 *
 * **회귀 근본 (Select family 와 다름)**: CheckboxGroup/RadioGroup 은 FAMILY_3 catalog
 * cutover(source.kind="rac")라 generic `cutoverPrimitives` 경로로 들어간다. 자식
 * Checkbox/Radio 는 spec 이 살아있어 generic 재귀로도 raw tag 안 떨어진다(Select family 와
 * 차이 — 그래서 vertical 은 generic 경로로도 그룹 자체 flex column 으로 정상).
 *
 * 문제는 **horizontal**: generated CSS 가 `[data-orientation="horizontal"] .checkbox-items`/
 * `.radio-items` wrapper 를 타겟하는데, generic 경로는 (1) wrapper div 를 합성 안 하고
 * (자식 직속 재귀) (2) toRacProps 가 orientation(kind:"enum")을 data-* 로 emit 안 한다
 * (DATA_ATTR_KINDS=variant/size/fillStyle 한정). 둘 다 빠져 horizontal CSS selector 미매칭.
 *
 * DELEGATING 등록 시 renderCheckboxGroup/renderRadioGroup(FormRenderers)으로 위임 →
 * `<div className="checkbox-items">`/`.radio-items` wrapper + orientation prop 전달
 * (CheckboxGroup.tsx 명시 data-orientation / RadioGroup 은 RAC 자동 emit)으로 자기완결
 * 처리 → vertical 보존 + horizontal 대칭.
 */
describe("CanonicalNodeRenderer — ADR-912 CheckboxGroup/RadioGroup DELEGATING 위임", () => {
  it("rac source(CheckboxGroup/RadioGroup)는 DELEGATING_RAC_RENDERERS 에 등록", () => {
    for (const type of ["CheckboxGroup", "RadioGroup"]) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} binding source.kind`).toBe("rac");
      expect(
        DELEGATING_RAC_RENDERERS.has(type),
        `${type} 이 DELEGATING_RAC_RENDERERS 에 누락 → generic 경로(wrapper 미합성 + orientation data-* 미emit)로 horizontal CSS selector 미매칭 회귀`,
      ).toBe(true);
    }
  });

  it("CheckboxGroup/RadioGroup binding 은 orientation enum 계약 보유 (horizontal 대칭 전제)", () => {
    for (const type of ["CheckboxGroup", "RadioGroup"]) {
      const binding = getPrimitiveBinding(type);
      const orientation = binding?.props.accepts.orientation;
      expect(orientation, `${type} accepts.orientation`).toBeTruthy();
      expect(orientation?.kind, `${type} orientation.kind`).toBe("enum");
    }
  });
});
