// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { openStylesFixture } from "../__tests__/support/catalogStylesFixture";
import { useTransformValues } from "./useTransformValues";

/**
 * DateInput 의 패널 Transform height specDefault (ADR-253).
 *
 * DateInput 은 DateInput 원본의 instance 다 — 높이는 내용 (줄 높이 + padding + border) 이고 rule 에 고정
 * 높이가 없다 (Input 과 같다). 그래서 어느 부모 안에서든 specDefault 가 비어 있다. 종전에는 단독 field 가
 * catalog 높이 (30) 를, picker 안은 부모 상자를 채우는 "100%" 를 표시했다.
 */
async function dateInputHeightDefault(type: string) {
  const fixture = await openStylesFixture([{ id: "field", type }]);
  const record = fixture.descendantRecord("field", "DateInput");
  const { result } = renderHook(() => useTransformValues(record), {
    wrapper: fixture.wrapper,
  });
  return result.current?.height.specDefault;
}

describe("useTransformValues — DateInput height specDefault", () => {
  it.each(["DateField", "TimeField", "DatePicker", "DateRangePicker"])(
    "%s 안 DateInput 의 height specDefault 는 비어 있다 (내용 높이)",
    async (type) => {
      expect(await dateInputHeightDefault(type)).toBeUndefined();
    },
  );
});
