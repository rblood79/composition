// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import type { Element } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { useStore } from "../../elements";
import { historyManager } from "../../history";
import { clearOriginImpactConfirmationCacheForTests } from "../elementUpdate";

type LegacyElementOverrides = Partial<Element> & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
};

function makeElement(
  id: string,
  overrides: LegacyElementOverrides = {},
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

function seedCanonicalFromStore(): void {
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "origin-impact-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore
    .getState()
    .setCurrentProject("origin-impact-project");
  mergeElementsCanonicalPrimary(useStore.getState().elements);
}

describe("origin impact preview", () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks origin props edits when impacted instance preview is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);

    useStore.setState({
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().updateElementProps("origin", {
      label: "Edited",
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 1 instance. Continue?",
    );
    expect(useStore.getState().elementsMap.get("origin")?.props).toEqual({
      label: "Origin",
    });
  });

  it("allows origin props edits after preview confirmation and caches the count", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });
    const instanceA = makeElement("instance-a", {
      type: "ref",
      ref: "origin",
    } as never);
    const instanceB = withComponentInstanceMirror(
      makeElement("instance-b"),
      "origin",
    );

    useStore.setState({
      elements: [origin, instanceA, instanceB],
      elementsMap: new Map([
        ["origin", origin],
        ["instance-a", instanceA],
        ["instance-b", instanceB],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().updateElementProps("origin", {
      label: "Edited",
    });
    await useStore.getState().updateElementProps("origin", {
      size: "large",
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 2 instances. Continue?",
    );
    expect(useStore.getState().elementsMap.get("origin")?.props).toEqual({
      label: "Edited",
      size: "large",
    });
  });

  it("counts 1000 impacted instances before confirming origin edits", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const origin = makeElement("origin", {
      componentName: "PrimaryButton",
      reusable: true,
      props: { label: "Origin" },
    });
    const instances = Array.from({ length: 1000 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        ref: index % 2 === 0 ? "origin" : "PrimaryButton",
      } as never),
    );

    useStore.setState({
      elements: [origin, ...instances],
      elementsMap: new Map(
        [origin, ...instances].map((element) => [element.id, element]),
      ),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().updateElementProps("origin", {
      label: "Edited",
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 1000 instances. Continue?",
    );
    expect(useStore.getState().elementsMap.get("origin")?.props).toEqual({
      label: "Origin",
    });
  });

  it("상태 변형 origin (ref + reusable) 편집은 base origin 의 instance 영향으로 확인을 묻는다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const origin = makeElement("btn", {
      reusable: true,
      props: { label: "Origin" },
    });
    // ADR-234: 변형 = origin 의 ref + reusable. 층은 base origin 의 모든 instance 에 쌓인다.
    const hover = makeElement("btn--hover", {
      type: "ref",
      ref: "btn",
      reusable: true,
      metadata: { variant: "hover" },
      props: {},
    } as never);
    const pressed = makeElement("btn--pressed", {
      type: "ref",
      ref: "btn",
      reusable: true,
      metadata: { variant: "pressed" },
      props: {},
    } as never);
    const instance = makeElement("instance", {
      type: "ref",
      ref: "btn",
    } as never);

    const all = [origin, hover, pressed, instance];
    useStore.setState({
      elements: all,
      elementsMap: new Map(all.map((element) => [element.id, element])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().updateElementProps("btn--hover", {
      label: "Hovered",
    });

    // 형제 변형 (btn--pressed) 은 instance 가 아니다 — 사용자 instance 1개만 센다.
    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 1 instance. Continue?",
    );
    expect(useStore.getState().elementsMap.get("btn--hover")?.props).toEqual(
      {},
    );
  });

  it("base origin 편집의 영향 instance 수에 자기 상태 변형은 세지 않는다", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const variantOf = (state: string) =>
      makeElement(`btn--${state}`, {
        type: "ref",
        ref: "btn",
        reusable: true,
        metadata: { variant: state },
        props: {},
      } as never);
    const all = [
      makeElement("btn", { reusable: true, props: { label: "Origin" } }),
      variantOf("hover"),
      variantOf("pressed"),
      makeElement("instance", { type: "ref", ref: "btn" } as never),
    ];
    useStore.setState({
      elements: all,
      elementsMap: new Map(all.map((element) => [element.id, element])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().updateElementProps("btn", { label: "Edited" });

    expect(confirmSpy).toHaveBeenCalledWith(
      "Editing this component will affect 1 instance. Continue?",
    );
  });

  it("canonical 문서가 없으면 legacy-only origin을 수정하지 않음", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });
    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    await useStore.getState().updateElementProps("origin", {
      label: "Edited",
    });

    expect(useStore.getState().elementsMap.get("origin")?.props).toEqual({
      label: "Origin",
    });
  });
});
