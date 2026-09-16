/**
 * ADR-209 후속 F1 — `PropertySelect` 두 값 모드 상호 회귀.
 *
 * legacy 모드는 기존 스타일 초기화(`reset` → `""`) 계약을 그대로 유지하고, literal 모드는
 * 원본 문자열을 손실 없이 전달한다. 두 모드가 서로의 동작을 바꾸지 않는 것이 통과 조건이다.
 */
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PropertySelect } from "./PropertySelect";

afterEach(cleanup);

function open(ui: ReturnType<typeof render>, label: string): void {
  fireEvent.click(
    within(ui.getByRole("group", { name: label })).getByRole("button"),
  );
}

it("legacy 모드는 reset 항목을 빈 값 초기화 명령으로 유지한다", () => {
  const onChange = vi.fn();
  const ui = render(
    <PropertySelect
      label="Align"
      value="start"
      onChange={onChange}
      translateOptions={false}
      options={[
        { value: "reset", label: "Default" },
        { value: "start", label: "Start" },
      ]}
    />,
  );
  // 빈 값 + reset 항목 존재 → 트리거가 reset 항목을 선택 상태로 보여준다 (기존 계약).
  const { rerender } = ui;
  rerender(
    <PropertySelect
      label="Align"
      value=""
      onChange={onChange}
      translateOptions={false}
      options={[
        { value: "reset", label: "Default" },
        { value: "start", label: "Start" },
      ]}
    />,
  );
  expect(
    within(ui.getByRole("group", { name: "Align" })).getByRole("button")
      .textContent,
  ).toContain("Default");
  rerender(
    <PropertySelect
      label="Align"
      value="start"
      onChange={onChange}
      translateOptions={false}
      options={[
        { value: "reset", label: "Default" },
        { value: "start", label: "Start" },
      ]}
    />,
  );
  open(ui, "Align");
  fireEvent.click(ui.getByRole("option", { name: "Default" }));
  expect(onChange).toHaveBeenCalledWith("");
});

it("literal 모드는 `reset` 이라는 원본 값을 그대로 전달한다", () => {
  const onChange = vi.fn();
  const ui = render(
    <PropertySelect
      label="Series"
      value=""
      onChange={onChange}
      translateOptions={false}
      optionValueMode="literal"
      options={[
        { value: "", label: "없음" },
        { value: "reset", label: "reset" },
      ]}
    />,
  );
  open(ui, "Series");
  fireEvent.click(ui.getByRole("option", { name: "reset" }));
  expect(onChange).toHaveBeenCalledWith("reset");
});

it("literal 모드에서 빈 문자열은 표시되는 유효 항목이다", () => {
  const onChange = vi.fn();
  const ui = render(
    <PropertySelect
      label="Series"
      value=""
      onChange={onChange}
      translateOptions={false}
      optionValueMode="literal"
      options={[
        { value: "", label: "없음" },
        { value: "series", label: "series" },
      ]}
    />,
  );
  expect(
    within(ui.getByRole("group", { name: "Series" })).getByRole("button")
      .textContent,
  ).toContain("없음");
  open(ui, "Series");
  fireEvent.click(ui.getByRole("option", { name: "series" }));
  expect(onChange).toHaveBeenCalledWith("series");
});

it("literal 모드의 UI key 는 서로 다른 원본 문자열을 충돌시키지 않는다", () => {
  const onChange = vi.fn();
  const values = ["", "reset", 'value:""', "값", "Series"];
  const options = values.map((value) => ({
    value,
    label: value === "" ? "없음" : value,
  }));
  const ui = render(
    <PropertySelect
      label="Series"
      value="unselected"
      onChange={onChange}
      translateOptions={false}
      optionValueMode="literal"
      options={options}
    />,
  );
  open(ui, "Series");
  const ids = ui.getAllByRole("option").map((option) => option.id);
  expect(ids.every((id) => id.length > 0)).toBe(true);
  expect(new Set(ids).size).toBe(values.length);
  // 각 항목이 자기 원본 문자열을 그대로 돌려주는지 — 매번 새로 렌더해 팝오버 상태를 분리한다.
  for (const raw of values) {
    cleanup();
    const perValue = vi.fn();
    const scoped = render(
      <PropertySelect
        label="Series"
        value="unselected"
        onChange={perValue}
        translateOptions={false}
        optionValueMode="literal"
        options={options}
      />,
    );
    open(scoped, "Series");
    fireEvent.click(
      scoped.getByRole("option", { name: raw === "" ? "없음" : raw }),
    );
    expect(perValue).toHaveBeenCalledWith(raw);
  }
});

it("literal 모드에서 현재 값이 options 에 없으면 선택 없음이며 값을 발행하지 않는다", () => {
  const onChange = vi.fn();
  const ui = render(
    <PropertySelect
      label="Series"
      value="dropped-column"
      onChange={onChange}
      translateOptions={false}
      optionValueMode="literal"
      options={[{ value: "series", label: "series" }]}
    />,
  );
  expect(
    within(ui.getByRole("group", { name: "Series" })).getByRole("button")
      .textContent,
  ).not.toContain("dropped-column");
  expect(onChange).not.toHaveBeenCalled();
});

// 2026-09-16 「A 팝오버 grid」 — 값이 곧 색인 variant 는 팝오버가 6열 스와치 격자 (구획 + 체크).
it("grid 모드 — 팝오버는 구획별 격자, 트리거는 색 점 + 이름, 선택은 값 그대로", () => {
  const onChange = vi.fn();
  const options = [
    { value: "accent", label: "Accent" },
    { value: "negative", label: "Negative" },
    { value: "red", label: "Red" },
    { value: "purple", label: "Purple" },
  ];
  const swatches = { accent: "blue", negative: "crimson", red: "red", purple: "purple" };
  const ui = render(
    <PropertySelect
      label="Variant"
      value="purple"
      onChange={onChange}
      translateOptions={false}
      options={options}
      swatches={swatches}
      grid
      gridSections={[["accent", "negative"], ["red", "purple"]]}
    />,
  );
  const trigger = within(ui.getByRole("group", { name: "Variant" })).getByRole("button");
  expect(trigger.textContent).toContain("Purple");
  expect(trigger.querySelector(".property-select__swatch")).not.toBeNull();

  open(ui, "Variant");
  const listbox = ui.getByRole("listbox");
  expect(listbox.classList.contains("property-select-grid")).toBe(true);
  expect(listbox.querySelectorAll(".property-select-grid__section")).toHaveLength(2);
  // 칸은 스와치뿐 · 접근 이름은 textValue · 선택 칸엔 체크
  const purple = ui.getByRole("option", { name: "Purple" });
  expect(purple.querySelector(".property-select-grid__check")).not.toBeNull();
  expect(ui.getByRole("option", { name: "Red" }).querySelector(".property-select-grid__check")).toBeNull();
  fireEvent.click(ui.getByRole("option", { name: "Red" }));
  expect(onChange).toHaveBeenCalledWith("red");
});

it("grid 모드 — 구획에 없는 값은 마지막 구획 뒤에 선다", () => {
  const ui = render(
    <PropertySelect
      label="Variant"
      value="a"
      onChange={vi.fn()}
      translateOptions={false}
      options={[{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]}
      grid
      gridSections={[["a"]]}
    />,
  );
  open(ui, "Variant");
  const sections = ui.getByRole("listbox").querySelectorAll(".property-select-grid__section");
  expect(sections).toHaveLength(2);
  expect(within(sections[1] as HTMLElement).getAllByRole("option").map((o) => o.textContent || o.getAttribute("aria-label"))).toHaveLength(2);
});

// 2026-09-16 사용자 지적 — 반복되는 모양은 클래스, 변하는 색만 인라인
it("색 점은 클래스가 모양을 맡고 인라인은 background 하나뿐", () => {
  const swatches = { accent: "var(--accent)", negative: "var(--negative)" };
  render(
    <PropertySelect
      label="Variant"
      value="accent"
      onChange={() => {}}
      options={[
        { value: "accent", label: "Accent" },
        { value: "negative", label: "Negative" },
      ]}
      swatches={swatches}
    />,
  );
  const dot = document.querySelector(
    ".property-select__swatch",
  ) as HTMLElement;
  expect(dot).not.toBeNull();
  expect(dot.style.background).toBe("var(--accent)");
  expect(dot.style.length).toBe(1);
});
