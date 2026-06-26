import { describe, it, expect } from "vitest";
import { BUTTON_CHILD_HOST_TAGS } from "./ButtonChildSection";

describe("ButtonChildSection gate", () => {
  it("Button/ToggleButton 만 host 대상", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("Button")).toBe(true);
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButton")).toBe(true);
  });

  it("ToggleButtonGroup / 비-button 은 host 아님", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButtonGroup")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Text")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Frame")).toBe(false);
  });
});
