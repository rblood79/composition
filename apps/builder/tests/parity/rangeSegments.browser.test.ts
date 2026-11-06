import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import {
  Provider as SpectrumProvider,
  SegmentedControl as SpectrumSegments,
  SegmentedControlItem as SpectrumItem,
} from "@react-spectrum/s2";
import {
  RangeSlider,
  SliderThumb,
} from "@composition/shared/components/RangeSlider";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@composition/shared/components/SegmentedControl";
import {
  Label,
  SliderTrack,
  SliderFill,
  SliderOutput,
  SelectionIndicator,
} from "react-aria-components";
import cssText from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

const hosts: HTMLDivElement[] = [];
afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});
async function mount(content: ReturnType<typeof createElement>) {
  const host = document.body.appendChild(document.createElement("div"));
  hosts.push(host);
  const style = host.appendChild(document.createElement("style"));
  style.textContent = cssText;
  injectPreviewBaseStyles(document);
  const target = host.appendChild(document.createElement("div"));
  const root = createRoot(target);
  await act(async () => root.render(content));
  return { host: target, root };
}

it("public RangeSlider used by Code View has two named inputs and RangeValue callbacks", async () => {
  let next: unknown;
  const h = await mount(
    createElement(
      RangeSlider,
      {
        defaultValue: { start: 15, end: 85 },
        startName: "from",
        endName: "to",
        size: "L",
        onChange: (value) => (next = value),
      },
      createElement(Label, null, "Range"),
      createElement(SliderOutput),
      createElement(
        SliderTrack,
        null,
        createElement(SliderFill),
        createElement(SliderThumb, { index: 0 }),
        createElement(SliderThumb, { index: 1 }),
      ),
    ),
  );
  try {
    const inputs = [
      ...h.host.querySelectorAll('input[type="range"]'),
    ] as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(["15", "85"]);
    expect(inputs.map((input) => input.name)).toEqual(["from", "to"]);
    expect(
      h.host
        .querySelector(".react-aria-RangeSlider")
        ?.getAttribute("data-size"),
    ).toBe("L");
    inputs[0].focus();
    await act(async () => {
      inputs[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(next).toEqual({ start: 16, end: 85 });
  } finally {
    await act(async () => h.root.unmount());
  }
});

it("folded Code View defaults render the same authored compositions", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(RangeSlider),
      createElement(SegmentedControl),
      createElement(
        SegmentedControl,
        { "aria-label": "Edited" },
        createElement(SegmentedControlItem, {
          id: "edited",
          label: "Edited item",
          icon: "circle",
        }),
      ),
    ),
  );
  try {
    expect(
      [...h.host.querySelectorAll('input[type="range"]')].map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["25", "75"]);
    expect(
      [...h.host.querySelectorAll('[role="radio"]')].map(
        (item) => item.textContent,
      ),
    ).toEqual(["List", "Grid", "Edited item"]);
    expect(h.host.querySelector('[role="radio"][label]')).toBeNull();
    expect(
      h.host.querySelector('[role="radio"] .react-aria-Icon svg'),
    ).not.toBeNull();
    expect(h.host.querySelector("label")?.textContent).toBe("Range");
  } finally {
    await act(async () => h.root.unmount());
  }
});

it("SegmentedControl default geometry matches installed S2's fixed default control", async () => {
  const h = await mount(
    createElement(
      "div",
      null,
      createElement(
        SegmentedControl,
        { "aria-label": "Shared" },
        createElement(
          SegmentedControlItem,
          { id: "a" },
          createElement(SelectionIndicator),
          "List",
        ),
        createElement(
          SegmentedControlItem,
          { id: "b" },
          createElement(SelectionIndicator),
          "Grid",
        ),
      ),
      createElement(SpectrumProvider, {
        locale: "en-US",
        children: createElement(SpectrumSegments, {
          "aria-label": "Oracle",
          children: [
            createElement(SpectrumItem, {
              id: "a",
              key: "a",
              children: "List",
            }),
            createElement(SpectrumItem, {
              id: "b",
              key: "b",
              children: "Grid",
            }),
          ],
        }),
      }),
    ),
  );
  try {
    await document.fonts.ready;
    const groups = [...h.host.querySelectorAll('[role="radiogroup"]')];
    expect(groups).toHaveLength(2);
    const shared = groups[0].querySelector("button")!,
      oracle = groups[1].querySelector("button")!;
    expect(shared.getBoundingClientRect().height).toBeCloseTo(
      oracle.getBoundingClientRect().height,
      1,
    );
    expect(getComputedStyle(groups[0]).gap).toBe(
      getComputedStyle(groups[1]).gap,
    );
    const sharedItems = [...groups[0].querySelectorAll("button")];
    const firstBounds = sharedItems[0].getBoundingClientRect();
    const secondBounds = sharedItems[1].getBoundingClientRect();
    expect(secondBounds.x - firstBounds.right).toBeCloseTo(4, 1);
    expect(groups[0].getBoundingClientRect().width).toBeCloseTo(
      firstBounds.width + secondBounds.width + 4,
      1,
    );
    expect(shared.getAttribute("aria-checked")).toBe("true");
    expect(oracle.getAttribute("aria-checked")).toBe("true");
    const indicator = shared.querySelector(".react-aria-SelectionIndicator")!;
    const itemBounds = shared.getBoundingClientRect();
    const indicatorBounds = indicator.getBoundingClientRect();
    expect(indicatorBounds.x).toBeCloseTo(itemBounds.x, 1);
    expect(indicatorBounds.y).toBeCloseTo(itemBounds.y, 1);
    expect(indicatorBounds.width).toBeCloseTo(itemBounds.width, 1);
    expect(indicatorBounds.height).toBeCloseTo(itemBounds.height, 1);
  } finally {
    await act(async () => h.root.unmount());
  }
});
