import { describe, expect, it } from "vitest";
import {
  canUseTargetedLayoutPresentation,
  parsePresentationLayoutPx,
} from "./editorPresentationLayoutPilot";

describe("presentation layout px parser", () => {
  it("accepts finite non-negative px values", () => {
    expect(parsePresentationLayoutPx(0)).toBe(0);
    expect(parsePresentationLayoutPx("120px")).toBe(120);
    expect(parsePresentationLayoutPx(" 12.5px ")).toBe(12.5);
  });

  it("rejects non-px, negative, and non-finite values", () => {
    expect(parsePresentationLayoutPx("50%")).toBeNull();
    expect(parsePresentationLayoutPx("auto")).toBeNull();
    expect(parsePresentationLayoutPx("-1px")).toBeNull();
    expect(parsePresentationLayoutPx(Number.NaN)).toBeNull();
  });

  it("opens absolute leaves and engine-backed in-flow nodes only", () => {
    expect(
      canUseTargetedLayoutPresentation({ position: "absolute" }, false),
    ).toBe(true);
    expect(
      canUseTargetedLayoutPresentation({ position: "absolute" }, true),
    ).toBe(false);
    expect(canUseTargetedLayoutPresentation({ position: "static" }, true)).toBe(
      true,
    );
    expect(canUseTargetedLayoutPresentation({}, true)).toBe(true);
    expect(canUseTargetedLayoutPresentation({ position: "fixed" }, false)).toBe(
      false,
    );
    expect(
      canUseTargetedLayoutPresentation({ position: "sticky" }, false),
    ).toBe(false);
  });

  it("opens numeric spacing for non-grid flow and closes grid cache paths", () => {
    expect(
      canUseTargetedLayoutPresentation(
        { display: "flex", position: "static" },
        true,
        "padding",
      ),
    ).toBe(true);
    expect(
      canUseTargetedLayoutPresentation(
        { display: "flex", position: "static" },
        true,
        "gap",
      ),
    ).toBe(true);
    expect(
      canUseTargetedLayoutPresentation(
        { display: "grid", position: "static" },
        true,
        "gap",
      ),
    ).toBe(false);
  });
});
