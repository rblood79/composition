// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FillType, type ColorFillItem } from "../../../../types/builder/fill.types";

interface PickerMockProps {
  readonly value: string;
  readonly onChange: (color: string) => void;
  readonly onChangeEnd: (color: string) => void;
}

vi.mock("./ColorPickerPanel", () => ({
  ColorPickerPanel: ({ value, onChange, onChangeEnd }: PickerMockProps) => (
    <div data-testid="picker" data-value={value}>
      <button onClick={() => onChange("#2563EB40")}>drag alpha 25</button>
      <button onClick={() => onChangeEnd("#FF000080")}>end rgb only</button>
      <button onClick={() => onChangeEnd("#2563EB40")}>end alpha only</button>
    </div>
  ),
}));
vi.mock("./FillTypeSelector", () => ({ FillTypeSelector: () => <div /> }));
vi.mock("./GradientEditor", () => ({ GradientEditor: () => <div /> }));
vi.mock("./MeshGradientEditor", () => ({ MeshGradientEditor: () => <div /> }));
vi.mock("./ImageFillEditor", () => ({ ImageFillEditor: () => <div /> }));
vi.mock("../../../components", () => ({ PropertySelect: () => <div /> }));

import { FillDetailPopover } from "./FillDetailPopover";

const fill = (color: string, opacity: number): ColorFillItem => ({
  id: "f1",
  type: FillType.Color,
  color,
  enabled: true,
  opacity,
  blendMode: "normal",
});

function renderPopover(item: ColorFillItem) {
  const handlers = {
    onColorChange: vi.fn(),
    onColorChangeEnd: vi.fn(),
    onOpacityChange: vi.fn(),
    onOpacityChangeEnd: vi.fn(),
    onUpdate: vi.fn(),
    onUpdateEnd: vi.fn(),
    onTypeChange: vi.fn(),
  };
  render(<FillDetailPopover fill={item} {...handlers} />);
  return handlers;
}

afterEach(() => cleanup());

describe("FillDetailPopover — 단색 fill 의 피커 알파 = 레이어 opacity (2026-09-15)", () => {
  it("피커 값은 색 rgb + fill.opacity 알파", () => {
    renderPopover(fill("#2563EBFF", 0.5));
    expect(screen.getByTestId("picker").dataset.value).toBe("#2563EB80");
  });

  it("rgb 만 바뀌면 색 경로 (…FF), 알파만 바뀌면 opacity 경로", () => {
    const h = renderPopover(fill("#2563EBFF", 0.5));
    fireEvent.click(screen.getByText("end rgb only"));
    expect(h.onColorChangeEnd).toHaveBeenCalledWith("#FF0000FF");
    expect(h.onOpacityChangeEnd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("end alpha only"));
    expect(h.onOpacityChangeEnd).toHaveBeenLastCalledWith(0x40 / 255);
    expect(h.onColorChangeEnd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("drag alpha 25"));
    expect(h.onOpacityChange).toHaveBeenLastCalledWith(0x40 / 255);
    expect(h.onColorChange).not.toHaveBeenCalled();
  });

  it("종전 문서의 색 알파는 열릴 때 한 번 opacity 로 접는다 (알파 × opacity, 색 …FF)", () => {
    const h = renderPopover(fill("#FF000080", 0.5));
    expect(h.onUpdateEnd).toHaveBeenCalledTimes(1);
    expect(h.onUpdateEnd).toHaveBeenCalledWith({ color: "#FF0000FF", opacity: 0.251 });
  });

  it("색 알파가 FF 면 접지 않는다", () => {
    const h = renderPopover(fill("#FF0000FF", 0.5));
    expect(h.onUpdateEnd).not.toHaveBeenCalled();
  });
});
