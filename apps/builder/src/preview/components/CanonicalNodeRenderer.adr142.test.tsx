// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type {
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import type { RenderContext } from "../types";
import { CanonicalNodeRenderer } from "./CanonicalNodeRenderer";

const {
  legacyButtonRenderer,
  legacyBreadcrumbRenderer,
  legacyBreadcrumbsRenderer,
  legacyColorFieldRenderer,
  legacyCheckboxRenderer,
  legacyCheckboxGroupRenderer,
  legacyComboBoxRenderer,
  legacyDateFieldRenderer,
  legacyFileTriggerRenderer,
  legacyFormRenderer,
  legacyGridListRenderer,
  legacyLinkRenderer,
  legacyListBoxRenderer,
  legacyMenuRenderer,
  legacyNumberFieldRenderer,
  legacyRadioRenderer,
  legacyRadioGroupRenderer,
  legacySearchFieldRenderer,
  legacySelectRenderer,
  legacySeparatorRenderer,
  legacySliderRenderer,
  legacySwitchRenderer,
  legacyTagGroupRenderer,
  legacyTabsRenderer,
  legacyTextFieldRenderer,
  legacyTimeFieldRenderer,
  legacyToggleButtonRenderer,
  legacyToggleButtonGroupRenderer,
  legacyToolbarRenderer,
} = vi.hoisted(() => ({
  legacyButtonRenderer: vi.fn(() => (
    <button data-legacy-renderer="Button">legacy</button>
  )),
  legacyBreadcrumbRenderer: vi.fn(() => (
    <li data-legacy-renderer="Breadcrumb">legacy</li>
  )),
  legacyBreadcrumbsRenderer: vi.fn(() => (
    <nav data-legacy-renderer="Breadcrumbs">legacy</nav>
  )),
  legacyColorFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="ColorField">legacy</div>
  )),
  legacyCheckboxRenderer: vi.fn(() => (
    <label data-legacy-renderer="Checkbox">legacy</label>
  )),
  legacyCheckboxGroupRenderer: vi.fn(() => (
    <div data-legacy-renderer="CheckboxGroup">legacy</div>
  )),
  legacyComboBoxRenderer: vi.fn(() => (
    <div data-legacy-renderer="ComboBox">legacy</div>
  )),
  legacyDateFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="DateField">legacy</div>
  )),
  legacyFileTriggerRenderer: vi.fn(() => (
    <div data-legacy-renderer="FileTrigger">legacy</div>
  )),
  legacyFormRenderer: vi.fn(() => (
    <form data-legacy-renderer="Form">legacy</form>
  )),
  legacyGridListRenderer: vi.fn(() => (
    <div data-legacy-renderer="GridList">legacy</div>
  )),
  legacyLinkRenderer: vi.fn(() => <a data-legacy-renderer="Link">legacy</a>),
  legacyListBoxRenderer: vi.fn(() => (
    <div data-legacy-renderer="ListBox">legacy</div>
  )),
  legacyMenuRenderer: vi.fn(() => (
    <div data-legacy-renderer="Menu">legacy</div>
  )),
  legacyNumberFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="NumberField">legacy</div>
  )),
  legacyRadioRenderer: vi.fn(() => (
    <label data-legacy-renderer="Radio">legacy</label>
  )),
  legacyRadioGroupRenderer: vi.fn(() => (
    <div data-legacy-renderer="RadioGroup">legacy</div>
  )),
  legacySearchFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="SearchField">legacy</div>
  )),
  legacySelectRenderer: vi.fn(() => (
    <div data-legacy-renderer="Select">legacy</div>
  )),
  legacySeparatorRenderer: vi.fn(() => (
    <div data-legacy-renderer="Separator">legacy</div>
  )),
  legacySliderRenderer: vi.fn(() => (
    <div data-legacy-renderer="Slider">legacy</div>
  )),
  legacySwitchRenderer: vi.fn(() => (
    <label data-legacy-renderer="Switch">legacy</label>
  )),
  legacyTagGroupRenderer: vi.fn(() => (
    <div data-legacy-renderer="TagGroup">legacy</div>
  )),
  legacyTabsRenderer: vi.fn(() => (
    <div data-legacy-renderer="Tabs">legacy</div>
  )),
  legacyTextFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="TextField">legacy</div>
  )),
  legacyTimeFieldRenderer: vi.fn(() => (
    <div data-legacy-renderer="TimeField">legacy</div>
  )),
  legacyToggleButtonRenderer: vi.fn(() => (
    <button data-legacy-renderer="ToggleButton">legacy</button>
  )),
  legacyToggleButtonGroupRenderer: vi.fn(() => (
    <div data-legacy-renderer="ToggleButtonGroup">legacy</div>
  )),
  legacyToolbarRenderer: vi.fn(() => (
    <div data-legacy-renderer="Toolbar">legacy</div>
  )),
}));

vi.mock("@composition/shared/renderers", () => ({
  rendererMap: {
    Button: legacyButtonRenderer,
    Breadcrumb: legacyBreadcrumbRenderer,
    Breadcrumbs: legacyBreadcrumbsRenderer,
    Checkbox: legacyCheckboxRenderer,
    CheckboxGroup: legacyCheckboxGroupRenderer,
    ComboBox: legacyComboBoxRenderer,
    ColorField: legacyColorFieldRenderer,
    DateField: legacyDateFieldRenderer,
    FileTrigger: legacyFileTriggerRenderer,
    Form: legacyFormRenderer,
    GridList: legacyGridListRenderer,
    Link: legacyLinkRenderer,
    ListBox: legacyListBoxRenderer,
    Menu: legacyMenuRenderer,
    NumberField: legacyNumberFieldRenderer,
    Radio: legacyRadioRenderer,
    RadioGroup: legacyRadioGroupRenderer,
    SearchField: legacySearchFieldRenderer,
    Select: legacySelectRenderer,
    Separator: legacySeparatorRenderer,
    Slider: legacySliderRenderer,
    Switch: legacySwitchRenderer,
    TagGroup: legacyTagGroupRenderer,
    Tabs: legacyTabsRenderer,
    TextField: legacyTextFieldRenderer,
    TimeField: legacyTimeFieldRenderer,
    ToggleButton: legacyToggleButtonRenderer,
    ToggleButtonGroup: legacyToggleButtonGroupRenderer,
    Toolbar: legacyToolbarRenderer,
  },
}));

function makeRenderContext(): RenderContext {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: vi.fn(),
    batchUpdateElementProps: vi.fn(),
    setElements: vi.fn(),
    eventEngine: {} as RenderContext["eventEngine"],
    renderElement: vi.fn(),
  };
}

describe("CanonicalNodeRenderer ADR-142 primitive binding proof", () => {
  afterEach(() => {
    cleanup();
    legacyButtonRenderer.mockClear();
    legacyBreadcrumbRenderer.mockClear();
    legacyBreadcrumbsRenderer.mockClear();
    legacyCheckboxRenderer.mockClear();
    legacyCheckboxGroupRenderer.mockClear();
    legacyComboBoxRenderer.mockClear();
    legacyColorFieldRenderer.mockClear();
    legacyDateFieldRenderer.mockClear();
    legacyFileTriggerRenderer.mockClear();
    legacyFormRenderer.mockClear();
    legacyGridListRenderer.mockClear();
    legacyLinkRenderer.mockClear();
    legacyListBoxRenderer.mockClear();
    legacyMenuRenderer.mockClear();
    legacyNumberFieldRenderer.mockClear();
    legacyRadioRenderer.mockClear();
    legacyRadioGroupRenderer.mockClear();
    legacySearchFieldRenderer.mockClear();
    legacySelectRenderer.mockClear();
    legacySeparatorRenderer.mockClear();
    legacySliderRenderer.mockClear();
    legacySwitchRenderer.mockClear();
    legacyTagGroupRenderer.mockClear();
    legacyTabsRenderer.mockClear();
    legacyTextFieldRenderer.mockClear();
    legacyTimeFieldRenderer.mockClear();
    legacyToggleButtonRenderer.mockClear();
    legacyToggleButtonGroupRenderer.mockClear();
    legacyToolbarRenderer.mockClear();
  });

  it("renders Button through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "button-1",
      type: "Button",
      props: {
        children: "Save changes",
        variant: "accent",
        fillStyle: "outline",
        size: "sm",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button.dataset.variant).toBe("accent");
    expect(button.dataset.fillStyle).toBe("outline");
    expect(button.dataset.size).toBe("sm");
    expect(container.querySelector("[data-canonical-id='button-1']")).toBe(
      button,
    );
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders a resolved reusable Button ref through the same primitive branch", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "origin-button",
          type: "Button",
          reusable: true,
          props: {
            children: "Origin label",
            variant: "primary",
            size: "md",
          },
        },
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "page", pageId: "page-1" },
          props: { style: { width: 400, height: 200 } },
          children: [
            {
              id: "button-instance",
              type: "ref",
              ref: "origin-button",
              props: {
                children: "Instance label",
                variant: "negative",
              },
            } as RefNode,
          ],
        },
      ],
    };
    const [, page] = resolveCanonicalDocument(doc);

    render(
      <CanonicalNodeRenderer node={page} renderContext={makeRenderContext()} />,
    );

    const button = screen.getByRole("button", { name: "Instance label" });
    expect(button.dataset.canonicalId).toBe("button-instance");
    expect(button.dataset.variant).toBe("negative");
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders Separator through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "separator-1",
      type: "Separator",
      props: {
        orientation: "vertical",
        variant: "dashed",
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const separator = screen.getByRole("separator");
    expect(separator.dataset.orientation).toBe("vertical");
    expect(separator.dataset.variant).toBe("dashed");
    expect(separator.dataset.size).toBe("lg");
    expect(container.querySelector("[data-canonical-id='separator-1']")).toBe(
      separator,
    );
    expect(legacySeparatorRenderer).not.toHaveBeenCalled();
  });

  it("renders Link through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "link-1",
      type: "Link",
      props: {
        children: "Open docs",
        href: "https://example.com/docs",
        variant: "secondary",
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const link = screen.getByRole("link", { name: "Open docs" });
    expect(link.getAttribute("href")).toBe("https://example.com/docs");
    expect(link.dataset.variant).toBe("secondary");
    expect(link.dataset.size).toBe("lg");
    expect(container.querySelector("[data-canonical-id='link-1']")).toBe(link);
    expect(legacyLinkRenderer).not.toHaveBeenCalled();
  });

  it("renders ToggleButton through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toggle-button-1",
      type: "ToggleButton",
      props: {
        children: "Pinned",
        isSelected: true,
        isEmphasized: true,
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const toggle = screen.getByRole("button", { name: "Pinned" });
    expect(toggle.dataset.size).toBe("lg");
    expect(toggle.dataset.emphasized).toBe("true");
    expect(
      container.querySelector("[data-canonical-id='toggle-button-1']"),
    ).toBe(toggle);
    expect(legacyToggleButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders ToggleButtonGroup and children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toggle-group-1",
      type: "ToggleButtonGroup",
      props: {
        orientation: "vertical",
        selectionMode: "multiple",
        isEmphasized: true,
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const group = screen.getByRole("toolbar");
    const child = screen.getByRole("button", { name: "Grid" });
    expect(group.dataset.orientation).toBe("vertical");
    expect(group.dataset.size).toBe("lg");
    expect(
      container.querySelector("[data-canonical-id='toggle-group-1']"),
    ).toBe(group);
    expect(child.dataset.size).toBe("lg");
    expect(legacyToggleButtonGroupRenderer).not.toHaveBeenCalled();
    expect(legacyToggleButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders Toolbar and action children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toolbar-1",
      type: "Toolbar",
      props: {
        "aria-label": "Actions",
        orientation: "vertical",
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
            orientation: "horizontal",
            size: "sm",
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Actions" });
    const button = screen.getByRole("button", { name: "Add" });
    expect(toolbar.dataset.orientation).toBe("vertical");
    expect(container.querySelector("[data-canonical-id='toolbar-1']")).toBe(
      toolbar,
    );
    expect(button.dataset.size).toBe("sm");
    expect(legacyToolbarRenderer).not.toHaveBeenCalled();
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
    expect(legacySeparatorRenderer).not.toHaveBeenCalled();
  });

  it("renders Breadcrumbs and Breadcrumb children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
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
          },
        },
        {
          id: "breadcrumb-2",
          type: "Breadcrumb",
          props: {
            children: "Docs",
            href: "/docs",
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const navigation = screen.getByRole("list", { name: "Trail" });
    const docs = screen.getByRole("link", { name: "Docs" });
    expect(navigation.dataset.size).toBe("L");
    expect(container.querySelector("[data-canonical-id='breadcrumbs-1']")).toBe(
      navigation,
    );
    expect(docs.getAttribute("href")).toBe("/docs");
    expect(legacyBreadcrumbsRenderer).not.toHaveBeenCalled();
    expect(legacyBreadcrumbRenderer).not.toHaveBeenCalled();
  });

  it("renders TextField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "textfield-1",
      type: "TextField",
      props: {
        label: "Email",
        value: "hello@example.com",
        placeholder: "name@example.com",
        type: "email",
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const input = screen.getByRole("textbox", { name: /Email/ });
    expect((input as HTMLInputElement).value).toBe("hello@example.com");
    expect(input.getAttribute("type")).toBe("email");
    expect(container.querySelector("[data-canonical-id='textfield-1']")).toBe(
      container.querySelector(".react-aria-TextField"),
    );
    expect(legacyTextFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders NumberField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "numberfield-1",
      type: "NumberField",
      props: {
        label: "Quantity",
        value: 42,
        minValue: 0,
        maxValue: 100,
        step: 2,
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const input = screen.getByRole("textbox", { name: /Quantity/ });
    expect((input as HTMLInputElement).value).toBe("42");
    expect(input.getAttribute("aria-roledescription")).toBe("Number field");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(container.querySelector("[data-canonical-id='numberfield-1']")).toBe(
      container.querySelector(".react-aria-NumberField"),
    );
    expect(legacyNumberFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders SearchField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "searchfield-1",
      type: "SearchField",
      props: {
        label: "Search docs",
        value: "adr",
        placeholder: "Search...",
        type: "search",
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const input = screen.getByRole("searchbox", { name: /Search docs/ });
    expect((input as HTMLInputElement).value).toBe("adr");
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("placeholder")).toBe("Search...");
    expect(container.querySelector("[data-canonical-id='searchfield-1']")).toBe(
      container.querySelector(".react-aria-SearchField"),
    );
    expect(legacySearchFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders DateField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "datefield-1",
      type: "DateField",
      props: {
        label: "Start date",
        placeholderValue: "2026-01-01",
        granularity: "day",
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    expect(screen.getByText(/Start date/)).toBeTruthy();
    expect(container.querySelector("[data-canonical-id='datefield-1']")).toBe(
      container.querySelector(".react-aria-DateField"),
    );
    expect(legacyDateFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders TimeField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "timefield-1",
      type: "TimeField",
      props: {
        label: "Start time",
        placeholderValue: "09:00",
        granularity: "minute",
        hourCycle: 24,
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    expect(screen.getByText(/Start time/)).toBeTruthy();
    expect(container.querySelector("[data-canonical-id='timefield-1']")).toBe(
      container.querySelector(".react-aria-TimeField"),
    );
    expect(legacyTimeFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders ColorField through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "colorfield-1",
      type: "ColorField",
      props: {
        label: "Brand color",
        value: "#3366ff",
        placeholder: "#000000",
        colorSpace: "rgb",
        size: "lg",
        isRequired: true,
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const input = screen.getByRole("textbox", { name: /Brand color/ });
    expect((input as HTMLInputElement).value).toBe("#3366FF");
    expect(input.getAttribute("placeholder")).toBe("#000000");
    expect(container.querySelector("[data-canonical-id='colorfield-1']")).toBe(
      container.querySelector(".react-aria-ColorField"),
    );
    expect(legacyColorFieldRenderer).not.toHaveBeenCalled();
  });

  it("renders Form and children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "form-1",
      type: "Form",
      props: {
        action: "/api/signup",
        method: "post",
        validationBehavior: "aria",
        labelPosition: "side",
        labelAlign: "end",
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const form = container.querySelector("form.react-aria-Form");
    expect(form?.getAttribute("action")).toBe("/api/signup");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("data-size")).toBe("lg");
    expect(form?.getAttribute("data-label-position")).toBe("side");
    expect(form?.getAttribute("data-label-align")).toBe("end");
    expect(container.querySelector("[data-canonical-id='form-1']")).toBe(form);
    expect(screen.getByRole("textbox", { name: /Email/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(legacyFormRenderer).not.toHaveBeenCalled();
  });

  it("renders FileTrigger and trigger child through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "file-trigger-1",
      type: "FileTrigger",
      props: {
        acceptedFileTypes: ["image/png", "image/jpeg"],
        allowsMultiple: true,
        acceptDirectory: false,
        defaultCamera: "environment",
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    expect(
      container.querySelector("[data-canonical-id='file-trigger-1']"),
    ).toBeTruthy();
    expect(legacyFileTriggerRenderer).not.toHaveBeenCalled();
  });

  it("renders Switch through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "switch-1",
      type: "Switch",
      props: {
        children: "Notifications",
        isSelected: true,
        isEmphasized: true,
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const switchControl = screen.getByRole("switch", {
      name: "Notifications",
    });
    const switchRoot = container.querySelector(".react-aria-Switch");
    expect(switchRoot?.getAttribute("data-size")).toBe("lg");
    expect(switchRoot?.getAttribute("data-emphasized")).toBe("true");
    expect(container.querySelector("[data-canonical-id='switch-1']")).toBe(
      switchRoot,
    );
    expect(switchControl).toBeTruthy();
    expect(legacySwitchRenderer).not.toHaveBeenCalled();
  });

  it("renders Checkbox through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "checkbox-1",
      type: "Checkbox",
      props: {
        children: "Remember me",
        isSelected: true,
        isEmphasized: true,
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "Remember me",
    });
    const checkboxRoot = container.querySelector(".react-aria-Checkbox");
    expect(checkboxRoot?.getAttribute("data-size")).toBe("lg");
    expect(checkboxRoot?.getAttribute("data-emphasized")).toBe("true");
    expect(container.querySelector("[data-canonical-id='checkbox-1']")).toBe(
      checkboxRoot,
    );
    expect(checkbox).toBeTruthy();
    expect(legacyCheckboxRenderer).not.toHaveBeenCalled();
  });

  it("renders CheckboxGroup and children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "checkbox-group-1",
      type: "CheckboxGroup",
      props: {
        label: "Preferences",
        value: ["email"],
        isEmphasized: true,
        size: "lg",
      },
      children: [
        {
          id: "checkbox-email",
          type: "Checkbox",
          props: {
            children: "Email",
            value: "email",
            isSelected: true,
          },
        },
        {
          id: "checkbox-sms",
          type: "Checkbox",
          props: {
            children: "SMS",
            value: "sms",
            isSelected: false,
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const group = screen.getByRole("group", {
      name: "Preferences",
    });
    const checkboxGroupRoot = container.querySelector(
      ".react-aria-CheckboxGroup",
    );
    expect(checkboxGroupRoot?.getAttribute("data-checkbox-size")).toBe("lg");
    expect(checkboxGroupRoot?.getAttribute("data-emphasized")).toBe("true");
    expect(
      container.querySelector("[data-canonical-id='checkbox-group-1']"),
    ).toBe(checkboxGroupRoot);
    expect(group).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Email" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "SMS" })).toBeTruthy();
    expect(legacyCheckboxGroupRenderer).not.toHaveBeenCalled();
    expect(legacyCheckboxRenderer).not.toHaveBeenCalled();
  });

  it("keeps standalone Radio on rendererMap fallback outside RadioGroup context", () => {
    const node: ResolvedNode = {
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    expect(
      container.querySelector("[data-canonical-id='radio-1']"),
    ).toBeTruthy();
    expect(
      container.querySelector("[data-legacy-renderer='Radio']"),
    ).toBeTruthy();
    expect(legacyRadioRenderer).toHaveBeenCalledTimes(1);
  });

  it("renders RadioGroup and children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "radio-group-1",
      type: "RadioGroup",
      props: {
        label: "Plan",
        value: "team",
        isEmphasized: true,
        size: "lg",
      },
      children: [
        {
          id: "radio-team",
          type: "Radio",
          props: {
            children: "Team",
            value: "team",
            isSelected: true,
          },
        },
        {
          id: "radio-solo",
          type: "Radio",
          props: {
            children: "Solo",
            value: "solo",
            isSelected: false,
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const group = screen.getByRole("radiogroup", { name: "Plan" });
    const radioGroupRoot = container.querySelector(".react-aria-RadioGroup");
    expect(radioGroupRoot?.getAttribute("data-radio-size")).toBe("lg");
    expect(radioGroupRoot?.getAttribute("data-emphasized")).toBe("true");
    expect(container.querySelector("[data-canonical-id='radio-group-1']")).toBe(
      radioGroupRoot,
    );
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Team" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Solo" })).toBeTruthy();
    expect(legacyRadioGroupRenderer).not.toHaveBeenCalled();
    expect(legacyRadioRenderer).not.toHaveBeenCalled();
  });

  it("renders ListBox canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "listbox-1",
      type: "ListBox",
      props: {
        variant: "accent",
        orientation: "vertical",
        selectionMode: "single",
        selectedKey: "cat",
        items: [
          { id: "aardvark", label: "Aardvark", value: "aardvark" },
          { id: "cat", label: "Cat", value: "cat" },
        ],
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const listbox = screen.getByRole("listbox", { name: "List" });
    expect(listbox.getAttribute("data-variant")).toBe("accent");
    expect(listbox.getAttribute("data-orientation")).toBe("vertical");
    expect(screen.getByRole("option", { name: "Aardvark" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Cat" })).toBeTruthy();
    expect(container.querySelector("[data-canonical-id='listbox-1']")).toBe(
      listbox,
    );
    expect(legacyListBoxRenderer).not.toHaveBeenCalled();
  });

  it("renders GridList canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const grid = screen.getByRole("grid", { name: "Grid List" });
    expect(grid.getAttribute("data-variant")).toBe("accent");
    expect(grid.getAttribute("data-layout")).toBe("grid");
    expect(grid.getAttribute("style")).toContain("--gl-columns: 2");
    expect(screen.getByText("Desert Sunset")).toBeTruthy();
    expect(screen.getByText("PNG - 2/3/2024")).toBeTruthy();
    expect(screen.getByText("Hiking Trail")).toBeTruthy();
    expect(container.querySelector("[data-canonical-id='gridlist-1']")).toBe(
      grid,
    );
    expect(legacyGridListRenderer).not.toHaveBeenCalled();
  });

  it("renders TagGroup canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "tag-group-1",
      type: "TagGroup",
      props: {
        label: "Flavors",
        variant: "accent",
        size: "lg",
        selectionMode: "multiple",
        selectedKeys: ["mint"],
        items: [
          { id: "chocolate", label: "Chocolate" },
          { id: "mint", label: "Mint", allowsRemoving: true },
        ],
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const tagGroupRoot = container.querySelector(".react-aria-TagGroup");
    expect(tagGroupRoot?.getAttribute("data-type-variant")).toBe("accent");
    expect(tagGroupRoot?.getAttribute("data-type-size")).toBe("lg");
    expect(container.querySelector("[data-canonical-id='tag-group-1']")).toBe(
      tagGroupRoot,
    );
    expect(screen.getByText("Flavors")).toBeTruthy();
    expect(screen.getByText("Chocolate")).toBeTruthy();
    expect(screen.getByText("Mint")).toBeTruthy();
    expect(legacyTagGroupRenderer).not.toHaveBeenCalled();
  });

  it("renders Menu canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "menu-1",
      type: "Menu",
      props: {
        label: "Actions",
        children: "Actions",
        variant: "primary",
        size: "md",
        selectionMode: "none",
        items: [
          { id: "copy", label: "Copy" },
          { id: "paste", label: "Paste" },
        ],
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    expect(screen.getByText("Actions")).toBeTruthy();
    expect(
      container.querySelector("[data-canonical-id='menu-1']"),
    ).toBeTruthy();
    expect(legacyMenuRenderer).not.toHaveBeenCalled();
  });

  it("renders ComboBox canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const comboRoot = container.querySelector(".react-aria-ComboBox");
    expect(comboRoot?.getAttribute("data-size")).toBe("md");
    expect(container.querySelector("[data-canonical-id='combo-1']")).toBe(
      comboRoot,
    );
    expect(screen.getByText("Animals")).toBeTruthy();
    expect(container.querySelector("input")?.getAttribute("placeholder")).toBe(
      "Pick one",
    );
    expect(legacyComboBoxRenderer).not.toHaveBeenCalled();
  });

  it("renders Select canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
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
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const selectRoot = container.querySelector(".react-aria-Select");
    expect(selectRoot?.getAttribute("data-size")).toBe("md");
    expect(container.querySelector("[data-canonical-id='select-1']")).toBe(
      selectRoot,
    );
    expect(screen.getByText("Animals")).toBeTruthy();
    expect(legacySelectRenderer).not.toHaveBeenCalled();
  });

  it("renders Tabs canonical items through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "tabs-1",
      type: "Tabs",
      props: {
        "aria-label": "Sections",
        selectedKey: "details",
        items: [
          { id: "overview", label: "Overview", content: "Overview content" },
          { id: "details", label: "Details", content: "Details content" },
        ],
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const tabsRoot = container.querySelector(".react-aria-Tabs");
    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(screen.getByText("Details content")).toBeTruthy();
    expect(container.querySelector("[data-canonical-id='tabs-1']")).toBe(
      tabsRoot,
    );
    expect(legacyTabsRenderer).not.toHaveBeenCalled();
  });

  it("renders Slider through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "slider-1",
      type: "Slider",
      props: {
        label: "Volume",
        value: 75,
        minValue: 0,
        maxValue: 100,
        step: 5,
        isEmphasized: true,
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const slider = screen.getByRole("slider", {
      name: "Volume",
    });
    const sliderRoot = container.querySelector(".react-aria-Slider");
    expect(sliderRoot?.getAttribute("data-size")).toBe("lg");
    expect(sliderRoot?.getAttribute("data-emphasized")).toBe("true");
    expect(container.querySelector("[data-canonical-id='slider-1']")).toBe(
      sliderRoot,
    );
    expect(slider).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
    expect(legacySliderRenderer).not.toHaveBeenCalled();
  });
});
