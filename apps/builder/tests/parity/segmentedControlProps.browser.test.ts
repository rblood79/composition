import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  Provider,
  SegmentedControl as S2Group,
  SegmentedControlItem as S2Item,
} from "@react-spectrum/s2";
import { ToggleButtonGroupContext } from "react-aria-components/ToggleButtonGroup";
import { ToggleButtonContext } from "react-aria-components/ToggleButton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@composition/shared/components/SegmentedControl";
import { RacSlotScope } from "../../../../packages/shared/src/catalog/runtime/racSlotScope";
import { racSlotProps } from "../../../../packages/shared/src/catalog/runtime/racSlot";
import cssText from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

async function mount(content: ReturnType<typeof createElement>) {
  const host = document.body.appendChild(document.createElement("div"));
  host.appendChild(document.createElement("style")).textContent = cssText;
  injectPreviewBaseStyles(document);
  const target = host.appendChild(document.createElement("div"));
  const root = createRoot(target);
  await act(async () => root.render(content));
  await new Promise(requestAnimationFrame);
  return {
    target,
    async dispose() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("root and item slots consume their actual RAC contexts and vertical is a real layout/keyboard axis", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(ToggleButtonGroupContext.Provider, {
        value: { slots: { filters: { isDisabled: true } } },
        children: createElement(SegmentedControl, {
          slot: "filters",
          orientation: "vertical",
          "aria-describedby": "help",
          "aria-details": "detail",
        }),
      }),
      createElement(ToggleButtonContext.Provider, {
        value: {
          slots: {
            option: { isDisabled: true, "aria-label": "Slotted option" },
          },
        },
        children: createElement(
          SegmentedControl,
          { "aria-label": "Item slots", defaultSelectedKey: "enabled" },
          createElement(SegmentedControlItem, {
            id: "disabled",
            slot: "option",
            label: "Disabled",
          }),
          createElement(SegmentedControlItem, {
            id: "enabled",
            slot: null,
            label: "Enabled",
          }),
        ),
      }),
    ),
  );
  try {
    const groups = h.target.querySelectorAll<HTMLElement>(
      '[role="radiogroup"]',
    );
    expect(groups[0].getAttribute("aria-orientation")).toBe("vertical");
    expect(groups[0].getAttribute("aria-describedby")).toContain("help");
    expect(groups[0].getAttribute("aria-details")).toBe("detail");
    const buttons = groups[0].querySelectorAll<HTMLButtonElement>("button");
    expect([...buttons].every((button) => button.disabled)).toBe(true);
    expect(buttons[1].getBoundingClientRect().y).toBeGreaterThan(
      buttons[0].getBoundingClientRect().bottom,
    );
    const slotItem = groups[1].querySelector<HTMLButtonElement>(
      '[aria-label="Slotted option"]',
    )!;
    expect(slotItem.disabled).toBe(true);
    expect(groups[1].querySelector('[aria-checked="true"]')?.textContent).toBe(
      "Enabled",
    );
  } finally {
    await h.dispose();
  }
});

it("press scales only the real content Frame with S2's size-derived perspective", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(SegmentedControl, { "aria-label": "Shared press" }),
      createElement(Provider, {
        children: createElement(S2Group, {
          "aria-label": "S2 press",
          children: [
            createElement(S2Item, {
              id: "first",
              key: "first",
              children: "List",
            }),
            createElement(S2Item, {
              id: "second",
              key: "second",
              children: "Grid",
            }),
          ],
        }),
      }),
    ),
  );
  try {
    await document.fonts.ready;
    const groups = h.target.querySelectorAll<HTMLElement>(
      '[role="radiogroup"]',
    );
    const ratios: number[] = [];
    for (const group of groups) {
      const button = group.querySelector<HTMLButtonElement>("button")!;
      const content = button.lastElementChild as HTMLElement;
      const indicator = button.firstElementChild as HTMLElement;
      const before = content.getBoundingClientRect();
      const outer = button.getBoundingClientRect(),
        surface = indicator.getBoundingClientRect();
      const perspective = Math.max(
        content.offsetHeight,
        content.offsetWidth / 3,
        24,
      );
      await act(async () => {
        button.focus();
        button.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            code: "Space",
            bubbles: true,
          }),
        );
      });
      await new Promise(requestAnimationFrame);
      expect(button.getAttribute("data-pressed")).not.toBeNull();
      for (const animation of content.getAnimations()) animation.finish();
      const pressed = content.getBoundingClientRect();
      expect(pressed.width).toBeLessThan(before.width);
      expect(pressed.width / before.width).toBeCloseTo(
        perspective / (perspective + 2),
        2,
      );
      expect(button.getBoundingClientRect().width).toBeCloseTo(outer.width, 2);
      expect(indicator.getBoundingClientRect().width).toBeCloseTo(
        surface.width,
        2,
      );
      ratios.push(pressed.width / before.width);
      await act(async () =>
        button.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: " ",
            code: "Space",
            bubbles: true,
          }),
        ),
      );
      await new Promise(requestAnimationFrame);
      for (const animation of content.getAnimations()) animation.finish();
      expect(content.getBoundingClientRect().width).toBeCloseTo(
        before.width,
        2,
      );
      let minWidth = before.width;
      let observedPress = false;
      let sampling = true;
      const sample = () => {
        observedPress ||= button.hasAttribute("data-pressed");
        minWidth = Math.min(minWidth, content.getBoundingClientRect().width);
        if (sampling) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      try {
        await userEvent.click(button, { delay: 250 });
      } finally {
        sampling = false;
      }
      expect(observedPress).toBe(true);
      expect(minWidth).toBeLessThan(before.width);
      expect(button.getBoundingClientRect().width).toBeCloseTo(outer.width, 2);
    }
    expect(ratios[0]).toBeCloseTo(ratios[1], 2);
  } finally {
    await h.dispose();
  }
});

it("catalog slot scope keeps unknown names detached and reconnects provided names", async () => {
  const group = (authored: unknown) =>
    createElement(RacSlotScope, {
      context: "ToggleButtonGroup",
      authored,
      render: (resolution) =>
        createElement(SegmentedControl, {
          ...racSlotProps(resolution),
          "aria-label": "Resolved group",
        }),
    });
  const h = await mount(
    createElement(ToggleButtonGroupContext.Provider, {
      value: { slots: { filters: { isDisabled: true } } },
      children: createElement(
        "div",
        null,
        group("filters"),
        group("unknown"),
        group(false),
      ),
    }),
  );
  try {
    const groups = h.target.querySelectorAll('[role="radiogroup"]');
    expect(groups).toHaveLength(3);
    expect(
      [...groups[0].querySelectorAll("button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    for (const group of [groups[1], groups[2]]) {
      expect(
        [...group.querySelectorAll("button")].every(
          (button) => !button.disabled,
        ),
      ).toBe(true);
      expect(group.hasAttribute("slot")).toBe(false);
    }
  } finally {
    await h.dispose();
  }
});
