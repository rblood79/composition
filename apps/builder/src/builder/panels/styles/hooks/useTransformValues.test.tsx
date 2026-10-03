// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { openStylesFixture } from "../__tests__/support/catalogStylesFixture";
import { useTransformValues } from "./useTransformValues";

/**
 * picker(DatePicker/DateRangePicker) DateInput 의 패널 Transform height specDefault 정합 가드
 * (2026-06-23, 사용자 적발).
 *
 * picker DateInput 은 SelectTrigger box 안 콘텐츠 자식이고 layout 이 `height: 100%` 를 준다.
 * 그러나 catalog `DateInput.sizes.md.height=30` 은 DateField/TimeField 단독(자기 box) 용 값이라,
 * 같은 entry 를 공유하는 패널 specDefault 가 picker DateInput 에도 30(box) 을 표시하면 실제
 * layout(100%) 과 어긋난다. useTransformValues 가 부모 체인(SelectTrigger → picker)을 확인해
 * height specDefault 를 "100%" 로 바꾼다. DateField/TimeField 단독 DateInput 은 catalog 30 유지.
 * ADR-248 4e-9 C: 원본 template 안 DateInput record 를 catalog Styles host 로 읽는다.
 */
async function dateInputHeightDefault(type: string) {
  const fixture = await openStylesFixture([{ id: "field", type }]);
  const record = fixture.descendantRecord("field", "DateInput");
  const { result } = renderHook(() => useTransformValues(record), {
    wrapper: fixture.wrapper,
  });
  return result.current?.height.specDefault;
}

describe("useTransformValues — picker DateInput height specDefault", () => {
  it("picker(DatePicker > SelectTrigger > DateInput) DateInput 의 height specDefault 는 '100%'", async () => {
    expect(
      await dateInputHeightDefault("DatePicker"),
      "picker DateInput height specDefault 가 100% 가 아니면 패널이 catalog box 30 을 잘못 표시",
    ).toBe("100%");
  });

  it("DateRangePicker > SelectTrigger > DateInput 도 동일하게 '100%'", async () => {
    expect(await dateInputHeightDefault("DateRangePicker")).toBe("100%");
  });

  it("DateField 단독 DateInput 은 catalog box 높이(md=30) 유지 — 회귀 0", async () => {
    expect(
      await dateInputHeightDefault("DateField"),
      "DateField 단독 DateInput 은 자기 box 라 catalog 30 유지해야 함(picker override 미적용)",
    ).toBe(30);
  });

  it("TimeField 단독 DateInput 도 catalog box 높이 유지 (picker override 미적용)", async () => {
    expect(await dateInputHeightDefault("TimeField")).toBe(30);
  });
});
