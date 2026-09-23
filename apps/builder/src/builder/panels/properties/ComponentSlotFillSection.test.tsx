// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../types/core/store.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { historyManager } from "../../stores/history";
import { useStore } from "../../stores";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { ComponentSlotFillSection } from "./ComponentSlotFillSection";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { ensureReusableCompositeOrigins } from "../../components/reusableCompositeOrigins";

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
    type: "Card",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

function seedCanonicalFromStore(): void {
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "component-slot-fill-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore
    .getState()
    .setCurrentProject("component-slot-fill-project");
  mergeElementsCanonicalPrimary(useStore.getState().elements);
  useStore.getState()._rebuildIndexes();
}

describe("ComponentSlotFillSection", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
    vi.restoreAllMocks();
    cleanup();
  });

  it("fills an instance internal slot with a recommended reusable component", async () => {
    const cardOrigin = makeElement("card-origin", {
      reusable: true,
      componentName: "ArticleCard",
    });
    const footerSlot = makeElement("footer", {
      type: "CardFooter",
      customId: "footer",
      parent_id: "card-origin",
      slot: ["text-origin"],
    });
    const textOrigin = makeElement("text-origin", {
      type: "Text",
      reusable: true,
      componentName: "BodyText",
    });
    const cardInstance = makeElement("card-instance", {
      type: "ref",
      ref: "card-origin",
    } as Partial<Element>);

    useStore.setState({
      elements: [cardOrigin, footerSlot, textOrigin, cardInstance],
      elementsMap: new Map([
        ["card-origin", cardOrigin],
        ["footer", footerSlot],
        ["text-origin", textOrigin],
        ["card-instance", cardInstance],
      ]),
    });
    seedCanonicalFromStore();

    render(<ComponentSlotFillSection elementId="card-instance" />);

    expect(screen.getByText("Slot Fill")).toBeTruthy();
    expect(screen.getByText("Empty")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fill slot" }));

    await waitFor(() => {
      expect(
        useStore.getState().elementsMap.get("card-instance"),
      ).toMatchObject({
        descendants: {
          footer: {
            children: [
              {
                id: "text-origin",
                type: "ref",
                ref: "text-origin",
              },
            ],
          },
        },
      });
    });
  });

  it("appends repeated fills instead of replacing existing slot children", async () => {
    const cardOrigin = makeElement("card-origin", {
      reusable: true,
      componentName: "ArticleCard",
    });
    const footerSlot = makeElement("footer", {
      type: "CardFooter",
      customId: "footer",
      parent_id: "card-origin",
      slot: ["button-origin"],
    });
    const buttonOrigin = makeElement("button-origin", {
      type: "Button",
      reusable: true,
      componentName: "Button",
    });
    const cardInstance = makeElement("card-instance", {
      type: "ref",
      ref: "card-origin",
    } as Partial<Element>);

    useStore.setState({
      elements: [cardOrigin, footerSlot, buttonOrigin, cardInstance],
      elementsMap: new Map([
        ["card-origin", cardOrigin],
        ["footer", footerSlot],
        ["button-origin", buttonOrigin],
        ["card-instance", cardInstance],
      ]),
    });
    seedCanonicalFromStore();

    render(<ComponentSlotFillSection elementId="card-instance" />);

    fireEvent.click(screen.getByRole("button", { name: "Fill slot" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill slot" }));

    await waitFor(() => {
      expect(
        useStore.getState().elementsMap.get("card-instance"),
      ).toMatchObject({
        descendants: {
          footer: {
            children: [
              {
                id: "button-origin",
                type: "ref",
                ref: "button-origin",
              },
              {
                id: "button-origin-2",
                type: "ref",
                ref: "button-origin",
              },
            ],
          },
        },
      });
    });
  });

  it("does not render for component origins", () => {
    const cardOrigin = makeElement("card-origin", {
      reusable: true,
    });

    useStore.setState({
      elements: [cardOrigin],
      elementsMap: new Map([["card-origin", cardOrigin]]),
    });
    seedCanonicalFromStore();

    const { container } = render(
      <ComponentSlotFillSection elementId="card-origin" />,
    );

    expect(container.firstChild).toBeNull();
  });
});

/**
 * ADR-234 Phase 3 (사용자 지적 2026-09-23 전수): TagGroup · Tabs instance 의 목록 틀 slot (TagList · TabList) 에
 * "Fill" = 항목 instance 추가다 — 상속 목록을 유지한 채 끝에 새 항목 (새 id) 을 붙이고, Tabs 는 짝 TabPanel 도.
 * 예전에는 빈 override 에서 시작해 상속 목록을 항목 1개 (id = origin id) 로 바꿔 버렸다.
 */
describe("ComponentSlotFillSection — 목록 틀 slot", () => {
  afterEach(() => {
    resetCanonicalMutationStoreActions();
    vi.restoreAllMocks();
    cleanup();
  });

  function seedInstanceDoc(ref: string) {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = ensureReusableCompositeOrigins({
      version: "composition-1.0",
      children: [],
    } as unknown as CompositionDocument);
    const doc = {
      ...base,
      children: [
        ...base.children,
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1", slug: "/x" },
          children: [
            {
              id: "body-1",
              type: "body",
              children: [{ id: "inst", type: "ref", ref, props: {} }],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "slot-fill-list-project",
      getCurrentLegacySnapshot: () => ({ elements: [], pages: [], layouts: [] }),
    });
    const updateElement = vi.fn(async () => {});
    useStore.setState({ currentPageId: "page-1", updateElement } as never);
    const canonical = useCanonicalDocumentStore.getState();
    canonical.setCurrentProject("slot-fill-list-project");
    canonical.setDocument("slot-fill-list-project", doc);
    return updateElement;
  }

  it.each([
    ["component-taggroup", "component-taggroup__2", 4, null],
    ["component-tabs", "component-tabs__1", 2, "component-tabs__2"],
  ])(
    "%s instance: Fill → 상속 항목 유지 + 새 항목 instance",
    async (ref, listPath, inherited, panelsPath) => {
      const updateElement = seedInstanceDoc(ref);
      render(<ComponentSlotFillSection elementId="inst" />);
      fireEvent.click(screen.getByRole("button", { name: /fill slot/i }));
      await waitFor(() => expect(updateElement).toHaveBeenCalledTimes(1));
      const [id, patch] = updateElement.mock.calls[0] as unknown as [
        string,
        { descendants: Record<string, { children: CanonicalNode[] }> },
      ];
      expect(id).toBe("inst");
      const children = patch.descendants[listPath]!.children;
      expect(children).toHaveLength(inherited + 1);
      const added = children[inherited] as CanonicalNode & { ref?: string };
      expect(added.type).toBe("ref");
      expect(added.id).not.toBe(added.ref);
      expect(new Set(children.map((c) => c.id)).size).toBe(children.length);
      if (panelsPath) {
        expect(patch.descendants[panelsPath]!.children).toHaveLength(
          inherited + 1,
        );
      }
    },
  );
});
