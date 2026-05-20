import { describe, expect, it } from "vitest";

import { breadcrumbPrimitiveBinding } from "../primitives/breadcrumb";
import { breadcrumbsPrimitiveBinding } from "../primitives/breadcrumbs";
import { buttonPrimitiveBinding } from "../primitives/button";
import { checkboxPrimitiveBinding } from "../primitives/checkbox";
import { colorFieldPrimitiveBinding } from "../primitives/colorField";
import { comboBoxPrimitiveBinding } from "../primitives/comboBox";
import { dateFieldPrimitiveBinding } from "../primitives/dateField";
import { dialogPrimitiveBinding } from "../primitives/dialog";
import { dropZonePrimitiveBinding } from "../primitives/dropZone";
import { fileTriggerPrimitiveBinding } from "../primitives/fileTrigger";
import { formPrimitiveBinding } from "../primitives/form";
import { gridListPrimitiveBinding } from "../primitives/gridList";
import { listBoxPrimitiveBinding } from "../primitives/listBox";
import { menuPrimitiveBinding } from "../primitives/menu";
import { modalPrimitiveBinding } from "../primitives/modal";
import { numberFieldPrimitiveBinding } from "../primitives/numberField";
import { popoverPrimitiveBinding } from "../primitives/popover";
import { searchFieldPrimitiveBinding } from "../primitives/searchField";
import { selectPrimitiveBinding } from "../primitives/select";
import { sliderPrimitiveBinding } from "../primitives/slider";
import { switchPrimitiveBinding } from "../primitives/switch";
import { tagGroupPrimitiveBinding } from "../primitives/tagGroup";
import { textFieldPrimitiveBinding } from "../primitives/textField";
import { timeFieldPrimitiveBinding } from "../primitives/timeField";
import { tooltipPrimitiveBinding } from "../primitives/tooltip";
import { toolbarPrimitiveBinding } from "../primitives/toolbar";
import { toastPrimitiveBinding } from "../primitives/toast";
import { toggleButtonGroupPrimitiveBinding } from "../primitives/toggleButtonGroup";
import {
  componentCatalog,
  getComponentCatalogEntry,
  getReusableCatalogDocument,
  getReusableCatalogPropsSchema,
  getReusableCatalogRoot,
  listPlaceableCatalogEntries,
} from "../componentCatalog";

describe("ADR-142 component catalog", () => {
  it("registers primitive entries with their PrimitiveBinding", () => {
    const entry = getComponentCatalogEntry("Button");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(buttonPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Separator as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Separator");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Separator");
    expect(entry.binding.skiaPrimitive?.kind).toBe("separator");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Link as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Link");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Link");
    expect(entry.binding.skiaPrimitive?.kind).toBe("link");
    expect(entry.panel.category).toBe("layout");
  });

  it("registers ToggleButton as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ToggleButton");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ToggleButton");
    expect(entry.binding.skiaPrimitive?.kind).toBe("toggle-button");
    expect(entry.panel.category).toBe("buttons");
  });

  it("registers ToggleButtonGroup as an active primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("ToggleButtonGroup");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(toggleButtonGroupPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ToggleButtonGroup");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "ToggleButton",
      "ToggleButton",
    ]);
    expect(entry.panel.category).toBe("buttons");
  });

  it("registers Toolbar as an active primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("Toolbar");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(toolbarPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Toolbar");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Button",
      "Button",
      "Separator",
      "Button",
    ]);
    expect(entry.panel.category).toBe("buttons");
  });

  it("registers Breadcrumbs as an active primitive catalog entry with Breadcrumb child templates", () => {
    const breadcrumbEntry = getComponentCatalogEntry("Breadcrumb");
    const breadcrumbsEntry = getComponentCatalogEntry("Breadcrumbs");

    expect(breadcrumbEntry?.kind).toBe("primitive");
    if (breadcrumbEntry?.kind !== "primitive") return;
    expect(breadcrumbEntry.binding).toBe(breadcrumbPrimitiveBinding);
    expect(breadcrumbEntry.cutover).toBe("catalog");
    expect(breadcrumbEntry.panel.placeable).toBe(false);

    expect(breadcrumbsEntry?.kind).toBe("primitive");
    if (breadcrumbsEntry?.kind !== "primitive") return;
    expect(breadcrumbsEntry.binding).toBe(breadcrumbsPrimitiveBinding);
    expect(breadcrumbsEntry.family).toBe("primitives/actions");
    expect(breadcrumbsEntry.cutover).toBe("catalog");
    expect(breadcrumbsEntry.binding.runtime.exportName).toBe("Breadcrumbs");
    const placement = breadcrumbsEntry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Breadcrumb",
      "Breadcrumb",
      "Breadcrumb",
    ]);
    expect(breadcrumbsEntry.panel.category).toBe("layout");
  });

  it("registers TextField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("TextField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(textFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("TextField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("text-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers NumberField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("NumberField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(numberFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("NumberField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("number-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers SearchField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("SearchField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(searchFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("SearchField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("search-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers DateField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("DateField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(dateFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("DateField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("date-field");
    expect(entry.panel.category).toBe("dateTime");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers TimeField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("TimeField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(timeFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("TimeField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("time-field");
    expect(entry.panel.category).toBe("dateTime");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers ColorField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ColorField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(colorFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ColorField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("color-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Form as an active fields primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("Form");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(formPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Form");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "TextField",
      "TextField",
      "Button",
    ]);
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers FileTrigger as an active fields primitive catalog entry with a trigger child template", () => {
    const entry = getComponentCatalogEntry("FileTrigger");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(fileTriggerPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("FileTrigger");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual(["Button"]);
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("file trigger");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers DropZone as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("DropZone");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(dropZonePrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("DropZone");
    expect(entry.binding.skiaPrimitive?.kind).toBe("drop-zone");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("drop zone");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      label: "Drop files here",
      description: "Upload files by dropping them in this area.",
      size: "md",
      isDisabled: false,
    });
  });

  it("registers Tooltip as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Tooltip");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(tooltipPrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Tooltip");
    expect(entry.binding.skiaPrimitive?.kind).toBe("tooltip");
    expect(entry.panel.category).toBe("overlays");
    expect(entry.panel.label).toBe("tooltip");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      children: "Helpful tip",
      placement: "top",
      size: "md",
      showArrow: true,
    });
  });

  it("registers Dialog as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Dialog");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(dialogPrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Dialog");
    expect(entry.binding.skiaPrimitive?.kind).toBe("dialog");
    expect(entry.panel.category).toBe("overlays");
    expect(entry.panel.label).toBe("dialog");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      children: "Dialog content",
      role: "dialog",
      size: "md",
      isDismissable: false,
    });
  });

  it("registers Popover as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Popover");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(popoverPrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Popover");
    expect(entry.binding.skiaPrimitive?.kind).toBe("popover");
    expect(entry.panel.category).toBe("overlays");
    expect(entry.panel.label).toBe("popover");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      children: "Popover content",
      variant: "surface",
      placement: "bottom",
      size: "md",
      showArrow: true,
      isOpen: true,
    });
  });

  it("registers Modal as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Modal");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(modalPrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Modal");
    expect(entry.binding.skiaPrimitive?.kind).toBe("modal");
    expect(entry.panel.category).toBe("overlays");
    expect(entry.panel.label).toBe("modal");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      children: "Modal content",
      size: "md",
      trapFocus: true,
      autoFocus: true,
      restoreFocus: true,
      isOpen: true,
    });
  });

  it("registers Toast as an active overlays primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Toast");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(toastPrimitiveBinding);
    expect(entry.family).toBe("overlays");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("UNSTABLE_Toast");
    expect(entry.binding.skiaPrimitive?.kind).toBe("toast");
    expect(entry.panel.category).toBe("overlays");
    expect(entry.panel.label).toBe("toast");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps).toMatchObject({
      defaultTitle: "Notification",
      defaultDescription: "Toast message content.",
      variant: "info",
      size: "md",
      position: "bottom",
      timeout: 5000,
    });
  });

  it("registers Switch as an active selection primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Switch");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(switchPrimitiveBinding);
    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Switch");
    expect(entry.binding.skiaPrimitive?.kind).toBe("switch");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("switch");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Checkbox as an active selection primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Checkbox");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(checkboxPrimitiveBinding);
    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Checkbox");
    expect(entry.binding.skiaPrimitive?.kind).toBe("checkbox");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("checkbox");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers CheckboxGroup as an active selection primitive catalog entry with Checkbox child templates", () => {
    const entry = getComponentCatalogEntry("CheckboxGroup");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("CheckboxGroup");
    expect(entry.binding.skiaPrimitive?.kind).toBe("checkbox-group");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Checkbox",
      "Checkbox",
    ]);
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("checkbox group");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Radio as an active non-placeable selection primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Radio");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Radio");
    expect(entry.binding.skiaPrimitive?.kind).toBe("radio");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("radio");
    expect(entry.panel.placeable).toBe(false);
  });

  it("registers RadioGroup as an active selection primitive catalog entry with Radio child templates", () => {
    const entry = getComponentCatalogEntry("RadioGroup");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("RadioGroup");
    expect(entry.binding.skiaPrimitive?.kind).toBe("radio-group");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Radio",
      "Radio",
    ]);
    expect(placement.children[0]?.props).toMatchObject({
      children: "Option 1",
      value: "option-1",
      isSelected: true,
    });
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("radio group");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Slider as an active selection primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Slider");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(sliderPrimitiveBinding);
    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Slider");
    expect(entry.binding.skiaPrimitive?.kind).toBe("slider");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("slider");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers ListBox as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ListBox");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(listBoxPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ListBox");
    expect(entry.binding.skiaPrimitive?.kind).toBe("list-box");
    expect(entry.panel.category).toBe("collections");
    expect(entry.panel.label).toBe("list box");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Kangaroo", value: "kangaroo" },
    ]);
  });

  it("registers GridList as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("GridList");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(gridListPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("GridList");
    expect(entry.binding.skiaPrimitive?.kind).toBe("grid-list");
    expect(entry.panel.category).toBe("collections");
    expect(entry.panel.label).toBe("grid list");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      {
        id: "item-1",
        label: "Desert Sunset",
        textValue: "Desert Sunset",
        description: "PNG - 2/3/2024",
      },
      {
        id: "item-2",
        label: "Hiking Trail",
        textValue: "Hiking Trail",
        description: "JPEG - 1/10/2022",
      },
      {
        id: "item-3",
        label: "Mountain Sunrise",
        textValue: "Mountain Sunrise",
        description: "PNG - 3/15/2015",
      },
    ]);
  });

  it("registers TagGroup as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("TagGroup");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(tagGroupPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("TagGroup");
    expect(entry.binding.skiaPrimitive?.kind).toBe("tag-group");
    expect(entry.panel.category).toBe("collections");
    expect(entry.panel.label).toBe("tag group");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      { id: "tag-1", label: "Chocolate" },
      { id: "tag-2", label: "Mint" },
      { id: "tag-3", label: "Strawberry" },
      { id: "tag-4", label: "Vanilla" },
    ]);
  });

  it("registers Menu as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Menu");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(menuPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Menu");
    expect(entry.binding.skiaPrimitive?.kind).toBe("menu");
    expect(entry.panel.category).toBe("buttons");
    expect(entry.panel.label).toBe("menu");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      { id: "item-1", label: "Menu Item 1" },
      { id: "item-2", label: "Menu Item 2" },
      { id: "item-3", label: "Menu Item 3" },
    ]);
  });

  it("registers ComboBox as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ComboBox");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(comboBoxPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ComboBox");
    expect(entry.binding.skiaPrimitive?.kind).toBe("combo-box");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("combo box");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Dog", value: "dog" },
      { id: "item-4", label: "Kangaroo", value: "kangaroo" },
    ]);
  });

  it("registers Select as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Select");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(selectPrimitiveBinding);
    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Select");
    expect(entry.binding.skiaPrimitive?.kind).toBe("select");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("select");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      { id: "item-1", label: "Aardvark", value: "aardvark" },
      { id: "item-2", label: "Cat", value: "cat" },
      { id: "item-3", label: "Dog", value: "dog" },
      { id: "item-4", label: "Kangaroo", value: "kangaroo" },
    ]);
  });

  it("registers Tabs as an active collections primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Tabs");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("collections");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Tabs");
    expect(entry.binding.skiaPrimitive?.kind).toBe("tabs");
    expect(entry.panel.category).toBe("collections");
    expect(entry.panel.label).toBe("tabs");
    expect(entry.panel.placeable).toBe(true);
    expect(entry.binding.defaultProps.items).toEqual([
      {
        id: "overview",
        label: "Overview",
        content: "Overview content",
      },
      {
        id: "details",
        label: "Details",
        content: "Details content",
      },
      {
        id: "settings",
        label: "Settings",
        content: "Settings content",
      },
    ]);
  });

  it("registers Tree/Table family as active RAC primitive catalog entries", () => {
    const tree = getComponentCatalogEntry("Tree");
    const table = getComponentCatalogEntry("Table");
    const tableView = getComponentCatalogEntry("TableView");

    expect(tree?.kind).toBe("primitive");
    expect(table?.kind).toBe("primitive");
    expect(tableView?.kind).toBe("primitive");
    if (
      tree?.kind !== "primitive" ||
      table?.kind !== "primitive" ||
      tableView?.kind !== "primitive"
    ) {
      return;
    }

    expect(tree.family).toBe("tree-table");
    expect(table.family).toBe("tree-table");
    expect(tableView.family).toBe("tree-table");
    expect(tree.cutover).toBe("catalog");
    expect(table.cutover).toBe("catalog");
    expect(tableView.cutover).toBe("catalog");
    expect(tree.binding.runtime.exportName).toBe("Tree");
    expect(table.binding.runtime.exportName).toBe("Table");
    expect(tableView.binding.runtime.exportName).toBe("Table");
    expect(tree.binding.skiaPrimitive?.kind).toBe("tree");
    expect(table.binding.skiaPrimitive?.kind).toBe("table");
    expect(tableView.binding.skiaPrimitive?.kind).toBe("table");
    expect(tree.panel.category).toBe("collections");
    expect(table.panel.category).toBe("collections");
    expect(tableView.panel.category).toBe("collections");
    expect(tree.panel.placeable).toBe(true);
    expect(table.panel.placeable).toBe(true);
    expect(tableView.panel.placeable).toBe(true);
  });

  it("registers reusable entries that resolve to reusable canonical documents", () => {
    const entry = getComponentCatalogEntry("Card");

    expect(entry?.kind).toBe("reusable");
    if (entry?.kind !== "reusable") return;

    const document = getReusableCatalogDocument(entry.reusableId);
    const root = getReusableCatalogRoot(entry.reusableId);
    const propsSchema = getReusableCatalogPropsSchema(entry.reusableId);

    expect(document?.children).toHaveLength(1);
    expect(root?.id).toBe(entry.reusableId);
    expect(root?.type).toBe("Card");
    expect(root?.reusable).toBe(true);
    expect(propsSchema?.title?.kind).toBe("string");
  });

  it("keeps family cutover states atomic", () => {
    const byFamily = new Map<string, Set<string>>();

    for (const entry of componentCatalog) {
      const states = byFamily.get(entry.family) ?? new Set<string>();
      states.add(entry.cutover);
      byFamily.set(entry.family, states);
    }

    expect(
      [...byFamily.entries()].filter(([, states]) => states.size > 1),
    ).toEqual([]);
  });

  it("excludes legacy entries from the active placeable catalog", () => {
    const activeTypes = listPlaceableCatalogEntries().map(
      (entry) => entry.type,
    );

    expect(activeTypes).toContain("Button");
    expect(activeTypes).toContain("Separator");
    expect(activeTypes).toContain("Link");
    expect(activeTypes).toContain("ToggleButton");
    expect(activeTypes).toContain("ToggleButtonGroup");
    expect(activeTypes).toContain("Toolbar");
    expect(activeTypes).toContain("Breadcrumbs");
    expect(activeTypes).toContain("TextField");
    expect(activeTypes).toContain("NumberField");
    expect(activeTypes).toContain("SearchField");
    expect(activeTypes).toContain("DateField");
    expect(activeTypes).toContain("TimeField");
    expect(activeTypes).toContain("ColorField");
    expect(activeTypes).toContain("Form");
    expect(activeTypes).toContain("FileTrigger");
    expect(activeTypes).toContain("DropZone");
    expect(activeTypes).toContain("Tooltip");
    expect(activeTypes).toContain("Dialog");
    expect(activeTypes).toContain("Popover");
    expect(activeTypes).toContain("Modal");
    expect(activeTypes).toContain("Switch");
    expect(activeTypes).toContain("Checkbox");
    expect(activeTypes).toContain("CheckboxGroup");
    expect(activeTypes).toContain("RadioGroup");
    expect(activeTypes).not.toContain("Radio");
    expect(activeTypes).toContain("Slider");
    expect(activeTypes).toContain("ListBox");
    expect(activeTypes).toContain("GridList");
    expect(activeTypes).toContain("TagGroup");
    expect(activeTypes).toContain("Menu");
    expect(activeTypes).toContain("ComboBox");
    expect(activeTypes).toContain("Select");
    expect(activeTypes).toContain("Tabs");
    expect(activeTypes).toContain("Tree");
    expect(activeTypes).toContain("Table");
    expect(activeTypes).toContain("TableView");
    expect(activeTypes).not.toContain("Breadcrumb");
    expect(activeTypes).not.toContain("Card");
  });
});
