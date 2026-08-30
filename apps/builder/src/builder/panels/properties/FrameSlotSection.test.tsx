// @vitest-environment jsdom
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../types/core/store.types";
import { historyManager } from "../../stores/history";
import { useStore } from "../../stores";
import { ComponentSemanticsSection } from "./ComponentSemanticsSection";
import { FrameSlotSection } from "./FrameSlotSection";

/**
 * ADR-200 Phase 2 — 이 트리/섹션이 마운트하는 표시 계층이 `t()` 로 라벨을
 * 만든다. 기준은 `label` 참조가 아니라 **컴포넌트 마운트** 다 (Phase 0
 * 인벤토리가 참조 기준이라 이 파일들을 놓쳤다 — evidence §4 정정).
 */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });


const defaultAddElement = useStore.getState().addElement;

// Canonical migration: `reusable` / `ref` / `componentRole` are CanonicalNode fields,
// not legacy Element fields, but runtime reads them off the object. Widen the overrides
// param so fixtures keep these values while satisfying the type checker.
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
    type: "frame",
    parent_id: null,
    page_id: "page-1",
    props: {},
    ...overrides,
  } as Element;
}

describe("FrameSlotSection", () => {
  beforeEach(() => {
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      addElement: defaultAddElement,
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders only for slot host elements", () => {
    const text = makeElement("text", { type: "Text" });

    useStore.setState({
      elements: [text],
      elementsMap: new Map([["text", text]]),
    });

    const { container } = renderWithI18n(<FrameSlotSection elementId="text" />);

    expect(container.firstChild).toBeNull();
  });

  it("enables slot declaration on CardContent internal container shells", async () => {
    const cardContent = makeElement("card-content", {
      parent_id: "card",
      type: "CardContent",
    });

    useStore.setState({
      elements: [cardContent],
      elementsMap: new Map([["card-content", cardContent]]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="card-content" />);

    expect(screen.getByText("Slot")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enable slot" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("card-content")).toMatchObject(
        {
          metadata: { slot: [] },
          slot: [],
        },
      );
    });
  });

  it("enables and disables frame slot declaration", async () => {
    const frame = makeElement("frame");

    useStore.setState({
      elements: [frame],
      elementsMap: new Map([["frame", frame]]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="frame" />);

    expect(screen.getByText("Slot")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Enable slot" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("frame")).toMatchObject({
        metadata: { slot: [] },
        slot: [],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Disable slot" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("frame")).toMatchObject({
        metadata: { slot: false },
        slot: false,
      });
    });
  });

  it("adds and removes recommended reusable component ids", async () => {
    const frame = makeElement("frame", { slot: [] });
    const origin = makeElement("origin", {
      componentName: "NumberField",
      reusable: true,
      type: "NumberField",
    });

    useStore.setState({
      elements: [frame, origin],
      elementsMap: new Map([
        ["frame", frame],
        ["origin", origin],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="frame" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add recommended component" }),
    );

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("frame")).toMatchObject({
        metadata: { slot: ["origin"] },
        slot: ["origin"],
      });
    });
    expect(screen.getByText("NumberField")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove NumberField" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("frame")).toMatchObject({
        metadata: { slot: [] },
        slot: [],
      });
    });
  });

  it("coexists with the Component section for reusable frames", () => {
    const frame = makeElement("frame", {
      componentName: "ArticleFrame",
      reusable: true,
      slot: ["origin"],
    });
    const origin = makeElement("origin", {
      componentName: "NumberField",
      reusable: true,
      type: "NumberField",
    });

    useStore.setState({
      elements: [frame, origin],
      elementsMap: new Map([
        ["frame", frame],
        ["origin", origin],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(
      <>
        <ComponentSemanticsSection elementId="frame" />
        <FrameSlotSection elementId="frame" />
      </>,
    );

    expect(screen.getByText("Component")).toBeTruthy();
    expect(screen.getByText("Origin")).toBeTruthy();
    expect(screen.getByText("Slot")).toBeTruthy();
    expect(screen.getByText("1 recommendations")).toBeTruthy();
    expect(screen.getByText("NumberField")).toBeTruthy();
  });

  it("resolves existing recommendations by component name and prevents duplicates", async () => {
    const frame = makeElement("frame", { slot: ["NumberField"] });
    const origin = makeElement("origin", {
      componentName: "NumberField",
      reusable: true,
      type: "NumberField",
    });

    useStore.setState({
      elements: [frame, origin],
      elementsMap: new Map([
        ["frame", frame],
        ["origin", origin],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="frame" />);

    expect(screen.getByText("NumberField")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add recommended component" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remove NumberField" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("frame")).toMatchObject({
        metadata: { slot: [] },
        slot: [],
      });
    });
  });

  it("inserts a recommended component as default slot content", async () => {
    const footer = makeElement("footer", {
      type: "CardFooter",
      slot: ["origin"],
    });
    const origin = makeElement("origin", {
      componentName: "BodyText",
      reusable: true,
      type: "Text",
    });

    const addElement = vi.fn(async (element: Element) => {
      const state = useStore.getState();
      useStore.setState({
        elements: [...state.elements, element],
        elementsMap: new Map([...state.elementsMap, [element.id, element]]),
      });
      useStore.getState()._rebuildIndexes();
    });

    useStore.setState({
      addElement,
      elements: [footer, origin],
      elementsMap: new Map([
        ["footer", footer],
        ["origin", origin],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="footer" />);

    fireEvent.click(screen.getByRole("button", { name: "Insert BodyText" }));

    await waitFor(() => {
      const children = useStore.getState().childrenMap.get("footer") ?? [];
      expect(children).toEqual([
        expect.objectContaining({
          type: "ref",
          ref: "origin",
          parent_id: "footer",
        }),
      ]);
    });
  });

  it("inserts the same recommended component multiple times as slot content", async () => {
    const footer = makeElement("footer", {
      type: "CardFooter",
      slot: ["origin"],
    });
    const origin = makeElement("origin", {
      componentName: "Button",
      reusable: true,
      type: "Button",
    });

    const addElement = vi.fn(async (element: Element) => {
      const state = useStore.getState();
      useStore.setState({
        elements: [...state.elements, element],
        elementsMap: new Map([...state.elementsMap, [element.id, element]]),
      });
      useStore.getState()._rebuildIndexes();
    });

    useStore.setState({
      addElement,
      elements: [footer, origin],
      elementsMap: new Map([
        ["footer", footer],
        ["origin", origin],
      ]),
    });
    useStore.getState()._rebuildIndexes();

    renderWithI18n(<FrameSlotSection elementId="footer" />);

    fireEvent.click(screen.getByRole("button", { name: "Insert Button" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert Button" }));

    await waitFor(() => {
      const children = useStore.getState().childrenMap.get("footer") ?? [];
      expect(children).toHaveLength(2);
      expect(children).toEqual([
        expect.objectContaining({
          type: "ref",
          ref: "origin",
          parent_id: "footer",
        }),
        expect.objectContaining({
          type: "ref",
          ref: "origin",
          parent_id: "footer",
        }),
      ]);
      expect(children[0].id).not.toBe(children[1].id);
    });
  });
});
