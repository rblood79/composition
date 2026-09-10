import { describe, expect, it } from "vitest";
import { renameRowKey, renameRowsKey } from "./schemaMigration";

describe("renameRowKey (리서치 D2)", () => {
  it("값을 새 key 로 옮기고 열 순서를 지킨다", () => {
    const row = { id: 1, mail: "a@x", name: "A" };
    expect(Object.entries(renameRowKey(row, "mail", "email"))).toEqual([
      ["id", 1],
      ["email", "a@x"],
      ["name", "A"],
    ]);
  });

  it("옛 key 가 없는 행은 그대로", () => {
    const row = { id: 1 };
    expect(renameRowKey(row, "mail", "email")).toBe(row);
  });

  it("같은 key 면 그대로", () => {
    const row = { id: 1 };
    expect(renameRowKey(row, "id", "id")).toBe(row);
  });

  it("행 배열 · undefined 통과", () => {
    expect(renameRowsKey(undefined, "a", "b")).toBeUndefined();
    expect(renameRowsKey([{ a: 1 }, { c: 2 }], "a", "b")).toEqual([
      { b: 1 },
      { c: 2 },
    ]);
  });
});
