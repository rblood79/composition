/**
 * ADR-213 Phase 5 — 붙여넣은 텍스트 → 행 배열 (규칙 파서, 모델 0).
 *
 * JSON 배열 · JSON 객체 (관례 키 `results`/`data`/… 안의 배열 — Track 0 `resolveResponseData`)
 * · 구분자 표 (탭 우선, 없으면 쉼표 · 첫 줄이 헤더). 실패는 `reason` 코드 — 문구는 호출자.
 */
import { describe, expect, it } from "vitest";
import { parsePastedRows } from "./pasteRows";

describe("parsePastedRows", () => {
  it("JSON 배열은 그대로 행", () => {
    expect(parsePastedRows('[{"a":1},{"a":2}]')).toEqual({
      ok: true,
      format: "json",
      rows: [{ a: 1 }, { a: 2 }],
    });
  });

  it("JSON 객체는 관례 키 안의 배열을 찾는다 (results · data · items …)", () => {
    expect(parsePastedRows('{"page":1,"results":[{"id":"x"}]}')).toEqual({
      ok: true,
      format: "json",
      rows: [{ id: "x" }],
    });
  });

  it("탭 구분 표: 첫 줄 헤더 · 숫자/불리언은 형변환 · 빈 칸은 null", () => {
    const text = "name\tage\tactive\nAna\t30\ttrue\nBo\t\tfalse\n";
    expect(parsePastedRows(text)).toEqual({
      ok: true,
      format: "table",
      rows: [
        { name: "Ana", age: 30, active: true },
        { name: "Bo", age: null, active: false },
      ],
    });
  });

  it("쉼표 구분 표 (탭이 없을 때) — 따옴표 안의 쉼표는 값의 일부", () => {
    const text = 'title,note\n"a, b",1\nc,2';
    expect(parsePastedRows(text)).toEqual({
      ok: true,
      format: "table",
      rows: [
        { title: "a, b", note: 1 },
        { title: "c", note: 2 },
      ],
    });
  });

  it("행 원소가 객체가 아니거나 (스칼라 배열) 행 0 이면 거부", () => {
    expect(parsePastedRows("[1,2,3]")).toEqual({
      ok: false,
      reason: "rows-not-objects",
    });
    expect(parsePastedRows("[]")).toEqual({ ok: false, reason: "no-rows" });
    expect(parsePastedRows("name\tage\n")).toEqual({
      ok: false,
      reason: "no-rows",
    });
    expect(parsePastedRows("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("헤더 1열 · 구분자 없는 한 줄 텍스트는 표가 아니다", () => {
    expect(parsePastedRows("hello world")).toEqual({
      ok: false,
      reason: "not-tabular",
    });
  });
});
