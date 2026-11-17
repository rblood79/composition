/**
 * ADR-313 G1 — 변환기 (값 표현 읽기 · 되돌리기 · 진입 변환 · 큰 정수 보존 파싱). 기대 값은 손으로 쓴 정답표
 * (`fixtures/springSamples.ts`) 와 아래에 적은 값이다 — 변환기 출력으로 만들지 않았다 (Q5).
 */
import { describe, expect, it } from "vitest";
import {
  encodingProblem,
  readEncoded,
  writeEncoded,
  writeEncodedText,
  type FieldEncoding,
} from "../encoding";
import {
  normalizeRows,
  readTextCell,
  type IntakeField,
} from "../normalizeRows";
import {
  isRawJsonNumber,
  parseJsonLossless,
  parseJsonLosslessWithSource,
  rawJsonNumber,
  stringifyJsonLossless,
} from "../parseJsonLossless";
import {
  SPRING_ANSWERS,
  SPRING_PAGE_RESPONSE_TEXT,
} from "./fixtures/springSamples";

const fields: IntakeField[] = SPRING_ANSWERS.map((answer) => ({
  id: `f-${answer.key}`,
  key: answer.key,
  type: answer.type,
  ...(answer.encoding ? { encoding: answer.encoding as FieldEncoding } : {}),
}));

function springRows() {
  const page = parseJsonLossless(SPRING_PAGE_RESPONSE_TEXT) as {
    content: Record<string, unknown>[];
  };
  return page.content;
}

describe("ADR-313 G1 — 정답표 (Spring 표본)", () => {
  it("열마다 저장 값이 정답표와 같다", () => {
    const { rows, report } = normalizeRows(springRows(), fields, "json", {
      keyField: "f-USER_ID",
    });
    for (const answer of SPRING_ANSWERS)
      expect(
        rows.map((row) => row[answer.key]),
        answer.key,
      ).toEqual(answer.stored);
    expect(report.unread).toEqual({});
    expect(report.precision).toEqual({});
    expect(report.typeMismatch).toEqual({});
    expect(report.keyEmpty).toBe(0);
    expect(report.keyDuplicate).toBe(0);
  });

  it("되돌리면 서버가 같은 값으로 읽는 JSON 표현 — 같은 JSON 타입 · 같은 값 (HC7)", () => {
    const original = springRows();
    const { rows } = normalizeRows(original, fields, "json");
    for (const answer of SPRING_ANSWERS) {
      if (!answer.encoding) continue;
      const encoding = answer.encoding as FieldEncoding;
      const back = rows.map((row) => writeEncoded(encoding, row[answer.key]));
      if (encoding.kind === "bigInt") {
        // (따옴표 없는 literal — 원문의 숫자와 같은 글자.)
        expect(stringifyJsonLossless(back)).toBe(
          "[9007199254740993,9007199254740995,1001]",
        );
        continue;
      }
      expect(back, answer.key).toEqual(
        answer.outgoing ?? original.map((row) => row[answer.key]),
      );
    }
  });

  it("읽기는 멱등 — 정규 값을 다시 넣으면 같은 행 배열", () => {
    const once = normalizeRows(springRows(), fields, "json").rows;
    const twice = normalizeRows(once, fields, "json");
    expect(twice.rows).toBe(once);
    expect(twice.report.changedCells).toBe(0);
  });
});

describe("ADR-313 G1 — 대조쌍 (breakdown §2.1)", () => {
  const numberText: FieldEncoding = { kind: "numberText" };

  it('"4500000.00" 과 "4500000" 은 같은 수이고 되돌리면 같은 글자', () => {
    const a = readEncoded(numberText, "4500000.00");
    const b = readEncoded(numberText, "4500000");
    expect(a).toEqual({ ok: true, value: 4500000 });
    expect(b).toEqual(a);
    expect(writeEncoded(numberText, 4500000)).toBe("4500000");
  });

  it('숫자 20261106 과 글자 "20261106" 은 선언한 JSON 타입으로 되돌린다', () => {
    for (const raw of [20261106, "20261106"]) {
      for (const wire of ["number", "string"] as const) {
        const encoding: FieldEncoding = { kind: "compactDate", wire };
        const read = readEncoded(encoding, raw);
        expect(read).toEqual({ ok: true, value: "2026-11-06" });
        expect(writeEncoded(encoding, "2026-11-06")).toBe(
          wire === "number" ? 20261106 : "20261106",
        );
      }
    }
  });

  it('숫자 글자 "9007199254740993" 은 읽기 실패 (precision) — 근삿값으로 읽지 않는다', () => {
    expect(readEncoded(numberText, "9007199254740993")).toEqual({
      ok: false,
      reason: "precision",
    });
    expect(readEncoded(numberText, "0.10000000000000000001")).toEqual({
      ok: false,
      reason: "precision",
    });
    expect(readEncoded(numberText, "0.1")).toEqual({ ok: true, value: 0.1 });
    expect(readEncoded(numberText, "1e3")).toEqual({ ok: true, value: 1000 });
    expect(readEncoded(numberText, "abc")).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
});

describe("ADR-313 G1 — 종류마다 읽기 · 되돌리기 · 실패", () => {
  const cases: Array<{
    encoding: FieldEncoding;
    read: Array<[unknown, unknown]>;
    fail: Array<[unknown, "mismatch" | "precision"]>;
    write: Array<[unknown, unknown]>;
  }> = [
    {
      encoding: { kind: "flag", true: "Y", false: "N" },
      read: [
        ["Y", true],
        ["N", false],
        [true, true],
        [null, null],
      ],
      fail: [
        ["y", "mismatch"],
        [1, "mismatch"],
        ["", "mismatch"],
      ],
      write: [
        [true, "Y"],
        [false, "N"],
        [null, null],
      ],
    },
    {
      encoding: { kind: "flag", true: 1, false: 0 },
      read: [
        [1, true],
        [0, false],
      ],
      fail: [
        ["1", "mismatch"],
        [2, "mismatch"],
      ],
      write: [
        [true, 1],
        [false, 0],
      ],
    },
    {
      encoding: { kind: "epochMs", wire: "string" },
      read: [
        ["1793928600000", "2026-11-06T01:30:00Z"],
        [1793928600123, "2026-11-06T01:30:00.123Z"],
        ["2026-11-06T01:30:00Z", "2026-11-06T01:30:00Z"],
      ],
      fail: [
        ["abc", "mismatch"],
        [1.5, "mismatch"],
        [9007199254740992, "precision"],
      ],
      // (offset 없는 일시 · 날짜는 UTC 로 읽어 되돌린다.)
      write: [
        ["2026-11-06T01:30:00Z", "1793928600000"],
        ["2026-11-06T10:30:00+09:00", "1793928600000"],
        ["2026-11-06T01:30:00", "1793928600000"],
      ],
    },
    {
      encoding: { kind: "epochSec", wire: "number" },
      read: [[1793928600, "2026-11-06T01:30:00Z"]],
      fail: [["x", "mismatch"]],
      // (초 아래 자리는 버린다.)
      write: [["2026-11-06T01:30:00.999Z", 1793928600]],
    },
    {
      encoding: { kind: "compactDateTime", wire: "string" },
      read: [["20261106103000", "2026-11-06T10:30:00"]],
      fail: [
        ["20261306103000", "mismatch"],
        ["20261106253000", "mismatch"],
        ["2026110610", "mismatch"],
      ],
      write: [
        ["2026-11-06T10:30:00", "20261106103000"],
        ["2026-11-06", "20261106000000"],
      ],
    },
    {
      encoding: { kind: "compactDate", wire: "string" },
      read: [["20240229", "2024-02-29"]],
      fail: [["20230229", "mismatch"]],
      // (날짜 표현에 시각이 있는 값을 되돌리면 시각을 버린다.)
      write: [["2026-11-06T10:30:00", "20261106"]],
    },
    {
      encoding: { kind: "dateParts", precision: "dateTime" },
      read: [[[2026, 11, 6, 10, 30, 15, 500000000], "2026-11-06T10:30:15.5"]],
      fail: [
        [[2026, 11, 6], "mismatch"],
        [[2026, 2, 30, 0, 0], "mismatch"],
        ["2026-11-06x", "mismatch"],
      ],
      write: [
        ["2026-11-06T10:30:15.5", [2026, 11, 6, 10, 30, 15, 500000000]],
        ["2026-11-06T10:30:00", [2026, 11, 6, 10, 30]],
      ],
    },
    {
      encoding: { kind: "dateParts", precision: "date" },
      read: [[[2026, 11, 6], "2026-11-06"]],
      fail: [[[2026, 11, 6, 10, 30], "mismatch"]],
      write: [["2026-11-06", [2026, 11, 6]]],
    },
    {
      encoding: { kind: "bigInt" },
      read: [
        ["9007199254740993", "9007199254740993"],
        [1001, "1001"],
      ],
      // (이미 근삿값이 된 수 — 큰 정수 보존 파싱을 지나지 않은 값.)
      fail: [
        [9007199254740992, "precision"],
        ["12a", "mismatch"],
      ],
      write: [["1001", rawJsonNumber("1001")]],
    },
  ];
  for (const { encoding, read, fail, write } of cases) {
    it(`${encoding.kind} ${JSON.stringify(encoding)}`, () => {
      for (const [raw, value] of read)
        expect(readEncoded(encoding, raw), JSON.stringify(raw)).toEqual({
          ok: true,
          value,
        });
      for (const [raw, reason] of fail)
        expect(readEncoded(encoding, raw), JSON.stringify(raw)).toEqual({
          ok: false,
          reason,
        });
      for (const [stored, out] of write) {
        const value = writeEncoded(encoding, stored);
        if (isRawJsonNumber(out))
          expect(isRawJsonNumber(value) && value.rawJson).toBe(out.rawJson);
        else expect(value, JSON.stringify(stored)).toEqual(out);
      }
    });
  }

  it("쿼리 글자 — 되돌린 표현의 글자", () => {
    expect(
      writeEncodedText({ kind: "flag", true: "Y", false: "N" }, true),
    ).toBe("Y");
    expect(writeEncodedText({ kind: "bigInt" }, "9007199254740993")).toBe(
      "9007199254740993",
    );
    expect(
      writeEncodedText(
        { kind: "epochMs", wire: "number" },
        "2026-11-06T01:30:00Z",
      ),
    ).toBe("1793928600000");
  });
});

describe("ADR-313 G1 — 원본 종류 × 선언 유무 (breakdown §2.3 셀 규칙)", () => {
  const flagField: IntakeField = {
    key: "f",
    type: "boolean",
    encoding: { kind: "flag", true: "Y", false: "N" },
  };
  const plainBool: IntakeField = { key: "f", type: "boolean" };

  it("JSON · 선언 있음 — 선언대로, 못 읽으면 null + 셈", () => {
    const { rows, report } = normalizeRows(
      [{ f: "Y" }, { f: "N" }, { f: "x" }, { f: true }],
      [flagField],
      "json",
    );
    expect(rows.map((row) => row.f)).toEqual([true, false, null, true]);
    expect(report.unread).toEqual({ f: 1 });
  });

  it("JSON · 선언 없음 — 그대로 두고 타입과 다른 셀을 센다 (HC5)", () => {
    const input = [{ f: "Y" }, { f: true }, { f: 42 }];
    const { rows, report } = normalizeRows(input, [plainBool], "json");
    expect(rows).toBe(input);
    expect(report.typeMismatch).toEqual({ f: 2 });
    expect(report.changedCells).toBe(0);
  });

  it("글자 · 선언 있음 — 선언의 표기, 아니면 열 타입의 글자 읽기", () => {
    const { rows, report } = normalizeRows(
      [{ f: "Y" }, { f: "N" }, { f: "true" }, { f: "maybe" }, { f: "" }],
      [flagField],
      "text",
    );
    expect(rows.map((row) => row.f)).toEqual([true, false, true, null, null]);
    expect(report.unread).toEqual({ f: 1 });
  });

  it("글자 · 선언 없음 — 열 타입의 글자 읽기 (지금의 가져오기와 같다)", () => {
    const fieldsText: IntakeField[] = [
      { key: "n", type: "number" },
      { key: "s", type: "string" },
      { key: "z", type: "string" },
    ];
    const { rows, report } = normalizeRows(
      [
        { n: "42", s: "abc", z: "01234" },
        { n: "abc", s: "42", z: "06236" },
        { n: "9007199254740993", s: "", z: "1" },
      ],
      fieldsText,
      "text",
    );
    expect(rows).toEqual([
      { n: 42, s: "abc", z: "01234" },
      { n: null, s: "42", z: "06236" },
      { n: null, s: null, z: "1" },
    ]);
    expect(report.unread).toEqual({ n: 1 });
    expect(report.precision).toEqual({ n: 1 });
  });

  it("글자 셀 읽기 — 큰 정수 숫자 글자는 number 열에서 읽기 실패 (값을 잃지 않는다)", () => {
    expect(readTextCell("number", "9007199254740993")).toEqual({
      ok: false,
      reason: "precision",
    });
    expect(readTextCell("number", "-1.5e3")).toEqual({
      ok: true,
      value: -1500,
    });
    expect(readTextCell("boolean", "Yes")).toEqual({ ok: true, value: true });
    expect(readTextCell("object", "[1]")).toEqual({ ok: true, value: [1] });
    expect(readTextCell("date", "2026-11-06")).toEqual({
      ok: true,
      value: "2026-11-06",
    });
    expect(readTextCell("date", "Nov 6")).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(readTextCell("date", "Nov 6", () => "2026-11-06")).toEqual({
      ok: true,
      value: "2026-11-06",
    });
  });

  it("계산 필드 · 스키마 밖 키는 건드리지 않는다", () => {
    const input = [{ a: "Y", extra: "Y" }];
    const { rows } = normalizeRows(
      input,
      [
        {
          key: "a",
          type: "boolean",
          formula: "1",
          encoding: { kind: "flag", true: "Y", false: "N" },
        },
      ],
      "json",
    );
    expect(rows).toBe(input);
  });
});

describe("ADR-313 G1 — HC6 변환 불필요 입력은 새 행 객체 0", () => {
  it("선언 없는 JSON — 받은 배열 · 행 객체 그대로", () => {
    const input = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `n${i}`,
      ok: i % 2 === 0,
    }));
    const { rows } = normalizeRows(
      input,
      [
        { key: "id", type: "number" },
        { key: "name", type: "string" },
        { key: "ok", type: "boolean" },
      ],
      "json",
    );
    expect(rows).toBe(input);
  });

  it("일부 행만 바뀌면 바뀐 행만 새 객체", () => {
    const input = [{ f: true }, { f: "Y" }, { f: false }];
    const { rows } = normalizeRows(
      input,
      [
        {
          key: "f",
          type: "boolean",
          encoding: { kind: "flag", true: "Y", false: "N" },
        },
      ],
      "json",
    );
    expect(rows).not.toBe(input);
    expect(rows[0]).toBe(input[0]);
    expect(rows[1]).not.toBe(input[1]);
    expect(rows[2]).toBe(input[2]);
  });

  it("key 필드 — 빈 key · 겹치는 key 를 센다 (행은 버리지 않는다)", () => {
    const input = [
      { id: "1" },
      { id: "1" },
      { id: "" },
      { id: null },
      { id: "2" },
    ];
    const { rows, report } = normalizeRows(
      input,
      [{ id: "f-id", key: "id", type: "string" }],
      "json",
      { keyField: "f-id" },
    );
    expect(rows).toHaveLength(5);
    expect(report.keyEmpty).toBe(2);
    expect(report.keyDuplicate).toBe(1);
  });
});

describe("ADR-313 G1 · R3 — 큰 정수 보존 파싱", () => {
  const parsers = [
    ["scan", parseJsonLossless],
    ["source", parseJsonLosslessWithSource],
  ] as const;

  it("큰 정수가 없는 JSON 은 JSON.parse 와 같다 (차등)", () => {
    const samples = [
      SPRING_PAGE_RESPONSE_TEXT.replace(
        /9007199254740993|9007199254740995/g,
        "1",
      ),
      '{"a": [1, -2, 3.5, -4e10, 1e21, 0.1], "b": {"c": "1234567890123456789", "d": null, "e": true}}',
      "[1234567890123456, -1234567890123456, 123456789012345.67]",
      '"x"',
      "[]",
    ];
    for (const text of samples)
      for (const [, parse] of parsers)
        expect(parse(text)).toEqual(JSON.parse(text));
  });

  it("경계 · 음수 · 지수 · 소수 · 글자 안 · 깊은 중첩", () => {
    const text =
      '{"max": 9007199254740991, "over": 9007199254740992, "big": 9007199254740993, "neg": -9007199254740993, ' +
      '"exp": 9007199254740993e0, "frac": 9007199254740993.5, "str": "9007199254740993", "esc": "a\\"9007199254740993\\"", ' +
      '"deep": [[[{"id": 12345678901234567890}]]]}';
    const expected = {
      max: 9007199254740991,
      over: "9007199254740992",
      big: "9007199254740993",
      neg: "-9007199254740993",
      exp: 9007199254740992,
      frac: 9007199254740994,
      str: "9007199254740993",
      esc: 'a"9007199254740993"',
      deep: [[[{ id: "12345678901234567890" }]]],
    };
    for (const [name, parse] of parsers)
      expect(parse(text), name).toEqual(expected);
  });

  it("형식 오류는 JSON.parse 처럼 던진다", () => {
    for (const [, parse] of parsers)
      expect(() => parse("[12345678901234567890,")).toThrow();
  });

  it("큰 정수 보존 쓰기 — rawJSON 이 있든 없든 같은 글자", () => {
    const body = {
      id: rawJsonNumber("9007199254740993"),
      list: [rawJsonNumber("-1"), "x"],
      n: 1,
    };
    const expected = '{"id":9007199254740993,"list":[-1,"x"],"n":1}';
    expect(stringifyJsonLossless(body)).toBe(expected);
    expect(stringifyJsonLossless(body, undefined)).toBe(expected);
    expect(stringifyJsonLossless({ a: 1 }, undefined)).toBe('{"a":1}');
  });
});

describe("ADR-313 G1 — 문서 검증의 값 표현 판정", () => {
  it("모르는 종류 · 인자 · 타입과 맞지 않는 종류를 거절한다", () => {
    expect(
      encodingProblem({ kind: "flag", true: "Y", false: "N" }, "boolean"),
    ).toBeUndefined();
    expect(encodingProblem({ kind: "bigInt" }, "string")).toBeUndefined();
    expect(encodingProblem({ kind: "bigInt" }, undefined)).toBeUndefined();
    expect(
      encodingProblem({ kind: "epochMs", wire: "number" }, "date"),
    ).toBeUndefined();
    expect(encodingProblem({ kind: "yyyyMMdd" }, "date")).toBe(
      "INVALID_FIELD_ENCODING",
    );
    expect(
      encodingProblem(
        { kind: "compactDate", wire: "number", format: "yyyy" },
        "date",
      ),
    ).toBe("INVALID_FIELD_ENCODING");
    expect(encodingProblem({ kind: "compactDate" }, "date")).toBe(
      "INVALID_FIELD_ENCODING",
    );
    expect(encodingProblem({ kind: "compactDate", wire: "text" }, "date")).toBe(
      "INVALID_FIELD_ENCODING",
    );
    expect(
      encodingProblem({ kind: "flag", true: "Y", false: "Y" }, "boolean"),
    ).toBe("INVALID_FIELD_ENCODING");
    expect(
      encodingProblem({ kind: "flag", true: {}, false: "N" }, "boolean"),
    ).toBe("INVALID_FIELD_ENCODING");
    expect(
      encodingProblem({ kind: "dateParts", precision: "time" }, "date"),
    ).toBe("INVALID_FIELD_ENCODING");
    expect(
      encodingProblem({ kind: "flag", true: "Y", false: "N" }, "number"),
    ).toBe("FIELD_ENCODING_TYPE_MISMATCH");
    expect(encodingProblem("flag", "boolean")).toBe("INVALID_FIELD_ENCODING");
  });
});
