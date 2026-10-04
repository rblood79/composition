/**
 * ADR-216 G1 — d3 오라클. `d3-time` · `d3-time-format` 은 **devDependency** (테스트 전용) 이고
 * 런타임 `specs/src/chart` 에는 d3 import 가 0 이어야 한다 (정적 가드가 마지막 describe).
 *
 * (a) 눈금: span 12 종 × count 3 종 에서 `utcTicks` 와 배열 동일.
 * (b) format: 채택 지시자 × 유효 날짜 100 케이스에서 `utcFormat` 과 문자열 동일.
 * (c) parse: 정규형 (d3 `utcFormat` 출력) 을 `utcParse` 로 되돌린 epoch 와 동일 — 지시자가
 *     보존하는 성분만 (`%Y` 만 쓰면 1월 1일 0시가 정답).
 * (d) 우리 규칙 (HC7): 달력 넘침 거부 — d3 는 정규화한다 (의도된 차이, 오라클 밖).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  utcTicks,
  utcDay,
  unixDay as d3UnixDay,
  utcMonth,
  utcYear as d3UtcYear,
} from "d3-time";
import { utcFormat, utcParse } from "d3-time-format";
import {
  DURATION_DAY,
  DURATION_HOUR,
  DURATION_MINUTE,
  DURATION_SECOND,
  DURATION_WEEK,
  DURATION_YEAR,
  unixDay,
  utcDay as ourDay,
  utcMonth as ourMonth,
  utcWeek as ourWeek,
  utcYear as ourYear,
} from "../timeIntervals";
import { niceTime, timeTickInterval, timeTicks } from "../timeTicks";
import {
  TIME_LOCALE_EN_US,
  TIME_LOCALE_KO_KR,
  formatTime,
  parseTime,
  timeLabelFormats,
} from "../timeFormat";

const T0 = Date.UTC(2026, 2, 5, 13, 7, 9, 123); // 2026-03-05T13:07:09.123Z (목)

/** 결정적 의사난수 — 같은 100 케이스가 매 실행 같은 날짜다. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const rand = lcg(216);
const DATES: number[] = Array.from({ length: 100 }, () =>
  Math.floor(
    Date.UTC(1900, 0, 1) +
      rand() * (Date.UTC(2100, 0, 1) - Date.UTC(1900, 0, 1)),
  ),
);

describe("ADR-216 G1 (a) — 눈금 12 span × 3 count = d3 utcTicks", () => {
  const spans: Array<[string, number]> = [
    ["1ms", 1],
    ["1초", DURATION_SECOND],
    ["1분", DURATION_MINUTE],
    ["1시간", DURATION_HOUR],
    ["1일", DURATION_DAY],
    ["1주", DURATION_WEEK],
    ["1달", 31 * DURATION_DAY],
    ["1분기", 91 * DURATION_DAY],
    ["1년", DURATION_YEAR],
    ["3년", 3 * DURATION_YEAR],
    ["10년", 10 * DURATION_YEAR],
    ["50년", 50 * DURATION_YEAR],
  ];
  const counts = [3, 6, 10];
  for (const [name, span] of spans) {
    for (const count of counts) {
      it(`${name} × ${count}`, () => {
        const start = T0;
        const stop = T0 + span;
        const ours = timeTicks(start, stop, count).ticks;
        const theirs = utcTicks(new Date(start), new Date(stop), count).map(
          (d) => d.getTime(),
        );
        expect(ours).toEqual(theirs);
        // 역방향도 d3 처럼 뒤집는다.
        expect(timeTicks(stop, start, count).ticks).toEqual(
          [...theirs].reverse(),
        );
      });
    }
  }

  it("임의 구간 60 개 (1ms ~ 200년) 에서도 배열 동일", () => {
    const r = lcg(7);
    for (let k = 0; k < 60; k++) {
      const start = DATES[k % DATES.length];
      const span = Math.floor(10 ** (r() * 12.8));
      const count = 2 + Math.floor(r() * 12);
      const ours = timeTicks(start, start + span, count).ticks;
      const theirs = utcTicks(
        new Date(start),
        new Date(start + span),
        count,
      ).map((d) => d.getTime());
      expect(ours, `start=${start} span=${span} count=${count}`).toEqual(
        theirs,
      );
    }
  });

  it("interval 파생 (ceil · range · every 필드 배수) = d3", () => {
    // utcDay.every(2) 는 매월 1·3·5… 일 (월이 바뀌면 다시 시작) — 눈금 표는 unixDay (epoch 일수).
    const a = Date.UTC(2026, 0, 28);
    const b = Date.UTC(2026, 1, 6);
    expect(ourDay.every(2)!.range(a, b)).toEqual(
      utcDay
        .every(2)!
        .range(new Date(a), new Date(b))
        .map((d) => +d),
    );
    expect(unixDay.every(2)!.range(a, b)).toEqual(
      d3UnixDay
        .every(2)!
        .range(new Date(a), new Date(b))
        .map((d) => +d),
    );
    expect(unixDay.every(2)!.range(a, b)).not.toEqual(
      ourDay.every(2)!.range(a, b),
    );
    expect(
      ourMonth.every(3)!.range(Date.UTC(2025, 4, 3), Date.UTC(2027, 0, 1)),
    ).toEqual(
      utcMonth
        .every(3)!
        .range(new Date(Date.UTC(2025, 4, 3)), new Date(Date.UTC(2027, 0, 1)))
        .map((d) => +d),
    );
    expect(ourYear.every(10)!.floor(Date.UTC(2026, 5, 1))).toBe(
      +d3UtcYear.every(10)!.floor(new Date(Date.UTC(2026, 5, 1))),
    );
    expect(ourWeek.ceil(T0)).toBe(Date.UTC(2026, 2, 8));
    expect(ourWeek.ceil(Date.UTC(2026, 2, 8))).toBe(Date.UTC(2026, 2, 8));
    expect(ourMonth.offset(Date.UTC(2026, 0, 31), 1)).toBe(
      Date.UTC(2026, 2, 3),
    ); // JS 달력 넘침 그대로 (d3 동일)
  });

  it("niceTime = 눈금 interval 의 floor/ceil; 단일 시각은 하루", () => {
    const [lo, hi] = niceTime(T0, T0 + 40 * DURATION_DAY, 5);
    const picked = timeTickInterval(T0, T0 + 40 * DURATION_DAY, 5)!;
    expect(picked.granularity).toBe("week");
    expect(lo).toBe(picked.interval.floor(T0));
    expect(hi).toBe(picked.interval.ceil(T0 + 40 * DURATION_DAY));
    expect(niceTime(T0, T0, 5)).toEqual([
      Date.UTC(2026, 2, 5),
      Date.UTC(2026, 2, 6),
    ]);
  });
});

const SPECIFIERS = [
  "%Y-%m-%d",
  "%Y-%m-%dT%H:%M:%S.%LZ",
  "%y/%m/%d",
  "%e %b %Y",
  "%-d %B %Y",
  "%_d/%_m",
  "%A, %d %B %Y %I:%M %p",
  "%a %-I %p",
  "%j",
  "Q%q %Y",
  "%H:%M:%S",
  "%Z %% %Q %s",
  "%0d%0m%0Y",
  "%-I:%M %p",
  "%b %-d",
];

describe("ADR-216 G1 (b) — format 지시자 × 날짜 100 = d3 utcFormat", () => {
  for (const spec of SPECIFIERS) {
    it(spec, () => {
      const theirs = utcFormat(spec);
      for (const t of DATES) {
        expect(formatTime(spec, t), `${spec} @ ${t}`).toBe(theirs(new Date(t)));
      }
    });
  }
  it("모르는 지시자는 글자만 남긴다 (d3 동일) · 비유한 → 빈 문자열", () => {
    expect(formatTime("%k%Y", T0)).toBe(utcFormat("%k%Y")(new Date(T0)));
    expect(formatTime("%Y", NaN)).toBe("");
  });
  it("ko-KR 로케일 표 (요일 · 월 · 오전/오후)", () => {
    expect(formatTime("%A %B %p", T0, TIME_LOCALE_KO_KR)).toBe(
      "목요일 3월 오후",
    );
    expect(formatTime("%a %b", T0, TIME_LOCALE_KO_KR)).toBe("목 3월");
    expect(formatTime("%a %b", T0, TIME_LOCALE_EN_US)).toBe("Thu Mar");
  });
});

describe("ADR-216 G1 (c) — parse: d3 정규형 왕복 (보존 성분만) = d3 utcParse", () => {
  const PARSE_SPECS = [
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S.%LZ",
    "%Y-%m-%dT%H:%M:%S%Z",
    "%y/%m/%d",
    "%e %b %Y",
    "%-d %B %Y",
    "%d %B %Y %I:%M %p",
    "%Y %j",
    "Q%q %Y",
    "%H:%M:%S",
    "%Y%m%d",
    "%Q",
    "%s",
    "%Y",
    "%b %Y",
  ];
  for (const spec of PARSE_SPECS) {
    it(spec, () => {
      const format = utcFormat(spec);
      const parse = utcParse(spec);
      for (const t of DATES) {
        const text = format(new Date(t));
        const theirs = parse(text);
        expect(parseTime(spec, text), `${spec} ← "${text}"`).toBe(
          theirs === null ? null : theirs.getTime(),
        );
      }
    });
  }
  it("폭 제한 · 남는 문자 거부 · %Z 오프셋 · %p 12시간 · 0~99 년 (d3 동일)", () => {
    const cases: Array<[string, string]> = [
      ["%Y%m%d", "20260305"],
      ["%Y-%m-%d", "2026-03-05x"],
      ["%Y-%m-%d", "2026-3-5"],
      ["%Y-%m-%dT%H:%M%Z", "2026-03-05T09:00+09:00"],
      ["%Y-%m-%dT%H:%M%Z", "2026-03-05T09:00-0530"],
      ["%Y-%m-%dT%H:%M%Z", "2026-03-05T09:00Z"],
      ["%I %p", "12 am"],
      ["%I %p", "12 PM"],
      ["%y", "68"],
      ["%y", "69"],
      ["%Y", "0050"],
      ["%Y", "50"],
      ["%b %d", "mar 05"],
      ["%A", "Thursday"],
      ["%d/%m/%Y", " 5/ 3/2026"],
    ];
    for (const [spec, text] of cases) {
      const theirs = utcParse(spec)(text);
      expect(parseTime(spec, text), `${spec} ← "${text}"`).toBe(
        theirs === null ? null : theirs.getTime(),
      );
    }
    expect(parseTime("%y", "68")).toBe(Date.UTC(2068, 0, 1));
    expect(parseTime("%y", "69")).toBe(Date.UTC(1969, 0, 1));
  });
  it("ko-KR 로케일로 파싱", () => {
    expect(
      parseTime(
        "%Y년 %B %d일 %p %I시",
        "2026년 3월 05일 오후 1시",
        TIME_LOCALE_KO_KR,
      ),
    ).toBe(Date.UTC(2026, 2, 5, 13));
  });
});

describe("ADR-216 HC7 — 달력 넘침 거부 (d3 는 정규화, 의도된 차이)", () => {
  it("2026-02-30 · 13월 · 25시 · 60분 → null (d3 는 값을 낸다)", () => {
    for (const [spec, text] of [
      ["%Y-%m-%d", "2026-02-30"],
      ["%Y-%m-%d", "2026-13-01"],
      ["%Y-%m-%dT%H:%M", "2026-03-05T25:00"],
      ["%Y-%m-%dT%H:%M", "2026-03-05T10:60"],
      ["%Y-%m-%d", "2025-02-29"],
    ] as const) {
      expect(parseTime(spec, text), `${spec} ← ${text}`).toBeNull();
      expect(utcParse(spec)(text)).not.toBeNull();
    }
    expect(parseTime("%Y-%m-%d", "2024-02-29")).toBe(Date.UTC(2024, 1, 29));
    // 일련일은 넘침이 뜻이다 — 366 까지 받고 그 위는 거부.
    expect(parseTime("%Y %j", "2026 060")).toBe(Date.UTC(2026, 2, 1));
    expect(parseTime("%Y %j", "2026 367")).toBeNull();
  });
});

describe("ADR-216 — 2단 라벨 표 (RSC granularity)", () => {
  it("granularity 별 (눈금, 경계) 형식", () => {
    expect(timeLabelFormats("hour")).toEqual({
      tick: "%-I %p",
      boundary: "%b %-d",
    });
    expect(timeLabelFormats("day")).toEqual({ tick: "%-d", boundary: "%b" });
    expect(timeLabelFormats("month")).toEqual({ tick: "%b", boundary: "%Y" });
    expect(timeLabelFormats("year")).toEqual({ tick: "%Y", boundary: null });
    expect(formatTime(timeLabelFormats("hour").tick, T0)).toBe("1 PM");
    expect(formatTime(timeLabelFormats("minute").tick, T0)).toBe("1:07 PM");
  });
});

describe("ADR-216 HC3 — specs/src/chart 런타임에 d3 import 0 (정적 가드)", () => {
  it("테스트 밖 소스에 `d3-` 문자열 import 가 없다", () => {
    const dir = join(__dirname, "..");
    const offenders: string[] = [];
    const walk = (d: string): void => {
      for (const name of readdirSync(d, { withFileTypes: true })) {
        if (name.name === "__tests__") continue;
        const p = join(d, name.name);
        if (name.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name.name)) {
          const src = readFileSync(p, "utf8");
          if (/from\s+["']d3-|require\(["']d3-/.test(src)) offenders.push(p);
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });
});
