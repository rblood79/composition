// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoxShadowPresentationValue } from "../../../presentation/boxShadowPresentation";
import { BoxShadowEditor } from "./BoxShadowEditor";

interface SelectMockProps {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }>;
  readonly value: string;
}

interface UnitInputMockProps {
  readonly label?: string;
  readonly min?: number;
  readonly onChange: (value: string) => void;
  readonly onDrag?: (value: string) => void;
  readonly value: string;
}

interface ColorMockProps {
  readonly onChange: (value: string) => void;
  readonly onPresentationCancel?: (reason: "escape" | "pointer-cancel") => void;
  readonly onPreview?: (value: string) => void;
  readonly presentationOwnsFrameScheduling?: boolean;
  readonly value: string;
}

vi.mock("../../../components", () => ({
  PropertyColor: ({
    onChange,
    onPresentationCancel,
    onPreview,
    presentationOwnsFrameScheduling,
    value,
  }: ColorMockProps) => (
    <div
      data-testid="shadow-color"
      data-value={value}
      data-frame-owned={String(presentationOwnsFrameScheduling)}
    >
      <button onClick={() => onPreview?.("#12345680")}>Color preview</button>
      <button onClick={() => onChange("#12345680")}>Color commit</button>
      <button onClick={() => onPresentationCancel?.("pointer-cancel")}>
        Color cancel
      </button>
    </div>
  ),
  PropertySelect: ({ label, onChange, options, value }: SelectMockProps) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  PropertyUnitInput: ({
    label = "Value",
    min,
    onChange,
    onDrag,
    value,
  }: UnitInputMockProps) => (
    <div data-testid={label} data-min={min} data-value={value}>
      <button
        aria-label={`${label} preview`}
        onClick={() => onDrag?.("12px")}
      />
      <button aria-label={`${label} commit`} onClick={() => onChange("12px")} />
      <button
        aria-label={`${label} negative`}
        onClick={() => onChange("-5px")}
      />
    </div>
  ),
}));

const VALUE: BoxShadowPresentationValue = {
  layers: [
    {
      blur: 8,
      color: "#00000040",
      inset: false,
      offsetX: 1,
      offsetY: 2,
      spread: 0,
    },
    {
      blur: 4,
      color: "#ff000080",
      inset: true,
      offsetX: 3,
      offsetY: 4,
      spread: -1,
    },
  ],
};

describe("BoxShadowEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("다중 layer와 px numeric/color controls를 표시한다", () => {
    render(
      <BoxShadowEditor
        value={VALUE}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    expect(screen.getByRole("option", { name: "Layer 1" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Layer 2 · inset" }),
    ).toBeTruthy();
    expect(screen.getByTestId("Offset X").dataset.value).toBe("1px");
    expect(screen.getByTestId("Blur").dataset.min).toBe("0");
    expect(screen.getByTestId("Spread").dataset.min).toBe("-9999");
    expect(screen.getByTestId("shadow-color").dataset.frameOwned).toBe("true");
  });

  it("numeric drag는 typed preview, terminal은 typed commit으로 전달한다", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    render(
      <BoxShadowEditor
        value={VALUE}
        onPreview={onPreview}
        onCommit={onCommit}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    fireEvent.click(screen.getByLabelText("Offset X preview"));
    expect(onPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: expect.arrayContaining([
          expect.objectContaining({ offsetX: 12 }),
        ]),
      }),
    );

    fireEvent.click(screen.getByLabelText("Spread negative"));
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: expect.arrayContaining([
          expect.objectContaining({ offsetX: 12, spread: -5 }),
        ]),
      }),
    );

    fireEvent.click(screen.getByLabelText("Blur negative"));
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: expect.arrayContaining([expect.objectContaining({ blur: 0 })]),
      }),
    );
  });

  it("선택 layer만 편집하고 color preview를 runtime owner에 위임한다", () => {
    const onPreview = vi.fn();
    render(
      <BoxShadowEditor
        value={VALUE}
        onPreview={onPreview}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    fireEvent.change(screen.getByLabelText("Shadow Layer"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("Color preview"));

    const nextValue = onPreview.mock.calls.at(
      -1,
    )?.[0] as BoxShadowPresentationValue;
    expect(nextValue.layers[0]?.color).toBe("#00000040");
    expect(nextValue.layers[1]?.color).toBe("#12345680");
  });

  it("Escape와 pointer-cancel을 presentation cancel로 전달한다", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <BoxShadowEditor
        value={VALUE}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={onCancel}
        presentationOwnsFrameScheduling
      />,
    );
    const editor = container.querySelector(".box-shadow-editor");
    expect(editor).not.toBeNull();

    fireEvent.keyDown(editor!, { key: "Escape" });
    fireEvent.pointerCancel(editor!);
    fireEvent.click(screen.getByText("Color cancel"));

    expect(onCancel).toHaveBeenNthCalledWith(1, "escape");
    expect(onCancel).toHaveBeenNthCalledWith(2, "pointer-cancel");
    expect(onCancel).toHaveBeenNthCalledWith(3, "pointer-cancel");
  });
});
