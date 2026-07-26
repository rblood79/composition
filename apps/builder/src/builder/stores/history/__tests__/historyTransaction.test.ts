/**
 * History 트랜잭션 — 여러 mutation 을 되돌리기 1단위로 병합 (ADR-168 후속).
 *
 * 프리셋 적용은 슬롯 제거 + 슬롯 삽입 + body props + body responsive 네 갈래
 * mutation 이지만 사용자에겐 한 번의 조작이다. 트랜잭션 없이는 undo 4회가 필요했다.
 *
 * 병합이 성립하는 근거는 `applyCanonicalHistoryEventsToDocument` 가 undo 방향에서
 * event 를 역순 + 역연산으로 처리하는 것 — 시간순으로 이어 붙인 배열이 그대로 하나의
 * 되돌리기 단위가 된다. 그래서 여기서 확인하는 것은 **event 순서 보존**이다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryManager } from "../../history";
import type { CanonicalHistoryNodeEvent } from "../canonicalHistoryEvents";

function updateEvent(nodeId: string): CanonicalHistoryNodeEvent {
  return {
    type: "update",
    nodeId,
    prevProps: { v: 0 },
    nextProps: { v: 1 },
  } as CanonicalHistoryNodeEvent;
}

function makeManager(): HistoryManager {
  const manager = new HistoryManager();
  manager.setCurrentPage("page-1");
  return manager;
}

describe("HistoryManager 트랜잭션", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("트랜잭션 중 addEntry 를 엔트리 1개로 병합하고 event 순서를 보존한다", () => {
    const manager = makeManager();

    manager.beginTransaction({ type: "batch", elementId: "body-1" });
    manager.addEntry({
      type: "remove",
      elementId: "slot-old",
      data: { canonicalEvents: [updateEvent("slot-old")] },
    });
    manager.addEntry({
      type: "update",
      elementId: "body-1",
      data: { canonicalEvents: [updateEvent("body-props")] },
    });
    manager.addEntry({
      type: "update",
      elementId: "body-1",
      data: { canonicalEvents: [updateEvent("body-responsive")] },
    });

    // 커밋 전에는 엔트리가 없다
    expect(manager.getCurrentPageEntries()).toHaveLength(0);
    expect(manager.hasOpenTransaction()).toBe(true);

    manager.commitTransaction();

    const entries = manager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("batch");
    expect(entries[0].elementId).toBe("body-1");
    // 시간순 그대로 — undo 는 이 배열을 역순으로 되돌린다
    expect(
      entries[0].data.canonicalEvents?.map((e) =>
        e.type === "update" ? e.nodeId : e.type,
      ),
    ).toEqual(["slot-old", "body-props", "body-responsive"]);
    expect(manager.hasOpenTransaction()).toBe(false);
  });

  it("중첩 트랜잭션은 최외곽 커밋에서만 엔트리를 만든다", () => {
    const manager = makeManager();

    manager.beginTransaction({ type: "batch", elementId: "outer" });
    manager.addEntry({
      type: "update",
      elementId: "a",
      data: { canonicalEvents: [updateEvent("a")] },
    });

    manager.beginTransaction({ type: "update", elementId: "inner" });
    manager.addEntry({
      type: "update",
      elementId: "b",
      data: { canonicalEvents: [updateEvent("b")] },
    });
    manager.commitTransaction(); // 내부 — 확정 안 됨

    expect(manager.getCurrentPageEntries()).toHaveLength(0);
    expect(manager.hasOpenTransaction()).toBe(true);

    manager.commitTransaction(); // 최외곽

    const entries = manager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    // meta 는 최외곽 begin 것을 쓴다
    expect(entries[0].elementId).toBe("outer");
    expect(entries[0].data.canonicalEvents).toHaveLength(2);
  });

  it("event 가 하나도 모이지 않으면 엔트리를 만들지 않는다", () => {
    const manager = makeManager();

    manager.beginTransaction({ type: "batch", elementId: "body-1" });
    manager.commitTransaction();

    expect(manager.getCurrentPageEntries()).toHaveLength(0);
  });

  it("canonicalEvents 없는 entry 는 병합 불가로 경고한다 (조용히 삼키지 않는다)", () => {
    const manager = makeManager();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    manager.beginTransaction({ type: "batch", elementId: "body-1" });
    manager.addEntry({
      type: "update",
      elementId: "legacy",
      data: {}, // canonicalEvents 없음
    });
    manager.commitTransaction();

    expect(manager.getCurrentPageEntries()).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("병합 불가"),
      "update",
      "legacy",
    );
  });

  it("열린 트랜잭션 없이 커밋하면 경고만 하고 아무 것도 하지 않는다", () => {
    const manager = makeManager();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    manager.commitTransaction();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("열린 트랜잭션 없음"),
    );
    expect(manager.getCurrentPageEntries()).toHaveLength(0);
  });

  it("runInTransaction 은 콜백 안의 addEntry 를 병합하고 반환값을 그대로 넘긴다", () => {
    const manager = makeManager();

    const returned = manager.runInTransaction(
      { type: "batch", elementId: "body-1" },
      () => {
        manager.addEntry({
          type: "update",
          elementId: "a",
          data: { canonicalEvents: [updateEvent("a")] },
        });
        manager.addEntry({
          type: "update",
          elementId: "b",
          data: { canonicalEvents: [updateEvent("b")] },
        });
        return ["write-a", "write-b"];
      },
    );

    expect(returned).toEqual(["write-a", "write-b"]);
    expect(manager.hasOpenTransaction()).toBe(false);
    const entries = manager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].data.canonicalEvents).toHaveLength(2);
  });

  it("runInTransaction 콜백이 throw 해도 창을 닫고 그때까지의 event 를 기록한다", () => {
    const manager = makeManager();

    expect(() =>
      manager.runInTransaction({ type: "batch", elementId: "body-1" }, () => {
        manager.addEntry({
          type: "update",
          elementId: "a",
          data: { canonicalEvents: [updateEvent("a")] },
        });
        throw new Error("boom");
      }),
    ).toThrow("boom");

    // 이미 일어난 mutation 을 기록 없이 남기면 되돌릴 수 없다
    expect(manager.hasOpenTransaction()).toBe(false);
    expect(manager.getCurrentPageEntries()).toHaveLength(1);
  });

  it("runInTransaction 콜백이 Promise 를 반환하면 경고한다 (창이 동기가 아님)", () => {
    const manager = makeManager();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    manager.runInTransaction(
      { type: "batch", elementId: "body-1" },
      async () => {
        manager.addEntry({
          type: "update",
          elementId: "a",
          data: { canonicalEvents: [updateEvent("a")] },
        });
      },
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Promise 를 반환"),
      "batch",
      "body-1",
    );
  });

  it("창이 이벤트 루프에 양보하면 커밋 시 경고한다 (외부 mutation 병합 가능)", async () => {
    const manager = makeManager();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    manager.beginTransaction({ type: "batch", elementId: "body-1" });
    await Promise.resolve(); // microtask 경계 — 감지 콜백이 여기서 돈다
    manager.addEntry({
      type: "update",
      elementId: "a",
      data: { canonicalEvents: [updateEvent("a")] },
    });
    manager.commitTransaction();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("이벤트 루프에 양보"),
      "batch",
      "body-1",
    );
    // 경고와 무관하게 엔트리는 만들어진다 — 이미 일어난 변경은 되돌릴 수 있어야 한다
    expect(manager.getCurrentPageEntries()).toHaveLength(1);
  });

  it("동기 창은 경고하지 않고, 감지 깃발이 다음 창으로 새지 않는다", async () => {
    const manager = makeManager();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 같은 tick 에 두 창을 여닫는다 — 첫 창의 감지 콜백이 아직 대기 중인 상태
    for (const id of ["first", "second"]) {
      manager.runInTransaction({ type: "batch", elementId: id }, () => {
        manager.addEntry({
          type: "update",
          elementId: id,
          data: { canonicalEvents: [updateEvent(id)] },
        });
      });
    }

    await Promise.resolve(); // 대기 중인 감지 콜백 전부 실행
    manager.runInTransaction({ type: "batch", elementId: "third" }, () => {
      manager.addEntry({
        type: "update",
        elementId: "third",
        data: { canonicalEvents: [updateEvent("third")] },
      });
    });

    expect(warn).not.toHaveBeenCalled();
    expect(manager.getCurrentPageEntries()).toHaveLength(3);
  });

  it("트랜잭션 밖 addEntry 는 종전대로 엔트리마다 하나씩 쌓인다", () => {
    const manager = makeManager();

    manager.addEntry({
      type: "update",
      elementId: "a",
      data: { canonicalEvents: [updateEvent("a")] },
    });
    manager.addEntry({
      type: "update",
      elementId: "b",
      data: { canonicalEvents: [updateEvent("b")] },
    });

    expect(manager.getCurrentPageEntries()).toHaveLength(2);
  });
});
