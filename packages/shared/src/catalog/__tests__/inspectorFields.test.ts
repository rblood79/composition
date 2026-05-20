import { describe, expect, it } from "vitest";

import { buttonPrimitiveBinding } from "../primitives/button";
import { checkboxPrimitiveBinding } from "../primitives/checkbox";
import { colorFieldPrimitiveBinding } from "../primitives/colorField";
import { comboBoxPrimitiveBinding } from "../primitives/comboBox";
import { dateFieldPrimitiveBinding } from "../primitives/dateField";
import { fileTriggerPrimitiveBinding } from "../primitives/fileTrigger";
import { formPrimitiveBinding } from "../primitives/form";
import { gridListPrimitiveBinding } from "../primitives/gridList";
import { getPrimitiveBinding } from "../registry";
import { listBoxPrimitiveBinding } from "../primitives/listBox";
import { menuPrimitiveBinding } from "../primitives/menu";
import { numberFieldPrimitiveBinding } from "../primitives/numberField";
import { searchFieldPrimitiveBinding } from "../primitives/searchField";
import { selectPrimitiveBinding } from "../primitives/select";
import { sliderPrimitiveBinding } from "../primitives/slider";
import { switchPrimitiveBinding } from "../primitives/switch";
import { tagGroupPrimitiveBinding } from "../primitives/tagGroup";
import { textFieldPrimitiveBinding } from "../primitives/textField";
import { timeFieldPrimitiveBinding } from "../primitives/timeField";
import { buildInspectorFieldSections } from "../outputs/inspectorFields";
import {
  toButtonRacProps,
  toCheckboxRacProps,
  toColorFieldRacProps,
  toComboBoxRacProps,
  toDateFieldRacProps,
  toFileTriggerRacProps,
  toFormRacProps,
  toGridListRacProps,
  toListBoxRacProps,
  toMenuRacProps,
  toNumberFieldRacProps,
  toRadioRacProps,
  toSearchFieldRacProps,
  toSelectRacProps,
  toSliderRacProps,
  toSwitchRacProps,
  toTagGroupRacProps,
  toTextFieldRacProps,
  toTimeFieldRacProps,
} from "../outputs/toRacProps";

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

  it("groups TextField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "TextField",
      contracts: textFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { TextField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Input Type",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholder",
      "description",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual(["type"]);
  });

  it("projects TextField canonical props through the catalog boundary", () => {
    expect(
      toTextFieldRacProps({
        label: "Email",
        value: "hello@example.com",
        placeholder: "name@example.com",
        type: "email",
        size: "lg",
        isRequired: true,
        labelPosition: "side",
      }),
    ).toMatchObject({
      label: "Email",
      value: "hello@example.com",
      placeholder: "name@example.com",
      type: "email",
      size: "lg",
      isRequired: true,
      labelPosition: "side",
    });
  });

  it("groups NumberField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "NumberField",
      contracts: numberFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { NumberField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Constraints",
      "Locale",
      "Format",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholder",
      "description",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "minValue",
      "maxValue",
      "step",
    ]);
  });

  it("projects NumberField canonical props through the catalog boundary", () => {
    expect(
      toNumberFieldRacProps({
        label: "Quantity",
        value: 42,
        minValue: 0,
        maxValue: 100,
        step: 2,
        locale: "en-US",
        formatOptions: { style: "decimal", notation: "standard" },
        size: "lg",
        isRequired: true,
        labelPosition: "side",
      }),
    ).toMatchObject({
      label: "Quantity",
      value: 42,
      minValue: 0,
      maxValue: 100,
      step: 2,
      locale: "en-US",
      formatOptions: { style: "decimal", notation: "standard" },
      size: "lg",
      isRequired: true,
      labelPosition: "side",
    });
  });

  it("groups SearchField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "SearchField",
      contracts: searchFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { SearchField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Input Type",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholder",
      "description",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "type",
      "inputMode",
    ]);
  });

  it("projects SearchField canonical props through the catalog boundary", () => {
    expect(
      toSearchFieldRacProps({
        label: "Search docs",
        value: "adr",
        placeholder: "Search...",
        type: "search",
        inputMode: "search",
        size: "lg",
        isRequired: true,
        labelPosition: "side",
      }),
    ).toMatchObject({
      label: "Search docs",
      value: "adr",
      placeholder: "Search...",
      type: "search",
      inputMode: "search",
      size: "lg",
      isRequired: true,
      labelPosition: "side",
    });
  });

  it("groups DateField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "DateField",
      contracts: dateFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { DateField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Locale",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholderValue",
      "description",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "size",
      "labelPosition",
      "isQuiet",
      "granularity",
      "hourCycle",
    ]);
  });

  it("projects DateField canonical props through the catalog boundary", () => {
    expect(
      toDateFieldRacProps({
        label: "Start date",
        value: "2026-05-20",
        placeholderValue: "2026-01-01",
        granularity: "day",
        hourCycle: 24,
        locale: "ko-KR",
        calendar: "gregory",
        size: "lg",
        isRequired: true,
        labelPosition: "side",
      }),
    ).toMatchObject({
      label: "Start date",
      value: "2026-05-20",
      placeholderValue: "2026-01-01",
      granularity: "day",
      hourCycle: 24,
      locale: "ko-KR",
      calendar: "gregory",
      size: "lg",
      isRequired: true,
      labelPosition: "side",
    });
  });

  it("groups TimeField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "TimeField",
      contracts: timeFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { TimeField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Locale",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholderValue",
      "description",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "size",
      "labelPosition",
      "isQuiet",
      "granularity",
      "hourCycle",
    ]);
  });

  it("projects TimeField canonical props through the catalog boundary", () => {
    expect(
      toTimeFieldRacProps({
        label: "Start time",
        value: "09:30",
        placeholderValue: "09:00",
        granularity: "minute",
        hourCycle: 24,
        locale: "ko-KR",
        size: "lg",
        isRequired: true,
        labelPosition: "side",
      }),
    ).toMatchObject({
      label: "Start time",
      value: "09:30",
      placeholderValue: "09:00",
      granularity: "minute",
      hourCycle: 24,
      locale: "ko-KR",
      size: "lg",
      isRequired: true,
      labelPosition: "side",
    });
  });

  it("groups ColorField PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "ColorField",
      contracts: colorFieldPrimitiveBinding.props.accepts,
      theme: {
        sizes: { ColorField: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Color",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
      "placeholder",
      "description",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "colorSpace",
      "channel",
    ]);
  });

  it("projects ColorField canonical props through the catalog boundary", () => {
    expect(
      toColorFieldRacProps({
        label: "Brand color",
        value: "#3366ff",
        placeholder: "#000000",
        colorSpace: "rgb",
        channel: "red",
        size: "lg",
        isRequired: true,
        labelPosition: "side",
        labelAlign: "end",
      }),
    ).toMatchObject({
      label: "Brand color",
      value: "#3366ff",
      placeholder: "#000000",
      colorSpace: "rgb",
      channel: "red",
      size: "lg",
      isRequired: true,
      labelPosition: "side",
      labelAlign: "end",
    });
  });

  it("groups Form PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Form",
      contracts: formPrimitiveBinding.props.accepts,
      theme: {
        sizes: { Form: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Appearance",
      "Submission",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "size",
      "variant",
      "labelPosition",
      "labelAlign",
      "necessityIndicator",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "action",
      "method",
      "encType",
      "target",
      "validationBehavior",
    ]);
  });

  it("projects Form canonical props through the catalog boundary", () => {
    expect(
      toFormRacProps({
        action: "/api/signup",
        method: "post",
        encType: "multipart/form-data",
        target: "_blank",
        validationBehavior: "aria",
        labelPosition: "side",
        labelAlign: "end",
        necessityIndicator: "label",
        size: "lg",
        variant: "outlined",
        autoFocus: true,
        restoreFocus: true,
      }),
    ).toMatchObject({
      action: "/api/signup",
      method: "post",
      encType: "multipart/form-data",
      target: "_blank",
      validationBehavior: "aria",
      labelPosition: "side",
      labelAlign: "end",
      necessityIndicator: "label",
      size: "lg",
      variant: "outlined",
      autoFocus: true,
      restoreFocus: true,
    });
  });

  it("groups FileTrigger PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "FileTrigger",
      contracts: fileTriggerPrimitiveBinding.props.accepts,
    });

    expect(sections.map((section) => section.title)).toEqual(["File", "State"]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "acceptedFileTypes",
      "defaultCamera",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "allowsMultiple",
      "acceptDirectory",
    ]);
  });

  it("projects FileTrigger canonical props through the catalog boundary", () => {
    expect(
      toFileTriggerRacProps({
        acceptedFileTypes: ["image/png", "image/jpeg", 12],
        allowsMultiple: true,
        acceptDirectory: true,
        defaultCamera: "environment",
      }),
    ).toEqual({
      acceptedFileTypes: ["image/png", "image/jpeg"],
      allowsMultiple: true,
      acceptDirectory: true,
      defaultCamera: "environment",
    });
  });

  it("groups Switch PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Switch",
      contracts: switchPrimitiveBinding.props.accepts,
      theme: {
        sizes: { Switch: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["children"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "isEmphasized",
      "size",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "isSelected",
      "isDisabled",
      "isReadOnly",
      "isLoading",
    ]);
  });

  it("projects Switch canonical props through the catalog boundary", () => {
    expect(
      toSwitchRacProps({
        children: "Notifications",
        size: "lg",
        isEmphasized: true,
        isSelected: true,
        isDisabled: false,
        isReadOnly: true,
        value: "notifications",
      }),
    ).toMatchObject({
      children: "Notifications",
      size: "lg",
      isEmphasized: true,
      isSelected: true,
      isDisabled: false,
      isReadOnly: true,
      value: "notifications",
    });
  });

  it("groups Checkbox PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Checkbox",
      contracts: checkboxPrimitiveBinding.props.accepts,
      theme: {
        sizes: { Checkbox: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["children"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "isEmphasized",
      "size",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "isSelected",
      "isIndeterminate",
      "isRequired",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
      "isLoading",
    ]);
  });

  it("projects Checkbox canonical props through the catalog boundary", () => {
    expect(
      toCheckboxRacProps({
        children: "Remember me",
        size: "lg",
        isEmphasized: true,
        isSelected: true,
        isIndeterminate: false,
        isRequired: true,
        isInvalid: true,
        isDisabled: false,
        isReadOnly: true,
        value: "remember",
      }),
    ).toMatchObject({
      children: "Remember me",
      size: "lg",
      isEmphasized: true,
      isSelected: true,
      isIndeterminate: false,
      isRequired: true,
      isInvalid: true,
      isDisabled: false,
      isReadOnly: true,
      value: "remember",
    });
  });

  it("groups CheckboxGroup PropContract entries by section", () => {
    const binding = getPrimitiveBinding("CheckboxGroup");
    expect(binding).toBeDefined();
    if (!binding) return;

    const sections = buildInspectorFieldSections({
      componentType: "CheckboxGroup",
      contracts: binding.props.accepts,
      theme: {
        sizes: { CheckboxGroup: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "description",
      "errorMessage",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "isEmphasized",
      "size",
      "orientation",
      "labelPosition",
      "labelAlign",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "necessityIndicator",
      "isRequired",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
    ]);
  });

  it("projects CheckboxGroup canonical props through the catalog boundary", () => {
    const binding = getPrimitiveBinding("CheckboxGroup");
    expect(binding).toBeDefined();
    if (!binding) return;

    expect(
      binding.toRacProps({
        label: "Preferences",
        description: "Choose all that apply",
        errorMessage: "Pick at least one",
        value: ["email", 42],
        defaultValue: ["sms"],
        size: "lg",
        orientation: "horizontal",
        labelPosition: "side",
        labelAlign: "end",
        necessityIndicator: "label",
        isEmphasized: true,
        isRequired: true,
        isInvalid: true,
        isDisabled: false,
        isReadOnly: true,
        name: "preferences",
        form: "settings",
      }),
    ).toMatchObject({
      label: "Preferences",
      description: "Choose all that apply",
      errorMessage: "Pick at least one",
      value: ["email", "42"],
      defaultValue: ["sms"],
      size: "lg",
      orientation: "horizontal",
      labelPosition: "side",
      labelAlign: "end",
      necessityIndicator: "label",
      isEmphasized: true,
      isRequired: true,
      isInvalid: true,
      isDisabled: false,
      isReadOnly: true,
      name: "preferences",
      form: "settings",
    });
  });

  it("groups Radio PropContract entries by section", () => {
    const binding = getPrimitiveBinding("Radio");
    expect(binding).toBeDefined();
    if (!binding) return;

    const sections = buildInspectorFieldSections({
      componentType: "Radio",
      contracts: binding.props.accepts,
      theme: {
        sizes: { Radio: ["sm", "md", "lg", "xl"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "children",
      "value",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "isEmphasized",
      "size",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "isSelected",
      "isDisabled",
      "isReadOnly",
    ]);
  });

  it("projects Radio canonical props through the catalog boundary", () => {
    expect(
      toRadioRacProps({
        children: "Plan",
        value: "plan",
        variant: "negative",
        size: "xl",
        isSelected: true,
        isDisabled: false,
        isReadOnly: true,
        isEmphasized: true,
      }),
    ).toMatchObject({
      children: "Plan",
      value: "plan",
      variant: "negative",
      size: "xl",
      isSelected: true,
      isDisabled: false,
      isReadOnly: true,
      isEmphasized: true,
    });
  });

  it("groups RadioGroup PropContract entries by section", () => {
    const binding = getPrimitiveBinding("RadioGroup");
    expect(binding).toBeDefined();
    if (!binding) return;

    const sections = buildInspectorFieldSections({
      componentType: "RadioGroup",
      contracts: binding.props.accepts,
      theme: {
        sizes: { RadioGroup: ["sm", "md", "lg", "xl"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "description",
      "errorMessage",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "isEmphasized",
      "size",
      "orientation",
      "labelPosition",
      "labelAlign",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "necessityIndicator",
      "isRequired",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
    ]);
  });

  it("projects RadioGroup canonical props through the catalog boundary", () => {
    const binding = getPrimitiveBinding("RadioGroup");
    expect(binding).toBeDefined();
    if (!binding) return;

    expect(
      binding.toRacProps({
        label: "Plan",
        description: "Choose one",
        errorMessage: "Pick one",
        value: "team",
        defaultValue: "solo",
        variant: "accent",
        size: "xl",
        orientation: "horizontal",
        labelPosition: "side",
        labelAlign: "end",
        necessityIndicator: "label",
        isEmphasized: true,
        isRequired: true,
        isInvalid: true,
        isDisabled: false,
        isReadOnly: true,
        name: "plan",
        form: "settings",
      }),
    ).toMatchObject({
      label: "Plan",
      description: "Choose one",
      errorMessage: "Pick one",
      value: "team",
      defaultValue: "solo",
      variant: "accent",
      size: "xl",
      orientation: "horizontal",
      labelPosition: "side",
      labelAlign: "end",
      necessityIndicator: "label",
      isEmphasized: true,
      isRequired: true,
      isInvalid: true,
      isDisabled: false,
      isReadOnly: true,
      name: "plan",
      form: "settings",
    });
  });

  it("groups Slider PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Slider",
      contracts: sliderPrimitiveBinding.props.accepts,
      theme: {
        sizes: { Slider: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Locale",
      "Range",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "value",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "size",
      "orientation",
      "isEmphasized",
      "showValueLabel",
    ]);
    expect(sections[3].fields.map((field) => field.key)).toEqual([
      "minValue",
      "maxValue",
      "step",
    ]);
  });

  it("projects Slider canonical props through the catalog boundary", () => {
    expect(
      toSliderRacProps({
        label: "Volume",
        value: "75",
        minValue: 0,
        maxValue: 100,
        step: 5,
        size: "lg",
        orientation: "horizontal",
        isEmphasized: true,
        showValueLabel: true,
        locale: "ko-KR",
      }),
    ).toMatchObject({
      label: "Volume",
      value: 75,
      minValue: 0,
      maxValue: 100,
      step: 5,
      size: "lg",
      orientation: "horizontal",
      isEmphasized: true,
      showValueLabel: true,
      locale: "ko-KR",
    });
  });

  it("groups ListBox PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "ListBox",
      contracts: listBoxPrimitiveBinding.props.accepts,
      theme: {
        variants: { ListBox: ["default", "accent"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Filtering",
      "Performance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["items"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "orientation",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "filterText",
      "filterFields",
    ]);
    expect(sections[3].fields.map((field) => field.key)).toEqual([
      "enableVirtualization",
      "height",
      "overscan",
    ]);
    expect(sections[4].fields.map((field) => field.key)).toEqual([
      "selectionMode",
      "selectionBehavior",
      "disallowEmptySelection",
      "isDisabled",
      "autoFocus",
    ]);
  });

  it("projects ListBox canonical items through the catalog boundary", () => {
    expect(toListBoxRacProps({ variant: "primary" }).variant).toBe("primary");

    expect(
      toListBoxRacProps({
        variant: "accent",
        orientation: "horizontal",
        selectionMode: "multiple",
        selectionBehavior: "replace",
        selectedKey: "item-2",
        items: [
          {
            id: "item-1",
            label: "Aardvark",
            value: "aardvark",
            description: "A nocturnal burrowing mammal",
          },
          {
            id: "item-2",
            label: "Cat",
            value: "cat",
            isDisabled: true,
          },
          {
            id: "ignored",
            label: "",
          },
          42,
        ],
      }),
    ).toMatchObject({
      variant: "accent",
      orientation: "horizontal",
      selectionMode: "multiple",
      selectionBehavior: "replace",
      selectedKey: "item-2",
      items: [
        {
          id: "item-1",
          label: "Aardvark",
          value: "aardvark",
          description: "A nocturnal burrowing mammal",
        },
        {
          id: "item-2",
          label: "Cat",
          value: "cat",
          isDisabled: true,
        },
      ],
    });
  });

  it("groups GridList PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "GridList",
      contracts: gridListPrimitiveBinding.props.accepts,
      theme: {
        variants: { GridList: ["default", "accent"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Filtering",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["items"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "layout",
      "columns",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "filterText",
      "filterFields",
    ]);
    expect(sections[3].fields.map((field) => field.key)).toEqual([
      "selectionMode",
      "selectionBehavior",
      "disallowEmptySelection",
      "isDisabled",
      "autoFocus",
      "allowsDragging",
      "renderEmptyState",
    ]);
  });

  it("projects GridList canonical items through the catalog boundary", () => {
    expect(toGridListRacProps({ variant: "primary" }).variant).toBe("primary");

    expect(
      toGridListRacProps({
        variant: "accent",
        layout: "grid",
        columns: 3,
        selectionMode: "multiple",
        selectionBehavior: "replace",
        selectedKeys: ["trail"],
        items: [
          {
            id: "sunset",
            label: "Desert Sunset",
            textValue: "Desert Sunset",
            description: "PNG - 2/3/2024",
          },
          {
            id: "trail",
            label: "Hiking Trail",
            isDisabled: true,
          },
          {
            id: "ignored",
            label: "",
          },
          42,
        ],
      }),
    ).toMatchObject({
      variant: "accent",
      layout: "grid",
      columns: 3,
      selectionMode: "multiple",
      selectionBehavior: "replace",
      selectedKeys: ["trail"],
      items: [
        {
          id: "sunset",
          label: "Desert Sunset",
          textValue: "Desert Sunset",
          description: "PNG - 2/3/2024",
        },
        {
          id: "trail",
          label: "Hiking Trail",
          isDisabled: true,
        },
      ],
    });
  });

  it("groups TagGroup PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "TagGroup",
      contracts: tagGroupPrimitiveBinding.props.accepts,
      theme: {
        variants: { TagGroup: ["default", "accent", "neutral", "negative"] },
        sizes: { TagGroup: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "Filtering",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "items",
      "description",
      "errorMessage",
      "contextualHelp",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "size",
      "labelPosition",
      "labelAlign",
      "maxRows",
      "isEmphasized",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "filterText",
      "filterFields",
    ]);
    expect(sections[3].fields.map((field) => field.key)).toEqual([
      "selectionMode",
      "selectionBehavior",
      "disallowEmptySelection",
      "isDisabled",
      "isReadOnly",
      "isInvalid",
      "allowsRemoving",
      "allowsCustomValue",
    ]);
  });

  it("projects TagGroup canonical items through the catalog boundary", () => {
    expect(
      toTagGroupRacProps({
        label: "Flavors",
        variant: "negative",
        size: "lg",
        selectionMode: "multiple",
        selectedKeys: ["mint"],
        items: [
          { id: "chocolate", label: "Chocolate" },
          { id: "mint", label: "Mint", allowsRemoving: true },
          { id: "ignored", label: "" },
          42,
        ],
      }),
    ).toMatchObject({
      label: "Flavors",
      variant: "negative",
      size: "lg",
      selectionMode: "multiple",
      selectedKeys: ["mint"],
      items: [
        { id: "chocolate", label: "Chocolate" },
        { id: "mint", label: "Mint", allowsRemoving: true },
      ],
    });
  });

  it("groups Menu PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Menu",
      contracts: menuPrimitiveBinding.props.accepts,
      theme: {
        variants: { Menu: ["primary", "secondary", "negative"] },
        sizes: { Menu: ["sm", "md", "lg", "xl"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "items",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "size",
      "align",
      "direction",
      "shouldFlip",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "selectionMode",
      "isQuiet",
      "isDisabled",
    ]);
  });

  it("projects Menu canonical items through the catalog boundary", () => {
    expect(
      toMenuRacProps({
        label: "Actions",
        variant: "negative",
        size: "lg",
        align: "end",
        direction: "top",
        selectionMode: "single",
        selectedKeys: ["copy"],
        items: [
          { id: "copy", label: "Copy", shortcut: "Cmd+C" },
          { id: "paste", label: "Paste", isDisabled: true },
          { id: "ignored", label: "" },
          42,
        ],
      }),
    ).toMatchObject({
      label: "Actions",
      variant: "negative",
      size: "lg",
      align: "end",
      direction: "top",
      selectionMode: "single",
      selectedKeys: ["copy"],
      items: [
        { id: "copy", label: "Copy", shortcut: "Cmd+C" },
        { id: "paste", label: "Paste", isDisabled: true },
      ],
    });
  });

  it("groups ComboBox PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "ComboBox",
      contracts: comboBoxPrimitiveBinding.props.accepts,
      theme: {
        sizes: { ComboBox: ["xs", "sm", "md", "lg", "xl"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "items",
      "description",
      "errorMessage",
      "placeholder",
      "contextualHelp",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "size",
      "iconName",
      "labelPosition",
      "isQuiet",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "selectedKey",
      "inputValue",
      "allowsCustomValue",
      "necessityIndicator",
      "isRequired",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
    ]);
  });

  it("projects ComboBox canonical items through the catalog boundary", () => {
    expect(
      toComboBoxRacProps({
        label: "Animals",
        placeholder: "Pick one",
        size: "lg",
        selectedKey: "cat",
        inputValue: "Cat",
        allowsCustomValue: true,
        items: [
          { id: "aardvark", label: "Aardvark", value: "aardvark" },
          { id: "cat", label: "Cat", value: "cat", isDisabled: true },
          { id: "ignored", label: "" },
          42,
        ],
      }),
    ).toMatchObject({
      label: "Animals",
      placeholder: "Pick one",
      size: "lg",
      selectedKey: "cat",
      inputValue: "Cat",
      allowsCustomValue: true,
      items: [
        { id: "aardvark", label: "Aardvark", value: "aardvark" },
        { id: "cat", label: "Cat", value: "cat", isDisabled: true },
      ],
    });
  });

  it("groups Select PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Select",
      contracts: selectPrimitiveBinding.props.accepts,
      theme: {
        sizes: { Select: ["xs", "sm", "md", "lg", "xl"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "label",
      "items",
      "description",
      "errorMessage",
      "placeholder",
      "contextualHelp",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "size",
      "iconName",
      "labelPosition",
      "labelAlign",
      "isQuiet",
      "align",
      "direction",
      "shouldFlip",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "selectedKey",
      "defaultSelectedKey",
      "disallowEmptySelection",
      "necessityIndicator",
      "isRequired",
      "isInvalid",
      "isDisabled",
      "isReadOnly",
    ]);
  });

  it("projects Select canonical items through the catalog boundary", () => {
    expect(
      toSelectRacProps({
        label: "Animals",
        placeholder: "Pick one",
        size: "lg",
        selectedKey: "cat",
        defaultSelectedKey: "aardvark",
        items: [
          { id: "aardvark", label: "Aardvark", value: "aardvark" },
          { id: "cat", label: "Cat", value: "cat", isDisabled: true },
          { id: "ignored", label: "" },
          42,
        ],
      }),
    ).toMatchObject({
      label: "Animals",
      placeholder: "Pick one",
      size: "lg",
      selectedKey: "cat",
      defaultSelectedKey: "aardvark",
      items: [
        { id: "aardvark", label: "Aardvark", value: "aardvark" },
        { id: "cat", label: "Cat", value: "cat", isDisabled: true },
      ],
    });
  });

  it("groups Tabs PropContract entries by section", () => {
    const binding = getPrimitiveBinding("Tabs");
    expect(binding).toBeDefined();

    const sections = buildInspectorFieldSections({
      componentType: "Tabs",
      contracts: binding?.props.accepts ?? {},
      theme: {
        sizes: { Tabs: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual([
      "items",
      "aria-label",
    ]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "density",
      "size",
      "orientation",
      "showIndicator",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "selectedKey",
      "defaultSelectedKey",
      "isDisabled",
      "keyboardActivation",
    ]);
  });

  it("projects Tabs canonical items through the catalog boundary", () => {
    const binding = getPrimitiveBinding("Tabs");
    const racProps = binding?.toRacProps({
      items: [
        { id: "overview", label: "Overview", content: "Overview content" },
        { id: "details", label: "Details", content: "Details content" },
        { id: "ignored", label: "" },
        42,
      ],
      selectedKey: "details",
      defaultSelectedKey: "overview",
      size: "lg",
      orientation: "vertical",
      showIndicator: false,
      keyboardActivation: "manual",
    });

    expect(racProps).toMatchObject({
      selectedKey: "details",
      defaultSelectedKey: "overview",
      size: "lg",
      orientation: "vertical",
      showIndicator: false,
      keyboardActivation: "manual",
      items: [
        { id: "overview", label: "Overview", content: "Overview content" },
        { id: "details", label: "Details", content: "Details content" },
      ],
    });
  });
});
