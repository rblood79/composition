import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ToggleButtonGroupContext } from "react-aria-components/ToggleButtonGroup";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@composition/shared/components/SegmentedControl";

async function mount(content: ReturnType<typeof createElement>) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const target = document.body.appendChild(document.createElement("div"));
  const root = createRoot(target);
  const render = async (next: ReturnType<typeof createElement>) => {
    await act(async () => root.render(next));
  };
  await render(content);
  return {
    target,
    render,
    async dispose() {
      await act(async () => root.unmount());
      target.remove();
    },
  };
}

const items = () => [
  createElement(SegmentedControlItem, {
    key: "first",
    id: "first",
    label: "First",
  }),
  createElement(SegmentedControlItem, {
    key: "second",
    id: "second",
    label: "Second",
  }),
];

it("inherits the slotted initial selection, accessible name and keyboard axis", async () => {
  const h = await mount(
    createElement(ToggleButtonGroupContext.Provider, {
      value: {
        slots: {
          views: {
            defaultSelectedKeys: ["second"],
            orientation: "vertical",
            "aria-label": "Slotted views",
          },
        },
      },
      children: createElement(SegmentedControl, { slot: "views" }, ...items()),
    }),
  );
  try {
    const group = h.target.querySelector('[role="radiogroup"]')!;
    const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
    expect(
      buttons.map((button) => button.getAttribute("aria-checked")),
    ).toEqual(["false", "true"]);
    expect(group.getAttribute("aria-label")).toBe("Slotted views");
    expect(group.getAttribute("aria-orientation")).toBe("vertical");
    await act(async () => buttons[1].focus());
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(buttons[0]);
    await userEvent.keyboard(" ");
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard(" ");
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
  } finally {
    await h.dispose();
  }
});

it("preserves controlled context selection without selecting the first item on mount", async () => {
  const change = vi.fn();
  const content = (key: string) =>
    createElement(ToggleButtonGroupContext.Provider, {
      value: {
        selectedKeys: [key],
        onSelectionChange: change,
        "aria-label": "Views",
      },
      children: createElement(SegmentedControl, null, ...items()),
    });
  const h = await mount(content("second"));
  try {
    expect(change).not.toHaveBeenCalled();
    expect(h.target.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "Second",
    );
    await h.render(content("first"));
    expect(h.target.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "First",
    );
    expect(change).not.toHaveBeenCalled();
  } finally {
    await h.dispose();
  }
});

it("own values override inherited defaults and selection events reach each handler once", async () => {
  const inherited = vi.fn();
  const own = vi.fn();
  const h = await mount(
    createElement(ToggleButtonGroupContext.Provider, {
      value: {
        defaultSelectedKeys: ["second"],
        orientation: "vertical",
        "aria-label": "Inherited",
        onSelectionChange: inherited,
      },
      children: createElement(
        SegmentedControl,
        {
          defaultSelectedKey: "first",
          orientation: "horizontal",
          "aria-label": "Own views",
          onSelectionChange: own,
        },
        ...items(),
      ),
    }),
  );
  try {
    const group = h.target.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe("Own views");
    expect(group.getAttribute("aria-orientation")).toBe("horizontal");
    expect(group.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "First",
    );
    await userEvent.click(group.querySelectorAll("button")[1]);
    expect(own).toHaveBeenCalledExactlyOnceWith("second");
    expect(inherited).toHaveBeenCalledTimes(1);
    expect([...inherited.mock.calls[0][0]]).toEqual(["second"]);
  } finally {
    await h.dispose();
  }
});

it("slot null detaches selection, disabled and name from the parent context", async () => {
  const inherited = vi.fn();
  const h = await mount(
    createElement(ToggleButtonGroupContext.Provider, {
      value: {
        defaultSelectedKeys: ["second"],
        isDisabled: true,
        "aria-label": "Inherited",
        onSelectionChange: inherited,
      },
      children: createElement(SegmentedControl, { slot: null }, ...items()),
    }),
  );
  try {
    const group = h.target.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe("View");
    expect(group.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "First",
    );
    expect(
      [...group.querySelectorAll<HTMLButtonElement>("button")].every(
        (button) => !button.disabled,
      ),
    ).toBe(true);
    expect(inherited).not.toHaveBeenCalled();
  } finally {
    await h.dispose();
  }
});

it("keeps render-function children inside the RAC group state and custom layout", async () => {
  const h = await mount(
    createElement(SegmentedControl, {
      defaultSelectedKey: "second",
      "aria-label": "Rendered views",
      children: ({ state }) =>
        createElement("div", {
          "data-selected": [...state.selectedKeys].join(","),
          children: items(),
        }),
    }),
  );
  try {
    const layout = h.target.querySelector("[data-selected]")!;
    expect(layout.getAttribute("data-selected")).toBe("second");
    expect(layout.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "Second",
    );
    await userEvent.click(layout.querySelectorAll("button")[0]);
    expect(layout.getAttribute("data-selected")).toBe("first");
    expect(layout.querySelector('[aria-checked="true"]')?.textContent).toBe(
      "First",
    );
  } finally {
    await h.dispose();
  }
});

it("does not replace an inherited labelledby with a fallback accessible name", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement("span", { id: "views-title" }, "View options"),
      createElement(ToggleButtonGroupContext.Provider, {
        value: { "aria-labelledby": "views-title" },
        children: createElement(SegmentedControl, null, ...items()),
      }),
    ),
  );
  try {
    const group = h.target.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-labelledby")).toContain("views-title");
    expect(group.hasAttribute("aria-label")).toBe(false);
  } finally {
    await h.dispose();
  }
});
