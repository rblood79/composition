// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — 여러 요소를 선택하고 fill 을 고치면 각 요소의 layer 에 같은 변경을 옮긴다
 * (첫 요소의 fills 배열이 나머지 요소를 통째로 덮던 결함).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  FillType,
  createDefaultColorFill,
  createDefaultFill,
  type FillItem,
} from "../../../../../types/builder/fill.types";
import { openStylesFixture } from "../../__tests__/support/catalogStylesFixture";
import { replayFillEdit } from "../fillEdit";

const red = { ...createDefaultColorFill("#FF0000FF"), id: "red" };
const gradient = { ...createDefaultFill(FillType.LinearGradient), id: "grad" };
const blue = { ...createDefaultColorFill("#0000FFFF"), id: "blue" };

describe("multi-selection fill edit", () => {
  it("toggling the first element's layer changes the same layer of the other, keeping its layers", async () => {
    const fixture = await openStylesFixture([
      { id: "a", fills: [red] },
      { id: "b", fills: [gradient, blue] },
    ]);
    fixture.select("a", "b");
    const before = fixture.host.readFills();
    fixture.host.updateFills(
      before.map((layer) => ({ ...layer, enabled: false })),
    );
    fixture.select("b");
    const b = fixture.host.readFills();
    expect(b.map((layer) => layer.type)).toEqual([
      FillType.LinearGradient,
      FillType.Color,
    ]);
    expect(b.map((layer) => layer.enabled)).toEqual([false, true]);
    fixture.select("a");
    expect(fixture.host.readFills()[0]).toMatchObject({ enabled: false });
  });
});

describe("replayFillEdit", () => {
  const own: FillItem[] = [gradient, blue];
  it("same layers take the edit", () => {
    const after = [{ ...red, opacity: 0.5 }];
    expect(replayFillEdit([red], after, [{ ...red, id: "x" }])).toEqual(after);
  });
  it("an appended layer is appended; a removed index is removed", () => {
    const added = { ...createDefaultColorFill("#00FF00FF"), id: "new" };
    expect(replayFillEdit([red], [red, added], own)).toEqual([...own, added]);
    expect(replayFillEdit([red, blue], [blue], own)).toEqual([blue]);
  });
  it("a reorder applies the same permutation", () => {
    const second = { ...blue, id: "b2" };
    expect(replayFillEdit([red, second], [second, red], own)).toEqual([
      blue,
      gradient,
    ]);
  });
});
