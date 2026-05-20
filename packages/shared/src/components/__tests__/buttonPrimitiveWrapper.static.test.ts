import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("ADR-142 Button primitive wrapper boundary", () => {
  it("uses catalog toRacProps as the Button prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Button.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toButtonRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Separator prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Separator.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toSeparatorRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Link prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Link.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toLinkRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the ToggleButton prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../ToggleButton.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toToggleButtonRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("documents the shared components legacy compatibility boundary", () => {
    const readmeUrl = new URL("../legacy/README.md", import.meta.url);

    expect(fs.existsSync(readmeUrl)).toBe(true);
    expect(fs.readFileSync(readmeUrl, "utf8")).toContain(
      "active Builder authoring",
    );
  });
});
