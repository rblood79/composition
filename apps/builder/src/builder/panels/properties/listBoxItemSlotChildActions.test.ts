import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../../stores/canonical/canonicalTraversalHelpers";
import { createListBoxItemSlotChildElement } from "./listBoxItemSlotChildActions";

describe("createListBoxItemSlotChildElement canonical customId source", () => {
  beforeEach(() => {
    __resetTraversalCache_TEST_ONLY__();
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-1",
          {
            version: "composition-1.0",
            children: [
              {
                id: "text-1",
                type: "Text",
                props: {},
                metadata: { customId: "text_1" },
              },
              {
                id: "text-3",
                type: "Text",
                props: {},
                metadata: { legacyProps: { customId: "text_3" } },
              },
            ],
          } as unknown as CompositionDocument,
        ],
      ]),
      currentProjectId: "project-1",
      documentVersion: 1,
    });
  });

  it("canonical metadata의 기존 번호 사이 빈 customId를 선택한다", () => {
    const element = createListBoxItemSlotChildElement({
      role: "label",
      parentId: "item-1",
      pageId: "page-1",
    });

    expect(element.customId).toBe("text_2");
  });

  it("Element[] projection helper 재도입을 막는다", async () => {
    const source = await readFile(
      resolve(__dirname, "./listBoxItemSlotChildActions.ts"),
      "utf-8",
    );

    expect(source).toContain("getNodeMap().values()");
    expect(source).toContain("collectCanonicalCustomIdCandidates");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
  });
});
