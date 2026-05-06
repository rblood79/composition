import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PencilDocument } from "@composition/shared";
import {
  exportPencilDocument,
  normalizePencilDocumentForSchemaCompare,
} from "../pencilExport";
import { importPencilDocument } from "../pencilImport";

const SAMPLE_FILES = [
  "sample-minimal.pen",
  "sample-slots.pen",
  "sample-ref.pen",
  "sample-descendants.pen",
  "sample-imports.pen",
] as const;

async function readPencilFixture(filename: string): Promise<PencilDocument> {
  const source = await readFile(
    resolve(__dirname, "../fixtures", filename),
    "utf-8",
  );
  return JSON.parse(source) as PencilDocument;
}

describe("ADR-111 Pencil roundtrip adapter", () => {
  it.each(SAMPLE_FILES)(
    "roundtrips %s through CompositionDocument without schema drift",
    async (filename) => {
      const input = await readPencilFixture(filename);
      const canonical = importPencilDocument(input);
      const exported = exportPencilDocument(canonical);

      expect(normalizePencilDocumentForSchemaCompare(exported)).toEqual(
        normalizePencilDocumentForSchemaCompare(input),
      );
    },
  );

  it("keeps composition-only component identity in metadata.compositionType", () => {
    const exported = exportPencilDocument({
      version: "composition-1.0",
      children: [
        {
          id: "button",
          type: "Button",
          props: { label: "Save" },
        },
      ],
    });

    expect(exported.children[0]).toEqual({
      id: "button",
      type: "frame",
      label: "Save",
      metadata: { compositionType: "Button" },
    });
    expect(importPencilDocument(exported).children[0]).toEqual(
      expect.objectContaining({
        id: "button",
        type: "Button",
        props: { label: "Save" },
      }),
    );
  });
});
