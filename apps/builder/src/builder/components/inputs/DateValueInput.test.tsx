import { useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { DateValueInput } from "./DateValueInput";
import { FieldValueInput } from "../../panels/datatable/grid/FieldValueInput";

afterEach(cleanup);

/** The field's segment of `type` (`day` · `hour` …). */
const segment = (container: HTMLElement, type: string) =>
  container.querySelector<HTMLElement>(
    `.property-date-picker__segment[data-type="${type}"]`,
  )!;

/** Types `keys` into the field's `type` segment. */
async function typeInto(container: HTMLElement, type: string, keys: string) {
  const user = userEvent.setup();
  await act(async () => segment(container, type).focus());
  await user.keyboard(keys);
  return user;
}

describe("DateValueInput (the panel's RAC date picker — 사용자 2026-11-12)", () => {
  it("merges a segment edit into the original zone/precision; moving between its segments is no blur", async () => {
    const change = vi.fn();
    const blur = vi.fn();
    function Host() {
      const [value, setValue] = useState("2026-10-29T10:30:15.500+09:00");
      return (
        <DateValueInput
          aria-label="When"
          value={value}
          onValueChange={(v) => {
            setValue(v);
            change(v);
          }}
          onBlur={blur}
        />
      );
    }
    const view = render(
      <I18nProvider initialLocale="en-US">
        <Host />
      </I18nProvider>,
    );
    expect(view.getByText("UTC+09:00")).toBeTruthy();
    // (A fraction keeps the seconds segment.)
    expect(segment(view.container, "second").textContent).toBe("15");
    const user = await typeInto(view.container, "day", "30");
    expect(change).toHaveBeenLastCalledWith("2026-10-30T10:30:15.500+09:00");
    await user.keyboard("{ArrowRight}");
    expect(blur).not.toHaveBeenCalled();
    await act(async () => (document.activeElement as HTMLElement).blur());
    expect(blur).toHaveBeenCalledTimes(1);
    // No ISO text mode (사용자 2026-11-12) — the only button opens the calendar.
    expect(view.container.querySelectorAll("button").length).toBe(1);
  });

  it("leaves a DST gap invalid and editable instead of shifting its wall clock", async () => {
    function Host() {
      const [value, setValue] = useState(
        "2026-03-07T02:30-05:00[America/New_York]",
      );
      return (
        <DateValueInput
          aria-label="When"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    const view = render(<Host />);
    await typeInto(view.container, "day", "8");
    expect(segment(view.container, "day").textContent).toBe("8");
    expect(segment(view.container, "hour").textContent).toBe("2");
    expect(
      view.container
        .querySelector(".property-date-picker")!
        .hasAttribute("data-invalid"),
    ).toBe(true);
  });

  it("a cleared segment keeps the field a date and time (its edit envelope)", async () => {
    const change = vi.fn();
    const view = render(
      <DateValueInput
        aria-label="When"
        value="2026-10-29T10:30:15.500Z"
        onValueChange={change}
      />,
    );
    await typeInto(view.container, "second", "{Backspace}".repeat(6));
    expect(segment(view.container, "hour")).not.toBeNull();
    expect(segment(view.container, "day").textContent).toBe("29");
  });

  it("Enter · Escape reach the caller before RAC's segment handler", async () => {
    const keys: string[] = [];
    const view = render(
      <DateValueInput
        aria-label="When"
        value="2026-10-29"
        onValueChange={() => {}}
        onKeyDown={(event) => keys.push(event.key)}
      />,
    );
    const user = await typeInto(view.container, "day", "{Enter}");
    await user.keyboard("{Escape}5");
    expect(keys).toEqual(["Enter", "Escape"]);
  });

  it("the RowForm/default editor uses the same lossless ISO commit", async () => {
    const change = vi.fn();
    const view = render(
      <I18nProvider initialLocale="en-US">
        <FieldValueInput
          field={{ id: "due", key: "due", type: "date" }}
          label="Due"
          text="2026-10-29T10:30:15.50Z"
          onChange={change}
        />
      </I18nProvider>,
    );
    await typeInto(view.container, "day", "30");
    expect(change).toHaveBeenLastCalledWith("2026-10-30T10:30:15.50Z");
  });
});
