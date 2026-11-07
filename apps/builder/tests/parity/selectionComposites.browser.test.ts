import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Button, Text } from "react-aria-components";
import { ListBoxContext } from "react-aria-components/ListBox";
import { ActionBar } from "@composition/shared/components/ActionBar";
import { Checkbox } from "@composition/shared/components/Checkbox";
import { ActionButton } from "@composition/shared/components/ActionButton";
import {
  SelectBox,
  SelectBoxGroup,
} from "@composition/shared/components/SelectBoxGroup";
import cssText from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

async function mount(content: ReturnType<typeof createElement>) {
  const host = document.body.appendChild(document.createElement("div"));
  const style = host.appendChild(document.createElement("style"));
  style.textContent = cssText;
  injectPreviewBaseStyles(document);
  const target = host.appendChild(document.createElement("div"));
  const root = createRoot(target);
  await act(async () => root.render(content));
  return {
    host: target,
    root,
    async dispose() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("SelectBox public items preserve numeric keys, labels, callbacks and the content orientation boundary", async () => {
  let selected: unknown;
  const DynamicGroup = SelectBoxGroup<{ id: number; label: string }>;
  const h = await mount(
    createElement(DynamicGroup, {
      items: [
        { id: 0, label: "Zero" },
        { id: 2, label: "Two" },
      ],
      "aria-label": "Numeric cards",
      orientation: "horizontal",
      defaultSelectedKeys: [0],
      onSelectionChange: (keys) => {
        selected = keys;
      },
      className: () => "custom-group",
      children: (item) =>
        createElement(
          SelectBox,
          {
            id: item.id,
            textValue: item.label,
            "aria-label": `${item.label} card`,
            className: () => "custom-card",
          },
          createElement(Text, { slot: "label" }, item.label),
        ),
    }),
  );
  try {
    const group = h.host.querySelector('[role="listbox"]')!;
    const options = [...group.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(group.classList.contains("custom-group")).toBe(true);
    expect(group.getAttribute("data-orientation")).toBe("vertical");
    expect(options.map((option) => option.getAttribute("aria-label"))).toEqual([
      "Zero card",
      "Two card",
    ]);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].dataset.orientation).toBe("horizontal");
    expect(options[0].classList.contains("custom-card")).toBe(true);
    await act(async () => options[1].click());
    expect(selected instanceof Set).toBe(true);
    expect([...(selected as Set<number>)]).toEqual([2]);
  } finally {
    await h.dispose();
  }
});

it("SelectBox public all/disabled/slot context and Escape preserve native selection semantics", async () => {
  const h = await mount(
    createElement(
      ListBoxContext.Provider,
      { value: { slots: { cards: { "aria-label": "Provided cards" } } } },
      createElement(SelectBoxGroup, {
        slot: "cards",
        selectionMode: "multiple",
        defaultSelectedKeys: "all",
        disabledKeys: ["two"],
        escapeKeyBehavior: "none",
        autoFocus: "last",
      }),
    ),
  );
  try {
    const group = h.host.querySelector('[role="listbox"]')!;
    const options = [...group.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(group.getAttribute("aria-label")).toBe("Provided cards");
    expect(group.getAttribute("slot")).toBe("cards");
    expect(options[1].getAttribute("aria-disabled")).toBe("true");
    const before = options.map((option) =>
      option.getAttribute("aria-selected"),
    );
    await act(async () =>
      group.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(
      options.map((option) => option.getAttribute("aria-selected")),
    ).toEqual(before);
    await act(async () =>
      h.root.render(
        createElement(SelectBoxGroup, {
          isDisabled: true,
          selectionMode: "multiple",
          selectedKeys: [],
          defaultSelectedKeys: "all",
        }),
      ),
    );
    expect(
      [...h.host.querySelectorAll('[role="option"]')].every(
        (option) =>
          option.getAttribute("aria-disabled") === "true" &&
          option.getAttribute("aria-selected") === "false",
      ),
    ).toBe(true);
  } finally {
    await h.dispose();
  }
});

it("ActionBar light and dark foreground keeps button state and explicit text color", async () => {
  const h = await mount(
    createElement(
      ActionBar,
      { selectedItemCount: 1, isEmphasized: true },
      createElement(Text, { slot: "count" }, "1 selected"),
      createElement(
        ActionButton,
        { slot: "clear" },
        createElement(Text, null, "Clear"),
      ),
      createElement(
        ActionButton,
        { isDisabled: true },
        createElement(Text, null, "Disabled"),
      ),
      createElement(Text, { style: { color: "rgb(180, 0, 180)" } }, "Authored"),
    ),
  );
  try {
    const bar = h.host.querySelector<HTMLElement>(".react-aria-ActionBar")!;
    for (const [background, foreground] of [
      ["#171717", "#ffffff"],
      ["#f5f5f5", "#111111"],
    ]) {
      h.host.style.setProperty("--fg", background);
      h.host.style.setProperty("--on-neutral", foreground);
      const texts = [...bar.querySelectorAll<HTMLElement>(".react-aria-Text")];
      expect(
        getComputedStyle(
          texts.find((text) => text.textContent === "1 selected")!,
        ).color,
      ).toBe(
        foreground === "#ffffff" ? "rgb(255, 255, 255)" : "rgb(17, 17, 17)",
      );
      expect(
        getComputedStyle(texts.find((text) => text.textContent === "Clear")!)
          .color,
      ).toBe(getComputedStyle(bar.querySelector("button")!).color);
      const disabled = texts.find((text) => text.textContent === "Disabled")!;
      expect(getComputedStyle(disabled).color).toBe(
        getComputedStyle(disabled.closest("button")!).color,
      );
      expect(getComputedStyle(disabled).color).not.toBe(
        getComputedStyle(bar.querySelector("button")!).color,
      );
      expect(
        getComputedStyle(texts.find((text) => text.textContent === "Authored")!)
          .color,
      ).toBe("rgb(180, 0, 180)");
    }
  } finally {
    await h.dispose();
  }
});

it("folded Code View wrappers render the same origin defaults without explicit children", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(ActionBar, { selectedItemCount: 1 }),
      createElement(SelectBoxGroup),
    ),
  );
  try {
    const bar = h.host.querySelector(".react-aria-ActionBar")!;
    expect(bar.textContent).toContain("1 selected");
    expect(bar.textContent).toContain("Edit");
    expect(bar.textContent).toContain("Delete");
    expect(bar.querySelector('button[slot="clear"]')).not.toBeNull();
    const options = [
      ...h.host.querySelectorAll<HTMLElement>('[role="option"]'),
    ];
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Option one");
    expect(options[1].textContent).toContain("Option two");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].querySelectorAll("input")).toHaveLength(0);
    expect(options[0].getBoundingClientRect().height).toBe(170);
  } finally {
    await h.dispose();
  }
});

it("public ActionBar consumes generated size, emphasized paint and the real clear slot", async () => {
  let count = 0;
  const h = await mount(
    createElement(
      ActionBar,
      {
        selectedItemCount: "all",
        isEmphasized: true,
        onClearSelection: () => count++,
      },
      createElement(Button, { slot: "clear" }, "Clear"),
      createElement(Text, null, "All selected"),
    ),
  );
  try {
    const bar = h.host.querySelector<HTMLElement>(".react-aria-ActionBar")!;
    expect(bar.dataset.size).toBe("M");
    expect(bar.dataset.emphasized).toBe("true");
    expect(getComputedStyle(bar).paddingLeft).toBe("8px");
    expect(getComputedStyle(bar).paddingTop).toBe("12px");
    expect(getComputedStyle(bar).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    const emphasizedPaint = getComputedStyle(bar).backgroundColor;
    await act(async () =>
      h.root.render(createElement(ActionBar, { selectedItemCount: 1 })),
    );
    expect(
      getComputedStyle(h.host.querySelector(".react-aria-ActionBar")!)
        .backgroundColor,
    ).not.toBe(emphasizedPaint);
    await act(async () =>
      h.root.render(
        createElement(
          ActionBar,
          {
            selectedItemCount: "all",
            isEmphasized: true,
            onClearSelection: () => count++,
          },
          createElement(Button, { slot: "clear" }, "Clear"),
        ),
      ),
    );
    const currentBar = h.host.querySelector(".react-aria-ActionBar")!;
    const clear = currentBar.querySelector("button")!;
    expect(clear.getAttribute("aria-label")).toBe("Clear selection");
    await act(async () => clear.click());
    expect(count).toBe(1);
    await act(async () => {
      clear.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(count).toBe(2);
    await act(async () =>
      h.root.render(createElement(ActionBar, { selectedItemCount: 0 })),
    );
    expect(h.host.querySelector(".react-aria-ActionBar")).toBeNull();
  } finally {
    await h.dispose();
  }
});

it("public SelectBox keeps selection Checkbox presentational and options keyboard selectable", async () => {
  let selected: unknown;
  const h = await mount(
    createElement(
      SelectBoxGroup,
      {
        "aria-label": "Options",
        orientation: "horizontal",
        selectionMode: "multiple",
        onSelectionChange: (value) => (selected = value),
      },
      ...["one", "two"].map((id) =>
        createElement(
          SelectBox,
          { id, key: id },
          createElement(Checkbox, { slot: "selection" }),
          createElement(
            "div",
            null,
            createElement(Text, { slot: "label" }, id),
            createElement(
              Text,
              { slot: "description", style: { display: "block" } },
              "Edited description",
            ),
          ),
        ),
      ),
    ),
  );
  try {
    const options = [
      ...h.host.querySelectorAll<HTMLElement>('[role="option"]'),
    ];
    expect(options).toHaveLength(2);
    expect(h.host.querySelectorAll("input")).toHaveLength(0);
    expect(options[0].dataset.orientation).toBe("horizontal");
    expect(options[0].getBoundingClientRect().width).toBe(368);
    expect(options[0].getBoundingClientRect().height).toBe(80);
    const unselectedBorder = getComputedStyle(options[1]).borderColor;
    options[1].focus();
    await act(async () => {
      options[1].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          bubbles: true,
        }),
      );
      options[1].dispatchEvent(
        new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true }),
      );
    });
    expect(selected instanceof Set).toBe(true);
    expect([...(selected as Set<string>)]).toEqual(["two"]);
    expect(
      options[1]
        .querySelector('[slot="selection"]')
        ?.getAttribute("data-selected"),
    ).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(getComputedStyle(options[1]).borderTopWidth).toBe("2px");
    expect(getComputedStyle(options[1]).borderTopStyle).toBe("solid");
    expect(getComputedStyle(options[1]).borderColor).not.toBe(unselectedBorder);
  } finally {
    await h.dispose();
  }
});

it("public vertical SelectBox consumes authored dimensions and disabled paint without affecting outside Checkbox", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(
        SelectBoxGroup,
        { "aria-label": "Disabled options", isDisabled: true },
        createElement(
          SelectBox,
          { id: "one" },
          createElement(Checkbox, { slot: "selection" }),
          createElement(Text, { slot: "label" }, "One"),
          createElement(
            Text,
            { slot: "description", style: { display: "block" } },
            "Edited description",
          ),
        ),
      ),
      createElement(Checkbox, null, "Outside"),
    ),
  );
  try {
    const option = h.host.querySelector<HTMLElement>('[role="option"]')!;
    expect(option.getAttribute("aria-disabled")).toBe("true");
    expect(option.getBoundingClientRect().width).toBe(170);
    expect(option.getBoundingClientRect().height).toBe(170);
    expect(getComputedStyle(option).paddingTop).toBe("24px");
    expect(getComputedStyle(option).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(option.querySelectorAll("input")).toHaveLength(0);
    expect(option.querySelector('[slot="description"]')).toBeNull();
    expect(h.host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(
      getComputedStyle(option.querySelector('[slot="selection"]')!).display,
    ).toBe("none");
  } finally {
    await h.dispose();
  }
});

it("SelectBox slot defaults survive fallback and selection callbacks run once", async () => {
  let calls = 0;
  const h = await mount(
    createElement(
      ListBoxContext.Provider,
      {
        value: {
          slots: {
            cards: {
              defaultSelectedKeys: ["two"],
              onSelectionChange: () => {
                calls += 1;
              },
            },
          },
        },
      },
      createElement(
        SelectBoxGroup,
        { slot: "cards" },
        createElement(SelectBox, { id: "one", textValue: "One" }, "One"),
        createElement(SelectBox, { id: "two", textValue: "Two" }, "Two"),
      ),
    ),
  );
  try {
    const options = [
      ...h.host.querySelectorAll<HTMLElement>('[role="option"]'),
    ];
    expect(
      options.map((option) => option.getAttribute("aria-selected")),
    ).toEqual(["false", "true"]);
    await act(async () => options[0].click());
    expect(calls).toBe(1);
  } finally {
    await h.dispose();
  }
});
