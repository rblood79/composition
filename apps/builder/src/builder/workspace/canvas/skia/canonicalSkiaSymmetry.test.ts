import { describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { resolveCanonicalDocument } from "../../../../resolvers/canonical";
import {
  BreadcrumbSpec,
  BreadcrumbsSpec,
  ButtonSpec,
  CheckboxGroupSpec,
  CheckboxSpec,
  ColorFieldSpec,
  ComboBoxSpec,
  DateFieldSpec,
  DialogSpec,
  DropZoneSpec,
  FileTriggerSpec,
  FormSpec,
  GridListSpec,
  LinkSpec,
  ListBoxSpec,
  MenuSpec,
  NumberFieldSpec,
  PopoverSpec,
  RadioGroupSpec,
  RadioSpec,
  SearchFieldSpec,
  SelectSpec,
  SeparatorSpec,
  SliderSpec,
  SwitchSpec,
  TableSpec,
  TableViewSpec,
  TabsSpec,
  TagGroupSpec,
  TextFieldSpec,
  TimeFieldSpec,
  TooltipSpec,
  ToggleButtonSpec,
  ToggleButtonGroupSpec,
  ToolbarSpec,
  TreeSpec,
} from "@composition/specs";
import {
  buildGenericResolvedSkiaNodeData,
  measureGenericResolvedSkiaFrameBudget,
} from "./buildSpecNodeData";
import type { SkiaNodeData } from "./nodeRendererTypes";

function makeButtonOrigin(): CanonicalNode {
  return {
    id: "save-button-origin",
    type: "Button",
    reusable: true,
    props: {
      children: "Save",
      variant: "accent",
      fillStyle: "fill",
      size: "md",
    },
  };
}

function makeDocumentWithRefs(refCount = 1): CompositionDocument {
  const refs: CanonicalNode[] = Array.from({ length: refCount }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      id: `button-ref-${index}`,
      type: "ref",
      ref: "save-button-origin",
      props: {
        children: `Save ${index}`,
        style: {
          width: 120,
          height: 36,
          transform: `translate(${col * 132}px, ${row * 48}px)`,
        },
      },
    } as CanonicalNode;
  });

  return {
    version: "composition-1.0",
    children: [
      makeButtonOrigin(),
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "page", pageId: "page-1" },
        props: {
          style: { width: 800, height: 2400, backgroundColor: "#ffffff" },
        },
        children: refs,
      },
    ],
  };
}

function collectText(node: SkiaNodeData | null | undefined): string[] {
  if (!node) return [];
  return [
    ...(node.text?.content ? [node.text.content] : []),
    ...(node.children ?? []).flatMap((child) => collectText(child)),
  ];
}

function collectNodeTypes(node: SkiaNodeData | null | undefined): string[] {
  if (!node) return [];
  return [
    node.type,
    ...(node.children ?? []).flatMap((child) => collectNodeTypes(child)),
  ];
}

describe("ADR-142 canonicalSkiaSymmetry proof slice", () => {
  it("renders a resolved Button ref through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ButtonSpec.render, "shapes");
    const [, page] = resolveCanonicalDocument(makeDocumentWithRefs(1));

    const node = buildGenericResolvedSkiaNodeData({
      node: page,
      theme: "light",
      layoutById: new Map([
        ["page-1", { x: 0, y: 0, width: 800, height: 600 }],
        ["button-ref-0", { x: 24, y: 24, width: 120, height: 36 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(collectText(node)).toContain("Save 0");
    expect(node?.children?.[0]?.elementId).toBe("button-ref-0");
    expect(node?.children?.[0]?.box?.fillColor).toBeDefined();
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a Button icon through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ButtonSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "button-icon-1",
        type: "Button",
        props: {
          children: "Create",
          iconName: "plus",
          iconPosition: "start",
          iconStrokeWidth: 1.5,
          size: "md",
        },
      },
      theme: "light",
      layout: { x: 24, y: 24, width: 140, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(collectText(node)).toContain("Create");
    expect(collectNodeTypes(node)).toContain("icon_path");
    expect(node?.children?.[0]?.elementId).toBe("button-icon-1:icon");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Separator through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(SeparatorSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "separator-1",
        type: "Separator",
        props: {
          orientation: "vertical",
          variant: "dashed",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 12, y: 16, width: 4, height: 80 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("line");
    expect(node?.elementId).toBe("separator-1");
    expect(node?.line?.x1).toBe(2);
    expect(node?.line?.y2).toBe(80);
    expect(node?.line?.strokeDasharray).toEqual([6, 4]);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Link through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(LinkSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "link-1",
        type: "Link",
        props: {
          children: "Open docs",
          variant: "secondary",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 160, height: 28 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("text");
    expect(node?.elementId).toBe("link-1");
    expect(node?.text?.content).toBe("Open docs");
    expect(node?.text?.decoration).toBe(1);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ToggleButton through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToggleButtonSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toggle-button-1",
        type: "ToggleButton",
        props: {
          children: "Pinned",
          isSelected: true,
          isEmphasized: true,
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 120, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toggle-button-1");
    expect(collectText(node)).toContain("Pinned");
    expect(node?.box?.fillColor).toBeDefined();
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Switch through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(SwitchSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "switch-1",
        type: "Switch",
        props: {
          children: "Notifications",
          isSelected: true,
          isEmphasized: true,
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 180, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("switch-1");
    expect(collectText(node)).toContain("Notifications");
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Checkbox through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(CheckboxSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "checkbox-1",
        type: "Checkbox",
        props: {
          children: "Remember me",
          isSelected: true,
          isEmphasized: true,
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 180, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("checkbox-1");
    expect(collectText(node)).toContain("Remember me");
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved CheckboxGroup label and children through the generic Skia path without render.shapes", () => {
    const renderCheckboxGroupShapes = vi.spyOn(
      CheckboxGroupSpec.render,
      "shapes",
    );
    const renderCheckboxShapes = vi.spyOn(CheckboxSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "checkbox-group-1",
        type: "CheckboxGroup",
        props: {
          label: "Preferences",
          size: "lg",
          orientation: "vertical",
        },
        children: [
          {
            id: "checkbox-email",
            type: "Checkbox",
            props: {
              children: "Email",
              value: "email",
              isSelected: true,
              size: "lg",
            },
          },
          {
            id: "checkbox-sms",
            type: "Checkbox",
            props: {
              children: "SMS",
              value: "sms",
              isSelected: false,
              size: "lg",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["checkbox-group-1", { x: 24, y: 32, width: 240, height: 108 }],
        ["checkbox-email", { x: 24, y: 60, width: 180, height: 28 }],
        ["checkbox-sms", { x: 24, y: 92, width: 180, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("checkbox-group-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Preferences", "Email", "SMS"]),
    );
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "checkbox-group-1:label",
      "checkbox-email",
      "checkbox-sms",
    ]);
    expect(renderCheckboxGroupShapes).not.toHaveBeenCalled();
    expect(renderCheckboxShapes).not.toHaveBeenCalled();
    renderCheckboxGroupShapes.mockRestore();
    renderCheckboxShapes.mockRestore();
  });

  it("renders a resolved Radio through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(RadioSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "radio-1",
        type: "Radio",
        props: {
          children: "Team",
          value: "team",
          isSelected: true,
          isEmphasized: true,
          size: "lg",
          variant: "negative",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 180, height: 36 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("radio-1");
    expect(collectText(node)).toContain("Team");
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ListBox items path without render.shapes", () => {
    const renderShapes = vi.spyOn(ListBoxSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "listbox-1",
        type: "ListBox",
        props: {
          variant: "accent",
          selectionMode: "single",
          selectedKey: "cat",
          items: [
            { id: "aardvark", label: "Aardvark", value: "aardvark" },
            { id: "cat", label: "Cat", value: "cat" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 112 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("listbox-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Aardvark", "Cat"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved GridList items path without render.shapes", () => {
    const renderShapes = vi.spyOn(GridListSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "gridlist-1",
        type: "GridList",
        props: {
          variant: "accent",
          layout: "grid",
          columns: 2,
          selectionMode: "multiple",
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
              textValue: "Hiking Trail",
              description: "JPEG - 1/10/2022",
            },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 320, height: 160 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("gridlist-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining([
        "Desert Sunset",
        "PNG - 2/3/2024",
        "Hiking Trail",
      ]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved TagGroup items path without render.shapes", () => {
    const renderShapes = vi.spyOn(TagGroupSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "tag-group-1",
        type: "TagGroup",
        props: {
          label: "Flavors",
          variant: "accent",
          size: "md",
          selectionMode: "multiple",
          selectedKeys: ["mint"],
          items: [
            { id: "chocolate", label: "Chocolate" },
            { id: "mint", label: "Mint" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 320, height: 96 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("tag-group-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Flavors", "Chocolate", "Mint"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Menu items path without render.shapes", () => {
    const renderShapes = vi.spyOn(MenuSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "menu-1",
        type: "Menu",
        props: {
          label: "Actions",
          children: "Actions",
          variant: "primary",
          size: "md",
          selectionMode: "single",
          selectedKeys: ["copy"],
          items: [
            { id: "copy", label: "Copy", shortcut: "Cmd+C" },
            { id: "paste", label: "Paste" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 128 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("menu-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Actions", "Copy", "Cmd+C", "Paste"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ComboBox items path without render.shapes", () => {
    const renderShapes = vi.spyOn(ComboBoxSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "combo-1",
        type: "ComboBox",
        props: {
          label: "Animals",
          placeholder: "Pick one",
          inputValue: "Cat",
          selectedKey: "cat",
          size: "md",
          items: [
            { id: "aardvark", label: "Aardvark", value: "aardvark" },
            { id: "cat", label: "Cat", value: "cat" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 280, height: 128 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("combo-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Animals", "Cat", "Aardvark"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Select items path without render.shapes", () => {
    const renderShapes = vi.spyOn(SelectSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "select-1",
        type: "Select",
        props: {
          label: "Animals",
          placeholder: "Pick one",
          selectedKey: "cat",
          size: "md",
          items: [
            { id: "aardvark", label: "Aardvark", value: "aardvark" },
            { id: "cat", label: "Cat", value: "cat" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 280, height: 128 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("select-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Animals", "Cat", "Aardvark"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Tabs items path without render.shapes", () => {
    const renderShapes = vi.spyOn(TabsSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "tabs-1",
        type: "Tabs",
        props: {
          "aria-label": "Sections",
          selectedKey: "details",
          size: "md",
          items: [
            { id: "overview", label: "Overview", content: "Overview content" },
            { id: "details", label: "Details", content: "Details content" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 320, height: 160 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("tabs-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Overview", "Details", "Details content"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Tree items path without render.shapes", () => {
    const renderShapes = vi.spyOn(TreeSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "tree-1",
        type: "Tree",
        props: {
          "aria-label": "Project tree",
          selectedKey: "weekly-report",
          expandedKeys: ["documents"],
          items: [
            {
              id: "documents",
              label: "Documents",
              children: [
                { id: "weekly-report", label: "Weekly Report" },
                { id: "project-plan", label: "Project Plan" },
              ],
            },
            { id: "photos", label: "Photos" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 280, height: 160 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("tree-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Documents", "Weekly Report", "Photos"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Table rows and columns path without render.shapes", () => {
    const renderShapes = vi.spyOn(TableSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "table-1",
        type: "Table",
        props: {
          "aria-label": "People",
          density: "regular",
          columns: [
            { id: "name", label: "Name", isRowHeader: true },
            { id: "role", label: "Role" },
          ],
          rows: [
            { id: "ada", name: "Ada Lovelace", role: "Engineer" },
            { id: "grace", name: "Grace Hopper", role: "Admiral" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 360, height: 160 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("table-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Name", "Role", "Ada Lovelace", "Engineer"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved TableView through the generic Table path without render.shapes", () => {
    const renderShapes = vi.spyOn(TableViewSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "table-view-1",
        type: "TableView",
        props: {
          "aria-label": "Table View",
          density: "compact",
          allowsSorting: true,
          columns: [
            { id: "name", label: "Name", isRowHeader: true },
            { id: "status", label: "Status" },
          ],
          rows: [
            { id: "design", name: "Design System", status: "Active" },
            { id: "runtime", name: "Runtime", status: "Ready" },
          ],
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 360, height: 144 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("table-view-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Design System", "Active", "Runtime"]),
    );
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved RadioGroup label and children through the generic Skia path without render.shapes", () => {
    const renderRadioGroupShapes = vi.spyOn(RadioGroupSpec.render, "shapes");
    const renderRadioShapes = vi.spyOn(RadioSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "radio-group-1",
        type: "RadioGroup",
        props: {
          label: "Plan",
          value: "team",
          size: "lg",
          orientation: "vertical",
        },
        children: [
          {
            id: "radio-team",
            type: "Radio",
            props: {
              children: "Team",
              value: "team",
              isSelected: true,
              size: "lg",
            },
          },
          {
            id: "radio-solo",
            type: "Radio",
            props: {
              children: "Solo",
              value: "solo",
              isSelected: false,
              size: "lg",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["radio-group-1", { x: 24, y: 32, width: 240, height: 108 }],
        ["radio-team", { x: 24, y: 60, width: 180, height: 28 }],
        ["radio-solo", { x: 24, y: 92, width: 180, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("radio-group-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Plan", "Team", "Solo"]),
    );
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "radio-group-1:label",
      "radio-team",
      "radio-solo",
    ]);
    expect(renderRadioGroupShapes).not.toHaveBeenCalled();
    expect(renderRadioShapes).not.toHaveBeenCalled();
    renderRadioGroupShapes.mockRestore();
    renderRadioShapes.mockRestore();
  });

  it("renders a resolved Slider through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(SliderSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "slider-1",
        type: "Slider",
        props: {
          label: "Volume",
          value: 75,
          minValue: 0,
          maxValue: 100,
          step: 5,
          size: "lg",
          isEmphasized: true,
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 64 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("slider-1");
    expect(collectText(node)).toEqual(expect.arrayContaining(["Volume", "75"]));
    expect(collectNodeTypes(node)).toContain("box");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved TextField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(TextFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "textfield-1",
        type: "TextField",
        props: {
          label: "Email",
          value: "hello@example.com",
          placeholder: "name@example.com",
          type: "email",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 220, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("textfield-1");
    expect(collectText(node)).toContain("Email");
    expect(collectText(node)).toContain("hello@example.com");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved NumberField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(NumberFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "numberfield-1",
        type: "NumberField",
        props: {
          label: "Quantity",
          value: 42,
          minValue: 0,
          maxValue: 100,
          step: 2,
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 220, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("numberfield-1");
    expect(collectText(node)).toContain("Quantity");
    expect(collectText(node)).toContain("42");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved SearchField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(SearchFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "searchfield-1",
        type: "SearchField",
        props: {
          label: "Search docs",
          value: "adr",
          placeholder: "Search...",
          type: "search",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("searchfield-1");
    expect(collectText(node)).toContain("Search docs");
    expect(collectText(node)).toContain("adr");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved DateField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(DateFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "datefield-1",
        type: "DateField",
        props: {
          label: "Start date",
          value: "2026-05-20",
          placeholderValue: "2026-01-01",
          granularity: "day",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("datefield-1");
    expect(collectText(node)).toContain("Start date");
    expect(collectText(node)).toContain("2026-05-20");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved TimeField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(TimeFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "timefield-1",
        type: "TimeField",
        props: {
          label: "Start time",
          value: "09:30",
          placeholderValue: "09:00",
          granularity: "minute",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 240, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("timefield-1");
    expect(collectText(node)).toContain("Start time");
    expect(collectText(node)).toContain("09:30");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ColorField through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ColorFieldSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "colorfield-1",
        type: "ColorField",
        props: {
          label: "Brand color",
          value: "#3366ff",
          placeholder: "#000000",
          colorSpace: "rgb",
          channel: "red",
          size: "lg",
        },
      },
      theme: "light",
      layout: { x: 24, y: 32, width: 220, height: 72 },
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("colorfield-1");
    expect(collectText(node)).toContain("Brand color");
    expect(collectText(node)).toContain("#3366ff");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Form and children through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(FormSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "form-1",
        type: "Form",
        props: {
          labelPosition: "side",
          size: "lg",
        },
        children: [
          {
            id: "form-email",
            type: "TextField",
            props: {
              label: "Email",
              value: "hello@example.com",
              type: "email",
            },
          },
          {
            id: "form-submit",
            type: "Button",
            props: {
              children: "Submit",
              type: "submit",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["form-1", { x: 24, y: 32, width: 320, height: 160 }],
        ["form-email", { x: 40, y: 48, width: 240, height: 72 }],
        ["form-submit", { x: 40, y: 128, width: 120, height: 36 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("form-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Email", "hello@example.com", "Submit"]),
    );
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved FileTrigger and trigger child through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(FileTriggerSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "file-trigger-1",
        type: "FileTrigger",
        props: {
          acceptedFileTypes: ["image/png", "image/jpeg"],
          allowsMultiple: true,
        },
        children: [
          {
            id: "file-trigger-button",
            type: "Button",
            props: {
              children: "Upload",
              variant: "primary",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["file-trigger-1", { x: 24, y: 32, width: 160, height: 48 }],
        ["file-trigger-button", { x: 24, y: 32, width: 120, height: 36 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("file-trigger-1");
    expect(collectText(node)).toContain("Upload");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved DropZone through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(DropZoneSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "drop-zone-1",
        type: "DropZone",
        props: {
          label: "Drop source files",
          description: "PNG, SVG, or PDF",
          size: "lg",
          isDropTarget: true,
        },
      },
      theme: "light",
      layoutById: new Map([
        ["drop-zone-1", { x: 24, y: 32, width: 280, height: 160 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("drop-zone-1");
    expect(collectText(node)).toEqual(
      expect.arrayContaining(["Drop source files", "PNG, SVG, or PDF"]),
    );
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Tooltip through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(TooltipSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "tooltip-1",
        type: "Tooltip",
        props: {
          children: "Helpful context",
          variant: "info",
          size: "lg",
          placement: "bottom",
          showArrow: true,
        },
      },
      theme: "light",
      layoutById: new Map([
        ["tooltip-1", { x: 24, y: 32, width: 180, height: 44 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("tooltip-1");
    expect(collectText(node)).toContain("Helpful context");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Dialog through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(DialogSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "dialog-1",
        type: "Dialog",
        props: {
          children: "Dialog body",
          size: "lg",
          role: "alertdialog",
          isDismissable: true,
        },
      },
      theme: "light",
      layoutById: new Map([
        ["dialog-1", { x: 24, y: 32, width: 280, height: 160 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("dialog-1");
    expect(collectText(node)).toContain("Dialog body");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Popover through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(PopoverSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "popover-1",
        type: "Popover",
        props: {
          children: "Popover body",
          variant: "accent",
          size: "lg",
          placement: "bottom",
          showArrow: true,
        },
      },
      theme: "light",
      layoutById: new Map([
        ["popover-1", { x: 24, y: 32, width: 280, height: 140 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("popover-1");
    expect(collectText(node)).toContain("Popover body");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved ToggleButtonGroup shell and children through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToggleButtonGroupSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toggle-group-1",
        type: "ToggleButtonGroup",
        props: {
          orientation: "horizontal",
          selectionMode: "multiple",
          size: "lg",
        },
        children: [
          {
            id: "toggle-child-1",
            type: "ToggleButton",
            props: {
              children: "Grid",
              isSelected: true,
              size: "lg",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["toggle-group-1", { x: 20, y: 24, width: 220, height: 40 }],
        ["toggle-child-1", { x: 20, y: 24, width: 100, height: 40 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toggle-group-1");
    expect(collectText(node)).toContain("Grid");
    expect(node?.children?.[0]?.elementId).toBe("toggle-child-1");
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders a resolved Toolbar shell and children through the generic Skia path without render.shapes", () => {
    const renderShapes = vi.spyOn(ToolbarSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "toolbar-1",
        type: "Toolbar",
        props: {
          "aria-label": "Actions",
          orientation: "horizontal",
        },
        children: [
          {
            id: "toolbar-button-1",
            type: "Button",
            props: {
              children: "Add",
              variant: "secondary",
              size: "sm",
            },
          },
          {
            id: "toolbar-separator-1",
            type: "Separator",
            props: {
              orientation: "vertical",
              size: "sm",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["toolbar-1", { x: 20, y: 24, width: 260, height: 44 }],
        ["toolbar-button-1", { x: 28, y: 28, width: 72, height: 32 }],
        ["toolbar-separator-1", { x: 110, y: 30, width: 1, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("toolbar-1");
    expect(collectText(node)).toContain("Add");
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "toolbar-button-1",
      "toolbar-separator-1",
    ]);
    expect(renderShapes).not.toHaveBeenCalled();
    renderShapes.mockRestore();
  });

  it("renders resolved Breadcrumbs and Breadcrumb children through the generic Skia path without render.shapes", () => {
    const renderBreadcrumbsShapes = vi.spyOn(BreadcrumbsSpec.render, "shapes");
    const renderBreadcrumbShapes = vi.spyOn(BreadcrumbSpec.render, "shapes");
    const node = buildGenericResolvedSkiaNodeData({
      node: {
        id: "breadcrumbs-1",
        type: "Breadcrumbs",
        props: {
          "aria-label": "Trail",
          size: "L",
        },
        children: [
          {
            id: "breadcrumb-1",
            type: "Breadcrumb",
            props: {
              children: "Home",
              href: "/",
              size: "L",
            },
          },
          {
            id: "breadcrumb-2",
            type: "Breadcrumb",
            props: {
              children: "Docs",
              href: "/docs",
              size: "L",
            },
          },
        ],
      },
      theme: "light",
      layoutById: new Map([
        ["breadcrumbs-1", { x: 20, y: 24, width: 240, height: 28 }],
        ["breadcrumb-1", { x: 20, y: 24, width: 72, height: 28 }],
        ["breadcrumb-2", { x: 104, y: 24, width: 72, height: 28 }],
      ]),
    });

    expect(node).not.toBeNull();
    expect(node?.type).toBe("container");
    expect(node?.elementId).toBe("breadcrumbs-1");
    expect(collectText(node)).toEqual(expect.arrayContaining(["Home", "Docs"]));
    expect(node?.children?.map((child) => child.elementId)).toEqual([
      "breadcrumb-1",
      "breadcrumb-2",
    ]);
    expect(renderBreadcrumbsShapes).not.toHaveBeenCalled();
    expect(renderBreadcrumbShapes).not.toHaveBeenCalled();
    renderBreadcrumbsShapes.mockRestore();
    renderBreadcrumbShapes.mockRestore();
  });

  it("measures 200+ resolved Button refs under the 60fps frame budget", () => {
    const refCount = 205;
    const [, page] = resolveCanonicalDocument(makeDocumentWithRefs(refCount));
    const layoutById = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >([["page-1", { x: 0, y: 0, width: 800, height: 2400 }]]);

    for (let index = 0; index < refCount; index += 1) {
      const row = Math.floor(index / 5);
      const col = index % 5;
      layoutById.set(`button-ref-${index}`, {
        x: 24 + col * 132,
        y: 24 + row * 48,
        width: 120,
        height: 36,
      });
    }

    const result = measureGenericResolvedSkiaFrameBudget({
      node: page,
      theme: "light",
      layoutById,
    });

    expect(result.nodeCount).toBeGreaterThanOrEqual(206);
    expect(result.estimatedFps).toBeGreaterThanOrEqual(60);
    expect(result.durationMs).toBeLessThanOrEqual(16.67);
  });
});
