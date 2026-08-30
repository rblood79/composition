/**
 * ADR-134 Phase 6 — 계획·판정 파싱.
 *
 * 모델은 JSON 만 내라고 해도 코드 펜스와 인사말을 붙인다. 파싱이 거기서 깨지면 오케스트레이션
 * 전체가 "계획 없음" 으로 떨어지므로, 실제로 오는 모양들을 넣어 본다.
 */
import { describe, expect, it } from "vitest";
import { parsePlan } from "./PlannerAgent";
import { parseVerdict } from "./VerifierAgent";

describe("parsePlan", () => {
  it("맨 JSON 을 읽는다", () => {
    const plan = parsePlan('{"goal":"G","steps":[{"instruction":"A"}]}');
    expect(plan?.goal).toBe("G");
    expect(plan?.steps).toEqual([{ index: 1, instruction: "A" }]);
  });

  it("코드 펜스와 앞뒤 산문을 견딘다", () => {
    const plan = parsePlan(
      '네, 계획입니다.\n```json\n{"goal":"G","steps":[{"instruction":"A","done":"D"}]}\n```\n이대로 진행할까요?',
    );
    expect(plan?.steps[0]).toEqual({ index: 1, instruction: "A", done: "D" });
  });

  it("index 를 모델 값이 아니라 순서로 다시 매긴다", () => {
    const plan = parsePlan(
      '{"steps":[{"index":7,"instruction":"A"},{"index":7,"instruction":"B"}]}',
    );
    expect(plan?.steps.map((s) => s.index)).toEqual([1, 2]);
  });

  it("빈 instruction 은 버린다", () => {
    const plan = parsePlan(
      '{"steps":[{"instruction":"  "},{"instruction":"진짜"}]}',
    );
    expect(plan?.steps).toHaveLength(1);
    expect(plan?.steps[0]?.instruction).toBe("진짜");
  });

  it("6단계를 넘으면 자른다", () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      instruction: `S${i}`,
    }));
    expect(parsePlan(JSON.stringify({ steps }))?.steps).toHaveLength(6);
  });

  it.each([
    ["JSON 아님", "죄송해요, 잘 모르겠습니다"],
    ["빈 문자열", ""],
    ["steps 없음", '{"goal":"G"}'],
    ["steps 가 배열 아님", '{"steps":"A"}'],
    ["유효 단계 0", '{"steps":[{"instruction":""}]}'],
    ["깨진 JSON", '{"steps":[{"instruction":"A"'],
  ])("%s 이면 null", (_label, raw) => {
    expect(parsePlan(raw)).toBeNull();
  });
});

describe("parseVerdict", () => {
  it("ok:false 와 지적 사항을 읽는다", () => {
    expect(parseVerdict('{"ok":false,"issues":["A","B"]}')).toEqual({
      ok: false,
      issues: ["A", "B"],
    });
  });

  it("코드 펜스를 견딘다", () => {
    expect(parseVerdict('```json\n{"ok":false,"issues":["X"]}\n```')).toEqual({
      ok: false,
      issues: ["X"],
    });
  });

  it.each([
    ["ok:true", '{"ok":true}'],
    ["판정 불명", "잘 모르겠습니다"],
    ["깨진 JSON", '{"ok":false'],
    ["ok 필드 없음", '{"issues":["X"]}'],
  ])("%s 이면 통과로 본다 (불필요한 재시도가 더 위험하다)", (_l, raw) => {
    expect(parseVerdict(raw)).toEqual({ ok: true, issues: [] });
  });

  it("ok:false 인데 issues 가 없으면 빈 목록", () => {
    expect(parseVerdict('{"ok":false}')).toEqual({ ok: false, issues: [] });
  });
});
