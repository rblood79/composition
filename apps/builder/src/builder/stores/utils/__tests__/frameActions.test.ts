import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Layout } from "@/types/builder/layout.types";
import type { Element } from "@/types/core/store.types";

const mockDb = vi.hoisted(() => ({
  documents: {
    put: vi.fn(async (_projectId: string, doc: CompositionDocument) => doc),
  },
}));

const mockBodyElement = vi.hoisted(() => ({
  id: "body-1",
  type: "body",
  props: {},
  parent_id: null,
  page_id: null,
  order_num: 0,
  ["layout_id"]: "frame-x",
  created_at: "2026-05-02T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
}));

const mockApplyDeleteReusableFrameCanonicalPrimary = vi.hoisted(() =>
  vi.fn(async () => ({
    clearedPageIds: [],
    deletedElementIds: [],
    frameExisted: true,
  })),
);

const mockLiveElementsState = vi.hoisted(() => ({
  pages: [],
  elementsMap: new Map<string, Element>(),
  setPages: vi.fn(),
  setElements: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDB: vi.fn(async () => mockDb),
}));

vi.mock("@/adapters/canonical/frameLayoutCascade", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/adapters/canonical/frameLayoutCascade")
    >();
  return {
    ...actual,
    createFrameBodyElement: vi.fn(() => mockBodyElement),
    applyDeleteReusableFrameCanonicalPrimary:
      mockApplyDeleteReusableFrameCanonicalPrimary,
  };
});

vi.mock("@/builder/stores/rootStoreAccess", () => ({
  getLiveElementsState: () => mockLiveElementsState,
}));

import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import { useCanonicalFrameSelectionStore } from "@/builder/stores/canonical/canonicalFrameStore";
import {
  createReusableFrame,
  deleteReusableFrame,
  getNextFrameName,
  selectReusableFrame,
  updateReusableFrameName,
} from "../frameActions";

function makeDoc(children: CompositionDocument["children"] = []) {
  return {
    version: "composition-1.0",
    children,
  } satisfies CompositionDocument;
}

describe("frameActions canonical reusable frame API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.documents.put.mockImplementation(
      async (_projectId: string, doc: CompositionDocument) => doc,
    );
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "proj-1",
      documentVersion: 0,
    });
    useCanonicalFrameSelectionStore.setState({
      selectedReusableFrameId: null,
    });
  });

  describe("createReusableFrame", () => {
    it("active canonical document 에 reusable FrameNode 를 추가하고 document store 를 저장한다", async () => {
      const randomUUIDSpy = vi
        .spyOn(crypto, "randomUUID")
        .mockReturnValue("frame-x");

      const result = await createReusableFrame({
        name: "My Frame",
        projectId: "proj-1",
        description: "desc",
      });

      expect(mockDb.documents.put).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ version: "composition-1.0" }),
      );
      expect(result).toEqual({ id: "frame-x", name: "My Frame" });
      expect(
        useCanonicalFrameSelectionStore.getState().selectedReusableFrameId,
      ).toBe("frame-x");

      const doc = useCanonicalDocumentStore.getState().getDocument("proj-1");
      expect(doc?.children[0]).toMatchObject({
        id: "layout-frame-x",
        type: "frame",
        reusable: true,
        name: "My Frame",
        metadata: {
          layoutId: "frame-x",
          project_id: "proj-1",
          description: "desc",
        },
      });
      expect(doc?.children[0].children).toEqual([
        expect.objectContaining({
          id: "body-1",
          type: "body",
          props: mockBodyElement.props,
        }),
      ]);

      randomUUIDSpy.mockRestore();
    });

    it("description 미지정 시 canonical metadata 에 빈 문자열을 저장한다", async () => {
      const randomUUIDSpy = vi
        .spyOn(crypto, "randomUUID")
        .mockReturnValue("frame-y");

      await createReusableFrame({ name: "F", projectId: "p" });

      const doc = useCanonicalDocumentStore.getState().getDocument("p");
      expect(doc?.children[0]).toMatchObject({
        name: "F",
        metadata: { project_id: "p", description: "" },
      });

      randomUUIDSpy.mockRestore();
    });

    it("document 저장이 reject 하면 그대로 throw 한다", async () => {
      mockDb.documents.put.mockRejectedValueOnce(new Error("DB 실패"));

      await expect(
        createReusableFrame({ name: "F", projectId: "p" }),
      ).rejects.toThrow("DB 실패");
    });
  });

  describe("deleteReusableFrame", () => {
    it("canonical delete cascade 를 적용하고 document store 를 저장한다", async () => {
      useCanonicalDocumentStore.getState().setDocument(
        "proj-1",
        makeDoc([
          {
            id: "layout-frame-x",
            type: "frame",
            reusable: true,
            name: "Frame X",
            metadata: { type: "legacy-layout", layoutId: "frame-x" },
            children: [],
          },
        ]),
      );
      selectReusableFrame("frame-x");

      await deleteReusableFrame("frame-x");

      expect(mockApplyDeleteReusableFrameCanonicalPrimary).toHaveBeenCalledWith(
        expect.objectContaining({
          frameId: "frame-x",
          layouts: [
            expect.objectContaining({ id: "frame-x", name: "Frame X" }),
          ],
          setPages: mockLiveElementsState.setPages,
          setElements: mockLiveElementsState.setElements,
        }),
      );
      expect(mockDb.documents.put).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ version: "composition-1.0" }),
      );
      expect(
        useCanonicalFrameSelectionStore.getState().selectedReusableFrameId,
      ).toBeNull();
    });
  });

  describe("updateReusableFrameName", () => {
    it("canonical FrameNode name 을 갱신하고 document store 를 저장한다", async () => {
      useCanonicalDocumentStore.getState().setDocument(
        "proj-1",
        makeDoc([
          {
            id: "layout-frame-x",
            type: "frame",
            reusable: true,
            name: "Old Name",
            metadata: { type: "legacy-layout", layoutId: "frame-x" },
            children: [],
          },
        ]),
      );

      await updateReusableFrameName("frame-x", "New Name");

      expect(mockDb.documents.put).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ version: "composition-1.0" }),
      );
      const doc = useCanonicalDocumentStore.getState().getDocument("proj-1");
      expect(doc?.children[0]).toMatchObject({
        name: "New Name",
        metadata: { layoutId: "frame-x" },
      });
    });
  });

  describe("selectReusableFrame", () => {
    it("canonical frame selection store 를 갱신한다", () => {
      selectReusableFrame("frame-x");

      expect(
        useCanonicalFrameSelectionStore.getState().selectedReusableFrameId,
      ).toBe("frame-x");

      selectReusableFrame(null);

      expect(
        useCanonicalFrameSelectionStore.getState().selectedReusableFrameId,
      ).toBeNull();
    });
  });

  describe("getNextFrameName", () => {
    it("빈 배열 -> 'Frame 1'", () => {
      expect(getNextFrameName([])).toBe("Frame 1");
    });

    it("['Frame 1', 'Frame 3'] -> 'Frame 2' (gap 채움)", () => {
      expect(getNextFrameName([{ name: "Frame 1" }, { name: "Frame 3" }])).toBe(
        "Frame 2",
      );
    });

    it("Frame N 패턴 아닌 이름은 무시한다", () => {
      expect(getNextFrameName([{ name: "My Custom" }])).toBe("Frame 1");
    });
  });
});
