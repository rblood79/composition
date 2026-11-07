import { act, createElement, createRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { LinkContext } from "react-aria-components/Link";
import { SliderContext } from "react-aria-components/Slider";
import { ListBoxContext } from "react-aria-components/ListBox";
import { Text } from "react-aria-components/Text";
import { LinkButton } from "@composition/shared/components/LinkButton";
import { RangeSlider } from "@composition/shared/components/RangeSlider";
import { SelectBoxGroup } from "@composition/shared/components/SelectBoxGroup";
import { LabeledValue } from "@composition/shared/components/LabeledValue";
import {
  ActionBar,
  ActionBarContext,
} from "@composition/shared/components/ActionBar";
import { RacSlotScope } from "../../../../packages/shared/src/catalog/runtime/racSlotScope";
import { racSlotProps } from "../../../../packages/shared/src/catalog/runtime/racSlot";
import css from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

async function mount(content: ReactElement) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.body.appendChild(document.createElement("div"));
  host.appendChild(document.createElement("style")).textContent = css;
  injectPreviewBaseStyles(document);
  const target = host.appendChild(document.createElement("div"));
  const root = createRoot(target);
  await act(async () => root.render(content));
  return {
    target,
    async dispose() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("RangeSlider inherits a named initial range before its catalog fallback", async () => {
  const h = await mount(
    createElement(SliderContext.Provider, {
      value: {
        slots: { range: { defaultValue: [10, 60], "aria-label": "Budget" } },
      },
      children: createElement(RangeSlider, { slot: "range" }),
    }),
  );
  try {
    expect(
      [
        ...h.target.querySelectorAll<HTMLInputElement>('input[type="range"]'),
      ].map((input) => input.value),
    ).toEqual(["10", "60"]);
    expect(
      h.target
        .querySelector(".react-aria-RangeSlider")
        ?.getAttribute("aria-label"),
    ).toBe("Budget");
  } finally {
    await h.dispose();
  }
});

it("RangeSlider own initial range overrides context and slot null restores its fallback", async () => {
  const h = await mount(
    createElement(SliderContext.Provider, {
      value: {
        defaultValue: [10, 60],
        isDisabled: true,
        "aria-label": "Budget",
      },
      children: createElement(
        "div",
        null,
        createElement(RangeSlider, {
          defaultValue: { start: 20, end: 80 },
          isDisabled: false,
        }),
        createElement(RangeSlider, {
          slot: null,
          "aria-label": "Detached range",
        }),
      ),
    }),
  );
  try {
    const groups = h.target.querySelectorAll(".react-aria-RangeSlider");
    expect(
      [
        ...groups[0].querySelectorAll<HTMLInputElement>('input[type="range"]'),
      ].map((input) => input.value),
    ).toEqual(["20", "80"]);
    expect(
      [
        ...groups[1].querySelectorAll<HTMLInputElement>('input[type="range"]'),
      ].map((input) => input.value),
    ).toEqual(["25", "75"]);
    expect(groups[1].hasAttribute("data-disabled")).toBe(false);
  } finally {
    await h.dispose();
  }
});

it("SelectBoxGroup inherits multiple selection and keeps own overrides", async () => {
  const change = vi.fn();
  const h = await mount(
    createElement(ListBoxContext.Provider, {
      value: {
        slots: {
          cards: {
            selectionMode: "multiple",
            defaultSelectedKeys: ["one"],
            "aria-label": "Cards",
          },
        },
      },
      children: createElement(
        "div",
        null,
        createElement(SelectBoxGroup, {
          slot: "cards",
          onSelectionChange: change,
        }),
        createElement(SelectBoxGroup, {
          slot: "cards",
          selectionMode: "single",
          "aria-label": "Single cards",
        }),
      ),
    }),
  );
  try {
    const groups = h.target.querySelectorAll('[role="listbox"]');
    expect(groups[0].getAttribute("aria-multiselectable")).toBe("true");
    expect(groups[1].getAttribute("aria-multiselectable")).toBeNull();
    const options = groups[0].querySelectorAll('[role="option"]');
    await userEvent.click(options[1]);
    expect([...change.mock.calls.at(-1)![0]]).toEqual(["one", "two"]);
  } finally {
    await h.dispose();
  }
});

it.each(["S", "M", "L", "XL"] as const)(
  "LabeledValue %s default text uses the catalog size",
  async (size) => {
    const h = await mount(
      createElement(LabeledValue, { size, label: "Label", value: "Value" }),
    );
    try {
      const owner = h.target.querySelector(".react-aria-LabeledValue")!;
      for (const part of owner.querySelectorAll(".react-aria-Text")) {
        expect(getComputedStyle(part).fontSize).toBe(
          getComputedStyle(owner).fontSize,
        );
        expect(getComputedStyle(part).lineHeight).toBe(
          getComputedStyle(owner).lineHeight,
        );
      }
    } finally {
      await h.dispose();
    }
  },
);

it("LabeledValue explicit child typography wins over the default part styling", async () => {
  const h = await mount(
    createElement(
      LabeledValue,
      { size: "S" },
      createElement(
        Text,
        { slot: "label", style: { fontSize: 21, lineHeight: "30px" } },
        "Authored label",
      ),
      createElement(
        Text,
        { slot: "value", style: { fontSize: 24 } },
        "Authored value",
      ),
    ),
  );
  try {
    expect(
      getComputedStyle(h.target.querySelector('[slot="label"]')!).fontSize,
    ).toBe("21px");
    expect(
      getComputedStyle(h.target.querySelector('[slot="label"]')!).lineHeight,
    ).toBe("30px");
    expect(
      getComputedStyle(h.target.querySelector('[slot="value"]')!).fontSize,
    ).toBe("24px");
  } finally {
    await h.dispose();
  }
});

it.each(["action", "missing", false] as const)(
  "LinkButton handles named, unknown and detached slot %s through LinkContext",
  async (slot) => {
    const h = await mount(
      createElement(LinkContext.Provider, {
        value: {
          slots: {
            action: { isDisabled: true, "aria-label": "Provided navigation" },
          },
        },
        children: createElement(RacSlotScope, {
          context: "Link",
          authored: slot,
          render: (resolution) =>
            createElement(
              LinkButton,
              { href: "#link", ...racSlotProps(resolution) },
              "Open",
            ),
        }),
      }),
    );
    try {
      const link = h.target.querySelector(".react-aria-LinkButton")!;
      expect(link.tagName).toBe(slot === "action" ? "SPAN" : "A");
      expect(link.getAttribute("aria-disabled") === "true").toBe(
        slot === "action",
      );
      expect(link.getAttribute("slot")).toBe(
        slot === "action" ? "action" : null,
      );
      expect(link.getAttribute("aria-label")).toBe(
        slot === "action" ? "Provided navigation" : null,
      );
    } finally {
      await h.dispose();
    }
  },
);

it("ActionBar consumes its named context before defaults and clear/Escape reach the inherited callback once", async () => {
  const clear = vi.fn();
  const h = await mount(
    createElement(ActionBarContext.Provider, {
      value: {
        slots: { selection: { selectedItemCount: 2, onClearSelection: clear } },
      },
      children: createElement(ActionBar, { slot: "selection" }),
    }),
  );
  try {
    const bar = h.target.querySelector(".react-aria-ActionBar")!;
    expect(bar.textContent).toContain("2");
    const button = bar.querySelector('[aria-label="Clear selection"]')!;
    await userEvent.click(button);
    expect(clear).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(clear).toHaveBeenCalledTimes(2);
  } finally {
    await h.dispose();
  }
});

it("ActionBar slot null detaches the inherited count and own values remain authoritative", async () => {
  const h = await mount(
    createElement(ActionBarContext.Provider, {
      value: { selectedItemCount: 2 },
      children: createElement(
        "div",
        null,
        createElement(ActionBar, { slot: null }),
        createElement(ActionBar, { selectedItemCount: 1 }),
      ),
    }),
  );
  try {
    const bars = h.target.querySelectorAll(".react-aria-ActionBar");
    expect(bars).toHaveLength(1);
    expect(bars[0].textContent).toContain("1");
  } finally {
    await h.dispose();
  }
});

it.each([false, true])(
  "LinkButton custom native render preserves ref, language and disabled=%s",
  async (isDisabled) => {
    const ref = createRef<HTMLAnchorElement>();
    const press = vi.fn();
    const h = await mount(
      createElement(
        LinkButton,
        {
          href: "#custom-link",
          hrefLang: "ko",
          isDisabled,
          ref,
          onPress: press,
          onClick: (event) => event.preventDefault(),
          render: (props, state) =>
            "href" in props && !state.isDisabled
              ? createElement("a", { ...props, "data-custom-link": "yes" })
              : createElement("span", { ...props, "data-custom-link": "yes" }),
        },
        "Custom link",
      ),
    );
    try {
      const link = h.target.querySelector<HTMLElement>(
        '[data-custom-link="yes"]',
      )!;
      expect(ref.current).toBe(link);
      expect(link.tagName).toBe(isDisabled ? "SPAN" : "A");
      expect(link.getAttribute("hreflang")).toBe(isDisabled ? null : "ko");
      if (isDisabled) await act(async () => link.click());
      else await userEvent.click(link);
      expect(press).toHaveBeenCalledTimes(isDisabled ? 0 : 1);
    } finally {
      await h.dispose();
    }
  },
);
