import { describe, it, expect } from "vitest";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
  createCalendarDefinition,
} from "../DateColorComponents";
import { createRangeCalendarDefinition } from "../DisplayComponents";
import type { ComponentCreationContext } from "../../types";

/**
 * 회귀 방지 (2026-07-07): Calendar 계열 factory 의 CalendarGrid child 가 `locale` prop 을
 * 주입하는지 검증.
 *
 * **배경 (CSS↔Skia 발산)**: Skia `calendar_month_grid` / `calendar_grid` escape 는 요일 헤더를
 * `Intl.DateTimeFormat(props.locale ?? "en-US")` 로 생성한다. factory 가 CalendarGrid 에 locale 을
 * 주입하지 않으면 escape 가 `en-US` 로 fallback → Skia 요일이 영어(`Sun Mon…`). 반면 Preview DOM 은
 * RAC `I18nProvider` 의 locale context(예: ko)를 읽어 한국어(`일 월…`) → 두 렌더 발산.
 * nav 타이틀(monthText)은 static string 이라 이미 navigator.language 로 생성되므로, 동일 locale 을
 * CalendarGrid 에도 주입해 escape 요일이 DOM 과 정합하게 한다.
 *
 * escape 자체 mechanism 은 정상(locale 주면 한국어 emit) — 결함은 factory 미주입.
 */

const ctx: ComponentCreationContext = {
  parentElement: null,
  elements: [],
} as unknown as ComponentCreationContext;

type FactoryNode = { type: string; props?: unknown; children?: unknown };

function findCalendarGrids(root: FactoryNode): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = (n: FactoryNode): void => {
    if (n.type === "CalendarGrid") out.push(n.props as Record<string, unknown>);
    if (Array.isArray(n.children)) {
      for (const c of n.children as FactoryNode[]) walk(c);
    }
  };
  walk(root);
  return out;
}

// factory 는 navigator.language 로 locale 을 해소 — 테스트 환경 navigator.language 를 기준으로
// 기대값 계산(하드코딩 "ko-KR" 금지 — CI locale 무관 일반화).
const expectedLocale =
  (typeof navigator !== "undefined" && navigator.language) || "ko-KR";

const definitions: Array<[string, () => { children?: unknown }]> = [
  ["createDatePickerDefinition", () => createDatePickerDefinition(ctx)],
  [
    "createDateRangePickerDefinition",
    () => createDateRangePickerDefinition(ctx),
  ],
  ["createCalendarDefinition", () => createCalendarDefinition(ctx)],
  ["createRangeCalendarDefinition", () => createRangeCalendarDefinition(ctx)],
];

describe("Calendar 계열 factory — CalendarGrid 에 locale 주입 (Skia 요일 locale 정합)", () => {
  it.each(definitions)(
    "%s 의 CalendarGrid 가 locale prop 을 갖는다",
    (_name, make) => {
      const def = make();
      const grids = findCalendarGrids(def as FactoryNode);
      expect(grids.length).toBeGreaterThanOrEqual(1);
      for (const g of grids) {
        expect(g.locale).toBe(expectedLocale);
      }
    },
  );
});
