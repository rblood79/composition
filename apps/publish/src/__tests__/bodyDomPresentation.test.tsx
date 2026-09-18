// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import type { Element } from "@composition/shared";

import { ElementRenderer } from "../renderer/ElementRenderer";

describe("Publish Body DOM presentation", () => {
  it("case-correct class 하나와 CSS viewport fill만 방출한다", async () => {
    const body = {
      id: "body-1",
      type: "body",
      parent_id: null,
      page_id: "page-1",
      props: {
        className: "react-aria-body react-aria-Body",
        style: {
          display: "block",
          fontFamily: `"Pretendard", "Inter Variable", system-ui, sans-serif`,
          overflow: "auto",
        },
      },
    } as Element;

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ElementRenderer element={body} elements={[body]} />);
    });
    const rendered = host.querySelector(
      '[data-element-id="body-1"]',
    ) as HTMLElement | null;

    expect(rendered).not.toBeNull();
    expect(rendered!.className).toBe("react-aria-Body");
    expect(rendered!.getAttribute("style")).toBeNull();
    expect(rendered!.hasAttribute("data-body-viewport-fill")).toBe(true);

    await act(async () => root.unmount());
    host.remove();
  });
});
