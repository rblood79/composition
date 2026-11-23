// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider, loadAllLocaleMessages } from "@/i18n";
import { UnavailableDatesField } from "./UnavailableDatesField";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — the Design panel's 「Unavailable dates」: weekday chips
 * (Sunday first, the stored 0 ~ 6), days · periods with a remove menu, and an empty value removes
 * the prop.
 */
beforeAll(async () => {
  await loadAllLocaleMessages();
});
afterEach(cleanup);

function renderField(value: unknown) {
  const onChange = vi.fn();
  render(
    <I18nProvider initialLocale="en-US">
      <UnavailableDatesField
        label="Unavailable dates"
        value={value}
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return onChange;
}

describe("UnavailableDatesField", () => {
  it("a weekday chip adds its number (sorted) and the last one off removes the prop", () => {
    const onChange = renderField({ weekdays: [6] });
    fireEvent.click(screen.getByRole("button", { name: "Sun" }));
    expect(onChange).toHaveBeenLastCalledWith({ weekdays: [0, 6] });
    fireEvent.click(screen.getByRole("button", { name: "Sat" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("Add date · Add period append today; the row menu removes one", () => {
    const today = new Date().toISOString().slice(0, 10);
    const onChange = renderField({ dates: ["2026-12-25"] });
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    expect(onChange).toHaveBeenLastCalledWith({
      dates: ["2026-12-25", today],
    });
    fireEvent.click(screen.getByRole("button", { name: "Add period" }));
    expect(onChange).toHaveBeenLastCalledWith({
      dates: ["2026-12-25", { start: today, end: today }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Date actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("a value that does not fit shows as empty", () => {
    renderField({ weekdays: [9] });
    expect(screen.queryAllByRole("button", { pressed: true })).toEqual([]);
    expect(
      screen.getByRole("button", { name: "Sun" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
