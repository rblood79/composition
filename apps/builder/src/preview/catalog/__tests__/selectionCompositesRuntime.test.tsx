import { act, fireEvent, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { openAdr280Preview } from "./support/adr280Harness";
import { setSiteSettings } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogPropertiesPatchCommand,
  catalogEditContract,
} from "../../../builder/catalogRuntime/editContract";

it("SelectBoxGroup owns its authored options and multiple selection", async () => {
  const h = await openAdr280Preview(["SelectBoxGroup"]);
  const id = h.ids[0]!;
  expect(h.element(id)!.getAttribute("role")).toBe("listbox");
  const options = () => [...h.element(id)!.querySelectorAll('[role="option"]')];
  expect(options()).toHaveLength(2);
  const description = () =>
    [...h.workspace.root.canvasInputs.values()].find(
      (node) =>
        node.props.slot === "description" &&
        node.props.children === "Description",
    )!;
  expect(description().hidden).toBe(true);
  expect(h.element(id)!.querySelector('[slot="description"]')).toBeNull();
  const optionId = options()[0]!.getAttribute("data-catalog-id")!;
  const geometry = () =>
    h.workspace.root.getGeometry([optionId]).get(optionId)!;
  expect(geometry().width).toBe(170);
  expect(geometry().height).toBe(170);
  expect(options()[0]!.getAttribute("aria-selected")).toBe("true");
  h.declare(id, { selectionMode: "multiple" });
  act(() => fireEvent.click(options()[1]!));
  await waitFor(() =>
    expect(options()[1]!.getAttribute("aria-selected")).toBe("true"),
  );
  expect(options()[0]!.getAttribute("aria-selected")).toBe("true");
  expect(
    h.element(id)!.querySelectorAll('[slot="selection"] input'),
  ).toHaveLength(0);
  h.declare(id, { orientation: "horizontal" });
  expect(description().hidden).not.toBe(true);
  expect(h.element(id)!.querySelector('[slot="description"]')).not.toBeNull();
  expect(h.element(id)!.textContent).toContain("Description");
  expect(geometry().width).toBe(368);
  // Authored illustration 48 + padding 16 × 2 + border 2 × 2; S2's minHeight is 80.
  expect(geometry().height).toBe(84);
  h.declare(id, { orientation: "vertical" });
  expect(h.element(id)!.querySelector('[slot="description"]')).toBeNull();
  h.declare(id, { orientation: "horizontal" });
  expect(
    h.element(id)!.querySelector('[slot="description"]')?.getAttribute("slot"),
  ).toBe("description");
  h.declare(id, { isDisabled: true });
  await waitFor(() =>
    expect(
      options().every(
        (option) => option.getAttribute("aria-disabled") === "true",
      ),
    ).toBe(true),
  );
  h.view.unmount();
});

it("SelectBoxGroup keys/all and disabled keys reach both document consumers", async () => {
  const h = await openAdr280Preview(["SelectBoxGroup"]);
  const id = h.ids[0]!;
  h.declare(id, {
    selectionMode: "multiple",
    selectedKeys: ["two"],
    disabledKeys: ["one"],
    "aria-label": "Cards",
    "aria-describedby": "help",
    "aria-details": "details",
  });
  const options = () => [...h.element(id)!.querySelectorAll('[role="option"]')];
  const cards = () =>
    [...h.workspace.root.canvasInputs.values()].filter(
      (node) => h.workspace.root.typeOf(node) === "SelectBox",
    );
  expect(
    options().map((option) => option.getAttribute("aria-selected")),
  ).toEqual(["false", "true"]);
  expect(options()[0].getAttribute("aria-disabled")).toBe("true");
  expect(cards().map((node) => node.derivedProps?._isSelected)).toEqual([
    false,
    true,
  ]);
  expect(cards()[0].derivedProps?.isDisabled).toBe(true);
  expect(h.element(id)!.getAttribute("aria-describedby")).toBe("help");
  expect(h.element(id)!.getAttribute("aria-details")).toBe("details");
  const target = h.workspace.positionOfRecord(cards()[1].id)!.target;
  const fields = catalogEditContract(
    h.workspace.runtime.graph,
    h.workspace.readModel,
    target,
  ).fields;
  const command = catalogPropertiesPatchCommand(
    h.workspace.runtime.graph,
    [target],
    { "aria-label": "Second card", textValue: "Second search value" },
    (key) => fields.find((field) => field.key === key)?.currentValue,
    new Set(),
  );
  act(() => h.workspace.execute(command!));
  h.flush();
  expect(options()[1].getAttribute("aria-label")).toBe("Second card");
  h.declare(id, { selectedKeys: "all", disabledKeys: [] });
  expect(
    options().every(
      (option) => option.getAttribute("aria-selected") === "true",
    ),
  ).toBe(true);
  expect(cards().every((node) => node.derivedProps?._isSelected === true)).toBe(
    true,
  );
  h.declare(id, { selectedKeys: [], defaultSelectedKeys: "all" });
  expect(
    options().every(
      (option) => option.getAttribute("aria-selected") === "false",
    ),
  ).toBe(true);
  h.view.unmount();
});

it("SelectBoxGroup default all and empty-selection/escape props are consumed", async () => {
  const h = await openAdr280Preview(["SelectBoxGroup"]);
  const id = h.ids[0]!;
  h.declare(id, {
    selectionMode: "multiple",
    defaultSelectedKeys: "all",
    disallowEmptySelection: true,
    escapeKeyBehavior: "none",
    autoFocus: "last",
    slot: false,
  });
  const options = () => [...h.element(id)!.querySelectorAll('[role="option"]')];
  expect(
    options().every(
      (option) => option.getAttribute("aria-selected") === "true",
    ),
  ).toBe(true);
  expect(h.element(id)!.getAttribute("slot")).toBeNull();
  act(() => fireEvent.keyDown(h.element(id)!, { key: "Escape" }));
  expect(
    options().every(
      (option) => option.getAttribute("aria-selected") === "true",
    ),
  ).toBe(true);
  h.view.unmount();
});

it("ActionBar clear callback runs an authored Interaction and preserves count all", async () => {
  const h = await openAdr280Preview(["ActionBar"]);
  const id = h.ids[0]!;
  h.declare(id, { selectedItemCount: "all" });
  expect(h.element(id)!.textContent).toContain("All selected");
  h.rule(id, "onClearSelection", {
    opcode: "capability",
    target: { nodeId: id },
    capabilityId: "clearSelection",
  });
  act(() => fireEvent.click(h.element(id)!.querySelector('[slot="clear"]')!));
  await waitFor(() => expect(h.element(id)).toBeNull());
  h.view.unmount();
});

it("ActionBar count uses the site's locale for both numeric and all state", async () => {
  const h = await openAdr280Preview(["ActionBar"]);
  const id = h.ids[0]!;
  act(() => h.workspace.execute(setSiteSettings({ patch: { lang: "ko-KR" } })));
  h.flush();
  h.declare(id, { selectedItemCount: "all" });
  expect(h.element(id)!.textContent).toContain("모두 선택됨");
  h.declare(id, { selectedItemCount: 12 });
  expect(h.element(id)!.textContent).toContain("12개 선택됨");
  act(() => h.workspace.execute(setSiteSettings({ patch: { lang: "en-US" } })));
  h.flush();
  expect(h.element(id)!.textContent).toContain("12 selected");
  h.view.unmount();
});

it("ActionBar emphasis re-evaluates button static color and direct count without overriding authored color", async () => {
  const h = await openAdr280Preview(["ActionBar"]);
  const id = h.ids[0]!;
  const buttons = () => [
    ...h.element(id)!.querySelectorAll(".react-aria-ActionButton"),
  ];
  h.declare(id, { isEmphasized: true });
  const expectedStatic =
    h.workspace.root.colorMode === "dark" ? "black" : "white";
  expect(
    buttons().map((button) => button.getAttribute("data-static-color")),
    h.workspace.root.colorMode,
  ).toEqual([expectedStatic, expectedStatic, expectedStatic]);
  const texts = () =>
    [...h.workspace.root.canvasInputs.values()].filter(
      (node) => h.workspace.root.typeOf(node) === "Text",
    );
  const actionTextColors = texts()
    .filter((node) => ["Edit", "Delete"].includes(String(node.props.children)))
    .map((node) => node.derivedProps?.color);
  expect(actionTextColors).toEqual([
    expectedStatic === "white" ? "#ffffff" : "#000000",
    expectedStatic === "white" ? "#ffffff" : "#000000",
  ]);
  const clearIcon = [...h.workspace.root.canvasInputs.values()].find(
    (node) =>
      h.workspace.root.typeOf(node) === "Icon" && node.props.iconName === "x",
  )!;
  expect(clearIcon.derivedProps?.color).toBe(
    expectedStatic === "white" ? "#ffffff" : "#000000",
  );
  expect(
    texts().some(
      (node) =>
        node.props.children === "1 selected" &&
        node.derivedProps?.color ===
          (h.workspace.root.colorMode === "dark" ? "#111111" : "#ffffff"),
    ),
  ).toBe(true);
  h.declare(id, { isEmphasized: false });
  expect(
    buttons().every(
      (button) => button.getAttribute("data-static-color") === "auto",
    ),
  ).toBe(true);
  h.declare(id, { isEmphasized: true });
  expect(
    buttons().every(
      (button) => button.getAttribute("data-static-color") === expectedStatic,
    ),
  ).toBe(true);
  h.view.unmount();
});
