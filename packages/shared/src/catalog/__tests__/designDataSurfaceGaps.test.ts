import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * design-data 대조 감사 (2026-08-20, `docs/reference/audits/2026-08-20-design-data-
 * component-props-audit.md`) §1-1 "표면 단절" 회귀 가드.
 *
 * 표면 단절 = D3(rules table/CSS)와 렌더러는 이미 채널을 갖췄는데 binding `accepts`
 * 선언만 없어 프로퍼티 패널에서 편집이 불가능한 상태. 구현 신설이 아니라 **선언
 * 누락**이므로, 같은 유형이 재발하면 이 테스트가 먼저 깨지도록 고정한다.
 *
 * 주의 — 본 파일은 "accepts 에 선언만 하면 실제로 동작하는 것"만 다룬다. 감사에서
 * 같은 후보로 보고됐으나 실측 결과 소비 경로가 없거나 uncontrolled 인 3건
 * (Toast.position / Select·ComboBox.selectedKey / DatePicker.hourCycle)은 선언만으로
 * dead prop 이 되므로 제외했다. 상세는 감사 문서 §1-1 정정 주석 참조.
 */

describe("design-data 감사 §1-1 — 표면 단절 회귀 가드", () => {
  it("Tooltip: D3 variants 가 있으면 binding accepts 에도 variant 가 선언돼 있다", () => {
    const rule = COMPONENT_RULES_TABLE.Tooltip;
    const variantKeys = Object.keys(rule?.variants ?? {});

    // D3 측 전제: rules table 이 variant 를 갖는다 (없으면 이 가드 자체가 무의미).
    expect(variantKeys.length).toBeGreaterThan(1);

    const accepts = getPrimitiveBinding("Tooltip")?.props?.accepts;
    expect(accepts?.variant, "Tooltip binding accepts.variant").toBeDefined();
    expect(accepts?.variant?.kind).toBe("variant");

    // accepts default 는 rules table 의 defaultVariant 와 일치해야 한다 —
    // 불일치 시 DOM `data-variant` 가 존재하지 않는 variant 를 가리킨다.
    expect(accepts?.variant?.default).toBe(rule?.defaultVariant);
    expect(variantKeys).toContain(rule?.defaultVariant);
  });

  it("DatePicker/DateRangePicker: placeholder 편집 표면이 형제 대칭이다", () => {
    for (const type of ["DatePicker", "DateRangePicker"] as const) {
      const accepts = getPrimitiveBinding(type)?.props?.accepts;
      expect(accepts?.placeholder, `${type} accepts.placeholder`).toBeDefined();
      expect(accepts?.placeholder?.kind).toBe("string");
    }
  });
});
