import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const ctx = {} as unknown as RenderContext;

function renderNode(node: ResolvedNode) {
  return render(<CanonicalNodeRenderer node={node} renderContext={ctx} />)
    .container;
}

describe("CanonicalNodeRenderer page shell", () => {
  it.each(["page", "legacy-page"] as const)(
    "%s metadata의 frame page shell은 DOM box를 만들지 않는다",
    (metadataType) => {
      const page: ResolvedNode = {
        id: "page-home",
        type: "frame",
        metadata: { type: metadataType, pageId: "page-home" },
        children: [
          {
            id: "body-home",
            type: "Body",
            props: {
              _tag: "body",
              className: "react-aria-Body",
              style: { width: "390px", height: "844px" },
            },
          },
        ],
      };

      const container = renderNode(page);
      const body = container.querySelector('[data-element-id="body-home"]');

      expect(
        container.querySelector('[data-element-id="page-home"]'),
      ).toBeNull();
      expect(body).not.toBeNull();
      expect(body?.parentElement).toBe(container);
      expect(body?.className).toBe("react-aria-Body");
      expect(container.querySelector(".react-aria-frame")).toBeNull();
    },
  );

  it("frame binding page ref shell도 DOM box를 만들지 않는다", () => {
    const page: ResolvedNode = {
      id: "page-bound",
      type: "ref",
      metadata: {
        type: "legacy-page",
        pageId: "page-bound",
        layoutId: "layout-main",
      },
      children: [
        {
          id: "body-bound",
          type: "Body",
          props: { _tag: "body", className: "react-aria-Body" },
        },
      ],
    };

    const container = renderNode(page);

    expect(
      container.querySelector('[data-element-id="page-bound"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-element-id="body-bound"]'),
    ).not.toBeNull();
    expect(container.querySelector(".react-aria-ref")).toBeNull();
  });

  it("page 안의 사용자 Frame은 실제 layout container로 유지한다", () => {
    const page: ResolvedNode = {
      id: "page-home",
      type: "frame",
      metadata: { type: "page", pageId: "page-home" },
      children: [
        {
          id: "body-home",
          type: "Body",
          props: { _tag: "body", className: "react-aria-Body" },
          children: [
            {
              id: "user-frame",
              type: "frame",
              props: { style: { display: "flex" } },
            },
          ],
        },
      ],
    };

    const container = renderNode(page);
    const body = container.querySelector('[data-element-id="body-home"]');
    const frame = container.querySelector('[data-element-id="user-frame"]');

    expect(frame).not.toBeNull();
    expect(frame?.classList.contains("react-aria-frame")).toBe(true);
    expect(frame?.parentElement).toBe(body);
  });
});
