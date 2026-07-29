// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyIconPicker } from "./PropertyIconPicker";

describe("PropertyIconPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the picker trigger and clear action as sibling buttons", () => {
    const { container } = render(
      <PropertyIconPicker
        label="Icon"
        value="a-large-small"
        onChange={vi.fn()}
      />,
    );

    const clearButton = screen.getByRole("button", { name: "Clear icon" });

    expect(container.querySelector("button button")).toBeNull();
    expect(
      clearButton.parentElement?.querySelectorAll(":scope > button"),
    ).toHaveLength(2);
  });

  it("clears the icon without selecting another icon", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <PropertyIconPicker
        label="Icon"
        value="a-large-small"
        onChange={onChange}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear icon" }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
