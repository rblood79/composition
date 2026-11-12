import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import {
  DateListField,
  DateRangeField,
  DateValueField,
  dateFieldEmptyType,
  fieldHourCycle,
} from "../DateValueFields";
import { racFieldHourCycle } from "../../../../../../../../packages/shared/src/catalog/document/dateSegments";

/**
 * ADR-309 G2 (c) — the date fields write and read the stored ISO text through the panel's RAC date
 * picker (`PanelDatePicker` — 사용자 결정 2026-11-12): a date picked in the calendar popover is
 * written, a cleared field writes nothing (`undefined`), a text that reads as no date is shown as
 * written and marked (never cleared — R5), a stored zone survives an edit, a range writes one
 * `{start, end}`, a Calendar's list adds · edits · removes its dates.
 */
const wrap = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider initialLocale="en-US">{children}</I18nProvider>
    ),
  });

/** Each date field's segment text (`11/12/2026`), as RAC shows it. */
const shown = (container: HTMLElement) =>
  [...container.querySelectorAll(".property-date-picker__input")].map((input) =>
    [...input.querySelectorAll(".property-date-picker__segment")]
      .map((segment) => segment.textContent?.replace(/[⁦-⁩]/g, ""))
      .join(""),
  );

/** Opens the field's calendar popover and picks `day` of the shown month. */
async function pick(container: HTMLElement, day: number, field = 0) {
  const user = userEvent.setup();
  const button = container.querySelectorAll<HTMLElement>(
    ".property-date-picker__button",
  )[field]!;
  await user.click(button);
  const dialog = document.querySelector<HTMLElement>(
    ".property-date-picker__dialog",
  )!;
  const cell = [
    ...dialog.querySelectorAll<HTMLElement>(".property-calendar__cell"),
  ].find(
    (cell) =>
      cell.textContent === String(day) &&
      !cell.hasAttribute("data-outside-month"),
  )!;
  await user.click(cell);
  return { user, dialog };
}

describe("ADR-309 G2 (c) — the date fields", () => {
  it("picks the input from the kind and granularity", () => {
    expect(dateFieldEmptyType("date", undefined)).toBe("date");
    expect(dateFieldEmptyType("date", "minute")).toBe("datetime-local");
    expect(dateFieldEmptyType("time", "second")).toBe("time");
  });

  it("a date: the calendar popover writes the picked date, reads it back, clears to nothing", async () => {
    const writes: unknown[] = [];
    const draw = (value: string) => (
      <DateValueField
        label="Value"
        value={value}
        emptyType="date"
        onChange={(next) => writes.push(next)}
      />
    );
    const view = wrap(draw("2026-11-12"));
    expect(shown(view.container)).toEqual(["11/12/2026"]);
    await pick(view.container, 20);
    expect(writes).toEqual(["2026-11-20"]);
    view.rerender(draw("2026-11-20"));
    expect(shown(view.container)).toEqual(["11/20/2026"]);
    // Clearing every segment (Backspace from the last) writes nothing.
    const user = userEvent.setup();
    const segments = view.container.querySelectorAll<HTMLElement>(
      ".property-date-picker__segment[role=spinbutton]",
    );
    await act(async () => segments[segments.length - 1]!.focus());
    await user.keyboard("{Backspace}".repeat(12));
    // (Typed segments are a draft — written when the field is left.)
    expect(writes).toEqual(["2026-11-20"]);
    await act(async () => (document.activeElement as HTMLElement).blur());
    expect(writes.at(-1)).toBeUndefined();
    view.unmount();
  });

  it("a time field types its time; a date at a time granularity shows its time segments", async () => {
    const writes: unknown[] = [];
    const time = wrap(
      <DateValueField
        label="Value"
        value=""
        emptyType="time"
        onChange={(value) => writes.push(value)}
      />,
    );
    // A time has no calendar.
    expect(
      time.container.querySelector(".property-date-picker__button"),
    ).toBeNull();
    const user = userEvent.setup();
    const [hour] = time.container.querySelectorAll<HTMLElement>(
      ".property-date-picker__segment[role=spinbutton]",
    );
    await act(async () => hour!.focus());
    await user.keyboard("1030a");
    expect(writes).toEqual([]);
    await user.keyboard("{Enter}");
    expect(writes.at(-1)).toBe("10:30");
    time.unmount();
    const minute = wrap(
      <DateValueField
        label="Value"
        value=""
        emptyType="datetime-local"
        onChange={(value) => writes.push(value)}
      />,
    );
    const types = [
      ...minute.container.querySelectorAll<HTMLElement>(
        ".property-date-picker__segment[role=spinbutton]",
      ),
    ].map((segment) => segment.dataset.type);
    expect(types).toEqual([
      "month",
      "day",
      "year",
      "hour",
      "minute",
      "dayPeriod",
    ]);
    minute.unmount();
  });

  it("the time segments follow the component's Hour cycle (사용자 2026-11-12)", () => {
    const types = (
      hourCycle: 12 | 24 | undefined,
      emptyType: "time" | "datetime-local",
    ) => {
      const view = wrap(
        <DateValueField
          label="Value"
          value={emptyType === "time" ? "21:07" : "2026-11-12T21:07"}
          emptyType={emptyType}
          hourCycle={hourCycle}
          ownerType={emptyType === "time" ? "TimeField" : undefined}
          onChange={() => {}}
        />,
      );
      const out = [
        ...view.container.querySelectorAll<HTMLElement>(
          ".property-date-picker__segment[role=spinbutton]",
        ),
      ].map((segment) => `${segment.dataset.type}:${segment.textContent}`);
      view.unmount();
      return out;
    };
    // The panel's rule is the Canvas · DOM's (`racFieldHourCycle`).
    for (const owner of ["TimeField", "DatePicker", undefined])
      for (const value of [undefined, "", "12", "24", 12, 24, "7"])
        expect(fieldHourCycle(owner, value), `${owner} ${value}`).toBe(
          racFieldHourCycle(owner, value),
        );
    // A TimeField with no Hour cycle shows 24 hours.
    expect(types(undefined, "time")).toEqual(["hour:21", "minute:07"]);
    expect(types(24, "time")).toEqual(["hour:21", "minute:07"]);
    expect(types(12, "time")).toEqual(["hour:9", "minute:07", "dayPeriod:PM"]);
    expect(types(24, "datetime-local")).toEqual([
      "month:11",
      "day:12",
      "year:2026",
      "hour:21",
      "minute:07",
    ]);
  });

  it("an unreadable stored text stays as written and is marked (R5)", () => {
    const writes: unknown[] = [];
    const view = wrap(
      <DateValueField
        label="Min Value"
        value="next tuesday"
        emptyType="date"
        onChange={(value) => writes.push(value)}
      />,
    );
    expect(
      view.container.querySelector<HTMLInputElement>(
        ".property-date-picker__text",
      )!.value,
    ).toBe("next tuesday");
    expect(
      view.container
        .querySelector("[data-date-unreadable]")
        ?.getAttribute("title"),
    ).toBe("next tuesday");
    expect(writes).toEqual([]);
    view.unmount();
  });

  it("a zoned value keeps its zone and time through a calendar pick (사용자 결정 2)", async () => {
    const writes: unknown[] = [];
    const view = wrap(
      <DateValueField
        label="Value"
        value="2026-11-12T10:30[Asia/Seoul]"
        emptyType="datetime-local"
        onChange={(value) => writes.push(value)}
      />,
    );
    expect(view.getByText("Asia/Seoul")).toBeTruthy();
    await pick(view.container, 13);
    expect(writes).toEqual(["2026-11-13T10:30[Asia/Seoul]"]);
    view.unmount();
  });

  it("a range writes one {start, end} from the range calendar", async () => {
    const writes: unknown[] = [];
    const view = wrap(
      <DateRangeField
        label="Value"
        value={{ start: "2026-11-12", end: "2026-11-14" }}
        emptyType="date"
        onChange={(value) => writes.push(value)}
      />,
    );
    expect(shown(view.container)).toEqual(["11/12/2026", "11/14/2026"]);
    const { user, dialog } = await pick(view.container, 16);
    const cell = [
      ...dialog.querySelectorAll<HTMLElement>(".property-calendar__cell"),
    ].find(
      (cell) =>
        cell.textContent === "20" && !cell.hasAttribute("data-outside-month"),
    )!;
    await user.click(cell);
    expect(writes).toEqual([{ start: "2026-11-16", end: "2026-11-20" }]);
    view.unmount();
  });

  it("a Calendar's list adds, edits and removes dates; single mode shows one date", async () => {
    let stored: unknown = ["2026-11-12"];
    const draw = (multiple: boolean) => (
      <DateListField
        label="Value"
        value={stored}
        multiple={multiple}
        onChange={(value) => {
          stored = value;
        }}
      />
    );
    const view = wrap(draw(true));
    const user = userEvent.setup();
    await user.click(view.getByRole("button", { name: "Add date" }));
    // (A new row is empty — its calendar opens on today's month; type the date instead.)
    const fields = view.container.querySelectorAll(".property-date-picker");
    const month = within(fields[fields.length - 1] as HTMLElement).getAllByRole(
      "spinbutton",
    )[0]!;
    await act(async () => month.focus());
    await user.keyboard("11142026");
    // (Not year 0002 on the way — the typed date is written when the field is left.)
    expect(stored).toEqual(["2026-11-12"]);
    await act(async () => (document.activeElement as HTMLElement).blur());
    expect(stored).toEqual(["2026-11-12", "2026-11-14"]);
    view.rerender(draw(true));
    await pick(view.container, 13, 0);
    expect(stored).toEqual(["2026-11-13", "2026-11-14"]);
    view.rerender(draw(true));
    await user.click(view.getAllByRole("button", { name: "Remove date" })[1]!);
    expect(stored).toEqual(["2026-11-13"]);
    view.rerender(draw(true));
    await user.click(view.getAllByRole("button", { name: "Remove date" })[0]!);
    expect(stored).toBeUndefined();
    stored = ["2026-11-14", "2026-11-12"];
    view.rerender(draw(false));
    expect(shown(view.container)).toEqual(["11/14/2026"]);
    view.unmount();
  });
});
