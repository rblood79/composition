import { describe, expect, it } from "vitest";

import { createInitialProjectDocument } from "../createInitialProjectDocument";

describe("createInitialProjectDocument", () => {
  it("seeds a canonical Home page with a body child", () => {
    const doc = createInitialProjectDocument(
      { id: "page-home", title: "Home", slug: "/" },
      { id: "body-home", type: "body", props: { width: "100%" } },
    );

    expect(doc).toEqual({
      version: "composition-1.0",
      children: [
        expect.objectContaining({
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: {
            type: "legacy-page",
            pageId: "page-home",
            slug: "/",
            parent_id: null,
          },
          children: [
            {
              id: "body-home",
              type: "body",
              props: { width: "100%" },
            },
          ],
        }),
      ],
    });
  });
});
