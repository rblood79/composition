/**
 * Calendar ↔ RangeCalendar layout 대칭 검증
 *
 * RangeCalendarSpec은 `{...CalendarSpec}`로 shapes/sizes를 공유하므로
 * layout engine도 두 tag를 동일하게 처리해야 한다. `calculateContentHeight`
 * 및 border-box 경로의 tag 소문자 매칭(`calendar` 전용)에 `rangecalendar`를
 * 포함시킨 수정이 실제로 대칭을 복원하는지 검증.
 */

import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../types/builder/unified.types";
import { calculateContentHeight } from "./utils";

function makeHeader(parentId: string): Element {
  return {
    id: `${parentId}-hdr`,
    type: "CalendarHeader",
    props: { size: "md", children: "2026년 4월" },
    parent_id: parentId,
    order_num: 1,
  } as Element;
}

function makeGrid(parentId: string): Element {
  return {
    id: `${parentId}-grid`,
    type: "CalendarGrid",
    props: {
      size: "md",
      defaultToday: true,
      dayOffset: 3,
      totalDays: 30,
      todayDate: 17,
    },
    parent_id: parentId,
    order_num: 2,
  } as Element;
}

function makeCalendarLike(type: "Calendar" | "RangeCalendar"): Element {
  return {
    id: `${type.toLowerCase()}-root`,
    type,
    props: { size: "md", variant: "default" },
    parent_id: null,
    order_num: 0,
  } as Element;
}

describe("Calendar ↔ RangeCalendar layout symmetry", () => {
  const AVAILABLE_WIDTH = 284;

  it("자식 2개(CalendarHeader + CalendarGrid): 두 태그 높이 동일", () => {
    const cal = makeCalendarLike("Calendar");
    const rng = makeCalendarLike("RangeCalendar");
    const children = (parent: Element) => [
      makeHeader(parent.id),
      makeGrid(parent.id),
    ];

    const calH = calculateContentHeight(
      cal,
      AVAILABLE_WIDTH,
      children(cal),
      (id) => (id === cal.id ? children(cal) : []),
    );
    const rngH = calculateContentHeight(
      rng,
      AVAILABLE_WIDTH,
      children(rng),
      (id) => (id === rng.id ? children(rng) : []),
    );

    expect(calH).toBeGreaterThan(0);
    expect(rngH).toBe(calH);
  });

  it("자식 1개(CalendarHeader만): 두 태그 높이 동일", () => {
    const cal = makeCalendarLike("Calendar");
    const rng = makeCalendarLike("RangeCalendar");
    const children = (parent: Element) => [makeHeader(parent.id)];

    const calH = calculateContentHeight(
      cal,
      AVAILABLE_WIDTH,
      children(cal),
      (id) => (id === cal.id ? children(cal) : []),
    );
    const rngH = calculateContentHeight(
      rng,
      AVAILABLE_WIDTH,
      children(rng),
      (id) => (id === rng.id ? children(rng) : []),
    );

    expect(calH).toBeGreaterThan(0);
    expect(rngH).toBe(calH);
  });

  it("자식 0개: 두 태그 height 0 (standalone 회귀 금지)", () => {
    const cal = makeCalendarLike("Calendar");
    const rng = makeCalendarLike("RangeCalendar");

    const calH = calculateContentHeight(cal, AVAILABLE_WIDTH, [], () => []);
    const rngH = calculateContentHeight(rng, AVAILABLE_WIDTH, [], () => []);

    expect(calH).toBe(0);
    expect(rngH).toBe(0);
  });
});
