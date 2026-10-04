/**
 * ADR-216 — 시간 지시자 형식 · 파싱 (d3-time-format `locale.js` 부분집합 이식, 외부 의존 0).
 *
 * 왜 `Intl.DateTimeFormat` 이 아닌가 (원천 §2.3): Intl 문자열은 ICU 판마다 다르다 (U+202F) —
 * Builder · Preview 는 같은 Chrome 이라 parity 는 통과하지만 publish 열람 브라우저 · Node
 * 스냅샷이 다른 문자열을 낸다. 지시자 이식은 문자열이 **코드에서** 결정되고, 같은 지시자로
 * 입력 형식 (`dimensionFormat`) 도 선언한다 (Intl 에는 파서가 없다). RSC (D2 참조) 가 같은 어법.
 *
 * 채택: `%Y %y %m %d %e %H %I %M %S %L %p %a %A %b %B %j %q %Z %%` + 패딩 수정자 `- _ 0`,
 * parse 는 여기에 `%Q %s`. 기각: `%U %W %V %g %G %u %w %f %c %x %X`. **UTC 벌만**.
 *
 * d3 와 다른 점 (의도, HC7): 파싱 뒤 달력 넘침 (`2026-02-30`) 을 **거부** 한다 — d3 는 3월 2일로
 * 정규화한다. G1 오라클은 유효 날짜 한정.
 */
import { utcDayOfYear } from "./timeIntervals";
import type { TimeGranularity } from "./timeTicks";

export interface TimeLocale {
  periods: readonly [string, string];
  days: readonly string[];
  shortDays: readonly string[];
  months: readonly string[];
  shortMonths: readonly string[];
}

export const TIME_LOCALE_EN_US: TimeLocale = {
  periods: ["AM", "PM"],
  days: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  shortMonths: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
};

/** d3-time-format `locale/ko-KR.json` 과 같은 표. */
export const TIME_LOCALE_KO_KR: TimeLocale = {
  periods: ["오전", "오후"],
  days: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
  shortDays: ["일", "월", "화", "수", "목", "금", "토"],
  months: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  shortMonths: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
};

export function resolveTimeLocale(locale: string | undefined): TimeLocale {
  return locale === "ko-KR" ? TIME_LOCALE_KO_KR : TIME_LOCALE_EN_US;
}

// ── format ──────────────────────────────────────────────────────────────────

/** d3 `pad` — 부호를 떼고 왼쪽을 `fill` 로 채운다. */
function pad(value: number, fill: string, width: number): string {
  const sign = value < 0 ? "-" : "";
  const s = String(sign ? -value : value);
  return sign + (s.length < width ? fill.repeat(width - s.length) + s : s);
}

const PADS: Readonly<Record<string, string>> = { "-": "", _: " ", "0": "0" };

type FormatFn = (d: Date, p: string, locale: TimeLocale) => string;

const FORMATS: Readonly<Record<string, FormatFn>> = {
  a: (d, _p, l) => l.shortDays[d.getUTCDay()],
  A: (d, _p, l) => l.days[d.getUTCDay()],
  b: (d, _p, l) => l.shortMonths[d.getUTCMonth()],
  B: (d, _p, l) => l.months[d.getUTCMonth()],
  d: (d, p) => pad(d.getUTCDate(), p, 2),
  e: (d, p) => pad(d.getUTCDate(), p, 2),
  H: (d, p) => pad(d.getUTCHours(), p, 2),
  I: (d, p) => pad(d.getUTCHours() % 12 || 12, p, 2),
  j: (d, p) => pad(utcDayOfYear(d.getTime()), p, 3),
  L: (d, p) => pad(d.getUTCMilliseconds(), p, 3),
  m: (d, p) => pad(d.getUTCMonth() + 1, p, 2),
  M: (d, p) => pad(d.getUTCMinutes(), p, 2),
  p: (d, _p, l) => l.periods[d.getUTCHours() >= 12 ? 1 : 0],
  q: (d) => String(1 + Math.floor(d.getUTCMonth() / 3)),
  Q: (d) => String(d.getTime()),
  s: (d) => String(Math.floor(d.getTime() / 1000)),
  S: (d, p) => pad(d.getUTCSeconds(), p, 2),
  y: (d, p) => pad(d.getUTCFullYear() % 100, p, 2),
  Y: (d, p) => pad(d.getUTCFullYear() % 10000, p, 4),
  Z: () => "+0000",
  "%": () => "%",
};

/**
 * d3 `utcFormat(specifier)(date)` — `%` 다음 (패딩 수정자 1개 +) 지시자 1글자를 표에서 치환.
 * 모르는 지시자는 d3 처럼 글자 자체를 남긴다 (`%k` → `k`). `%e` 만 기본 패딩이 공백.
 */
export function formatTime(
  specifier: string,
  t: number,
  locale: TimeLocale = TIME_LOCALE_EN_US,
): string {
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const n = specifier.length;
  let out = "";
  let j = 0;
  let i = -1;
  while (++i < n) {
    if (specifier.charCodeAt(i) !== 37) continue;
    out += specifier.slice(j, i);
    let c = specifier.charAt(++i);
    let p = PADS[c];
    if (p !== undefined) c = specifier.charAt(++i);
    else p = c === "e" ? " " : "0";
    const format = FORMATS[c];
    out += format ? format(d, p, locale) : c;
    j = i + 1;
  }
  return out + specifier.slice(j);
}

// ── parse ───────────────────────────────────────────────────────────────────

interface ParseState {
  y: number;
  m?: number;
  d: number;
  H: number;
  M: number;
  S: number;
  L: number;
  p?: number;
  q?: number;
  Z?: number;
  Q?: number;
  s?: number;
  /** `%j` — 일련일은 달력 넘침이 의도라 날짜 검사를 건너뛴다 */
  j?: boolean;
}

type ParseFn = (
  st: ParseState,
  s: string,
  i: number,
  locale: TimeLocale,
) => number;

const NUMBER_RE = /^\s*\d+/;

/** d3 `numberRe` + 폭 제한 (`%Y` 4 · 대부분 2 · `%L %j` 3 · `%q` 1) — `%Y%m%d` 가 `20260305` 를 받는다. */
function number(
  width: number,
  assign: (st: ParseState, v: number) => void,
): ParseFn {
  return (st, s, i) => {
    const n = NUMBER_RE.exec(s.slice(i, i + width));
    if (!n) return -1;
    assign(st, Number(n[0]));
    return i + n[0].length;
  };
}

function escapeRe(name: string): string {
  return name.replace(/[\\^$*+?|[\]().{}]/g, "\\$&");
}

const nameRe = new WeakMap<readonly string[], RegExp>();

/** 이름 표 (요일 · 월 · 오전/오후) 를 대소문자 무시로 맞춘다 (d3 `formatRe` + `formatLookup`). */
function names(
  pick: (l: TimeLocale) => readonly string[],
  assign: (st: ParseState, index: number) => void,
): ParseFn {
  return (st, s, i, l) => {
    const list = pick(l);
    let re = nameRe.get(list);
    if (!re) {
      re = new RegExp(`^(?:${list.map(escapeRe).join("|")})`, "i");
      nameRe.set(list, re);
    }
    const n = re.exec(s.slice(i));
    if (!n) return -1;
    const index = list.findIndex(
      (name) => name.toLowerCase() === n[0].toLowerCase(),
    );
    assign(st, index);
    return i + n[0].length;
  };
}

const PARSES: Readonly<Record<string, ParseFn>> = {
  a: names(
    (l) => l.shortDays,
    () => {},
  ),
  A: names(
    (l) => l.days,
    () => {},
  ),
  b: names(
    (l) => l.shortMonths,
    (st, i) => (st.m = i),
  ),
  B: names(
    (l) => l.months,
    (st, i) => (st.m = i),
  ),
  d: number(2, (st, v) => (st.d = v)),
  e: number(2, (st, v) => (st.d = v)),
  H: number(2, (st, v) => (st.H = v)),
  I: number(2, (st, v) => (st.H = v)),
  j: number(3, (st, v) => {
    st.m = 0;
    st.d = v;
    st.j = true;
  }),
  L: number(3, (st, v) => (st.L = v)),
  m: number(2, (st, v) => (st.m = v - 1)),
  M: number(2, (st, v) => (st.M = v)),
  p: names(
    (l) => l.periods,
    (st, i) => (st.p = i),
  ),
  q: number(1, (st, v) => (st.q = v * 3 - 3)),
  Q: (st, s, i) => {
    const n = NUMBER_RE.exec(s.slice(i));
    if (!n) return -1;
    st.Q = Number(n[0]);
    return i + n[0].length;
  },
  s: (st, s, i) => {
    const n = NUMBER_RE.exec(s.slice(i));
    if (!n) return -1;
    st.s = Number(n[0]);
    return i + n[0].length;
  },
  S: number(2, (st, v) => (st.S = v)),
  // d3 `parseYear`: 두 자리 연도 `> 68 → 1900 대, ≤ 68 → 2000 대` (`68` → 2068).
  y: number(2, (st, v) => (st.y = v + (v > 68 ? 1900 : 2000))),
  Y: number(4, (st, v) => (st.y = v)),
  Z: (st, s, i) => {
    const n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(s.slice(i, i + 6));
    if (!n) return -1;
    st.Z = n[1] ? 0 : -Number(n[2] + (n[3] ?? "00"));
    return i + n[0].length;
  },
  "%": (_st, s, i) => (s.charAt(i) === "%" ? i + 1 : -1),
};

/**
 * d3 `utcParse(specifier)(string)` → epoch ms. 전체 일치 강제 (남는 문자 → null). `%Q`/`%s` 는
 * epoch 직행, `%p` 는 12시간 보정, `%Z` 없으면 UTC. **달력 넘침은 거부** (d3 와 다름 — HC7):
 * `Date.UTC` 가 넘긴 날짜를 되돌려 검사한다 (`parseIsoStrict` 와 같은 규약).
 */
export function parseTime(
  specifier: string,
  input: string,
  locale: TimeLocale = TIME_LOCALE_EN_US,
): number | null {
  const st: ParseState = { y: 1900, d: 1, H: 0, M: 0, S: 0, L: 0 };
  const s = String(input);
  const n = specifier.length;
  let i = 0;
  let j = 0;
  while (i < n) {
    if (j >= s.length) return null;
    const code = specifier.charCodeAt(i++);
    if (code === 37) {
      let c = specifier.charAt(i++);
      if (PADS[c] !== undefined) c = specifier.charAt(i++);
      const parse = PARSES[c];
      if (!parse) return null;
      j = parse(st, s, j, locale);
      if (j < 0) return null;
    } else if (code !== s.charCodeAt(j++)) {
      return null;
    }
  }
  if (j !== s.length) return null;
  if (st.Q !== undefined) return st.Q;
  if (st.s !== undefined) return st.s * 1000 + st.L;
  if (st.p !== undefined) st.H = (st.H % 12) + st.p * 12;
  const month = st.m ?? st.q ?? 0;
  const zone = st.Z ?? 0;
  const hour = st.H + Math.trunc(zone / 100);
  const minute = st.M + (zone % 100);
  // 0~99 년은 `Date.UTC` 가 1900 대로 보정하므로 `setUTCFullYear` 로 되돌린다 (d3 `utcDate`).
  const date = new Date(
    Date.UTC(
      st.y >= 0 && st.y < 100 ? 2000 : st.y,
      month,
      st.d,
      hour,
      minute,
      st.S,
      st.L,
    ),
  );
  if (st.y >= 0 && st.y < 100) date.setUTCFullYear(st.y);
  const t = date.getTime();
  if (!Number.isFinite(t)) return null;
  // 달력 검사 — 시간대 이동 전 성분으로 (zone 을 뺀 뒤 비교). 월·일·시·분·초 넘침을 전부 거부.
  const probe = new Date(
    Date.UTC(
      st.y >= 0 && st.y < 100 ? 2000 : st.y,
      month,
      st.d,
      st.H,
      st.M,
      st.S,
      st.L,
    ),
  );
  if (
    (st.j
      ? st.d < 1 || st.d > 366
      : probe.getUTCMonth() !== month || probe.getUTCDate() !== st.d) ||
    probe.getUTCHours() !== st.H ||
    probe.getUTCMinutes() !== st.M ||
    probe.getUTCSeconds() !== st.S ||
    probe.getUTCMilliseconds() !== st.L
  )
    return null;
  return t;
}

// ── 2단 라벨 표 (RSC `axisLabelUtils.ts:51-65`) ─────────────────────────────

export interface TimeLabelFormats {
  /** 눈금마다 (secondary) */
  tick: string;
  /** 큰 단위 경계마다 (primary) — `null` 이면 1단 */
  boundary: string | null;
}

/**
 * granularity → (눈금 형식, 경계 형식). RSC 의 `granularity` 표 그대로 — 눈금은 작은 단위,
 * 경계는 그 위 단위. 경계 판정 (`isTimeBoundary`) 은 눈금이 상위 interval 의 floor 와 같을 때.
 */
export function timeLabelFormats(
  granularity: TimeGranularity,
): TimeLabelFormats {
  switch (granularity) {
    case "millisecond":
      return { tick: ".%L", boundary: ":%S" };
    case "second":
      return { tick: ":%S", boundary: "%-I:%M %p" };
    case "minute":
      return { tick: "%-I:%M %p", boundary: "%b %-d" };
    case "hour":
      return { tick: "%-I %p", boundary: "%b %-d" };
    case "day":
    case "week":
      return { tick: "%-d", boundary: "%b" };
    case "month":
      return { tick: "%b", boundary: "%Y" };
    case "year":
      return { tick: "%Y", boundary: null };
  }
}
