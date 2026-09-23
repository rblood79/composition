// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../lib/db", () => ({
  getDB: async () => ({
    documents: { put: vi.fn() },
  }),
}));

import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import type { Element } from "../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { getFirstProjectableNodeById } from "../canonical/canonicalTraversalHelpers";
import { historyManager } from "../history";
import { useStore } from "../index";
import { clearOriginImpactConfirmationCacheForTests } from "../utils/elementUpdate";

// B-4: Styles 패널 (`updateAndSave`) · batch props 경로도 Properties 와 같은 영향 게이트를 지난다.

const PROJECT_ID = "inspector-origin-impact-project";

function makeElement(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: { style: { width: "100px" } },
    ...overrides,
  } as Element;
}

function seed(elements: Element[], selectedElementId: string): void {
  useStore.setState({
    selectedElementId,
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);
  useStore.getState()._rebuildIndexes();
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => PROJECT_ID,
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  mergeElementsCanonicalPrimary(useStore.getState().elements);
}

function seedOriginWithInstance(): void {
  seed(
    [
      makeElement("origin", { reusable: true }),
      makeElement("instance", { type: "ref", ref: "origin", props: {} }),
    ],
    "origin",
  );
}

function canonicalWidth(id: string): unknown {
  const style = getFirstProjectableNodeById(id)?.props?.style as
    Record<string, unknown> | undefined;
  return style?.width;
}

/** 대화상자 뒤 재진입 · 트랜잭션 실행이 끝나도록 microtask 를 비운다 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("inspector · batch 쓰기의 origin 영향 게이트 (B-4)", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    clearOriginImpactConfirmationCacheForTests();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      activeBreakpoint: "desktop",
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      selectedElementId: null,
      selectedElementIds: [],
      selectedElementProps: {},
      dirtyElementIds: new Set<string>(),
      layoutVersion: 0,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Styles 패널 편집을 취소하면 origin 에 쓰지 않는다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    seedOriginWithInstance();

    useStore.getState().updateSelectedStyle("width", "240px");
    await flush();

    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 1 instance. Continue?",
    );
    expect(canonicalWidth("origin")).toBe("100px");
  });

  it("프리뷰 뒤 커밋을 취소하면 프리뷰 전 값으로 되돌린다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    seedOriginWithInstance();

    useStore.getState().updateSelectedStylePreview("width", "240px");
    expect(canonicalWidth("origin")).toBe("240px");
    useStore.getState().updateSelectedStyle("width", "240px");
    await flush();

    expect(canonicalWidth("origin")).toBe("100px");
    expect(
      (
        useStore.getState().elementsMap.get("origin")?.props?.style as
          Record<string, unknown> | undefined
      )?.width,
    ).toBe("100px");
  });

  it("확인하면 Styles 패널 편집이 origin 에 반영된다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    seedOriginWithInstance();

    useStore.getState().updateSelectedStyle("width", "240px");
    await flush();
    useStore.getState().updateSelectedStyle("width", "260px");
    await flush();

    // 두 번째 편집은 확인 캐시로 대화상자 없이 통과한다.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(canonicalWidth("origin")).not.toBe("100px");
    expect(String(canonicalWidth("origin"))).toContain("260");
  });

  it("instance 없는 일반 요소는 대화상자 없이 동기로 쓴다", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    seed([makeElement("plain")], "plain");

    useStore.getState().updateSelectedStyle("width", "240px");

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(String(canonicalWidth("plain"))).toContain("240");
  });

  it("batch props 편집을 취소하면 origin 에 쓰지 않는다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    seedOriginWithInstance();

    await useStore
      .getState()
      .batchUpdateElementProps([
        { elementId: "origin", props: { style: { width: "240px" } } },
      ]);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(canonicalWidth("origin")).toBe("100px");
  });

  it("이동과 한 몸인 좌표 patch 는 게이트를 건너뛴다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    seedOriginWithInstance();

    await useStore
      .getState()
      .batchUpdateElementProps(
        [{ elementId: "origin", props: { style: { width: "240px" } } }],
        { skipOriginImpactGate: true },
      );

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(canonicalWidth("origin")).toBe("240px");
  });
});
