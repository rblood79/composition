import type { PropContract } from "../types";

/**
 * S2 `isDateUnavailable` (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 함수가 아니라 요일 ·
 * 날짜 목록 · 데이터 표): the weekdays and dates no one may pick (`unavailableDates.ts`). The dates a
 * data table names come from the node's binding (`UNAVAILABLE_DATA_PROP` — its 「Unavailable date」
 * field and its conditions). A DatePicker's · DateRangePicker's calendar takes the picker's (RAC's
 * calendar context — `CATALOG_PICKER_CALENDAR_PROPS`).
 */
export const UNAVAILABLE_DATES_PROP: PropContract = {
  kind: "unavailable-dates",
  label: "Unavailable dates",
  section: "value",
};

/** The data table whose rows name unavailable dates (the node's binding — composition's data layer). */
export const UNAVAILABLE_DATA_PROP: PropContract = {
  kind: "binding",
  label: "Data source",
  section: "collection",
};
