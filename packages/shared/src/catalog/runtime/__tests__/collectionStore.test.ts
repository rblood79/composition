import { describe, expect, it } from "vitest";
import {
  CollectionStore,
  overlayRows,
  storeKeyOf,
  type OverlayShape,
  type Row,
} from "../collectionStore";

/**
 * ADR-325 — the store on its own. Every expected value is written by hand from the breakdown's
 * tables (「합치기」 · 「판정」 · 「조회가 올 때」), never read back from the store.
 */
const keyOf = (row: Row) =>
  typeof row.id === "string" || typeof row.id === "number"
    ? String(row.id)
    : undefined;
const FLAT: OverlayShape = { dataKey: (row) => keyOf(row) };
const remote = (at: number, extra: object = {}) => ({
  at,
  keyOf,
  keyless: "answer" as const,
  ...extra,
});

function seeded(
  rows: Row[] = [
    { id: "a", n: 3 },
    { id: "b", n: 1 },
  ],
) {
  const store = new CollectionStore();
  store.accept("GET /x", rows, remote(1));
  store.startList("L", "GET /x");
  const shown = () => overlayRows(store, store.listRows("L"), FLAT);
  const row = (key: string) => shown().find((item) => item.id === key)!;
  return { store, shown, row };
}

describe("ADR-325 store — 합치기", () => {
  it("3 → 5 → 8 is one change (base 3); back to 3 is none; an insert then its remove is none", () => {
    const { store, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.update("a", { n: 8 }, 2, row("a"));
    expect(store.changes.get("a")).toEqual({
      kind: "update",
      baseRow: { id: "a", n: 3 },
      fields: { n: { base: 3, value: 8, seq: 2 } },
    });
    store.update("a", { n: 3 }, 3, row("a"));
    expect(store.changes.size).toBe(0);
    store.insert("t1", { id: "t1", n: 0 }, 4, { kind: "append", key: "t1" });
    expect(store.changes.size).toBe(1);
    store.remove("t1", 5, row("t1"));
    expect(store.changes.size).toBe(0);
    expect(store.order).toEqual([]);
  });

  it("null · empty text · 0 · false are not the same value", () => {
    const { store, row } = seeded([{ id: "a", n: 0 }]);
    for (const value of [null, "", false]) {
      store.update("a", { n: value }, 1, row("a"));
      expect(store.changes.get("a")).toMatchObject({
        fields: { n: { base: 0, value } },
      });
    }
  });

  it("an update then a remove is a remove of the first base row", () => {
    const { store, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.remove("a", 2, row("a"));
    expect(store.changes.get("a")).toEqual({
      kind: "remove",
      baseRow: { id: "a", n: 3 },
      seq: 2,
    });
  });
});

describe("ADR-325 store — 조회가 변경을 지우지 않는다", () => {
  it("a reload keeps the change over the new rows; a row's new server value is noted on the field", () => {
    const { store, shown, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.accept(
      "GET /x",
      [
        { id: "a", n: 4 },
        { id: "b", n: 1 },
      ],
      remote(2),
    );
    expect(shown()).toEqual([
      { id: "a", n: 5 },
      { id: "b", n: 1 },
    ]);
    expect(store.changes.get("a")).toEqual({
      kind: "update",
      baseRow: { id: "a", n: 3 },
      fields: { n: { base: 3, value: 5, seq: 1, server: 4 } },
    });
  });

  it("a server value equal to the user's drops the field", () => {
    const { store, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.accept("GET /x", [{ id: "a", n: 5 }], remote(2));
    expect(store.changes.size).toBe(0);
  });

  it("an earlier request's late answer neither replaces the keys nor a later value", () => {
    const { store, shown } = seeded();
    // (Request 3 · 4 of another query share row a.)
    store.accept("GET /y", [{ id: "a", n: 9 }], remote(4));
    store.startList("M", "GET /y");
    store.accept(
      "GET /x",
      [
        { id: "a", n: 7 },
        { id: "c", n: 1 },
      ],
      remote(3),
    );
    expect(shown()).toEqual([
      { id: "a", n: 9 },
      { id: "c", n: 1 },
    ]);
    expect(overlayRows(store, store.listRows("M"), FLAT)).toEqual([
      { id: "a", n: 9 },
    ]);
    // (The same request's older answer: dropped whole.)
    expect(store.accept("GET /y", [{ id: "z" }], remote(2))).toBe(false);
  });

  it("rows without a key are of their answer: another query's first row is another row; a reload drops their changes (U1)", () => {
    const store = new CollectionStore();
    store.accept("GET /p?f=1", [{ n: 1 }], remote(1));
    store.accept("GET /p?f=2", [{ n: 1 }], remote(2));
    store.startList("A", "GET /p?f=1");
    store.startList("B", "GET /p?f=2");
    const [first] = store.listRows("A");
    store.update(storeKeyOf(first!)!, { n: 5 }, 1, first!);
    expect(overlayRows(store, store.listRows("A"), FLAT)).toEqual([{ n: 5 }]);
    expect(overlayRows(store, store.listRows("B"), FLAT)).toEqual([{ n: 1 }]);
    store.accept("GET /p?f=1", [{ n: 1 }], remote(3));
    expect(store.changes.size).toBe(0);
    expect(overlayRows(store, store.listRows("A"), FLAT)).toEqual([{ n: 1 }]);
  });
});

describe("ADR-325 store — 판정", () => {
  it("a save confirmed: the row holds the sent value, a cell written after the send stays with the sent value as its base", () => {
    const { store, row, shown } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.update("b", { n: 2 }, 1, row("b"));
    const ticket = store.beginSend(new Set([1]))!;
    store.update("b", { n: 7 }, 2, row("b"));
    store.settle(
      ticket,
      [
        { key: "a", result: "confirmed" },
        { key: "b", result: "confirmed" },
      ],
      10,
    );
    expect(store.rows.get("a")?.row).toEqual({ id: "a", n: 5 });
    expect(store.changes.get("a")).toBeUndefined();
    expect(store.changes.get("b")).toEqual({
      kind: "update",
      baseRow: { id: "b", n: 2 },
      fields: { n: { base: 2, value: 7, seq: 2 } },
    });
    expect(shown()).toEqual([
      { id: "a", n: 5 },
      { id: "b", n: 7 },
    ]);
  });

  it("a two-row paste (one edit number) with A confirmed and B rejected: B keeps its value and change", () => {
    const { store, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.update("b", { n: 6 }, 1, row("b"));
    const ticket = store.beginSend(new Set([1]))!;
    store.settle(
      ticket,
      [
        { key: "a", result: "confirmed" },
        { key: "b", result: "rejected" },
      ],
      10,
    );
    expect(store.changes.has("a")).toBe(false);
    expect(store.changes.get("b")).toMatchObject({
      fields: { n: { base: 1, value: 6 } },
    });
  });

  it("3 → 5 sent, back to 3 before the answer: it stays until judged; confirmed = 5 → 3, rejected = none, unknown = as it is", () => {
    const run = (result: "confirmed" | "rejected" | "unknown") => {
      const { store, row } = seeded();
      store.update("a", { n: 5 }, 1, row("a"));
      const ticket = store.beginSend(new Set([1]))!;
      store.update("a", { n: 3 }, 2, row("a"));
      expect(store.changes.get("a")).toMatchObject({
        fields: { n: { base: 3, value: 3, seq: 2 } },
      });
      store.settle(ticket, [{ key: "a", result }], 10);
      return store;
    };
    expect(run("confirmed").changes.get("a")).toEqual({
      kind: "update",
      baseRow: { id: "a", n: 5 },
      fields: { n: { base: 5, value: 3, seq: 2 } },
    });
    expect(run("rejected").changes.size).toBe(0);
    const unknown = run("unknown");
    expect(unknown.changes.get("a")).toMatchObject({
      fields: { n: { base: 3, value: 3 } },
    });
    expect(unknown.sends.size).toBe(1);
  });

  it("the same cell saved as 5 then 8, answers 8 → 5: the row is 8 and nothing is unsaved (and in order, too)", () => {
    for (const order of [
      [1, 0],
      [0, 1],
    ]) {
      const { store, row, shown } = seeded();
      store.update("a", { n: 5 }, 1, row("a"));
      const first = store.beginSend(new Set([1]))!;
      store.update("a", { n: 8 }, 2, row("a"));
      const second = store.beginSend(new Set([2]))!;
      const tickets = [first, second];
      for (const [index, at] of order.map((i, step) => [i, 10 + step]))
        store.settle(
          tickets[index!]!,
          [{ key: "a", result: "confirmed" }],
          at!,
        );
      expect(store.rows.get("a")?.row).toEqual({ id: "a", n: 8 });
      expect(store.changes.size).toBe(0);
      expect(shown()[0]).toEqual({ id: "a", n: 8 });
    }
  });

  it("an insert sent then removed before the answer: confirmed under K = a remove of K; rejected = none", () => {
    const confirmed = seeded();
    confirmed.store.insert("t", { id: "t", n: 1 }, 1, {
      kind: "append",
      key: "t",
    });
    const ticket = confirmed.store.beginSend(new Set([1]))!;
    confirmed.store.remove("t", 2, confirmed.row("t"));
    expect(confirmed.shown().map((item) => item.id)).toEqual(["a", "b"]);
    confirmed.store.settle(
      ticket,
      [{ key: "t", result: "confirmed", serverKey: "K" }],
      10,
    );
    expect(confirmed.store.changes.get("K")).toEqual({
      kind: "remove",
      baseRow: { id: "t", n: 1 },
      seq: 2,
    });
    expect(confirmed.store.changes.has("t")).toBe(false);
    expect(confirmed.shown().map((item) => item.id)).toEqual(["a", "b"]);

    const rejected = seeded();
    rejected.store.insert("t", { id: "t", n: 1 }, 1, {
      kind: "append",
      key: "t",
    });
    const refused = rejected.store.beginSend(new Set([1]))!;
    rejected.store.remove("t", 2, rejected.row("t"));
    rejected.store.settle(refused, [{ key: "t", result: "rejected" }], 10);
    expect(rejected.store.changes.size).toBe(0);
  });

  it("an insert (A) sent, renamed B, confirmed without a key: unlinked B stays; linked, an update A → B of that key", () => {
    const { store, row } = seeded();
    store.insert("t", { id: "t", name: "A" }, 1, { kind: "append", key: "t" });
    const ticket = store.beginSend(new Set([1]))!;
    store.update("t", { name: "B" }, 2, row("t"));
    store.settle(
      ticket,
      [{ key: "t", result: "confirmed", serverKey: null }],
      10,
    );
    expect(store.changes.get("t")).toEqual({
      kind: "unlinked",
      sent: { id: "t", name: "A" },
      row: { id: "t", name: "B" },
      seq: 2,
    });
    expect(store.beginSend(new Set([1, 2]))).toBeUndefined();
    store.accept("GET /x", [{ id: "S9", name: "A" }], remote(11));
    store.link("t", "S9");
    expect(store.changes.get("S9")).toEqual({
      kind: "update",
      baseRow: { id: "S9", name: "A" },
      fields: { name: { base: "A", value: "B", seq: 2 } },
    });
  });

  it("a remove confirmed leaves a trace: an earlier request's list does not bring the row back, a later one does", () => {
    const { store, row, shown } = seeded();
    store.remove("a", 1, row("a"));
    const ticket = store.beginSend(new Set([1]))!;
    store.settle(ticket, [{ key: "a", result: "confirmed" }], 10);
    expect(shown().map((item) => item.id)).toEqual(["b"]);
    store.accept(
      "GET /x",
      [
        { id: "a", n: 3 },
        { id: "b", n: 1 },
      ],
      remote(9),
    );
    expect(shown().map((item) => item.id)).toEqual(["b"]);
    store.accept(
      "GET /x",
      [
        { id: "a", n: 3 },
        { id: "b", n: 1 },
      ],
      remote(12),
    );
    expect(shown().map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("a save confirmed, then an earlier request's answer with the old value: the row keeps the confirmed value", () => {
    const { store, row } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    const ticket = store.beginSend(new Set([1]))!;
    store.settle(ticket, [{ key: "a", result: "confirmed" }], 10);
    store.accept("GET /y", [{ id: "a", n: 3 }], remote(8));
    expect(store.rows.get("a")?.row).toEqual({ id: "a", n: 5 });
    expect(store.results.get("GET /y")?.keys).toEqual(["a"]);
  });

  it("discard drops the changes only — the rows and results stay", () => {
    const { store, row, shown } = seeded();
    store.update("a", { n: 5 }, 1, row("a"));
    store.insert("t", { id: "t" }, 2, {
      kind: "insert",
      key: "t",
      at: "start",
    });
    expect(shown().map((item) => item.id)).toEqual(["t", "a", "b"]);
    store.discard(["a"]);
    expect(shown()).toEqual([
      { id: "t" },
      { id: "a", n: 3 },
      { id: "b", n: 1 },
    ]);
    store.discard();
    expect(shown()).toEqual([
      { id: "a", n: 3 },
      { id: "b", n: 1 },
    ]);
  });
});

describe("ADR-325 store — 자리", () => {
  it("an insert before a key that is gone goes to the end; a move keeps the moved rows' order", () => {
    const { store, row, shown } = seeded([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    store.insert("t", { id: "t" }, 1, {
      kind: "insert",
      key: "t",
      at: { before: "b" },
    });
    expect(shown().map((item) => item.id)).toEqual(["a", "t", "b", "c"]);
    store.remove("b", 2, row("b"));
    expect(shown().map((item) => item.id)).toEqual(["a", "c", "t"]);
    store.move({ kind: "move", keys: ["c", "t"], to: { before: "a" } });
    expect(shown().map((item) => item.id)).toEqual(["c", "t", "a"]);
  });

  it("no change: the rows are the answer's array itself", () => {
    const rows = [{ id: "a" }];
    const { store } = seeded(rows);
    expect(overlayRows(store, store.listRows("L"), FLAT)).toBe(rows);
  });

  it("a nested tree's child row is changed by its key under its parent", () => {
    const store = new CollectionStore();
    store.accept(
      "GET /t",
      [
        {
          id: "p",
          kids: [
            { id: "c1", n: 1 },
            { id: "c2", n: 2 },
          ],
        },
      ],
      remote(1),
    );
    store.startList("T", "GET /t");
    const shape: OverlayShape = { childrenKey: "kids", dataKey: keyOf };
    const child = (store.listRows("T")[0]!.kids as Row[])[0]!;
    store.update("c1", { n: 9 }, 1, child);
    store.remove("c2", 2, child);
    expect(overlayRows(store, store.listRows("T"), shape)).toEqual([
      { id: "p", kids: [{ id: "c1", n: 9 }] },
    ]);
  });

  it("a flat tree: removing a parent removes its subtree; an append under a parent takes its key", () => {
    const store = new CollectionStore();
    store.accept(
      "GET /f",
      [
        { id: "p", parent: null },
        { id: "c", parent: "p" },
        { id: "q", parent: null },
      ],
      remote(1),
    );
    store.startList("F", "GET /f");
    const shape: OverlayShape = { parentField: "parent", dataKey: keyOf };
    store.insert("n", { id: "n" }, 1, {
      kind: "append",
      key: "n",
      parent: "q",
    });
    expect(overlayRows(store, store.listRows("F"), shape)).toEqual([
      { id: "p", parent: null },
      { id: "c", parent: "p" },
      { id: "q", parent: null },
      { id: "n", parent: "q" },
    ]);
    store.remove("p", 2, { id: "p", parent: null });
    expect(
      overlayRows(store, store.listRows("F"), shape).map((item) => item.id),
    ).toEqual(["q", "n"]);
  });
});

describe("ADR-325 store — 수명 (G4)", () => {
  it("a list dropped takes the rows no other list holds — a row with a change or a send stays", () => {
    const store = new CollectionStore();
    store.accept("GET /a", [{ id: "a" }, { id: "s" }], remote(1));
    store.accept("GET /b", [{ id: "b" }, { id: "c" }, { id: "s" }], remote(2));
    store.startList("A", "GET /a");
    store.startList("B", "GET /b");
    store.update("c", { n: 1 }, 1, { id: "c" });
    store.dropList("B");
    expect([...store.lists.keys()]).toEqual(["A"]);
    expect([...store.results.keys()]).toEqual(["GET /a"]);
    expect(store.knownRow("b")).toBeUndefined();
    expect(store.knownRow("s")).toEqual({ id: "s" });
    expect(store.knownRow("c")).toEqual({ id: "c", n: 1 });
  });
});

