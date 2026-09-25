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
import { useStore as appStore } from "../../index";
import { historyManager } from "../../history";
import { useToastStore } from "../../toast";
import { clearOriginImpactConfirmationCacheForTests } from "../elementUpdate";
import {
  deleteSelection,
  groupSelection,
} from "../../../workspace/canvas/actions/canvasActions";

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

function seed(elements: Element[], store: typeof useStore = useStore): void {
  store.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);
  store.getState()._rebuildIndexes();
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "system-origin-guard",
    getCurrentLegacySnapshot: () => ({
      elements: store.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore.getState().setCurrentProject("system-origin-guard");
  mergeElementsCanonicalPrimary(store.getState().elements);
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

  it("instance 안 요소 (synthetic 자식) 를 부모로 한 addElement 는 거부하고 알린다 (E6)", async () => {
    seed([makeElement("inst", { type: "ref", ref: "btn" }), systemOrigin()]);
    await useStore
      .getState()
      .addElement(
        makeElement("new-text", { type: "Text", parent_id: "inst/label" }),
      );
    expect(useStore.getState().elementsMap.has("new-text")).toBe(false);
    expect(
      useToastStore
        .getState()
        .toasts.some((t) => t.messageKey === "operation.instanceChildLocked"),
    ).toBe(true);
  });

  // ADR-236 Phase 3 (E4) — origin 안의 구조 변경은 그 origin 의 instance 를 모두 바꾼다. 편집처럼 묻는다.
  //   묻는 곳은 사용자 동작을 시작하는 표면이다. store 액션은 묻지 않는다 — 패널 · 묶기 · 드래그 복제가
  //   그 액션을 병렬 · 트랜잭션 안에서 동기 완료를 전제로 부른다 (Phase 3 판독 HIGH-2).
  const originWithInstance = () => [
    makeElement("card", { type: "frame", reusable: true }),
    makeElement("card-title", { type: "Text", parent_id: "card" }),
    makeElement("card-body", { type: "Text", parent_id: "card" }),
    makeElement("card-use", { type: "ref", ref: "card" }),
  ];
  // 표면 (canvasActions) 은 앱 store (`stores/index`) 를 읽는다 — 이 파일의 slice store 와 다른 인스턴스.
  const select = (ids: string[]) =>
    appStore.setState({
      currentPageId: "page-1",
      selectedElementId: ids[0] ?? null,
      selectedElementIds: ids,
    } as never);
  const actionContext = () => ({
    elementsMap: appStore.getState().elementsMap as never,
  });

  it("캔버스 삭제: origin 자손은 영향 확인을 거친다 — 취소하면 남는다 (E4)", async () => {
    seed(originWithInstance(), appStore);
    select(["card-title"]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    confirm.mockClear();
    await deleteSelection(actionContext());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(appStore.getState().elementsMap.has("card-title")).toBe(true);
  });

  it("캔버스 묶기: origin 안에서 취소하면 frame 도 자식 이동도 없다 (E4 · 판독 HIGH-2a)", async () => {
    seed(originWithInstance(), appStore);
    select(["card-title", "card-body"]);
    const before = appStore.getState().elements.length;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    confirm.mockClear();
    await groupSelection(actionContext());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(appStore.getState().elements.length).toBe(before);
    expect(appStore.getState().elementsMap.get("card-title")?.parent_id).toBe(
      "card",
    );
  });

  it("store addElement 는 묻지 않고 바로 반영된다 — 병렬 · 트랜잭션 호출부 (판독 HIGH-2)", async () => {
    seed(originWithInstance());
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    confirm.mockClear();
    await useStore
      .getState()
      .addElement(makeElement("card-extra", { type: "Text", parent_id: "card" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(useStore.getState().elementsMap.has("card-extra")).toBe(true);
  });

  it("instance 가 없는 요소 삭제는 묻지 않는다 (대조군)", async () => {
    seed([makeElement("plain", { type: "Text" })], appStore);
    select(["plain"]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    confirm.mockClear();
    await deleteSelection(actionContext());
    expect(confirm).not.toHaveBeenCalled();
    expect(appStore.getState().elementsMap.has("plain")).toBe(false);
  });

  it("사용자가 만든 origin 은 그대로 해제된다 (대조군)", async () => {
    seed([makeElement("mine", { reusable: true })]);
    await useStore.getState().toggleComponentOrigin("mine");
    expect(reusableOf("mine")).toBeFalsy();
  });
});
