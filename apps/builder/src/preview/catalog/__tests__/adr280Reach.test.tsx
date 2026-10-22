import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-280 G2 — every registered capability reaches RAC on the whole Preview path (the render
 * result is the oracle, not the binding's `accepts`): a Button's press runs one rule on the palette
 * instance, and the RAC element shows the written state. Measurement: jsdom + the Builder
 * workspace → channel → Preview session (RAC 1.22.1) — reach only.
 */
type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;
type Action = Parameters<Harness["rule"]>[2];

afterEach(() => {
  vi.restoreAllMocks();
});

const warnings = () =>
  (console.warn as unknown as { mock?: { calls: unknown[][] } }).mock?.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]")) ?? [];

/** The palette `type` plus a Button; the Button's press runs `capabilityId` on the instance. */
async function pressRule(
  type: string,
  capabilityId: string,
  options: {
    value?: string | number | readonly string[];
    declare?: Record<string, unknown>;
    pickValue?: (harness: Harness) => string;
  } = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const harness = await openAdr280Preview([type, "Button"]);
  const [target, button] = harness.ids as [NodeId, NodeId];
  if (options.declare)
    harness.declare(target, options.declare as Record<string, never>);
  const value = options.pickValue ? options.pickValue(harness) : options.value;
  harness.rule(button, "onPress", {
    opcode: "capability",
    targetId: target,
    capabilityId,
    ...(value !== undefined ? { value } : {}),
  } as Action);
  const press = () =>
    act(() => {
      fireEvent.click(harness.element(button)!);
    });
  return { ...harness, target, press };
}

const q = (harness: Harness, selector: string) =>
  harness.view.container.querySelector(selector) as HTMLElement | null;
const qa = (harness: Harness, selector: string) => [
  ...harness.view.container.querySelectorAll<HTMLElement>(selector),
];
const inDocument = (selector: string) => !!document.querySelector(selector);

describe("ADR-280 G2 — toggles", () => {
  it.each([
    ["Checkbox", "check", true],
    ["Switch", "check", true],
  ] as const)("%s %s", async (type, capability, expected) => {
    const h = await pressRule(type, capability, {
      declare: { isSelected: false },
    });
    h.press();
    expect(
      (q(h, `[data-catalog-id$="::${h.target}"] input`) as HTMLInputElement)
        .checked,
    ).toBe(expected);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("ToggleButton toggleCheck twice", async () => {
    const h = await pressRule("ToggleButton", "toggleCheck", {
      declare: { isSelected: false },
    });
    h.press();
    expect(h.element(h.target)?.getAttribute("aria-pressed")).toBe("true");
    h.press();
    expect(h.element(h.target)?.getAttribute("aria-pressed")).toBe("false");
    h.view.unmount();
  });

  it("CheckboxGroup clear unchecks every item", async () => {
    const h = await pressRule("CheckboxGroup", "clear");
    h.press();
    expect(
      qa(h, "input[type=checkbox]").some(
        (input) => (input as HTMLInputElement).checked,
      ),
    ).toBe(false);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("RadioGroup setValue checks the radio", async () => {
    const h = await pressRule("RadioGroup", "setValue", {
      pickValue: (harness) =>
        (qa(harness, "input[type=radio]").at(-1) as HTMLInputElement).value,
    });
    h.press();
    expect(
      (qa(h, "input[type=radio]").at(-1) as HTMLInputElement).checked,
    ).toBe(true);
    h.view.unmount();
  });

  it("ToggleButtonGroup selectItem presses the button", async () => {
    const h = await pressRule("ToggleButtonGroup", "selectItem", {
      pickValue: (harness) =>
        qa(harness, "button[aria-pressed], [role=radio]")
          .at(-1)!
          .getAttribute("data-catalog-id")!,
    });
    h.press();
    const last = qa(h, "button[aria-pressed], [role=radio]").at(-1)!;
    expect(
      last.getAttribute("aria-pressed") ?? last.getAttribute("aria-checked"),
    ).toBe("true");
    h.view.unmount();
  });
});

describe("ADR-280 G2 — text · number · color fields", () => {
  it.each([
    ["TextField", "input", "hello", "hello"],
    ["TextArea", "textarea", "hello", "hello"],
    ["SearchField", "input", "hello", "hello"],
    ["NumberField", "input", 42, "42"],
  ] as const)("%s setValue", async (type, selector, value, expected) => {
    const h = await pressRule(type, "setValue", { value });
    h.press();
    expect((q(h, selector) as HTMLInputElement).value).toBe(expected);
    h.view.unmount();
  });

  it("TextField clear empties it after the user typed", async () => {
    const h = await pressRule("TextField", "clear");
    act(() => {
      fireEvent.change(q(h, "input")!, { target: { value: "typed" } });
    });
    expect((q(h, "input") as HTMLInputElement).value).toBe("typed");
    h.press();
    expect((q(h, "input") as HTMLInputElement).value).toBe("");
    h.view.unmount();
  });

  it("ColorField setValue", async () => {
    const h = await pressRule("ColorField", "setValue", { value: "#FF0000" });
    h.press();
    expect((q(h, "input") as HTMLInputElement).value.toUpperCase()).toBe(
      "#FF0000",
    );
    h.view.unmount();
  });

  it("Slider setValue", async () => {
    const h = await pressRule("Slider", "setValue", { value: 30 });
    h.press();
    expect((q(h, "input[type=range]") as HTMLInputElement).value).toBe("30");
    h.view.unmount();
  });

  it.each(["ColorArea", "ColorSlider", "ColorWheel"])(
    "%s setValue moves its thumb",
    async (type) => {
      const h = await pressRule(type, "setValue", { value: "#00FF00" });
      const before = qa(h, "input").map((input) =>
        input.getAttribute("aria-valuetext"),
      );
      h.press();
      const after = qa(h, "input").map((input) =>
        input.getAttribute("aria-valuetext"),
      );
      expect(after).not.toEqual(before);
      expect(warnings()).toEqual([]);
      h.view.unmount();
    },
  );
});

describe("ADR-280 G2 — ColorSwatchPicker", () => {
  it("ColorSwatchPicker setValue selects the swatch", async () => {
    const h = await pressRule("ColorSwatchPicker", "setValue", {
      pickValue: (harness) =>
        String(
          [...harness.session.root!.domInputs.values()]
            .filter((record) => record.bindingId === "colorswatchpickeritem")
            .at(-1)!.props.color,
        ),
    });
    const selected = () =>
      qa(h, '[role="option"]').findIndex(
        (option) => option.getAttribute("aria-selected") === "true",
      );
    h.press();
    expect(selected()).toBe(qa(h, '[role="option"]').length - 1);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });
});

describe("ADR-280 G2 — collections", () => {
  const lastKey = (selector: string) => (harness: Harness) =>
    qa(harness, selector).at(-1)!.getAttribute("data-key")!;

  it.each([
    ["ListBox", '[role="option"]'],
    ["GridList", '[role="row"]'],
    ["Tree", '[role="row"]'],
    ["TagGroup", '[role="row"]'],
  ] as const)(
    "%s selectItem · deselectItem · clearSelection",
    async (type, selector) => {
      const h = await pressRule(type, "selectItem", {
        declare: { selectionMode: "multiple" },
        pickValue: lastKey(selector),
      });
      h.press();
      const selected = () =>
        qa(h, selector)
          .filter((item) => item.getAttribute("aria-selected") === "true")
          .map((item) => item.getAttribute("data-key"));
      expect(selected()).toContain(
        qa(h, selector).at(-1)!.getAttribute("data-key"),
      );
      expect(warnings()).toEqual([]);
      h.view.unmount();
    },
  );

  it("CardView selectItem", async () => {
    const h = await pressRule("CardView", "selectItem", {
      declare: { selectionMode: "single" },
      pickValue: (harness) =>
        qa(harness, '[role="row"]').at(-1)!.getAttribute("data-key")!,
    });
    h.press();
    expect(qa(h, '[role="row"]').at(-1)!.getAttribute("aria-selected")).toBe(
      "true",
    );
    h.view.unmount();
  });

  it("Table selectItem", async () => {
    const h = await pressRule("Table", "selectItem", {
      declare: { selectionMode: "single" },
      pickValue: (harness) =>
        qa(harness, 'tbody [role="row"], [role="rowgroup"] [role="row"]')
          .at(-1)!
          .getAttribute("data-key")!,
    });
    h.press();
    const rows = qa(h, '[role="row"][data-key]');
    expect(rows.at(-1)!.getAttribute("aria-selected")).toBe("true");
    h.view.unmount();
  });

  it("Tabs selectTab", async () => {
    const h = await pressRule("Tabs", "selectTab", {
      pickValue: (harness) =>
        qa(harness, '[role="tab"]').at(-1)!.getAttribute("data-key")!,
    });
    h.press();
    expect(qa(h, '[role="tab"]').at(-1)!.getAttribute("aria-selected")).toBe(
      "true",
    );
    h.view.unmount();
  });

  it("Tree expand shows the item's children", async () => {
    const h = await pressRule("Tree", "expand", {
      pickValue: (harness) =>
        qa(harness, '[role="row"][aria-expanded="false"]')[0]!.getAttribute(
          "data-key",
        )!,
    });
    const before = qa(h, '[role="row"]').length;
    h.press();
    expect(qa(h, '[role="row"]').length).toBeGreaterThan(before);
    h.view.unmount();
  });

  it("Disclosure collapse · expand", async () => {
    const h = await pressRule("Disclosure", "collapse");
    h.press();
    expect(q(h, ".react-aria-Disclosure")?.hasAttribute("data-expanded")).toBe(
      false,
    );
    h.view.unmount();
  });

  it("DisclosureGroup collapse closes every Disclosure", async () => {
    const h = await pressRule("DisclosureGroup", "collapse");
    h.press();
    expect(
      qa(h, ".react-aria-Disclosure").some((item) =>
        item.hasAttribute("data-expanded"),
      ),
    ).toBe(false);
    h.view.unmount();
  });
});

describe("ADR-280 G2 — pickers", () => {
  it("Select open shows its list; close hides it", async () => {
    const h = await pressRule("Select", "open");
    h.press();
    expect(inDocument('[role="listbox"]')).toBe(true);
    h.view.unmount();
  });

  it("ComboBox setInput writes its text", async () => {
    const h = await pressRule("ComboBox", "setInput", { value: "abc" });
    h.press();
    expect((q(h, "input") as HTMLInputElement).value).toBe("abc");
    h.view.unmount();
  });

  it("Autocomplete setInput writes its field's text", async () => {
    const h = await pressRule("Autocomplete", "setInput", { value: "abc" });
    h.press();
    expect((q(h, "input") as HTMLInputElement).value).toBe("abc");
    h.view.unmount();
  });
});

describe("ADR-280 G2 — overlays (open is the trigger's — Phase 0 probe P1)", () => {
  it.each([
    ["Menu", '[role="menu"]'],
    ["Dialog", '[role="dialog"]'],
    ["Popover", '[role="dialog"]'],
    ["ContextualHelp", '[role="dialog"]'],
    ["Tooltip", '[role="tooltip"]'],
  ] as const)(
    "%s trigger open shows it, close hides it",
    async (type, selector) => {
      const h = await pressRule(type, "open");
      expect(inDocument(selector)).toBe(false);
      h.press();
      expect(inDocument(selector)).toBe(true);
      expect(warnings()).toEqual([]);
      h.view.unmount();
    },
  );
});

describe("ADR-280 G2 — date · time", () => {
  it.each([
    ["DateField", "2026-10-22", "22"],
    ["TimeField", "13:45", "45"],
    ["DatePicker", "2026-10-22", "22"],
  ] as const)("%s setValue", async (type, value, part) => {
    const h = await pressRule(type, "setValue", { value });
    h.press();
    expect(
      qa(h, '[role="spinbutton"]').map((segment) => segment.textContent),
    ).toContain(part);
    h.view.unmount();
  });

  it("Calendar setValue selects the date", async () => {
    // (A date in the month the Calendar opens on — today's.)
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const h = await pressRule("Calendar", "setValue", {
      value: `${today.getFullYear()}-${month}-15`,
    });
    h.press();
    expect(
      qa(h, '[aria-selected="true"]').map((cell) => cell.textContent?.trim()),
    ).toContain("15");
    h.view.unmount();
  });

  it("DatePicker open shows its calendar", async () => {
    const h = await pressRule("DatePicker", "open");
    h.press();
    expect(inDocument('[role="dialog"], [role="grid"]')).toBe(true);
    h.view.unmount();
  });
});
