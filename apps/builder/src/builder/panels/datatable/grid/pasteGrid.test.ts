/**
 * ADR-212 Phase 2 UX-3 — 격자 붙여넣기 계획. 스프레드시트 클립보드 (TSV) 를 anchor 셀부터
 * 채우고, 넘치는 행은 insert_rows, 넘치는 열은 "새 필드로 추가?" 후보로 분리한다.
 * 파싱 실패 셀은 null 로 비우고 위치를 돌려준다 (0 으로 바꾸지 않음).
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { planGridPaste, gridPasteToOps, parseClipboardGrid } from "./pasteGrid";

const schema: DataField[] = [
  { id: "f-id", key: "id", type: "number" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-age", key: "age", type: "number" },
];

describe("parseClipboardGrid", () => {
  it("탭이 있으면 TSV, 없으면 줄마다 한 셀, 한 줄이면 값 하나 (쉼표 보존)", () => {
    expect(parseClipboardGrid("a\tb\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseClipboardGrid("x\ny\n")).toEqual([["x"], ["y"]]);
    expect(parseClipboardGrid("Doe, Jane")).toEqual([["Doe, Jane"]]);
  });
  it("빈 텍스트는 빈 격자", () => {
    expect(parseClipboardGrid("   \n")).toEqual([]);
  });
});

describe("planGridPaste", () => {
  it("anchor 부터 기존 행·열을 채우고 타입을 강제한다", () => {
    const plan = planGridPaste({
      grid: [
        ["Ann", "30"],
        ["Bob", "x"],
      ],
      schema,
      rowCount: 3,
      anchor: { rowIndex: 1, colIndex: 1 },
    });
    expect(plan.cells).toEqual([
      { rowIndex: 1, key: "name", value: "Ann", invalid: false },
      { rowIndex: 1, key: "age", value: 30, invalid: false },
      { rowIndex: 2, key: "name", value: "Bob", invalid: false },
      { rowIndex: 2, key: "age", value: null, invalid: true },
    ]);
    expect(plan.newRows).toEqual([]);
    expect(plan.extraColumns).toEqual([]);
    expect(plan.invalidCount).toBe(1);
  });
  it("넘치는 행은 스키마 모양의 새 행 (빠진 키는 null)", () => {
    const plan = planGridPaste({
      grid: [["7", "Zed", "50"]],
      schema,
      rowCount: 0,
      anchor: { rowIndex: 0, colIndex: 0 },
    });
    expect(plan.cells).toEqual([]);
    expect(plan.newRows).toEqual([{ id: 7, name: "Zed", age: 50 }]);
  });
  it("넘치는 열은 extraColumns 로 (이름은 col_N, 값은 행별)", () => {
    const plan = planGridPaste({
      grid: [
        ["40", "NYC"],
        ["41", "LA"],
      ],
      schema,
      rowCount: 1,
      anchor: { rowIndex: 0, colIndex: 2 },
    });
    expect(plan.cells).toEqual([
      { rowIndex: 0, key: "age", value: 40, invalid: false },
    ]);
    expect(plan.newRows).toEqual([{ id: null, name: null, age: 41 }]);
    expect(plan.extraColumns).toEqual([
      { key: "col_4", type: "string", values: ["NYC", "LA"] },
    ]);
  });
});

describe("gridPasteToOps", () => {
  const plan = planGridPaste({
    grid: [
      ["40", "NYC"],
      ["41", "LA"],
    ],
    schema,
    rowCount: 1,
    anchor: { rowIndex: 0, colIndex: 2 },
  });
  it("extra 열 없이 — set_cell (field id 참조) + insert_rows 끝에", () => {
    expect(
      gridPasteToOps(plan, {
        collectionId: "c1",
        schema,
        addExtraColumns: false,
      }),
    ).toEqual([
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-age",
        value: 40,
      },
      {
        op: "insert_rows",
        collectionId: "c1",
        rows: [{ id: null, name: null, age: 41 }],
        at: 1,
      },
    ]);
  });
  it("extra 열 추가 — add_field 가 먼저, 기존 행은 set_cell (key 참조), 새 행에는 값 포함", () => {
    expect(
      gridPasteToOps(plan, {
        collectionId: "c1",
        schema,
        addExtraColumns: true,
      }),
    ).toEqual([
      {
        op: "add_field",
        collectionId: "c1",
        field: { key: "col_4", type: "string" },
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "f-age",
        value: 40,
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 0,
        fieldId: "col_4",
        value: "NYC",
      },
      {
        op: "insert_rows",
        collectionId: "c1",
        rows: [{ id: null, name: null, age: 41, col_4: "LA" }],
        at: 1,
      },
    ]);
  });
  it("계획이 비면 ops 도 비어 있다", () => {
    const empty = planGridPaste({
      grid: [],
      schema,
      rowCount: 1,
      anchor: { rowIndex: 0, colIndex: 0 },
    });
    expect(
      gridPasteToOps(empty, {
        collectionId: "c1",
        schema,
        addExtraColumns: false,
      }),
    ).toEqual([]);
  });
});
