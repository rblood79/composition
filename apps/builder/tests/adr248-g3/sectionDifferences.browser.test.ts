import { expect, it } from "vitest";
import {
  approvedSectionDifference,
  SECTION_SUPPLEMENT_HASH,
} from "./approvedDifferences";

it("bounds section exceptions by fixture, owner, node, exact old/new geometry and a real DOM box", () => {
  const old = { x: 30, y: 30, width: 220, height: 124 };
  const next = { x: 30, y: 30, width: 104, height: 130 };
  const check = (
    hash = SECTION_SUPPLEMENT_HASH,
    owner = "GridListSection",
    node = "GridListSection",
    a = old,
    b = next,
    dom = true,
  ) => approvedSectionDifference(hash, owner, node, a, b, dom);
  expect(check()?.id).toBe("section-grid-two-column-host");
  expect(check("another-fixture")).toBeUndefined();
  expect(check(undefined, "GridList")).toBeUndefined();
  expect(check(undefined, undefined, "Header")).toBeUndefined();
  expect(
    check(undefined, undefined, undefined, { ...old, x: 31 }),
  ).toBeUndefined();
  expect(
    check(undefined, undefined, undefined, old, { ...next, height: 132 }),
  ).toBeUndefined();
  expect(
    check(undefined, undefined, undefined, old, next, false),
  ).toBeUndefined();
});
