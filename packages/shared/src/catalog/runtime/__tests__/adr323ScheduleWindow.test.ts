/**
 * ADR-323 G3 — the visible period's query (breakdown §5.4.1): the ids in the window are a written
 * answer table (not the module's output), the same for the local rows, a `body` remote and a
 * `suffix` remote; the day superset never drops a span the precise filter keeps (a sweep over the
 * stored offsets −12:00 ~ +14:00 × viewing zones).
 */
import { describe, expect, it } from "vitest";

import {
  runViewQueries,
  type ViewRunField,
} from "../../../collections/view/evaluate";
import { serializeViewQueries } from "../../../collections/view/serialize";
import {
  SCHEDULE_QUERY_MARGIN_DAYS,
  scheduleRowsInWindow,
  scheduleShiftDay,
  scheduleWindowConditions,
  scheduleWindowRequest,
  type ScheduleWindowDays,
  type ScheduleWindowFields,
} from "../scheduleWindowQuery";

interface Row {
  id: string;
  start?: unknown;
  end?: unknown;
}

const SCHEMA: ViewRunField[] = [
  { id: "id", key: "id", type: "string" },
  { id: "start", key: "start", type: "date" },
  { id: "end", key: "end", type: "date" },
];
const WITH_END: ScheduleWindowFields = {
  start: "data:field:start",
  end: "data:field:end",
};
const START_ONLY: ScheduleWindowFields = { start: "data:field:start" };
const WEEK: ScheduleWindowDays = { from: "2026-11-23", until: "2026-11-30" };
const DURATION = 30;

const input = (where: ReturnType<typeof scheduleWindowConditions>) => ({
  queries: [{ where }],
  schema: SCHEMA,
  resolve: (value: unknown) => ({ value }),
});
/** The day superset over `rows` (the evaluator — the local run · a server that runs the body). */
const superset = (
  rows: readonly Row[],
  fields: ScheduleWindowFields,
  window = WEEK,
) =>
  runViewQueries(
    rows,
    input(scheduleWindowConditions(fields, window, DURATION)),
  ).rows as Row[];
const precise = (rows: readonly Row[], timeZone: string, window = WEEK) =>
  scheduleRowsInWindow(
    rows,
    (row) => ({ start: row.start, end: row.end }),
    window,
    {
      timeZone,
      defaultDurationMinutes: DURATION,
    },
  );
const ids = (rows: readonly { row: Row }[]) => rows.map(({ row }) => row.id);

/** Seoul (+09:00) — the window 11-23 00:00 ~ 11-30 00:00. */
const SEOUL_ROWS: Row[] = [
  { id: "cross", start: "2026-11-21", end: "2026-12-02" },
  {
    id: "endDayStart",
    start: "2026-11-30T00:00:00+09:00",
    end: "2026-11-30T01:00:00+09:00",
  },
  { id: "endDayDate", start: "2026-11-30" },
  {
    id: "lastMinute",
    start: "2026-11-29T23:45:00+09:00",
    end: "2026-11-30T00:15:00+09:00",
  },
  { id: "openTimed", start: "2026-11-22T23:50:00+09:00" },
  { id: "openTimedBefore", start: "2026-11-22T23:00:00+09:00" },
  { id: "dayOnly", start: "2026-11-23" },
  { id: "dayBefore", start: "2026-11-22" },
  {
    id: "midnightEnd",
    start: "2026-11-22T22:00:00+09:00",
    end: "2026-11-23T00:00:00+09:00",
  },
  { id: "dateEndExclusive", start: "2026-11-21", end: "2026-11-23" },
  {
    id: "reversed",
    start: "2026-11-25T10:00:00+09:00",
    end: "2026-11-25T09:00:00+09:00",
  },
  { id: "far", start: "2026-11-10", end: "2026-11-12" },
  { id: "inside", start: "2026-11-24T09:00:00Z", end: "2026-11-24T10:00:00Z" },
  // (Stored in UTC on 11-22 — the viewer's 11-23 00:30: the day superset must take it.)
  { id: "utcText", start: "2026-11-22T15:30:00Z", end: "2026-11-22T16:00:00Z" },
  { id: "noStart", start: "" },
];
const SEOUL_IN = [
  "cross",
  "lastMinute",
  "openTimed",
  "dayOnly",
  "inside",
  "utcText",
];

/** The date line (G3): shown in Kiritimati (+14:00), stored at −12:00 — the text is two days early. */
const KIRITIMATI_ROWS: Row[] = [
  {
    id: "kiri",
    start: "2026-11-21T22:05:00-12:00",
    end: "2026-11-21T22:15:00-12:00",
  },
  {
    id: "kiriBefore",
    start: "2026-11-21T21:55:00-12:00",
    end: "2026-11-21T21:59:00-12:00",
  },
];
/** Shown at −12:00 (`Etc/GMT+12`), stored at +14:00 — the window's last day 23:45 is 12-01 01:45. */
const GMT12_ROWS: Row[] = [
  {
    id: "gmt12",
    start: "2026-12-01T01:45:00+14:00",
    end: "2026-12-01T01:55:00+14:00",
  },
  {
    id: "gmt12After",
    start: "2026-12-01T02:05:00+14:00",
    end: "2026-12-01T02:15:00+14:00",
  },
];

const CASES = [
  { zone: "Asia/Seoul", rows: SEOUL_ROWS, expected: SEOUL_IN },
  { zone: "Pacific/Kiritimati", rows: KIRITIMATI_ROWS, expected: ["kiri"] },
  { zone: "Etc/GMT+12", rows: GMT12_ROWS, expected: ["gmt12"] },
] as const;

describe("scheduleWindowConditions — the day superset as written", () => {
  it("with an end: start before until+3, end after from−3 or (no end and start after from−4)", () => {
    expect(scheduleWindowConditions(WITH_END, WEEK, DURATION)).toEqual({
      id: "schedule-window",
      op: "and",
      items: [
        {
          id: "schedule-window:start",
          fields: [["data:field:start"]],
          op: "before",
          value: "2026-12-03",
        },
        {
          id: "schedule-window:ends",
          op: "or",
          items: [
            {
              id: "schedule-window:end",
              fields: [["data:field:end"]],
              op: "after",
              value: "2026-11-20",
            },
            {
              id: "schedule-window:open",
              op: "and",
              items: [
                {
                  id: "schedule-window:noEnd",
                  fields: [["data:field:end"]],
                  op: "notExists",
                },
                {
                  id: "schedule-window:openStart",
                  fields: [["data:field:start"]],
                  op: "after",
                  value: "2026-11-19",
                },
              ],
            },
          ],
        },
      ],
    });
  });
  it("without an end: start between [from − 2 − 1, until + 2]; a 3-day default length widens it", () => {
    expect(scheduleWindowConditions(START_ONLY, WEEK, DURATION).items).toEqual([
      {
        id: "schedule-window:start",
        fields: [["data:field:start"]],
        op: "between",
        value: ["2026-11-20", "2026-12-02"],
      },
    ]);
    expect(
      (
        scheduleWindowConditions(START_ONLY, WEEK, 3 * 1440 - 1).items[0] as {
          value: unknown;
        }
      ).value,
    ).toEqual(["2026-11-18", "2026-12-02"]);
    expect(SCHEDULE_QUERY_MARGIN_DAYS).toBe(2);
    expect(scheduleShiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("scheduleWindowRequest (breakdown §5.4.1 table)", () => {
  it("local = here · body = send · suffix with an end = load whole · suffix start only = send when gte · lte are named · no format = load whole", () => {
    expect(scheduleWindowRequest({ remote: false }, true)).toBe("here");
    expect(
      scheduleWindowRequest({ remote: true, format: { kind: "body" } }, true),
    ).toBe("send");
    expect(
      scheduleWindowRequest({ remote: true, format: { kind: "suffix" } }, true),
    ).toBe("loadWhole");
    expect(
      scheduleWindowRequest(
        { remote: true, format: { kind: "suffix" } },
        false,
      ),
    ).toBe("send");
    expect(
      scheduleWindowRequest(
        {
          remote: true,
          format: { kind: "suffix", suffixes: { gte: "_from" } },
        },
        false,
      ),
    ).toBe("loadWhole");
    expect(scheduleWindowRequest({ remote: true }, false)).toBe("loadWhole");
    expect(
      scheduleWindowRequest({ remote: true, format: { kind: "none" } }, false),
    ).toBe("loadWhole");
  });
});

describe("G3 — the ids in the window: local = body remote = suffix remote", () => {
  for (const { zone, rows, expected } of CASES) {
    it(`${zone}: ${expected.join(" · ")}`, () => {
      // (Local: the superset runs on the rows here, then the precise filter.)
      const local = ids(precise(superset(rows, WITH_END), zone).rows);
      expect(local).toEqual(expected);

      // (Body remote: the request carries the whole superset — the 「또는」 with the end-less rows.)
      const body = serializeViewQueries(
        { kind: "body" },
        input(scheduleWindowConditions(WITH_END, WEEK, DURATION)),
        "POST",
      );
      expect(body.warnings).toEqual([]);
      expect(JSON.stringify(body.body?.where)).toContain('"op":"notExists"');
      expect(ids(precise(superset(rows, WITH_END), zone).rows)).toEqual(
        expected,
      );

      // (Suffix remote with an end: the 「또는」 cannot go — nothing is sent, every row loads.)
      const suffix = serializeViewQueries(
        { kind: "suffix" },
        input(scheduleWindowConditions(WITH_END, WEEK, DURATION)),
      );
      expect(suffix.warnings.map((warning) => warning.code)).toContain(
        "OR_GROUP",
      );
      expect(
        scheduleWindowRequest(
          { remote: true, format: { kind: "suffix" } },
          true,
        ),
      ).toBe("loadWhole");
      expect(ids(precise(rows, zone).rows)).toEqual(expected);
    });
  }

  it("the reader's refusals are counted, not drawn (Seoul)", () => {
    expect(precise(SEOUL_ROWS, "Asia/Seoul").refused).toEqual({
      reversed: 1,
      noStart: 1,
    });
  });

  it("a start-only configuration over a suffix remote: start_gte · start_lte carry the range (a server by text day)", () => {
    const rows = SEOUL_ROWS.map(({ id, start }) => ({ id, start }));
    const query = serializeViewQueries(
      { kind: "suffix" },
      input(scheduleWindowConditions(START_ONLY, WEEK, DURATION)),
    );
    expect(query.warnings).toEqual([]);
    expect(query.params).toEqual([
      ["start_gte", "2026-11-20"],
      ["start_lte", "2026-12-02"],
    ]);
    // (A json-server-like server: the stored text's day in the range — both ends included.)
    const served = rows.filter(
      ({ start }) =>
        typeof start === "string" &&
        start.slice(0, 10) >= "2026-11-20" &&
        start.slice(0, 10) <= "2026-12-02",
    );
    // (Without an end every timed start lasts the default 30 minutes, a day a day — 「cross」 is 11-21 only.)
    expect(ids(precise(served, "Asia/Seoul").rows)).toEqual([
      "lastMinute",
      "openTimed",
      "dayOnly",
      "reversed",
      "inside",
      "utcText",
    ]);
    expect(ids(precise(superset(rows, START_ONLY), "Asia/Seoul").rows)).toEqual(
      ids(precise(served, "Asia/Seoul").rows),
    );
  });
});

/** An instant as stored text at an offset of `minutes` (`±HH:MM`). */
function storedAt(instant: number, minutes: number): string {
  const local = new Date(instant + minutes * 60_000).toISOString().slice(0, 19);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

describe("the day superset never drops a span the precise filter keeps", () => {
  const ZONES = [
    "Pacific/Kiritimati",
    "Etc/GMT+12",
    "Asia/Seoul",
    "America/New_York",
    "UTC",
  ];
  const OFFSETS = [-720, -600, -300, -60, 0, 330, 345, 540, 780, 840];
  for (const zone of ZONES) {
    it(zone, () => {
      // (Starts every 20 minutes from 3 days before the window to 3 days after it, at every offset;
      //  a 50-minute span, an end-less one, an all-day text.)
      const from = Date.parse("2026-11-20T00:00:00Z");
      const until = Date.parse("2026-12-03T00:00:00Z");
      const rows: Row[] = [];
      for (let t = from; t < until; t += 20 * 60_000)
        for (const offset of OFFSETS) {
          rows.push({
            id: `s${t}:${offset}`,
            start: storedAt(t, offset),
            end: storedAt(t + 50 * 60_000, offset),
          });
          rows.push({ id: `o${t}:${offset}`, start: storedAt(t, offset) });
        }
      for (let day = 18; day <= 34; day += 1)
        rows.push({
          id: `d${day}`,
          start: scheduleShiftDay("2026-11-01", day - 1),
        });
      const want = new Set(ids(precise(rows, zone).rows));
      expect(want.size).toBeGreaterThan(1000);
      for (const fields of [WITH_END, START_ONLY]) {
        const source = fields.end
          ? rows
          : rows.filter((row) => row.end === undefined);
        const expected = fields.end
          ? want
          : new Set(ids(precise(source, zone).rows));
        const got = new Set(ids(precise(superset(source, fields), zone).rows));
        expect([...expected].filter((id) => !got.has(id))).toEqual([]);
        expect(got.size).toBe(expected.size);
      }
    });
  }
});
