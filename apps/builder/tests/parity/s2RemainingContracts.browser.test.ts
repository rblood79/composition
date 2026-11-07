import "@react-spectrum/s2/page.css";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Avatar as SpectrumAvatar, Provider } from "@react-spectrum/s2";
import { Avatar } from "../../../../packages/shared/src/components/Avatar";
import { AVATAR_SIZE_PRESETS } from "../../../../packages/shared/src/catalog/document/avatarSizeValue";
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

it.each([...AVATAR_SIZE_PRESETS, 50.5, "1.5lh", "2lh"] as const)(
  "Avatar %s matches installed S2 geometry and outline",
  async (size) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          h(
            Provider,
            null,
            h(
              "div",
              {
                style: {
                  fontSize: 20,
                  lineHeight: "32px",
                  "--bg": "white",
                } as React.CSSProperties,
              },
              h(
                "section",
                { "data-reference": true },
                h(SpectrumAvatar, {
                  size,
                  isOverBackground: true,
                  alt: "기준",
                }),
              ),
              h(
                "section",
                { "data-own": true },
                h(Avatar, { size, isOverBackground: true, alt: "구현" }),
              ),
            ),
          ),
        ),
      );
      const reference = host.querySelector("[data-reference] [slot=avatar]")!;
      const own = host.querySelector("[data-own] > div")!;
      expect(own.getBoundingClientRect().width).toBeCloseTo(
        reference.getBoundingClientRect().width,
        2,
      );
      expect(own.getBoundingClientRect().height).toBeCloseTo(
        reference.getBoundingClientRect().height,
        2,
      );
      expect(getComputedStyle(own).outlineWidth).toBe(
        getComputedStyle(reference).outlineWidth,
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
