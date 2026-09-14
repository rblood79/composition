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

interface RowMenuMockProps {
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly isDisabled?: boolean;
  }>;
  readonly label: string;
  readonly onAction: (id: string) => void;
}

vi.mock("../../../components", () => ({
  PropertyRowMenu: ({ items, label, onAction }: RowMenuMockProps) => (
    <div data-testid="layer-menu" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          disabled={item.isDisabled}
          onClick={() => onAction(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
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
        onTopologyCommit={vi.fn()}
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
        onTopologyCommit={vi.fn()}
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
        onTopologyCommit={vi.fn()}
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

  it("레이어 추가 · inset · 제거는 topology commit 으로 보내고 다음 활성 인덱스를 알린다", () => {
    const onCommit = vi.fn();
    const onTopologyCommit = vi.fn();
    render(
      <BoxShadowEditor
        value={VALUE}
        initialLayerIndex={1}
        onPreview={vi.fn()}
        onCommit={onCommit}
        onCancel={vi.fn()}
        onTopologyCommit={onTopologyCommit}
        presentationOwnsFrameScheduling
      />,
    );

    // initialLayerIndex=1 → 활성 레이어는 inset 인 Layer 2 → 메뉴 라벨이 "Make outer"
    expect(screen.getByText("Outer shadow layer")).toBeTruthy();
    expect(screen.getByTestId("Offset X").dataset.value).toBe("3px");

    fireEvent.click(screen.getByText("Add shadow layer"));
    expect(onTopologyCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ layers: expect.any(Array) }),
      2,
    );
    expect(
      (onTopologyCommit.mock.calls.at(-1)?.[0] as BoxShadowPresentationValue)
        .layers,
    ).toHaveLength(3);

    fireEvent.click(screen.getByText("Outer shadow layer"));
    expect(
      (onTopologyCommit.mock.calls.at(-1)?.[0] as BoxShadowPresentationValue)
        .layers[1]?.inset,
    ).toBe(false);
    expect(onTopologyCommit.mock.calls.at(-1)?.[1]).toBe(1);

    fireEvent.click(screen.getByText("Remove shadow layer"));
    const removed = onTopologyCommit.mock.calls.at(
      -1,
    )?.[0] as BoxShadowPresentationValue;
    expect(removed.layers).toHaveLength(1);
    expect(removed.layers[0]?.color).toBe("#00000040");
    expect(onTopologyCommit.mock.calls.at(-1)?.[1]).toBe(0);
    // 연속 편집 커밋 경로는 건드리지 않는다
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("레이어가 하나면 제거 항목이 비활성이다", () => {
    render(
      <BoxShadowEditor
        value={{ layers: [VALUE.layers[0]!] }}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        onTopologyCommit={vi.fn()}
        presentationOwnsFrameScheduling
      />,
    );
    expect(
      (screen.getByText("Remove shadow layer") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText("Inset shadow layer")).toBeTruthy();
  });

  it("Escape와 pointer-cancel을 presentation cancel로 전달한다", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <BoxShadowEditor
        value={VALUE}
        onPreview={vi.fn()}
        onCommit={vi.fn()}
        onCancel={onCancel}
        onTopologyCommit={vi.fn()}
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
