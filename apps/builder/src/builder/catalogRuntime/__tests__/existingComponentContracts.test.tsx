import { renderCatalogDom } from "../domBinding";
import { createElement, createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DEFAULT_SLOT, TextFieldContext } from "react-aria-components";
import {
  openAdr296,
  BODY,
} from "../../../preview/catalog/__tests__/support/adr296Harness";
import { openAdr280Preview } from "../../../preview/catalog/__tests__/support/adr280Harness";
import { CatalogPreviewView } from "../../../preview/catalog/catalogPreviewApp";
import { catalogEditContract } from "../editContract";
import { catalogFieldLabelPart } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { CATALOG_RAC_SLOT_CONSUMERS } from "../../../../../../packages/shared/src/catalog/racSlotContract";
import { RAC_SLOT_CONTEXTS } from "../../../../../../packages/shared/src/catalog/runtime/racSlotScope";
import { CATALOG_COMPONENT_SLOT_CONTEXTS } from "../../../../../../packages/shared/src/components/catalogSlotContexts";
import { Badge } from "../../../../../../packages/shared/src/components/Badge";
import { Avatar } from "../../../../../../packages/shared/src/components/Avatar";
import { StatusLight } from "../../../../../../packages/shared/src/components/StatusLight";
import { ProgressCircle } from "../../../../../../packages/shared/src/components/ProgressCircle";

it("every slotted controller has an authorable contract and a real context", async () => {
  const h = await openAdr296();
  try {
    const instances = [];
    for (const [type, consumer] of Object.entries(CATALOG_RAC_SLOT_CONSUMERS)) {
      expect(RAC_SLOT_CONTEXTS[consumer], type).toBeTruthy();
      if (type === "DateInput" || type === "SegmentedControlItem") {
        const registration = h
          .graph()
          .library.definitions.get(`lib:definition:type-${type}`);
        expect(registration?.accepts.slot, type).toBe("slot");
        continue;
      }
      const id = h.add(type);
      const contract = catalogEditContract(h.graph(), h.workspace.readModel, {
        kind: "node",
        id,
      });
      expect(
        contract.fields.find((field) => field.key === "slot")?.editorHidden,
        type,
      ).toBe(true);
      h.declare(id, { slot: false });
      expect(h.node(id).props.slot, type).toEqual({
        kind: "set",
        value: false,
      });
      h.workspace.undo();
      expect(h.node(id).props.slot, type).toBeUndefined();
      h.workspace.redo();
      expect(h.node(id).props.slot, type).toEqual({
        kind: "set",
        value: false,
      });
      instances.push({ type, id });
    }
    const code = h.code();
    expect(code.match(/slot=\{null\}/g)?.length).toBeGreaterThanOrEqual(
      instances.length,
    );
    h.apply(code);
    for (const { type, id } of instances)
      expect(h.node(id).props.slot, type).toEqual({
        kind: "set",
        value: false,
      });
  } finally {
    h.workspace.dispose();
  }
});

it.each(["Menu", "Dialog", "Popover", "Sheet"])(
  "%s projects its Slot onto the controller inside the trigger",
  async (type) => {
    const h = await openAdr296();
    try {
      const id = h.add(type);
      h.declare(id, { slot: "provided" });
      const controller = [...h.workspace.root.domInputs.values()].find(
        (node) => h.workspace.root.typeOf(node) === type,
      );
      expect(controller?.props.slot).toBe("provided");
      h.declare(id, { slot: false });
      expect(h.workspace.root.domInputs.get(controller!.id)?.props.slot).toBe(
        false,
      );
      expect(h.code()).toContain("slot={null}");
    } finally {
      h.workspace.dispose();
    }
  },
);

it("Sheet retains its DOM Slot contract without an ordinary Property editor", async () => {
  const h = await openAdr296();
  try {
    const id = h.add("Sheet");
    const contract = catalogEditContract(h.graph(), h.workspace.readModel, {
      kind: "node",
      id,
    });
    expect(
      contract.fields.find((field) => field.key === "slot")?.editorHidden,
    ).toBe(true);
  } finally {
    h.workspace.dispose();
  }
});

it.each(["TextArea", "TextField"])(
  "%s receives body flags in Canvas and Preview",
  async (type) => {
    const h = await openAdr280Preview([type]);
    try {
      for (const flag of ["isDisabled", "isReadOnly", "isRequired"]) {
        h.declare(BODY, { [flag]: true });
        const input = h
          .element(h.ids[0])!
          .querySelector("input,textarea") as HTMLInputElement;
        expect(
          flag === "isDisabled"
            ? input.disabled
            : flag === "isReadOnly"
              ? input.readOnly
              : input.required,
        ).toBe(true);
        h.declare(BODY, { [flag]: false });
      }
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it.each([
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  "Select",
  "ComboBox",
])("%s Canvas necessity follows inherited required", async (type) => {
  const h = await openAdr280Preview([type]);
  try {
    h.declare(BODY, { isRequired: true });
    const root = h.workspace.root;
    const part = [...root.canvasInputs.values()].find(
      (node) => node.props.slot === "necessity-icon",
    )!;
    expect(
      catalogFieldLabelPart(
        part,
        (id) => root.canvasInputs.get(id),
        root.typeOf,
      )?.required,
    ).toBe(true);
    const hiddenText = [...root.domInputs.values()].find(
      (node) => node.props.slot === "necessity-label",
    )!;
    expect(
      h.view.container.querySelector(`[data-catalog-id="${hiddenText.id}"]`),
    ).toBeNull();
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it.each([
  "Button",
  "LinkButton",
  "ActionButton",
  "ToggleButton",
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "Select",
  "ComboBox",
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
  "Switch",
  "Slider",
  "RangeSlider",
  "LabeledValue",
  "TagGroup",
])("%s takes Form size before its default", async (type) => {
  const h = await openAdr296();
  try {
    const form = h.add("Form", { size: "L", isEmphasized: true });
    const id = h.add(type, {}, form);
    const node = [...h.workspace.root.canvasInputs.values()].find(
      (node) => node.sourceId === id && h.workspace.root.typeOf(node) === type,
    )!;
    expect(node.props.size).toBe("L");
    if (type === "ToggleButton") expect(node.props.isEmphasized).toBe(true);
    h.declare(id, { size: "S" });
    expect(h.workspace.root.canvasInputs.get(node.id)?.props.size).toBe("S");
  } finally {
    h.workspace.dispose();
  }
});

it("TextArea consumes named/default/detached native context and preserves own writes", async () => {
  const h = await openAdr280Preview(["TextArea"]);
  const ref = createRef<HTMLDivElement>();
  const change = vi.fn();
  const context = {
    slots: {
      [DEFAULT_SLOT]: { isReadOnly: true, className: "default-field" },
      provided: {
        isDisabled: true,
        ref,
        className: "provided-field",
        onChange: change,
      },
    },
  };
  const draw = () =>
    h.view.rerender(
      createElement(
        TextFieldContext.Provider,
        { value: context },
        createElement(CatalogPreviewView, {
          session: h.session,
          runtime: h.runtime,
        }),
      ),
    );
  try {
    h.declare(h.ids[0], { slot: "provided" });
    draw();
    const input = () => h.element(h.ids[0])!.querySelector("textarea")!;
    expect(input().disabled).toBe(true);
    expect(ref.current).toBe(h.element(h.ids[0]));
    expect(h.element(h.ids[0])!.classList.contains("provided-field")).toBe(
      true,
    );
    h.declare(h.ids[0], { isDisabled: false });
    expect(input().disabled).toBe(false);
    fireEvent.change(input(), { target: { value: "편집" } });
    expect(change).toHaveBeenCalledTimes(1);
    h.declare(h.ids[0], { slot: false });
    expect(h.element(h.ids[0])!.classList.contains("provided-field")).toBe(
      false,
    );
    h.declare(h.ids[0], { slot: "unknown" });
    expect(input()).toBeTruthy();
    expect(h.element(h.ids[0])!.classList.contains("provided-field")).toBe(
      false,
    );
    h.declare(h.ids[0], { slot: "" });
    expect(input().readOnly).toBe(true);
    expect(h.element(h.ids[0])!.classList.contains("default-field")).toBe(true);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it.each([
  ["Badge", Badge, "SPAN"],
  ["Avatar", Avatar, "DIV"],
  ["StatusLight", StatusLight, "DIV"],
  ["ProgressCircle", ProgressCircle, "DIV"],
] as const)(
  "%s local context merges style, handlers and refs before own props",
  (type, Component, tag) => {
    const ref = createRef<HTMLElement>();
    const contextClick = vi.fn();
    const ownClick = vi.fn();
    const value = {
      slots: {
        provided: {
          ref,
          className: "provided-local",
          style: { color: "red", opacity: 0.5 },
          onClick: contextClick,
        },
      },
    };
    const draw = (slot: string | null) =>
      createElement(
        CATALOG_COMPONENT_SLOT_CONTEXTS[type].Provider,
        { value },
        createElement(Component as React.ElementType, {
          slot,
          style: { color: "blue" },
          onClick: ownClick,
        }),
      );
    const view = render(draw("provided"));
    try {
      const element = view.container.firstElementChild as HTMLElement;
      expect(element.tagName).toBe(tag);
      expect(ref.current).toBe(element);
      expect(element.style.opacity).toBe("0.5");
      expect(element.style.color).toBe("blue");
      fireEvent.click(element);
      expect(contextClick).toHaveBeenCalledTimes(1);
      expect(ownClick).toHaveBeenCalledTimes(1);
      view.rerender(draw(null));
      expect(
        view.container.firstElementChild!.classList.contains("provided-local"),
      ).toBe(false);
    } finally {
      view.unmount();
    }
  },
);

it("Card origin exposes disabled and LinkButton omits Link-only visual props", async () => {
  const h = await openAdr296();
  try {
    const fields = (type: string) =>
      catalogEditContract(h.graph(), h.workspace.readModel, {
        kind: "node",
        id: h.add(type),
      }).fields.map((field) => field.key);
    expect(fields("Card")).toContain("isDisabled");
    const link = fields("LinkButton");
    expect(link).not.toContain("isQuiet");
    expect(link).not.toContain("isStandalone");
  } finally {
    h.workspace.dispose();
  }
});

it("Image consumes its local context on the actual image root", async () => {
  const h = await openAdr280Preview(["Image"]);
  const ref = createRef<HTMLElement>();
  try {
    h.declare(h.ids[0], { slot: "provided" });
    h.view.rerender(
      createElement(
        CATALOG_COMPONENT_SLOT_CONTEXTS.Image.Provider,
        {
          value: {
            slots: {
              provided: {
                ref,
                alt: "제공된 대체 텍스트",
                className: "provided-image",
              },
            },
          },
        },
        createElement(CatalogPreviewView, {
          session: h.session,
          runtime: h.runtime,
        }),
      ),
    );
    expect(ref.current).toBe(h.element(h.ids[0]));
    expect(ref.current?.tagName).toBe("IMG");
    expect(ref.current?.getAttribute("alt")).toBe("제공된 대체 텍스트");
    expect(ref.current?.classList.contains("provided-image")).toBe(true);
    h.declare(h.ids[0], { slot: false });
    expect(h.element(h.ids[0])?.classList.contains("provided-image")).toBe(
      false,
    );
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it("ButtonGroup propagates its LinkButton size and disabled state to Canvas and DOM", async () => {
  const h = await openAdr296();
  const consoleError = vi.spyOn(console, "error");
  let view: ReturnType<typeof render> | undefined;
  try {
    const group = h.add("ButtonGroup", { size: "L", isDisabled: true });
    const id = h.add("LinkButton", {}, group);
    const root = h.workspace.root;
    const link = [...root.canvasInputs.values()].find(
      (node) => node.sourceId === id && root.typeOf(node) === "LinkButton",
    )!;
    const groupNode = [...root.domInputs.values()].find(
      (node) => node.sourceId === group && root.typeOf(node) === "ButtonGroup",
    )!;
    expect(link.props.size).toBe("L");
    expect(link.derivedProps?.isDisabled).toBe(true);
    view = render(renderCatalogDom(root, groupNode.id));
    const element = view.container.querySelector(
      `[data-catalog-id="${link.id}"]`,
    )!;
    expect(element.getAttribute("data-size")).toBe("L");
    expect(element.matches("[data-disabled],[aria-disabled=true]")).toBe(true);
    act(() => h.declare(group, { size: "S" }));
    expect(root.canvasInputs.get(link.id)?.props.size).toBe("S");
    expect(element.getAttribute("data-size")).toBe("S");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "style property",
    );
  } finally {
    consoleError.mockRestore();
    view?.unmount();
    h.workspace.dispose();
  }
});
