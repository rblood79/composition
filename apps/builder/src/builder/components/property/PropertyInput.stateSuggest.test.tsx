// @vitest-environment jsdom
/**
 * ADR-214 Phase 3 — PropertyInput `{{` 자동완성: 캐럿 앞 `{{ 접두` 에서만 목록, 접두 필터,
 * ArrowDown/Enter 로 `{{ name }}` 삽입 (저장은 종전 Enter/blur 규칙), Escape 닫힘, stateNames
 * 없으면 종전 입력 그대로.
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyInput } from "./PropertyInput";

afterEach(cleanup);

function type(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
}

describe("PropertyInput — `{{` 자동완성", () => {
  it("`{{ u` → userName 만 · Enter 로 `{{ userName }}` 삽입 · 목록 닫힘 · 두 번째 Enter 가 저장", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PropertyInput
        label="Text"
        value=""
        onChange={onChange}
        stateNames={["userName", "count"]}
      />,
    );
    const input = container.querySelector("input")!;
    expect(container.querySelector(".property-input-suggest")).toBeNull();
    type(input, "Hello {{ u");
    input.setSelectionRange(10, 10);
    type(input, "Hello {{ u");
    const items = () =>
      [...container.querySelectorAll(".property-input-suggest-item")].map(
        (el) => el.textContent,
      );
    expect(items()).toEqual(["{{ userName }}"]);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Hello {{ userName }}");
    expect(container.querySelector(".property-input-suggest")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Hello {{ userName }}");
  });

  it("빈 접두 `{{` 는 전부 · ArrowDown 이 활성 항목을 옮기고 Escape 가 닫는다 · stateNames 없으면 목록 없음", () => {
    const { container } = render(
      <PropertyInput
        label="Text"
        value=""
        onChange={vi.fn()}
        stateNames={["userName", "count"]}
      />,
    );
    const input = container.querySelector("input")!;
    type(input, "{{");
    const active = () =>
      container.querySelector(".property-input-suggest-item[data-active]")
        ?.textContent;
    expect(
      container.querySelectorAll(".property-input-suggest-item").length,
    ).toBe(2);
    expect(active()).toBe("{{ userName }}");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(active()).toBe("{{ count }}");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(container.querySelector(".property-input-suggest")).toBeNull();

    const plain = render(
      <PropertyInput label="Plain" value="" onChange={vi.fn()} />,
    );
    const plainInput = plain.container.querySelector("input")!;
    type(plainInput, "{{");
    expect(plain.container.querySelector(".property-input-suggest")).toBeNull();
  });

  it("APG combobox — 입력이 목록을 aria-controls · 활성 후보를 aria-activedescendant 로 가리킨다 (2026-11-09)", () => {
    const { container } = render(
      <PropertyInput
        label="Text"
        value=""
        onChange={vi.fn()}
        stateNames={["userName", "count"]}
      />,
    );
    const input = container.querySelector("input")!;
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    type(input, "{{");
    const list = container.querySelector(".property-input-suggest")!;
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    const activeId = () => input.getAttribute("aria-activedescendant");
    expect(document.getElementById(activeId()!)?.textContent).toBe(
      "{{ userName }}",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.getElementById(activeId()!)?.textContent).toBe(
      "{{ count }}",
    );
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);

    const plain = render(
      <PropertyInput label="Plain" value="" onChange={vi.fn()} />,
    );
    expect(plain.container.querySelector("input")!.hasAttribute("role")).toBe(
      false,
    );
  });
});
