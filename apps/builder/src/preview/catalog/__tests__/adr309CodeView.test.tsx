import { afterEach, describe, expect, it, vi } from "vitest";
import { openAdr296 } from "./support/adr296Harness";

/**
 * ADR-309 G3 (a) — the Code view writes a date family prop as RAC takes it (`parseDate('…')` ·
 * `parseDateTime` · `parseTime` · `parseAbsolute('…', 'UTC')`, a range's `{start, end}`, a
 * Calendar's list) once, imports the parser, reads it back to the same ISO text (an unchanged apply
 * writes nothing), and an edited literal is stored as its ISO text.
 */
afterEach(() => vi.restoreAllMocks());

const count = (text: string, find: string) => text.split(find).length - 1;

const CASES: ReadonlyArray<
  readonly [string, Record<string, unknown>, string, string, unknown]
> = [
  [
    "DateField",
    { value: "2026-11-12" },
    "value={parseDate('2026-11-12')}",
    "value={parseDate('2027-01-02')}",
    "2027-01-02",
  ],
  [
    "DatePicker",
    { value: "2026-11-12T10:30", granularity: "minute" },
    "value={parseDateTime('2026-11-12T10:30')}",
    "value={parseDateTime('2026-11-12T11:45')}",
    "2026-11-12T11:45",
  ],
  [
    "TimeField",
    { value: "10:30" },
    "value={parseTime('10:30')}",
    "value={parseTime('21:07')}",
    "21:07",
  ],
  [
    "DateField",
    { value: "2026-11-12T01:30:00Z", granularity: "minute" },
    "value={parseAbsolute('2026-11-12T01:30:00Z', 'UTC')}",
    "value={parseAbsolute('2026-11-13T01:30:00Z', 'UTC')}",
    "2026-11-13T01:30:00Z",
  ],
  [
    "DateRangePicker",
    { value: { start: "2026-11-12", end: "2026-11-14" } },
    "value={{start: parseDate('2026-11-12'), end: parseDate('2026-11-14')}}",
    "value={{start: parseDate('2026-11-12'), end: parseDate('2026-11-20')}}",
    { start: "2026-11-12", end: "2026-11-20" },
  ],
  [
    "RangeCalendar",
    { value: { start: "2026-11-12", end: "2026-11-14" } },
    "value={{start: parseDate('2026-11-12'), end: parseDate('2026-11-14')}}",
    "value={{start: parseDate('2026-11-01'), end: parseDate('2026-11-14')}}",
    { start: "2026-11-01", end: "2026-11-14" },
  ],
  [
    "Calendar",
    {
      selectionMode: "multiple",
      value: ["2026-11-12", "2026-11-14"],
    },
    "value={[parseDate('2026-11-12'), parseDate('2026-11-14')]}",
    "value={[parseDate('2026-11-12'), parseDate('2026-11-14'), parseDate('2026-11-18')]}",
    ["2026-11-12", "2026-11-14", "2026-11-18"],
  ],
  [
    "DatePicker",
    { minValue: "2026-11-01" },
    "minValue={parseDate('2026-11-01')}",
    "minValue={parseDate('2026-10-01')}",
    "2026-10-01",
  ],
];

describe("ADR-309 G3 (a) — a date value in the Code view, and back", () => {
  it.each(CASES)("%s %o", async (type, props, written, edited, stored) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const node = h.add(type);
    h.declare(node, props as never);
    const code = h.code();
    expect(count(code, written), code).toBe(1);
    const fn = /(parse\w+)\(/.exec(written)![1]!;
    expect(code).toMatch(
      new RegExp(
        `import \\{[^}]*\\b${fn}\\b[^}]*\\} from '@internationalized/date'`,
      ),
    );

    const revision = h.graph().revision;
    expect(h.apply(code).rejected ?? []).toEqual([]);
    expect(h.graph().revision).toBe(revision);

    expect(h.apply(code.replace(written, edited)).rejected ?? []).toEqual([]);
    const key = written.slice(0, written.indexOf("="));
    expect(h.node(node).props[key]).toEqual({ kind: "set", value: stored });
    expect(count(h.code(), edited)).toBe(1);
  });

  it("a text that reads as no date stays the text it is", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const node = h.add("DatePicker");
    h.declare(node, { minValue: "next tuesday" });
    const code = h.code();
    expect(count(code, 'minValue="next tuesday"')).toBe(1);
    const revision = h.graph().revision;
    expect(h.apply(code).rejected ?? []).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });
});
