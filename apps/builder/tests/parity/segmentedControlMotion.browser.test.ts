import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import {
  Provider,
  SegmentedControl as SpectrumSegments,
  SegmentedControlItem as SpectrumItem,
} from "@react-spectrum/s2";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@composition/shared/components/SegmentedControl";
import cssText from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

it("selection indicator slides and resizes with installed S2 timing", async () => {
  const host = document.body.appendChild(document.createElement("div"));
  const sheet = host.appendChild(document.createElement("style"));
  sheet.textContent = cssText;
  injectPreviewBaseStyles(document);
  const target = host.appendChild(document.createElement("div"));
  const root = createRoot(target);
  try {
    await act(async () =>
      root.render(
        createElement(
          "div",
          null,
          createElement(
            SegmentedControl,
            { "aria-label": "Shared motion" },
            createElement(SegmentedControlItem, { id: "a", label: "List" }),
            createElement(SegmentedControlItem, {
              id: "b",
              label: "Longer grid label",
            }),
          ),
          createElement(Provider, {
            children: createElement(SpectrumSegments, {
              "aria-label": "S2 motion",
              children: [
                createElement(SpectrumItem, {
                  id: "a",
                  key: "a",
                  children: "List",
                }),
                createElement(SpectrumItem, {
                  id: "b",
                  key: "b",
                  children: "Longer grid label",
                }),
              ],
            }),
          }),
        ),
      ),
    );
    await document.fonts.ready;
    await frame();
    await frame();
    const groups = [
      ...target.querySelectorAll<HTMLElement>('[role="radiogroup"]'),
    ];
    const shared = groups[0],
      oracle = groups[1];
    const before = shared.querySelector<HTMLElement>(
      ".react-aria-SelectionIndicator",
    )!;
    const oracleIndicator = oracle.querySelector<HTMLElement>(
      '[role="radio"] > div',
    )!;
    const sharedStyle = getComputedStyle(before),
      oracleStyle = getComputedStyle(oracleIndicator);
    expect(sharedStyle.transitionDuration).toBe(oracleStyle.transitionDuration);
    expect(sharedStyle.transitionProperty).toBe(oracleStyle.transitionProperty);
    expect(sharedStyle.transitionTimingFunction).toBe(
      oracleStyle.transitionTimingFunction,
    );
    const start = before.getBoundingClientRect();
    const buttons = [...shared.querySelectorAll<HTMLButtonElement>("button")];
    const destination = buttons[1].getBoundingClientRect();
    await act(async () => buttons[1].click());
    await frame();
    const indicator = buttons[1].querySelector<HTMLElement>(
      ".react-aria-SelectionIndicator",
    )!;
    const animations = indicator.getAnimations();
    expect(
      animations.map((a) => (a as CSSTransition).transitionProperty),
    ).toEqual(expect.arrayContaining(["translate", "width"]));
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 100;
    }
    await frame();
    const middle = indicator.getBoundingClientRect();
    expect(middle.x).toBeGreaterThan(start.x);
    expect(middle.x).toBeLessThan(destination.x);
    expect(middle.width).toBeGreaterThan(start.width);
    expect(middle.width).toBeLessThan(destination.width);
    for (const animation of animations) animation.finish();
    await frame();
    const end = indicator.getBoundingClientRect();
    expect(end.x).toBeCloseTo(destination.x, 1);
    expect(end.width).toBeCloseTo(destination.width, 1);
    expect(target.querySelector('[aria-label="Shared motion"]')).toBe(shared);
    // An interrupted move starts from the currently painted rectangle, not the old item.
    await act(async () => buttons[0].click());
    await frame();
    const returning = buttons[0].querySelector<HTMLElement>(
      ".react-aria-SelectionIndicator",
    )!;
    for (const animation of returning.getAnimations()) {
      animation.pause();
      animation.currentTime = 100;
    }
    await frame();
    const interrupted = returning.getBoundingClientRect();
    await act(async () => buttons[1].click());
    const reversed = buttons[1].querySelector<HTMLElement>(
      ".react-aria-SelectionIndicator",
    )!;
    expect(reversed.getBoundingClientRect().x).toBeCloseTo(interrupted.x, 0);
    expect(reversed.getBoundingClientRect().width).toBeCloseTo(
      interrupted.width,
      0,
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
