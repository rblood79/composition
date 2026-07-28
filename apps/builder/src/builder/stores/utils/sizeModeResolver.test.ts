import { describe, expect, it } from "vitest";
import { resolveSizeMode, sizeModeToStyleUpdates } from "./sizeModeResolver";

describe("sizeModeResolver axis ownership", () => {
  it("keeps width Fill flex props when height switches to Fixed in a row parent", () => {
    const result = resolveSizeMode(
      "fixed",
      "height",
      "flex",
      "row",
      "fit-content",
      "144px",
    );

    expect(sizeModeToStyleUpdates(result)).toEqual({
      height: "144px",
      alignSelf: "",
    });
  });

  it("keeps height Fill alignSelf when width switches to Fixed in a row parent", () => {
    const result = resolveSizeMode(
      "fixed",
      "width",
      "flex",
      "row",
      "fit-content",
      "320px",
    );

    expect(sizeModeToStyleUpdates(result)).toEqual({
      width: "320px",
      flexGrow: "",
      flexShrink: "",
      flexBasis: "",
    });
  });

  it("uses px fallback values when no rendered size is available", () => {
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "width", "block", "row", "fit-content"),
      ),
    ).toEqual({ width: "200px" });
    expect(
      sizeModeToStyleUpdates(
        resolveSizeMode("fixed", "height", "block", "row", "fit-content"),
      ),
    ).toEqual({ height: "100px" });
  });

  it("removes only the target axis Fill props when switching to Hug", () => {
    const result = resolveSizeMode("fit", "height", "flex", "column", "100%");

    expect(sizeModeToStyleUpdates(result)).toEqual({
      height: "fit-content",
      flexGrow: "",
      flexShrink: "",
      flexBasis: "",
    });
  });
});
