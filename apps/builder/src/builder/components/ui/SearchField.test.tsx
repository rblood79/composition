import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./SearchField";

describe("Builder SearchField control appearance", () => {
  it("React Aria SearchField 안에 공통 control group을 렌더링한다", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SearchField
        appearance="control"
        aria-label="명령어 검색"
        value=""
        onChange={onChange}
        placeholder="명령어 검색..."
      />,
    );

    const input = screen.getByRole("searchbox", { name: "명령어 검색" });
    const group = container.querySelector(
      ".react-aria-control.react-aria-Group",
    );

    expect(group).not.toBeNull();
    expect(input.classList.contains("react-aria-Input")).toBe(true);
    expect(group?.querySelector(".control-label")?.tagName).toBe("SPAN");
    expect(
      group?.querySelector(".control-label")?.getAttribute("aria-hidden"),
    ).toBe("true");

    fireEvent.change(input, { target: { value: "속성" } });
    expect(onChange).toHaveBeenCalledWith("속성");
  });

  it("Properties control shell과 같은 surface token을 사용한다", async () => {
    const styles = await readFile(
      resolve(__dirname, "SearchField.css"),
      "utf8",
    );

    expect(styles).toContain(".builder-search-field--control");
    expect(styles).toContain("padding: var(--spacing)");
    expect(styles).toContain("background: var(--bg-muted)");
    expect(styles).toContain("border-radius: var(--radius-md)");
    expect(styles).toContain("box-shadow: var(--inset-shadow-sm)");
  });
});
