// @vitest-environment jsdom
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { CompositionDocument, RefNode } from "@composition/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "@/adapters/canonical/componentSemanticsMirror";
import { withFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { Element } from "../../../types/core/store.types";
import { historyManager } from "../../stores/history";
import { useStore } from "../../stores";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../__tests__/panelFixture";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { ComponentSemanticsSection } from "./ComponentSemanticsSection";

/**
 * ADR-200 Phase 0 — 표시 계층이 `t()` 로 라벨을 해소하게 되므로 provider 하위에서
 * 렌더한다. 훅 도입(Phase 2~4)보다 먼저 옮겨 두어 그 phase 가 빨간 테스트 없이
 * 시작한다 (design breakdown §5-2).
 */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });


// Canonical migration: `reusable` / `ref` / `componentRole` are CanonicalNode (RefNode)
// fields, not legacy Element fields, but runtime reads them off the object. Widen the
// overrides param so fixtures keep these values while satisfying the type checker.
type LegacyElementOverrides = Partial<Element> & {
  reusable?: boolean;
  ref?: string;
  componentRole?: string;
};

function makeElement(
  id: string,
  overrides: LegacyElementOverrides = {},
): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("ComponentSemanticsSection", () => {
  beforeEach(() => {
    resetPanelFixture();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      elementsMap: new Map(),
      currentPageId: null,
      elements: [],
      multiSelectMode: false,
      selectedElementId: null,
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      selectedElementProps: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders Origin label for reusable element", () => {
    const origin = makeElement("origin", {
      componentName: "ArticleFrame",
      reusable: true,
    });

    seedPanelElements([origin]);

    renderWithI18n(<ComponentSemanticsSection elementId="origin" />);

    expect(screen.getByText("Component")).toBeTruthy();
    // 이름과 역할은 key-value 2행이 아니라 정체 칩 한 줄이 함께 보인다.
    expect(screen.getByText("ArticleFrame")).toBeTruthy();
    expect(screen.getByText("Origin")).toBeTruthy();
  });

  it("renders Instance label for ref element", () => {
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);

    seedPanelElements([instance]);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);

    expect(screen.getByText("Instance")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Detach instance" }),
    ).toBeTruthy();
  });

  it("renders Standard label for plain element", () => {
    const plain = makeElement("plain");

    seedPanelElements([plain]);

    renderWithI18n(<ComponentSemanticsSection elementId="plain" />);

    expect(screen.getByText("Component")).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create component" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Detach instance" }),
    ).toBeNull();
  });

  it("renders nothing for missing element", () => {
    const { container } = renderWithI18n(
      <ComponentSemanticsSection elementId="missing" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for frame body elements", () => {
    const frameBody = withFrameElementMirrorId(
      makeElement("frame-body", {
        type: "body",
        page_id: null,
      }),
      "frame-1",
    );

    seedPanelElements([frameBody]);

    const { container } = renderWithI18n(
      <ComponentSemanticsSection elementId="frame-body" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("standard action creates a reusable component origin", async () => {
    const plain = makeElement("plain", {
      customId: "primary-action",
      page_id: "page-1",
    });

    seedPanelElements([plain]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="plain" />);
    fireEvent.click(screen.getByRole("button", { name: "Create component" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("plain")).toMatchObject({
        componentName: "primary-action",
        reusable: true,
      });
    });
  });

  it("origin action removes component status when no instances exist", async () => {
    const origin = makeElement("origin", {
      page_id: "page-1",
      reusable: true,
    });

    seedPanelElements([origin]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="origin" />);
    fireEvent.click(screen.getByRole("button", { name: "Detach component" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
        reusable: false,
      });
    });
  });

  // pencil 은 `prototype`(인스턴스) 과 `reusable`(원본) 을 따로 세어 두 축의
  // 액션을 함께 노출한다 (Pen.app 번들 실측 2026-08-30). role enum 하나로
  // 갈랐던 종전 구현은 인스턴스에서 컴포넌트 축 액션이 통째로 사라졌다.
  it("instance also offers the component axis action", () => {
    const origin = makeElement("origin", { page_id: "page-1", reusable: true });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      page_id: "page-1",
    } as never);

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);

    expect(screen.getByRole("button", { name: "Go to component" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Detach instance" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create component" }),
    ).toBeTruthy();
  });

  it("reusable instance offers go to / detach instance / detach component", async () => {
    const origin = makeElement("origin", { page_id: "page-1", reusable: true });
    const dual = makeElement("dual", {
      type: "ref",
      ref: "origin",
      page_id: "page-1",
      reusable: true,
    } as never);

    seedPanelElements([origin, dual]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="dual" />);

    // 색 마커는 하나뿐이라 (canvas 는 instance 색) 라벨이 두 정체를 읽어 준다.
    expect(screen.getByText("Instance · Origin")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to component" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Detach instance" })).toBeTruthy();
    // 인스턴스 0건이면 누를 것이 없는 dead 버튼이라 세우지 않는다 — 그 자리를
    // 비워야 컴포넌트 축이 라벨을 유지한 채 한 줄에 선다.
    expect(
      screen.queryByRole("button", { name: /^Select instances/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Detach component" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("dual")).toMatchObject({
        reusable: false,
      });
    });
  });

  it("instance action selects its origin", () => {
    const origin = makeElement("origin", { page_id: "page-1", reusable: true });
    const instance = withComponentInstanceMirror(
      makeElement("instance", { page_id: "page-1" }),
      "origin",
    );

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Go to component" }));

    expect(useStore.getState().selectedElementId).toBe("origin");
    expect(useStore.getState().selectedElementIds).toEqual(["origin"]);
  });

  it("canonical instance action selects its origin by custom id", () => {
    const origin = makeElement("origin", {
      customId: "NumberField",
      page_id: "page-1",
      reusable: true,
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "NumberField",
      page_id: "page-1",
    } as never);

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Go to component" }));

    expect(useStore.getState().selectedElementId).toBe("origin");
    expect(useStore.getState().selectedElementIds).toEqual(["origin"]);
  });

  it("canonical instance action selects its origin by metadata component alias", () => {
    const origin = makeElement("origin", {
      page_id: "origin-page",
      reusable: true,
      metadata: {
        componentName: "PrimaryAction",
      },
    } as never);
    const instance = makeElement("instance", {
      type: "ref",
      ref: "PrimaryAction",
      page_id: "instance-page",
    } as never);

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "instance-page",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Go to component" }));

    expect(useStore.getState().selectedElementId).toBe("origin");
    expect(useStore.getState().selectedElementIds).toEqual(["origin"]);
    expect(useStore.getState().currentPageId).toBe("origin-page");
  });

  it("origin action multi-selects all matching instances", () => {
    const origin = makeElement("origin", { page_id: "page-1", reusable: true });
    const instanceA = withComponentInstanceMirror(
      makeElement("instance-a", { page_id: "page-1" }),
      "origin",
    );
    const instanceB = withComponentInstanceMirror(
      makeElement("instance-b", { page_id: "page-1" }),
      "origin",
    );

    seedPanelElements([origin, instanceA, instanceB]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="origin" />);
    // 영향 수는 별도 행이 아니라 "Select instances (N)" 라벨이 보인다.
    expect(
      screen.getByRole("button", { name: "Select instances (2)" }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Detach component",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Select instances (2)" }),
    );

    expect(useStore.getState().selectedElementIds).toEqual([
      "instance-a",
      "instance-b",
    ]);
    expect(useStore.getState().multiSelectMode).toBe(true);
  });

  it("origin action multi-selects canonical refs by metadata aliases", () => {
    const origin = makeElement("origin", {
      page_id: "origin-page",
      reusable: true,
      metadata: {
        customId: "origin-custom",
        componentName: "OriginComponent",
      },
    } as never);
    const instanceA = makeElement("instance-a", {
      type: "ref",
      ref: "origin-custom",
      page_id: "page-a",
    } as never);
    const instanceB = makeElement("instance-b", {
      type: "ref",
      ref: "OriginComponent",
      page_id: "page-b",
    } as never);

    seedPanelElements([origin, instanceA, instanceB]);
    useStore.setState({
      currentPageId: "origin-page",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="origin" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Select instances (2)" }),
    );

    expect(useStore.getState().selectedElementIds).toEqual([
      "instance-a",
      "instance-b",
    ]);
    expect(useStore.getState().selectedElementId).toBe("instance-a");
    expect(useStore.getState().currentPageId).toBe("page-a");
  });

  it("origin action navigates to a canonical-only instance on another page", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "origin-page",
          type: "frame",
          props: {},
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              props: { label: "Origin" },
            },
          ],
        },
        {
          id: "instance-page",
          type: "frame",
          props: {},
          children: [
            {
              id: "instance",
              type: "ref",
              ref: "origin",
              props: { label: "Instance override" },
            } as RefNode,
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "origin-page",
      elements: [],
      elementsMap: new Map(),
    });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);

    renderWithI18n(<ComponentSemanticsSection elementId="origin" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Select instances (1)" }),
    );

    expect(useStore.getState().currentPageId).toBe("instance-page");
    expect(useStore.getState().selectedElementId).toBe("instance");
    expect(useStore.getState().selectedElementIds).toEqual(["instance"]);
  });

  it("legacy instance detach action asks before detaching", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        page_id: "page-1",
        props: { label: "Origin" },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        page_id: "page-1",
      }),
      "origin",
      { overrideProps: { label: "Detached" } },
    );

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Detach instance" }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
        [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
        [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
        props: { label: "Detached" },
      });
    });
  });

  it("renders root override fields and resets one override", () => {
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        page_id: "page-1",
        props: { label: "Origin" },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        page_id: "page-1",
      }),
      "origin",
      {
        overrideProps: { label: "Detached", style: { color: "blue" } },
      },
    );

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    // fieldset(role=group) + legend 가 접근 이름을 제공 — panel 전역 properties-aria
    // 패턴과 동일. getByLabelText 는 legend 라벨링을 인식하지 않으므로 role 쿼리 사용.
    expect(screen.getByRole("group", { name: "Overrides" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Reset label override" }),
    );

    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: { style: { color: "blue" } },
    });
    expect(
      screen.queryByRole("button", { name: "Reset label override" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Reset style override" }),
    ).toBeTruthy();
  });

  it("renders descendant override fields and resets one override", () => {
    const origin = makeElement("origin", {
      page_id: "page-1",
      reusable: true,
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      page_id: "page-1",
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
      },
    } as never);

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
    } as never);
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset slot/label.text override",
      }),
    );

    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      descendants: {
        "slot/label": { tone: "accent" },
      },
    });
    expect(
      screen.queryByRole("button", {
        name: "Reset slot/label.text override",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Reset slot/label.tone override",
      }),
    ).toBeTruthy();
  });

  it("updates override fields when canonical descendants change", async () => {
    const legacyInstance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      descendants: {
        heading: { label: "Custom title", tone: "accent" },
      },
    } as never);
    const initialDoc = {
      version: "composition-1.0",
      children: [
        {
          id: "origin",
          type: "Card",
          reusable: true,
          props: {},
          metadata: { type: "legacy-element-props" },
        },
        {
          id: "instance",
          type: "ref",
          ref: "origin",
          props: {},
          descendants: {
            heading: { label: "Custom title", tone: "accent" },
          },
          metadata: { type: "legacy-element-props" },
        } as RefNode,
      ],
    } satisfies CompositionDocument;
    const nextDoc = {
      ...initialDoc,
      children: [
        initialDoc.children[0],
        {
          ...(initialDoc.children[1] as RefNode),
          descendants: {
            heading: { tone: "accent" },
          },
        } as RefNode,
      ],
    } satisfies CompositionDocument;

    seedPanelElements([legacyInstance]);
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", initialDoc);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    expect(
      screen.getByRole("button", {
        name: "Reset heading.label override",
      }),
    ).toBeTruthy();

    act(() => {
      useCanonicalDocumentStore.getState().setDocument("project-1", nextDoc);
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Reset heading.label override",
        }),
      ).toBeNull();
    });
    expect(
      screen.getByRole("button", {
        name: "Reset heading.tone override",
      }),
    ).toBeTruthy();
  });

  it("legacy instance detach action preserves the instance when cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const origin = withComponentOriginMirror(makeElement("origin"));
    const instance = withComponentInstanceMirror(
      makeElement("instance"),
      "origin",
      { overrideProps: { label: "Detached" } },
    );

    seedPanelElements([origin, instance]);
    useStore.setState({
      currentPageId: "page-1",
    } as never);

    renderWithI18n(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Detach instance" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("instance")).toBe(instance);
    });
  });
});
