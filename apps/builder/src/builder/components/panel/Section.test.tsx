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
