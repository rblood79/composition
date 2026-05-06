import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "../../types/composition-document.types";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
} from "../export.utils";

const projectId = "00000000-0000-0000-0000-000000000916";

const document: CompositionDocument = {
  version: "composition-1.0",
  children: [
    {
      id: "page-home",
      type: "frame",
      name: "Home",
      children: [
        {
          id: "heading-1",
          type: "Heading",
          props: { children: "Canonical export" },
        },
      ],
    },
  ],
};

describe("project export canonical CompositionDocument payload", () => {
  it("serializes CompositionDocument as the primary project payload", () => {
    const json = serializeProjectData(
      projectId,
      "Canonical Project",
      document,
      "page-home",
    );

    const parsed = JSON.parse(json) as {
      document?: CompositionDocument;
      pages?: unknown;
      elements?: unknown;
    };

    expect(parsed.document).toEqual(document);
    expect(parsed.pages).toBeUndefined();
    expect(parsed.elements).toBeUndefined();
  });

  it("parses canonical-only project payload", () => {
    const json = serializeProjectData(
      projectId,
      "Canonical Project",
      document,
      "page-home",
    );

    const result = parseProjectData(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.document).toEqual(document);
    expect("pages" in result.data).toBe(false);
    expect("elements" in result.data).toBe(false);
  });

  it("derives publish render model from CompositionDocument", () => {
    const renderModel = deriveProjectRenderModelFromDocument(
      document,
      projectId,
      "page-home",
    );

    expect(renderModel.pages).toEqual([
      {
        id: "page-home",
        title: "Home",
        slug: "/",
        project_id: projectId,
        parent_id: null,
        order_num: 0,
      },
    ]);
    expect(renderModel.elements).toEqual([
      {
        id: "heading-1",
        type: "Heading",
        props: { children: "Canonical export" },
        parent_id: null,
        page_id: "page-home",
        order_num: 0,
      },
    ]);
  });

  it("derives page order from legacy page metadata instead of child index", () => {
    const documentWithReorderedPages: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-three",
          type: "frame",
          name: "Page 3",
          metadata: {
            type: "legacy-page",
            pageId: "page-three",
            slug: "/page-3",
            order_num: 2,
          },
          children: [],
        },
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: {
            type: "legacy-page",
            pageId: "page-home",
            slug: "/",
            order_num: 0,
          },
          children: [],
        },
        {
          id: "page-two",
          type: "frame",
          name: "Page 2",
          metadata: {
            type: "legacy-page",
            pageId: "page-two",
            slug: "/page-2",
            order_num: 1,
          },
          children: [],
        },
      ],
    };

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithReorderedPages,
      projectId,
      "page-home",
    );

    expect(renderModel.pages.map((page) => page.id)).toEqual([
      "page-home",
      "page-two",
      "page-three",
    ]);
    expect(renderModel.pages.map((page) => page.order_num)).toEqual([0, 1, 2]);
    expect(renderModel.pages.map((page) => page.slug)).toEqual([
      "/",
      "/page-2",
      "/page-3",
    ]);
  });

  it("hydrates page-frame binding RefNode with a page-owned body and frame projection", () => {
    const documentWithBinding: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "ref",
          ref: "layout-frame-1",
          name: "Home",
          metadata: {
            type: "legacy-page",
            pageId: "page-home",
            layoutId: "frame-1",
          },
        },
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "Body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-content",
                  type: "Slot",
                  props: { name: "content" },
                },
              ],
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithBinding,
      projectId,
      "page-home",
    );

    expect(renderModel.pages).toHaveLength(1);
    const page = renderModel.pages[0] as { id: string; layout_id?: string };
    expect(page.id).toBe("page-home");
    expect(page.layout_id).toBe("frame-1");

    expect(renderModel.elements).toHaveLength(3);
    const pageBody = renderModel.elements.find(
      (el) => el.id === "page-home-body",
    );
    expect(pageBody).toMatchObject({
      id: "page-home-body",
      type: "body",
      page_id: "page-home",
      parent_id: null,
    });
    expect(pageBody).not.toHaveProperty("layout_id");
    expect(pageBody?.props).toMatchObject({
      className: "react-aria-Body",
    });

    expect(
      renderModel.elements.find((el) => el.id === "frame-body"),
    ).toMatchObject({
      id: "frame-body",
      type: "body",
      page_id: "page-home",
      parent_id: null,
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === "slot-content"),
    ).toMatchObject({
      id: "slot-content",
      parent_id: "frame-body",
      page_id: "page-home",
      layout_id: "frame-1",
    });
  });

  it("preserves RefNode descendants as page-owned content when hydrating a page-frame binding", () => {
    const documentWithDescendants: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "ref",
          ref: "layout-frame-1",
          name: "Home",
          metadata: {
            type: "legacy-page",
            pageId: "page-home",
            layoutId: "frame-1",
          },
          descendants: {
            content: {
              children: [
                {
                  id: "page-body",
                  type: "body",
                  props: { className: "react-aria-Body" },
                  children: [
                    {
                      id: "page-card",
                      type: "Card",
                      props: { children: "Page content" },
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "Body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-content",
                  type: "Slot",
                  props: { name: "content" },
                },
              ],
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithDescendants,
      projectId,
      "page-home",
    );

    expect(renderModel.elements).toHaveLength(4);
    const pageBody = renderModel.elements.find((el) => el.id === "page-body");
    expect(pageBody).toMatchObject({
      id: "page-body",
      page_id: "page-home",
      parent_id: null,
    });
    expect(pageBody).not.toHaveProperty("layout_id");
    expect(
      renderModel.elements.find((el) => el.id === "page-card"),
    ).toMatchObject({
      id: "page-card",
      page_id: "page-home",
      parent_id: "page-body",
    });
    expect(
      renderModel.elements.find((el) => el.id === "page-card"),
    ).not.toHaveProperty("layout_id");
    expect(
      renderModel.elements.find((el) => el.id === "frame-body"),
    ).toMatchObject({
      id: "frame-body",
      page_id: "page-home",
      parent_id: null,
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === "slot-content"),
    ).toMatchObject({
      id: "slot-content",
      page_id: "page-home",
      parent_id: "frame-body",
      layout_id: "frame-1",
    });
  });

  it("hydrates canonical legacy-slot-hoisted frame nodes as Slot marker elements", () => {
    const documentWithHoistedSlot: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "ref",
          ref: "layout-frame-1",
          name: "Home",
          metadata: {
            type: "legacy-page",
            pageId: "page-home",
            layoutId: "frame-1",
          },
          descendants: {
            content: {
              children: [
                {
                  id: "page-body",
                  type: "body",
                  props: { className: "react-aria-Body" },
                },
              ],
            },
          },
        },
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "Body",
              props: { style: { display: "flex" } },
              children: [
                {
                  id: "slot-frame",
                  type: "frame",
                  slot: [],
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                },
              ],
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithHoistedSlot,
      projectId,
      "page-home",
    );

    expect(renderModel.elements.find((el) => el.id === "slot-frame")).toEqual(
      expect.objectContaining({
        id: "slot-frame",
        type: "Slot",
        page_id: "page-home",
        parent_id: "frame-body",
        layout_id: "frame-1",
        props: expect.objectContaining({ name: "content" }),
        slot_name: "content",
      }),
    );
  });

  it("rejects legacy-only project payload without CompositionDocument", () => {
    const legacyOnly = {
      version: "1.0.0",
      exportedAt: "2026-05-02T00:00:00.000Z",
      project: { id: projectId, name: "Legacy Only" },
      pages: [],
      elements: [],
      currentPageId: "page-home",
    };

    const result = parseProjectData(JSON.stringify(legacyOnly));

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.field).toBe("document");
  });
});
