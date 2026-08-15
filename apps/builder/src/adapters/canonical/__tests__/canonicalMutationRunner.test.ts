/**
 * @fileoverview ADR-184 Phase 1 — canonical mutation 러너 순서/타입 단언.
 *
 * 러너가 4단 순서 (canonical → store set → rebuildIndexes → history →
 * persist 백그라운드) 를 소유하는지 spy 호출 순서로 검증하고, canonical
 * 스테이지 누락 (set-1차 위반 형태) 이 타입 에러인지 확인한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import type { CanonicalMutationResult } from "../canonicalMutations";
import {
  isCanonicalMutationRunnerBridgeRegistered,
  registerCanonicalMutationRunnerBridge,
  resetCanonicalMutationRunnerBridge,
  runCanonicalMutation,
} from "../canonicalMutationRunner";

const putSpy = vi.fn().mockResolvedValue(undefined);
const getDBMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getDB: (...args: unknown[]) => getDBMock(...args),
}));

const PROJECT_ID = "project-runner-test";

function makeDocument(): CompositionDocument {
  return { version: "composition-1.0", children: [] } as CompositionDocument;
}

function makeResult(): CanonicalMutationResult {
  return { changed: true, document: makeDocument() };
}

async function flushPersist(): Promise<void> {
  // persist 는 fire-and-forget (getDB await + put await) — microtask 2틱 flush
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("runCanonicalMutation — 스테이지 순서 (ADR-184)", () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    // persist 마커는 실제 DB write(put) 시점 — getDB 호출 자체는 러너의 동기
    // 구간 안에서 일어난다 (async 함수의 첫 await 전 세그먼트)
    putSpy.mockClear().mockImplementation(async () => {
      calls.push("persist");
    });
    getDBMock
      .mockClear()
      .mockResolvedValue({ documents: { put: putSpy } } as never);
    registerCanonicalMutationRunnerBridge({
      rebuildIndexes: () => calls.push("rebuild"),
    });
    const canonical = useCanonicalDocumentStore.getState();
    canonical.setDocument(PROJECT_ID, makeDocument());
    canonical.setCurrentProject(PROJECT_ID);
  });

  afterEach(() => {
    resetCanonicalMutationRunnerBridge();
    useCanonicalDocumentStore.getState().setCurrentProject(null);
  });

  it("canonical → store → rebuild → history → persist 고정 순서로 실행한다", async () => {
    const result = runCanonicalMutation({
      canonical: () => {
        calls.push("canonical");
        return makeResult();
      },
      store: () => calls.push("store"),
      history: () => calls.push("history"),
    });

    // 동기 구간은 반환 시점에 완료 — persist 는 그 뒤 백그라운드
    expect(calls).toEqual(["canonical", "store", "rebuild", "history"]);
    expect(result.changed).toBe(true);

    await flushPersist();
    expect(calls).toEqual([
      "canonical",
      "store",
      "rebuild",
      "history",
      "persist",
    ]);
    expect(putSpy).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ version: "composition-1.0" }),
      undefined,
    );
  });

  it("store 는 optional, history 는 { skip: 사유 } 명시 — canonical-only mutation 도 rebuild + persist 는 러너가 수행한다 (ADR-185)", async () => {
    runCanonicalMutation({
      canonical: () => {
        calls.push("canonical");
        return makeResult();
      },
      history: { skip: "runner-test — canonical-only silent 형태" },
    });

    // skip 은 no-op — history 마커 없이 나머지 순서 불변
    expect(calls).toEqual(["canonical", "rebuild"]);
    await flushPersist();
    expect(putSpy).toHaveBeenCalledTimes(1);
  });

  it("history: { skip: '' } (빈 사유) 는 스테이지 실행 전에 throw 한다 (ADR-185)", () => {
    const canonicalSpy = vi.fn(() => makeResult());
    expect(() =>
      runCanonicalMutation({
        canonical: canonicalSpy,
        history: { skip: "   " },
      }),
    ).toThrow(/history\.skip 사유/);
    // fail-fast — 부분 mutation 없이 진입 시점 거부
    expect(canonicalSpy).not.toHaveBeenCalled();
  });

  it("history 스테이지는 required — 생략 (조용한 미기록 형태) 은 타입 에러 (ADR-185)", () => {
    const typeOnly = () => {
      // @ts-expect-error — ADR-185: history 기록/생략 의사결정 없이 mutation 을 쓰는 형태는 시그니처상 표현 불가
      runCanonicalMutation({ canonical: () => makeResult() });
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("store / history 스테이지는 canonical 결과를 전달받는다", () => {
    const seen: CanonicalMutationResult[] = [];
    const result = makeResult();
    runCanonicalMutation({
      canonical: () => result,
      store: (r) => {
        seen.push(r);
      },
      history: (r) => {
        seen.push(r);
      },
    });
    expect(seen).toEqual([result, result]);
  });

  it("persistOptions (급감 가드 사유) 를 documents.put 에 전달한다", async () => {
    runCanonicalMutation({
      canonical: () => makeResult(),
      history: { skip: "runner-test" },
      persistOptions: { allowShrink: true, reason: "runner-test-removal" },
    });
    await flushPersist();
    expect(putSpy).toHaveBeenCalledWith(PROJECT_ID, expect.anything(), {
      allowShrink: true,
      reason: "runner-test-removal",
    });
  });

  it("persist 실패는 throw 하지 않고 경고 로깅한다 (fire-and-forget 관례)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getDBMock.mockRejectedValueOnce(new Error("db unavailable"));

    expect(() =>
      runCanonicalMutation({
        canonical: () => makeResult(),
        history: { skip: "runner-test" },
      }),
    ).not.toThrow();

    await flushPersist();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("canonicalMutationRunner"),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("bridge 미등록이면 스테이지 실행 전에 throw 한다", () => {
    resetCanonicalMutationRunnerBridge();
    expect(isCanonicalMutationRunnerBridgeRegistered()).toBe(false);
    const canonicalSpy = vi.fn(() => makeResult());
    expect(() =>
      runCanonicalMutation({
        canonical: canonicalSpy,
        history: { skip: "runner-test" },
      }),
    ).toThrow(/bridge not registered/);
    expect(canonicalSpy).not.toHaveBeenCalled();
  });

  it("canonical 스테이지는 required — store 단독 전달 (set-1차 형태) 은 타입 에러", () => {
    const typeOnly = () => {
      // @ts-expect-error — ADR-184: canonical 없이 store 만 갱신하는 순서 위반은 시그니처상 표현 불가
      runCanonicalMutation({ store: () => {} });
    };
    expect(typeOnly).toBeTypeOf("function");
  });

  it("동기 스테이지의 throw 는 전파된다 (러너가 복구를 발명하지 않는다 — R3)", () => {
    expect(() =>
      runCanonicalMutation({
        canonical: () => {
          throw new Error("canonical failed");
        },
        history: { skip: "runner-test" },
      }),
    ).toThrow("canonical failed");

    expect(() =>
      runCanonicalMutation({
        canonical: () => makeResult(),
        store: () => {
          throw new Error("store failed");
        },
        history: { skip: "runner-test" },
      }),
    ).toThrow("store failed");
  });
});
