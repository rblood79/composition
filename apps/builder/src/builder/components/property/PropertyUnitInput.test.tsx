// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useStore } from "../../stores";
import { PropertyUnitInput } from "./PropertyUnitInput";

describe("PropertyUnitInput numeric editing", () => {
  beforeAll(() => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
  });

  afterEach(() => {
    cleanup();
    useStore.setState({ selectedElementId: null } as never);
  });

  it("keeps typing local and commits the final value on Enter", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput
        label="Gap"
        value="12px"
        units={["reset", "px"]}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Gap" });
    fireEvent.change(input, { target: { value: "1234" } });

    expect(onDrag).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1234px");
  });

  it("commits on blur when Enter is not pressed", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput
        label="Width"
        value="120px"
        units={["reset", "px"]}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Width" });
    fireEvent.change(input, { target: { value: "1280" } });
    fireEvent.blur(input);

    expect(onDrag).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1280px");
  });

  it("keeps arrow-key increments on the preview path", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput
        label="Radius"
        value="12px"
        units={["reset", "px"]}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Radius" }), {
      key: "ArrowUp",
    });

    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledWith("13px");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the arrow-key value on the following blur", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput
        label="Radius"
        value="12px"
        units={["reset", "px"]}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Radius" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.blur(input);

    expect(onDrag).toHaveBeenCalledWith("13px");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("13px");
  });
});
