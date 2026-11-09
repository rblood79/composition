// @vitest-environment jsdom
/**
 * 2026-11-09 — 색 입력 모드 seg 는 RAC ToggleButtonGroup (radiogroup · radio · 방향키). 옛 구현은 button 에
 * role · aria-checked 를 손으로 달아 방향키 이동이 없었다.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ColorInputModeSelector } from "./ColorInputModeSelector";
import { useFillUIStore } from "../hooks/useFillValues";

afterEach(() => {
  cleanup();
  act(() => useFillUIStore.getState().setColorInputMode("hex"));
});

describe("ColorInputModeSelector — RAC radiogroup", () => {
  it("radiogroup · 선택 radio · 방향키가 다음 모드로 옮긴다", () => {
    const { getByRole, getAllByRole } = render(<ColorInputModeSelector />);
    expect(getByRole("radiogroup").getAttribute("aria-label")).toBe(
      "Color input mode",
    );
    const radios = getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["HEX", "RGBA", "CSS"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    fireEvent.click(radios[1]);
    expect(useFillUIStore.getState().colorInputMode).toBe("rgba");
    expect(radios[1].hasAttribute("data-selected")).toBe(true);
    act(() => radios[1].focus());
    fireEvent.keyDown(radios[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(radios[2]);
  });
});
