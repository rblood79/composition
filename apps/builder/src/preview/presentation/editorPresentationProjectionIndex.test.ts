import { describe, expect, it } from "vitest";
import type { ResolvedNode } from "@composition/shared";

import { buildPreviewPresentationProjectionIndex } from "./editorPresentationProjectionIndex";

const nodes = [
  {
    id: "page-1",
    type: "frame",
    children: [
      {
        id: "origin-card",
        type: "Card",
        children: [
          {
            id: "origin-label-id",
            customId: "stable-label-key",
            type: "Text",
          },
        ],
      },
      ...["instance-a", "instance-b"].map((id) => ({
        id,
        type: "Card",
        _resolvedFrom: "origin-card",
        children: [
          {
            id: "origin-label-id",
            customId: "stable-label-key",
            type: "Text",
          },
        ],
      })),
    ],
  },
] as unknown as ResolvedNode[];

describe("ADR-187 Preview presentation projection index", () => {
  it("fans out canonical origin targets to actual traversal render keys", () => {
    const index = buildPreviewPresentationProjectionIndex(nodes);

    expect(
      index.resolve({ kind: "canonical-node", nodeId: "origin-card" }),
    ).toEqual(["page-1/origin-card", "page-1/instance-a", "page-1/instance-b"]);
    expect(
      index.resolve({ kind: "canonical-node", nodeId: "origin-label-id" }),
    ).toEqual([
      "page-1/origin-card/origin-label-id",
      "page-1/instance-a/origin-label-id",
      "page-1/instance-b/origin-label-id",
    ]);
  });

  it("resolves one ref descendant without leaking Preview render keys into protocol identity", () => {
    const index = buildPreviewPresentationProjectionIndex(nodes);

    expect(
      index.resolve({
        kind: "ref-descendant",
        refId: "instance-b",
        pathKey: "stable-label-key",
      }),
    ).toEqual(["page-1/instance-b/origin-label-id"]);
  });

  it("inherited color는 own color 없는 descendant만 atomic set으로 확장한다", () => {
    const roots = [
      {
        id: "button-1",
        type: "Button",
        props: { style: { color: "red" } },
        children: [
          { id: "label-1", type: "Text" },
          {
            id: "explicit-1",
            type: "Text",
            props: { style: { color: "blue" } },
          },
        ],
      },
    ] as unknown as ResolvedNode[];
    const index = buildPreviewPresentationProjectionIndex(roots);

    expect(
      index.resolve(
        { kind: "canonical-node", nodeId: "button-1" },
        "inherited-subtree",
      ),
    ).toEqual(["button-1", "button-1/label-1"]);
  });

  it.each([50, 500, 5000])(
    "N=%i canonical nodes에서도 paint lookup 결과는 affected render key k=1이다",
    (count) => {
      const roots = Array.from({ length: count }, (_, index) => ({
        id: `node-${index}`,
        type: "frame",
      })) as unknown as ResolvedNode[];
      const index = buildPreviewPresentationProjectionIndex(roots, 1);
      expect(
        index.resolve({ kind: "canonical-node", nodeId: `node-${count - 1}` }),
      ).toEqual([`node-${count - 1}`]);
    },
  );
});
