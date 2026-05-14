import { beforeEach, describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
} from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../canonicalMutations";
import { buildLegacyElementMetadata } from "../legacyMetadata";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";

type TestElementPatch = Partial<Element> & Record<string, unknown>;

function makeElement(
  id: string,
  type: string,
  patch: TestElementPatch = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    ...patch,
  } as Element;
}

function makePage(id: string): Page {
  return {
    id,
    project_id: "project-1",
    title: id,
    slug: `/${id}`,
    parent_id: null,
  } as Page;
}

function makeCanonicalNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type,
    props: element.props as Record<string, unknown>,
    metadata: buildLegacyElementMetadata(element),
  } as CanonicalNode;
}

function makeRoleOrderFixture(): {
  body: Element;
  doc: CompositionDocument;
  instance: Element;
  origin: Element;
  page: Page;
  standard: Element;
  trailing: Element;
} {
  const page = makePage("page-1");
  const body = makeElement("page-body", "Body", {
    page_id: page.id,
  });
  const standard = makeElement("standard", "Box", {
    parent_id: body.id,
    page_id: page.id,
    props: { label: "Standard" },
  });
  const origin = makeElement("origin", "Button", {
    parent_id: body.id,
    page_id: page.id,
    reusable: true,
    props: { label: "Origin" },
  });
  const instance = makeElement("instance", "ref", {
    parent_id: body.id,
    page_id: page.id,
    ref: origin.id,
    props: {},
  });
  const trailing = makeElement("trailing", "Box", {
    parent_id: body.id,
    page_id: page.id,
    props: { label: "Trailing" },
  });

  const originNode = {
    ...makeCanonicalNode({
      ...origin,
      componentRole: "master",
    } as Element),
    reusable: true,
  } as CanonicalNode;
  const instanceNode = {
    ...makeCanonicalNode({
      ...instance,
      componentRole: "instance",
      masterId: origin.id,
    } as Element),
    type: "ref",
    ref: origin.id,
  } as RefNode;

  return {
    body,
    doc: {
      version: "composition-1.0",
      children: [
        {
          id: page.id,
          type: "frame",
          name: page.title,
          metadata: {
            type: "legacy-page",
            pageId: page.id,
          },
          children: [
            {
              ...makeCanonicalNode(body),
              children: [
                makeCanonicalNode(standard),
                originNode,
                instanceNode,
                makeCanonicalNode(trailing),
              ],
            },
          ],
        } as FrameNode,
      ],
    },
    instance,
    origin,
    page,
    standard,
    trailing,
  };
}

function getBodyChildIds(pageId: string, bodyId: string): string[] {
  const pageNode = useCanonicalDocumentStore
    .getState()
    .getDocument("project-1")
    ?.children.find((node) => node.id === pageId) as FrameNode | undefined;
  return (
    pageNode?.children
      ?.find((node) => node.id === bodyId)
      ?.children?.map((node) => node.id) ?? []
  );
}

describe("canonical mutation role order", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
  });

  it("preserves reusable origin sibling order when role mirror is absent", () => {
    const fixture = makeRoleOrderFixture();
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [
          fixture.body,
          fixture.standard,
          fixture.origin,
          fixture.instance,
          fixture.trailing,
        ],
        layouts: [],
        pages: [fixture.page],
      }),
      getCurrentProjectId: () => "project-1",
    });
    useCanonicalDocumentStore.getState().setDocument("project-1", fixture.doc);

    mergeElementsCanonicalPrimary([
      {
        ...fixture.origin,
        props: { label: "Origin edited" },
      },
    ]);

    expect(getBodyChildIds(fixture.page.id, fixture.body.id)).toEqual([
      "standard",
      "origin",
      "instance",
      "trailing",
    ]);
  });

  it("preserves ref instance sibling order when role mirror is absent", () => {
    const fixture = makeRoleOrderFixture();
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [
          fixture.body,
          fixture.standard,
          fixture.origin,
          fixture.instance,
          fixture.trailing,
        ],
        layouts: [],
        pages: [fixture.page],
      }),
      getCurrentProjectId: () => "project-1",
    });
    useCanonicalDocumentStore.getState().setDocument("project-1", fixture.doc);

    mergeElementsCanonicalPrimary([
      {
        ...fixture.instance,
        props: { label: "Instance edited" },
      },
    ]);

    expect(getBodyChildIds(fixture.page.id, fixture.body.id)).toEqual([
      "standard",
      "origin",
      "instance",
      "trailing",
    ]);
  });
});
