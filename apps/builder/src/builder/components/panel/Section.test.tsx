import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Section } from "./Section";

afterEach(cleanup);

/**
 * memo 비교가 `onReset` 의 유무만 보면, 같은 children 참조로 다시 그릴 때 새 `onReset` 이 버려져
 * Reset 이 옛 클로저 (이전 선택 · 이전 값) 를 실행한다. Reset 은 늘 마지막 콜백을 부른다.
 */
describe("Section Reset", () => {
  it("calls the latest onReset after a re-render with the same children", () => {
    const children = <span>body</span>;
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <Section title="Fill" onReset={first}>
        {children}
      </Section>,
    );
    rerender(
      <Section title="Fill" onReset={second}>
        {children}
      </Section>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset section" }));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

/**
 * 머리글 = RAC Disclosure 와 같은 계약 (2026-11-10): caret 만이 아니라 제목까지 누르는 trigger 버튼 하나
 * (이름 = 제목, 펼침 = aria-expanded · aria-controls), 내용 영역 = role group (이름 = 제목). 닫힌 구획의
 * 내용은 렌더하지 않는다 (RAC DisclosurePanel 과 다른 점 — 패널 비용). 머리글 액션은 버튼 밖.
 */
describe("Section disclosure contract", () => {
  it("toggles from the title, names the panel by the title, and renders nothing while closed", () => {
    render(
      <Section title="Fill" onReset={() => {}}>
        <span>body</span>
      </Section>,
    );
    const trigger = screen.getByRole("button", { name: "Fill" });
    expect(trigger.closest("h3")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("group", { name: "Fill" });
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.textContent).toBe("body");
    // 액션은 trigger 밖 (버튼 안에 버튼 금지)
    const reset = screen.getByRole("button", { name: "Reset section" });
    expect(trigger.contains(reset)).toBe(false);

    fireEvent.click(screen.getByText("Fill"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.hasAttribute("aria-controls")).toBe(false);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText("body")).toBeNull();
  });

  it("a non-collapsible section has a heading but no trigger, and its panel is named by the title", () => {
    render(
      <Section title="Snapshots" collapsible={false}>
        <span>body</span>
      </Section>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("heading", { name: "Snapshots" })).not.toBeNull();
    expect(screen.getByRole("group", { name: "Snapshots" })).not.toBeNull();
  });
});
