import { describe, expect, it } from "vitest";
import {
  isFixedTextMetricStyle,
  parsePresentationFontSize,
  parsePresentationFontWeight,
} from "./editorPresentationTextMetricValue";

describe("ADR-187 fixed Text metric values", () => {
  it("accepts only finite positive px font sizes", () => {
    expect(parsePresentationFontSize("18px")).toBe(18);
    expect(parsePresentationFontSize(18)).toBe(18);
    expect(parsePresentationFontSize("1.5em")).toBeNull();
    expect(parsePresentationFontSize("auto")).toBeNull();
  });

  it("accepts only numeric CSS font weights", () => {
    expect(parsePresentationFontWeight("700")).toBe(700);
    expect(parsePresentationFontWeight(400)).toBe(400);
    expect(parsePresentationFontWeight("bold")).toBeNull();
    expect(parsePresentationFontWeight(950)).toBeNull();
  });

  it("requires an absolute fixed box before opening either metric lane", () => {
    expect(
      isFixedTextMetricStyle({
        fontSize: "16px",
        height: "40px",
        position: "absolute",
        width: "120px",
      }),
    ).toBe(true);
    expect(
      isFixedTextMetricStyle({
        fontSize: "16px",
        height: "auto",
        position: "absolute",
        width: "120px",
      }),
    ).toBe(false);
  });
});
