import { describe, expect, it } from "vitest";
import {
  catalogTimelineChromeColors,
  catalogTimelineChromeRects,
  catalogTimelineItemPadding,
  catalogTimelineSide,
  catalogTimelineStatus,
  type TimelineItemGeometryInput,
} from "../rule/timeline";
import { catalogTimelineDateTime } from "../runtime/timeline";
import { catalogBoundRows } from "../runtime/dataBinding";

/**
 * ADR-323 G2 — Timeline 의 기하 정답표 (손으로 쓴 px — 함수 출력으로 채점하지 않는다) · 상태 값 ·
 * `time` 값 · 바인딩의 날짜 축 역할이 행에 실리는지. 크기 M (표식 12 · 간격 12 · 끝 여백 16), 선 두께 2 ·
 * 선 간격 4, 제목 행간 20 (표식 top 4).
 */
const M = (
  orientation: TimelineItemGeometryInput["orientation"],
  placement: TimelineItemGeometryInput["placement"],
  side: TimelineItemGeometryInput["side"],
): TimelineItemGeometryInput => ({
  orientation,
  placement,
  side,
  size: "M",
  lineHeight: 20,
});

describe("ADR-323 G2 — Timeline geometry (M, line height 20)", () => {
  it("vertical · end: content after the line, the connector down to the next marker", () => {
    const input = M("vertical", "end", "end");
    expect(catalogTimelineItemPadding(input)).toEqual({
      top: 0,
      right: 0,
      bottom: 16,
      left: 24,
    });
    expect(
      catalogTimelineChromeRects({
        ...input,
        last: false,
        width: 200,
        height: 60,
      }),
    ).toEqual({
      marker: { x: 0, y: 4, width: 12, height: 12 },
      // top 4 + 12 + 4 = 20, to the next marker (next top + 4) − 4 = box bottom.
      connector: { x: 5, y: 20, width: 2, height: 40 },
    });
  });

  it("vertical · start: the line at the end, the texts aligned to it", () => {
    const input = M("vertical", "start", "start");
    expect(catalogTimelineItemPadding(input)).toEqual({
      top: 0,
      right: 24,
      bottom: 16,
      left: 0,
    });
    expect(
      catalogTimelineChromeRects({
        ...input,
        last: false,
        width: 200,
        height: 60,
      }),
    ).toEqual({
      marker: { x: 188, y: 4, width: 12, height: 12 },
      connector: { x: 193, y: 20, width: 2, height: 40 },
    });
  });

  it("vertical · alternate: the chrome straddles the box edge (the list's middle)", () => {
    expect(catalogTimelineSide("vertical", "alternate", 0)).toBe("end");
    expect(catalogTimelineSide("vertical", "alternate", 1)).toBe("start");
    const after = M("vertical", "alternate", "end");
    expect(catalogTimelineItemPadding(after).left).toBe(18);
    expect(
      catalogTimelineChromeRects({
        ...after,
        last: false,
        width: 200,
        height: 60,
      }),
    ).toEqual({
      marker: { x: -6, y: 4, width: 12, height: 12 },
      connector: { x: -1, y: 20, width: 2, height: 40 },
    });
    const before = M("vertical", "alternate", "start");
    expect(catalogTimelineItemPadding(before).right).toBe(18);
    expect(
      catalogTimelineChromeRects({
        ...before,
        last: true,
        width: 200,
        height: 60,
      }),
    ).toEqual({ marker: { x: 194, y: 4, width: 12, height: 12 } });
  });

  it("horizontal · end · start: the marker on the line's row, the connector to the next item", () => {
    expect(catalogTimelineSide("horizontal", "alternate", 1)).toBe("end");
    const below = M("horizontal", "end", "end");
    expect(catalogTimelineItemPadding(below)).toEqual({
      top: 24,
      right: 16,
      bottom: 0,
      left: 0,
    });
    expect(
      catalogTimelineChromeRects({
        ...below,
        last: false,
        width: 150,
        height: 50,
      }),
    ).toEqual({
      marker: { x: 0, y: 0, width: 12, height: 12 },
      connector: { x: 16, y: 5, width: 130, height: 2 },
    });
    const above = M("horizontal", "start", "start");
    expect(catalogTimelineItemPadding(above).bottom).toBe(24);
    expect(
      catalogTimelineChromeRects({
        ...above,
        last: false,
        width: 150,
        height: 50,
      }),
    ).toEqual({
      marker: { x: 0, y: 38, width: 12, height: 12 },
      connector: { x: 16, y: 43, width: 130, height: 2 },
    });
  });

  it("status (사용자 결정 1): three values, case-blind, anything else completed", () => {
    expect(
      ["Completed", " current ", "UPCOMING", "", "done", undefined, 3].map(
        catalogTimelineStatus,
      ),
    ).toEqual([
      "completed",
      "current",
      "upcoming",
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
    expect(catalogTimelineChromeColors("completed")).toEqual({
      markerFill: "{color.gray}",
      connector: "{color.gray}",
    });
    expect(catalogTimelineChromeColors("current")).toEqual({
      markerFill: "{color.accent}",
      connector: "{color.field-placeholder}",
    });
    expect(catalogTimelineChromeColors("upcoming")).toEqual({
      markerBorder: "{color.field-placeholder}",
      connector: "{color.field-placeholder}",
    });
  });

  it("a date text's `time` value: ISO day · day and time (· offset), else none", () => {
    expect(
      [
        "2026-11-24",
        "2026-11-24 10:00",
        "2026-11-24T10:00:30.5+09:00",
        "2026-11-24T23:00Z",
        "Nov 24",
        "2026-11",
        "",
        20261124,
      ].map(catalogTimelineDateTime),
    ).toEqual([
      "2026-11-24",
      "2026-11-24T10:00",
      "2026-11-24T10:00:30.5+09:00",
      "2026-11-24T23:00Z",
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("ADR-323 G2 — a binding's date-axis roles ride on its rows", () => {
  const SOURCE = {
    id: "history",
    name: "History",
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-when", key: "when", type: "date" },
      { id: "f-name", key: "name", type: "string" },
      { id: "f-state", key: "state", type: "string" },
    ],
    mockData: [
      { id: "a", when: "2026-11-20", name: "Received", state: "completed" },
      { id: "b", when: "2026-11-21T09:30", name: "Packing", state: "current" },
      { id: "c", name: "Ship" },
    ],
    useMockData: true,
  };
  it("each row carries its raw values in the named roles (field id → key); none when unnamed", () => {
    const rows = catalogBoundRows(
      {
        collectionId: "data:collection:history",
        fieldMap: {
          start: "data:field:f-when",
          title: "data:field:f-name",
          color: "data:field:f-state",
        },
      } as never,
      [SOURCE as never],
      "items",
    )!;
    expect(rows.map((row) => [row.key, row.dateAxis])).toEqual([
      ["a", { start: "2026-11-20", title: "Received", color: "completed" }],
      ["b", { start: "2026-11-21T09:30", title: "Packing", color: "current" }],
      ["c", { start: undefined, title: "Ship", color: undefined }],
    ]);
    const plain = catalogBoundRows(
      { collectionId: "data:collection:history", fieldMap: {} } as never,
      [SOURCE as never],
      "items",
    )!;
    expect(plain.some((row) => "dateAxis" in row)).toBe(false);
  });
});
