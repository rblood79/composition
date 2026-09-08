/**
 * 중첩 fail-closed 백스톱의 **부분 거부** 처리 검증.
 *
 * merge 배치의 일부만 규칙을 어기면 `mergeElementsCanonicalPrimary` 는 나머지를
 * 통과시킨다 (`changed: true`). 종전에는 그 사실이 반환값에만 있고 호출자가 버려서,
 * 거부된 element 가 legacy `elements` 배열에만 남는 유령이 됐다 — canonical 에도
 * `elementsMap` 에도 없고 저장도 안 되지만 새로고침 전까지 배열에서 사라지지 않는다.
 *
 * 계약: 거부된 id 는 결과에 실리고 (`rejectedElementIds`), store 를 쓰는 경로는
 * 그 id 를 빼고 쓴다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useStore } from "../../index";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { getActiveCanonicalElementById } from "../../canonical/canonicalElementsView";
import { addElementsToStore } from "../../../factories/utils/elementCreation";
import {
  registerCanonicalMutationRunnerBridge,
  resetCanonicalMutationRunnerBridge,
} from "@/adapters/canonical/canonicalMutationRunner";

const make = (id: string, o: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: "frame",
    parent_id: null,
    page_id: "page-1",
    props: {},
    ...o,
  }) as Element;

function seedProject(elements: Element[]): void {
  resetCanonicalMutationStoreActions();
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "nesting-rejection-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore
    .getState()
    .setCurrentProject("nesting-rejection-project");
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  });
  mergeElementsCanonicalPrimary(elements);
  useStore.getState()._rebuildIndexes();
}

/**
 * Card 조상이 없는 CardFooter — 층 2 (RAC 합성) 위반의 최소 사례.
 * 문서 root 직속이어야 조상 사슬에 opaque (`ref` · 미상 타입) 가 끼지 않아 규칙이 실제로 걸린다.
 */
const violatingChild = (id: string, parentId: string | null = null) =>
  make(id, { type: "CardFooter", parent_id: parentId });

describe("canonical 중첩 거부 — 부분 거부도 store 에 남기지 않는다", () => {
  beforeEach(() => {
    resetCanonicalMutationRunnerBridge();
    registerCanonicalMutationRunnerBridge({
      rebuildIndexes: () => useStore.getState()._rebuildIndexes(),
    });
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useStore.setState({ elements: [], elementsMap: new Map() });
  });

  it("부분 거부는 거부된 id 를 결과에 싣는다 (나머지는 통과)", () => {
    seedProject([make("root")]);
    const good = make("good", { type: "Text" });
    const bad = violatingChild("bad");

    const result = mergeElementsCanonicalPrimary([good, bad]);

    expect(result.changed).toBe(true);
    expect(result.nestingViolation).toBeTruthy();
    expect(result.rejectedElementIds).toEqual(["bad"]);
    expect(getActiveCanonicalElementById("good")).toBeTruthy();
    expect(getActiveCanonicalElementById("bad")).toBeFalsy();
  });

  it("전량 거부도 같은 채널로 id 를 싣는다", () => {
    seedProject([make("root")]);
    const result = mergeElementsCanonicalPrimary([violatingChild("bad")]);

    expect(result.changed).toBe(false);
    expect(result.rejectedElementIds).toEqual(["bad"]);
  });

  it("정상 배치는 거부 목록을 만들지 않는다", () => {
    seedProject([make("root")]);
    const result = mergeElementsCanonicalPrimary([make("ok", { type: "Text" })]);

    expect(result.changed).toBe(true);
    expect(result.nestingViolation).toBeUndefined();
    expect(result.rejectedElementIds ?? []).toEqual([]);
  });

  it("addComplexElement 는 거부된 자식을 legacy elements 배열에 남기지 않는다", async () => {
    seedProject([make("root")]);
    const parent = make("cx-parent", { type: "Frame" });
    const child = violatingChild("cx-child", "cx-parent");

    await useStore.getState().addComplexElement(parent, [child]);

    const state = useStore.getState();
    expect(state.elements.some((e) => e.id === "cx-parent")).toBe(true);
    expect(state.elements.some((e) => e.id === "cx-child")).toBe(false);
    expect(getActiveCanonicalElementById("cx-child")).toBeFalsy();
  });

  it("addElement 는 거부된 element 를 legacy elements 배열에 남기지 않는다", async () => {
    seedProject([make("root")]);

    await useStore.getState().addElement(violatingChild("solo"));

    expect(
      useStore.getState().elements.some((e) => e.id === "solo"),
    ).toBe(false);
  });

  it("factory addElementsToStore 는 거부된 자식을 store 와 반환값에서 뺀다", () => {
    seedProject([make("root")]);
    const parent = make("fx-parent", { type: "Frame" });
    const child = violatingChild("fx-child", "fx-parent");

    const returned = addElementsToStore(parent, [child]);

    expect(returned.some((e) => e.id === "fx-parent")).toBe(true);
    expect(returned.some((e) => e.id === "fx-child")).toBe(false);
    expect(
      useStore.getState().elements.some((e) => e.id === "fx-child"),
    ).toBe(false);
  });
});
