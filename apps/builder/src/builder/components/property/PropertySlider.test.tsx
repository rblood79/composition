import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertySlider } from "./PropertySlider";

afterEach(cleanup);

describe("PropertySlider editable 값 칸", () => {
  it("Enter 로 onChange + onChangeEnd 한 번씩, inputMax 로 clamp (슬라이더 max 밖 허용)", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(
      <PropertySlider
        label="Radius"
        labelMode="inline"
        editable
        unit="px"
        value={8}
        min={0}
        max={64}
        inputMax={9999}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Radius" });
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(999);
    expect(onChangeEnd).toHaveBeenCalledWith(999);

    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.blur(input);
    expect(onChangeEnd).toHaveBeenLastCalledWith(0);
  });

  it("Escape 는 draft 를 버리고 커밋하지 않는다 · 같은 값도 커밋하지 않는다", () => {
    const onChangeEnd = vi.fn();
    render(
      <PropertySlider
        label="Width"
        labelMode="inline"
        editable
        value={3}
        onChange={() => {}}
        onChangeEnd={onChangeEnd}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Width" });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("3");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);
    expect(onChangeEnd).not.toHaveBeenCalled();
  });

  it("inline 라벨은 legend 없이 fieldset · slider 접근 이름으로 남는다", () => {
    render(
      <PropertySlider
        label="Opacity"
        labelMode="inline"
        value={50}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Opacity", { selector: "legend" })).toBeNull();
    expect(
      screen.getAllByRole("group", { name: "Opacity" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "Opacity" })).toBeTruthy();
  });
});

describe("PropertySlider 드래그 중 thumb", () => {
  it("onChange 가 value prop 을 안 바꿔도 (presentation preview) thumb 는 드래그 값을 따르고, 끝나면 value 로 돌아간다", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(
      <PropertySlider
        label="Opacity"
        labelMode="inline"
        editable
        unit="%"
        value={50}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Opacity" });
    const thumb = slider.closest(".slider-thumb") as HTMLElement;
    // RAC useMove: thumb pointerdown → window pointermove (jsdom 트랙 폭 0 → 최대값으로 clamp)
    fireEvent.pointerDown(thumb, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 40,
      clientY: 0,
    });
    expect(onChange).toHaveBeenCalled();
    const dragged = onChange.mock.calls.at(-1)?.[0] as number;
    expect(dragged).not.toBe(50);
    expect(onChangeEnd).not.toHaveBeenCalled();
    // value prop 은 50 그대로인데 thumb 는 드래그 값
    expect((slider as HTMLInputElement).value).toBe(String(dragged));
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 40,
      clientY: 0,
    });
    expect(onChangeEnd).toHaveBeenCalledWith(dragged);
    // 드래그 끝 — controlled 로 복귀 (호출측 commit 이 value 를 바꾸지 않으면 원래 값)
    expect((slider as HTMLInputElement).value).toBe("50");
  });
});
