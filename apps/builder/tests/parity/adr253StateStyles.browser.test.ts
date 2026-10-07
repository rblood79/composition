import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterAll, beforeAll, expect, it } from "vitest";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { withCatalogStateStyles } from "../../../../packages/shared/src/catalog/runtime/stateStyles";
import type { StateName } from "../../../../packages/shared/src/catalog/document/types";

// The generated production sheet, not jsdom's incomplete CSS custom-property cascade.
const host = document.createElement("div");
const sheet = document.createElement("style");
const root = createRoot(host);
beforeAll(() => {
  sheet.textContent = bundleCss;
  document.head.append(sheet);
  document.body.append(host);
});
afterAll(() => {
  root.unmount();
  host.remove();
  sheet.remove();
});

const cases: Array<[StateName, string[]]> = [
  ["hover", ["hovered"]],
  ["pressed", ["hovered", "pressed"]],
  ["focusVisible", ["focus-visible"]],
  ["selected", ["selected"]],
  ["selectedHover", ["selected", "hovered"]],
  ["selectedPressed", ["selected", "hovered", "pressed"]],
  ["disabled", ["selected", "hovered", "pressed", "focus-visible", "disabled"]],
];
it.each(cases)(
  "%s overrides rest, then releases only its explicit keys",
  (state, flags) => {
    const element = (active: boolean) =>
      withCatalogStateStyles(
        createElement(
          "div",
          {
            style: { backgroundColor: "#123456", borderRadius: 4, padding: 3 },
            ...(active
              ? Object.fromEntries(flags.map((flag) => [`data-${flag}`, true]))
              : {}),
          },
          createElement("span", null, "child"),
        ),
        {
          // Equal to rest remains explicit; a different state channel must not mask it.
          [state]: { backgroundColor: "#123456", borderRadius: 11 },
        },
      );
    flushSync(() => root.render(element(true)));
    const node = host.firstElementChild as HTMLElement;
    expect(getComputedStyle(node).backgroundColor).toBe("rgb(18, 52, 86)");
    expect(getComputedStyle(node).borderTopLeftRadius).toBe("11px");
    expect(getComputedStyle(node).paddingTop).toBe("3px");
    expect(getComputedStyle(node.firstElementChild!).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    );
    flushSync(() => root.render(element(false)));
    expect(getComputedStyle(node).borderTopLeftRadius).toBe("4px");
  },
);

it("selected-hover and disabled win when state flags overlap; removed writes leave no style", () => {
  const draw = (disabled: boolean, states = true) =>
    withCatalogStateStyles(
      createElement("button", {
        "data-selected": true,
        "data-hovered": true,
        "data-disabled": disabled || undefined,
      }),
      states
        ? {
            hover: { backgroundColor: "#111111" },
            selected: { backgroundColor: "#222222" },
            selectedHover: { backgroundColor: "#333333" },
            disabled: { backgroundColor: "#444444" },
          }
        : undefined,
    );
  flushSync(() => root.render(draw(false)));
  const node = host.firstElementChild!;
  expect(getComputedStyle(node).backgroundColor).toBe("rgb(51, 51, 51)");
  flushSync(() => root.render(draw(true)));
  expect(getComputedStyle(node).backgroundColor).toBe("rgb(68, 68, 68)");
  flushSync(() => root.render(draw(false, false)));
  expect(node.hasAttribute("data-catalog-hover")).toBe(false);
  expect(
    (node as HTMLElement).style.getPropertyValue(
      "--catalog-hover-background-color",
    ),
  ).toBe("");
});
