// @vitest-environment jsdom
/**
 * A number 0 is a value, not an empty field (`String(value ?? "")` — the Interactions panel's
 * `move` `toIndex: 0` showed empty, 2026-10-23).
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyInput } from "./PropertyInput";

afterEach(cleanup);

describe("PropertyInput — 0", () => {
  it("shows 0; null · undefined stay empty", () => {
    const shown = (value: unknown) => {
      const { container, unmount } = render(
        <PropertyInput
          label="Index"
          value={value as string}
          onChange={vi.fn()}
        />,
      );
      const text = container.querySelector("input")!.value;
      unmount();
      return text;
    };
    expect(shown(0)).toBe("0");
    expect(shown(undefined)).toBe("");
    expect(shown(null)).toBe("");
    expect(shown("u3")).toBe("u3");
  });
});
