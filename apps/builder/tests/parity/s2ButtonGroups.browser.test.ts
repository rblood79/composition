import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, afterAll, expect, it } from "vitest";
import { ToggleButton } from "@composition/shared/components/ToggleButton";
import { ToggleButtonGroup } from "@composition/shared/components/ToggleButtonGroup";
import { ActionButton } from "@composition/shared/components/ActionButton";
import { ActionButtonGroup } from "@composition/shared/components/ActionButtonGroup";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

const css = document.createElement("style");
const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  css.textContent = bundleCss + "\nbutton { transition: none !important; }";
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
const cases = (["ActionButton", "ToggleButton"] as const).flatMap((type) =>
  (["XS", "S", "M", "L", "XL"] as const).flatMap((size) =>
    (["horizontal", "vertical"] as const).flatMap((orientation) =>
      (["regular", "compact"] as const).map((density) => ({
        type,
        size,
        orientation,
        density,
      })),
    ),
  ),
);
// S2 1.8.2 ActionButtonGroup.actionGroupStyle와 ActionButton.btnStyles의 독립 기준.
it.each(cases)(
  "$type $size $orientation $density",
  async ({ type, size, orientation, density }) => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    try {
      const props = {
        size,
        density,
        orientation,
        staticColor: "black" as const,
        isQuiet: true,
      };
      const content = ["first", "last"].map((id) => {
        const buttonProps = { id, key: id, "data-catalog-id": id };
        return type === "ActionButton"
          ? createElement(ActionButton, buttonProps, id)
          : createElement(ToggleButton, buttonProps, id);
      });
      await act(async () =>
        root.render(
          type === "ActionButton"
            ? createElement(ActionButtonGroup, props, content)
            : createElement(ToggleButtonGroup, props, content),
        ),
      );
      const group = host.firstElementChild!;
      const buttons = [...host.querySelectorAll("button")];
      const gap =
        density === "compact" ? 2 : size === "XS" || size === "S" ? 4 : 8;
      expect(getComputedStyle(group).gap).toBe(`${gap}px`);
      const [a, b] = buttons.map((button) => button.getBoundingClientRect());
      expect(
        orientation === "horizontal" ? b!.left - a!.right : b!.top - a!.bottom,
      ).toBeCloseTo(gap, 1);
      const corner = { XS: 6, S: 7, M: 8, L: 9, XL: 10 }[size];
      for (const [index, button] of buttons.entries()) {
        expect(button.dataset.quiet).toBe("true");
        expect(button.dataset.staticColor).toBe("black");
        const style = getComputedStyle(button);
        expect(style.marginInlineStart).toBe("0px");
        expect(style.marginBlockStart).toBe("0px");
        expect(style.borderTopLeftRadius).toBe(
          `${density === "regular" || index === 0 ? corner : 0}px`,
        );
        expect(style.borderBottomRightRadius).toBe(
          `${density === "regular" || index === 1 ? corner : 0}px`,
        );
        button.dataset.pressed = "true";
        button.style.setProperty("--catalog-press-width", "100px");
        button.style.setProperty("--catalog-press-height", "32px");
        expect(getComputedStyle(button).transform).not.toBe("none");
        delete button.dataset.pressed;
        button.dataset.focusVisible = "true";
        expect(getComputedStyle(button).outlineColor).toBe("rgb(0, 0, 0)");
        expect(getComputedStyle(button).outlineWidth).toBe("2px");
        expect(getComputedStyle(button).outlineOffset).toBe("2px");
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);

it.each(["single", "multiple"] as const)(
  "ToggleButtonGroup %s 선택과 방향키·Space",
  async (selectionMode) => {
    const { userEvent } = await import("vitest/browser");
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          createElement(
            ToggleButtonGroup,
            { selectionMode, "aria-label": "Tools" },
            createElement(ToggleButton, { id: "first" }, "First"),
            createElement(ToggleButton, { id: "last" }, "Last"),
          ),
        ),
      );
      const [first, last] = [...host.querySelectorAll("button")];
      await act(async () => userEvent.click(first!));
      expect(first!.hasAttribute("data-selected")).toBe(true);
      await act(async () => userEvent.keyboard("{ArrowRight}"));
      expect(document.activeElement).toBe(last);
      await act(async () => userEvent.keyboard(" "));
      expect(last!.hasAttribute("data-selected")).toBe(true);
      expect(first!.hasAttribute("data-selected")).toBe(
        selectionMode === "multiple",
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
