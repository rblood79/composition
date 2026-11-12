/**
 * ADR-309 G3 (b) — 사용자 결정 4: a rule's date argument is the Design panel's date input. The date
 * family's value Do asks for a date (a range's for `{start, end}`), its derived Min · Max ·
 * Placeholder Do too, and the Value field writes the ISO text — still offering 「값 고르기」.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCapabilities } from "@composition/shared";
import { I18nProvider } from "@/i18n";
import { ValueField } from "../ValueField";

afterEach(cleanup);

const SOURCES = { eventArgs: ["value"], variables: [] };

describe("ADR-309 G3 (b) — a rule's date argument", () => {
  it("the date family's Do ask for dates", () => {
    for (const type of ["DateField", "TimeField", "DatePicker", "Calendar"])
      expect(resolveCapabilities(type).setValue?.param?.kind, type).toBe(
        "date",
      );
    for (const type of ["DateRangePicker", "RangeCalendar"])
      expect(resolveCapabilities(type).setValue?.param?.kind, type).toBe(
        "date-range",
      );
    for (const [type, prop] of [
      ["DatePicker", "MinValue"],
      ["DatePicker", "MaxValue"],
      ["DateField", "PlaceholderValue"],
      ["TimeField", "MinValue"],
      ["Calendar", "MaxValue"],
    ] as const)
      expect(
        resolveCapabilities(type)[`set${prop}`]?.param?.kind,
        `${type}.set${prop}`,
      ).toBe("date");
  });

  it("the Value field writes a typed date, a range one `{start, end}`, and keeps 「값 고르기」", async () => {
    // (The date inputs are a lazy chunk — G3 c: wait for their first render. They are the panel's
    //   RAC date picker — typed segments are written when the field is left.)
    const fieldOf = (container: HTMLElement) =>
      waitFor(() => {
        const found = container.querySelector<HTMLElement>(
          ".property-date-picker",
        );
        expect(found).not.toBeNull();
        return found!;
      });
    const user = userEvent.setup();
    const type = async (field: HTMLElement, keys: string, at = 0) => {
      const segment =
        field.querySelectorAll<HTMLElement>("[role=spinbutton]")[at]!;
      await act(async () => segment.focus());
      await user.keyboard(keys);
      await act(async () => (document.activeElement as HTMLElement).blur());
    };
    const writes: unknown[] = [];
    const date = render(
      <I18nProvider initialLocale="en-US">
        <ValueField
          label="Value"
          kind="date"
          value=""
          onChange={(value) => writes.push(value)}
          sources={SOURCES}
        />
      </I18nProvider>,
    );
    const field = await fieldOf(date.container);
    expect(field.querySelector(".property-date-picker__button")).not.toBeNull();
    await type(field, "11122026");
    expect(writes).toEqual(["2026-11-12"]);
    expect(
      date.container.querySelector(".interactions-value-pick, [aria-haspopup]"),
    ).not.toBeNull();
    date.unmount();

    const range = render(
      <I18nProvider initialLocale="en-US">
        <ValueField
          label="Value"
          kind="date-range"
          value={{ start: "2026-11-12", end: "2026-11-14" }}
          onChange={(value) => writes.push(value)}
          sources={SOURCES}
        />
      </I18nProvider>,
    );
    // The end's day (segments: start m · d · y, end m · d · y).
    await type(await fieldOf(range.container), "20", 4);
    expect(writes.at(-1)).toEqual({ start: "2026-11-12", end: "2026-11-20" });
    range.unmount();

    const time = render(
      <I18nProvider initialLocale="en-US">
        <ValueField
          label="Value"
          kind="date"
          emptyType="time"
          value=""
          onChange={(value) => writes.push(value)}
          sources={SOURCES}
        />
      </I18nProvider>,
    );
    const clock = await fieldOf(time.container);
    expect(clock.querySelector(".property-date-picker__button")).toBeNull();
    expect(
      [...clock.querySelectorAll<HTMLElement>("[role=spinbutton]")].map(
        (segment) => segment.dataset.type,
      ),
      // (A time argument is a TimeField's — no Hour cycle shows 24 hours, as the Canvas · DOM.)
    ).toEqual(["hour", "minute"]);
  });
});
