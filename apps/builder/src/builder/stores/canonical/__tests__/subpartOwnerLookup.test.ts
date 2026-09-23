import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  resolveDelegatedSubpartOwnerTypeById,
  resolveSubpartStyleOwnerTypeById,
} from "../subpartOwnerLookup";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn(async () => {}) } })),
}));

/**
 * 팔레트 배치 (ADR-228) 의 TextField 는 instance 다 — Label 은 store 에 없는 synthetic 자식
 * (`<instance>/<path>`) 라 store 만 읽는 owner 판정이 null 이었다 (2026-09-23 live 재현: 패널이
 * 편집을 다 열고, 캔버스 resize 가 descendants 에 무시되는 width 를 썼다).
 */
const INSTANCE_ID = "tf-1";
const LABEL_PATH = "component-textfield__1";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "page-components-body",
            type: "body",
            props: {},
            children: [
              {
                id: "component-textfield",
                type: "TextField",
                reusable: true,
                props: { label: "Text Field" },
                children: [
                  {
                    id: LABEL_PATH,
                    type: "Label",
                    props: { children: "Text Field" },
                  },
                  { id: "component-textfield__2", type: "Input", props: {} },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body",
            type: "body",
            props: {},
            children: [
              {
                id: INSTANCE_ID,
                type: "ref",
                ref: "component-textfield",
                props: {},
              },
              { id: "plain-label", type: "Label", props: {} },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

const storeElements = new Map([
  ["body", { type: "body", parent_id: null }],
  [INSTANCE_ID, { type: "ref", parent_id: "body" }],
  ["plain-label", { type: "Label", parent_id: "body" }],
  ["legacy-field", { type: "TextField", parent_id: "body" }],
  ["legacy-label", { type: "Label", parent_id: "legacy-field" }],
]);

describe("subpartOwnerLookup — id 로 sub-part owner 판정", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDocument());
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });
  });

  it("instance 의 synthetic Label 은 TextField 가 owner 다", () => {
    const id = `${INSTANCE_ID}/${LABEL_PATH}`;
    expect(resolveSubpartStyleOwnerTypeById(id, storeElements)).toBe(
      "TextField",
    );
    expect(resolveDelegatedSubpartOwnerTypeById(id, storeElements)).toBe(
      "TextField",
    );
  });

  it("store 에 있는 plain 자식 (legacy TextField > Label) 도 그대로 판정한다", () => {
    expect(
      resolveSubpartStyleOwnerTypeById("legacy-label", storeElements),
    ).toBe("TextField");
  });

  it("sub-part 가 아니면 null — body 직속 Label · instance 자신", () => {
    expect(
      resolveSubpartStyleOwnerTypeById("plain-label", storeElements),
    ).toBeNull();
    expect(
      resolveSubpartStyleOwnerTypeById(INSTANCE_ID, storeElements),
    ).toBeNull();
  });
});
