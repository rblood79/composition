// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";
import { useStore } from "../../elements";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

const PROJECT_ID = "page-title-project";
const PAGE_ID = "page-1";

function currentCanonicalTitle(): string | undefined {
  return useCanonicalDocumentStore
    .getState()
    .getDocument(PROJECT_ID)
    ?.children.find((node) => node.id === PAGE_ID)?.name;
}

function seed(): void {
  const doc: CompositionDocument = {
    version: "composition-1.0",
    children: [
      {
        id: PAGE_ID,
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", slug: "/" },
        children: [],
      },
    ],
  };
  useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useStore.setState({
    pages: [
      {
        id: PAGE_ID,
        title: "Home",
        slug: "/",
        project_id: PROJECT_ID,
        parent_id: null,
      },
    ],
    currentPageId: PAGE_ID,
    elements: [],
    elementsMap: new Map(),
  } as never);
}

describe("page title rename history roundtrip", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage(PAGE_ID);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    seed();
  });

  afterEach(() => {
    historyManager.clearAllHistory();
  });

  it("rename은 공백을 정규화해 canonical/store를 함께 바꾸고 undo/redo 된다", async () => {
    const changed = useStore.getState().renamePageTitle(PAGE_ID, "  Landing  ");

    expect(changed).toBe(true);
    expect(useStore.getState().pages[0]?.title).toBe("Landing");
    expect(currentCanonicalTitle()).toBe("Landing");

    await useStore.getState().undo();
    expect(useStore.getState().pages[0]?.title).toBe("Home");
    expect(currentCanonicalTitle()).toBe("Home");

    await useStore.getState().redo();
    expect(useStore.getState().pages[0]?.title).toBe("Landing");
    expect(currentCanonicalTitle()).toBe("Landing");
  });

  it("빈 제목과 동일 제목은 변경 및 history를 만들지 않는다", () => {
    expect(useStore.getState().renamePageTitle(PAGE_ID, "   ")).toBe(false);
    expect(useStore.getState().renamePageTitle(PAGE_ID, "Home")).toBe(false);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    expect(currentCanonicalTitle()).toBe("Home");
  });
});
