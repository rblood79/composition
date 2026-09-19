import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
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
  // canonical mutation 후 store mirror 재구축 (state-management: canonical → set →
  // _rebuildIndexes). double 에서 빠지면 deleteReusableLayout 이 TypeError 로 죽는다.
  _rebuildIndexes: vi.fn(),
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
import { useReusableLayoutSelectionStore } from "@/builder/stores/canonical/reusableLayoutStore";
import {
  createReusableLayout,
  deleteReusableLayout,
  getNextLayoutName,
  selectReusableLayout,
  updateReusableLayoutName,
} from "../reusableLayoutActions";

function makeDoc(children: CompositionDocument["children"] = []) {
  return {
    version: "composition-1.0",
    children,
  } satisfies CompositionDocument;
}

describe("reusableLayoutActions canonical reusable frame API", () => {
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
    useReusableLayoutSelectionStore.setState({
      selectedReusableLayoutId: null,
    });
  });

  describe("createReusableLayout", () => {
    it("active canonical document 에 reusable FrameNode 를 추가하고 document store 를 저장한다", async () => {
      const randomUUIDSpy = vi
        .spyOn(crypto, "randomUUID")
        .mockReturnValue("frame-x" as ReturnType<typeof crypto.randomUUID>);

      const result = await createReusableLayout({
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
        useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
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
        .mockReturnValue("frame-y" as ReturnType<typeof crypto.randomUUID>);

      await createReusableLayout({ name: "F", projectId: "p" });

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
        createReusableLayout({ name: "F", projectId: "p" }),
      ).rejects.toThrow("DB 실패");
    });
  });

  describe("deleteReusableLayout", () => {
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
      selectReusableLayout("frame-x");

      await deleteReusableLayout("frame-x");

      expect(mockApplyDeleteReusableFrameCanonicalPrimary).toHaveBeenCalledWith(
        expect.objectContaining({
          frameId: "frame-x",
          layouts: [
            expect.objectContaining({ id: "frame-x", name: "Frame X" }),
          ],
          setPages: mockLiveElementsState.setPages,
        }),
      );
      // canonical delete 후 store mirror 재구축 (canonical → set → _rebuildIndexes)
      expect(mockLiveElementsState._rebuildIndexes).toHaveBeenCalled();
      expect(mockDb.documents.put).toHaveBeenCalledWith(
        "proj-1",
        expect.objectContaining({ version: "composition-1.0" }),
      );
      expect(
        useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
      ).toBeNull();
    });
  });

  describe("updateReusableLayoutName", () => {
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

      await updateReusableLayoutName("frame-x", "New Name");

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

  describe("selectReusableLayout", () => {
    it("canonical frame selection store 를 갱신한다", () => {
      selectReusableLayout("frame-x");

      expect(
        useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
      ).toBe("frame-x");

      selectReusableLayout(null);

      expect(
        useReusableLayoutSelectionStore.getState().selectedReusableLayoutId,
      ).toBeNull();
    });
  });

  describe("getNextLayoutName", () => {
    it("빈 배열 -> 'Layout 1'", () => {
      expect(getNextLayoutName([])).toBe("Layout 1");
    });

    it("['Layout 1', 'Layout 3'] -> 'Layout 2' (gap 채움)", () => {
      expect(
        getNextLayoutName([{ name: "Layout 1" }, { name: "Layout 3" }]),
      ).toBe("Layout 2");
    });

    it("Layout N 패턴 아닌 이름은 무시한다", () => {
      expect(getNextLayoutName([{ name: "My Custom" }])).toBe("Layout 1");
    });
  });
});
