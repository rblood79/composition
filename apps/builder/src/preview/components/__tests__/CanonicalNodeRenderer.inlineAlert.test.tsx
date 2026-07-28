import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const ctx = {} as unknown as RenderContext;

describe("CanonicalNodeRenderer — InlineAlert DOM host", () => {
  it("InlineAlert를 raw custom tag가 아닌 alert div로 렌더한다", () => {
    const node: ResolvedNode = {
      id: "inline-alert-1",
      type: "InlineAlert",
      props: {
        children: "Something needs attention",
        variant: "notice",
        size: "md",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["InlineAlert"])}
      />,
    );

    expect(container.querySelector("inlinealert")).toBeNull();

    const alert = container.querySelector("div.react-aria-InlineAlert");
    expect(alert).not.toBeNull();
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.getAttribute("aria-live")).toBe("polite");
  });
});
