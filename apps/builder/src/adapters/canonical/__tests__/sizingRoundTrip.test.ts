import { afterEach, describe, expect, it } from "vitest";
import {
  compositionDocumentToPencilDocument,
  pencilDocumentToCompositionDocument,
  type CompositionDocument,
  type RefNode,
} from "@composition/shared";
import { CompositionDocumentSchema } from "../../../../../../packages/shared/src/schemas/project.schema";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { canonicalNodeToElement } from "../../../builder/stores/canonical/canonicalElementsView";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  updateCanonicalNodeFromElementPrimary,
} from "../canonicalMutations";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";

describe("ADR-224 canonical Fill 왕복", () => {
  afterEach(() => resetCanonicalMutationStoreActions());
  const makeDocument = (): CompositionDocument => ({
    version: "composition-1.0",
    children: [
      {
        id: "page",
        type: "frame",
        metadata: { type: "page" },
        children: [
          {
            id: "a",
            type: "frame",
            props: { style: { height: "80px" } },
            sizing: { width: { factor: 2 }, height: { factor: 3 } },
            responsive: {
              sizing: { tablet: { width: null } },
              styles: { width: { tablet: "320px" } },
            },
          },
        ],
      },
    ],
  });
  it("Pencil·JSON import/export가 factor와 null을 직접 필드로 보존한다", () => {
    const before = makeDocument();
    const after = pencilDocumentToCompositionDocument(
      compositionDocumentToPencilDocument(before),
    );
    const parsed = CompositionDocumentSchema.parse(
      JSON.parse(JSON.stringify(after)),
    ) as CompositionDocument;
    const actual = parsed.children[0].children![0];
    expect(actual.sizing).toEqual(before.children[0].children![0].sizing);
    expect(actual.responsive).toEqual(
      before.children[0].children![0].responsive,
    );
    expect(actual.props).not.toHaveProperty("sizing");
  });
  it("canonical→read-only mirror→무관 props 수정에도 두 축이 남는다", () => {
    const document = makeDocument();
    const store = useCanonicalDocumentStore.getState();
    store.setCurrentProject("sizing-test");
    store.setDocument("sizing-test", document);
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "sizing-test",
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [],
      }),
    });
    const mirror = canonicalNodeToElement(
      document.children[0].children![0],
      "page",
      { pageId: "page", layoutId: null },
    );
    if (!mirror) throw new Error("canonical mirror 미생성");
    expect(mirror.sizing?.width?.factor).toBe(2);
    updateCanonicalNodeFromElementPrimary({
      ...mirror,
      props: { ...mirror.props, title: "수정" },
    });
    const saved = useCanonicalDocumentStore
      .getState()
      .getDocument("sizing-test")!.children[0].children![0];
    expect(saved.sizing).toEqual(mirror.sizing);
    expect(saved.responsive?.sizing?.tablet?.width).toBeNull();
  });
  it("ref root와 descendant patch는 축별 null만 덮고 다른 축은 상속한다", () => {
    const ref: RefNode = {
      id: "instance",
      type: "ref",
      ref: "origin",
      sizing: { width: null },
      descendants: { leaf: { sizing: { width: null } } },
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "frame",
          reusable: true,
          sizing: { width: { factor: 2 }, height: { factor: 3 } },
          children: [
            {
              id: "leaf",
              type: "frame",
              sizing: { width: { factor: 4 }, height: { factor: 5 } },
            },
          ],
        },
        ref,
      ],
    };
    const instance = resolveCanonicalDocument(doc).find(
      (n) => n.id === "instance",
    )!;
    expect(instance.sizing).toEqual({ width: null, height: { factor: 3 } });
    expect(instance.children?.[0].sizing).toEqual({
      width: null,
      height: { factor: 5 },
    });
    expect(instance.children?.[0].props).not.toHaveProperty("sizing");
  });
});
