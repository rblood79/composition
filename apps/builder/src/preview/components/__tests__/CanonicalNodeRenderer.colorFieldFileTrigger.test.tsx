import { describe, expect, it } from "vitest";

import { DELEGATING_RAC_RENDERERS } from "../canonicalRendererRegistry";

/**
 * 회귀 방지 — ColorField/FileTrigger 위임 등록 (2026-09-10, Properties 패널 D2 대조).
 *
 * - ColorField: field 가족(TextField/TextArea/NumberField/SearchField/DateField/TimeField)은 전부
 *   wrapper self-compose 위임인데 ColorField 만 generic 경로였다. generic 경로는 raw RAC.ColorField
 *   에 parent `description`/`errorMessage` 를 raw prop 으로 흘려 DOM 에 닿지 않았다(패널에 보이는데
 *   무반응). renderColorField 가 두 값을 wrapper 로 self-compose 한다.
 * - FileTrigger: RAC FileTrigger 는 DOM 을 만들지 않는다(hidden input + PressResponder). canonical
 *   FileTrigger 는 자식 없는 leaf 라 generic 경로에서는 pressable 도, `.react-aria-FileTrigger`
 *   class 도, `isDisabled` 도 실릴 요소가 없었다 — Skia(catalog rule box) 와 비대칭.
 *   renderFileTrigger 가 `.react-aria-FileTrigger` Button 을 self-compose 한다.
 */
describe("CanonicalNodeRenderer — ColorField/FileTrigger 위임 등록 (회귀 방지)", () => {
  it("ColorField 는 DELEGATING_RAC_RENDERERS 에 등록 (field 가족 동형)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("ColorField")).toBe(true);
  });

  it("FileTrigger 는 DELEGATING_RAC_RENDERERS 에 등록 (Button self-compose)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("FileTrigger")).toBe(true);
  });

  it("field 가족 형제 멤버 보존 (회귀 0)", () => {
    for (const type of [
      "TextField",
      "TextArea",
      "NumberField",
      "SearchField",
      "DateField",
      "TimeField",
    ]) {
      expect(DELEGATING_RAC_RENDERERS.has(type)).toBe(true);
    }
  });
});
