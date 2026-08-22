import { describe, expect, it } from "vitest";
import { FillType } from "../../types/builder/fill.types";

import {
  isEditorPresentationProtocolMessage,
  type EditorPresentationPatchMessage,
} from "./editorPresentationProtocol";

function patch(
  target: EditorPresentationPatchMessage["mutations"][number]["target"],
): EditorPresentationPatchMessage {
  return {
    type: "EDITOR_PRESENTATION_PATCH",
    projectId: "project-1",
    sessionId: "session-1",
    revision: 1,
    baseDocumentRevision: 3,
    mutations: [
      {
        type: "fills.replace",
        target,
        fills: [
          {
            id: "fill-1",
            type: FillType.Color,
            enabled: true,
            color: "#112233FF",
            opacity: 1,
            blendMode: "normal",
          },
        ],
      },
    ],
  };
}

describe("ADR-187 editor presentation protocol validation", () => {
  it("accepts canonical and ref-descendant semantic targets", () => {
    expect(
      isEditorPresentationProtocolMessage(
        patch({ kind: "canonical-node", nodeId: "node-1" }),
      ),
    ).toBe(true);
    expect(
      isEditorPresentationProtocolMessage(
        patch({
          kind: "ref-descendant",
          refId: "instance-1",
          pathKey: "content/label",
        }),
      ),
    ).toBe(true);
  });

  it("rejects raw projection and Skia synthetic ids at the protocol boundary", () => {
    expect(
      isEditorPresentationProtocolMessage(
        patch({ kind: "canonical-node", nodeId: "projection:node-1" }),
      ),
    ).toBe(false);
    expect(
      isEditorPresentationProtocolMessage(
        patch({ kind: "canonical-node", nodeId: "instance-1/label" }),
      ),
    ).toBe(false);
  });

  it("rejects non-plain mutation payloads and invalid revisions", () => {
    const invalidPayload = patch({ kind: "canonical-node", nodeId: "node-1" });
    (invalidPayload.mutations[0] as { fills: unknown }).fills = [
      { id: "fill-1", color: () => "#000" },
    ];
    expect(isEditorPresentationProtocolMessage(invalidPayload)).toBe(false);
    expect(
      isEditorPresentationProtocolMessage({
        ...patch({ kind: "canonical-node", nodeId: "node-1" }),
        revision: -1,
      }),
    ).toBe(false);
  });

  it("accepts empty patch as an active-session overlay clear", () => {
    expect(
      isEditorPresentationProtocolMessage({
        ...patch({ kind: "canonical-node", nodeId: "node-1" }),
        mutations: [],
      }),
    ).toBe(true);
  });
});
