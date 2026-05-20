import { describe, expect, it } from "vitest";

import { buttonPrimitiveBinding } from "../primitives/button";
import { buildInspectorFieldSections } from "../outputs/inspectorFields";
import { toButtonRacProps } from "../outputs/toRacProps";

describe("ADR-142 inspector field contracts", () => {
  it("groups Button PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Button",
      contracts: buttonPrimitiveBinding.props.accepts,
      theme: {
        variants: { Button: ["accent", "primary", "secondary"] },
        sizes: { Button: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Icon",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["children"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "fillStyle",
      "size",
      "type",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "iconName",
      "iconPosition",
      "iconStrokeWidth",
    ]);
    expect(sections[3].fields.map((field) => field.key)).toEqual([
      "isDisabled",
      "isLoading",
    ]);
  });

  it("keeps Button icon controls visible only when an icon is selected", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Button",
      contracts: buttonPrimitiveBinding.props.accepts,
    });

    const fields = sections.flatMap((section) => section.fields);
    expect(fields.find((field) => field.key === "iconName")).toMatchObject({
      kind: "icon",
      label: "Icon",
    });
    expect(fields.find((field) => field.key === "iconPosition")).toMatchObject({
      kind: "enum",
      visibleWhen: { key: "iconName", truthy: true },
    });
    expect(
      fields.find((field) => field.key === "iconStrokeWidth"),
    ).toMatchObject({
      kind: "number",
      min: 0.5,
      max: 4,
      step: 0.5,
      visibleWhen: { key: "iconName", truthy: true },
    });
  });

  it("resolves variant and size values from the supplied theme lookup", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Button",
      contracts: buttonPrimitiveBinding.props.accepts,
      theme: {
        variants: { Button: ["accent", "negative"] },
        sizes: { Button: ["xs", "xl"] },
      },
    });

    const fields = sections.flatMap((section) => section.fields);
    expect(fields.find((field) => field.key === "variant")?.options).toEqual([
      { value: "accent", label: "Accent" },
      { value: "negative", label: "Negative" },
    ]);
    expect(fields.find((field) => field.key === "size")?.options).toEqual([
      { value: "xs", label: "XS" },
      { value: "xl", label: "XL" },
    ]);
  });

  it("projects Button icon canonical props through the catalog boundary", () => {
    expect(
      toButtonRacProps({
        children: "Create",
        iconName: "plus",
        iconPosition: "end",
        iconStrokeWidth: 1.5,
      }),
    ).toMatchObject({
      children: "Create",
      iconName: "plus",
      iconPosition: "end",
      iconStrokeWidth: 1.5,
    });
  });
});
