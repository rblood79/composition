/**
 * documentPersistGuard 단위 테스트 (2026-07-14 요소 소실 사건 대응)
 *
 * 계약:
 * - 급감 가드: prev ≥ GUARD_MIN_PREV_NODES && next < prev * GUARD_SHRINK_RATIO
 *   → 차단. allowShrink 는 명시 통과.
 * - 백업 시간 버킷: 최신 백업이 BACKUP_MIN_INTERVAL_MS 이내면 skip.
 */

import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  BACKUP_MIN_INTERVAL_MS,
  GUARD_MIN_PREV_NODES,
  GUARD_SHRINK_RATIO,
  countCanonicalDocumentNodes,
  evaluateDocumentPersist,
  shouldWriteBackup,
} from "../documentPersistGuard";

function docWithChildren(children: unknown[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children,
  } as unknown as CompositionDocument;
}

describe("countCanonicalDocumentNodes", () => {
  it("빈 문서는 0", () => {
    expect(countCanonicalDocumentNodes(docWithChildren([]))).toBe(0);
  });

  it("중첩 children 재귀 계수", () => {
    const doc = docWithChildren([
      {
        id: "page",
        children: [
          { id: "body", children: [{ id: "a" }, { id: "b", children: [] }] },
        ],
      },
      { id: "page2" },
    ]);
    expect(countCanonicalDocumentNodes(doc)).toBe(5);
  });
});

describe("evaluateDocumentPersist — 급감 가드", () => {
  it("소형 문서 (prev < 임계) 는 전량 삭제도 허용", () => {
    const decision = evaluateDocumentPersist(GUARD_MIN_PREV_NODES - 1, 0);
    expect(decision.allowed).toBe(true);
  });

  it("대형 문서의 급감 write 는 차단 + 사유 포함", () => {
    const decision = evaluateDocumentPersist(177, 28);
    expect(decision.allowed).toBe(false);
    expect(decision.blockReason).toContain("177 → 28");
  });

  it("allowShrink 명시 시 급감도 통과 (요소/페이지 삭제 흐름)", () => {
    const decision = evaluateDocumentPersist(177, 28, { allowShrink: true });
    expect(decision.allowed).toBe(true);
  });

  it("임계 비율 이상 유지되면 허용", () => {
    const prev = 100;
    const next = Math.ceil(prev * GUARD_SHRINK_RATIO);
    expect(evaluateDocumentPersist(prev, next).allowed).toBe(true);
  });

  it("경계값: 정확히 비율 지점은 허용, 그 아래는 차단", () => {
    const prev = GUARD_MIN_PREV_NODES;
    const boundary = prev * GUARD_SHRINK_RATIO;
    expect(evaluateDocumentPersist(prev, boundary).allowed).toBe(true);
    expect(evaluateDocumentPersist(prev, boundary - 1).allowed).toBe(false);
  });

  it("증가 write 는 항상 허용", () => {
    expect(evaluateDocumentPersist(50, 120).allowed).toBe(true);
  });
});

describe("shouldWriteBackup — 시간 버킷", () => {
  const now = Date.parse("2026-07-14T12:00:00.000Z");

  it("백업 이력이 없으면 기록", () => {
    expect(shouldWriteBackup(undefined, now)).toBe(true);
  });

  it("최소 간격 이내면 skip", () => {
    const recent = new Date(now - BACKUP_MIN_INTERVAL_MS + 1000).toISOString();
    expect(shouldWriteBackup(recent, now)).toBe(false);
  });

  it("최소 간격 경과 시 기록", () => {
    const old = new Date(now - BACKUP_MIN_INTERVAL_MS - 1000).toISOString();
    expect(shouldWriteBackup(old, now)).toBe(true);
  });

  it("파싱 불가 timestamp 는 기록 (fail-open)", () => {
    expect(shouldWriteBackup("not-a-date", now)).toBe(true);
  });
});
