import { act, render } from "@testing-library/react";
import { parseColor } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";

import { ColorArea } from "@composition/shared/components/ColorArea";

function renderColorArea(value: string) {
  const onChange = vi.fn();

  return {
    onChange,
    ...render(
      <ColorArea
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        value={parseColor(value)}
        onChange={onChange}
      />,
    ),
  };
}

describe("ColorArea aria-hidden focus transition", () => {
  it("keeps the focused y-axis input exposed during a controlled value update", () => {
    const rendered = renderColorArea("#ff0000");
    const inputs = rendered.container.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    );
    const yInput = inputs[1];

    expect(yInput).toBeDefined();
    expect(yInput.getAttribute("aria-hidden")).toBe("true");

    act(() => {
      yInput.focus();
      rendered.rerender(
        <ColorArea
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          value={parseColor("#00ff00")}
          onChange={rendered.onChange}
        />,
      );
    });

    expect(document.activeElement).toBe(yInput);
    expect(yInput.getAttribute("aria-hidden")).not.toBe("true");
  });
});
