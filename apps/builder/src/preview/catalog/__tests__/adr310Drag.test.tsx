import { expect, it } from "vitest";
import { catalogDragAndDropOptions } from "../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components";

/**
 * ADR-310 G6 — drag and drop in a list that mixes fixed items and data runs (사용자 결정 4): a fixed
 * item is not data (never dragged, never moved); a row dropped next to one lands at the run's start
 * (before it) or end (after it); each row carries its own run's drag type (구간별 끌기 type);
 * `onMove` hands the rule a drop onto an item (`on` — a Tree's new parent).
 */
const PEOPLE = "application/x-composition-item+people";
const TEAMS = "application/x-composition-item+teams";
const ITEMS = () => [
  { key: "all" },
  { key: "p1", type: PEOPLE },
  { key: "p2", type: PEOPLE },
  { key: "mid" },
  { key: "t1", type: TEAMS },
  { key: "t2", type: TEAMS },
  { key: "archive" },
];

function options(handlers: string[]) {
  const fired: [string, Record<string, unknown>][] = [];
  const o = catalogDragAndDropOptions(
    Object.fromEntries(handlers.map((name) => [name, () => {}])),
    PEOPLE,
    (name, event) => fired.push([name, event as Record<string, unknown>]),
    [PEOPLE, TEAMS],
    true,
    ITEMS,
  );
  return { o, fired };
}
const reorder = (keys: string[], key: string, dropPosition: string) => ({
  keys: new Set(keys),
  dropOperation: "move" as const,
  target: { type: "item" as const, key, dropPosition },
});

it("G6 결정 4: a row dropped by a fixed item lands at its run's edge; fixed items never move", () => {
  const { o, fired } = options(["onReorder"]);
  // Before the fixed 「all」 (before the people run): the run's start.
  o.onReorder!(reorder(["p2"], "all", "before") as never);
  expect(fired.at(-1)![1].target).toMatchObject({ key: "p1", dropPosition: "before" });
  // After 「mid」 (after the people run): the people run's end, not the teams'.
  o.onReorder!(reorder(["p1"], "mid", "after") as never);
  expect(fired.at(-1)![1].target).toMatchObject({ key: "p2", dropPosition: "after" });
  // A teams row by 「mid」: the teams run's start; by 「archive」: its end.
  o.onReorder!(reorder(["t2"], "mid", "after") as never);
  expect(fired.at(-1)![1].target).toMatchObject({ key: "t1", dropPosition: "before" });
  o.onReorder!(reorder(["t1"], "archive", "before") as never);
  expect(fired.at(-1)![1].target).toMatchObject({ key: "t2", dropPosition: "after" });
  // A row target stays as RAC gave it.
  o.onReorder!(reorder(["p1"], "p2", "after") as never);
  expect(fired.at(-1)![1].target).toMatchObject({ key: "p2", dropPosition: "after" });
  // A fixed item is not data: its key is dropped; alone, nothing runs.
  o.onReorder!(reorder(["all", "p1"], "p2", "after") as never);
  expect(fired.at(-1)![1].keys).toEqual(["p1"]);
  const count = fired.length;
  o.onReorder!(reorder(["mid"], "p2", "after") as never);
  expect(fired).toHaveLength(count);
});

it("G6 구간별 끌기 type: each row carries its run's collection", () => {
  const { o } = options(["onReorder"]);
  const items = o.getItems!(new Set(["p1", "t2"]), [] as never);
  expect(items.map((item) => Object.keys(item)[0])).toEqual([PEOPLE, TEAMS]);
});

it("G6 onMove: a drop onto an item reaches the rule as `on` (a Tree's new parent)", () => {
  const { o, fired } = options(["onMove"]);
  o.onMove!(reorder(["p2"], "p1", "on") as never);
  expect(fired).toEqual([
    ["onMove", expect.objectContaining({ keys: ["p2"], target: expect.objectContaining({ key: "p1", dropPosition: "on" }) })],
  ]);
});
