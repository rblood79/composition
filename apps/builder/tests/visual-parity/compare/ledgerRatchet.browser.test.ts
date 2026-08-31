/**
 * ADR-198 Phase 4a — 예외 ledger ratchet
 *
 * 예외는 게이트를 무르게 만드는 유일한 합법 경로다. 그래서 **예외를 무르게 쓰는
 * 방법마다 하나씩 막는다** (R5). 각 규칙은 그 규칙을 어기는 항목을 실제로 넣어
 * 거부되는지 확인한다 — 규칙이 있다는 것과 규칙이 무언가를 막는다는 것은 다르다.
 *
 * 실패 코드 집합이 닫혀 있는지도 여기서 본다. 새 코드가 조용히 생기면 ledger 가
 * 그걸 인정해 버리고, `/fix` 라우팅의 키도 깨진다 (§3.7).
 */

import { describe, expect, it } from "vitest";
import {
  APPROVED_EXCEPTIONS,
  validateExceptionLedger,
  type LedgerContext,
  type ParityException,
} from "../harness/ledger";
import { PARITY_CODES } from "../harness/types";

const CTX: LedgerContext = {
  today: "2026-08-31",
  frame: { width: 320, height: 220 },
  approvedBudgets: {
    "clip-fill": { maxDiffRatio: 0.001, maxByte: 2 },
  },
};

/** 규칙 위반이 하나도 없는 정상 항목 — 각 테스트는 여기서 한 축만 망가뜨린다. */
function validEntry(over: Partial<ParityException> = {}): ParityException {
  return {
    caseId: "catalog-state-paint",
    regionId: "clip-fill",
    owner: "rblood79",
    reason: "SW↔GL AA 밴드가 이 radius 에서만 갈린다 — Phase 6 에서 재측정",
    reviewBy: "2026-12-31",
    code: "PARITY-L3-PIXEL",
    maxDiffRatio: 0.001,
    maxByte: 2,
    ...over,
  };
}

function rulesFor(entry: ParityException): string[] {
  return validateExceptionLedger([entry], CTX).map((v) => v.rule);
}

describe("ADR-198 Phase 4a — 예외 ledger ratchet", () => {
  it("정상 항목은 통과한다 (ratchet 이 무엇이든 거부하는 게 아니다)", () => {
    expect(validateExceptionLedger([validEntry()], CTX)).toEqual([]);
  });

  it("주인 없는 예외는 거부한다 (빈 값과 TBD 둘 다)", () => {
    expect(rulesFor(validEntry({ owner: "" }))).toContain("missing-owner");
    expect(rulesFor(validEntry({ owner: "TBD" }))).toContain("missing-owner");
  });

  it("사유 없는 예외는 거부한다", () => {
    expect(rulesFor(validEntry({ reason: "" }))).toContain("missing-reason");
    expect(rulesFor(validEntry({ reason: "나중에" }))).toContain(
      "missing-reason",
    );
  });

  it("재검토 기한이 없거나 형식이 아니면 거부한다", () => {
    expect(rulesFor(validEntry({ reviewBy: "" }))).toContain(
      "missing-review-date",
    );
    expect(rulesFor(validEntry({ reviewBy: "언젠가" }))).toContain(
      "missing-review-date",
    );
  });

  it("기한이 지난 예외는 거부한다", () => {
    expect(rulesFor(validEntry({ reviewBy: "2026-08-30" }))).toContain(
      "stale-exception",
    );
    // 오늘까지는 유효하다 — 경계에서 하루 일찍 죽지 않는다
    expect(rulesFor(validEntry({ reviewBy: "2026-08-31" }))).not.toContain(
      "stale-exception",
    );
  });

  it("프레임을 통째로 덮는 mask 는 거부한다", () => {
    // 빈 배열은 "무엇이든" 으로 읽힌다
    expect(rulesFor(validEntry({ mask: [] }))).toContain("wildcard-mask");
    // 프레임 전체
    expect(
      rulesFor(
        validEntry({ mask: [{ x: 0, y: 0, width: 320, height: 220 }] }),
      ),
    ).toContain("wildcard-mask");
    // 좁은 사각형은 정상 예외다
    expect(
      rulesFor(validEntry({ mask: [{ x: 10, y: 10, width: 20, height: 12 }] })),
    ).toEqual([]);
  });

  it("승인 예산보다 느슨한 예외는 예산 인상으로 거부한다", () => {
    expect(rulesFor(validEntry({ maxDiffRatio: 0.01 }))).toContain(
      "budget-increase",
    );
    expect(rulesFor(validEntry({ maxByte: 64 }))).toContain("budget-increase");
    // 더 엄격하게 조이는 것은 언제나 허용
    expect(
      rulesFor(validEntry({ maxDiffRatio: 0.0005, maxByte: 1 })),
    ).toEqual([]);
  });

  it("닫힌 집합 밖의 실패 코드는 거부한다", () => {
    expect(
      rulesFor(
        validEntry({ code: "PARITY-L9-MADEUP" as ParityException["code"] }),
      ),
    ).toContain("unknown-failure-code");
  });

  it("실제 ledger 는 지금 비어 있고, 그 자체로 유효하다", () => {
    expect(APPROVED_EXCEPTIONS).toEqual([]);
    expect(validateExceptionLedger(APPROVED_EXCEPTIONS, CTX)).toEqual([]);
  });

  it("하니스가 내는 실패 코드가 전부 닫힌 집합 안에 있다", () => {
    const sources = import.meta.glob("../**/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(5);

    const used = new Set<string>();
    for (const [path, src] of Object.entries(sources)) {
      if (path.endsWith("/harness/types.ts")) continue; // 집합 정의 자신
      for (const m of src.matchAll(/"(PARITY-[A-Z0-9-]+)"/g)) used.add(m[1]);
    }
    // 위 테스트가 일부러 넣은 가짜 코드는 제외한다
    used.delete("PARITY-L9-MADEUP");

    const unknown = [...used].filter(
      (c) => !(PARITY_CODES as readonly string[]).includes(c),
    );
    expect(unknown, `닫힌 집합 밖 코드: ${unknown.join(", ")}`).toEqual([]);
    // 집합이 실제로 쓰이고 있다 — 검사가 vacuous 하지 않다
    expect(used.size).toBeGreaterThan(4);
  });
});
