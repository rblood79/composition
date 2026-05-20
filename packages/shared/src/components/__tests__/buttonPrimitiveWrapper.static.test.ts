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

  it("uses catalog toRacProps as the TimeField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../TimeField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toTimeFieldRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the ColorField prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../ColorField.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toColorFieldRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Form prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Form.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toFormRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the FileTrigger prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../FileTrigger.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toFileTriggerRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Switch prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Switch.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toSwitchRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Checkbox prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Checkbox.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toCheckboxRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the CheckboxGroup prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../CheckboxGroup.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toCheckboxGroupRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Radio prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Radio.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toRadioRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the RadioGroup prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../RadioGroup.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toRadioGroupRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Slider prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Slider.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toSliderRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the ListBox prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../ListBox.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toListBoxRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the GridList prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../GridList.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toGridListRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the TagGroup prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../TagGroup.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toTagGroupRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Menu prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Menu.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toMenuRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the ComboBox prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../ComboBox.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toComboBoxRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Select prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Select.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toSelectRacProps");
    expect(source).toContain("../catalog/outputs/toRacProps");
  });

  it("uses catalog toRacProps as the Tabs prop projection source", () => {
    const source = fs.readFileSync(
      new URL("../Tabs.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("toTabsRacProps");
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
