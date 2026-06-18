import { describe, expect, it } from "vitest";

import {
  DELEGATING_RAC_RENDERERS,
  DELEGATING_INTERNAL_RENDERERS,
} from "../CanonicalNodeRenderer";

/**
 * 회귀 방지 — DateField/TimeField 위임 등록 (2026-06-18).
 *
 * DateField/TimeField 는 binding `source.kind="rac"` 이고, RAC `<DateField>`/`<TimeField>` 는
 * 자식으로 `<DateInput>{(segment) => <DateSegment/>}` **render function** 을 받아야 segment 를
 * 그린다. 이는 generic 자식 재귀(`<RAC.DateField>{children}`)로는 표현 불가(render function 이지
 * 정적 JSX 아님)라, `DELEGATING_RAC_RENDERERS` 에 등록돼 rendererMap.DateField=renderDateField /
 * .TimeField=renderTimeField(composition wrapper self-compose + defaultValue 주입)로 위임해야 한다.
 *
 * 미등록 시 generic rac 경로로 떨어져 DateInput 안 segment 0개 = "입력부 내에 아무것도 없음"
 * (사용자 보고 2026-06-18 버그). NumberField/SearchField 와 정확히 동형의 self-compose 패턴.
 */
describe("CanonicalNodeRenderer — DateField/TimeField 위임 등록 (회귀 방지)", () => {
  it("DateField 는 DELEGATING_RAC_RENDERERS 에 등록 (rac source self-compose)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("DateField")).toBe(true);
  });

  it("TimeField 는 DELEGATING_RAC_RENDERERS 에 등록 (rac source self-compose)", () => {
    expect(DELEGATING_RAC_RENDERERS.has("TimeField")).toBe(true);
  });

  it("NumberField/SearchField 동형 멤버 보존 (회귀 0)", () => {
    // DateField/TimeField 추가가 기존 self-compose 멤버를 깨지 않음을 확증.
    expect(DELEGATING_RAC_RENDERERS.has("NumberField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("SearchField")).toBe(true);
    expect(DELEGATING_RAC_RENDERERS.has("Slider")).toBe(true);
  });

  it("DatePicker/DateRangePicker 는 rac 위임 대상 아님 (source.kind=internal, INTERNAL 경로)", () => {
    // DatePicker/DateRangePicker 는 source.kind="internal" 라 INTERNAL_RENDERERS["datepicker"]/
    // ["daterangepicker"] generic 경로로 composition wrapper(self-compose) 직접 렌더 — rac 위임
    // 집합에 들어가면 안 된다(type 이 PascalCase "DatePicker" 라 어차피 미매칭이지만 의도 고정).
    expect(DELEGATING_RAC_RENDERERS.has("DatePicker")).toBe(false);
    expect(DELEGATING_RAC_RENDERERS.has("DateRangePicker")).toBe(false);
    // internal 위임 집합에도 datepicker 류는 미포함(INTERNAL_RENDERERS map 직접 위임 경로 사용).
    expect(DELEGATING_INTERNAL_RENDERERS.has("datepicker")).toBe(false);
  });
});
