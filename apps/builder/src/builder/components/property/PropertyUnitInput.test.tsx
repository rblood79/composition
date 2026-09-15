// @vitest-environment jsdom
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useStore } from "../../stores";
import { PropertyUnitInput } from "./PropertyUnitInput";
import {
  BORDER_WIDTH_PRESET_OPTIONS,
  PAGE_GAP_PRESETS,
  SPACING_PRESET_OPTIONS,
} from "./propertyUnitPresets";

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

    useStore.setState({ selectedElementId: "element-1" } as never);
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

  it("keeps an empty constraint unset until a number is entered", () => {
    const onChange = vi.fn();

    useStore.setState({ selectedElementId: "element-1" } as never);
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

      useStore.setState({ selectedElementId: "element-1" } as never);
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
    expect((input as HTMLInputElement).value).toBe("8");

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
    expect((input as HTMLInputElement).value).toBe("24");
    expect(onChange).toHaveBeenLastCalledWith("24px");

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
    fireEvent.click(screen.getByRole("button", { name: "Padding Preset" }));
    fireEvent.click(screen.getByRole("option", { name: "Reset" }));

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("0");
    });
    expect(onChange).toHaveBeenLastCalledWith("");
    expect((input as HTMLInputElement).value).not.toBe("");
  });

  it("선택 대상이 바뀌면 focus 중이어도 새 값을 표시한다", async () => {
    useStore.setState({ selectedElementId: "element-1" } as never);
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
      useStore.setState({ selectedElementId: "element-2" } as never);
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
    useStore.setState({ selectedElementId: null } as never);
  });

  it("▾ 상자 대신 suffix 글자가 단위 목록을 연다", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput
        label="Left"
        labelMode="suffix"
        value="12px"
        units={["px", "%", "vw"]}
        onChange={onChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Show suggestions" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Left Unit" });
    expect(trigger.textContent).toBe("Left");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "%" }));
    expect(onChange).toHaveBeenCalledWith("12%");
  });

  it("▲▼ stepper 는 없다 — 숫자 조정은 화살표 키 (⇧ 10) 로만 (2026-09-15 사용자 판정)", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" } as never);
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

    expect(screen.queryByRole("button", { name: "Increase Font Size" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decrease Font Size" })).toBeNull();
    expect(screen.getByRole("button", { name: "Font Size Unit" }).textContent).toBe("SIZE");
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("15px");
    fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("24px"); // value prop 이 14px 그대로라 14 + 10
  });

  it("키워드 값 (auto) 에는 stepper 를 그리지 않는다", () => {
    useStore.setState({ selectedElementId: "element-1" } as never);
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
    useStore.setState({ selectedElementId: "element-1" } as never);
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
    await waitFor(() => expect(input.placeholder === "fill" || input.value === "fill").toBe(true));
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("legend 모드 unitSuffix — 트리거 글자가 현재 단위 (「8 PX」)", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" } as never);
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

  it("\"fill\" 은 units 에 실린 필드에서만 typed 입력을 받는다", () => {
    const onChange = vi.fn();
    useStore.setState({ selectedElementId: "element-1" } as never);
    render(
      <PropertyUnitInput label="Left" labelMode="suffix" value="12px" units={["px", "%"]} onChange={onChange} />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "fill" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalledWith("fill");
  });
});
