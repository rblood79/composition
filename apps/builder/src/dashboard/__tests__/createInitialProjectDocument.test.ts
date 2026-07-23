import { describe, expect, it } from "vitest";

import { createInitialProjectDocument } from "../createInitialProjectDocument";

describe("createInitialProjectDocument", () => {
  it("seeds a Components system page before the canonical Home page", () => {
    const doc = createInitialProjectDocument(
      { id: "page-home", title: "Home", slug: "/" },
      { id: "body-home", type: "body", props: { width: "100%" } },
    );

    expect(doc.children.map((node) => node.name)).toEqual([
      "Components",
      "Home",
    ]);
    expect(doc).toEqual({
      version: "composition-1.0",
      children: [
        expect.objectContaining({
          id: "page-components",
          type: "frame",
          name: "Components",
          metadata: {
            type: "legacy-page",
            pageId: "page-components",
            slug: "/__components",
            parent_id: null,
            pageRole: "components",
            systemOwned: true,
            previewExcluded: true,
            publishExcluded: true,
            excludeFromAutoNameCount: true,
          },
          children: [
            expect.objectContaining({
              id: "page-components-body",
              type: "body",
              // 20ac5e60d: 시스템 페이지 body 에 실제 overflow:auto 부여 (일반 페이지
              //   createDefaultBodyProps 와 대칭 — Components 스크롤바 미표시 해소).
              props: { style: { overflow: "auto" } },
              children: expect.arrayContaining([
                expect.objectContaining({
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                }),
                expect.objectContaining({
                  id: "component-listbox-item-selected",
                  type: "ListBoxItem",
                  reusable: true,
                }),
                expect.objectContaining({
                  id: "component-listbox",
                  type: "ListBox",
                  reusable: true,
                  slot: [
                    "component-listbox-item-default",
                    "component-listbox-item-selected",
                  ],
                }),
                // ADR-161 Phase 1: GridList 컨테이너 master origin + item origin
                expect.objectContaining({
                  id: "component-gridlist-item-default",
                  type: "GridListItem",
                  reusable: true,
                }),
                expect.objectContaining({
                  id: "component-gridlist",
                  type: "GridList",
                  reusable: true,
                  slot: ["component-gridlist-item-default"],
                }),
              ]),
            }),
          ],
        }),
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
