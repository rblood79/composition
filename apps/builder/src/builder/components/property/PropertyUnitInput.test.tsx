// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { useState, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { create } from "zustand";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PropertyUnitInput } from "./PropertyUnitInput";
import {
  PropertySelectionContext,
  type PropertySelectionSource,
} from "./propertySelection";
import {
  BORDER_WIDTH_PRESET_OPTIONS,
  SPACING_PRESET_OPTIONS,
} from "./propertyUnitPresets";

/** Number presets (no token) — a field whose preset values are plain numbers. */
const PAGE_GAP_PRESETS = [
  { id: "sm", label: "S", value: "40" },
  { id: "md", label: "M", value: "80" },
  { id: "lg", label: "L", value: "120" },
] as const;

// The selection the field edits (the catalog Builder provides its session's selection).
const useStore = create<{ selectedElementId: string | null }>(() => ({
  selectedElementId: null,
}));
const selection: PropertySelectionSource = {
  useSelectedId: () => useStore((state) => state.selectedElementId),
  readSelectedId: () => useStore.getState().selectedElementId,
};
function SelectionProvider({ children }: { children: ReactNode }) {
  return (
    <PropertySelectionContext.Provider value={selection}>
      {children}
    </PropertySelectionContext.Provider>
  );
}
const render = (ui: Parameters<typeof rtlRender>[0]) =>
  rtlRender(ui, { wrapper: SelectionProvider });

const FORM_CONTROLS_CSS = readFileSync(
  "src/builder/components/styles/form-controls.css",
  "utf8",
);

describe("PropertyUnitInput numeric editing", () => {
  beforeAll(() => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
  });

  afterEach(() => {
    cleanup();
    useStore.setState({ selectedElementId: null });
  });

  it("keeps typing local and commits the final value on Enter", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
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

  it("an explicit empty unit in the list is the unit of a unitless value (ADR-274 Settings columns)", () => {
    const onChange = vi.fn();
    render(
      <PropertyUnitInput
        label="Columns"
        value="10"
        units={["", "%"]}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Columns" });
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Not `2%` — `%` is another mode of this field, not a fallback for "no unit".
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("keeps the local draft when the parent rerenders with an unchanged value", () => {
    // parsed 는 value 에 memo 된 파생값이라 부모 재렌더만으로는 sync effect 가 다시 돌면 안 된다.
    const onChange = vi.fn();
    function Host() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick(tick + 1)}>
            rerender {tick}
          </button>
          <PropertyUnitInput
            label="Gap"
            value="12px"
            units={["reset", "px"]}
            onChange={onChange}
            onDrag={vi.fn()}
          />
        </>
      );
    }

    useStore.setState({ selectedElementId: "element-1" });
    render(<Host />);

    const input = screen.getByRole("combobox", { name: "Gap" });
    fireEvent.change(input, { target: { value: "1234" } });
    expect((input as HTMLInputElement).value).toBe("1234");

    fireEvent.click(screen.getByRole("button", { name: /rerender/ }));

    expect((input as HTMLInputElement).value).toBe("1234");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits on blur when Enter is not pressed", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
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

  it("Size 메뉴의 현재 Fixed 재선택이 Enter 숫자 commit을 덮지 않는다", async () => {
    const onChange = vi.fn();
    const onModeChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState("100%");
      return (
        <PropertyUnitInput
          label="Height"
          value={value}
          unitSuffix
          units={["reset", "px", "%", "vh", "fill", "fit-content"]}
          sizeControl={{
            kind: "css",
            computed: 796,
            onModeChange: (unit) => {
              onModeChange(unit);
              if (unit === "px") setValue("796px");
            },
          }}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }

    useStore.setState({ selectedElementId: "element-1" });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Height Size mode" }));
    fireEvent.click(screen.getByRole("option", { name: "Fixed" }));
    await waitFor(() => {
      expect(
        (screen.getByRole("combobox", { name: "Height" }) as HTMLInputElement)
          .value,
      ).toBe("796");
    });

    const input = screen.getByRole("combobox", { name: "Height" });
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onModeChange.mock.calls).toEqual([["px"]]);
    expect(onChange).toHaveBeenLastCalledWith("300px");
  });

  it("Size mode menu: Reset first, and choosing the mode it already has writes nothing", () => {
    // live 2026-11-13: a page body's Height (Fit content) — Escape on the open menu re-announced
    // the selected key and wrote an empty "Edit size" step.
    const onModeChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Height"
        value="fit-content"
        unitSuffix
        units={["reset", "px", "%", "vh", "fill", "fit-content"]}
        sizeControl={{ kind: "fit", computed: 900, onModeChange }}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Height Size mode" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Reset", "Fixed", "Fill", "Fit content", "Parent", "Viewport"]);
    fireEvent.click(screen.getByRole("option", { name: "Fit content" }));
    expect(onModeChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Height Size mode" }));
    fireEvent.click(screen.getByRole("option", { name: "Fixed" }));
    expect(onModeChange.mock.calls).toEqual([["px"]]);
  });

  it("메뉴를 연 적 없는 첫 Enter 가 onModeChange 를 내지 않는다 (RAC 의 닫힌 메뉴 재방출 차단)", () => {
    // 사용자 live 2026-09-20: 요소를 바꾼 뒤 (key 로 remount) 첫 Enter 마다 RAC ComboBox 가 같은 key
    //   ("px") 로 onSelectionChange 를 내고 → onModeChange("px") 가 stale 측정값을 다시 commit 해 방금 친
    //   값을 덮었다 (200 → 250 Enter 가 200 으로, Tab 은 정상). 닫힌 메뉴에서 온 선택은 무시한다.
    const onChange = vi.fn();
    const onModeChange = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Width"
        value="200px"
        unitSuffix
        units={["reset", "px", "%", "vw", "fill", "fit-content"]}
        sizeControl={{ kind: "css", computed: 200, onModeChange }}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Width" });
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange.mock.calls).toEqual([["250px"]]);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  // 2026-11-10: 숫자 칸 기본 앞 표시는 `#`, `icon={null}` 이면 없음 (Size Width · Height 사용자 지정).
  it("defaults the prefix glyph and drops it for icon={null}", () => {
    useStore.setState({ selectedElementId: "element-1" });
    const { container, rerender } = render(
      <PropertyUnitInput label="Gap" value="8px" onChange={vi.fn()} />,
    );
    expect(container.querySelector(".control-label svg")).toBeTruthy();
    rerender(
      <PropertyUnitInput label="Gap" value="8px" icon={null} onChange={vi.fn()} />,
    );
    expect(container.querySelector(".control-label")).toBeNull();
  });

  // 2026-11-10 사용자 지정: Ratio 를 고르면 종속 축 (Height) 은 입력 불가, 칸은 「Auto」 가 아니라
  //   계산된 px (자리 글자) 와 단위 px.
  it("disables the ratio-driven axis and keeps its computed px instead of Auto", () => {
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Height"
        value="auto"
        unitSuffix
        units={["reset", "px", "%", "vh", "fill", "fit-content"]}
        sizeControl={{ kind: "ratio", computed: 120, onModeChange: vi.fn() }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByRole("combobox");
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(input.getAttribute("placeholder")).toBe("120");
    const trigger = screen.getByRole("button", { name: /Size mode/ });
    expect(trigger.textContent).toBe("px");
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });

  it("Size 모드 suffix는 fr/%/vh/px/fit 토큰의 소문자를 보존한다", () => {
    expect(FORM_CONTROLS_CSS).toMatch(
      /\.property-unit-input\[data-size-control="true"\][\s\S]*?\.property-unit-input__suffix\s*\{[\s\S]*?text-transform:\s*none;/,
    );
  });

  it("keeps arrow-key increments on the preview path", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
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

  it("adds up arrow-key steps while the previewed value prop stays (a host preview off the document)", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Gap"
        value="0px"
        units={["reset", "px"]}
        presets={SPACING_PRESET_OPTIONS}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Gap" });
    input.focus();
    for (let index = 0; index < 3; index += 1)
      fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });

    expect(onDrag.mock.calls.map(([value]) => value)).toEqual([
      "10px",
      "20px",
      "30px",
    ]);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("30px");
  });

  it("a typed step name is the token (xs → var(--spacing-xs)); ↑ from a token steps its px (2026-11-10)", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Gap"
        value="var(--spacing-md)"
        units={["reset", "px"]}
        presets={SPACING_PRESET_OPTIONS}
        onChange={onChange}
        onDrag={onDrag}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Gap" }) as HTMLInputElement;
    expect(input.value).toBe("M");
    input.focus();
    // ↑ steps the token's resolved px (the literal escape), not from 0
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDrag).toHaveBeenLastCalledWith(
      `${Number(input.title.replace(/^M · |px$/g, "")) + 1}px`,
    );
    fireEvent.change(input, { target: { value: "xs" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("var(--spacing-xs)");
  });

  it("commits the arrow-key value on the following blur", () => {
    const onChange = vi.fn();
    const onDrag = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
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

  // /fix (2026-11-02): RAC ComboBox opens the closed preset list on ↑/↓ (`state.open('last')`) and
  //   moves its virtual focus; Tab then commits that focused option (`if (state.isOpen) state.commit()`)
  //   — ↑×3 Tab on Gap 0 stored M (12), ↑×30 Tab stored Reset (value removed). Enter was fine.
  it("↑ on a preset field steps the number only — Tab then commits the number, not a list option", () => {
    for (const [presses, expected] of [
      [3, "3px"],
      [30, "30px"],
    ] as const) {
      const onChange = vi.fn();
      useStore.setState({ selectedElementId: "element-1" });
      render(
        <PropertyUnitInput
          label="Gap"
          value="0px"
          units={["px"]}
          presets={SPACING_PRESET_OPTIONS}
          onChange={onChange}
          onDrag={vi.fn()}
        />,
      );
      const input = screen.getByRole("combobox", { name: "Gap" });
      fireEvent.focus(input);
      for (let i = 0; i < presses; i += 1)
        fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.getAttribute("aria-expanded"), "↑ must not open the list").not.toBe("true");
      fireEvent.keyDown(input, { key: "Tab" });
      fireEvent.blur(input);
      expect(onChange.mock.calls.at(-1)?.[0], `↑×${presses} Tab`).toBe(expected);
      cleanup();
    }
  });

  it("with the preset list open, ↑/↓ move through the list and leave the number alone", async () => {
    const onDrag = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Gap"
        value="0px"
        units={["px"]}
        presets={SPACING_PRESET_OPTIONS}
        presetAriaLabel="Gap presets"
        onChange={vi.fn()}
        onDrag={onDrag}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gap presets" }));
    });
    const input = screen.getByRole("combobox", { name: "Gap" });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onDrag).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("0");
  });

  it("keeps an empty constraint unset until a number is entered", () => {
    const onChange = vi.fn();

    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Min W"
        value=""
        units={["reset", "px", "%", "vw"]}
        preserveEmptyValueOnUnitChange
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Min W" });
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Show suggestions" }));
    fireEvent.click(screen.getByRole("option", { name: "%" }));

    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.change(input, { target: { value: "24" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("24%");
  });

  it.each(["Enter", "blur"] as const)(
    "clears an optional positioned offset on %s",
    (commitMethod) => {
      const onChange = vi.fn();

      useStore.setState({ selectedElementId: "element-1" });
      render(
        <PropertyUnitInput
          label="Left"
          value="24px"
          units={["px", "%", "vw"]}
          allowEmptyReset
          onChange={onChange}
        />,
      );

      const input = screen.getByRole("combobox", { name: "Left" });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "" } });
      if (commitMethod === "Enter") {
        fireEvent.keyDown(input, { key: "Enter" });
      } else {
        fireEvent.blur(input);
      }

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("");
    },
  );

  // Grid Columns · Rows (2026-10-15 사용자 지적): 이름이 곧 값인 preset 은 「3」 하나 — 「3 · 3」 아님.
  it("preset 이름이 값과 같으면 메뉴 항목은 이름 하나만 보인다", async () => {
    render(
      <PropertyUnitInput
        label="Columns"
        value="2"
        units={[]}
        allowKeywords={false}
        presets={[1, 2, 3].map((n) => ({ id: String(n), label: String(n), value: String(n) }))}
        presetAriaLabel="Columns Preset"
        onChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Columns Preset" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["1", "2", "3"]);
  });

  it("preset은 trigger에 선택값을 표시하지 않고 숫자 입력값만 교체한다", async () => {
    const onChange = vi.fn();

    function PageGapHarness() {
      const [value, setValue] = useState("80");
      return (
        <PropertyUnitInput
          label="Page Gap"
          value={value}
          units={[]}
          allowKeywords={false}
          presets={PAGE_GAP_PRESETS}
          presetAriaLabel="Page Gap Preset"
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          }}
        />
      );
    }

    render(<PageGapHarness />);
    await act(async () => {
      await Promise.resolve();
    });

    const input = screen.getByRole("combobox", { name: "Page Gap" });
    const trigger = screen.getByRole("button", { name: "Page Gap Preset" });
    expect(trigger.textContent).toBe("");

    fireEvent.click(trigger);
    expect(
      screen.getByRole("option", { name: "M" }).getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("option", { name: "L" }));

    expect((input as HTMLInputElement).value).toBe("120");
    expect(trigger.textContent).toBe("");
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "L" })).toBeNull();
    });
    expect(onChange).toHaveBeenCalledWith("120");

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "L" }).getAttribute("aria-selected"),
      ).toBe("true");
    });
    fireEvent.click(screen.getByRole("option", { name: "L" }));

    fireEvent.change(input, { target: { value: "95" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(trigger);

    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-selected") !== "true"),
    ).toBe(true);
  });

  it("token preset은 input과 목록의 선택 상태를 함께 유지하고 Reset은 빈 값으로 지운다", async () => {
    const onChange = vi.fn();
    const tokenValues = {
      "--spacing-xs": "0.25rem",
      "--spacing-sm": "0.5rem",
      "--spacing-md": "0.75rem",
      "--spacing-lg": "1rem",
      "--spacing-xl": "1.5rem",
    };
    Object.entries(tokenValues).forEach(([name, tokenValue]) => {
      document.documentElement.style.setProperty(name, tokenValue);
    });

    function TokenHarness() {
      const [value, setValue] = useState("var(--spacing-sm)");
      return (
        <PropertyUnitInput
          label="Padding"
          value={value}
          units={[]}
          allowKeywords={false}
          presets={SPACING_PRESET_OPTIONS}
          presetAriaLabel="Padding Preset"
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue);
          }}
        />
      );
    }

    render(<TokenHarness />);
    await act(async () => {
      await Promise.resolve();
    });

    const input = screen.getByRole("combobox", { name: "Padding" });
    const trigger = screen.getByRole("button", { name: "Padding Preset" });
    // 토큰 값은 칸에 단계 이름 (2026-11-10 사용자 결정) — 지금 테마의 px 는 title
    expect((input as HTMLInputElement).value).toBe("S");
    expect((input as HTMLInputElement).title).toBe("S · 8px");

    fireEvent.click(trigger);
    expect(
      screen.getByRole("option", { name: "S" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen
        .getAllByRole("option")
        .map((option) => option.textContent)
        .join(","),
    ).toBe("Reset,XS · 4,S · 8,M · 12,L · 16,XL · 24"); // 토큰 이름 + 풀린 px (접근 이름은 토큰 이름)

    fireEvent.click(screen.getByRole("option", { name: "XL" }));
    expect((input as HTMLInputElement).value).toBe("XL");
    // ADR-298 D4: the preset commits the token itself — the node keeps the reference.
    expect(onChange).toHaveBeenLastCalledWith("var(--spacing-xl)");
    // 칩 없음 · 버튼은 ▾ 그대로
    expect(document.querySelector(".property-unit-input__token")).toBeNull();
    expect(trigger.querySelector("svg")).not.toBeNull();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(
        screen
          .getByRole("option", { name: "XL" })
          .getAttribute("aria-selected"),
      ).toBe("true");
    });

    fireEvent.click(screen.getByRole("option", { name: "Reset" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith("");

    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-selected") !== "true"),
    ).toBe(true);
  });

  it("Reset 선택 후에는 placeholder 대신 reset된 prop 값을 표시한다", async () => {
    const onChange = vi.fn();

    function ResetHarness() {
      const [value, setValue] = useState("8px");
      return (
        <PropertyUnitInput
          label="Padding"
          value={value}
          units={[]}
          allowKeywords={false}
          presets={[
            { id: "reset", label: "Reset", value: "" },
            { id: "sm", label: "S", value: "8px" },
          ]}
          presetAriaLabel="Padding Preset"
          onChange={(nextValue) => {
            onChange(nextValue);
            setValue(nextValue === "" ? "0px" : nextValue);
          }}
        />
      );
    }

    render(<ResetHarness />);
    const input = screen.getByRole("combobox", { name: "Padding" });
    fireEvent.click(screen.getByRole("button", { name: /^Padding Preset/ }));
    fireEvent.click(screen.getByRole("option", { name: "Reset" }));

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("0");
    });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect((input as HTMLInputElement).value).not.toBe("");
  });

  it("선택 대상이 바뀌면 focus 중이어도 새 값을 표시한다", async () => {
    useStore.setState({ selectedElementId: "element-1" });
    const { rerender } = render(
      <PropertyUnitInput
        label="Padding"
        value="8px"
        units={[]}
        allowKeywords={false}
        presets={[{ id: "sm", label: "S", value: "8px" }]}
        presetAriaLabel="Padding Preset"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Padding" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "99" } });

    act(() => {
      useStore.setState({ selectedElementId: "element-2" });
      rerender(
        <PropertyUnitInput
          label="Padding"
          value="24px"
          units={[]}
          allowKeywords={false}
          presets={[{ id: "lg", label: "L", value: "24px" }]}
          presetAriaLabel="Padding Preset"
          onChange={vi.fn()}
        />,
      );
    });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("24");
    });
  });

  it("Reset은 기본 숫자값에서도 preset check를 표시하지 않는다", () => {
    render(
      <PropertyUnitInput
        label="Border Width"
        value="0px"
        units={[]}
        allowKeywords={false}
        presets={BORDER_WIDTH_PRESET_OPTIONS}
        presetAriaLabel="Border Width Preset"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Border Width Preset" }),
    );

    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-selected") !== "true"),
    ).toBe(true);
  });
});

describe("PropertyUnitInput labelMode=suffix — suffix 가 단위 메뉴 트리거 · ▲▼ stepper (panel-ui 05 #3 · 06)", () => {
  beforeAll(() => {
    vi.stubGlobal("CSS", { escape: (value: string) => value });
  });

  afterEach(() => {
    cleanup();
    useStore.setState({ selectedElementId: null });
  });

  it("▾ 상자 대신 suffix 글자가 단위 목록을 연다", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Left"
        labelMode="suffix"
        value="12px"
        units={["px", "%", "vw"]}
        onChange={onChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Show suggestions" }),
    ).toBeNull();
    const trigger = screen.getByRole("button", { name: "Left Unit" });
    expect(trigger.textContent).toBe("Left");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "%" }));
    expect(onChange).toHaveBeenCalledWith("12%");
  });

  it("▲▼ stepper 는 없다 — 숫자 조정은 화살표 키 (⇧ 10) 로만 (2026-09-15 사용자 판정)", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Font Size"
        labelMode="suffix"
        suffixLabel="SIZE"
        value="14px"
        units={["reset", "px"]}
        onChange={onChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Increase Font Size" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Decrease Font Size" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Font Size Unit" }).textContent,
    ).toBe("SIZE");
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("15px");
    fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
    // 보이는 편집값 (15) 에서 + 10 — value prop 이 14px 그대로여도 (미리보기가 문서에 쓰지 않는 host)
    expect(onChange).toHaveBeenLastCalledWith("25px");
  });

  it("키워드 값 (auto) 에는 stepper 를 그리지 않는다", () => {
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Top"
        labelMode="suffix"
        value="auto"
        units={["px", "%", "vh"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Increase Top" })).toBeNull();
    expect(screen.getByRole("button", { name: "Top Unit" })).toBeTruthy();
  });
  it("메뉴에서 키워드를 고른 뒤 input 이 focus 를 돌려받아도 blur 가 옛 값을 다시 commit 하지 않는다", async () => {
    // 2026-09-15 live: W 「fit」 상태에서 fill 선택 → RAC 가 input 에 focus 복귀 → 동기화 skip →
    //   blur 가 「fit」 (fit-content) 를 commit 해 fill 을 덮었다.
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    function Host() {
      const [value, setValue] = useState("fit-content");
      return (
        <PropertyUnitInput
          label="Width"
          labelMode="suffix"
          suffixLabel="W"
          value={value}
          units={["reset", "px", "%", "fit-content", "fill"]}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "Width Unit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "fill" }));
    });
    expect(onChange).toHaveBeenLastCalledWith("fill");
    await waitFor(() =>
      expect(input.placeholder === "fill" || input.value === "fill").toBe(true),
    );
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("legend 모드 unitSuffix — 트리거 글자가 현재 단위 (「8 PX」)", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Gap"
        value="8px"
        units={["px", "reset"]}
        unitSuffix
        allowKeywords={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Gap").tagName).toBe("LEGEND");
    const trigger = screen.getByRole("button", { name: "Gap Unit" });
    expect(trigger.textContent).toBe("px");
    expect(screen.queryByRole("button", { name: "Increase Gap" })).toBeNull();
  });

  it('"fill" 은 units 에 실린 필드에서만 typed 입력을 받는다', () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" });
    render(
      <PropertyUnitInput
        label="Left"
        labelMode="suffix"
        value="12px"
        units={["px", "%"]}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "fill" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalledWith("fill");
  });
});
