// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { CompositionDocument } from "@composition/shared";
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
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { ComponentSemanticsSection } from "./ComponentSemanticsSection";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
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
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
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

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    });

    render(<ComponentSemanticsSection elementId="origin" />);

    expect(screen.getByText("Component")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("ArticleFrame")).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
    expect(screen.getByText("Origin")).toBeTruthy();
  });

  it("renders Instance label for ref element", () => {
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
    } as never);

    useStore.setState({
      elements: [instance],
      elementsMap: new Map([["instance", instance]]),
    });

    render(<ComponentSemanticsSection elementId="instance" />);

    expect(screen.getByText("Instance")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Detach instance" }),
    ).toBeTruthy();
  });

  it("renders Standard label for plain element", () => {
    const plain = makeElement("plain");

    useStore.setState({
      elements: [plain],
      elementsMap: new Map([["plain", plain]]),
    });

    render(<ComponentSemanticsSection elementId="plain" />);

    expect(screen.getByText("Component")).toBeTruthy();
    expect(screen.getByText("Role")).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create component" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Detach instance" }),
    ).toBeNull();
  });

  it("renders nothing for missing element", () => {
    const { container } = render(
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

    useStore.setState({
      elements: [frameBody],
      elementsMap: new Map([["frame-body", frameBody]]),
    });

    const { container } = render(
      <ComponentSemanticsSection elementId="frame-body" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("standard action creates a reusable component origin", async () => {
    const plain = makeElement("plain", {
      customId: "primary-action",
      page_id: "page-1",
    });

    useStore.setState({
      currentPageId: "page-1",
      elements: [plain],
      elementsMap: new Map([["plain", plain]]),
    });
    useStore.getState()._rebuildIndexes();

    render(<ComponentSemanticsSection elementId="plain" />);
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

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    });
    useStore.getState()._rebuildIndexes();

    render(<ComponentSemanticsSection elementId="origin" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove component" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
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

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });

    render(<ComponentSemanticsSection elementId="instance" />);
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

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });

    render(<ComponentSemanticsSection elementId="instance" />);
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

    useStore.setState({
      currentPageId: "instance-page",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });

    render(<ComponentSemanticsSection elementId="instance" />);
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

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, instanceA, instanceB],
      elementsMap: new Map([
        ["origin", origin],
        ["instance-a", instanceA],
        ["instance-b", instanceB],
      ]),
    });

    render(<ComponentSemanticsSection elementId="origin" />);
    expect(screen.getByText("2 instances")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Remove component",
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

    useStore.setState({
      currentPageId: "origin-page",
      elements: [origin, instanceA, instanceB],
      elementsMap: new Map([
        ["origin", origin],
        ["instance-a", instanceA],
        ["instance-b", instanceB],
      ]),
    });

    render(<ComponentSemanticsSection elementId="origin" />);
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
            },
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

    render(<ComponentSemanticsSection elementId="origin" />);
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

    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    render(<ComponentSemanticsSection elementId="instance" />);
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

    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    render(<ComponentSemanticsSection elementId="instance" />);
    expect(screen.getByLabelText("Overrides")).toBeTruthy();
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

    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    render(<ComponentSemanticsSection elementId="instance" />);
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
        },
      ],
    } satisfies CompositionDocument;
    const nextDoc = {
      ...initialDoc,
      children: [
        initialDoc.children[0],
        {
          ...initialDoc.children[1],
          descendants: {
            heading: { tone: "accent" },
          },
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: "instance",
      elements: [legacyInstance],
      elementsMap: new Map([["instance", legacyInstance]]),
    });
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", initialDoc);

    render(<ComponentSemanticsSection elementId="instance" />);
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

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    });

    render(<ComponentSemanticsSection elementId="instance" />);
    fireEvent.click(screen.getByRole("button", { name: "Detach instance" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("instance")).toBe(instance);
    });
  });
});
