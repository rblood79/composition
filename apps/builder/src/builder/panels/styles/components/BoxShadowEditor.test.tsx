// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoxShadowPresentationValue } from "../../../presentation/boxShadowPresentation";
import { BoxShadowEditor } from "./BoxShadowEditor";

interface UnitInputMockProps {
  readonly label?: string;
  readonly unitSuffix?: boolean;
  readonly labelMode?: string;
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
  readonly showValue?: boolean;
  readonly value: string;
}

vi.mock("../../../components", () => ({
  PropertyColor: ({
    onChange,
    onPresentationCancel,
    onPreview,
    presentationOwnsFrameScheduling,
    showValue,
    value,
  }: ColorMockProps) => (
    <div
      data-testid="shadow-color"
      data-value={value}
      data-show-value={String(showValue)}
      data-frame-owned={String(presentationOwnsFrameScheduling)}
    >
      <button onClick={() => onPreview?.("#12345680")}>Color preview</button>
      <button onClick={() => onChange("#12345680")}>Color commit</button>
      <button onClick={() => onPresentationCancel?.("pointer-cancel")}>
        Color cancel
      </button>
    </div>
  ),
  PropertyUnitInput: ({
    label = "Value",
    labelMode,
    unitSuffix,
    min,
    onChange,
    onDrag,
    value,
  }: UnitInputMockProps) => (
    <div
      data-testid={label}
      data-min={min}
      data-value={value}
      data-label-mode={labelMode ?? "legend"}
      data-unit-suffix={String(Boolean(unitSuffix))}
    >
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

describe("BoxShadowEditor (레이어 하나)", () => {
  afterEach(() => {
    cleanup();
  });

  it("layerIndex 의 레이어만 — px 4 필드 (legend + 단위 트리거) + 「■ HEX」 color", () => {
    render(
      <BoxShadowEditor
        value={VALUE}
        layerIndex={1}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    expect(screen.getByTestId("Offset X").dataset.value).toBe("3px");
    expect(screen.getByTestId("Offset X").dataset.labelMode).toBe("legend");
    expect(screen.getByTestId("Offset X").dataset.unitSuffix).toBe("true");
    expect(screen.getByTestId("Blur").dataset.min).toBe("0");
    expect(screen.getByTestId("Spread").dataset.min).toBe("-9999");
    expect(screen.getByTestId("shadow-color").dataset.value).toBe("#ff000080");
    expect(screen.getByTestId("shadow-color").dataset.showValue).toBe("true");
    expect(screen.getByTestId("shadow-color").dataset.frameOwned).toBe("true");
  });

  it("numeric drag는 typed preview, terminal은 typed commit — 다른 레이어는 그대로", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    render(
      <BoxShadowEditor
        value={VALUE}
        layerIndex={0}
        onPreview={onPreview}
        onCommit={onCommit}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    fireEvent.click(screen.getByLabelText("Offset X preview"));
    expect(
      (onPreview.mock.calls.at(-1)?.[0] as BoxShadowPresentationValue).layers[0]
        ?.offsetX,
    ).toBe(12);

    fireEvent.click(screen.getByLabelText("Spread negative"));
    const committed = onCommit.mock.calls.at(
      -1,
    )?.[0] as BoxShadowPresentationValue;
    expect(committed.layers[0]).toEqual(
      expect.objectContaining({ offsetX: 12, spread: -5 }),
    );
    expect(committed.layers[1]).toEqual(VALUE.layers[1]);

    fireEvent.click(screen.getByLabelText("Blur negative"));
    expect(
      (onCommit.mock.calls.at(-1)?.[0] as BoxShadowPresentationValue).layers[0]
        ?.blur,
    ).toBe(0);
  });

  it("color preview 는 runtime owner 에 위임하고 선택 레이어만 바꾼다", () => {
    const onPreview = vi.fn();
    render(
      <BoxShadowEditor
        value={VALUE}
        layerIndex={1}
        onPreview={onPreview}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );

    fireEvent.click(screen.getByText("Color preview"));
    const nextValue = onPreview.mock.calls.at(
      -1,
    )?.[0] as BoxShadowPresentationValue;
    expect(nextValue.layers[0]?.color).toBe("#00000040");
    expect(nextValue.layers[1]?.color).toBe("#12345680");
  });

  it("없는 layerIndex 는 아무것도 그리지 않는다", () => {
    const { container } = render(
      <BoxShadowEditor
        value={VALUE}
        layerIndex={5}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );
    expect(container.querySelector(".box-shadow-editor")).toBeNull();
  });

  it("Escape와 pointer-cancel을 presentation cancel로 전달한다", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <BoxShadowEditor
        value={VALUE}
        layerIndex={0}
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
