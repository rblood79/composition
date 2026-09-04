import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../frameElementScope";

describe("canonical frame element scope", () => {
  it("reuses the scope index for the same document reference", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };

    const first = canonicalDocumentToFrameElementScopes(doc);
    const second = canonicalDocumentToFrameElementScopes(doc);
    const next = canonicalDocumentToFrameElementScopes({
      ...doc,
      children: [...doc.children],
    });

    expect(second).toBe(first);
    expect(next).not.toBe(first);
  });

  it("includes props-less Slot hosts in reusable frame scope", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body" as CompositionDocument["children"][number]["type"],
              props: {},
              children: [
                {
                  id: "slot-header",
                  type: "Slot",
                },
              ],
            },
          ],
        },
      ],
    };

    const scope = canonicalDocumentToFrameElementScopes(doc).get("frame-1");

    expect(scope?.bodyElementId).toBe("frame-body");
    expect(scope?.elementIds.has("slot-header")).toBe(true);
  });
});
