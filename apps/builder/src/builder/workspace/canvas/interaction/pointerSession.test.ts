import { describe, expect, it } from "vitest";
import { resolveDoubleClickTargetId } from "./pointerSession";

describe("resolveDoubleClickTargetId", () => {
  it("uses the hit element while the pointer is inside the current selection bounds", () => {
    expect(resolveDoubleClickTargetId("group-child", "group")).toBe(
      "group-child",
    );
  });

  it("falls back to the selected element when there is no concrete hit target", () => {
    expect(resolveDoubleClickTargetId(null, "group")).toBe("group");
  });
});
