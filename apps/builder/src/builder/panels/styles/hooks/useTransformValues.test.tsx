// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTransformValues } from "./useTransformValues";
import { useStore } from "../../../stores";
import { seedPanelElements } from "./__tests__/panelFixture";
import type { Element } from "../../../../types/core/store.types";

function setTestElements(elements: Element[]): void {
  seedPanelElements(elements);
}

/**
 * picker(DatePicker/DateRangePicker) DateInput 의 패널 Transform height specDefault 정합 가드
 * (2026-06-23, 사용자 적발).
 *
 * field-trigger canonical 자식 통일(커밋 97d59f161) 후 picker DateInput 은 SelectTrigger box
 * 안 콘텐츠 자식이고 layout(implicitStyles.ts:1518)이 `height: cs.height ?? "100%"` 를 주입한다.
 * 그러나 catalog `DateInput.sizes.md.height=30` 은 DateField/TimeField 단독(자기 box) 용 값이라,
 * 같은 entry 를 공유하는 패널 specDefault 가 picker DateInput 에도 30(box) 을 표시 → 실제 layout(100%)
 * 과 불일치. useTransformValues 가 부모 체인(부모 SelectTrigger → 조부모 picker)을 확인해 height
 * specDefault 를 "100%" 로 override 한다. DateField/TimeField 단독 DateInput 은 catalog 30 유지(회귀 0).
 */
describe("useTransformValues — picker DateInput height specDefault", () => {
  beforeEach(() => {
    useStore.setState({ elements: [], elementsMap: new Map() } as never);
  });

  it("picker(DatePicker > SelectTrigger > DateInput) DateInput 의 height specDefault 는 '100%'", () => {
    setTestElements([
      {
        id: "di-1",
        type: "DateInput",
        parent_id: "st-1",
        props: { _parentTag: "DatePicker", style: { flex: 1, minWidth: 0 } },
      } as Element,
      {
        id: "st-1",
        type: "SelectTrigger",
        parent_id: "dp-1",
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
      {
        id: "dp-1",
        type: "DatePicker",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = renderHook(() => useTransformValues("di-1"));
    expect(
      result.current?.height.specDefault,
      "picker DateInput height specDefault 가 100% 가 아니면 패널이 catalog box 30 을 오표시",
    ).toBe("100%");
  });

  it("DateRangePicker > SelectTrigger > DateInput 도 동일하게 '100%'", () => {
    setTestElements([
      {
        id: "di-2",
        type: "DateInput",
        parent_id: "st-2",
        props: { _parentTag: "DateRangePicker", style: { flex: 1 } },
      } as Element,
      {
        id: "st-2",
        type: "SelectTrigger",
        parent_id: "drp-1",
        props: { style: {} },
      } as Element,
      {
        id: "drp-1",
        type: "DateRangePicker",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = renderHook(() => useTransformValues("di-2"));
    expect(result.current?.height.specDefault).toBe("100%");
  });

  it("DateField 단독 DateInput 은 catalog box 높이(md=30) 유지 — 회귀 0", () => {
    setTestElements([
      {
        id: "di-3",
        type: "DateInput",
        parent_id: "df-1",
        props: { style: { width: "100%" } },
      } as Element,
      {
        id: "df-1",
        type: "DateField",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = renderHook(() => useTransformValues("di-3"));
    expect(
      result.current?.height.specDefault,
      "DateField 단독 DateInput 은 자기 box 라 catalog 30 유지해야 함(picker override 미적용)",
    ).toBe(30);
  });

  it("TimeField 단독 DateInput 도 catalog box 높이 유지 (picker override 미적용)", () => {
    setTestElements([
      {
        id: "di-4",
        type: "DateInput",
        parent_id: "tf-1",
        props: { style: { width: "100%" } },
      } as Element,
      {
        id: "tf-1",
        type: "TimeField",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = renderHook(() => useTransformValues("di-4"));
    expect(result.current?.height.specDefault).toBe(30);
  });
});
