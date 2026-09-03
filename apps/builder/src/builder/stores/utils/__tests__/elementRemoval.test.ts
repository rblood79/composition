import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { useStore } from "../../elements";
import { historyManager } from "../../history";

// ADR-073 P5: removeElements skipHistory option 단위 테스트

describe("removeElements skipHistory option (ADR-073 P5)", () => {
  const addEntrySpy = vi.spyOn(historyManager, "addEntry");

  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    addEntrySpy.mockClear();
    const parent = {
      id: "sel-1",
      type: "Select",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    };
    const child = {
      id: "si-1",
      type: "SelectItem",
      parent_id: "sel-1",
      page_id: "p1",
      order_num: 0,
      props: { label: "A" },
    };
    useStore.setState({
      currentPageId: "p1",
      elements: [parent, child] as never,
      elementsMap: new Map([
        ["sel-1", parent as never],
        ["si-1", child as never],
      ]),
      childrenMap: new Map([["sel-1", [child as never]]]),
    } as never);
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "removal-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore.getState().setCurrentProject("removal-project");
    mergeElementsCanonicalPrimary(useStore.getState().elements);
    useStore.getState()._rebuildIndexes();
  });

  it("default (skipHistory 미지정) — historyManager.addEntry 호출됨", async () => {
    await useStore.getState().removeElements(["si-1"]);
    expect(addEntrySpy).toHaveBeenCalled();
  });

  it("default history payload는 legacy element snapshot 대신 canonicalEvents를 기록함", async () => {
    await useStore.getState().removeElements(["si-1"]);
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "remove",
        elementId: "si-1",
        data: expect.objectContaining({
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({
              type: "remove",
              node: expect.objectContaining({ id: "si-1" }),
            }),
          ]),
        }),
      }),
    );
    expect(addEntrySpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          element: expect.anything(),
        }),
      }),
    );
  });

  it("skipHistory: true — historyManager.addEntry 호출 안 됨", async () => {
    await useStore.getState().removeElements(["si-1"], { skipHistory: true });
    expect(addEntrySpy).not.toHaveBeenCalled();
  });

  it("skipHistory: true 모드에서도 elementsMap 에서 삭제됨", async () => {
    await useStore.getState().removeElements(["si-1"], { skipHistory: true });
    expect(useStore.getState().elementsMap.get("si-1")).toBeUndefined();
  });

  it("canonical 문서가 없으면 legacy-only element를 삭제하지 않음", async () => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });

    await useStore.getState().removeElements(["si-1"]);

    expect(useStore.getState().elementsMap.has("si-1")).toBe(true);
    expect(addEntrySpy).not.toHaveBeenCalled();
  });
});
