import { describe, expect, it } from "vitest";
import type { PencilDocument } from "@composition/shared";
import { importPencilDocument } from "../pencilImport";

describe("ADR-111 Pencil import adapter", () => {
  it("maps Pencil primitives into canonical component nodes without legacy mirrors", () => {
    const doc = importPencilDocument({
      version: "2.10",
      children: [
        {
          id: "hero",
          type: "rectangle",
          fill: "#fff",
          children: [{ id: "title", type: "text", text: "Hello" }],
        },
      ],
    } satisfies PencilDocument);

    expect(doc).toEqual({
      version: "composition-1.0",
      _meta: { schemaVersion: "canonical-primary-1.0" },
      children: [
        expect.objectContaining({
          id: "hero",
          type: "frame",
          props: { fill: "#fff" },
          metadata: { type: "rectangle", pencilType: "rectangle" },
          children: [
            expect.objectContaining({
              id: "title",
              type: "Text",
              props: { text: "Hello" },
              metadata: { type: "text", pencilType: "text" },
            }),
          ],
        }),
      ],
    });
  });

  it("preserves imports, slots, refs, and descendant override schema fields", () => {
    const doc = importPencilDocument({
      version: "2.10",
      imports: { kit: "./kit.pen" },
      children: [
        {
          id: "card",
          type: "frame",
          slot: ["title"],
          clip: true,
          placeholder: true,
        },
        {
          id: "instance",
          type: "ref",
          ref: "kit:card",
          descendants: {
            title: { text: "Imported" },
            icon: {
              children: [{ id: "icon", type: "icon_font", icon: "check" }],
            },
          },
        },
      ],
    } satisfies PencilDocument);

    expect(doc.imports).toEqual({ kit: "./kit.pen" });
    expect(doc.children[0]).toEqual(
      expect.objectContaining({
        id: "card",
        type: "frame",
        slot: ["title"],
        clip: true,
        placeholder: true,
      }),
    );
    expect(doc.children[1]).toEqual(
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "kit:card",
        descendants: {
          title: { text: "Imported" },
          icon: {
            children: [
              expect.objectContaining({
                id: "icon",
                type: "Icon",
                props: { icon: "check" },
              }),
            ],
          },
        },
      }),
    );
  });

  it("supports import-registry reusable master mode without changing file-open semantics", () => {
    const payload = {
      version: "2.10",
      children: [{ id: "button", type: "frame" }],
    } satisfies PencilDocument;

    expect(importPencilDocument(payload).children[0]).not.toHaveProperty(
      "reusable",
    );
    expect(
      importPencilDocument(payload, { forceTopLevelReusable: true })
        .children[0],
    ).toEqual(expect.objectContaining({ reusable: true }));
  });
});
