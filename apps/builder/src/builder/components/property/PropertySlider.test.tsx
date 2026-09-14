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
    expect(screen.getAllByRole("group", { name: "Opacity" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "Opacity" })).toBeTruthy();
  });
});
