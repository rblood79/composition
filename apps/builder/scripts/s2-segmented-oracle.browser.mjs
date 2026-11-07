// 설치 S2 1.8.2를 Builder 스타일과 격리된 검증 페이지에서 측정한다.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Provider,
  SegmentedControl,
  SegmentedControlItem,
} from "@react-spectrum/s2";

let active;
export async function mountSegmentedReference({
  isDisabled = false,
  isJustified = false,
  selectedKey,
  colorScheme = "light",
  locale = "en-US",
  fontFamily,
} = {}) {
  active?.root.unmount();
  active?.host.remove();
  document.documentElement.lang = locale;
  document.documentElement.style.fontSize = "16px";
  document.body.style.margin = "24px";
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  active = { host, root };
  root.render(
    createElement(
      Provider,
      { colorScheme, locale },
      createElement(
        SegmentedControl,
        { "aria-label": "S2 View", isDisabled, isJustified, selectedKey },
        createElement(
          SegmentedControlItem,
          {
            id: "first",
            UNSAFE_style: fontFamily ? { fontFamily } : undefined,
          },
          "List",
        ),
        createElement(
          SegmentedControlItem,
          {
            id: "second",
            UNSAFE_style: fontFamily ? { fontFamily } : undefined,
          },
          "Grid",
        ),
      ),
    ),
  );
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  await document.fonts.ready;
  return sampleSegmentedReference();
}
export function sampleSegmentedReference() {
  const sample = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      selected: element.getAttribute("aria-checked"),
      focusVisible: element.hasAttribute("data-focus-visible"),
      box: element.getBoundingClientRect().toJSON(),
      styles: Object.fromEntries(
        [
          "backgroundColor",
          "color",
          "borderTopColor",
          "borderTopWidth",
          "borderRadius",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "paddingTop",
          "paddingLeft",
          "columnGap",
          "outlineColor",
          "outlineWidth",
          "outlineStyle",
          "width",
          "height",
        ].map((key) => [key, style[key]]),
      ),
    };
  };
  const items = [...document.querySelectorAll('[role="radio"]')];
  return {
    group: sample(document.querySelector('[role="radiogroup"]')),
    items: items.map(sample),
    indicator: sample(
      items.find((item) => item.getAttribute("aria-checked") === "true")
        ?.firstElementChild,
    ),
  };
}
