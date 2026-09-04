// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../stores/canonical/canonicalTraversalHelpers";
import { useComponentMemory } from "./useComponentMemory";

describe("useComponentMemory canonical node source", () => {
  beforeEach(() => {
    __resetTraversalCache_TEST_ONLY__();
    useStore.setState({
      elements: [
        {
          id: "stale-legacy",
          type: "Text",
          props: { children: "stale" },
        },
      ],
    } as never);
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-1",
          {
            version: "composition-1.0",
            children: [
              {
                id: "parent-1",
                type: "Box",
                props: { label: "ok" },
                metadata: { customId: "box_1" },
                children: [
                  {
                    id: "structural-wrapper",
                    type: "group",
                    children: [
                      {
                        id: "slot-1",
                        type: "div",
                        metadata: {
                          type: "legacy-slot-hoisted",
                          slotName: "content",
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: "ref-1",
                type: "ref",
                ref: "component-1",
              },
              {
                id: "peer-1",
                type: "Text",
                props: {},
              },
            ],
          } as unknown as CompositionDocument,
        ],
      ]),
      currentProjectId: "project-1",
      documentVersion: 1,
    });
  });

  it("canonical parent/depth와 hoisted Slot 의미를 분석한다", async () => {
    const { result } = renderHook(() =>
      useComponentMemory({ sortBy: "depth" }),
    );

    await waitFor(() => {
      expect(result.current.componentMemory).toHaveLength(4);
    });

    const parent = result.current.componentMemory.find(
      (entry) => entry.elementId === "parent-1",
    );
    const slot = result.current.componentMemory.find(
      (entry) => entry.elementId === "slot-1",
    );
    expect(parent).toMatchObject({
      customId: "box_1",
      childCount: 1,
      depth: 0,
      propsSize: 14,
      type: "Box",
    });
    expect(slot).toMatchObject({
      childCount: 0,
      depth: 1,
      propsSize: 22,
      type: "Slot",
    });
    expect(
      result.current.componentMemory.find(
        (entry) => entry.elementId === "ref-1",
      ),
    ).toMatchObject({ depth: 0, propsSize: 0, type: "ref" });
    expect(
      result.current.componentMemory.map((entry) => entry.elementId),
    ).toEqual(["parent-1", "ref-1", "peer-1", "slot-1"]);
    expect(
      result.current.componentMemory.some(
        (entry) => entry.elementId === "stale-legacy",
      ),
    ).toBe(false);
  });

  it("page ref descendant는 page placeholder 없이 root scope로 분석한다", async () => {
    useCanonicalDocumentStore.setState({
      documents: new Map([
        [
          "project-1",
          {
            version: "composition-1.0",
            children: [
              {
                id: "page-ref",
                type: "ref",
                ref: "layout-1",
                metadata: { type: "legacy-page", pageId: "page-1" },
                descendants: {
                  content: {
                    children: [
                      {
                        id: "page-body",
                        type: "body",
                        props: {},
                      },
                    ],
                  },
                },
              },
            ],
          } as unknown as CompositionDocument,
        ],
      ]),
      currentProjectId: "project-1",
      documentVersion: 2,
    });

    const { result } = renderHook(() => useComponentMemory());

    await waitFor(() => {
      expect(result.current.componentMemory).toHaveLength(1);
    });
    expect(result.current.componentMemory[0]).toMatchObject({
      elementId: "page-body",
      depth: 0,
      type: "body",
    });
  });
});
