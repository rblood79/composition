/**
 * ADR-313 G0 → G2 — 전후 표 (breakdown §2.3) 의 「표준」 열. Phase 0 (main `62d56d224`) 에 「지금」 열을 이
 * 파일로 고정했고 (그 값은 각 기대 옆 주석과 breakdown §8 에 있다), Phase 2 가 네 진입을 변환기에 연결하면서
 * 기대 값을 표준으로 바꿨다. 기대 값은 손으로 쓴 것이다 (변환기 출력으로 만들지 않았다).
 *
 * 길 (실제 진입 코드를 그대로 부른다):
 * - (a) 생성 — 붙여넣기 · 파일: `parsePastedRows` / Papa (`dynamicTyping` 없음) → `detectColumns(rows, source)` →
 *   `intakeRows` (`DataTableCreator.tsx` 의 `imported`).
 * - (b) 기존 표로 가져오기: `planImport(rows, schema, source)` → `importPlanToOps`.
 * - (c) Builder API 실행: `parseJsonLossless` → `resolveResponseData` → `intakeQueryItems` (`dataActions.ts`).
 * - (d) Preview · Publish 조회: `loadCollectionEndpoint` → `intakeQueryItems` (`catalogPreviewSession.ts`).
 */
import Papa from "papaparse";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { resolveResponseData } from "../../../../utils/data/responseData";
import { loadCollectionEndpoint } from "../../../../../../../packages/shared/src/collections/executeCollectionEndpoint";
import { intakeQueryItems } from "../../../../../../../packages/shared/src/collections/intake/queryItems";
import { parseJsonLossless } from "../../../../../../../packages/shared/src/collections/intake/parseJsonLossless";
import type { ApiEndpointDefinition } from "../../../../../../../packages/shared/src/types/collection.types";
import {
  SPRING_CSV_TEXT,
  SPRING_PAGE_RESPONSE_TEXT,
} from "../../../../../../../packages/shared/src/collections/intake/__tests__/fixtures/springSamples";
import { columnsToSchema, detectColumns } from "./columnDetector";
import { importPlanReport, importPlanToOps, planImport } from "./importPlan";
import { intakeRows } from "./intakeRows";
import { parsePastedRows, pastedRowsSource } from "./pasteRows";

type Rows = Record<string, unknown>[];

/** (a) 생성의 붙여넣기 — 행과 감지한 스키마. */
function created(text: string): { rows: Rows; schema: DataField[] } {
  const parsed = parsePastedRows(text);
  if (!parsed.ok) throw new Error(parsed.reason);
  const source = pastedRowsSource(parsed.format);
  const schema = columnsToSchema(detectColumns(parsed.rows, source));
  return { rows: intakeRows(parsed.rows, schema, source).rows as Rows, schema };
}

/** (a) 생성의 CSV 파일 — `DataTableCreator.tsx` `rowsFromFileText` 의 Papa 설정. */
function createdFromCsvFile(text: string): { rows: Rows; schema: DataField[] } {
  const rows = Papa.parse<Record<string, unknown>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const schema = columnsToSchema(detectColumns(rows, "text"));
  return { rows: intakeRows(rows, schema, "text").rows as Rows, schema };
}

const typeOf = (schema: DataField[], key: string) =>
  schema.find((f) => f.key === key)?.type;

/** (b) 기존 표로 가져오기 (append) 가 쓰는 행. */
function imported(
  rows: Rows,
  schema: DataField[],
  source: "json" | "text" = "json",
): Rows {
  const ops = importPlanToOps(planImport(rows, schema, source), {
    collectionId: "c1",
    mode: "append",
  });
  const insert = ops.find((op) => op.op === "insert_rows");
  if (!insert || insert.op !== "insert_rows") throw new Error("no insert_rows");
  return insert.rows as Rows;
}

/** (c) Builder API 실행. */
function builderRun(
  text: string,
  schema: DataField[],
  dataPath?: string,
): Rows {
  const data = resolveResponseData(parseJsonLossless(text), dataPath).data;
  return intakeQueryItems(Array.isArray(data) ? data : [data], {
    schema,
  }) as Rows;
}

/** (d) Preview · Publish 조회 — fetch 를 응답 원문으로 바꿔 실제 `loadCollectionEndpoint` 를 돈다. */
async function sessionRun(
  text: string,
  schema: DataField[],
  dataPath?: string,
): Promise<Rows> {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(text, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
  const endpoint = {
    id: "e1",
    name: "users",
    method: "GET",
    baseUrl: "https://api.example.com",
    path: "/users",
    queryParams: [],
    headers: [],
    bodyType: "none",
    responseMapping: dataPath ? { dataPath } : undefined,
  } as unknown as ApiEndpointDefinition;
  const { items } = await loadCollectionEndpoint(
    endpoint,
    new AbortController().signal,
  );
  return intakeQueryItems(items, { schema }) as Rows;
}

afterEach(() => vi.unstubAllGlobals());

const field = (
  key: string,
  type: DataField["type"],
  encoding?: DataField["encoding"],
): DataField => ({
  id: `f-${key}`,
  key,
  type,
  ...(encoding ? { encoding } : {}),
});

describe("ADR-313 G2 — 전후 표 「표준」 열 (breakdown §2.3)", () => {
  it("1 ~ 4 — (b) JSON 원본은 선언 없는 값을 바꾸지 않고 「타입과 다른 셀」 로 센다", () => {
    const rows = [{ flag: "Y", amount: "42", label: 42, broken: "abc" }];
    const schema = [
      field("flag", "boolean"),
      field("amount", "number"),
      field("label", "string"),
      field("broken", "number"),
    ];
    // 지금 (Phase 0): { flag: true, amount: 42, label: "42", broken: null }.
    expect(imported(rows, schema)).toEqual([
      { flag: "Y", amount: "42", label: 42, broken: "abc" },
    ]);
    expect(
      importPlanReport(planImport(rows, schema, "json")).typeMismatch,
    ).toEqual({
      flag: 1,
      amount: 1,
      label: 1,
      broken: 1,
    });
    // 값 표현을 고르면 (Phase 3 의 후보) 읽힌다.
    const declared = [
      field("flag", "boolean", { kind: "flag", true: "Y", false: "N" }),
      field("amount", "number", { kind: "numberText" }),
    ];
    expect(imported([{ flag: "Y", amount: "42" }], declared)).toEqual([
      { flag: true, amount: 42 },
    ]);
  });

  it("5 · F4 수리 — 같은 JSON 이 네 진입에서 같은 행 (선언 없는 값은 원본 그대로)", async () => {
    const text = '[{"flag": "Y", "amount": "42", "label": 42}]';
    const schema = [
      field("flag", "boolean"),
      field("amount", "number"),
      field("label", "string"),
    ];
    const expected = [{ flag: "Y", amount: "42", label: 42 }];
    expect(created(text).rows).toEqual(expected);
    expect(imported(JSON.parse(text), schema)).toEqual(expected);
    expect(builderRun(text, schema)).toEqual(expected);
    expect(await sessionRun(text, schema)).toEqual(expected);
  });

  it("5' — 선언이 있는 스키마는 네 진입에서 같은 정규 값", async () => {
    const text = '[{"flag": "Y", "amount": "4500000.00", "day": "20261106"}]';
    const schema = [
      field("flag", "boolean", { kind: "flag", true: "Y", false: "N" }),
      field("amount", "number", { kind: "numberText" }),
      field("day", "date", { kind: "compactDate", wire: "string" }),
    ];
    const expected = [{ flag: true, amount: 4500000, day: "2026-11-06" }];
    expect(imported(parseJsonLossless(text) as Rows, schema)).toEqual(expected);
    expect(builderRun(text, schema)).toEqual(expected);
    expect(await sessionRun(text, schema)).toEqual(expected);
  });

  it('6 · F5 수리 — JSON 의 2^53 + 1 은 네 진입 모두 글자 "9007199254740993"', async () => {
    const text = '[{"USER_ID": 9007199254740993}]';
    // 지금 (Phase 0): 네 진입 모두 9007199254740992.
    expect(created(text).rows[0].USER_ID).toBe("9007199254740993");
    expect(
      imported(parseJsonLossless(text) as Rows, [field("USER_ID", "string")])[0]
        .USER_ID,
    ).toBe("9007199254740993");
    expect(builderRun(text, [field("USER_ID", "string")])[0].USER_ID).toBe(
      "9007199254740993",
    );
    expect(
      (await sessionRun(text, [field("USER_ID", "string")]))[0].USER_ID,
    ).toBe("9007199254740993");
  });

  it("7 — CSV 파일 · 탭 · 쉼표 붙여넣기의 01234 는 글자 (string 열)", () => {
    for (const { rows, schema } of [
      createdFromCsvFile("zip,name\n01234,Ann"),
      created("zip\tname\n01234\tAnn"),
      created("zip,name\n01234,Ann"),
    ]) {
      // 지금 (Phase 0): 1234 (number 열).
      expect(rows[0].zip).toBe("01234");
      expect(typeOf(schema, "zip")).toBe("string");
    }
  });

  it("8 — 탭 붙여넣기 한 열의 42 · abc 는 글자 (string 열 — 셀 타입이 열 타입과 같다)", () => {
    const { rows, schema } = created("value\tname\n42\tAnn\nabc\tBob");
    // 지금 (Phase 0): 값 42 · "abc" 가 섞인 number 열.
    expect(rows.map((row) => row.value)).toEqual(["42", "abc"]);
    expect(typeOf(schema, "value")).toBe("string");
  });

  it("9 — 숫자 열 · true/false 열은 그대로 숫자 · boolean (달라지지 않는다)", () => {
    // (전후 표 9 행 = 「42 만 있는 열 · true 만 있는 열」. 한 열에 42 와 true 가 섞이면 8 행과 같이 string 열.)
    const { rows, schema } = created("n\tb\n42\ttrue\n7\tfalse");
    expect(rows).toEqual([
      { n: 42, b: true },
      { n: 7, b: false },
    ]);
    expect([typeOf(schema, "n"), typeOf(schema, "b")]).toEqual([
      "number",
      "boolean",
    ]);
  });

  it("10 · F5 수리 — 붙여넣기 (탭 · 쉼표 CSV) · CSV 파일의 큰 정수는 글자 (string 열)", () => {
    for (const { rows, schema } of [
      created("id\tname\n9007199254740993\tAnn"),
      created("id,name\n9007199254740993,Ann"),
      createdFromCsvFile("id,name\n9007199254740993,Ann"),
    ]) {
      // 지금 (Phase 0): 붙여넣기 9007199254740992, Papa CSV 파일 "9007199254740993".
      expect(rows[0].id).toBe("9007199254740993");
      expect(typeOf(schema, "id")).toBe("string");
    }
  });

  it("11 — CSV · 탭 → 기존 표는 대상 타입의 글자 읽기 (달라지지 않는다)", () => {
    const rows = parsePastedRows("flag\tamount\nY\t042");
    if (!rows.ok) throw new Error();
    expect(
      imported(
        rows.rows,
        [field("flag", "boolean"), field("amount", "number")],
        "text",
      ),
    ).toEqual([{ flag: true, amount: 42 }]);
  });
});

describe("ADR-313 G2 — Spring 표본의 감지 (타입의 기본 선택 — 값 표현 후보는 Phase 3)", () => {
  it("열 = 키 합집합 · 타입 = 표본 전부의 일치", () => {
    const page = parseJsonLossless(SPRING_PAGE_RESPONSE_TEXT) as {
      content: Rows;
    };
    const detected = Object.fromEntries(
      detectColumns(page.content, "json").map((col) => [col.key, col.type]),
    );
    expect(detected).toEqual({
      USER_ID: "string", // 지금: number. 글자 (큰 정수) 와 숫자 (1001) 가 섞인 열 — bigInt 기본 선택은 Phase 3
      USER_NM: "string",
      USE_YN: "string", // 후보 flag (Phase 3)
      ACTIVE_FLAG: "number",
      SALARY_AMT: "string", // 후보 numberText (Phase 3)
      JOIN_DT: "string",
      REG_DTM: "string",
      UPD_TS: "number",
      createdAt: "date",
      birthDate: "array",
      lastLoginAt: "array",
      ZIP_CD: "string",
      email: "string",
      DEPT_ID: "number",
    });
    // 글자 안의 숫자는 그대로 (R3).
    expect(page.content[2].USER_NM).toBe('Lee "Sam" 9007199254740993');
  });

  it("CSV 내려받기 — USER_ID · ZIP_CD 는 글자, SALARY_AMT 는 숫자 열", () => {
    const { rows, schema } = createdFromCsvFile(SPRING_CSV_TEXT);
    expect(rows.map((row) => row.USER_ID)).toEqual([
      "9007199254740993",
      "9007199254740995",
      "1001",
    ]);
    expect(rows[0].ZIP_CD).toBe("01234");
    expect(typeOf(schema, "SALARY_AMT")).toBe("number");
    expect(rows.map((row) => row.SALARY_AMT)).toEqual([4500000, 3800000.5, 0]);
    // (붙여 쓴 날짜는 8 자리 숫자로 감지 — date + compactDate 후보는 Phase 3.)
    expect(typeOf(schema, "JOIN_DT")).toBe("number");
  });
});
