import { act, fireEvent, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { openAdr280Preview } from "./support/adr280Harness";
import { openAdr296 } from "./support/adr296Harness";

it("SegmentedControl Code View uses the executable public default composition", async () => {
  const h = await openAdr296();
  try {
    h.add("SegmentedControl");
    const code = h.code();
    expect(code).toContain(
      "import {SegmentedControl} from '@composition/shared/components'",
    );
    expect(code).toContain("<SegmentedControl />");
  } finally {
    h.workspace.dispose();
  }
});

it("an independently authored SegmentedControlItem preserves its label and icon in Code View", async () => {
  const h = await openAdr296();
  try {
    const group = h.add("SegmentedControl");
    const item = h.add("SegmentedControlItem", { id: "edited" }, group);
    h.declare(item, { label: "Edited item", icon: "circle" });
    expect(h.code()).toContain("<SegmentedControlItem");
    expect(h.code()).toContain("Edited item");
    expect(h.code()).toContain("circle");
  } finally {
    h.workspace.dispose();
  }
});

it("RangeSlider has two editable thumb values and preserves range output", async () => {
  const h = await openAdr280Preview(["RangeSlider"]);
  const id = h.ids[0]!;
  h.declare(id, {
    value: { start: 20, end: 80 },
    startName: "minimum",
    endName: "maximum",
    form: "filter",
  });
  const inputs = () =>
    [
      ...h.element(id)!.querySelectorAll('input[type="range"]'),
    ] as HTMLInputElement[];
  expect(inputs().map((input) => input.value)).toEqual(["20", "80"]);
  expect(inputs().map((input) => [input.min, input.max])).toEqual([
    ["0", "80"],
    ["20", "100"],
  ]);
  act(() => {
    inputs()[0].focus();
    fireEvent.keyDown(inputs()[0], { key: "ArrowRight" });
  });
  await waitFor(() => expect(inputs()[0].value).toBe("21"));
  expect(inputs()[1].value).toBe("80");
  expect(inputs().map((input) => input.name)).toEqual(["minimum", "maximum"]);
  expect(inputs().map((input) => input.getAttribute("form"))).toEqual([
    "filter",
    "filter",
  ]);
  h.declare(id, { value: { start: 40, end: 60 } });
  expect(inputs().map((input) => input.value)).toEqual(["40", "60"]);
  expect(inputs().map((input) => [input.min, input.max])).toEqual([
    ["0", "60"],
    ["40", "100"],
  ]);
  h.view.unmount();
});

it("SegmentedControl selects the first enabled item, keyboard switches, and cannot deselect", async () => {
  const h = await openAdr280Preview(["SegmentedControl"]);
  const id = h.ids[0]!;
  const buttons = () =>
    [...h.element(id)!.querySelectorAll("button")] as HTMLButtonElement[];
  expect(buttons()).toHaveLength(2);
  expect(buttons().map((button) => button.textContent)).toEqual([
    "List",
    "Grid",
  ]);
  expect(buttons()[0].getAttribute("aria-checked")).toBe("true");
  act(() => {
    buttons()[0].focus();
    fireEvent.keyDown(buttons()[0], { key: "ArrowRight" });
  });
  await waitFor(() => expect(document.activeElement).toBe(buttons()[1]));
  act(() => fireEvent.click(buttons()[1]));
  await waitFor(() =>
    expect(buttons()[1].getAttribute("aria-checked")).toBe("true"),
  );
  act(() => fireEvent.click(buttons()[1]));
  expect(buttons()[1].getAttribute("aria-checked")).toBe("true");
  h.declare(id, { selectedKey: "first", isDisabled: true });
  expect(buttons()[0].getAttribute("aria-checked")).toBe("true");
  expect(buttons().every((button) => button.disabled)).toBe(true);
  h.view.unmount();
});

it("RangeSlider setValue capability writes both runtime values through the real dispatcher", async () => {
  const h = await openAdr280Preview(["RangeSlider", "Button"]);
  const [target, trigger] = h.ids;
  h.rule(trigger, "onPress", {
    opcode: "capability",
    target: { nodeId: target },
    capabilityId: "setValue",
    value: { start: 15, end: 85 },
  });
  act(() => fireEvent.click(h.element(trigger)!));
  await waitFor(() =>
    expect(
      [...h.element(target)!.querySelectorAll('input[type="range"]')].map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["15", "85"]),
  );
  h.view.unmount();
});
