import { describe, expect, it } from "vitest";

import {
  isRenderProjectionId,
  toListBoxRowProjectionId,
} from "../renderProjectionIds";

describe("render projection id guard", () => {
  it("recognizes ListBox row and page-frame projection ids", () => {
    expect(
      isRenderProjectionId(toListBoxRowProjectionId("listbox", "cat")),
    ).toBe(true);
    expect(isRenderProjectionId("page-1::page-frame::slot-content")).toBe(true);
    expect(isRenderProjectionId("listbox")).toBe(false);
    expect(isRenderProjectionId(null)).toBe(false);
  });
});
