/**
 * ADR-313 G3 — 감지 후보 (§2.5). 정답은 손으로 쓴 Spring 표본의 정답표 (`SPRING_ANSWERS`) 다 — 후보가
 * 정답의 값 표현을 내는지, 기본 선택은 큰 정수뿐인지, R6 의 반례가 후보에서 빠지는지.
 */
import { describe, expect, it } from "vitest";
import { parseJsonLossless } from "../../../../../../../packages/shared/src/collections/intake/parseJsonLossless";
import {
  SPRING_ANSWERS,
  SPRING_PAGE_RESPONSE_TEXT,
} from "../../../../../../../packages/shared/src/collections/intake/__tests__/fixtures/springSamples";
import { applyColumnChoice, columnsToSchema, detectColumns } from "./columnDetector";
import { intakeRows } from "./intakeRows";
import { parsePastedRows } from "./pasteRows";

const rows = (parseJsonLossless(SPRING_PAGE_RESPONSE_TEXT) as { content: Record<string, unknown>[] }).content;

describe("ADR-313 G3 — 감지 후보 (Spring 표본)", () => {
  const columns = detectColumns(rows, "json");
  const byKey = new Map(columns.map((c) => [c.key, c]));

  it("정답표의 값 표현이 후보에 있다 · 기본 선택은 큰 정수뿐", () => {
    for (const answer of SPRING_ANSWERS) {
      const col = byKey.get(answer.key)!;
      if (!answer.encoding) {
        expect(col.encoding, answer.key).toBeUndefined();
        continue;
      }
      if (answer.encodingIs === "default") {
        expect([col.type, col.encoding], answer.key).toEqual([answer.type, answer.encoding]);
      } else {
        expect(col.encoding, answer.key).toBeUndefined();
        expect(col.candidates, answer.key).toContainEqual({ type: answer.type, encoding: answer.encoding });
      }
    }
  });

  it("후보를 고르면 저장 값이 정답표와 같다", () => {
    const chosen = columns.map((col) => {
      const answer = SPRING_ANSWERS.find((a) => a.key === col.key)!;
      return answer.encoding ? applyColumnChoice(col, { type: answer.type, encoding: answer.encoding }) : col;
    });
    const schema = columnsToSchema(chosen);
    const { rows: stored, report } = intakeRows(rows, schema, "json");
    for (const answer of SPRING_ANSWERS)
      expect(stored.map((row) => row[answer.key]), answer.key).toEqual(answer.stored);
    expect(report.unread).toEqual({});
  });

  it("key 후보 — USER_ID (모두 있고 서로 다름) · DEPT_ID 는 null 이 있어 아님", () => {
    expect(columns.filter((c) => c.keyCandidate).map((c) => c.key)).toEqual(["USER_ID"]);
  });

  it("R6 반례 — 0 으로 시작하는 숫자 글자 · 한 글자 코드 · 이름 없는 epoch 는 후보가 아니다", () => {
    const cols = detectColumns(
      [
        { ZIP: "01234", CODE: "Y", N: 1793928600000 },
        { ZIP: "06236", CODE: "Y", N: 1794042930000 },
      ],
      "json",
    );
    const of = (key: string) => cols.find((c) => c.key === key)!.candidates;
    expect(of("ZIP")).toEqual([]);
    // (값이 한 종류뿐 — Y 만 있는 열은 참 · 거짓 후보가 아니다.)
    expect(of("CODE")).toEqual([]);
    expect(of("N")).toEqual([]);
  });

  it("처음 5 행이 null 인 열 · 첫 행에 없는 키도 감지한다", () => {
    const sample = [
      ...Array.from({ length: 6 }, () => ({ a: 1, late: null })),
      { a: 2, late: "Y", extra: 5 },
      { a: 3, late: "N" },
    ];
    const cols = detectColumns(sample, "json");
    expect(cols.map((c) => c.key)).toEqual(["a", "late", "extra"]);
    expect(cols.find((c) => c.key === "late")!.candidates).toContainEqual({
      type: "boolean",
      encoding: { kind: "flag", true: "Y", false: "N" },
    });
    expect(cols.find((c) => c.key === "extra")!.type).toBe("number");
  });

  it("글자 원본 — Y/N · 8 자리 날짜 · 큰 정수 (기본 선택)", () => {
    const parsed = parsePastedRows("ID\tUSE_YN\tJOIN_DT\n9007199254740993\tY\t20261106\n1001\tN\t20260102");
    if (!parsed.ok) throw new Error();
    const cols = detectColumns(parsed.rows, "text");
    const of = (key: string) => cols.find((c) => c.key === key)!;
    expect([of("ID").type, of("ID").encoding]).toEqual(["string", { kind: "bigInt" }]);
    expect(of("USE_YN").candidates).toContainEqual({ type: "boolean", encoding: { kind: "flag", true: "Y", false: "N" } });
    expect(of("JOIN_DT").type).toBe("number");
    expect(of("JOIN_DT").candidates).toContainEqual({ type: "date", encoding: { kind: "compactDate", wire: "string" } });
  });
});
