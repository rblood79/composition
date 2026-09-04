import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { collectCanonicalPanelNodes } from "./canonicalPanelNodes";

function asDocument(
  children: CompositionDocument["children"],
): CompositionDocument {
  return { version: "composition-1.0", children } as CompositionDocument;
}

describe("collectCanonicalPanelNodes", () => {
  it("does not depend on the legacy Element projection", async () => {
    const source = await readFile(
      resolve(__dirname, "canonicalPanelNodes.ts"),
      "utf-8",
    );

    expect(source).toContain("getCanonicalPageRefDescendantChildren");
    expect(source).not.toContain("canonicalElementsView");
    expect(source).not.toContain("type { Element }");
  });

  it("non-reusable root frame를 page scope로 취급한다", () => {
    const doc = asDocument([
      {
        id: "page-1",
        type: "frame",
        props: {},
        children: [{ id: "body-1", type: "body", props: {} }],
      },
    ] as unknown as CompositionDocument["children"]);

    expect(collectCanonicalPanelNodes(doc)).toMatchObject([
      { id: "page-1", parent_id: null, page_id: "page-1" },
      { id: "body-1", parent_id: "page-1", page_id: "page-1" },
    ]);
  });

  it("동일 document identity의 panel projection을 공유하고 새 document에서는 재계산한다", () => {
    const sourceProps = { children: "Before" };
    const doc = asDocument([
      {
        id: "label-1",
        type: "Text",
        props: sourceProps,
      },
    ] as unknown as CompositionDocument["children"]);

    const first = collectCanonicalPanelNodes(doc);
    const repeated = collectCanonicalPanelNodes(doc);
    const nextDoc = asDocument([
      {
        id: "label-1",
        type: "Text",
        props: { children: "After" },
      },
    ] as unknown as CompositionDocument["children"]);
    const next = collectCanonicalPanelNodes(nextDoc);

    expect(repeated).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(next).not.toBe(first);
    expect(first[0]?.props).not.toBe(sourceProps);
    expect(sourceProps).toEqual({ children: "Before" });
    expect(first[0]?.props.children).toBe("Before");
    expect(next[0]?.props.children).toBe("After");
  });

  it("page placeholder를 생략하고 ref descendants의 page scope와 parent를 보존한다", () => {
    const doc = asDocument([
      {
        id: "page-ref",
        type: "ref",
        ref: "page-origin",
        metadata: { type: "legacy-page", pageId: "page-1" },
        descendants: {
          content: {
            children: [
              {
                id: "page-body",
                type: "body",
                props: {},
                children: [
                  {
                    id: "structural-wrapper",
                    type: "group",
                    children: [
                      {
                        id: "button-1",
                        type: "Button",
                        props: { children: "Save" },
                        metadata: { customId: "button_1" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ] as unknown as CompositionDocument["children"]);

    expect(collectCanonicalPanelNodes(doc)).toEqual([
      {
        id: "page-body",
        type: "body",
        props: {},
        parent_id: null,
        page_id: "page-1",
      },
      {
        id: "button-1",
        type: "Button",
        props: { children: "Save" },
        parent_id: "page-body",
        page_id: "page-1",
        customId: "button_1",
        metadata: { customId: "button_1" },
      },
    ]);
  });

  it("reusable frame scope, hoisted Slot, ref와 responsive 필드를 보존한다", () => {
    const responsive = {
      styles: { mobile: { width: "100%" } },
    };
    const descendants = { label: { props: { children: "Override" } } };
    const doc = asDocument([
      {
        id: "frame-1",
        type: "frame",
        name: "Card frame",
        reusable: true,
        props: {},
        children: [
          {
            id: "slot-1",
            type: "div",
            metadata: {
              type: "legacy-slot-hoisted",
              slotName: "content",
            },
          },
          {
            id: "instance-1",
            type: "ref",
            ref: "origin-1",
            props: {},
            slot: ["origin-1"],
            descendants,
            responsive,
          },
        ],
      },
    ] as unknown as CompositionDocument["children"]);

    expect(collectCanonicalPanelNodes(doc)).toEqual([
      {
        id: "frame-1",
        type: "frame",
        props: {},
        parent_id: null,
        page_id: null,
        componentName: "Card frame",
        reusable: true,
      },
      {
        id: "slot-1",
        type: "Slot",
        props: { name: "content" },
        parent_id: "frame-1",
        page_id: null,
        metadata: {
          type: "legacy-slot-hoisted",
          slotName: "content",
        },
      },
      {
        id: "instance-1",
        type: "ref",
        props: {},
        parent_id: "frame-1",
        page_id: null,
        ref: "origin-1",
        descendants,
        slot: ["origin-1"],
        responsive,
      },
    ]);
  });
});
