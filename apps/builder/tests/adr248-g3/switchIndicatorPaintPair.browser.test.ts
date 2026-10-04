import { expect, it } from "vitest";
import { switchIndicatorPaintPair } from "./approvedDifferences";

it("requires the frozen Switch state fixture, its known track move and current DOM parity", () => {
  const hash =
    "d931e8b953058c38cf568b774261cf0a0977961cc5c075a673fa1eaf633ce46c";
  const old = { x: 30, y: 30, width: 91, height: 28 };
  const current = { ...old, width: 88.4 };
  const track = { x: 30, y: 34, width: 36, height: 20 };
  const pair = (
    scene = hash,
    state = "selected",
    before = old,
    after = current,
    part = track,
    dom = track,
  ) => switchIndicatorPaintPair(scene, state, before, after, part, dom);
  for (const state of [
    "selected",
    "unselected",
    "disabled",
    "hover",
    "pressed",
    "focus-visible",
  ])
    expect(pair(hash, state)).toEqual({
      oldRect: { ...track, y: 30 },
      newRect: track,
    });
  expect(pair("another-scene")).toBeUndefined();
  expect(pair(hash, "unknown")).toBeUndefined();
  expect(pair(hash, "selected", { ...old, height: 30 })).toBeUndefined();
  expect(pair(hash, "selected", old, { ...current, x: 31 })).toBeUndefined();
  expect(
    pair(hash, "selected", old, current, { ...track, y: 38 }),
  ).toBeUndefined();
  expect(
    pair(hash, "selected", old, current, { ...track, width: 40 }),
  ).toBeUndefined();
  expect(
    pair(hash, "selected", old, current, track, { ...track, y: 36 }),
  ).toBeUndefined();
  expect(
    switchIndicatorPaintPair(hash, "selected", old, current, track, undefined),
  ).toBeUndefined();
});
