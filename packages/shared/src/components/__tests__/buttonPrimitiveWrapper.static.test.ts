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

  it("uses catalog toRacProps as the ToggleButtonGroup prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../ToggleButtonGroup.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toToggleButtonGroupRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Toolbar prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Toolbar.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toToolbarRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Breadcrumbs and Breadcrumb prop projection sources", () => {
    const breadcrumbsSource = fs.readFileSync(
      new URL("../Breadcrumbs.tsx", import.meta.url),
      "utf8",
    );
    const breadcrumbSource = fs.readFileSync(
      new URL("../Breadcrumb.tsx", import.meta.url),
      "utf8",
    );

    expect(breadcrumbsSource).toContain("toBreadcrumbsRacProps");
    expect(breadcrumbsSource).toContain("../catalog/outputs/toRacProps");
    expect(breadcrumbSource).toContain("toBreadcrumbRacProps");
    expect(breadcrumbSource).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the TextField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../TextField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toTextFieldRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the NumberField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../NumberField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toNumberFieldRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the SearchField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../SearchField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toSearchFieldRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
    expect(source).not.toContain("@composition/specs");
  });

  it("uses catalog toRacProps as the DateField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../DateField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toDateFieldRacProps");
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
