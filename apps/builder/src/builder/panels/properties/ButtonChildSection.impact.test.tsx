// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  __resetTraversalCache_TEST_ONLY__,
  getNodeMap,
} from "../../stores/canonical/canonicalTraversalHelpers";
import { useStore } from "../../stores";
import { historyManager } from "../../stores/history";
import { clearOriginImpactConfirmationCacheForTests } from "../../stores/utils/elementUpdate";
import { EditingSemanticsImpactDialogHost } from "../../components/overlay/EditingSemanticsImpactDialog";
import { resolveEditingSemanticsImpactConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { ButtonChildFields } from "./ButtonChildSection";

vi.mock("../../components/property/PropertyIconPicker", () => ({
  PropertyIconPicker: ({
    onChange,
    onClear,
  }: {
    onChange: (iconName: string) => void;
    onClear: () => void;
  }) => (
    <>
      <button onClick={() => onChange("activity")}>Choose activity</button>
      <button onClick={onClear}>Clear icon</button>
    </>
  ),
}));

vi.mock("../../components/property/PropertyInput", () => ({
  PropertyInput: () => null,
}));

vi.mock("../../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/db")>();
  return {
    ...actual,
    getDB: vi.fn(async () => ({ documents: { put: async () => {} } })),
  };
});

function seedOriginButton(withChildren = false): void {
  const document = {
    version: "composition-1.0",
    children: [
      {
        id: "origin-frame",
        type: "frame",
        reusable: true,
        props: {},
        children: [
          {
            id: "button-origin",
            type: "Button",
            reusable: true,
            props: { children: withChildren ? "" : "Button" },
            ...(withChildren
              ? {
                  children: [
                    {
                      id: "icon-1",
                      type: "Icon",
                      props: { iconName: "activity" },
                    },
                    {
                      id: "text-1",
                      type: "Text",
                      props: { children: "Button" },
                    },
                  ],
                }
              : {}),
          },
        ],
      },
      {
        id: "button-instance",
        type: "ref",
        ref: "button-origin",
        props: {},
      },
    ],
  } as unknown as CompositionDocument;

  useCanonicalDocumentStore.setState({
    documents: new Map([["button-impact-project", document]]),
    currentProjectId: "button-impact-project",
    documentVersion: 1,
  });
  useStore.setState({
    currentPageId: "page-1",
    elements: [],
    elementsMap: new Map(),
    childrenMap: new Map(),
    selectedElementId: "button-origin",
    selectedElementProps: { children: withChildren ? "" : "Button" },
    dirtyElementIds: new Set<string>(),
  } as never);
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "button-impact-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  __resetTraversalCache_TEST_ONLY__();
}

describe("Button child origin impact atomicity", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    clearOriginImpactConfirmationCacheForTests();
    historyManager.clearPageHistory("page-1");
    historyManager.setCurrentPage("page-1");
    seedOriginButton();
  });

  afterEach(() => {
    resolveEditingSemanticsImpactConfirmation(false);
    cleanup();
    resetCanonicalMutationStoreActions();
    vi.restoreAllMocks();
  });

  it("impact confirmation을 취소하면 Icon/Text mutation과 history가 남지 않는다", async () => {
    render(
      <>
        <ButtonChildFields elementId="button-origin" />
        <EditingSemanticsImpactDialogHost />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    });

    expect(getNodeMap().has("button-origin")).toBe(true);
    expect(
      [...getNodeMap().values()].filter(
        (node) => node.type === "Icon" || node.type === "Text",
      ),
    ).toHaveLength(0);
    expect(historyManager.getCurrentPageHistory().totalEntries).toBe(0);
  });

  it("확인하면 Icon/Text/Button update를 history 한 엔트리로 기록한다", async () => {
    render(
      <>
        <ButtonChildFields elementId="button-origin" />
        <EditingSemanticsImpactDialogHost />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(
        [...getNodeMap().values()].filter(
          (node) => node.type === "Icon" || node.type === "Text",
        ),
      ).toHaveLength(2);
    });
    expect(historyManager.getCurrentPageHistory()).toMatchObject({
      currentIndex: 0,
      totalEntries: 1,
    });
    expect(
      historyManager.getCurrentPageEntries()[0]?.data.canonicalEvents,
    ).toHaveLength(3);

    await useStore.getState().undo();
    await waitFor(() => {
      expect(
        [...getNodeMap().values()].filter(
          (node) => node.type === "Icon" || node.type === "Text",
        ),
      ).toHaveLength(0);
    });
    expect(getNodeMap().get("button-origin")?.props?.children).toBe("Button");
  });

  it("기존 Icon 제거 confirmation을 취소하면 자식이 그대로 남는다", async () => {
    seedOriginButton(true);
    render(
      <>
        <ButtonChildFields elementId="button-origin" />
        <EditingSemanticsImpactDialogHost />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear icon" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    });

    expect(
      [...getNodeMap().values()].filter(
        (node) => node.type === "Icon" || node.type === "Text",
      ),
    ).toHaveLength(2);
    expect(historyManager.getCurrentPageHistory().totalEntries).toBe(0);
  });

  it.each(["selection", "revision"] as const)(
    "dialog 대기 중 %s 변경 시 승인 후에도 stale mutation을 중단한다",
    async (changedState) => {
      render(
        <>
          <ButtonChildFields elementId="button-origin" />
          <EditingSemanticsImpactDialogHost />
        </>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
      const continueButton = await screen.findByRole("button", {
        name: "Continue",
      });
      if (changedState === "selection") {
        useStore.setState({ selectedElementId: "other-element" });
      } else {
        useCanonicalDocumentStore.setState((state) => ({
          documentVersion: state.documentVersion + 1,
        }));
      }
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
      });
      expect(
        [...getNodeMap().values()].filter(
          (node) => node.type === "Icon" || node.type === "Text",
        ),
      ).toHaveLength(0);
      expect(historyManager.getCurrentPageHistory().totalEntries).toBe(0);
    },
  );
});

// ADR-236 E4 — Button 자신은 origin 이 아니어도 origin 자손이면 아이콘 · 텍스트 자식 추가는 모든
//   instance 를 바꾼다. 트랜잭션 안 병렬 추가 전에 한 번 묻는다 (store 액션은 묻지 않는다).
function seedButtonInsideOrigin(): void {
  const document = {
    version: "composition-1.0",
    children: [
      {
        id: "card-origin",
        type: "frame",
        reusable: true,
        props: {},
        children: [
          { id: "inner-button", type: "Button", props: { children: "Go" } },
        ],
      },
      { id: "card-instance", type: "ref", ref: "card-origin", props: {} },
    ],
  } as unknown as CompositionDocument;
  useCanonicalDocumentStore.setState({
    documents: new Map([["button-impact-project", document]]),
    currentProjectId: "button-impact-project",
    documentVersion: 1,
  });
  useStore.setState({
    currentPageId: "page-1",
    elements: [],
    elementsMap: new Map(),
    childrenMap: new Map(),
    selectedElementId: "inner-button",
    selectedElementProps: { children: "Go" },
    dirtyElementIds: new Set<string>(),
  } as never);
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "button-impact-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  __resetTraversalCache_TEST_ONLY__();
}

describe("Button child — origin 자손의 구조 변경 영향 확인 (ADR-236 E4)", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    clearOriginImpactConfirmationCacheForTests();
    historyManager.clearPageHistory("page-1");
    historyManager.setCurrentPage("page-1");
    seedButtonInsideOrigin();
  });

  afterEach(() => {
    resolveEditingSemanticsImpactConfirmation(false);
    cleanup();
    resetCanonicalMutationStoreActions();
    vi.restoreAllMocks();
  });

  const iconChildren = () =>
    [...getNodeMap().values()].filter((node) => node.type === "Icon");

  it("취소하면 아이콘이 추가되지 않는다", async () => {
    render(
      <>
        <ButtonChildFields elementId="inner-button" />
        <EditingSemanticsImpactDialogHost />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
      fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    });
    expect(iconChildren()).toHaveLength(0);
    expect(historyManager.getCurrentPageHistory().totalEntries).toBe(0);
  });

  it("확인하면 한 번만 묻고 아이콘 · 텍스트가 모두 추가된다 (병렬 추가가 서로 취소하지 않는다)", async () => {
    render(
      <>
        <ButtonChildFields elementId="inner-button" />
        <EditingSemanticsImpactDialogHost />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose activity" }));
      const dialogs = await screen.findAllByRole("dialog");
      expect(dialogs).toHaveLength(1);
      resolveEditingSemanticsImpactConfirmation(true);
    });
    await waitFor(() => expect(iconChildren()).toHaveLength(1));
    expect(
      [...getNodeMap().values()].filter((node) => node.type === "Text"),
    ).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
