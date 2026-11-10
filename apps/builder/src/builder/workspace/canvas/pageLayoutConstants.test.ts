import { describe, expect, it } from "vitest";
import { PAGE_STACK_GAP } from "./pageLayoutConstants";

describe("page layout width constants", () => {
  it("uses the current page gap as the default", () => {
    expect(PAGE_STACK_GAP).toBe(80);
  });
});
