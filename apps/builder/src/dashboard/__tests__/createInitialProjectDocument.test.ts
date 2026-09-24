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
              // ADR-228 Decision 4: origin 전집을 카테고리 순 grid (flex wrap) 로 흐르게 한다.
              props: {
                style: expect.objectContaining({
                  overflow: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 24,
                  padding: 24,
                }),
              },
              children: expect.arrayContaining([
                // ADR-234: 항목 origin = 선택 상태 (id 유지) · 휴지 모양은 origin 의 ref 변형 · slot 은
                //   [휴지, origin] (소비처 규칙 "slot[0] = 기본 · variant selected = 선택").
                expect.objectContaining({
                  id: "component-listbox-item-default",
                  type: "ListBoxItem",
                  reusable: true,
                  metadata: expect.objectContaining({ variant: "selected" }),
                }),
                expect.objectContaining({
                  id: "component-listbox-item-default--unselected",
                  type: "ref",
                  ref: "component-listbox-item-default",
                  reusable: true,
                }),
                expect.objectContaining({
                  id: "component-listbox",
                  type: "ListBox",
                  reusable: true,
                  // ADR-238 Phase 2 — section origin 추천.
                  slot: [
                    "component-listbox-item-default--unselected",
                    "component-listbox-item-default",
                    "component-listbox-section",
                  ],
                }),
                // ADR-161 Phase 1: GridList 컨테이너 master origin + item origin
                expect.objectContaining({
                  id: "component-gridlist-item-default",
                  type: "GridListItem",
                  reusable: true,
                }),
                // ADR-237 Phase 2: GridListItem 도 origin = 선택 상태 + `--unselected` — slot [휴지, origin].
                expect.objectContaining({
                  id: "component-gridlist",
                  type: "GridList",
                  reusable: true,
                  slot: [
                    "component-gridlist-item-default--unselected",
                    "component-gridlist-item-default",
                    "component-gridlist-section",
                  ],
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
