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
