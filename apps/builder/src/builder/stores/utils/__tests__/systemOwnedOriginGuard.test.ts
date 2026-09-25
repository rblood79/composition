// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import type { Element } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { useStore } from "../../elements";
import { historyManager } from "../../history";
import { useToastStore } from "../../toast";
import { clearOriginImpactConfirmationCacheForTests } from "../elementUpdate";

/**
 * Components 페이지의 system origin (`reusable` + `metadata.systemOwned`) 은 삭제 · 컴포넌트 해제
 * 둘 다 불가다. ADR-234 상태 변형 (`<origin>--<state>`) 도 `ref` 를 가진 system origin 이라 같은 대상이다.
 */
function makeElement(
  id: string,
  overrides: Record<string, unknown> = {},
): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

function seed(elements: Element[]): void {
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);
  useStore.getState()._rebuildIndexes();
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "system-origin-guard",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore.getState().setCurrentProject("system-origin-guard");
  mergeElementsCanonicalPrimary(useStore.getState().elements);
}

const systemOrigin = () =>
  makeElement("btn", {
    reusable: true,
    metadata: { type: "catalog-origin", systemOwned: true },
  });
const systemVariant = () =>
  makeElement("btn--hover", {
    type: "ref",
    ref: "btn",
    reusable: true,
    metadata: { type: "catalog-origin", systemOwned: true, variant: "hover" },
  });
const reusableOf = (id: string) =>
  (
    useStore.getState().elementsMap.get(id) as
      { reusable?: boolean } | undefined
  )?.reusable;

describe("system origin 보호 — 삭제 · 컴포넌트 해제", () => {
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
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      dirtyElementIds: new Set<string>(),
    } as never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("system origin 은 컴포넌트 해제되지 않는다", async () => {
    seed([systemOrigin()]);
    const result = await useStore.getState().toggleComponentOrigin("btn");
    expect(result).toBeNull();
    expect(reusableOf("btn")).toBe(true);
    // 메뉴 항목은 남아 있으므로 눌렀을 때 이유를 알린다.
    expect(
      useToastStore
        .getState()
        .toasts.some(
          (t) => t.messageKey === "componentAction.systemOriginLocked",
        ),
    ).toBe(true);
  });

  it("system 상태 변형 (ref + reusable) 도 컴포넌트 해제되지 않는다", async () => {
    seed([systemOrigin(), systemVariant()]);
    const result = await useStore
      .getState()
      .toggleComponentOrigin("btn--hover");
    expect(result).toBeNull();
    expect(reusableOf("btn--hover")).toBe(true);
  });

  it("system 상태 변형은 삭제되지 않는다", async () => {
    seed([systemOrigin(), systemVariant()]);
    await useStore.getState().removeElement("btn--hover");
    expect(useStore.getState().elementsMap.has("btn--hover")).toBe(true);
  });

  // ADR-236 Phase 3 — store 진입부 가드. 표면을 거치지 않는 호출 (AI · 내부 경로) 에도 같은 판정.
  it("system 상태 변형 삭제 거부는 이유를 알린다 (E3 — 무음 no-op 이었다)", async () => {
    seed([systemOrigin(), systemVariant()]);
    await useStore.getState().removeElement("btn--hover");
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.messageKey === "operation.systemOriginLocked"),
    ).toBe(true);
  });

  it("body 는 컴포넌트로 만들어지지 않는다 (E1 — 생성 방향 가드가 0 이었다)", async () => {
    seed([makeElement("page-body", { type: "body" })]);
    const result = await useStore.getState().toggleComponentOrigin("page-body");
    expect(result).toBeNull();
    expect(reusableOf("page-body")).toBeFalsy();
  });

  it("사용자가 만든 origin 은 그대로 해제된다 (대조군)", async () => {
    seed([makeElement("mine", { reusable: true })]);
    await useStore.getState().toggleComponentOrigin("mine");
    expect(reusableOf("mine")).toBeFalsy();
  });
});
