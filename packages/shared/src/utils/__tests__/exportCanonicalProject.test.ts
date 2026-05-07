import { describe, expect, it } from "vitest";

import type { CompositionDocument } from "../../types/composition-document.types";
import {
  deriveProjectRenderModelFromDocument,
  parseProjectData,
  serializeProjectData,
  toPageFrameElementId,
} from "../export.utils";

const COMPONENT_ROLE_MIRROR_FIELD = "componentRole" as const;
const COMPONENT_MASTER_MIRROR_FIELD = "masterId" as const;

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

  it("derives page order from document children and mirrors legacy order numbers", () => {
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
            parent_id: "page-two",
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
      "page-three",
      "page-home",
      "page-two",
    ]);
    expect(renderModel.pages.map((page) => page.order_num)).toEqual([0, 1, 2]);
    expect(renderModel.pages.map((page) => page.slug)).toEqual([
      "/page-3",
      "/",
      "/page-2",
    ]);
    expect(renderModel.pages.map((page) => page.parent_id)).toEqual([
      "page-two",
      null,
      null,
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

    const frameBodyId = toPageFrameElementId("page-home", "frame-body");
    const slotContentId = toPageFrameElementId("page-home", "slot-content");
    expect(
      renderModel.elements.find((el) => el.id === frameBodyId),
    ).toMatchObject({
      id: frameBodyId,
      type: "body",
      page_id: "page-home",
      parent_id: null,
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === slotContentId),
    ).toMatchObject({
      id: slotContentId,
      parent_id: frameBodyId,
      page_id: "page-home",
      layout_id: "frame-1",
    });
  });

  it("hydrates the same frame on multiple pages with page-scoped projection ids", () => {
    const documentWithSharedBinding: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-one",
          type: "ref",
          ref: "layout-frame-1",
          name: "Page One",
          metadata: {
            type: "legacy-page",
            pageId: "page-one",
            layoutId: "frame-1",
            order_num: 0,
          },
        },
        {
          id: "page-two",
          type: "ref",
          ref: "layout-frame-1",
          name: "Page Two",
          metadata: {
            type: "legacy-page",
            pageId: "page-two",
            layoutId: "frame-1",
            order_num: 1,
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
      documentWithSharedBinding,
      projectId,
      "page-one",
    );

    const pageOneBodyId = toPageFrameElementId("page-one", "frame-body");
    const pageTwoBodyId = toPageFrameElementId("page-two", "frame-body");
    const pageOneSlotId = toPageFrameElementId("page-one", "slot-content");
    const pageTwoSlotId = toPageFrameElementId("page-two", "slot-content");

    expect(new Set(renderModel.elements.map((el) => el.id)).size).toBe(
      renderModel.elements.length,
    );
    expect(
      renderModel.elements.find((el) => el.id === pageOneBodyId),
    ).toMatchObject({
      page_id: "page-one",
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === pageTwoBodyId),
    ).toMatchObject({
      page_id: "page-two",
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === pageOneSlotId),
    ).toMatchObject({
      page_id: "page-one",
      parent_id: pageOneBodyId,
    });
    expect(
      renderModel.elements.find((el) => el.id === pageTwoSlotId),
    ).toMatchObject({
      page_id: "page-two",
      parent_id: pageTwoBodyId,
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
    const frameBodyId = toPageFrameElementId("page-home", "frame-body");
    const slotContentId = toPageFrameElementId("page-home", "slot-content");
    expect(
      renderModel.elements.find((el) => el.id === frameBodyId),
    ).toMatchObject({
      id: frameBodyId,
      page_id: "page-home",
      parent_id: null,
      layout_id: "frame-1",
    });
    expect(
      renderModel.elements.find((el) => el.id === slotContentId),
    ).toMatchObject({
      id: slotContentId,
      page_id: "page-home",
      parent_id: frameBodyId,
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

    const frameBodyId = toPageFrameElementId("page-home", "frame-body");
    const slotFrameId = toPageFrameElementId("page-home", "slot-frame");
    expect(renderModel.elements.find((el) => el.id === slotFrameId)).toEqual(
      expect.objectContaining({
        id: slotFrameId,
        type: "Slot",
        page_id: "page-home",
        parent_id: frameBodyId,
        layout_id: "frame-1",
        props: expect.objectContaining({ name: "content" }),
        slot_name: "content",
      }),
    );
  });

  it("preserves page-owned reusable origins when hydrating runtime elements", () => {
    const documentWithOrigin: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "button-origin",
              type: "Button",
              name: "primary-action",
              reusable: true,
              metadata: {
                type: "legacy-element-props",
                customId: "primary-action-id",
                legacyProps: { customId: "legacy-primary-action-id" },
              },
              props: { children: "Click" },
            },
          ],
        },
      ],
    };

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithOrigin,
      projectId,
      "page-home",
    );

    expect(renderModel.elements).toEqual([
      expect.objectContaining({
        id: "button-origin",
        type: "Button",
        page_id: "page-home",
        parent_id: null,
        componentName: "primary-action",
        customId: "primary-action-id",
        [COMPONENT_ROLE_MIRROR_FIELD]: "master",
        reusable: true,
      }),
    ]);
  });

  it("preserves canonical ref instance mirrors when hydrating runtime elements", () => {
    const documentWithInstance: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "button-origin",
          type: "Button",
          name: "Primary action",
          reusable: true,
          metadata: {
            type: "legacy-element-props",
            customId: "primary-action-origin-id",
          },
          props: { variant: "accent" },
          children: [
            {
              id: "button-label",
              type: "Text",
              props: { children: "Default" },
            },
          ],
        },
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "button-instance",
              type: "ref",
              ref: "button-origin",
              metadata: {
                type: "legacy-element-props",
                legacyProps: { customId: "secondary-action-instance-id" },
              },
              props: { variant: "secondary" },
              descendants: {
                "button-label": { children: "Custom" },
              },
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithInstance,
      projectId,
      "page-home",
    );

    expect(
      renderModel.elements.find((el) => el.id === "button-instance"),
    ).toEqual(
      expect.objectContaining({
        id: "button-instance",
        type: "Button",
        page_id: "page-home",
        parent_id: null,
        customId: "secondary-action-instance-id",
        [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
        [COMPONENT_MASTER_MIRROR_FIELD]: "button-origin",
        ref: "button-origin",
        overrides: { variant: "secondary" },
        descendants: {
          "button-label": { children: "Custom" },
        },
      }),
    );
    expect(
      renderModel.elements.find(
        (el) => el.id === "button-instance/button-label",
      ),
    ).toEqual(
      expect.objectContaining({
        id: "button-instance/button-label",
        parent_id: "button-instance",
        page_id: "page-home",
        props: { children: "Custom" },
      }),
    );
  });

  it("uses instance-local ids for hydrated Card ref children so origin children are not duplicated", () => {
    const documentWithPageOwnedCardOrigin: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "card-origin",
              type: "Card",
              reusable: true,
              props: {},
              children: [
                {
                  id: "card-preview",
                  type: "CardPreview",
                  props: {},
                  children: [
                    {
                      id: "card-image",
                      type: "Image",
                      props: {},
                    },
                  ],
                },
                {
                  id: "card-header",
                  type: "CardHeader",
                  props: {},
                  children: [
                    {
                      id: "card-heading",
                      type: "Heading",
                      props: { children: "Origin" },
                    },
                  ],
                },
                {
                  id: "card-content",
                  type: "CardContent",
                  props: {},
                  children: [
                    {
                      id: "card-description",
                      type: "Description",
                      props: { children: "Origin description" },
                    },
                  ],
                },
              ],
            },
            {
              id: "card-instance",
              type: "ref",
              ref: "card-origin",
              props: {},
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithPageOwnedCardOrigin,
      projectId,
      "page-home",
    );

    expect(
      renderModel.elements.filter((element) => element.id === "card-image"),
    ).toHaveLength(1);
    expect(
      renderModel.elements.filter((element) => element.id === "card-heading"),
    ).toHaveLength(1);
    expect(
      renderModel.elements.filter(
        (element) => element.id === "card-description",
      ),
    ).toHaveLength(1);
    expect(renderModel.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "card-instance/card-preview/card-image",
          parent_id: "card-instance/card-preview",
          page_id: "page-home",
        }),
        expect.objectContaining({
          id: "card-instance/card-header/card-heading",
          parent_id: "card-instance/card-header",
          page_id: "page-home",
        }),
        expect.objectContaining({
          id: "card-instance/card-content/card-description",
          parent_id: "card-instance/card-content",
          page_id: "page-home",
        }),
      ]),
    );
  });

  it("applies mode C descendant children replacements without leaving origin children in runtime elements", () => {
    const documentWithSlotReplacement: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "card-origin",
              type: "Card",
              reusable: true,
              props: {},
              children: [
                {
                  id: "card-content",
                  type: "CardContent",
                  props: {},
                  children: [
                    {
                      id: "card-description",
                      type: "Description",
                      props: { children: "Origin description" },
                    },
                  ],
                },
              ],
            },
            {
              id: "card-instance",
              type: "ref",
              ref: "card-origin",
              props: {},
              descendants: {
                "card-content": {
                  children: [
                    {
                      id: "custom-body",
                      type: "Text",
                      props: { children: "Custom body" },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithSlotReplacement,
      projectId,
      "page-home",
    );

    expect(
      renderModel.elements.some(
        (element) =>
          element.id === "card-instance/card-content/card-description",
      ),
    ).toBe(false);
    expect(renderModel.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "card-instance/card-content/custom-body",
          parent_id: "card-instance/card-content",
          page_id: "page-home",
          props: { children: "Custom body" },
        }),
      ]),
    );
  });

  it("uses customId stable segments for hydrated ref children to match Builder resolver ids", () => {
    const documentWithCustomIdChildren: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "search-origin",
              type: "SearchField",
              reusable: true,
              props: {},
              children: [
                {
                  id: "label-node",
                  type: "Label",
                  metadata: {
                    type: "legacy-element-props",
                    customId: "label",
                  },
                  props: { children: "Search" },
                },
                {
                  id: "wrapper-node",
                  type: "ComboBoxWrapper",
                  metadata: {
                    type: "legacy-element-props",
                    customId: "comboboxwrapper",
                  },
                  props: {},
                },
              ],
            },
            {
              id: "search-instance",
              type: "ref",
              ref: "search-origin",
              props: {},
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithCustomIdChildren,
      projectId,
      "page-home",
    );

    expect(
      renderModel.elements
        .filter((element) => element.parent_id === "search-instance")
        .map((element) => element.id),
    ).toEqual(["search-instance/label", "search-instance/comboboxwrapper"]);
    expect(
      renderModel.elements.some(
        (element) =>
          element.id === "search-instance/label-node" ||
          element.id === "search-instance/wrapper-node",
      ),
    ).toBe(false);
  });

  it("does not inherit an origin customId when a ref instance has no customId metadata", () => {
    const documentWithMissingInstanceCustomId: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "button-origin",
          type: "Button",
          name: "Primary action",
          reusable: true,
          metadata: {
            type: "legacy-element-props",
            customId: "primary-action-origin-id",
          },
          props: { variant: "accent" },
        },
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home" },
          children: [
            {
              id: "button-instance",
              type: "ref",
              ref: "button-origin",
              props: { variant: "secondary" },
            },
          ],
        },
      ],
    } as never;

    const renderModel = deriveProjectRenderModelFromDocument(
      documentWithMissingInstanceCustomId,
      projectId,
      "page-home",
    );

    const instanceElement = renderModel.elements.find(
      (el) => el.id === "button-instance",
    );
    expect(instanceElement).toMatchObject({
      id: "button-instance",
      type: "Button",
      [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
      [COMPONENT_MASTER_MIRROR_FIELD]: "button-origin",
    });
    expect(instanceElement).not.toHaveProperty("customId");
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
